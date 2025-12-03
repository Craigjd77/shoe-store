const API_BASE = 'http://localhost:3000/api';

// Export JSON after changes
async function exportShoesJSON() {
    try {
        const response = await fetch(`${API_BASE}/shoes/export`);
        const result = await response.json();
        console.log('Exported shoes to JSON:', result.message);
    } catch (error) {
        console.error('Error exporting JSON:', error);
    }
}

// DOM Elements
const addShoeForm = document.getElementById('addShoeForm');
const imageUploadForm = document.getElementById('imageUploadForm');
const imageUploadSection = document.getElementById('imageUploadSection');
const selectedShoeId = document.getElementById('selectedShoeId');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const manageSearch = document.getElementById('manageSearch');
const shoesList = document.getElementById('shoesList');
const cartCount = document.querySelector('.cart-count');

// Image management elements
const imagesGrid = document.getElementById('imagesGrid');
const shoesListForImages = document.getElementById('shoesListForImages');
const imageActionPanel = document.getElementById('imageActionPanel');
const selectedCount = document.getElementById('selectedCount');
const createShoeFromImagesBtn = document.getElementById('createShoeFromImagesBtn');
const addImagesToShoeBtn = document.getElementById('addImagesToShoeBtn');
const clearImageSelectionBtn = document.getElementById('clearImageSelectionBtn');

let selectedShoe = null;
let allImages = [];
let allShoesForImages = [];
let selectedImages = new Set();
let selectedShoeForImages = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (localStorage.getItem('adminAuthenticated') !== 'true') {
        window.location.href = 'login.html';
        return;
    }
    
    setupTabs();
    loadManageShoes();
    loadImagesForManagement();
    updateCartCount();
    
    // Setup sync to GitHub button
    const syncBtn = document.getElementById('syncToGitHubBtn');
    if (syncBtn) {
        syncBtn.addEventListener('click', syncToGitHub);
    }
});

// Setup tabs
function setupTabs() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabName}Tab`).classList.add('active');
            
            if (tabName === 'manage') {
                loadManageShoes();
            } else if (tabName === 'images') {
                loadImagesForManagement();
            }
        });
    });
}

// Add shoe form
addShoeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        brand: document.getElementById('brand').value,
        model: document.getElementById('model').value,
        description: document.getElementById('description').value,
        msrp: parseFloat(document.getElementById('msrp').value),
        price: parseFloat(document.getElementById('price').value),
        size: document.getElementById('size').value,
        gender: document.getElementById('gender').value,
        condition: document.getElementById('condition').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/shoes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            const result = await response.json();
            alert('Shoe added successfully! Now upload images.');
            exportShoesJSON(); // Export JSON after creation
            
            // Show image upload section
            selectedShoeId.value = result.id;
            selectedShoe = result.id;
            imageUploadSection.style.display = 'block';
            imageUploadSection.scrollIntoView({ behavior: 'smooth' });
            
            // Reset form
            addShoeForm.reset();
            document.getElementById('size').value = '9';
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        console.error('Error adding shoe:', error);
        alert('Error adding shoe. Please try again.');
    }
});

// Image preview
imageInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    imagePreview.innerHTML = '';
    
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const div = document.createElement('div');
                div.className = 'preview-image';
                div.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                imagePreview.appendChild(div);
            };
            reader.readAsDataURL(file);
        }
    });
});

// Image upload
imageUploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!selectedShoeId.value) {
        alert('Please add a shoe first');
        return;
    }
    
    const files = imageInput.files;
    if (files.length === 0) {
        alert('Please select at least one image');
        return;
    }
    
    const formData = new FormData();
    Array.from(files).forEach(file => {
        formData.append('images', file);
    });
    
    try {
        const response = await fetch(`${API_BASE}/shoes/${selectedShoeId.value}/images`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            alert('Images uploaded successfully!');
            exportShoesJSON(); // Export JSON after image upload
            imageUploadForm.reset();
            imagePreview.innerHTML = '';
            selectedShoeId.value = '';
            selectedShoe = null;
            imageUploadSection.style.display = 'none';
            loadManageShoes();
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        console.error('Error uploading images:', error);
        alert('Error uploading images. Please try again.');
    }
});

// Load manage shoes
async function loadManageShoes() {
    try {
        // Add cache-busting parameter to ensure fresh data
        const response = await fetch(`${API_BASE}/shoes?t=${Date.now()}`);
        const shoes = await response.json();
        
        // Remove duplicates by brand+model+image_count
        const uniqueShoes = [];
        const seen = new Set();
        
        shoes.forEach(shoe => {
            const imageCount = shoe.images ? shoe.images.length : 0;
            const key = `${shoe.brand}|${shoe.model}|${imageCount}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueShoes.push(shoe);
            }
        });
        
        displayManageShoes(uniqueShoes);
    } catch (error) {
        console.error('Error loading shoes:', error);
    }
}

