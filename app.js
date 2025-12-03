// Simple static version that works with JSON file
let allShoes = [];
let filteredShoes = [];
let selectedShoes = new Set();

// Try to load from API (localhost) or JSON file (GitHub Pages)
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000/api' 
    : '';

// DOM Elements
const shoesGrid = document.getElementById('shoesGrid');
const searchInput = document.getElementById('searchInput');
const brandFilter = document.getElementById('brandFilter');
const loading = document.getElementById('loading');
const noResults = document.getElementById('noResults');
const selectionBar = document.getElementById('selectionBar');
const selectionCount = document.getElementById('selectionCount');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadShoes();
    
    // Event listeners
    searchInput.addEventListener('input', handleFilter);
    brandFilter.addEventListener('change', handleFilter);
});

// Load shoes from API or JSON file
async function loadShoes() {
    try {
        loading.style.display = 'block';
        shoesGrid.style.display = 'none';
        noResults.style.display = 'none';
        
        if (API_BASE) {
            // Try API first (localhost)
            const response = await fetch(`${API_BASE}/shoes`);
            if (response.ok) {
                allShoes = await response.json();
            } else {
                throw new Error('API not available');
            }
        } else {
            // Load from JSON file (GitHub Pages)
            const response = await fetch('data/shoes.json');
            if (!response.ok) {
                throw new Error('JSON file not found');
            }
            allShoes = await response.json();
        }
        
        // Process images array
        allShoes = allShoes.map(shoe => ({
            ...shoe,
            images: Array.isArray(shoe.images) ? shoe.images : (shoe.images ? shoe.images.split(',') : []),
            primary_image: shoe.primary_image || (Array.isArray(shoe.images) ? shoe.images[0] : '')
        }));
        
        filteredShoes = [...allShoes];
        loadBrands();
        displayShoes();
        
        loading.style.display = 'none';
        shoesGrid.style.display = 'grid';
    } catch (error) {
        console.error('Error loading shoes:', error);
        loading.innerHTML = '<p>Error loading shoes. Please try again later.</p>';
    }
}

// Load brands
function loadBrands() {
    const brands = [...new Set(allShoes.map(shoe => shoe.brand).filter(Boolean))].sort();
    
    brands.forEach(brand => {
        const option = document.createElement('option');
        option.value = brand;
        option.textContent = brand;
        brandFilter.appendChild(option);
    });
}

// Filter shoes
function handleFilter() {
    const searchTerm = searchInput.value.toLowerCase();
    const brand = brandFilter.value;
    
    filteredShoes = allShoes.filter(shoe => {
        const matchesSearch = !searchTerm || 
            shoe.brand.toLowerCase().includes(searchTerm) ||
            shoe.model.toLowerCase().includes(searchTerm) ||
            (shoe.description && shoe.description.toLowerCase().includes(searchTerm));
        
        const matchesBrand = !brand || shoe.brand === brand;
        
        return matchesSearch && matchesBrand;
    });
    
    displayShoes();
}

