const API_BASE = 'http://localhost:3000/api';

let allImages = [];
let imageShoeMap = {}; // Map of filename to shoe info
const cartCount = document.querySelector('.cart-count');
const imagesGrid = document.getElementById('imagesGrid');
const loading = document.getElementById('loading');
const refreshBtn = document.getElementById('refreshBtn');
const autoImportToggle = document.getElementById('autoImportToggle');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    loadImages();
    
    // Refresh every 10 seconds
    setInterval(loadImages, 10000);
});

// Check if file is HEIC
function isHeicFile(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    return ext === 'heic' || ext === 'heif';
}

// Load images
async function loadImages() {
    try {
        loading.style.display = 'block';
        imagesGrid.style.display = 'none';
        
        const response = await fetch(`${API_BASE}/shoes/import-status`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to load images: ${response.status} ${errorText}`);
        }
        
        const status = await response.json();
        allImages = [...status.newImages, ...status.processedImages];
        
        // Load shoe information for each image (don't fail if this errors)
        try {
            await loadShoeInfo();
        } catch (error) {
            console.warn('Could not load shoe info, continuing anyway:', error);
        }
        
        displayImages();
        
        loading.style.display = 'none';
        imagesGrid.style.display = 'grid';
    } catch (error) {
        console.error('Error loading images:', error);
        loading.innerHTML = `<p style="color: red;">Error loading images: ${error.message}</p>`;
        imagesGrid.style.display = 'grid';
        imagesGrid.innerHTML = '<p style="color: red; padding: 2rem; text-align: center;">Failed to load images. Please check the server is running and try refreshing.</p>';
    }
}

// Load which images are tied to shoes
async function loadShoeInfo() {
    // Get all shoes with their images
    try {
        const response = await fetch(`${API_BASE}/shoes`);
        const shoes = await response.json();
        
        // Build a map - this is approximate since we don't track exact mapping
        // Mark processed images as potentially tied to shoes
        imageShoeMap = {};
        allImages.forEach(img => {
            if (img.isProcessed) {
                imageShoeMap[img.filename] = { tied: true, note: 'Imported' };
            }
        });
    } catch (error) {
        console.error('Error loading shoe info:', error);
    }
}

// Display images
function displayImages() {
    if (allImages.length === 0) {
        imagesGrid.innerHTML = '<p>No images found in SHOES folder</p>';
        return;
    }
    
    imagesGrid.innerHTML = allImages.map(img => {
        const sizeKB = (img.size / 1024).toFixed(1);
        const isProcessed = img.isProcessed;
        const isHeic = isHeicFile(img.filename);
        const shoeInfo = imageShoeMap[img.filename];
        const tiedToShoe = shoeInfo && shoeInfo.tied;
        
        // Use preview endpoint for HEIC files, direct path for others
        let imageUrl = isHeic ? `/api/images/preview/${encodeURIComponent(img.filename)}` : `/SHOES/${encodeURIComponent(img.filename)}`;
        
        // Always show actual image (preview endpoint handles HEIC conversion)
        const imageDisplay = `<img src="${imageUrl}" alt="${img.filename}" 
                     style="width: 100%; height: 200px; object-fit: cover;"
                     onerror="this.onerror=null; this.src='https://via.placeholder.com/200/667eea/ffffff?text=Loading...'; this.style.background='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'; this.style.display='flex'; this.style.alignItems='center'; this.style.justifyContent='center'; this.innerHTML='<div style=\\'text-align: center; color: white;\\'><i class=\\'fas fa-spinner fa-spin\\' style=\\'font-size: 2rem;\\'></i><div style=\\'margin-top: 0.5rem;\\'>Converting HEIC...</div></div>';" 
                     loading="lazy">`;
        
        return `
            <div class="image-card" data-filename="${img.filename}">
                <div class="image-status ${isProcessed ? 'status-processed' : 'status-new'}">
                    ${isProcessed ? '✓ Imported' : 'NEW'}
                </div>
                ${tiedToShoe ? `
                    <div class="image-status status-tied" style="top: 40px; background: #2196f3;">
                        <i class="fas fa-link"></i> Tied to Shoe
                    </div>
                ` : ''}
                ${imageDisplay}
                <div class="image-info">
                    <div class="image-filename">${img.filename}</div>
                    <div class="image-meta">
                        ${sizeKB} KB<br>
                        ${new Date(img.modified).toLocaleDateString()}
                    </div>
                    <div class="image-actions" style="margin-top: 0.75rem;">
                        ${!isProcessed ? `
                            <div style="background: #fff3cd; padding: 0.75rem; border-radius: 4px; text-align: center; color: #856404; font-size: 0.85rem; margin-bottom: 0.5rem;">
                                <i class="fas fa-clock"></i> Waiting for Auto-Publish
                            </div>
                            <button class="btn btn-primary" onclick="createShoeFromImage('${img.filename}')" 
                                    style="width: 100%; padding: 0.75rem; font-size: 0.9rem; font-weight: 600;">
                                <i class="fas fa-bolt"></i> Publish Now (Manual)
                            </button>
                            <p style="text-align: center; font-size: 0.7rem; color: #999; margin-top: 0.5rem;">
                                Or wait ~10 seconds for auto-publish
                            </p>
                        ` : `
                            <div style="background: #e8f5e9; padding: 0.75rem; border-radius: 4px; text-align: center; color: #2e7d32; font-size: 0.85rem;">
                                <i class="fas fa-check-circle"></i> Published & Live
                            </div>
                            <button class="btn" onclick="window.location.href='index.html'" 
                                    style="width: 100%; margin-top: 0.5rem; padding: 0.5rem; font-size: 0.85rem; background: #2196f3; color: white;">
                                <i class="fas fa-shopping-bag"></i> View in Store
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Create shoe from image - SIMPLIFIED
async function createShoeFromImage(filename) {
    // Simple modal with just the essentials
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h2 style="margin: 0;">Create Shoe</h2>
                <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666;">&times;</button>
            </div>
            <p style="color: #666; margin-bottom: 1.5rem; font-size: 0.9rem;">Fill in the details below and this image will be added to your store.</p>
            <form id="createShoeForm">
                <input type="hidden" name="imageFilename" value="${filename}">
                <div class="form-group">
                    <label>Brand * <span style="color: #999; font-weight: normal;">(e.g., Nike, New Balance)</span></label>
                    <input type="text" name="brand" required placeholder="Nike" autofocus>
                </div>
                <div class="form-group">
                    <label>Model * <span style="color: #999; font-weight: normal;">(e.g., Dunk Low, 990)</span></label>
                    <input type="text" name="model" required placeholder="Dunk Low">
                </div>
                <div class="form-group">
                    <label>Color <span style="color: #999; font-weight: normal;">(optional)</span></label>
                    <input type="text" name="color" placeholder="White">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label>Price * <span style="color: #999; font-weight: normal;">($)</span></label>
                        <input type="number" name="price" required step="0.01" placeholder="100.00">
                    </div>
                    <div class="form-group">
                        <label>Original Price <span style="color: #999; font-weight: normal;">($)</span></label>
                        <input type="number" name="msrp" step="0.01" placeholder="120.00">
                    </div>
                </div>
                <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
                    <button type="submit" class="btn btn-primary" style="flex: 1; padding: 1rem; font-size: 1.1rem;">
                        <i class="fas fa-check"></i> Create & Publish
                    </button>
                    <button type="button" class="btn" onclick="this.closest('.modal').remove()" style="flex: 1;">Cancel</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Handle form submission
    document.getElementById('createShoeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        // Show loading
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        
        try {
            // Use the import endpoint which handles everything
            const importResponse = await fetch(`${API_BASE}/shoes/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shoes: [{
                        brand: data.brand.trim(),
                        model: data.model.trim(),
                        description: data.color ? `${data.color} ${data.brand} ${data.model}` : `${data.brand} ${data.model}`,
                        msrp: parseFloat(data.msrp) || parseFloat(data.price) * 1.2, // Default to 20% markup if not provided
                        price: parseFloat(data.price),
                        size: '9',
                        gender: 'Mens',
                        condition: 'Excellent',
                        images: [{ filename: data.imageFilename }]
                    }]
                })
            });
            
            if (importResponse.ok) {
                const importResult = await importResponse.json();
                if (importResult.success) {
                    modal.remove();
                    alert('✓ Shoe created and published! Check the Shop page to see it.');
                    loadImages();
                } else {
                    throw new Error(importResult.errors?.[0]?.error || 'Failed to create shoe');
                }
            } else {
                const errorData = await importResponse.json();
                throw new Error(errorData.error || 'Failed to create shoe');
            }
        } catch (error) {
            alert('Error: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            console.error(error);
        }
    });
}

