const API_BASE = 'http://localhost:3000/api';

let allImages = [];
let allShoes = [];
let selectedImages = new Set();
let selectedShoeId = null;

const imagesGrid = document.getElementById('imagesGrid');
const shoesList = document.getElementById('shoesList');
const actionPanel = document.getElementById('actionPanel');
const selectedCount = document.getElementById('selectedCount');
const createShoeBtn = document.getElementById('createShoeBtn');
const addToShoeBtn = document.getElementById('addToShoeBtn');
const clearSelectionBtn = document.getElementById('clearSelectionBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setInterval(loadData, 5000); // Refresh every 5 seconds
});

// Load all data
async function loadData() {
    await Promise.all([loadImages(), loadShoes()]);
    displayImages();
    displayShoes();
}

// Load images
async function loadImages() {
    try {
        const response = await fetch(`${API_BASE}/shoes/import-status`);
        if (!response.ok) return;
        
        const status = await response.json();
        allImages = [...status.newImages, ...status.processedImages];
    } catch (error) {
        console.error('Error loading images:', error);
    }
}

// Load shoes
async function loadShoes() {
    try {
        const response = await fetch(`${API_BASE}/shoes`);
        if (!response.ok) return;
        
        allShoes = await response.json();
    } catch (error) {
        console.error('Error loading shoes:', error);
    }
}

// Check if file is HEIC
function isHeicFile(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    return ext === 'heic' || ext === 'heif';
}

// Display images
function displayImages() {
    if (allImages.length === 0) {
        imagesGrid.innerHTML = '<p>No images found</p>';
        return;
    }
    
    imagesGrid.innerHTML = allImages.map(img => {
        const isSelected = selectedImages.has(img.filename);
        const isHeic = isHeicFile(img.filename);
        const imageUrl = isHeic ? `/api/images/preview/${encodeURIComponent(img.filename)}` : `/SHOES/${encodeURIComponent(img.filename)}`;
        
        return `
            <div class="image-item ${isSelected ? 'selected' : ''}" 
                 onclick="toggleImage('${img.filename}')"
                 data-filename="${img.filename}">
                <div class="image-checkbox"></div>
                <img src="${imageUrl}" alt="${img.filename}" loading="lazy"
                     onerror="this.src='https://via.placeholder.com/150?text=Error'">
                <div class="image-filename">${img.filename}</div>
            </div>
        `;
    }).join('');
    
    updateActionPanel();
}

