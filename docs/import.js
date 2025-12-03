const API_BASE = 'http://localhost:3000/api';

let analyzedShoes = [];
let selectedShoes = new Set();

// DOM Elements
const quickImportBtn = document.getElementById('quickImportBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const selectAllBtn = document.getElementById('selectAllBtn');
const deselectAllBtn = document.getElementById('deselectAllBtn');
const importBtn = document.getElementById('importBtn');
const checkStatusBtn = document.getElementById('checkStatusBtn');
const statusInfo = document.getElementById('statusInfo');
const statusContent = document.getElementById('statusContent');
const previewContainer = document.getElementById('previewContainer');
const previewGrid = document.getElementById('previewGrid');
const emptyState = document.getElementById('emptyState');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const totalCount = document.getElementById('totalCount');
const selectedCount = document.getElementById('selectedCount');
const totalImages = document.getElementById('totalImages');
const defaultMsrp = document.getElementById('defaultMsrp');
const defaultPrice = document.getElementById('defaultPrice');
const cartCount = document.querySelector('.cart-count');
const quickStatusContent = document.getElementById('quickStatusContent');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    updateQuickStatus(); // Show quick status on load
});

// Quick Import - Simple one-click import
quickImportBtn.addEventListener('click', async () => {
    if (!confirm('Import all new images from SHOES folder? Images will be automatically grouped and imported.')) {
        return;
    }
    
    showLoading('Importing all new images...');
    
    try {
        // Step 1: Analyze
        const analyzeResponse = await fetch(`${API_BASE}/shoes/analyze`);
        if (!analyzeResponse.ok) {
            throw new Error('Failed to analyze images');
        }
        
        const newShoes = await analyzeResponse.json();
        
        if (newShoes.length === 0) {
            hideLoading();
            alert('No new images to import! All images in SHOES folder have already been imported.');
            updateQuickStatus();
            return;
        }
        
        // Step 2: Import with AI-detected values (already filled in by analyze endpoint)
        const importData = newShoes.map(shoe => ({
            brand: shoe.brand || 'Unknown Brand',
            model: shoe.model || 'Unknown Model',
            description: shoe.description || `${shoe.brand} ${shoe.model}${shoe.color ? ' - ' + shoe.color : ''} - Size 9 Mens`,
            msrp: shoe.msrp || 120,
            price: shoe.price || 100,
            size: shoe.size || '9',
            gender: shoe.gender || 'Mens',
            condition: shoe.condition || 'Excellent',
            images: shoe.images.map(img => ({
                filename: typeof img === 'string' ? img : img.filename,
                fullPath: typeof img === 'string' ? null : img.fullPath
            }))
        }));
        
        const importResponse = await fetch(`${API_BASE}/shoes/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                shoes: importData,
                defaultMsrp: 120,
                defaultPrice: 100
            })
        });
        
        if (!importResponse.ok) {
            throw new Error('Import failed');
        }
        
        const result = await importResponse.json();
        hideLoading();
        
        if (result.errors && result.errors.length > 0) {
            alert(`Imported ${result.imported} shoe(s)! ${result.errors.length} errors occurred.`);
        } else {
            alert(`Successfully imported ${result.imported} shoe(s)!`);
        }
        
        // Refresh status
        updateQuickStatus();
        
        // Show success message
        quickImportBtn.innerHTML = '<i class="fas fa-check"></i> Import Complete!';
        quickImportBtn.style.background = '#4caf50';
        setTimeout(() => {
            quickImportBtn.innerHTML = '<i class="fas fa-magic"></i> Quick Import All New Images';
            quickImportBtn.style.background = '';
        }, 3000);
        
    } catch (error) {
        console.error('Error during quick import:', error);
        alert('Error importing: ' + error.message);
        hideLoading();
    }
});

// Update quick status display
async function updateQuickStatus() {
    try {
        const response = await fetch(`${API_BASE}/shoes/import-status`);
        if (!response.ok) return;
        
        const status = await response.json();
        
        if (quickStatusContent) {
            quickStatusContent.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: 700; color: #2196f3;">${status.total || 0}</div>
                    <div style="color: #666; font-size: 0.875rem;">Total Images</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: 700; color: #ff9800;">${status.new || 0}</div>
                    <div style="color: #666; font-size: 0.875rem;">New to Import</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: 700; color: #4caf50;">${status.processed || 0}</div>
                    <div style="color: #666; font-size: 0.875rem;">Already Imported</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: 700; color: #9c27b0;">${status.shoesInDatabase || 0}</div>
                    <div style="color: #666; font-size: 0.875rem;">Shoes in Store</div>
                </div>
            `;
        }
        
        // Update auto-import status
        const autoStatusEl = document.getElementById('autoImportStatus');
        if (autoStatusEl) {
            try {
                const configResponse = await fetch(`${API_BASE}/auto-import/status`);
                if (configResponse.ok) {
                    const config = await configResponse.json();
                    if (config.AUTO_IMPORT_ENABLED) {
                        autoStatusEl.style.display = 'block';
                        autoStatusEl.innerHTML = `
                            <strong><i class="fas fa-check-circle"></i> Auto-Import is ACTIVE</strong>
                            <p style="margin-top: 0.5rem; font-size: 0.9rem;">
                                New images are automatically detected and imported every ${config.CHECK_INTERVAL / 1000} seconds.
                                ${status.new > 0 ? `<br><strong>${status.new} new image(s) will be imported automatically!</strong>` : 'No new images to import.'}
                            </p>
                        `;
                    } else {
                        autoStatusEl.style.display = 'none';
                    }
                }
            } catch (e) {
                // Ignore
            }
        }
        
        // Update quick import button state
        if (quickImportBtn) {
            if (status.new === 0) {
                quickImportBtn.disabled = true;
                quickImportBtn.style.opacity = '0.5';
                quickImportBtn.innerHTML = '<i class="fas fa-check-circle"></i> All Images Already Imported';
            } else {
                quickImportBtn.disabled = false;
                quickImportBtn.style.opacity = '1';
                quickImportBtn.innerHTML = `<i class="fas fa-magic"></i> Import ${status.new} New Image(s) Now`;
            }
        }
    } catch (error) {
        console.error('Error updating quick status:', error);
    }
}

// Check import status
async function checkImportStatus() {
    try {
        const response = await fetch(`${API_BASE}/shoes/import-status`);
        if (!response.ok) {
            throw new Error('Failed to get import status');
        }
        
        const status = await response.json();
        displayImportStatus(status);
    } catch (error) {
        console.error('Error checking import status:', error);
    }
}

// Display import status
function displayImportStatus(status) {
    statusInfo.style.display = 'block';
    
    const newCount = status.new || 0;
    const processedCount = status.processed || 0;
    const totalCount = status.total || 0;
    
    let html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background: #e3f2fd; padding: 1rem; border-radius: 8px; border-left: 4px solid #2196f3;">
                <div style="font-size: 2rem; font-weight: 700; color: #1976d2;">${totalCount}</div>
                <div style="color: #666; font-size: 0.875rem;">Total Images</div>
            </div>
            <div style="background: #fff3e0; padding: 1rem; border-radius: 8px; border-left: 4px solid #ff9800;">
                <div style="font-size: 2rem; font-weight: 700; color: #f57c00;">${newCount}</div>
                <div style="color: #666; font-size: 0.875rem;">New (Not Imported)</div>
            </div>
            <div style="background: #e8f5e9; padding: 1rem; border-radius: 8px; border-left: 4px solid #4caf50;">
                <div style="font-size: 2rem; font-weight: 700; color: #388e3c;">${processedCount}</div>
                <div style="color: #666; font-size: 0.875rem;">Already Imported</div>
            </div>
            <div style="background: #f3e5f5; padding: 1rem; border-radius: 8px; border-left: 4px solid #9c27b0;">
                <div style="font-size: 2rem; font-weight: 700; color: #7b1fa2;">${status.shoesInDatabase || 0}</div>
                <div style="color: #666; font-size: 0.875rem;">Shoes in Database</div>
            </div>
        </div>
    `;
    
    if (newCount > 0) {
        html += `
            <div style="margin-top: 1.5rem;">
                <h4 style="margin-bottom: 0.75rem; color: #f57c00;">
                    <i class="fas fa-exclamation-circle"></i> New Images (Not Yet Imported):
                </h4>
                <div style="background: #fff3e0; padding: 1rem; border-radius: 8px; max-height: 200px; overflow-y: auto;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.5rem;">
        `;
        
        status.newImages.forEach(img => {
            const sizeKB = (img.size / 1024).toFixed(1);
            html += `
                <div style="background: white; padding: 0.5rem; border-radius: 4px; font-size: 0.75rem;">
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">${img.filename}</div>
                    <div style="color: #666;">${sizeKB} KB</div>
                </div>
            `;
        });
        
        html += `
                    </div>
                </div>
            </div>
        `;
    }
    
    if (processedCount > 0) {
        html += `
            <div style="margin-top: 1.5rem;">
                <h4 style="margin-bottom: 0.75rem; color: #388e3c;">
                    <i class="fas fa-check-circle"></i> Already Imported:
                </h4>
                <div style="background: #e8f5e9; padding: 1rem; border-radius: 8px; max-height: 200px; overflow-y: auto;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.5rem;">
        `;
        
        status.processedImages.slice(0, 20).forEach(img => {
            const sizeKB = (img.size / 1024).toFixed(1);
            html += `
                <div style="background: white; padding: 0.5rem; border-radius: 4px; font-size: 0.75rem; opacity: 0.8;">
                    <div style="font-weight: 600; margin-bottom: 0.25rem; text-decoration: line-through; color: #666;">${img.filename}</div>
                    <div style="color: #666;">${sizeKB} KB</div>
                </div>
            `;
        });
        
        if (status.processedImages.length > 20) {
            html += `<div style="grid-column: 1 / -1; text-align: center; color: #666; padding: 0.5rem;">... and ${status.processedImages.length - 20} more</div>`;
        }
        
        html += `
                    </div>
                </div>
            </div>
        `;
    }
    
    if (newCount === 0 && processedCount === 0) {
        html += `
            <div style="text-align: center; padding: 2rem; color: #666;">
                <i class="fas fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                <p>No images found in SHOES folder</p>
            </div>
        `;
    }
    
    statusContent.innerHTML = html;
}

// Make checkImportStatus available globally
window.checkImportStatus = checkImportStatus;

// Check status button
checkStatusBtn.addEventListener('click', () => {
    checkImportStatus();
});

// Analyze images
analyzeBtn.addEventListener('click', async () => {
    showLoading('Analyzing images in SHOES folder...');
    
    try {
        const response = await fetch(`${API_BASE}/shoes/analyze`);
        if (!response.ok) {
            throw new Error('Failed to analyze images');
        }
        
        analyzedShoes = await response.json();
        
        if (analyzedShoes.length === 0) {
            alert('No NEW images found in SHOES folder. All images have already been imported. Add new images to import them!');
            hideLoading();
            // Refresh status to show current state
            checkImportStatus();
            return;
        }
        
        displayPreview();
        hideLoading();
        
        // Refresh status after analysis
        setTimeout(() => {
            checkImportStatus();
        }, 500);
    } catch (error) {
        console.error('Error analyzing images:', error);
        alert('Error analyzing images: ' + error.message);
        hideLoading();
    }
});

// Display preview
function displayPreview() {
    emptyState.style.display = 'none';
    previewContainer.style.display = 'block';
    selectAllBtn.style.display = 'inline-flex';
    deselectAllBtn.style.display = 'inline-flex';
    importBtn.style.display = 'inline-flex';
    
    // Reset selection
    selectedShoes.clear();
    
    previewGrid.innerHTML = analyzedShoes.map((shoe, index) => {
    const imagePreviews = shoe.images.map(img => {
        const filename = typeof img === 'string' ? img : img.filename;
        const isHeic = filename.toLowerCase().endsWith('.heic') || filename.toLowerCase().endsWith('.heif');
        // HEIC files may not display in browsers, show placeholder with filename
        if (isHeic) {
            return `<div class="preview-thumb" style="display: flex; align-items: center; justify-content: center; background: #f0f0f0; color: #666; font-size: 0.7rem; text-align: center; padding: 0.25rem;">
                         HEIC<br/>${filename.substring(0, 8)}...
                     </div>`;
        }
        return `<img src="/SHOES/${filename}" class="preview-thumb" 
                         onerror="this.src='https://via.placeholder.com/60?text=Image'" 
                         alt="${filename}">`;
    }).join('');
        
        return `
            <div class="preview-card" data-index="${index}">
                <div class="checkbox-wrapper">
                    <input type="checkbox" id="shoe-${index}" 
                           onchange="toggleShoe(${index})" checked>
                    <label for="shoe-${index}" style="margin: 0; font-weight: 600;">
                        ${shoe.brand} ${shoe.model}${shoe.color ? ' - ' + shoe.color : ''}
                        ${shoe.autoIdentified ? ' <span style="color: #4caf50; font-size: 0.75rem;">(AI)</span>' : ''}
                    </label>
                </div>
                
                <div class="preview-images">
                    ${imagePreviews}
                </div>
                
                <div class="preview-info">
                    ${shoe.autoIdentified ? `<div style="background: #e8f5e9; padding: 0.5rem; border-radius: 4px; margin-bottom: 0.5rem; font-size: 0.75rem; color: #2e7d32;">
                        <i class="fas fa-check-circle"></i> AI Identified (${shoe.confidence || 0}% confidence)
                    </div>` : ''}
                    ${shoe.needsReview ? `<div style="background: #fff3e0; padding: 0.5rem; border-radius: 4px; margin-bottom: 0.5rem; font-size: 0.75rem; color: #e65100;">
                        <i class="fas fa-exclamation-triangle"></i> Review Recommended
                    </div>` : ''}
                    <label>Brand</label>
                    <input type="text" value="${shoe.brand}" 
                           onchange="updateShoe(${index}, 'brand', this.value)">
                    
                    <label>Model</label>
                    <input type="text" value="${shoe.model}" 
                           onchange="updateShoe(${index}, 'model', this.value)">
                    
                    ${shoe.color ? `<label>Color</label>
                    <input type="text" value="${shoe.color}" readonly style="background: #f5f5f5;">` : ''}
                    
                    <label>Description</label>
                    <input type="text" value="${shoe.description || ''}" 
                           onchange="updateShoe(${index}, 'description', this.value)">
                    
                    <label>MSRP ($)</label>
                    <input type="number" value="${shoe.msrp || defaultMsrp.value}" step="0.01"
                           onchange="updateShoe(${index}, 'msrp', parseFloat(this.value))">
                    
                    <label>Price ($)</label>
                    <input type="number" value="${shoe.price || defaultPrice.value}" step="0.01"
                           onchange="updateShoe(${index}, 'price', parseFloat(this.value))">
                    
                    <label>Condition</label>
                    <select onchange="updateShoe(${index}, 'condition', this.value)" 
                            style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px;">
                        <option value="Excellent" ${shoe.condition === 'Excellent' ? 'selected' : ''}>Excellent</option>
                        <option value="Very Good" ${shoe.condition === 'Very Good' ? 'selected' : ''}>Very Good</option>
                        <option value="Good" ${shoe.condition === 'Good' ? 'selected' : ''}>Good</option>
                        <option value="Fair" ${shoe.condition === 'Fair' ? 'selected' : ''}>Fair</option>
                        <option value="New" ${shoe.condition === 'New' ? 'selected' : ''}>New</option>
                    </select>
                </div>
            </div>
        `;
    }).join('');
    
    // Select all by default
    analyzedShoes.forEach((_, index) => selectedShoes.add(index));
    updateStats();
}

// Toggle shoe selection
function toggleShoe(index) {
    const checkbox = document.getElementById(`shoe-${index}`);
    const card = document.querySelector(`[data-index="${index}"]`);
    
    if (checkbox.checked) {
        selectedShoes.add(index);
        card.classList.add('selected');
    } else {
        selectedShoes.delete(index);
        card.classList.remove('selected');
    }
    
    updateStats();
}

// Make toggleShoe available globally
window.toggleShoe = toggleShoe;

// Update shoe data
function updateShoe(index, field, value) {
    if (analyzedShoes[index]) {
        analyzedShoes[index][field] = value;
    }
}

// Make updateShoe available globally
window.updateShoe = updateShoe;

// Select all
selectAllBtn.addEventListener('click', () => {
    analyzedShoes.forEach((_, index) => {
        selectedShoes.add(index);
        const checkbox = document.getElementById(`shoe-${index}`);
        if (checkbox) checkbox.checked = true;
        const card = document.querySelector(`[data-index="${index}"]`);
        if (card) card.classList.add('selected');
    });
    updateStats();
});

// Deselect all
deselectAllBtn.addEventListener('click', () => {
    selectedShoes.clear();
    analyzedShoes.forEach((_, index) => {
        const checkbox = document.getElementById(`shoe-${index}`);
        if (checkbox) checkbox.checked = false;
        const card = document.querySelector(`[data-index="${index}"]`);
        if (card) card.classList.remove('selected');
    });
    updateStats();
});

// Update stats
function updateStats() {
    totalCount.textContent = analyzedShoes.length;
    selectedCount.textContent = selectedShoes.size;
    
    const selectedShoesArray = Array.from(selectedShoes).map(i => analyzedShoes[i]);
    const imageCount = selectedShoesArray.reduce((sum, shoe) => {
        return sum + (shoe.images ? shoe.images.length : 0);
    }, 0);
    totalImages.textContent = imageCount;
}

// Import selected shoes
importBtn.addEventListener('click', async () => {
    if (selectedShoes.size === 0) {
        alert('Please select at least one shoe to import');
        return;
    }
    
    if (!confirm(`Import ${selectedShoes.size} shoe(s)?`)) {
        return;
    }
    
    const shoesToImport = Array.from(selectedShoes).map(index => {
        const shoe = analyzedShoes[index];
        return {
            brand: shoe.brand,
            model: shoe.model,
            description: shoe.description || '',
            msrp: shoe.msrp || parseFloat(defaultMsrp.value),
            price: shoe.price || parseFloat(defaultPrice.value),
            size: shoe.size || '9',
            gender: shoe.gender || 'Mens',
            condition: shoe.condition || 'Excellent',
            images: shoe.images.map(img => ({
                filename: typeof img === 'string' ? img : img.filename,
                fullPath: typeof img === 'string' ? null : img.fullPath
            }))
        };
    });
    
    showLoading(`Importing ${shoesToImport.length} shoe(s)...`);
    
    try {
        const response = await fetch(`${API_BASE}/shoes/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                shoes: shoesToImport,
                defaultMsrp: parseFloat(defaultMsrp.value),
                defaultPrice: parseFloat(defaultPrice.value)
            })
        });
        
        if (!response.ok) {
            throw new Error('Import failed');
        }
        
        const result = await response.json();
        hideLoading();
        
        if (result.errors && result.errors.length > 0) {
            alert(`Imported ${result.imported} shoes. ${result.errors.length} errors occurred.`);
        } else {
            alert(`Successfully imported ${result.imported} shoe(s)!`);
        }
        
        // Clear selection and refresh
        selectedShoes.clear();
        analyzedShoes = [];
        previewContainer.style.display = 'none';
        emptyState.style.display = 'block';
        selectAllBtn.style.display = 'none';
        deselectAllBtn.style.display = 'none';
        importBtn.style.display = 'none';
        
        // Refresh status
        setTimeout(() => {
            checkImportStatus();
            updateQuickStatus();
        }, 1000);
        
    } catch (error) {
        console.error('Error importing shoes:', error);
        alert('Error importing shoes: ' + error.message);
        hideLoading();
    }
});

// Show/hide loading
function showLoading(text) {
    loadingText.textContent = text;
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

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

