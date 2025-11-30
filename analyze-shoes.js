const fs = require('fs');
const path = require('path');
const { identifyShoeAI } = require('./ai-identifier');

// Common brands
const BRANDS = [
  'Nike', 'New Balance', 'adidas', 'On', 'On Cloud', 'Olukai', 'Asics',
  'LOWE', 'Puma', 'Vans', 'Converse', 'Hoka', 'Brooks', 'Saucony', 'Jordan'
];

// Common models/keywords
const MODELS = [
  'Dunk', 'Dunk Low', 'Dunk High', 'Air Force', 'Air Max',
  '990', '991', '992', '993', '574', '550', '327',
  'Ultraboost', 'Stan Smith', 'Superstar', 'Yeezy',
  'Chuck Taylor', 'Old Skool', 'Authentic', 'Sk8-Hi',
  'Cloud', 'Cloudrunner', 'Cloudflow', 'Cloudswift', 'Cloudventure'
];

/**
 * Parse filename to extract brand, model, and other info
 */
function parseFilename(filename) {
  const nameWithoutExt = path.basename(filename, path.extname(filename));
  const parts = nameWithoutExt.split(/[-_\s]+/);
  
  let brand = null;
  let model = null;
  let description = null;
  
  // Try to find brand (usually at the start)
  for (let i = 0; i < Math.min(parts.length, 3); i++) {
    const testBrand = parts.slice(0, i + 1).join(' ');
    if (BRANDS.some(b => testBrand.toLowerCase().includes(b.toLowerCase()) || 
                        b.toLowerCase().includes(testBrand.toLowerCase()))) {
      brand = BRANDS.find(b => 
        testBrand.toLowerCase().includes(b.toLowerCase()) || 
        b.toLowerCase().includes(testBrand.toLowerCase())
      );
      break;
    }
  }
  
  // If no brand found, check if any part matches
  if (!brand) {
    for (const part of parts) {
      const found = BRANDS.find(b => 
        part.toLowerCase() === b.toLowerCase() ||
        part.toLowerCase().includes(b.toLowerCase())
      );
      if (found) {
        brand = found;
        break;
      }
    }
  }
  
  // Try to find model
  for (const modelKeyword of MODELS) {
    const nameLower = nameWithoutExt.toLowerCase();
    if (nameLower.includes(modelKeyword.toLowerCase())) {
      model = modelKeyword;
      break;
    }
  }
  
  // If no model found, use parts after brand as model
  if (!model && brand) {
    const brandIndex = parts.findIndex(p => 
      p.toLowerCase().includes(brand.toLowerCase())
    );
    if (brandIndex >= 0 && brandIndex < parts.length - 1) {
      model = parts.slice(brandIndex + 1, brandIndex + 3).join(' ');
    }
  }
  
  // Use remaining parts as description
  if (brand || model) {
    const usedParts = [];
    if (brand) {
      const brandWords = brand.split(' ');
      usedParts.push(...brandWords);
    }
    if (model) {
      const modelWords = model.split(' ');
      usedParts.push(...modelWords);
    }
    
    const remaining = parts.filter(p => 
      !usedParts.some(up => p.toLowerCase() === up.toLowerCase())
    );
    if (remaining.length > 0) {
      description = remaining.join(' ');
    }
  }
  
  // Default values
  if (!brand) {
    brand = 'Unknown Brand';
  }
  if (!model) {
    model = parts.slice(0, 2).join(' ') || 'Unknown Model';
  }
  
  return {
    brand: brand,
    model: model,
    description: description || nameWithoutExt,
    filename: filename
  };
}

/**
 * Analyze all images in SHOES folder
 */