// Display shoes
function displayShoes() {
    if (filteredShoes.length === 0) {
        shoesGrid.style.display = 'none';
        noResults.style.display = 'block';
        return;
    }
    
    shoesGrid.innerHTML = filteredShoes.map(shoe => {
        const image = shoe.primary_image || (shoe.images && shoe.images.length > 0 ? shoe.images[0] : '');
        
        let imageUrl;
        if (!image) {
            imageUrl = 'https://via.placeholder.com/400?text=No+Image';
        } else if (API_BASE) {
            // Localhost - use API
            imageUrl = image.startsWith('http') ? image : `/uploads/${image}`;
        } else {
            // GitHub Pages - use relative path
            imageUrl = image.startsWith('http') ? image : `images/${image}`;
        }
        
        const isSelected = selectedShoes.has(shoe.id);
        const imageCount = (shoe.images && shoe.images.length) || 0;
        const hasMultipleImages = imageCount > 1;
        
        return `
            <div class="shoe-card ${isSelected ? 'selected' : ''}" onclick="openGallery(${shoe.id})">
                <button class="heart-btn ${isSelected ? 'selected' : ''}" 
                        onclick="event.stopPropagation(); toggleSelection(${shoe.id}, ${!isSelected})"
                        title="${isSelected ? 'Remove from selection' : 'Add to selection'}">
                    ${isSelected ? '❤️' : '🤍'}
                </button>
                <div class="shoe-image-container">
                    <img src="${imageUrl}" alt="${shoe.brand} ${shoe.model}" class="shoe-image" 
                         onerror="this.src='https://via.placeholder.com/400?text=No+Image'">
                    ${hasMultipleImages ? `<div class="image-count-badge">📷 ${imageCount} photos</div>` : ''}
                </div>
                <div class="shoe-info">
                    <div class="shoe-brand">${shoe.brand}</div>
                    <div class="shoe-model">${shoe.model}</div>
                    ${shoe.description ? `<div class="shoe-description" style="font-size: 12px; color: #666; margin: 5px 0;">${shoe.description}</div>` : ''}
                    <div class="shoe-price">
                        <span class="price-current">$${shoe.price.toFixed(2)}</span>
                        ${shoe.msrp && shoe.msrp > shoe.price ? `<span class="price-msrp">$${shoe.msrp.toFixed(2)}</span>` : ''}
                    </div>
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">
                        ${shoe.condition ? `✨ ${shoe.condition}` : '✨ New'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Toggle selection
function toggleSelection(shoeId, isSelected) {
    if (isSelected) {
        selectedShoes.add(shoeId);
    } else {
        selectedShoes.delete(shoeId);
    }
    updateSelectionBar();
}

// Update selection bar
function updateSelectionBar() {
    const count = selectedShoes.size;
    const emoji = count > 0 ? '❤️' : '🤍';
    selectionCount.innerHTML = `<span class="emoji">${emoji}</span>${count} selected`;
    
    if (count > 0) {
        selectionBar.classList.add('active');
    } else {
        selectionBar.classList.remove('active');
    }
}

// Clear selection
function clearSelection() {
    if (selectedShoes.size === 0) return;
    if (!confirm('Clear all selections?')) return;
    
    selectedShoes.clear();
    updateSelectionBar();
    displayShoes();
}

// Gallery functionality
let currentGalleryShoe = null;
let currentGalleryIndex = 0;

function openGallery(shoeId) {
    const shoe = allShoes.find(s => s.id === shoeId);
    if (!shoe || !shoe.images || shoe.images.length === 0) return;
    
    currentGalleryShoe = shoe;
    currentGalleryIndex = 0;
    showGalleryImage();
    document.getElementById('galleryModal').classList.add('active');
}

function closeGallery() {
    document.getElementById('galleryModal').classList.remove('active');
    currentGalleryShoe = null;
}

function changeGalleryImage(direction) {
    if (!currentGalleryShoe || !currentGalleryShoe.images) return;
    
    currentGalleryIndex += direction;
    if (currentGalleryIndex < 0) {
        currentGalleryIndex = currentGalleryShoe.images.length - 1;
    } else if (currentGalleryIndex >= currentGalleryShoe.images.length) {
        currentGalleryIndex = 0;
    }
    showGalleryImage();
}

function showGalleryImage() {
    if (!currentGalleryShoe || !currentGalleryShoe.images) return;
    
    const image = currentGalleryShoe.images[currentGalleryIndex];
    let imageUrl;
    
    if (API_BASE) {
        imageUrl = image.startsWith('http') ? image : `/uploads/${image}`;
    } else {
        imageUrl = image.startsWith('http') ? image : `images/${image}`;
    }
    
    document.getElementById('galleryImage').src = imageUrl;
    document.getElementById('galleryBrand').textContent = currentGalleryShoe.brand;
    document.getElementById('galleryModel').textContent = currentGalleryShoe.model;
    document.getElementById('galleryCounter').innerHTML = 
        `<span class="gallery-counter">${currentGalleryIndex + 1} of ${currentGalleryShoe.images.length}</span>`;
}

// Keyboard navigation for gallery
document.addEventListener('keydown', (e) => {
    const gallery = document.getElementById('galleryModal');
    if (gallery.classList.contains('active')) {
        if (e.key === 'Escape') closeGallery();
        if (e.key === 'ArrowLeft') changeGalleryImage(-1);
        if (e.key === 'ArrowRight') changeGalleryImage(1);
    }
});

// Show summary
function showSummary() {
    if (selectedShoes.size === 0) {
        alert('👟 Please select at least one shoe you like!');
        return;
    }
    
    const selected = allShoes.filter(shoe => selectedShoes.has(shoe.id));
    const totalValue = selected.reduce((sum, shoe) => sum + parseFloat(shoe.price), 0);
    
    let summaryHTML = `
        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="font-size: 18px; margin: 5px 0;"><strong>👟 Total Selected: ${selected.length} shoe${selected.length !== 1 ? 's' : ''}</strong></p>
            <p style="font-size: 18px; margin: 5px 0;"><strong>💰 Total Value: $${totalValue.toFixed(2)}</strong></p>
        </div>
        <hr style="margin: 20px 0;">
    `;
    
    selected.forEach((shoe, index) => {
        summaryHTML += `
            <div class="summary-item">
                <div style="display: flex; align-items: start; gap: 15px;">
                    <div style="font-size: 24px;">${index + 1}.</div>
                    <div style="flex: 1;">
                        <strong style="font-size: 16px;">${shoe.brand} ${shoe.model}</strong><br>
                        <span style="color: #4CAF50; font-weight: bold; font-size: 18px;">$${shoe.price.toFixed(2)}</span>
                        ${shoe.msrp && shoe.msrp > shoe.price ? ` <span style="text-decoration: line-through; color: #999;">$${shoe.msrp.toFixed(2)}</span>` : ''}<br>
                        ${shoe.description ? `<div style="margin: 5px 0; color: #666;">${shoe.description}</div>` : ''}
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">
                            ✨ ${shoe.condition || 'New'} • ${shoe.images && shoe.images.length > 0 ? `📷 ${shoe.images.length} photo${shoe.images.length !== 1 ? 's' : ''}` : 'No photos'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    document.getElementById('summaryContent').innerHTML = summaryHTML;
    document.getElementById('summaryModal').classList.add('active');
    
    // Store summary text for copying
    window.summaryText = generateSummaryText(selected, totalValue);
}

// Generate summary text
function generateSummaryText(selected, totalValue) {
    let text = `👟 SHOE SELECTION SUMMARY 👟\n`;
    text += `==========================\n\n`;
    text += `Total Selected: ${selected.length} shoe${selected.length !== 1 ? 's' : ''}\n`;
    text += `Total Value: $${totalValue.toFixed(2)}\n\n`;
    text += `SELECTED SHOES:\n`;
    text += `---------------\n\n`;
    
    selected.forEach((shoe, index) => {
        text += `${index + 1}. ${shoe.brand} ${shoe.model}\n`;
        text += `   💰 Price: $${shoe.price.toFixed(2)}`;
        if (shoe.msrp && shoe.msrp > shoe.price) {
            text += ` (MSRP: $${shoe.msrp.toFixed(2)})`;
        }
        text += `\n`;
        if (shoe.description) {
            text += `   📝 ${shoe.description}\n`;
        }
        text += `   ✨ Condition: ${shoe.condition || 'New'}\n`;
        if (shoe.images && shoe.images.length > 0) {
            text += `   📷 ${shoe.images.length} photo${shoe.images.length !== 1 ? 's' : ''}\n`;
        }
        text += `\n`;
    });
    
    return text;
}

// Copy summary
function copySummary() {
    if (window.summaryText) {
        navigator.clipboard.writeText(window.summaryText).then(() => {
            alert('Summary copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = window.summaryText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('Summary copied to clipboard!');
        });
    }
}

// Close summary
function closeSummary() {
    document.getElementById('summaryModal').classList.remove('active');
}

