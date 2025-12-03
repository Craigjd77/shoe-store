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
        
        // Build image carousel if multiple images
        let imageCarousel = '';
        if (hasMultipleImages && shoe.images.length > 1) {
            const allImages = shoe.images.map((img, idx) => {
                let imgUrl;
                if (API_BASE) {
                    imgUrl = img.startsWith('http') ? img : `/uploads/${img}`;
                } else {
                    imgUrl = img.startsWith('http') ? img : `images/${img}`;
                }
                return `<img src="${imgUrl}" class="carousel-image" data-index="${idx}" style="display: ${idx === 0 ? 'block' : 'none'}; width: 100%; height: 100%; object-fit: cover;">`;
            }).join('');
            
            imageCarousel = `
                <div class="image-carousel" data-shoe-id="${shoe.id}">
                    ${allImages}
                    <div class="carousel-dots">
                        ${shoe.images.map((_, idx) => `<span class="carousel-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}"></span>`).join('')}
                    </div>
                    <div class="carousel-nav carousel-prev" onclick="event.stopPropagation(); changeCarouselImage(${shoe.id}, -1)">‹</div>
                    <div class="carousel-nav carousel-next" onclick="event.stopPropagation(); changeCarouselImage(${shoe.id}, 1)">›</div>
                </div>
            `;
        }
        
        return `
            <div class="shoe-card ${isSelected ? 'selected' : ''}" onclick="openShoeDetail(${shoe.id})">
                <button class="heart-btn ${isSelected ? 'selected' : ''}" 
                        onclick="event.stopPropagation(); toggleSelection(${shoe.id}, ${!isSelected})"
                        title="${isSelected ? 'Remove from selection' : 'Add to selection'}">
                    ${isSelected ? '❤️' : '🤍'}
                </button>
                <div class="shoe-image-container" style="position: relative; overflow: hidden;">
                    ${hasMultipleImages ? imageCarousel : `
                        <img src="${imageUrl}" alt="${shoe.brand} ${shoe.model}" class="shoe-image" 
                             onerror="this.src='https://via.placeholder.com/400?text=No+Image'">
                    `}
                    ${hasMultipleImages ? `
                        <div class="image-count-badge" style="cursor: pointer;" title="Click to view all ${imageCount} photos">
                            📷 ${imageCount} photos • Click to view all
                        </div>
                    ` : ''}
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

// Detailed Shoe View functionality
let currentDetailShoe = null;
let currentDetailIndex = 0;

window.openShoeDetail = function(shoeId) {
    const shoe = allShoes.find(s => s.id === shoeId);
    if (!shoe) return;
    
    currentDetailShoe = shoe;
    currentDetailIndex = 0;
    showShoeDetail();
    document.getElementById('shoeDetailModal').classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

window.closeShoeDetail = function() {
    document.getElementById('shoeDetailModal').classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
    currentDetailShoe = null;
}

window.changeDetailImage = function(direction) {
    if (!currentDetailShoe || !currentDetailShoe.images || currentDetailShoe.images.length === 0) return;
    
    currentDetailIndex += direction;
    if (currentDetailIndex < 0) {
        currentDetailIndex = currentDetailShoe.images.length - 1;
    } else if (currentDetailIndex >= currentDetailShoe.images.length) {
        currentDetailIndex = 0;
    }
    showShoeDetail();
}

function showShoeDetail() {
    if (!currentDetailShoe) return;
    
    const shoe = currentDetailShoe;
    
    // Set main image
    const image = shoe.images && shoe.images.length > 0 ? shoe.images[currentDetailIndex] : '';
    let imageUrl = '';
    if (image) {
        if (API_BASE) {
            imageUrl = image.startsWith('http') ? image : `/uploads/${image}`;
        } else {
            imageUrl = image.startsWith('http') ? image : `images/${image}`;
        }
    }
    
    document.getElementById('detailMainImage').src = imageUrl;
    
    // Set details
    document.getElementById('detailBrand').textContent = shoe.brand || 'Unknown Brand';
    document.getElementById('detailModel').textContent = shoe.model || 'Unknown Model';
    
    // Price
    const priceEl = document.getElementById('detailPrice');
    priceEl.textContent = `$${shoe.price.toFixed(2)}`;
    const msrpEl = document.getElementById('detailMsrp');
    if (shoe.msrp && shoe.msrp > shoe.price) {
        msrpEl.textContent = `$${shoe.msrp.toFixed(2)}`;
        msrpEl.style.display = 'inline';
    } else {
        msrpEl.style.display = 'none';
    }
    
    // Description
    const descEl = document.getElementById('detailDescription');
    if (shoe.description) {
        descEl.textContent = shoe.description;
        descEl.style.display = 'block';
    } else {
        descEl.style.display = 'none';
    }
    
    // Specs
    document.getElementById('detailSize').textContent = shoe.size || '9';
    document.getElementById('detailCondition').textContent = shoe.condition || 'New';
    document.getElementById('detailGender').textContent = shoe.gender || 'Mens';
    const photoCount = (shoe.images && shoe.images.length) || 0;
    document.getElementById('detailPhotoCount').textContent = `${photoCount} photo${photoCount !== 1 ? 's' : ''}`;
    
    // Thumbnails
    const thumbnailsEl = document.getElementById('detailThumbnails');
    if (shoe.images && shoe.images.length > 1) {
        thumbnailsEl.innerHTML = shoe.images.map((img, idx) => {
            let thumbUrl;
            if (API_BASE) {
                thumbUrl = img.startsWith('http') ? img : `/uploads/${img}`;
            } else {
                thumbUrl = img.startsWith('http') ? img : `images/${img}`;
            }
            return `
                <div class="detail-thumbnail ${idx === currentDetailIndex ? 'active' : ''}" 
                     onclick="changeDetailImage(${idx - currentDetailIndex})">
                    <img src="${thumbUrl}" alt="Thumbnail ${idx + 1}">
                </div>
            `;
        }).join('');
    } else {
        thumbnailsEl.innerHTML = '';
    }
    
    // Heart button
    const isSelected = selectedShoes.has(shoe.id);
    const heartBtn = document.getElementById('detailHeartBtn');
    const heartIcon = document.getElementById('detailHeartIcon');
    const heartText = document.getElementById('detailHeartText');
    
    if (isSelected) {
        heartBtn.classList.add('selected');
        heartIcon.textContent = '❤️';
        heartText.textContent = 'Remove from Picks';
    } else {
        heartBtn.classList.remove('selected');
        heartIcon.textContent = '🤍';
        heartText.textContent = 'Add to Picks';
    }
}

window.toggleDetailSelection = function() {
    if (!currentDetailShoe) return;
    
    const shoeId = currentDetailShoe.id;
    const isSelected = selectedShoes.has(shoeId);
    
    if (isSelected) {
        selectedShoes.delete(shoeId);
    } else {
        selectedShoes.add(shoeId);
    }
    
    updateSelectionBar();
    showShoeDetail(); // Refresh the detail view
    displayShoes(); // Update the grid
}

window.zoomImage = function() {
    if (!currentDetailShoe || !currentDetailShoe.images) return;
    
    const image = currentDetailShoe.images[currentDetailIndex];
    let imageUrl;
    if (API_BASE) {
        imageUrl = image.startsWith('http') ? image : `/uploads/${image}`;
    } else {
        imageUrl = image.startsWith('http') ? image : `images/${image}`;
    }
    
    document.getElementById('zoomedImage').src = imageUrl;
    document.getElementById('zoomModal').classList.add('active');
}

window.closeZoom = function() {
    document.getElementById('zoomModal').classList.remove('active');
}

// Carousel functionality
const carouselStates = new Map(); // Track current image index for each shoe

window.changeCarouselImage = function(shoeId, direction) {
    const shoe = allShoes.find(s => s.id === shoeId);
    if (!shoe || !shoe.images || shoe.images.length <= 1) return;
    
    const carousel = document.querySelector(`.image-carousel[data-shoe-id="${shoeId}"]`);
    if (!carousel) {
        console.log('Carousel not found for shoe', shoeId);
        return;
    }
    
    const currentIndex = carouselStates.get(shoeId) || 0;
    let newIndex = currentIndex + direction;
    
    if (newIndex < 0) newIndex = shoe.images.length - 1;
    if (newIndex >= shoe.images.length) newIndex = 0;
    
    carouselStates.set(shoeId, newIndex);
    
    // Hide all images, show the new one
    const images = carousel.querySelectorAll('.carousel-image');
    images.forEach((img, idx) => {
        if (idx === newIndex) {
            img.style.display = 'block';
            img.style.opacity = '1';
        } else {
            img.style.display = 'none';
            img.style.opacity = '0';
        }
    });
    
    // Update dots
    const dots = carousel.querySelectorAll('.carousel-dot');
    dots.forEach((dot, idx) => {
        if (idx === newIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

// Auto-rotate carousels on hover
let carouselIntervals = new Map();

function setupCarouselAutoRotate() {
    document.querySelectorAll('.image-carousel').forEach(carousel => {
        const shoeId = parseInt(carousel.dataset.shoeId);
        const shoe = allShoes.find(s => s.id === shoeId);
        if (!shoe || !shoe.images || shoe.images.length <= 1) return;
        
        // Remove old listeners if any
        const newCarousel = carousel.cloneNode(true);
        carousel.parentNode.replaceChild(newCarousel, carousel);
        
        newCarousel.addEventListener('mouseenter', () => {
            if (carouselIntervals.has(shoeId)) return;
            const interval = setInterval(() => {
                window.changeCarouselImage(shoeId, 1);
            }, 3000); // Change every 3 seconds
            carouselIntervals.set(shoeId, interval);
        });
        
        newCarousel.addEventListener('mouseleave', () => {
            if (carouselIntervals.has(shoeId)) {
                clearInterval(carouselIntervals.get(shoeId));
                carouselIntervals.delete(shoeId);
            }
        });
    });
}

// Override displayShoes to setup carousel after rendering
const originalDisplayShoes = displayShoes;
displayShoes = function() {
    originalDisplayShoes();
    setTimeout(setupCarouselAutoRotate, 100);
};

// Keyboard navigation for detail modal
document.addEventListener('keydown', (e) => {
    const detailModal = document.getElementById('shoeDetailModal');
    const zoomModal = document.getElementById('zoomModal');
    
    if (zoomModal.classList.contains('active')) {
        if (e.key === 'Escape') closeZoom();
        return;
    }
    
    if (detailModal.classList.contains('active')) {
        if (e.key === 'Escape') closeShoeDetail();
        if (e.key === 'ArrowLeft') changeDetailImage(-1);
        if (e.key === 'ArrowRight') changeDetailImage(1);
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

