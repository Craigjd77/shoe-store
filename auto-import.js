const fs = require('fs');
const path = require('path');
const { analyzeShoesFolder, parseFilename } = require('./analyze-shoes');
const { convertHeicToJpg, isHeicFile } = require('./image-converter');
const { identifyShoeAI } = require('./ai-identifier');

// Configuration
const CONFIG = {
  SHOES_FOLDER: path.join(__dirname, 'SHOES'),
  UPLOADS_FOLDER: path.join(__dirname, 'uploads'),
  CHECK_INTERVAL: 10000, // Check every 10 seconds for new images
  PROCESSED_FILE: path.join(__dirname, '.processed-images.json'),
  AUTO_IMPORT_ENABLED: true, // Automatically import new images as shoes
  DEFAULT_MSRP: 120,
  DEFAULT_PRICE: 100,
  MIN_IMAGES_PER_SHOE: 1, // Minimum images to consider it a valid shoe
  WAIT_TIME_AFTER_CHANGE: 5000, // Wait 5 seconds after file change before processing
  SIMILARITY_THRESHOLD: 0.85, // Threshold for matching shoes (85% similarity)
  BATCH_SIZE: 50, // Process images in batches for bulk uploads
  MAX_CONCURRENT_CONVERSIONS: 5 // Limit concurrent HEIC conversions
};

// Track processed files
let processedFiles = new Set();
let fileChangeTimers = new Map();
let processingLock = false;

// Database connection (will be passed from server)
let db = null;

/**
 * Initialize processed files tracking
 */
function initProcessedFiles() {
  if (fs.existsSync(CONFIG.PROCESSED_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG.PROCESSED_FILE, 'utf8'));
      processedFiles = new Set(data.processed || []);
      console.log(`[Auto-Import] Loaded ${processedFiles.size} processed files from history`);
    } catch (error) {
      console.error('[Auto-Import] Error loading processed files:', error);
    }
  }
}

/**
 * Save processed files to disk
 */
function saveProcessedFiles() {
  try {
    fs.writeFileSync(CONFIG.PROCESSED_FILE, JSON.stringify({
      processed: Array.from(processedFiles),
      lastUpdated: new Date().toISOString()
    }, null, 2));
  } catch (error) {
    console.error('[Auto-Import] Error saving processed files:', error);
  }
}

/**
 * Check if file is already processed
 */
function isProcessed(filename) {
  return processedFiles.has(filename);
}

/**
 * Mark file as processed
 */
function markAsProcessed(filenames) {
  filenames.forEach(f => processedFiles.add(f));
  saveProcessedFiles();
}

/**
 * Get new unprocessed images
 */
function getNewImages() {
  if (!fs.existsSync(CONFIG.SHOES_FOLDER)) {
    return [];
  }

  const files = fs.readdirSync(CONFIG.SHOES_FOLDER);
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
  
  const newImages = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return imageExtensions.includes(ext) && !isProcessed(file);
  });

  return newImages;
}

/**
 * Calculate similarity between two strings (for matching shoes)
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1;
  
  // Simple Levenshtein-like similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / longer.length);
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

/**
 * Find existing shoe that matches new images (smart matching)
 */
async function findMatchingShoe(identifiedShoe, imageFilenames, dbConnection) {
  return new Promise((resolve) => {
    // First, check if any of these source filenames are already in the database
    // by checking the processed list and cross-referencing with existing shoes
    dbConnection.all(
      `SELECT s.id, s.brand, s.model, s.description, COUNT(si.id) as image_count,
              GROUP_CONCAT(si.image_path) as image_paths
       FROM shoes s
       LEFT JOIN shoe_images si ON s.id = si.shoe_id
       WHERE s.brand = ? AND s.model = ?
       GROUP BY s.id
       HAVING ABS(image_count - ?) <= 3
       ORDER BY image_count DESC
       LIMIT 5`,
      [identifiedShoe.brand, identifiedShoe.model, imageFilenames.length],
      (err, rows) => {
        if (err || !rows || rows.length === 0) {
          resolve(null);
          return;
        }
        
        // Score each potential match
        let bestMatch = null;
        let bestScore = 0;
        
        for (const row of rows) {
          let score = 0;
          
          // Brand match
          if (row.brand && identifiedShoe.brand) {
            const brandSim = calculateSimilarity(row.brand, identifiedShoe.brand);
            score += brandSim * 0.3;
          }
          
          // Model match
          if (row.model && identifiedShoe.model) {
            const modelSim = calculateSimilarity(row.model, identifiedShoe.model);
            score += modelSim * 0.4;
          }
          
          // Image count similarity
          const countDiff = Math.abs(row.image_count - imageFilenames.length);
          const countScore = Math.max(0, 1 - (countDiff / Math.max(row.image_count, imageFilenames.length)));
          score += countScore * 0.3;
          
          if (score > bestScore && score >= CONFIG.SIMILARITY_THRESHOLD) {
            bestScore = score;
            bestMatch = row;
          }
        }
        
        resolve(bestMatch);
      }
    );
  });
}

