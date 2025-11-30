const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Check if file is HEIC/HEIF format
 */
function isHeicFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ext === '.heic' || ext === '.heif';
}

/**
 * Convert HEIC file to JPG using sips (macOS) or imagemagick
 * Returns the new JPG filename, or original filename if conversion not needed/failed
 */
function convertHeicToJpg(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  // Only convert HEIC files
  if (ext !== '.heic' && ext !== '.heif') {
    return path.basename(filePath);
  }

  const dir = path.dirname(filePath);
  // Remove extension case-insensitively
  const originalBasename = path.basename(filePath);
  const basename = originalBasename.replace(/\.(heic|heif)$/i, '');
  const jpgPath = path.join(dir, `${basename}.jpg`);

  try {
    // Try sips first (macOS built-in)
    if (process.platform === 'darwin') {
      try {
        execSync(`sips -s format jpeg "${filePath}" --out "${jpgPath}"`, {
          stdio: 'ignore',
          timeout: 10000
        });
        
        // Verify JPG was created
        if (fs.existsSync(jpgPath)) {
          console.log(`[Converter] Converted HEIC to JPG: ${path.basename(filePath)} -> ${path.basename(jpgPath)}`);
          return path.basename(jpgPath);
        }
      } catch (sipsError) {
        // sips failed, try imagemagick
      }
    }

    // Try imagemagick (cross-platform)
    try {
      execSync(`convert "${filePath}" "${jpgPath}"`, {
        stdio: 'ignore',
        timeout: 10000
      });
      
      if (fs.existsSync(jpgPath)) {
        console.log(`[Converter] Converted HEIC to JPG: ${path.basename(filePath)} -> ${path.basename(jpgPath)}`);
        return path.basename(jpgPath);
      }
    } catch (imError) {
      console.warn(`[Converter] Could not convert HEIC file: ${path.basename(filePath)}`);
      console.warn(`[Converter] Install imagemagick or use macOS sips for automatic conversion`);
    }

    // Conversion failed, return original
    return path.basename(filePath);
  } catch (error) {
    console.error(`[Converter] Error converting ${path.basename(filePath)}:`, error.message);
    return path.basename(filePath);
  }
}

/**
 * Convert HEIC file and optionally delete original
 */
function convertAndReplace(filePath, deleteOriginal = false) {
  const originalBasename = path.basename(filePath);
  const newBasename = convertHeicToJpg(filePath);
  
  if (newBasename !== originalBasename && deleteOriginal) {
    try {
      fs.unlinkSync(filePath);
      console.log(`[Converter] Deleted original HEIC: ${originalBasename}`);
    } catch (error) {
      console.warn(`[Converter] Could not delete original: ${originalBasename}`);
    }
  }
  
  return newBasename;
}

module.exports = {
  isHeicFile,
  convertHeicToJpg,
  convertAndReplace
};