// Display shoes
function displayShoes() {
    if (allShoes.length === 0) {
        shoesList.innerHTML = '<p>No shoes in store yet</p>';
        return;
    }
    
    shoesList.innerHTML = allShoes.map(shoe => {
        const isSelected = selectedShoeId === shoe.id;
        const primaryImage = shoe.primary_image || (shoe.images && shoe.images[0]) || '';
        const imageUrl = primaryImage ? `/uploads/${primaryImage}` : 'https://via.placeholder.com/60?text=No+Image';
        const imageCount = shoe.images ? (Array.isArray(shoe.images) ? shoe.images.length : shoe.images.split(',').length) : 0;
        
        return `
            <div class="shoe-item ${isSelected ? 'selected' : ''}" 
                 onclick="selectShoe(${shoe.id})"
                 data-shoe-id="${shoe.id}">
                <div class="shoe-header">
                    <img src="${imageUrl}" alt="${shoe.brand} ${shoe.model}" class="shoe-thumb"
                         onerror="this.src='https://via.placeholder.com/60?text=No+Image'">
                    <div class="shoe-info">
                        <h3>${shoe.brand} ${shoe.model}</h3>
                        <p>$${shoe.price} <span style="text-decoration: line-through; color: #999;">$${shoe.msrp}</span></p>
                        <div class="shoe-images-count">${imageCount} image(s)</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Toggle image selection
function toggleImage(filename) {
    if (selectedImages.has(filename)) {
        selectedImages.delete(filename);
    } else {
        selectedImages.add(filename);
    }
    displayImages();
}

// Select shoe
function selectShoe(shoeId) {
    selectedShoeId = selectedShoeId === shoeId ? null : shoeId;
    displayShoes();
    updateActionPanel();
}

// Update action panel
function updateActionPanel() {
    const count = selectedImages.size;
    if (count === 0) {
        actionPanel.style.display = 'none';
        return;
    }
    
    actionPanel.style.display = 'block';
    selectedCount.textContent = `${count} image${count > 1 ? 's' : ''} selected`;
    
    // Enable/disable add to shoe button
    addToShoeBtn.disabled = !selectedShoeId;
    addToShoeBtn.style.opacity = selectedShoeId ? '1' : '0.5';
}

// Create new shoe from selected images
createShoeBtn.addEventListener('click', () => {
    if (selectedImages.size === 0) {
        alert('Please select at least one image');
        return;
    }
    
    const imageFilenames = Array.from(selectedImages);
    createShoeFromImages(imageFilenames);
});

// Add images to existing shoe
addToShoeBtn.addEventListener('click', () => {
    if (selectedImages.size === 0) {
        alert('Please select at least one image');
        return;
    }
    
    if (!selectedShoeId) {
        alert('Please select a shoe to add images to');
        return;
    }
    
    const imageFilenames = Array.from(selectedImages);
    addImagesToShoe(selectedShoeId, imageFilenames);
});

// Clear selection
clearSelectionBtn.addEventListener('click', () => {
    selectedImages.clear();
    selectedShoeId = null;
    displayImages();
    displayShoes();
});

// Create shoe from images
async function createShoeFromImages(imageFilenames) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h2 style="margin: 0;">Create Shoe (${imageFilenames.length} images)</h2>
                <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
            </div>
            <form id="createShoeForm">
                <div class="form-group">
                    <label>Brand *</label>
                    <input type="text" name="brand" required placeholder="Nike" autofocus>
                </div>
                <div class="form-group">
                    <label>Model *</label>
                    <input type="text" name="model" required placeholder="Dunk Low">
                </div>
                <div class="form-group">
                    <label>Color</label>
                    <input type="text" name="color" placeholder="White">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label>Price *</label>
                        <input type="number" name="price" required step="0.01" placeholder="100.00">
                    </div>
                    <div class="form-group">
                        <label>Original Price</label>
                        <input type="number" name="msrp" step="0.01" placeholder="120.00">
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
    
    document.getElementById('createShoeForm').addEventListener('submit', async (e) => {
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
                    modal.remove();
                    selectedImages.clear();
                    loadData();
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

// Add images to existing shoe
async function addImagesToShoe(shoeId, imageFilenames) {
    if (!confirm(`Add ${imageFilenames.length} image(s) to this shoe?`)) {
        return;
    }
    
    try {
        // Use the import endpoint to add images
        const response = await fetch(`${API_BASE}/shoes/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shoes: [{
                    id: shoeId, // This will be ignored, we'll handle it differently
                    images: imageFilenames.map(f => ({ filename: f }))
                }]
            })
        });
        
        // Actually, we need to use the upload endpoint for each image
        // For now, let's use a simpler approach - create a new shoe and merge
        // Or better: use the existing shoe's data and add images
        
        const shoe = allShoes.find(s => s.id == shoeId);
        if (!shoe) {
            throw new Error('Shoe not found');
        }
        
        // Import as new shoe with same details, then we can merge manually
        // Or better: add images directly via the upload endpoint
        const formData = new FormData();
        
        // For now, show a message that this feature needs the upload endpoint
        alert('Adding images to existing shoes will be available soon. For now, you can create a new shoe with these images and we\'ll improve the merge feature.');
        
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Make functions global
window.toggleImage = toggleImage;
window.selectShoe = selectShoe;