// Display manage shoes
function displayManageShoes(shoes) {
    const searchTerm = manageSearch.value.toLowerCase();
    const filtered = shoes.filter(shoe => {
        return !searchTerm || 
            shoe.brand.toLowerCase().includes(searchTerm) ||
            shoe.model.toLowerCase().includes(searchTerm);
    });
    
    if (filtered.length === 0) {
        shoesList.innerHTML = '<p>No shoes found</p>';
        return;
    }
    
    shoesList.innerHTML = filtered.map(shoe => {
        const image = shoe.primary_image || (shoe.images && shoe.images.length > 0 ? shoe.images[0] : '');
        const imageUrl = image ? `/uploads/${image}` : 'https://via.placeholder.com/100?text=No+Image';
        
        return `
            <div class="manage-shoe-item">
                <img src="${imageUrl}" alt="${shoe.brand} ${shoe.model}" class="manage-shoe-image"
                     onerror="this.src='https://via.placeholder.com/100?text=No+Image'">
                <div class="manage-shoe-info">
                    <h3>${shoe.brand} ${shoe.model}</h3>
                    <p>MSRP: $${shoe.msrp.toFixed(2)} | Price: $${shoe.price.toFixed(2)}</p>
                    <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.25rem;">
                        ${shoe.images ? shoe.images.length : 0} image(s) | 
                        <span class="condition-badge condition-${(shoe.condition || 'Excellent').toLowerCase().replace(/\s+/g, '-')}">
                            ${shoe.condition || 'Excellent'}
                        </span>
                    </p>
                </div>
                <div class="manage-shoe-actions">
                    <a href="product.html?id=${shoe.id}" class="btn btn-primary btn-small" target="_blank">
                        <i class="fas fa-eye"></i> View
                    </a>
                    <button class="btn btn-danger btn-small" onclick="deleteShoe(${shoe.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Search in manage tab
manageSearch.addEventListener('input', () => {
    loadManageShoes();
});

// Delete shoe
async function deleteShoe(shoeId) {
    if (!confirm('Are you sure you want to delete this shoe? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/shoes/${shoeId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Shoe deleted successfully');
            exportShoesJSON(); // Export JSON after deletion
            // Force reload to clear any cached data
            setTimeout(() => {
                loadManageShoes();
            }, 100);
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        console.error('Error deleting shoe:', error);
        alert('Error deleting shoe. Please try again.');
    }
}

// Make deleteShoe available globally
window.deleteShoe = deleteShoe;

// ========== IMAGE MANAGEMENT FUNCTIONS ==========

// Load images for management tab
async function loadImagesForManagement() {
    try {
        const [imagesResponse, shoesResponse] = await Promise.all([
            fetch(`${API_BASE}/shoes/import-status`),
            fetch(`${API_BASE}/shoes`)
        ]);
        
        if (imagesResponse.ok) {
            const status = await imagesResponse.json();
            allImages = [...status.newImages, ...status.processedImages];
        }
        
        if (shoesResponse.ok) {
            allShoesForImages = await shoesResponse.json();
        }
        
        displayImagesForManagement();
        displayShoesForImages();
    } catch (error) {
        console.error('Error loading images:', error);
    }
}

// Display images in management tab
function displayImagesForManagement() {
    if (!imagesGrid) return;
    
    if (allImages.length === 0) {
        imagesGrid.innerHTML = '<p>No images found</p>';
        return;
    }
    
    imagesGrid.innerHTML = allImages.map(img => {
        const isSelected = selectedImages.has(img.filename);
        const isHeic = img.filename.toLowerCase().endsWith('.heic') || img.filename.toLowerCase().endsWith('.heif');
        const imageUrl = isHeic ? `/api/images/preview/${encodeURIComponent(img.filename)}` : `/SHOES/${encodeURIComponent(img.filename)}`;
        
        return `
            <div draggable="true" 
                 data-image-filename="${img.filename}"
                 data-type="image"
                 style="position: relative; border: 2px solid ${isSelected ? '#4caf50' : '#ddd'}; border-radius: 8px; overflow: hidden; cursor: grab; transition: all 0.2s;"
                 onclick="toggleImageSelection('${img.filename}')"
                 ondragstart="handleDragStart(event, '${img.filename}', 'image')"
                 ondragend="handleDragEnd(event)">
                ${isSelected ? '<div style="position: absolute; top: 4px; left: 4px; width: 20px; height: 20px; background: #4caf50; color: white; border-radius: 4px; display: flex; align-items: center; justify-content: center; z-index: 10;">✓</div>' : ''}
                <img src="${imageUrl}" alt="${img.filename}" style="width: 100%; height: 120px; object-fit: cover; pointer-events: none;" loading="lazy"
                     onerror="this.src='https://via.placeholder.com/120?text=Error'">
                <div style="padding: 0.5rem; font-size: 0.7rem; background: rgba(0,0,0,0.7); color: white; word-break: break-all;">${img.filename}</div>
            </div>
        `;
    }).join('');
    
    updateImageActionPanel();
}

// Multi-selection for shoes
let selectedShoesForDeletion = new Set();

// Display shoes for image management
function displayShoesForImages() {
    if (!shoesListForImages) return;
    
    if (allShoesForImages.length === 0) {
        shoesListForImages.innerHTML = '<p>No shoes in store yet</p>';
        setupDropZone();
        updateShoeSelectionPanel();
        return;
    }
    
    shoesListForImages.innerHTML = allShoesForImages.map(shoe => {
        const isSelected = selectedShoeForImages === shoe.id;
        const isSelectedForDeletion = selectedShoesForDeletion.has(shoe.id);
        const primaryImage = shoe.primary_image || (shoe.images && shoe.images[0]) || '';
        const imageUrl = primaryImage ? `/uploads/${primaryImage}` : 'https://via.placeholder.com/60?text=No+Image';
        const imageCount = shoe.images ? (Array.isArray(shoe.images) ? shoe.images.length : shoe.images.split(',').length) : 0;
        
        return `
            <div data-shoe-id="${shoe.id}"
                 data-type="shoe-dropzone"
                 style="border: 2px solid ${isSelectedForDeletion ? '#f44336' : (isSelected ? '#2196f3' : '#ddd')}; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; background: ${isSelectedForDeletion ? '#ffebee' : (isSelected ? '#e3f2fd' : 'white')}; transition: all 0.2s; position: relative;"
                 ondragover="handleDragOver(event)" 
                 ondrop="handleDrop(event, ${shoe.id})"
                 ondragenter="handleDragEnter(event)"
                 ondragleave="handleDragLeave(event)">
                <div style="display: flex; align-items: center; gap: 1rem; position: relative; z-index: 2;">
                    <input type="checkbox" 
                           style="width: 20px; height: 20px; cursor: pointer; flex-shrink: 0;"
                           ${isSelectedForDeletion ? 'checked' : ''}
                           onclick="event.stopPropagation(); toggleShoeSelection(${shoe.id})">
                    <div style="cursor: pointer; flex-shrink: 0;" onclick="selectShoeForImages(${shoe.id})">
                        <img src="${imageUrl}" alt="${shoe.brand} ${shoe.model}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; pointer-events: none;"
                             onerror="this.src='https://via.placeholder.com/60?text=No+Image'">
                    </div>
                    <div style="flex: 1; cursor: pointer;" onclick="selectShoeForImages(${shoe.id})">
                        <h3 style="margin: 0; font-size: 1rem;">${shoe.brand} ${shoe.model}</h3>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem; color: #666;">$${shoe.price} <span style="text-decoration: line-through; color: #999;">$${shoe.msrp}</span></p>
                        <div style="font-size: 0.75rem; color: #999; margin-top: 0.5rem;">${imageCount} image(s) - Drop images here</div>
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-shrink: 0; position: relative; z-index: 10;" onclick="event.stopPropagation();">
                        <button class="btn" onclick="editShoeFromImages(${shoe.id})" style="padding: 0.5rem; font-size: 0.85rem; background: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn" onclick="deleteShoeFromImages(${shoe.id})" style="padding: 0.5rem; font-size: 0.85rem; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    setupDropZone();
    updateShoeSelectionPanel();
}

// Toggle shoe selection for bulk deletion
function toggleShoeSelection(shoeId) {
    if (selectedShoesForDeletion.has(shoeId)) {
        selectedShoesForDeletion.delete(shoeId);
    } else {
        selectedShoesForDeletion.add(shoeId);
    }
    displayShoesForImages();
}

// Update shoe selection panel
function updateShoeSelectionPanel() {
    const panel = document.getElementById('shoeSelectionPanel');
    if (!panel) return;
    
    const count = selectedShoesForDeletion.size;
    if (count === 0) {
        panel.style.display = 'none';
        return;
    }
    
    panel.style.display = 'block';
    const countElement = document.getElementById('selectedShoeCount');
    if (countElement) {
        countElement.textContent = `${count} shoe${count > 1 ? 's' : ''} selected`;
    }
}

// Delete selected shoes
async function deleteSelectedShoes() {
    const selectedIds = Array.from(selectedShoesForDeletion);
    if (selectedIds.length === 0) {
        alert('No shoes selected');
        return;
    }
    
    if (!confirm(`Delete ${selectedIds.length} shoe(s)? This cannot be undone.`)) {
        return;
    }
    
    try {
        const deletePromises = selectedIds.map(id => 
            fetch(`${API_BASE}/shoes/${id}`, { method: 'DELETE' })
        );
        
        const results = await Promise.all(deletePromises);
        const failed = results.filter(r => !r.ok);
        
        if (failed.length === 0) {
            alert(`✓ Successfully deleted ${selectedIds.length} shoe(s)!`);
            exportShoesJSON(); // Export JSON after bulk deletion
            selectedShoesForDeletion.clear();
            loadImagesForManagement();
            loadManageShoes();
        } else {
            alert(`Deleted ${selectedIds.length - failed.length} shoe(s), ${failed.length} failed`);
        }
    } catch (error) {
        alert('Error deleting shoes: ' + error.message);
    }
}

// Drag and drop handlers
let draggedImageFilename = null;
let draggedImageElement = null;

function handleDragStart(e, filename, type) {
    draggedImageFilename = filename;
    draggedImageElement = e.target;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', filename);
    e.dataTransfer.setData('type', type);
    e.target.style.opacity = '0.5';
}

function handleDragEnd(e) {
    e.target.style.opacity = '1';
    // Remove all drag-over styles
    document.querySelectorAll('[data-type="shoe-dropzone"]').forEach(el => {
        el.style.borderColor = '#ddd';
        el.style.background = 'white';
    });
    const dropZone = document.getElementById('createNewShoeDropZone');
    if (dropZone) {
        dropZone.style.borderColor = '#4caf50';
        dropZone.style.background = '#f1f8f4';
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    if (e.currentTarget.dataset.type === 'shoe-dropzone') {
        e.currentTarget.style.borderColor = '#4caf50';
        e.currentTarget.style.background = '#e8f5e9';
    }
}

function handleDragLeave(e) {
    if (e.currentTarget.dataset.type === 'shoe-dropzone') {
        e.currentTarget.style.borderColor = '#ddd';
        e.currentTarget.style.background = 'white';
    }
}

async function handleDrop(e, shoeId) {
    e.preventDefault();
    e.stopPropagation();
    
    const filename = e.dataTransfer.getData('text/plain');
    
    // Reset styles
    e.currentTarget.style.borderColor = '#ddd';
    e.currentTarget.style.background = selectedShoeForImages === shoeId ? '#e3f2fd' : 'white';
    
    if (!filename || !shoeId) return;
    
    const shoe = allShoesForImages.find(s => s.id == shoeId);
    if (!shoe) return;
    
    // Add image to existing shoe
    if (confirm(`Add "${filename}" to "${shoe.brand} ${shoe.model}"?`)) {
        try {
            const response = await fetch(`${API_BASE}/shoes/${shoeId}/add-images-from-shoes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageFilenames: [filename]
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                alert(`✓ Image added to shoe!`);
                loadImagesForManagement();
                loadManageShoes();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add image');
            }
        } catch (error) {
            alert('Error adding image: ' + error.message);
        }
    }
}

// Setup drop zone for creating new shoes
function setupDropZone() {
    const createNewShoeZone = document.getElementById('createNewShoeDropZone');
    if (!createNewShoeZone) return;
    
    createNewShoeZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        createNewShoeZone.style.borderColor = '#2e7d32';
        createNewShoeZone.style.background = '#c8e6c9';
    });
    
    createNewShoeZone.addEventListener('dragleave', (e) => {
        createNewShoeZone.style.borderColor = '#4caf50';
        createNewShoeZone.style.background = '#f1f8f4';
    });
    
    createNewShoeZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        const filename = e.dataTransfer.getData('text/plain');
        
        createNewShoeZone.style.borderColor = '#4caf50';
        createNewShoeZone.style.background = '#f1f8f4';
        
        if (filename) {
            // Create shoe with this image
            createShoeFromSelectedImages([filename]);
        }
    });
    
    // Also allow clicking to create with selected images
    createNewShoeZone.addEventListener('click', () => {
        if (selectedImages.size > 0) {
            createShoeFromSelectedImages(Array.from(selectedImages));
        }
    });
}

// Toggle image selection
function toggleImageSelection(filename) {
    if (selectedImages.has(filename)) {
        selectedImages.delete(filename);
    } else {
        selectedImages.add(filename);
    }
    displayImagesForManagement();
}

// Select shoe for adding images
function selectShoeForImages(shoeId) {
    selectedShoeForImages = selectedShoeForImages === shoeId ? null : shoeId;
    displayShoesForImages();
    updateImageActionPanel();
}

// Update image action panel
function updateImageActionPanel() {
    if (!imageActionPanel) return;
    
    const count = selectedImages.size;
    if (count === 0) {
        imageActionPanel.style.display = 'none';
        return;
    }
    
    imageActionPanel.style.display = 'block';
    if (selectedCount) {
        selectedCount.textContent = `${count} image${count > 1 ? 's' : ''} selected`;
    }
    
    if (addImagesToShoeBtn) {
        addImagesToShoeBtn.disabled = !selectedShoeForImages;
        addImagesToShoeBtn.style.opacity = selectedShoeForImages ? '1' : '0.5';
    }
}

// Create shoe from selected images
if (createShoeFromImagesBtn) {
    createShoeFromImagesBtn.addEventListener('click', () => {
        if (selectedImages.size === 0) {
            alert('Please select at least one image');
            return;
        }
        createShoeFromSelectedImages();
    });
}

// Add images to existing shoe
if (addImagesToShoeBtn) {
    addImagesToShoeBtn.addEventListener('click', async () => {
        if (selectedImages.size === 0) {
            alert('Please select at least one image');
            return;
        }
        if (!selectedShoeForImages) {
            alert('Please select a shoe to add images to');
            return;
        }
        
        const imageFilenames = Array.from(selectedImages);
        const shoe = allShoesForImages.find(s => s.id == selectedShoeForImages);
        
        if (!confirm(`Add ${imageFilenames.length} image(s) to "${shoe.brand} ${shoe.model}"?`)) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/shoes/${selectedShoeForImages}/add-images-from-shoes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageFilenames: imageFilenames
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                alert(`✓ Added ${result.added || imageFilenames.length} image(s) to shoe!`);
                selectedImages.clear();
                selectedShoeForImages = null;
                loadImagesForManagement();
                loadManageShoes();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add images');
            }
        } catch (error) {
            alert('Error adding images: ' + error.message);
        }
    });
}

// Clear image selection
if (clearImageSelectionBtn) {
    clearImageSelectionBtn.addEventListener('click', () => {
        selectedImages.clear();
        selectedShoeForImages = null;
        displayImagesForManagement();
        displayShoesForImages();
    });
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('adminAuthenticated');
        localStorage.removeItem('adminLoginTime');
        window.location.href = 'login.html';
    }
}

// Make functions globally accessible
window.toggleShoeSelection = toggleShoeSelection;
window.deleteSelectedShoes = deleteSelectedShoes;
window.logout = logout;

// Create shoe from selected images
async function createShoeFromSelectedImages() {
    const imageFilenames = Array.from(selectedImages);
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;';
    modal.innerHTML = `
        <div class="modal-content" style="background: white; padding: 2rem; border-radius: 8px; max-width: 500px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h2 style="margin: 0;">Create Shoe (${imageFilenames.length} images)</h2>
                <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
            </div>
            <form id="createShoeFromImagesForm">
                <div class="form-group">
                    <label>Brand *</label>
                    <input type="text" name="brand" required placeholder="Nike" autofocus style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div class="form-group">
                    <label>Model *</label>
                    <input type="text" name="model" required placeholder="Dunk Low" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div class="form-group">
                    <label>Color</label>
                    <input type="text" name="color" placeholder="White" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label>Price *</label>
                        <input type="number" name="price" required step="0.01" placeholder="100.00" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div class="form-group">
                        <label>Original Price</label>
                        <input type="number" name="msrp" step="0.01" placeholder="120.00" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                </div>
                <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
                    <button type="submit" class="btn btn-primary" style="flex: 1;">
                        <i class="fas fa-check"></i> Create Shoe
                    </button>
                    <button type="button" class="btn" onclick="this.closest('.modal').remove()" style="flex: 1;">Cancel</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('createShoeFromImagesForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        
        try {
            const response = await fetch(`${API_BASE}/shoes/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shoes: [{
                        brand: data.brand.trim(),
                        model: data.model.trim(),
                        description: data.color ? `${data.color} ${data.brand} ${data.model}` : `${data.brand} ${data.model}`,
                        msrp: parseFloat(data.msrp) || parseFloat(data.price) * 1.2,
                        price: parseFloat(data.price),
                        size: '9',
                        gender: 'Mens',
                        condition: 'Excellent',
                        images: imageFilenames.map(f => ({ filename: f }))
                    }]
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    alert(`✓ Shoe created with ${imageFilenames.length} images!`);
                    exportShoesJSON(); // Export JSON after creation
                    modal.remove();
                    selectedImages.clear();
                    loadImagesForManagement();
                    loadManageShoes();
                } else {
                    throw new Error(result.errors?.[0]?.error || 'Failed to create shoe');
                }
            } else {
                throw new Error('Failed to create shoe');
            }
        } catch (error) {
            alert('Error: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check"></i> Create Shoe';
        }
    });
}

// Edit shoe from images panel
async function editShoeFromImages(shoeId) {
    const shoe = allShoesForImages.find(s => s.id == shoeId);
    if (!shoe) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;';
    modal.innerHTML = `
        <div class="modal-content" style="background: white; padding: 2rem; border-radius: 8px; max-width: 500px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h2 style="margin: 0;">Edit Shoe</h2>
                <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
            </div>
            <form id="editShoeForm">
                <div class="form-group">
                    <label>Brand *</label>
                    <input type="text" name="brand" value="${shoe.brand}" required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div class="form-group">
                    <label>Model *</label>
                    <input type="text" name="model" value="${shoe.model}" required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea name="description" rows="3" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">${shoe.description || ''}</textarea>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label>Price *</label>
                        <input type="number" name="price" value="${shoe.price}" required step="0.01" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div class="form-group">
                        <label>Original Price</label>
                        <input type="number" name="msrp" value="${shoe.msrp}" step="0.01" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label>Size</label>
                        <input type="text" name="size" value="${shoe.size || '9'}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div class="form-group">
                        <label>Gender</label>
                        <select name="gender" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="Mens" ${shoe.gender === 'Mens' ? 'selected' : ''}>Mens</option>
                            <option value="Womens" ${shoe.gender === 'Womens' ? 'selected' : ''}>Womens</option>
                            <option value="Unisex" ${shoe.gender === 'Unisex' ? 'selected' : ''}>Unisex</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Condition</label>
                        <select name="condition" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="New" ${shoe.condition === 'New' ? 'selected' : ''}>New</option>
                            <option value="Like New" ${shoe.condition === 'Like New' ? 'selected' : ''}>Like New</option>
                            <option value="Excellent" ${shoe.condition === 'Excellent' ? 'selected' : ''}>Excellent</option>
                            <option value="Good" ${shoe.condition === 'Good' ? 'selected' : ''}>Good</option>
                            <option value="Fair" ${shoe.condition === 'Fair' ? 'selected' : ''}>Fair</option>
                        </select>
                    </div>
                </div>
                <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
                    <button type="submit" class="btn btn-primary" style="flex: 1;">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                    <button type="button" class="btn" onclick="this.closest('.modal').remove()" style="flex: 1;">Cancel</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('editShoeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        try {
            // Update shoe via API
            const response = await fetch(`${API_BASE}/shoes/${shoeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    brand: data.brand.trim(),
                    model: data.model.trim(),
                    description: data.description.trim(),
                    msrp: parseFloat(data.msrp),
                    price: parseFloat(data.price),
                    size: data.size,
                    gender: data.gender,
                    condition: data.condition
                })
            });
            
            if (response.ok) {
                alert('✓ Shoe updated successfully!');
                exportShoesJSON(); // Export JSON after update
                modal.remove();
                loadImagesForManagement();
                loadManageShoes();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update shoe');
            }
        } catch (error) {
            alert('Error: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        }
    });
}

// Delete shoe from images panel
async function deleteShoeFromImages(shoeId) {
    const shoe = allShoesForImages.find(s => s.id == shoeId);
    if (!shoe) return;
    
    if (!confirm(`Delete "${shoe.brand} ${shoe.model}"? This cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/shoes/${shoeId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('✓ Shoe deleted successfully!');
            exportShoesJSON(); // Export JSON after deletion
            loadImagesForManagement();
            loadManageShoes();
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        alert('Error deleting shoe: ' + error.message);
    }
}

// Make functions global
window.toggleImageSelection = toggleImageSelection;
window.selectShoeForImages = selectShoeForImages;
window.handleDragStart = handleDragStart;
window.handleDragEnd = handleDragEnd;
window.handleDragOver = handleDragOver;
window.handleDragEnter = handleDragEnter;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
window.editShoeFromImages = editShoeFromImages;
window.deleteShoeFromImages = deleteShoeFromImages;

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

// Sync to GitHub
async function syncToGitHub() {
    const syncBtn = document.getElementById('syncToGitHubBtn');
    const originalText = syncBtn.innerHTML;
    
    // Disable button and show loading
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    
    try {
        const response = await fetch(`${API_BASE}/sync-to-github`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Successfully synced to GitHub Pages!\n\nYour site will update in 1-2 minutes at:\nhttps://craigjd77.github.io/shoe-store/');
            syncBtn.innerHTML = '<i class="fas fa-check"></i> Synced!';
            syncBtn.style.background = '#4caf50';
            
            // Reset after 3 seconds
            setTimeout(() => {
                syncBtn.innerHTML = originalText;
                syncBtn.style.background = '#2196f3';
                syncBtn.disabled = false;
            }, 3000);
        } else {
            throw new Error(result.error || 'Sync failed');
        }
    } catch (error) {
        console.error('Sync error:', error);
        alert('❌ Error syncing to GitHub:\n\n' + error.message + '\n\nYou can manually sync by running:\nnpm run sync');
        syncBtn.innerHTML = originalText;
        syncBtn.disabled = false;
    }
}