async function analyzeShoesFolder(shoesFolderPath) {
  if (!fs.existsSync(shoesFolderPath)) {
    console.log(`Creating SHOES folder at: ${shoesFolderPath}`);
    fs.mkdirSync(shoesFolderPath, { recursive: true });
    return [];
  }
  
  const files = fs.readdirSync(shoesFolderPath);
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return imageExtensions.includes(ext);
  });
  
  // Group images by potential shoe (same base name)
  // Strategy: Remove common suffixes like -1, -2, _front, _side, etc.
  const shoeGroups = {};
  
  imageFiles.forEach(file => {
    const parsed = parseFilename(file);
    
    // Create a grouping key by removing common image suffixes
    let baseName = path.basename(file, path.extname(file))
      .toLowerCase()
      .replace(/[-_\s]+/g, '-');
    
    // Special handling for IMG_#### pattern (iPhone photos)
    // Group IMG_9742, IMG_9743, IMG_9744 together if they're sequential
    let groupKey = baseName;
    
    // Check if it's an IMG_#### pattern
    const imgMatch = baseName.match(/^img[-_]?(\d+)$/i);
    if (imgMatch) {
      // For IMG files, use smarter grouping - group sequential images together
      // Round to nearest 10 for more aggressive grouping (handles 3-8 images per shoe)
      // This groups IMG_9750-9759 together, IMG_9760-9769 together, etc.
      const imgNum = parseInt(imgMatch[1]);
      const groupNum = Math.floor(imgNum / 10) * 10;
      groupKey = `img-${groupNum}`;
    } else {
      // Remove common image suffixes
      baseName = baseName
        .replace(/[-_](front|back|side|top|bottom|left|right|1|2|3|4|5|a|b|c|d|e)$/i, '')
        .replace(/[-_]img\d*$/i, '')
        .replace(/[-_]photo\d*$/i, '')
        .replace(/[-_]image\d*$/i, '')
        .replace(/\d+$/i, ''); // Remove trailing numbers
      
      // Use first 40 chars as grouping key
      groupKey = baseName.substring(0, 40);
    }
    
    if (!shoeGroups[groupKey]) {
      shoeGroups[groupKey] = {
        brand: parsed.brand,
        model: parsed.model,
        description: parsed.description,
        images: []
      };
    }
    
    shoeGroups[groupKey].images.push({
      filename: file,
      fullPath: path.join(shoesFolderPath, file)
    });
  });
  
  // Convert to array and enhance with AI identification (async)
  const shoes = [];
  for (let index = 0; index < Object.values(shoeGroups).length; index++) {
    const shoe = Object.values(shoeGroups)[index];
    
    // Use AI to identify brand, model, color, and estimate prices
    const aiIdentified = await identifyShoeAI({
      brand: shoe.brand,
      model: shoe.model,
      description: shoe.description,
      images: shoe.images
    });
    
    shoes.push({
      id: `temp-${index}`,
      brand: aiIdentified.brand,
      model: aiIdentified.model,
      color: aiIdentified.color,
      description: aiIdentified.description,
      msrp: aiIdentified.msrp,
      price: aiIdentified.price,
      size: aiIdentified.size,
      gender: aiIdentified.gender,
      condition: aiIdentified.condition,
      images: shoe.images,
      imageCount: shoe.images.length,
      confidence: aiIdentified.confidence,
      autoIdentified: aiIdentified.autoIdentified,
      needsReview: aiIdentified.needsReview
    });
  }
  
  return shoes;
}

/**
 * Main function
 */
async function main() {
  const shoesFolder = path.join(__dirname, 'SHOES');
  const shoes = await analyzeShoesFolder(shoesFolder);
  
  console.log(`\nFound ${shoes.length} potential shoes with ${shoes.reduce((sum, s) => sum + s.imageCount, 0)} total images\n`);
  
  shoes.forEach((shoe, index) => {
    console.log(`${index + 1}. ${shoe.brand} ${shoe.model}`);
    console.log(`   Description: ${shoe.description}`);
    console.log(`   Images: ${shoe.imageCount}`);
    console.log(`   Files: ${shoe.images.map(img => img.filename).join(', ')}\n`);
  });
  
  // Export as JSON for API
  const outputPath = path.join(__dirname, 'analyzed-shoes.json');
  fs.writeFileSync(outputPath, JSON.stringify(shoes, null, 2));
  console.log(`\nAnalysis saved to: ${outputPath}`);
  console.log(`\nNext steps:`);
  console.log(`1. Review the analyzed-shoes.json file`);
  console.log(`2. Use the admin panel import feature to add these to the database`);
  console.log(`3. Or use the API endpoint: POST /api/shoes/import`);
  
  return shoes;
}

if (require.main === module) {
  main();
}

module.exports = { analyzeShoesFolder, parseFilename };

