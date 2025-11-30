// Get or create session ID
let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
    sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', sessionId);
}

// API base URL
const API_BASE = 'http://localhost:3000/api';

// State
let allShoes = [];
let filteredShoes = [];

// DOM Elements
const shoesGrid = document.getElementById('shoesGrid');
const searchInput = document.getElementById('searchInput');
const brandFilter = document.getElementById('brandFilter');
const sortSelect = document.getElementById('sortSelect');
const loading = document.getElementById('loading');
const noResults = document.getElementById('noResults');
const cartCount = document.querySelector('.cart-count');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadBrands();
    loadShoes();
    updateCartCount();
    
    // Event listeners
    searchInput.addEventListener('input', handleFilter);
    brandFilter.addEventListener('change', handleFilter);
    sortSelect.addEventListener('change', handleFilter);
});

// Load brands
async function loadBrands() {
    try {
        const response = await fetch(`${API_BASE}/brands`);
        const brands = await response.json();
        
        brands.forEach(brand => {
            const option = document.createElement('option');
            option.value = brand;
            option.textContent = brand;
            brandFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading brands:', error);
    }
}

// Load shoes
async function loadShoes() {
    try {
        loading.style.display = 'block';
        shoesGrid.style.display = 'none';
        noResults.style.display = 'none';
        
        const response = await fetch(`${API_BASE}/shoes`);
        allShoes = await response.json();
        
        filteredShoes = [...allShoes];
        displayShoes();
        
        loading.style.display = 'none';
        shoesGrid.style.display = 'grid';
    } catch (error) {
        console.error('Error loading shoes:', error);
        loading.innerHTML = '<p>Error loading shoes. Please try again later.</p>';
    }
}

// Filter and sort shoes
function handleFilter() {
    const searchTerm = searchInput.value.toLowerCase();
    const brand = brandFilter.value;
    const [sortField, sortOrder] = sortSelect.value.split(' ');
    
    filteredShoes = allShoes.filter(shoe => {
        const matchesSearch = !searchTerm || 
            shoe.brand.toLowerCase().includes(searchTerm) ||
            shoe.model.toLowerCase().includes(searchTerm) ||
            (shoe.description && shoe.description.toLowerCase().includes(searchTerm));
        
        const matchesBrand = !brand || shoe.brand === brand;
        
        return matchesSearch && matchesBrand;
    });
    
    // Sort
    filteredShoes.sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];
        
        if (sortField === 'price' || sortField === 'msrp') {
            aVal = parseFloat(aVal);
            bVal = parseFloat(bVal);
        }
        
        if (sortOrder === 'ASC') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
    
    displayShoes();
}

// Check if file is HEIC
function isHeicFile(filename) {
    return filename && (filename.toLowerCase().endsWith('.heic') || filename.toLowerCase().endsWith('.heif'));
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
        
        let imageUrl, imageAlt;
        if (!image) {
            imageUrl = 'https://via.placeholder.com/400?text=No+Image';
            imageAlt = 'No image';
        } else if (isHeicFile(image)) {
            imageUrl = 'https://via.placeholder.com/400/333333/ffffff?text=HEIC+Image';
            imageAlt = `${shoe.brand} ${shoe.model} (HEIC)`;
        } else {
            imageUrl = `/uploads/${image}`;
            imageAlt = `${shoe.brand} ${shoe.model}`;
        }
        
        return `
            <a href="product.html?id=${shoe.id}" class="shoe-card">
                <div class="shoe-image-container">
                    <img src="${imageUrl}" alt="${imageAlt}" class="shoe-image" 
                         onerror="this.src='https://via.placeholder.com/400?text=No+Image'">
                    ${isHeicFile(image) ? '<div style="position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px;">HEIC</div>' : ''}
                </div>
                <div class="shoe-info">
                    <div class="shoe-brand">${shoe.brand}</div>
                    <div class="shoe-model">${shoe.model}</div>
                    <div class="shoe-price">
                        <span class="price-current">$${shoe.price.toFixed(2)}</span>
                        <span class="price-msrp">$${shoe.msrp.toFixed(2)}</span>
                    </div>
                </div>
            </a>
        `;
    }).join('');
}

// Update cart count
async function updateCartCount() {
    try {
        const response = await fetch(`${API_BASE}/cart/${sessionId}`);
        const items = await response.json();
        const count = items.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = count;
    } catch (error) {
        console.error('Error updating cart count:', error);
    }
}

