// Get or create session ID
let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
    sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', sessionId);
}

const API_BASE = 'http://localhost:3000/api';

// Get product ID from URL
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

let currentProduct = null;
let currentImageIndex = 0;

// DOM Elements
const loading = document.getElementById('loading');
const productContainer = document.getElementById('productContainer');
const mainImage = document.getElementById('mainImage');
const mainImageContainer = document.querySelector('.main-image-container');
const thumbnailContainer = document.getElementById('thumbnailContainer');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const addToCartBtn = document.getElementById('addToCartBtn');
const cartCount = document.querySelector('.cart-count');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (productId) {
        loadProduct();
        updateCartCount();
    } else {
        loading.innerHTML = '<p>Product not found</p>';
    }
});

// Load product
async function loadProduct() {
    try {
        loading.style.display = 'block';
        productContainer.style.display = 'none';
        
        const response = await fetch(`${API_BASE}/shoes/${productId}`);
        currentProduct = await response.json();
        
        displayProduct();
        
        loading.style.display = 'none';
        productContainer.style.display = 'grid';
    } catch (error) {
        console.error('Error loading product:', error);
        loading.innerHTML = '<p>Error loading product. Please try again later.</p>';
    }
}

// Display product
function displayProduct() {
    if (!currentProduct) return;
    
    // Clear any previous notices
    const existingNotice = mainImageContainer.querySelector('.heic-notice');
    if (existingNotice) existingNotice.remove();
    
    // Set product info
    document.getElementById('productBrand').textContent = currentProduct.brand;
    document.getElementById('productModel').textContent = currentProduct.model;
    document.getElementById('productTitle').textContent = `${currentProduct.brand} ${currentProduct.model}`;
    document.getElementById('productPrice').textContent = currentProduct.price.toFixed(2);
    document.getElementById('productMsrp').textContent = currentProduct.msrp.toFixed(2);
    document.getElementById('productSize').textContent = currentProduct.size;
    document.getElementById('productGender').textContent = currentProduct.gender;
    
    // Display condition with badge styling
    const conditionEl = document.getElementById('productCondition');
    const condition = currentProduct.condition || 'Good';
    conditionEl.textContent = condition;
    conditionEl.className = 'condition-badge condition-' + condition.toLowerCase().replace(/\s+/g, '-');
    document.getElementById('productDescription').textContent = currentProduct.description || 'No description available.';
    
    // Display images
    const images = currentProduct.images || [];
    
    if (images.length > 0) {
        // Find primary image or use first
        const primaryIndex = images.findIndex(img => img.is_primary === 1);
        currentImageIndex = primaryIndex >= 0 ? primaryIndex : 0;
        
        updateMainImage();
        displayThumbnails();
        
        // Show navigation if multiple images
        if (images.length > 1) {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
        } else {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }
    } else {
        mainImage.src = 'https://via.placeholder.com/600?text=No+Image';
        mainImage.onerror = null;
        thumbnailContainer.innerHTML = '';
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    }
}

// Check if file is HEIC
function isHeicFile(filename) {
    return filename.toLowerCase().endsWith('.heic') || filename.toLowerCase().endsWith('.heif');
}

// Update main image
function updateMainImage() {
    if (!currentProduct.images || currentProduct.images.length === 0) return;
    
    const image = currentProduct.images[currentImageIndex];
    const imagePath = image.image_path;
    
    if (isHeicFile(imagePath)) {
        // HEIC files can't be displayed in browsers - show placeholder with conversion message
        mainImage.src = 'https://via.placeholder.com/600/333333/ffffff?text=HEIC+Image';
        mainImage.alt = `${currentProduct.brand} ${currentProduct.model} - Image ${currentImageIndex + 1} (HEIC - needs conversion)`;
        
        // Remove any existing notice
        const existingNotice = mainImageContainer.querySelector('.heic-notice');
        if (existingNotice) existingNotice.remove();
        
        // Add a notice
        const notice = document.createElement('div');
        notice.className = 'heic-notice';
        notice.style.cssText = 'position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 10px 20px; border-radius: 8px; font-size: 14px; z-index: 100;';
        notice.innerHTML = '<i class="fas fa-exclamation-triangle"></i> HEIC format - Convert to JPG/PNG for web display';
        if (mainImageContainer) {
            mainImageContainer.appendChild(notice);
        }
    } else {
        // Remove any existing notice
        const existingNotice = mainImageContainer ? mainImageContainer.querySelector('.heic-notice') : null;
        if (existingNotice) existingNotice.remove();
        
        mainImage.src = `/uploads/${imagePath}`;
        mainImage.alt = `${currentProduct.brand} ${currentProduct.model} - Image ${currentImageIndex + 1}`;
        mainImage.onerror = function() {
            this.src = 'https://via.placeholder.com/600?text=Image+Not+Found';
        };
    }
}

// Display thumbnails
function displayThumbnails() {
    if (!currentProduct.images || currentProduct.images.length === 0) return;
    
    thumbnailContainer.innerHTML = currentProduct.images.map((image, index) => {
        const isActive = index === currentImageIndex ? 'active' : '';
        const imagePath = image.image_path;
        
        if (isHeicFile(imagePath)) {
            // Show placeholder for HEIC files
            return `
                <div class="thumbnail ${isActive}" 
                     onclick="selectImage(${index})"
                     style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #666; font-size: 0.7rem; text-align: center; cursor: pointer;">
                    HEIC<br/>${index + 1}
                </div>
            `;
        } else {
            return `
                <img src="/uploads/${imagePath}" 
                     alt="Thumbnail ${index + 1}" 
                     class="thumbnail ${isActive}"
                     onclick="selectImage(${index})"
                     onerror="this.src='https://via.placeholder.com/80?text=Error'">
            `;
        }
    }).join('');
}

// Select image
function selectImage(index) {
    currentImageIndex = index;
    updateMainImage();
    displayThumbnails();
}

// Make selectImage available globally
window.selectImage = selectImage;

// Navigation
prevBtn.addEventListener('click', () => {
    if (currentProduct.images.length === 0) return;
    currentImageIndex = (currentImageIndex - 1 + currentProduct.images.length) % currentProduct.images.length;
    updateMainImage();
    displayThumbnails();
});

nextBtn.addEventListener('click', () => {
    if (currentProduct.images.length === 0) return;
    currentImageIndex = (currentImageIndex + 1) % currentProduct.images.length;
    updateMainImage();
    displayThumbnails();
});

// Add to cart
addToCartBtn.addEventListener('click', async () => {
    try {
        const response = await fetch(`${API_BASE}/cart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: sessionId,
                shoeId: productId,
                quantity: 1
            })
        });
        
        if (response.ok) {
            addToCartBtn.innerHTML = '<i class="fas fa-check"></i> Added to Cart';
            addToCartBtn.style.background = '#28a745';
            setTimeout(() => {
                addToCartBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Add to Cart';
                addToCartBtn.style.background = '';
            }, 2000);
            updateCartCount();
        } else {
            alert('Error adding to cart. Please try again.');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        alert('Error adding to cart. Please try again.');
    }
});

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

