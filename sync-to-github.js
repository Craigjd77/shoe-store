#!/usr/bin/env node
/**
 * Sync script to update GitHub Pages with latest shoes data
 * Run this after adding new shoes via admin panel
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔄 Syncing shoes to GitHub Pages...\n');

// 1. Read the exported JSON
const jsonPath = path.join(__dirname, 'public', 'data', 'shoes.json');
if (!fs.existsSync(jsonPath)) {
    console.error('❌ Error: shoes.json not found. Please export from admin panel first.');
    process.exit(1);
}

const shoes = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
console.log(`📦 Found ${shoes.length} shoes in database`);

// 2. Collect all image filenames
const imageSet = new Set();
shoes.forEach(shoe => {
    if (shoe.images) {
        shoe.images.forEach(img => imageSet.add(img));
    }
    if (shoe.primary_image) {
        imageSet.add(shoe.primary_image);
    }
});

console.log(`🖼️  Found ${imageSet.size} unique images`);

// 3. Copy JSON to root
const rootDataDir = path.join(__dirname, 'data');
if (!fs.existsSync(rootDataDir)) {
    fs.mkdirSync(rootDataDir, { recursive: true });
}
fs.copyFileSync(jsonPath, path.join(rootDataDir, 'shoes.json'));
console.log('✓ Copied shoes.json to root/data/');

// 4. Copy images to root/images
const rootImagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(rootImagesDir)) {
    fs.mkdirSync(rootImagesDir, { recursive: true });
}

let copiedCount = 0;
let missingCount = 0;

imageSet.forEach(img => {
    const src = path.join(__dirname, 'public', 'uploads', img);
    const dest = path.join(rootImagesDir, img);
    
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        copiedCount++;
    } else {
        // Also check if it's in the main uploads folder
        const altSrc = path.join(__dirname, 'uploads', img);
        if (fs.existsSync(altSrc)) {
            fs.copyFileSync(altSrc, dest);
            copiedCount++;
        } else {
            console.warn(`⚠️  Warning: Image not found: ${img}`);
            missingCount++;
        }
    }
});

console.log(`✓ Copied ${copiedCount} images to root/images/`);
if (missingCount > 0) {
    console.log(`⚠️  ${missingCount} images were missing`);
}

// 5. Git add, commit, and push
try {
    console.log('\n📤 Pushing to GitHub...');
    
    // Add files
    execSync('git add data/ images/ index.html app.js styles.css', { 
        cwd: __dirname,
        stdio: 'inherit' 
    });
    
    // Commit
    execSync(`git commit -m "Update shoes: ${shoes.length} shoes, ${copiedCount} images"`, { 
        cwd: __dirname,
        stdio: 'inherit' 
    });
    
    // Push
    execSync('git push origin main', { 
        cwd: __dirname,
        stdio: 'inherit' 
    });
    
    console.log('\n✅ Successfully synced to GitHub Pages!');
    console.log('🌐 Your site will update in 1-2 minutes at:');
    console.log('   https://craigjd77.github.io/shoe-store/');
    
} catch (error) {
    console.error('\n❌ Error pushing to GitHub:', error.message);
    console.log('\n💡 You can manually push with:');
    console.log('   git add data/ images/ && git commit -m "Update shoes" && git push');
    process.exit(1);
}

