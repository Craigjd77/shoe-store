const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const { analyzeShoesFolder } = require('./analyze-shoes');
const { initAutoImport, processNewShoes, cleanupDuplicates, CONFIG } = require('./auto-import');
const { convertHeicToJpg, isHeicFile } = require('./image-converter');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/SHOES', express.static('SHOES'));

// Preview endpoint for images (converts HEIC to JPG on-the-fly)
app.get('/api/images/preview/:filename', (req, res) => {
  const { filename } = req.params;
  const shoesFolder = path.join(__dirname, 'SHOES');
  const imagePath = path.join(shoesFolder, filename);
  
  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: 'Image not found' });
  }
  
  // If it's a HEIC file, convert to JPG for preview
  if (isHeicFile(filename)) {
    const ext = path.extname(filename).toLowerCase();
    const basename = path.basename(filename, ext);
    const jpgPath = path.join(shoesFolder, `${basename}.jpg`);
    
    // Check if JPG already exists (cached conversion)
    if (fs.existsSync(jpgPath)) {
      // Set appropriate headers for image
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      return res.sendFile(jpgPath);
    }
    
    // Convert HEIC to JPG on-the-fly
    try {
      const jpgFilename = convertHeicToJpg(imagePath);
      if (jpgFilename !== filename && fs.existsSync(jpgPath)) {
        // Set appropriate headers for image
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        return res.sendFile(jpgPath);
      }
    } catch (error) {
      console.error(`Error converting HEIC for preview: ${filename}`, error);
      // Return a placeholder image
      return res.status(500).send(`
        <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="200" fill="#667eea"/>
          <text x="50%" y="50%" text-anchor="middle" fill="white" font-family="Arial" font-size="14" dy=".3em">HEIC Conversion Failed</text>
        </svg>
      `);
    }
    
    // If conversion failed, return a placeholder
    return res.status(500).send(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#667eea"/>
        <text x="50%" y="50%" text-anchor="middle" fill="white" font-family="Arial" font-size="14" dy=".3em">HEIC Conversion Failed</text>
      </svg>
    `);
  }
  
  // For non-HEIC files, serve directly with appropriate content type
  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  
  if (contentTypes[ext]) {
    res.setHeader('Content-Type', contentTypes[ext]);
  }
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
  
  res.sendFile(imagePath);
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'shoe-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|heic|heif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/octet-stream'; // HEIC files sometimes have this mimetype
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Initialize database
const dbPath = path.join(__dirname, 'shoes.db');
const db = new sqlite3.Database(dbPath);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Initialize database tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS shoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    description TEXT,
    msrp REAL NOT NULL,
    price REAL NOT NULL,
    size TEXT DEFAULT '9',
    gender TEXT DEFAULT 'Mens',
    condition TEXT DEFAULT 'New',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS shoe_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shoe_id INTEGER NOT NULL,
    image_path TEXT NOT NULL,
    is_primary INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY (shoe_id) REFERENCES shoes(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    shoe_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shoe_id) REFERENCES shoes(id) ON DELETE CASCADE
  )`);
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes

// Get all shoes with images
app.get('/api/shoes', (req, res) => {
  const { brand, search, sort = 'created_at', order = 'DESC' } = req.query;
  
  let query = `
    SELECT 
      s.*,
      GROUP_CONCAT(si.image_path) as images,
      GROUP_CONCAT(si.id) as image_ids,
      (SELECT image_path FROM shoe_images WHERE shoe_id = s.id AND is_primary = 1 LIMIT 1) as primary_image
    FROM shoes s
    LEFT JOIN shoe_images si ON s.id = si.shoe_id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (brand) {
    query += ' AND s.brand = ?';
    params.push(brand);
  }
  
  if (search) {
    query += ' AND (s.brand LIKE ? OR s.model LIKE ? OR s.description LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }
  
  query += ` GROUP BY s.id ORDER BY s.${sort} ${order}`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Parse images
    const shoes = rows.map(shoe => ({
      ...shoe,
      images: shoe.images ? shoe.images.split(',') : [],
      image_ids: shoe.image_ids ? shoe.image_ids.split(',') : [],
      msrp: parseFloat(shoe.msrp),
      price: parseFloat(shoe.price)
    }));
    
    res.json(shoes);
  });
});

// Get import status - which images are processed vs new
app.get('/api/shoes/import-status', (req, res) => {
  const shoesFolder = path.join(__dirname, 'SHOES');
  const processedFile = path.join(__dirname, '.processed-images.json');
  
  let processedFiles = new Set();
  if (fs.existsSync(processedFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(processedFile, 'utf8'));
      processedFiles = new Set(data.processed || []);
    } catch (error) {
      console.error('Error reading processed files:', error);
    }
  }
  
  // Get all images in SHOES folder
  const allImages = [];
  if (fs.existsSync(shoesFolder)) {
    const files = fs.readdirSync(shoesFolder);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
    
    files.forEach(file => {
      const ext = path.extname(file).toLowerCase();
      if (imageExtensions.includes(ext)) {
        allImages.push({
          filename: file,
          isProcessed: processedFiles.has(file),
          size: fs.statSync(path.join(shoesFolder, file)).size,
          modified: fs.statSync(path.join(shoesFolder, file)).mtime
        });
      }
    });
  }
  
  // Get all shoes in database and check which images are tied to shoes
  db.all(`
    SELECT si.image_path, s.id as shoe_id, s.brand, s.model
    FROM shoe_images si
    JOIN shoes s ON si.shoe_id = s.id
  `, (err, imageShoeLinks) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Create a map of image paths to shoe info
    const imageToShoeMap = {};
    imageShoeLinks.forEach(link => {
      // Extract original filename from image_path (which might be in uploads folder)
      // For images from SHOES folder, we need to match by original filename
      // The image_path in DB is like "shoe-123-1234567890-0.jpg"
      // We need to track which original file was used
      // For now, we'll check if the filename matches any SHOES folder file
      const dbFilename = path.basename(link.image_path);
      // Try to find matching original file (this is approximate)
      for (const img of allImages) {
        const imgBase = path.basename(img.filename, path.extname(img.filename));
        const dbBase = path.basename(dbFilename, path.extname(dbFilename));
        // If they're similar or if we can match by checking processed files
        if (img.isProcessed && !imageToShoeMap[img.filename]) {
          // This is a heuristic - in practice, we'd need better tracking
        }
      }
    });
    
    // Get count of shoes
    db.get('SELECT COUNT(*) as count FROM shoes', (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const newImages = allImages.filter(img => !img.isProcessed);
      const processedImages = allImages.filter(img => img.isProcessed);
      
      res.json({
        total: allImages.length,
        new: newImages.length,
        processed: processedImages.length,
        newImages: newImages.map(img => ({
          filename: img.filename,
          size: img.size,
          modified: img.modified
        })),
        processedImages: processedImages.map(img => ({
          filename: img.filename,
          size: img.size,
          modified: img.modified
        })),
        shoesInDatabase: result.count
      });
    });
  });
});

// Get which shoe an image is tied to (by checking original filename in SHOES folder)
app.get('/api/images/:filename/shoe', (req, res) => {
  const { filename } = req.params;
  
  // Check if this image is used in any shoe
  // Since images are copied to uploads folder, we need to check processed files
  const processedFile = path.join(__dirname, '.processed-images.json');
  let processedFiles = new Set();
  if (fs.existsSync(processedFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(processedFile, 'utf8'));
      processedFiles = new Set(data.processed || []);
    } catch (error) {
      console.error('Error reading processed files:', error);
    }
  }
  
  if (!processedFiles.has(filename)) {
    return res.json({ tiedToShoe: false });
  }
  
  // Try to find the shoe by matching image patterns
  // This is approximate - we'd need better tracking
  db.all(`
    SELECT s.id, s.brand, s.model, COUNT(si.id) as image_count
    FROM shoes s
    JOIN shoe_images si ON s.id = si.shoe_id
    GROUP BY s.id
  `, (err, shoes) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // For now, return that it's processed but we can't determine exact shoe
    // In a better implementation, we'd track the mapping
    res.json({ 
      tiedToShoe: true,
      note: 'Image has been imported (exact shoe mapping not available)'
    });
  });
});

// Analyze images in SHOES folder (must be before /api/shoes/:id route)
// Only returns NEW (unprocessed) images with AI identification
app.get('/api/shoes/analyze', async (req, res) => {
  const shoesFolder = path.join(__dirname, 'SHOES');
  const processedFile = path.join(__dirname, '.processed-images.json');
  
  // Load processed files
  let processedFiles = new Set();
  if (fs.existsSync(processedFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(processedFile, 'utf8'));
      processedFiles = new Set(data.processed || []);
    } catch (error) {
      console.error('Error reading processed files:', error);
    }
  }
  
  try {
    const analyzedShoes = await analyzeShoesFolder(shoesFolder);
    
    // Filter to only show shoes with NEW (unprocessed) images
    const newShoes = analyzedShoes.map(shoe => {
      // Filter images to only include unprocessed ones
      const newImages = shoe.images.filter(img => {
        const filename = typeof img === 'string' ? img : img.filename;
        return !processedFiles.has(filename);
      });
      
      // Only include shoe if it has new images
      if (newImages.length > 0) {
        return {
          ...shoe,
          images: newImages,
          imageCount: newImages.length
        };
      }
      return null;
    }).filter(shoe => shoe !== null); // Remove shoes with no new images
    
    res.json(newShoes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single shoe with all images
app.get('/api/shoes/:id', (req, res) => {
  const { id } = req.params;
  
  // Don't treat "analyze" as an ID
  if (id === 'analyze') {
    return res.status(404).json({ error: 'Use GET /api/shoes/analyze instead' });
  }
  
  db.get('SELECT * FROM shoes WHERE id = ?', [id], (err, shoe) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!shoe) {
      return res.status(404).json({ error: 'Shoe not found' });
    }
    
    db.all(
      'SELECT * FROM shoe_images WHERE shoe_id = ? ORDER BY is_primary DESC, display_order ASC',
      [id],
      (err, images) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        res.json({
          ...shoe,
          msrp: parseFloat(shoe.msrp),
          price: parseFloat(shoe.price),
          images: images
        });
      }
    );
  });
});

// Get all brands
app.get('/api/brands', (req, res) => {
  db.all('SELECT DISTINCT brand FROM shoes ORDER BY brand', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows.map(row => row.brand));
  });
});

// Add new shoe (admin)
app.post('/api/shoes', (req, res) => {
  const { brand, model, description, msrp, price, size = '9', gender = 'Mens', condition = 'Excellent' } = req.body;
  
  if (!brand || !model || !msrp || !price) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  db.run(
    'INSERT INTO shoes (brand, model, description, msrp, price, size, gender, condition) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [brand, model, description, msrp, price, size, gender, condition],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, message: 'Shoe added successfully' });
    }
  );
});

// Update shoe
app.put('/api/shoes/:id', (req, res) => {
  const { id } = req.params;
  const { brand, model, description, msrp, price, size, gender, condition } = req.body;
  
  if (!brand || !model || !msrp || !price) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  db.run(
    'UPDATE shoes SET brand = ?, model = ?, description = ?, msrp = ?, price = ?, size = ?, gender = ?, condition = ? WHERE id = ?',
    [brand, model, description || '', msrp, price, size || '9', gender || 'Mens', condition || 'Excellent', id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Shoe not found' });
      }
      
      res.json({ message: 'Shoe updated successfully', id: parseInt(id) });
    }
  );
});

// Delete shoe
app.delete('/api/shoes/:id', (req, res) => {
  const { id } = req.params;
  
  // Get all images for this shoe
  db.all('SELECT image_path FROM shoe_images WHERE shoe_id = ?', [id], (err, images) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Delete the shoe (cascade will delete images from DB)
    db.run('DELETE FROM shoes WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Shoe not found' });
      }
      
      // Delete image files
      images.forEach(image => {
        const filePath = path.join(uploadsDir, image.image_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      
      res.json({ message: 'Shoe deleted successfully' });
    });
  });
});

// Add images from SHOES folder to existing shoe
app.post('/api/shoes/:id/add-images-from-shoes', (req, res) => {
  const { id } = req.params;
  const { imageFilenames } = req.body;
  
  if (!imageFilenames || !Array.isArray(imageFilenames) || imageFilenames.length === 0) {
    return res.status(400).json({ error: 'No image filenames provided' });
  }
  
  // Check if shoe exists
  db.get('SELECT id FROM shoes WHERE id = ?', [id], (err, shoe) => {
    if (err || !shoe) {
      return res.status(404).json({ error: 'Shoe not found' });
    }
    
    const shoesFolder = path.join(__dirname, 'SHOES');
    const uploadsFolder = path.join(__dirname, 'uploads');
    const imagePromises = [];
    
    // Get current image count to set display order
    db.get('SELECT COUNT(*) as count FROM shoe_images WHERE shoe_id = ?', [id], (err, result) => {
      const currentImageCount = result.count || 0;
      
      imageFilenames.forEach((filename, index) => {
        const sourcePath = path.join(shoesFolder, filename);
        
        if (!fs.existsSync(sourcePath)) {
          console.warn(`Image not found: ${filename}`);
          return;
        }
        
        const originalExt = path.extname(filename);
        const timestamp = Date.now();
        let destFilename = `shoe-${id}-${timestamp}-${currentImageCount + index}${originalExt}`;
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
                    console.log(`[Add Images] ✓ Deleted original HEIC: ${filename}`);
                  }
                } catch (e) {
                  console.warn(`[Add Images] Could not delete HEIC: ${filename}`);
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
          const isPrimary = currentImageCount === 0 && index === 0 ? 1 : 0;
          const imagePromise = new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO shoe_images (shoe_id, image_path, is_primary, display_order) VALUES (?, ?, ?, ?)',
              [id, destFilename, isPrimary, currentImageCount + index],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          imagePromises.push(imagePromise);
        } catch (fileError) {
          console.error('Error copying/converting file:', fileError);
        }
      });
      
      // Wait for all images to be inserted
      Promise.all(imagePromises)
        .then(() => {
          // Mark images as processed
          const processedFile = path.join(__dirname, '.processed-images.json');
          let processedFiles = new Set();
          if (fs.existsSync(processedFile)) {
            try {
              const data = JSON.parse(fs.readFileSync(processedFile, 'utf8'));
              processedFiles = new Set(data.processed || []);
            } catch (error) {
              console.error('Error reading processed files:', error);
            }
          }
          
          imageFilenames.forEach(filename => {
            processedFiles.add(filename);
          });
          
          try {
            fs.writeFileSync(processedFile, JSON.stringify({
              processed: Array.from(processedFiles),
              lastUpdated: new Date().toISOString()
            }, null, 2));
          } catch (error) {
            console.error('Error saving processed files:', error);
          }
          
          res.json({ 
            message: `${imageFilenames.length} image(s) added successfully`,
            added: imagePromises.length
          });
        })
        .catch((imgErr) => {
          console.error('Error inserting images:', imgErr);
          res.status(500).json({ error: 'Error adding images to shoe' });
        });
    });
  });
});

// Upload images for a shoe
app.post('/api/shoes/:id/images', upload.array('images', 10), (req, res) => {
  const { id } = req.params;
  const files = req.files;
  
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No images uploaded' });
  }
  
  // Check if shoe exists
  db.get('SELECT id FROM shoes WHERE id = ?', [id], (err, shoe) => {
    if (err || !shoe) {
      // Delete uploaded files if shoe doesn't exist
      files.forEach(file => fs.unlinkSync(file.path));
      return res.status(404).json({ error: 'Shoe not found' });
    }
    
    // Check if there's already a primary image
    db.get('SELECT COUNT(*) as count FROM shoe_images WHERE shoe_id = ? AND is_primary = 1', [id], (err, result) => {
      const hasPrimary = result.count > 0;
      
      // Convert HEIC files to JPG
      const processedFiles = files.map(file => {
        if (isHeicFile(file.filename)) {
          const jpgFilename = convertHeicToJpg(file.path);
          if (jpgFilename !== file.filename) {
            // Update file object to use JPG filename
            const jpgPath = path.join(path.dirname(file.path), jpgFilename);
            // Delete original HEIC if JPG was created
            if (fs.existsSync(jpgPath)) {
              try {
                fs.unlinkSync(file.path);
              } catch (e) {
                // Ignore deletion errors
              }
            }
            return { ...file, filename: jpgFilename, path: jpgPath };
          }
        }
        return file;
      });
      
      const insertPromises = processedFiles.map((file, index) => {
        return new Promise((resolve, reject) => {
          const isPrimary = !hasPrimary && index === 0 ? 1 : 0;
          db.run(
            'INSERT INTO shoe_images (shoe_id, image_path, is_primary, display_order) VALUES (?, ?, ?, ?)',
            [id, file.filename, isPrimary, index],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });
      
      Promise.all(insertPromises)
        .then(() => {
          res.json({ message: `${files.length} image(s) uploaded successfully${files.some(f => isHeicFile(f.filename)) ? ' (HEIC files converted to JPG)' : ''}` });
        })
        .catch(err => {
          // Clean up uploaded files on error
          processedFiles.forEach(file => {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          });
          res.status(500).json({ error: err.message });
        });
    });
  });
});

// Set primary image
app.put('/api/shoes/:id/images/:imageId/primary', (req, res) => {
  const { id, imageId } = req.params;
  
  db.serialize(() => {
    db.run('UPDATE shoe_images SET is_primary = 0 WHERE shoe_id = ?', [id]);
    db.run('UPDATE shoe_images SET is_primary = 1 WHERE id = ? AND shoe_id = ?', [imageId, id], (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Primary image updated' });
    });
  });
});

// Delete image
app.delete('/api/shoes/:id/images/:imageId', (req, res) => {
  const { id, imageId } = req.params;
  
  db.get('SELECT image_path FROM shoe_images WHERE id = ? AND shoe_id = ?', [imageId, id], (err, image) => {
    if (err || !image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    db.run('DELETE FROM shoe_images WHERE id = ?', [imageId], (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Delete file
      const filePath = path.join(uploadsDir, image.image_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      res.json({ message: 'Image deleted successfully' });
    });
  });
});

// Cart routes
app.get('/api/cart/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  db.all(`
    SELECT c.*, s.brand, s.model, s.price, s.msrp,
           (SELECT image_path FROM shoe_images WHERE shoe_id = s.id AND is_primary = 1 LIMIT 1) as image
    FROM cart c
    JOIN shoes s ON c.shoe_id = s.id
    WHERE c.session_id = ?
    ORDER BY c.created_at DESC
  `, [sessionId], (err, items) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(items);
  });
});

app.post('/api/cart', (req, res) => {
  const { sessionId, shoeId, quantity = 1 } = req.body;
  
  if (!sessionId || !shoeId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Check if item already in cart
  db.get('SELECT * FROM cart WHERE session_id = ? AND shoe_id = ?', [sessionId, shoeId], (err, existing) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (existing) {
      db.run('UPDATE cart SET quantity = quantity + ? WHERE id = ?', [quantity, existing.id], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Cart updated' });
      });
    } else {
      db.run('INSERT INTO cart (session_id, shoe_id, quantity) VALUES (?, ?, ?)', 
        [sessionId, shoeId, quantity], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, message: 'Item added to cart' });
      });
    }
  });
});

app.delete('/api/cart/:sessionId/:itemId', (req, res) => {
  const { sessionId, itemId } = req.params;
  
  db.run('DELETE FROM cart WHERE id = ? AND session_id = ?', [itemId, sessionId], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Item removed from cart' });
  });
});

app.put('/api/cart/:itemId', (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;
  
  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }
  
  db.run('UPDATE cart SET quantity = ? WHERE id = ?', [quantity, itemId], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Cart updated' });
  });
});

// Bulk import shoes from SHOES folder
app.post('/api/shoes/import', (req, res) => {
  const { shoes, defaultMsrp, defaultPrice } = req.body;
  
  if (!shoes || !Array.isArray(shoes)) {
    return res.status(400).json({ error: 'Invalid shoes data' });
  }
  
  const shoesFolder = path.join(__dirname, 'SHOES');
  const uploadsFolder = path.join(__dirname, 'uploads');
  const results = [];
  const errors = [];
  let processed = 0;
  
  if (shoes.length === 0) {
    return res.json({
      success: true,
      imported: 0,
      errors: 0,
      results: [],
      errors: []
    });
  }
  
  shoes.forEach((shoeData, index) => {
    const msrp = shoeData.msrp || defaultMsrp || 100;
    const price = shoeData.price || defaultPrice || 80;
    
    // Insert shoe
    db.run(
      'INSERT INTO shoes (brand, model, description, msrp, price, size, gender, condition) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        shoeData.brand,
        shoeData.model,
        shoeData.description || '',
        msrp,
        price,
        shoeData.size || '9',
        shoeData.gender || 'Mens',
        shoeData.condition || 'Excellent'
      ],
      function(err) {
        if (err) {
          errors.push({ shoe: shoeData, error: err.message });
          processed++;
          if (processed === shoes.length) {
            res.json({
              success: true,
              imported: results.length,
              errors: errors.length,
              results,
              errors
            });
          }
          return;
        }
        
        const shoeId = this.lastID;
        const imagePromises = [];
        
        // Copy images from SHOES folder to uploads folder
        if (shoeData.images && Array.isArray(shoeData.images)) {
          shoeData.images.forEach((imgData, imgIndex) => {
            const filename = typeof imgData === 'string' 
              ? imgData 
              : imgData.filename;
            
            const sourcePath = typeof imgData === 'string' 
              ? path.join(shoesFolder, imgData)
              : (imgData.fullPath || path.join(shoesFolder, filename));
            
            if (fs.existsSync(sourcePath)) {
              const originalExt = path.extname(filename);
              const timestamp = Date.now();
              let destFilename = `shoe-${shoeId}-${timestamp}-${imgIndex}${originalExt}`;
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
                          console.log(`[Import] ✓ Deleted original HEIC: ${filename}`);
                        }
                      } catch (e) {
                        console.warn(`[Import] Could not delete HEIC: ${filename}`);
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
                const isPrimary = imgIndex === 0 ? 1 : 0;
                const imagePromise = new Promise((resolve, reject) => {
                  db.run(
                    'INSERT INTO shoe_images (shoe_id, image_path, is_primary, display_order) VALUES (?, ?, ?, ?)',
                    [shoeId, destFilename, isPrimary, imgIndex],
                    (err) => {
                      if (err) reject(err);
                      else resolve();
                    }
                  );
                });
                imagePromises.push(imagePromise);
              } catch (fileError) {
                console.error('Error copying/converting file:', fileError);
              }
            }
          });
        }
        
        // Wait for all images to be inserted
        Promise.all(imagePromises)
          .then(() => {
            // Mark images as processed
            const processedFile = path.join(__dirname, '.processed-images.json');
            let processedFiles = new Set();
            if (fs.existsSync(processedFile)) {
              try {
                const data = JSON.parse(fs.readFileSync(processedFile, 'utf8'));
                processedFiles = new Set(data.processed || []);
              } catch (error) {
                console.error('Error reading processed files:', error);
              }
            }
            
            // Add all imported images to processed set
            if (shoeData.images && Array.isArray(shoeData.images)) {
              shoeData.images.forEach(imgData => {
                const filename = typeof imgData === 'string' ? imgData : imgData.filename;
                processedFiles.add(filename);
              });
            }
            
            // Save processed files
            try {
              fs.writeFileSync(processedFile, JSON.stringify({
                processed: Array.from(processedFiles),
                lastUpdated: new Date().toISOString()
              }, null, 2));
            } catch (error) {
              console.error('Error saving processed files:', error);
            }
            
            results.push({ shoeId, brand: shoeData.brand, model: shoeData.model });
            processed++;
            if (processed === shoes.length) {
              res.json({
                success: true,
                imported: results.length,
                errors: errors.length,
                results,
                errors
              });
            }
          })
          .catch((imgErr) => {
            console.error('Error inserting images:', imgErr);
            results.push({ shoeId, brand: shoeData.brand, model: shoeData.model, warning: 'Some images failed to import' });
            processed++;
            if (processed === shoes.length) {
              res.json({
                success: true,
                imported: results.length,
                errors: errors.length,
                results,
                errors
              });
            }
          });
      }
    );
  });
});

// Auto-Import API endpoints
app.get('/api/auto-import/status', (req, res) => {
  res.json({ enabled: CONFIG.AUTO_IMPORT_ENABLED, config: CONFIG });
});

app.post('/api/auto-import/enable', (req, res) => {
  CONFIG.AUTO_IMPORT_ENABLED = true;
  res.json({ message: 'Auto-import enabled', config: CONFIG });
});

app.post('/api/auto-import/disable', (req, res) => {
  CONFIG.AUTO_IMPORT_ENABLED = false;
  res.json({ message: 'Auto-import disabled', config: CONFIG });
});

app.post('/api/auto-import/config', (req, res) => {
  Object.assign(CONFIG, req.body);
  res.json({ message: 'Configuration updated', config: CONFIG });
});

app.post('/api/auto-import/process-now', (req, res) => {
  processNewShoes(db).then(() => {
    res.json({ message: 'Processing complete' });
  }).catch(err => {
    res.status(500).json({ error: err.message });
  });
});

app.post('/api/auto-import/cleanup-duplicates', (req, res) => {
  cleanupDuplicates(db).then(result => {
    res.json({ message: `Cleaned up ${result.cleaned} duplicate(s)`, ...result });
  }).catch(err => {
    res.status(500).json({ error: err.message });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Shoe Store server running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
  console.log(`Import page: http://localhost:${PORT}/import.html`);
  
  // Ensure SHOES folder exists
  const shoesFolder = path.join(__dirname, 'SHOES');
  if (!fs.existsSync(shoesFolder)) {
    fs.mkdirSync(shoesFolder, { recursive: true });
    console.log(`Created SHOES folder at: ${shoesFolder}`);
    console.log(`Drop your shoe images in the SHOES folder and use the import page to analyze them!`);
  }

  // Start auto-import service
  initAutoImport(db);
});