/**
 * Enhanced shoe identification using AI
 */
async function identifyShoe(shoeData) {
  try {
    const aiIdentified = await identifyShoeAI(shoeData);
    return {
      ...shoeData,
      ...aiIdentified,
      images: shoeData.images // Preserve original images array
    };
  } catch (error) {
    console.error('[Auto-Import] Error in AI identification:', error);
    return shoeData; // Return original if AI fails
  }
}

/**
 * Import a single shoe to database
 */
function importShoe(shoeData, dbConnection) {
  return new Promise((resolve, reject) => {
    const msrp = shoeData.msrp || CONFIG.DEFAULT_MSRP;
    const price = shoeData.price || CONFIG.DEFAULT_PRICE;

    // Insert shoe
    dbConnection.run(
      'INSERT INTO shoes (brand, model, description, msrp, price, size, gender, condition) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        shoeData.brand || 'Unknown Brand',
        shoeData.model || 'Unknown Model',
        shoeData.description || `${shoeData.brand || 'Unknown'} ${shoeData.model || 'Unknown'}`,
        msrp,
        price,
        shoeData.size || '9',
        shoeData.gender || 'Mens',
        shoeData.condition || 'Excellent'
      ],
      function(err) {
        if (err) {
          reject(err);
          return;
        }

        const shoeId = this.lastID;
        const images = shoeData.images || [];
        const uploadsFolder = CONFIG.UPLOADS_FOLDER;
        const shoesFolder = CONFIG.SHOES_FOLDER;

        // Ensure uploads folder exists
        if (!fs.existsSync(uploadsFolder)) {
          fs.mkdirSync(uploadsFolder, { recursive: true });
        }

        // Process images
        const imagePromises = images.map((img, index) => {
          return new Promise((resolveImg, rejectImg) => {
            const filename = typeof img === 'string' ? img : img.filename;
            const sourcePath = path.join(shoesFolder, filename);

            if (!fs.existsSync(sourcePath)) {
              console.warn(`[Auto-Import] Image not found: ${filename}`);
              rejectImg(new Error(`Image not found: ${filename}`));
              return;
            }

            // Generate destination filename
            const timestamp = Date.now();
            const ext = path.extname(filename);
            let destFilename = `shoe-${shoeId}-${timestamp}-${index}${ext}`;
            let destPath = path.join(uploadsFolder, destFilename);

            try {
              // Convert HEIC to JPG in SHOES folder first, then copy
              let sourceFileToCopy = sourcePath;
              let finalSourceFilename = filename;
              
              if (isHeicFile(filename)) {
                // Convert HEIC to JPG in SHOES folder
                const jpgFilename = convertHeicToJpg(sourcePath);
                if (jpgFilename !== filename) {
                  const jpgPath = path.join(shoesFolder, jpgFilename);
                  if (fs.existsSync(jpgPath)) {
                    // Use the JPG version
                    sourceFileToCopy = jpgPath;
                    finalSourceFilename = jpgFilename;
                    // Delete original HEIC from SHOES folder
                    try {
                      if (fs.existsSync(sourcePath)) {
                        fs.unlinkSync(sourcePath);
                        console.log(`[Auto-Import] ✓ Deleted original HEIC: ${filename}`);
                      }
                    } catch (e) {
                      console.warn(`[Auto-Import] Could not delete HEIC: ${filename}`);
                    }
                  }
                }
              }
              
              // Copy file (now it's JPG if it was HEIC)
              fs.copyFileSync(sourceFileToCopy, destPath);
              
              // Update destFilename to use JPG extension if converted
              if (isHeicFile(filename) && !isHeicFile(finalSourceFilename)) {
                destFilename = finalSourceFilename;
                destPath = path.join(uploadsFolder, destFilename);
              }

              // Insert image record
              const isPrimary = index === 0 ? 1 : 0;
              dbConnection.run(
                'INSERT INTO shoe_images (shoe_id, image_path, is_primary, display_order) VALUES (?, ?, ?, ?)',
                [shoeId, destFilename, isPrimary, index],
                (err) => {
                  if (err) {
                    // Clean up copied file on error
                    if (fs.existsSync(destPath)) {
                      try {
                        fs.unlinkSync(destPath);
                      } catch (e) {
                        // Ignore
                      }
                    }
                    rejectImg(err);
                  } else {
                    resolveImg();
                  }
                }
              );
            } catch (fileError) {
              rejectImg(fileError);
            }
          });
        });

        Promise.all(imagePromises)
          .then(() => {
            resolve({ shoeId, imageCount: images.length });
          })
          .catch(reject);
      }
    );
  });
}

