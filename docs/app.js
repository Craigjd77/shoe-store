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
            imageUrl = image.startsWith('http') ? image : `uploads/${image}`;
        }
        
        const isSelected = selectedShoes.has(shoe.id);
        
        return `
            <div class="shoe-card">
                <input type="checkbox" class="shoe-checkbox" 
                       data-shoe-id="${shoe.id}"
                       ${isSelected ? 'checked' : ''}
                       onchange="toggleSelection(${shoe.id}, this.checked)">
                <div class="shoe-image-container">
                    <img src="${imageUrl}" alt="${shoe.brand} ${shoe.model}" class="shoe-image" 
                         onerror="this.src='https://via.placeholder.com/400?text=No+Image'">
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
                        Condition: ${shoe.condition || 'New'}
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
    selectionCount.textContent = `${count} selected`;
    
    if (count > 0) {
        selectionBar.classList.add('active');
    } else {
        selectionBar.classList.remove('active');
    }
}

// Clear selection
function clearSelection() {
    selectedShoes.clear();
    document.querySelectorAll('.shoe-checkbox').forEach(cb => cb.checked = false);
    updateSelectionBar();
    displayShoes();
}

// Show summary
function showSummary() {
    if (selectedShoes.size === 0) {
        alert('Please select at least one shoe');
        return;
    }
    
    const selected = allShoes.filter(shoe => selectedShoes.has(shoe.id));
    const totalValue = selected.reduce((sum, shoe) => sum + parseFloat(shoe.price), 0);
    
    let summaryHTML = `
        <p><strong>Total Selected: ${selected.length} shoes</strong></p>
        <p><strong>Total Value: $${totalValue.toFixed(2)}</strong></p>
        <hr style="margin: 20px 0;">
    `;
    
    selected.forEach(shoe => {
        summaryHTML += `
            <div class="summary-item">
                <strong>${shoe.brand} ${shoe.model}</strong><br>
                Price: $${shoe.price.toFixed(2)}${shoe.msrp && shoe.msrp > shoe.price ? ` (MSRP: $${shoe.msrp.toFixed(2)})` : ''}<br>
                ${shoe.description ? `Description: ${shoe.description}<br>` : ''}
                Condition: ${shoe.condition || 'New'}<br>
                ${shoe.images && shoe.images.length > 0 ? `Images: ${shoe.images.length} photo(s)` : ''}
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
    let text = `SHOE SELECTION SUMMARY\n`;
    text += `====================\n\n`;
    text += `Total Selected: ${selected.length} shoes\n`;
    text += `Total Value: $${totalValue.toFixed(2)}\n\n`;
    text += `SELECTED SHOES:\n`;
    text += `---------------\n\n`;
    
    selected.forEach((shoe, index) => {
        text += `${index + 1}. ${shoe.brand} ${shoe.model}\n`;
        text += `   Price: $${shoe.price.toFixed(2)}`;
        if (shoe.msrp && shoe.msrp > shoe.price) {
            text += ` (MSRP: $${shoe.msrp.toFixed(2)})`;
        }
        text += `\n`;
        if (shoe.description) {
            text += `   Description: ${shoe.description}\n`;
        }
        text += `   Condition: ${shoe.condition || 'New'}\n`;
        if (shoe.images && shoe.images.length > 0) {
            text += `   Images: ${shoe.images.length} photo(s)\n`;
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

