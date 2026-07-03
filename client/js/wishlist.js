/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * WISHLIST CLIENT SIDE ROUTINE CONTROLLER (Vanilla JS)
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // Only customer role ID = 3 is allowed
    if (!Auth.checkPageGuard([3])) return;

    const wishlistGrid = document.getElementById('wishlistGrid');
    const emptyState = document.getElementById('wishlistEmptyState');

    // 1. Fetch wishlist from backend
    async function loadWishlist() {
        try {
            wishlistGrid.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 40px; color: var(--text-muted);">Syncing wishlist...</div>';
            
            const data = await API.get('/api/wishlist');
            if (data.success && data.wishlist) {
                const items = data.wishlist;
                if (items.length === 0) {
                    wishlistGrid.style.display = 'none';
                    emptyState.style.display = 'block';
                } else {
                    wishlistGrid.style.display = 'grid';
                    emptyState.style.display = 'none';
                    renderWishlist(items);
                }
            }
        } catch (error) {
            wishlistGrid.innerHTML = `<div style="grid-column: span 3; text-align: center; padding: 40px; color: var(--danger);">${error.message || 'Failed to load wishlist.'}</div>`;
        }
    }

    // 2. Render wishlist grid items
    function renderWishlist(items) {
        wishlistGrid.innerHTML = '';
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'glass-card product-card';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.justifyContent = 'space-between';
            card.style.position = 'relative';
            
            const inStock = item.stock > 0;
            const starRating = item.avg_rating ? `⭐ ${item.avg_rating}` : 'No reviews';

            card.innerHTML = `
                <!-- Remove item button overlay -->
                <button class="wishlist-heart-btn active" data-product-id="${item.product_id}" style="position: absolute; top: 12px; right: 12px; z-index: 10;" title="Remove from Wishlist">
                    ❤️
                </button>
                
                <div style="cursor: pointer;" onclick="window.location.href='/pages/product-details.html?id=${item.product_id}'">
                    <img src="${item.image_url || '/uploads/products/placeholder.png'}" alt="${item.name}" style="width: 100%; height: 200px; object-fit: cover; border-bottom: 1px solid var(--border-glass); border-radius: var(--radius-md) var(--radius-md) 0 0;">
                    <div style="padding: 20px;">
                        <span class="availability-badge ${inStock ? 'badge-in-stock' : 'badge-out-of-stock'}" style="margin-bottom: 10px;">
                            ${inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                        <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</h3>
                        <p style="color: var(--text-secondary); font-size: 0.8rem; height: 36px; overflow: hidden; margin-bottom: 12px;">${item.description || 'No description provided.'}</p>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--text-secondary);">
                            <span style="font-weight: 800; font-size: 1.15rem; color: var(--text-primary);">$${item.price.toFixed(2)}</span>
                            <span>${starRating}</span>
                        </div>
                    </div>
                </div>
                
                <div style="padding: 0 20px 20px 20px;">
                    <button class="btn btn-primary add-cart-btn" data-product-id="${item.product_id}" data-name="${item.name}" data-price="${item.price}" data-image-url="${item.image_url}" data-stock="${item.stock}" style="width: 100%;" ${inStock ? '' : 'disabled'}>
                        ${inStock ? '🛒 Add to Cart' : 'Out of Stock'}
                    </button>
                </div>
            `;

            // Setup button event listeners
            const heartBtn = card.querySelector('.wishlist-heart-btn');
            heartBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await removeFromWishlist(item.product_id);
            });

            const addCartBtn = card.querySelector('.add-cart-btn');
            if (addCartBtn && inStock) {
                addCartBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    addToCart(item);
                });
            }

            wishlistGrid.appendChild(card);
        });
    }

    // Remove from wishlist API call
    async function removeFromWishlist(productId) {
        try {
            const res = await API.delete('/api/wishlist', { productId });
            if (res.success) {
                triggerToast('Removed from wishlist.', true);
                loadWishlist();
            }
        } catch (error) {
            triggerToast(error.message || 'Failed to remove item.', false);
        }
    }

    // Add to Local Storage Shopping Cart
    function addToCart(item) {
        let cart = [];
        const stored = localStorage.getItem('idp_shopping_cart');
        if (stored) {
            try {
                cart = JSON.parse(stored);
            } catch (e) {
                cart = [];
            }
        }

        const existing = cart.find(x => x.productId === item.product_id);
        if (existing) {
            if (existing.quantity >= item.stock) {
                triggerToast('Cannot add more. Limit of available stock reached.', false);
                return;
            }
            existing.quantity += 1;
        } else {
            cart.push({
                productId: item.product_id,
                name: item.name,
                price: item.price,
                imageUrl: item.image_url,
                stock: item.stock,
                quantity: 1
            });
        }

        localStorage.setItem('idp_shopping_cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cartUpdated'));
        triggerToast(`Added "${item.name}" to cart.`, true);
    }

    // Helper Alert Box Toast
    function triggerToast(message, isSuccess = true) {
        const alertBox = document.getElementById('alertBox');
        alertBox.style.display = 'block';
        alertBox.style.background = isSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        alertBox.style.color = isSuccess ? 'var(--success)' : 'var(--danger)';
        alertBox.style.border = isSuccess ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)';
        alertBox.innerText = message;

        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 4000);
    }

    // Initialize Page
    loadWishlist();
});