// View shoe (if image is tied to one)
async function viewShoe(filename) {
    // Try to find the shoe
    try {
        const shoesResponse = await fetch(`${API_BASE}/shoes`);
        const shoes = await shoesResponse.json();
        
        // Find shoe that might use this image (approximate)
        // In a real implementation, we'd have better tracking
        alert('Image is imported. Check the Shop page to find the shoe.');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error viewing shoe:', error);
    }
}

// Edit image
function editImage(filename) {
    // Open edit modal
    const image = allImages.find(img => img.filename === filename);
    if (!image) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h2>Edit Image: ${filename}</h2>
                <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>File:</strong> ${filename}<br>
                <strong>Size:</strong> ${(image.size / 1024).toFixed(1)} KB<br>
                <strong>Modified:</strong> ${new Date(image.modified).toLocaleString()}<br>
                <strong>Status:</strong> ${image.isProcessed ? 'Imported' : 'New'}
            </div>
            <div style="margin-top: 1.5rem;">
                <button class="btn btn-primary" onclick="convertHeicImage('${filename}')" 
                        ${!isHeicFile(filename) ? 'style="display: none;"' : ''}>
                    <i class="fas fa-sync"></i> Convert HEIC to JPG
                </button>
                <button class="btn" onclick="this.closest('.modal').remove()" style="margin-left: 0.5rem;">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Convert HEIC image
async function convertHeicImage(filename) {
    try {
        // This would trigger a conversion on the server
        alert('HEIC conversion will happen automatically when the image is imported.');
    } catch (error) {
        alert('Error converting image: ' + error.message);
    }
}

// Make functions available globally
window.createShoeFromImage = createShoeFromImage;
window.viewShoe = viewShoe;
window.editImage = editImage;
window.convertHeicImage = convertHeicImage;

// Refresh button
refreshBtn.addEventListener('click', () => {
    loadImages();
});

// Auto-import toggle
autoImportToggle.addEventListener('click', async () => {
    const isEnabled = autoImportToggle.textContent.includes('ON');
    
    try {
        const endpoint = isEnabled ? 'disable' : 'enable';
        const response = await fetch(`${API_BASE}/auto-import/${endpoint}`, {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            autoImportToggle.innerHTML = `<i class="fas fa-toggle-${result.config.AUTO_IMPORT_ENABLED ? 'on' : 'off'}"></i> Auto-Publish: ${result.config.AUTO_IMPORT_ENABLED ? 'ON' : 'OFF'}`;
            autoImportToggle.style.background = result.config.AUTO_IMPORT_ENABLED ? '#4caf50' : '#666';
        }
    } catch (error) {
        console.error('Error toggling auto-import:', error);
    }
});

// Check auto-import status on load
async function checkAutoImportStatus() {
    try {
        const response = await fetch(`${API_BASE}/auto-import/status`);
        if (response.ok) {
            const config = await response.json();
            autoImportToggle.innerHTML = `<i class="fas fa-toggle-${config.AUTO_IMPORT_ENABLED ? 'on' : 'off'}"></i> Auto-Publish: ${config.AUTO_IMPORT_ENABLED ? 'ON' : 'OFF'}`;
            autoImportToggle.style.background = config.AUTO_IMPORT_ENABLED ? '#4caf50' : '#666';
        }
    } catch (error) {
        console.error('Error checking auto-import status:', error);
    }
}

// Initialize auto-import status
checkAutoImportStatus();

// Update cart count
async function updateCartCount() {
    try {
        const sessionId = localStorage.getItem('sessionId');
        if (!sessionId) return;
        
        const response = await fetch(`${API_BASE}/cart/${sessionId}`);
        const items = await response.json();
        const count = items.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = count;
    } catch (error) {
        console.error('Error updating cart count:', error);
    }
}
