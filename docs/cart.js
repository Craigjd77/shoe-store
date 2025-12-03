// Get or create session ID
let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
    sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', sessionId);
}

const API_BASE = 'http://localhost:3000/api';

// DOM Elements
const cartItems = document.getElementById('cartItems');
const cartContainer = document.getElementById('cartContainer');
const emptyCart = document.getElementById('emptyCart');
const subtotalEl = document.getElementById('subtotal');
const totalEl = document.getElementById('total');
const checkoutBtn = document.getElementById('checkoutBtn');
const cartCount = document.querySelector('.cart-count');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadCart();
});

// Load cart
async function loadCart() {
    try {
        const response = await fetch(`${API_BASE}/cart/${sessionId}`);
        const items = await response.json();
        
        if (items.length === 0) {
            cartContainer.style.display = 'none';
            emptyCart.style.display = 'block';
        } else {
            cartContainer.style.display = 'grid';
            emptyCart.style.display = 'none';
            displayCartItems(items);
            calculateTotal(items);
        }
        
        updateCartCount();
    } catch (error) {
        console.error('Error loading cart:', error);
    }
}

// Display cart items
function displayCartItems(items) {
    cartItems.innerHTML = items.map(item => {
        const imageUrl = item.image ? `/uploads/${item.image}` : 'https://via.placeholder.com/200?text=No+Image';
        
        return `
            <div class="cart-item" data-item-id="${item.id}">
                <img src="${imageUrl}" alt="${item.brand} ${item.model}" class="cart-item-image"
                     onerror="this.src='https://via.placeholder.com/200?text=No+Image'">
                <div class="cart-item-info">
                    <h3>${item.brand} ${item.model}</h3>
                    <div class="cart-item-details">
                        Size: ${item.size || '9'} • ${item.gender || 'Mens'}
                    </div>
                    <div class="cart-item-price">$${parseFloat(item.price).toFixed(2)}</div>
                </div>
                <div class="cart-item-controls">
                    <div class="quantity-control">
                        <button onclick="updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
                        <input type="number" value="${item.quantity}" min="1" 
                               onchange="updateQuantity(${item.id}, this.value)">
                        <button onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
                    </div>
                    <button class="btn btn-danger btn-small" onclick="removeItem(${item.id})">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Update quantity
async function updateQuantity(itemId, quantity) {
    if (quantity < 1) {
        removeItem(itemId);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/cart/${itemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ quantity: parseInt(quantity) })
        });
        
        if (response.ok) {
            loadCart();
        }
    } catch (error) {
        console.error('Error updating quantity:', error);
    }
}

// Make updateQuantity available globally
window.updateQuantity = updateQuantity;

// Remove item
async function removeItem(itemId) {
    if (!confirm('Remove this item from cart?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/cart/${sessionId}/${itemId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadCart();
        }
    } catch (error) {
        console.error('Error removing item:', error);
    }
}

// Make removeItem available globally
window.removeItem = removeItem;

// Calculate total
function calculateTotal(items) {
    const subtotal = items.reduce((sum, item) => {
        return sum + (parseFloat(item.price) * item.quantity);
    }, 0);
    
    subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    totalEl.textContent = `$${subtotal.toFixed(2)}`;
}

// Checkout
checkoutBtn.addEventListener('click', () => {
    alert('Checkout functionality would be integrated with a payment processor (Stripe, PayPal, etc.)');
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