/**
 * Add images to existing shoe
 */
async function addImagesToExistingShoe(shoeId, imageFilenames, dbConnection) {
  return new Promise((resolve, reject) => {
    const uploadsFolder = CONFIG.UPLOADS_FOLDER;
    const shoesFolder = CONFIG.SHOES_FOLDER;

    // Get current image count
    dbConnection.get('SELECT COUNT(*) as count FROM shoe_images WHERE shoe_id = ?', [shoeId], (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      const currentImageCount = result.count || 0;
      const imagePromises = imageFilenames.map((filename, index) => {
        return new Promise((resolveImg, rejectImg) => {
          const sourcePath = path.join(shoesFolder, filename);

          if (!fs.existsSync(sourcePath)) {
            rejectImg(new Error(`Image not found: ${filename}`));
            return;
          }

          const timestamp = Date.now();
          const ext = path.extname(filename);
          let destFilename = `shoe-${shoeId}-${timestamp}-${currentImageCount + index}${ext}`;
          let destPath = path.join(uploadsFolder, destFilename);

          try {
            // Convert HEIC to JPG in SHOES folder first, then copy
            let sourceFileToCopy = sourcePath;
            let finalSourceFilename = filename;
            
            if (isHeicFile(filename)) {
              // Convert HEIC to JPG in SHOES folder
              const jpgFilename = convertHeicToJpg(sourcePath);
              if (jpgFilename !== filename) {
                const jpgPath = path.join(shoesFolder, jpgFilename);
                if (fs.existsSync(jpgPath)) {
                  // Use the JPG version
                  sourceFileToCopy = jpgPath;
                  finalSourceFilename = jpgFilename;
                  // Delete original HEIC from SHOES folder
                  try {
                    if (fs.existsSync(sourcePath)) {
                      fs.unlinkSync(sourcePath);
                      console.log(`[Auto-Import] ✓ Deleted original HEIC: ${filename}`);
                    }
                  } catch (e) {
                    console.warn(`[Auto-Import] Could not delete HEIC: ${filename}`);
                  }
                }
              }
            }
            
            // Copy file (now it's JPG if it was HEIC)
            fs.copyFileSync(sourceFileToCopy, destPath);
            
            // Update destFilename to use JPG extension if converted
            if (isHeicFile(filename) && !isHeicFile(finalSourceFilename)) {
              destFilename = finalSourceFilename;
              destPath = path.join(uploadsFolder, destFilename);
            }

            dbConnection.run(
              'INSERT INTO shoe_images (shoe_id, image_path, is_primary, display_order) VALUES (?, ?, ?, ?)',
              [shoeId, destFilename, 0, currentImageCount + index],
              (err) => {
                if (err) {
                  if (fs.existsSync(destPath)) {
                    try {
                      fs.unlinkSync(destPath);
                    } catch (e) {
                      // Ignore
                    }
                  }
                  rejectImg(err);
                } else {
                  resolveImg();
                }
              }
            );
          } catch (fileError) {
            rejectImg(fileError);
          }
        });
      });

      Promise.all(imagePromises)
        .then(() => {
          resolve({ added: imageFilenames.length });
        })
        .catch(reject);
    });
  });
}

/**
 * Process new shoes with smart duplicate detection and matching
 */
