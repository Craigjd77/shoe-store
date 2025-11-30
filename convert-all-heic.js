const fs = require('fs');
const path = require('path');
const { convertHeicToJpg, isHeicFile } = require('./image-converter');

const SHOES_FOLDER = path.join(__dirname, 'SHOES');

if (!fs.existsSync(SHOES_FOLDER)) {
  console.log('SHOES folder does not exist');
  process.exit(0);
}

const files = fs.readdirSync(SHOES_FOLDER);
const heicFiles = files.filter(file => isHeicFile(file));

if (heicFiles.length === 0) {
  console.log('No HEIC files found in SHOES folder');
  process.exit(0);
}

console.log(`Found ${heicFiles.length} HEIC file(s) to convert...`);

let converted = 0;
let deleted = 0;
let errors = 0;

heicFiles.forEach(filename => {
  const filePath = path.join(SHOES_FOLDER, filename);
  
  try {
    console.log(`Converting: ${filename}...`);
    const jpgFilename = convertHeicToJpg(filePath);
    
    if (jpgFilename !== filename) {
      const jpgPath = path.join(SHOES_FOLDER, jpgFilename);
      
      if (fs.existsSync(jpgPath)) {
        converted++;
        console.log(`  ✓ Converted to: ${jpgFilename}`);
        
        // Delete original HEIC
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deleted++;
            console.log(`  ✓ Deleted original: ${filename}`);
          }
        } catch (delError) {
          console.error(`  ✗ Could not delete ${filename}:`, delError.message);
          errors++;
        }
      } else {
        console.error(`  ✗ JPG file not created: ${jpgFilename}`);
        errors++;
      }
    } else {
      console.warn(`  ⚠ Conversion failed or not needed: ${filename}`);
      errors++;
    }
  } catch (error) {
    console.error(`  ✗ Error processing ${filename}:`, error.message);
    errors++;
  }
});

console.log(`\n✓ Conversion complete!`);
console.log(`  Converted: ${converted}`);
console.log(`  Deleted: ${deleted}`);
console.log(`  Errors: ${errors}`);