async function processNewShoes(dbConnection) {
  if (!CONFIG.AUTO_IMPORT_ENABLED || processingLock) {
    return;
  }

  processingLock = true;

  try {
    const newImages = getNewImages();
    
    if (newImages.length === 0) {
      processingLock = false;
      return;
    }

    console.log(`\n[Auto-Import] 🔍 Found ${newImages.length} new image(s)`);

    // Analyze shoes
    const analyzedShoes = await analyzeShoesFolder(CONFIG.SHOES_FOLDER);
    
    // Filter to only new shoes (those with new images)
    const newShoes = analyzedShoes.filter(shoe => {
      const shoeImages = shoe.images.map(img => 
        typeof img === 'string' ? img : img.filename
      );
      return shoeImages.some(img => newImages.includes(img)) && shoeImages.length > 0;
    });

    if (newShoes.length === 0) {
      console.log('[Auto-Import] ✓ No new shoes to process');
      processingLock = false;
      return;
    }

    console.log(`[Auto-Import] 📦 Processing ${newShoes.length} new shoe group(s)...`);

    // Process shoes in batches for better performance with bulk uploads
    const batchSize = CONFIG.BATCH_SIZE || 50;
    for (let i = 0; i < newShoes.length; i += batchSize) {
      const batch = newShoes.slice(i, i + batchSize);
      console.log(`[Auto-Import] Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} shoes)...`);
      
      // Process batch
      for (const shoe of batch) {
      try {
        // Enhanced AI identification
        const identifiedShoe = await identifyShoe(shoe);
        
        const imageFilenames = identifiedShoe.images.map(img => 
          typeof img === 'string' ? img : img.filename
        );

        // Check if all images are already processed
        const alreadyProcessed = imageFilenames.every(filename => isProcessed(filename));
        if (alreadyProcessed) {
          console.log(`[Auto-Import] ⚠ Skipping: All images already processed`);
          continue;
        }

        // Smart matching: Try to find existing shoe to add images to
        const matchingShoe = await findMatchingShoe(identifiedShoe, imageFilenames, dbConnection);
        
        if (matchingShoe) {
          console.log(`[Auto-Import] 🔗 Matching existing shoe found: ${matchingShoe.brand} ${matchingShoe.model} (ID: ${matchingShoe.id})`);
          console.log(`[Auto-Import] ➕ Adding ${imageFilenames.length} image(s) to existing shoe...`);
          
          try {
            await addImagesToExistingShoe(matchingShoe.id, imageFilenames, dbConnection);
            markAsProcessed(imageFilenames);
            console.log(`[Auto-Import] ✓ Successfully added images to shoe ID ${matchingShoe.id}`);
          } catch (error) {
            console.error(`[Auto-Import] ✗ Error adding images to existing shoe:`, error);
            // Continue to next shoe instead of failing completely
          }
        } else {
          // No match found, create new shoe
          if (identifiedShoe.autoIdentified) {
            const colorInfo = identifiedShoe.color ? ` (${identifiedShoe.color})` : '';
            console.log(`[Auto-Import] 🤖 AI Identified: ${identifiedShoe.brand} ${identifiedShoe.model}${colorInfo} - $${identifiedShoe.msrp} MSRP`);
          }

          try {
            const result = await importShoe(identifiedShoe, dbConnection);
            markAsProcessed(imageFilenames);
            console.log(`[Auto-Import] ✓ Created new shoe: ${identifiedShoe.brand} ${identifiedShoe.model} (ID: ${result.shoeId}, ${result.imageCount} images)`);
          } catch (error) {
            console.error(`[Auto-Import] ✗ Error importing shoe:`, error);
            // Don't mark as processed if import failed
          }
        }
      } catch (error) {
        console.error(`[Auto-Import] ✗ Error processing shoe:`, error);
        // Continue with next shoe
      }
      }
      
      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < newShoes.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`[Auto-Import] ✅ Processing complete\n`);
  } catch (error) {
    console.error('[Auto-Import] ✗ Fatal error in processNewShoes:', error);
  } finally {
    processingLock = false;
  }
}

/**
 * Clean up duplicate shoes (automatic cleanup)
 */
async function cleanupDuplicates(dbConnection) {
  return new Promise((resolve) => {
    console.log('[Auto-Import] 🧹 Checking for duplicate shoes...');
    
    // Find shoes with same brand/model and similar image counts
    dbConnection.all(
      `SELECT s.id, s.brand, s.model, COUNT(si.id) as image_count,
              GROUP_CONCAT(si.id) as image_ids
       FROM shoes s
       LEFT JOIN shoe_images si ON s.id = si.shoe_id
       WHERE s.brand != 'Unknown Brand' AND s.model != 'Unknown Model'
       GROUP BY s.id
       HAVING image_count > 0
       ORDER BY s.brand, s.model, s.id`,
      [],
      (err, rows) => {
        if (err || !rows || rows.length < 2) {
          resolve({ cleaned: 0 });
          return;
        }

        const duplicates = [];
        for (let i = 0; i < rows.length; i++) {
          for (let j = i + 1; j < rows.length; j++) {
            const shoe1 = rows[i];
            const shoe2 = rows[j];
            
            if (shoe1.brand === shoe2.brand && 
                shoe1.model === shoe2.model &&
                Math.abs(shoe1.image_count - shoe2.image_count) <= 2) {
              // Potential duplicate - keep the one with more images or lower ID
              const toKeep = shoe1.image_count >= shoe2.image_count ? shoe1 : shoe2;
              const toRemove = shoe1.image_count >= shoe2.image_count ? shoe2 : shoe1;
              duplicates.push({ keep: toKeep.id, remove: toRemove.id });
            }
          }
        }

        if (duplicates.length === 0) {
          console.log('[Auto-Import] ✓ No duplicates found');
          resolve({ cleaned: 0 });
          return;
        }

        // Remove duplicates (keep first occurrence)
        const uniqueRemovals = [...new Set(duplicates.map(d => d.remove))];
        let cleaned = 0;
        let processed = 0;

        uniqueRemovals.forEach(shoeId => {
          // Delete images first
          dbConnection.run('DELETE FROM shoe_images WHERE shoe_id = ?', [shoeId], (err) => {
            if (!err) {
              // Then delete shoe
              dbConnection.run('DELETE FROM shoes WHERE id = ?', [shoeId], (err2) => {
                processed++;
                if (!err2) {
                  cleaned++;
                }
                if (processed === uniqueRemovals.length) {
                  if (cleaned > 0) {
                    console.log(`[Auto-Import] ✓ Cleaned up ${cleaned} duplicate shoe(s)`);
                  }
                  resolve({ cleaned });
                }
              });
            } else {
              processed++;
              if (processed === uniqueRemovals.length) {
                resolve({ cleaned });
              }
            }
          });
        });
      }
    );
  });
}

/**
 * Initialize auto-import service
 */
function initAutoImport(dbConnection) {
  db = dbConnection;
  initProcessedFiles();

  // Ensure folders exist
  if (!fs.existsSync(CONFIG.SHOES_FOLDER)) {
    fs.mkdirSync(CONFIG.SHOES_FOLDER, { recursive: true });
    console.log(`[Auto-Import] Created SHOES folder at: ${CONFIG.SHOES_FOLDER}`);
  }

  if (!fs.existsSync(CONFIG.UPLOADS_FOLDER)) {
    fs.mkdirSync(CONFIG.UPLOADS_FOLDER, { recursive: true });
    console.log(`[Auto-Import] Created uploads folder at: ${CONFIG.UPLOADS_FOLDER}`);
  }

  // Initial cleanup on startup
  setTimeout(() => {
    cleanupDuplicates(dbConnection).catch(err => {
      console.error('[Auto-Import] Error in cleanup:', err);
    });
  }, 5000);

  // Process immediately on startup
  processNewShoes(dbConnection).catch(err => {
    console.error('[Auto-Import] Error in initial processing:', err);
  });

  // Set up file watcher for SHOES folder
  if (fs.existsSync(CONFIG.SHOES_FOLDER)) {
    fs.watch(CONFIG.SHOES_FOLDER, { recursive: false }, (eventType, filename) => {
      if (!filename) return;
      
      const ext = path.extname(filename).toLowerCase();
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
      
      if (imageExtensions.includes(ext)) {
        // Clear existing timer for this file
        if (fileChangeTimers.has(filename)) {
          clearTimeout(fileChangeTimers.get(filename));
        }
        
        // Set new timer to process after file stabilizes
        const timer = setTimeout(() => {
          fileChangeTimers.delete(filename);
          if (CONFIG.AUTO_IMPORT_ENABLED && !processingLock) {
            processNewShoes(dbConnection).catch(err => {
              console.error('[Auto-Import] Error processing new files:', err);
            });
          }
        }, CONFIG.WAIT_TIME_AFTER_CHANGE);
        
        fileChangeTimers.set(filename, timer);
      }
    });
  }

  // Periodic check (backup in case file watcher misses something)
  setInterval(() => {
    if (CONFIG.AUTO_IMPORT_ENABLED && !processingLock) {
      processNewShoes(dbConnection).catch(err => {
        console.error('[Auto-Import] Error in periodic check:', err);
      });
    }
  }, CONFIG.CHECK_INTERVAL);

  console.log('[Auto-Import] ✅ Auto-import service initialized');
  console.log(`[Auto-Import] 📁 Monitoring: ${CONFIG.SHOES_FOLDER}`);
  console.log(`[Auto-Import] 🔄 Check interval: ${CONFIG.CHECK_INTERVAL / 1000}s`);
}

module.exports = {
  initAutoImport,
  processNewShoes,
  cleanupDuplicates,
  CONFIG
};
