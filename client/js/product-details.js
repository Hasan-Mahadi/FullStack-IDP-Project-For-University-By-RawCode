/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE PRODUCT DETAILS CONTROLLER
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // Parse Product ID
    const urlParams = new URLSearchParams(window.location.search);
    const productId = Number(urlParams.get('id'));

    if (!productId) {
        window.location.href = '/';
        return;
    }

    // DOM Elements
    const detailImagePanel = document.getElementById('detailImagePanel');
    const productCategory = document.getElementById('productCategory');
    const productStock = document.getElementById('productStock');
    const productName = document.getElementById('productName');
    const productRatingStars = document.getElementById('productRatingStars');
    const productRatingText = document.getElementById('productRatingText');
    const productPrice = document.getElementById('productPrice');
    const productDescription = document.getElementById('productDescription');
    const productSeller = document.getElementById('productSeller');
    const productCreated = document.getElementById('productCreated');
    const addToCartBtn = document.getElementById('addToCartBtn');
    const detailsWishlistBtn = document.getElementById('detailsWishlistBtn');
    
    const reviewsList = document.getElementById('reviewsList');
    const submitReviewCard = document.getElementById('submitReviewCard');
    const submitReviewPrompt = document.getElementById('submitReviewPrompt');
    const reviewForm = document.getElementById('reviewForm');
    const ratingPicker = document.getElementById('ratingPicker');
    const reviewRatingVal = document.getElementById('reviewRatingVal');
    const reviewText = document.getElementById('reviewText');
    const alertBox = document.getElementById('alertBox');
    
    const relatedProductsGrid = document.getElementById('relatedProductsGrid');
    
    // Cart elements
    const cartDrawer = document.getElementById('cartDrawer');
    const cartClose = document.getElementById('cartClose');
    const cartItemsContainer = document.getElementById('cartItems');
    const cartTotalValue = document.getElementById('cartTotalValue');
    const checkoutBtn = document.getElementById('checkoutBtn');

    let currentProduct = null;
    let cart = [];

    // Initialize Page
    init();

    async function init() {
        // Enforce Login Guard for Product Details
        const user = Auth.getUser();
        if (!user) {
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/pages/login.html?redirect=${returnUrl}`;
            return;
        }

        // Render auth blocks
        if (Number(user.roleId) === 3) {
            submitReviewCard.style.display = 'block';
            submitReviewPrompt.style.display = 'none';
            if (detailsWishlistBtn) {
                detailsWishlistBtn.style.display = 'flex';
                checkWishlistStatus();
                detailsWishlistBtn.addEventListener('click', toggleWishlist);
            }
            trackRecentlyViewedProduct();
        } else {
            submitReviewCard.style.display = 'none';
            submitReviewPrompt.style.display = 'block';
            if (detailsWishlistBtn) detailsWishlistBtn.style.display = 'none';
        }

        // Fetch details
        await loadProductDetails();
        await loadReviews();
        loadLocalCart();

        // Bind Star Picker
        if (ratingPicker) {
            const stars = ratingPicker.querySelectorAll('.star-btn');
            stars.forEach(star => {
                star.addEventListener('click', () => {
                    const val = Number(star.getAttribute('data-value'));
                    reviewRatingVal.value = val;
                    updateStarPicker(val);
                });
            });
        }

        // Bind Review Form
        if (reviewForm) {
            reviewForm.addEventListener('submit', handleReviewSubmit);
        }

        // Bind Cart Controls
        if (cartClose) cartClose.addEventListener('click', closeCartDrawer);
        if (checkoutBtn) checkoutBtn.addEventListener('click', handleCheckout);
    }

    async function loadProductDetails() {
        try {
            const data = await API.get(`/api/products/details?id=${productId}`);
            if (data.success && data.product) {
                currentProduct = data.product;
                
                // Render text
                productName.innerText = currentProduct.name;
                productDescription.innerText = currentProduct.description || 'No description listed by vendor.';
                productPrice.innerText = `$${currentProduct.price.toFixed(2)}`;
                if (currentProduct.seller_name && currentProduct.seller_name !== 'System Administrator') {
                    productSeller.innerText = currentProduct.seller_name;
                    productSeller.parentElement.style.display = 'inline';
                } else {
                    productSeller.parentElement.style.display = 'none';
                }
                productCategory.innerText = currentProduct.category_name || 'General';
                
                // Date formatting
                if (currentProduct.created_at) {
                    const date = new Date(currentProduct.created_at);
                    productCreated.innerText = `Listed on: ${date.toLocaleDateString()}`;
                }

                // Render Stock
                const isOutOfStock = currentProduct.stock <= 0;
                if (isOutOfStock) {
                    productStock.innerHTML = `<span class="badge badge-danger">Out of Stock</span>`;
                    addToCartBtn.disabled = true;
                    addToCartBtn.innerText = 'Sold Out';
                } else {
                    productStock.innerHTML = `<span class="badge badge-success">${currentProduct.stock} In-Stock</span>`;
                    addToCartBtn.disabled = false;
                    addToCartBtn.innerText = 'Add to Lab Cart';
                }

                // Image display
                if (currentProduct.image_url) {
                    detailImagePanel.innerHTML = `
                        <img src="${currentProduct.image_url}" alt="${currentProduct.name}" class="detail-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="product-image-placeholder" style="display: none; font-size: 3rem;">🎓</div>
                    `;
                } else {
                    detailImagePanel.innerHTML = `<div class="product-image-placeholder" style="font-size: 3rem;">🎓</div>`;
                }

                // Rating
                renderRatingSummary(currentProduct.avg_rating, currentProduct.review_count);

                // Load Related
                if (currentProduct.category_id) {
                    loadRelatedProducts(currentProduct.category_id);
                }

                // Bind Main Add to Cart
                addToCartBtn.onclick = () => {
                    addToCart(currentProduct.id, currentProduct.name, currentProduct.price, currentProduct.stock, currentProduct.image_url);
                };

            } else {
                window.location.href = '/';
            }
        } catch (error) {
            triggerToast(error.message || 'Failed to sync product data.', false);
        }
    }

    function renderRatingSummary(avgRating, reviewCount) {
        productRatingText.innerText = reviewCount > 0 
            ? `(${avgRating.toFixed(1)} average rating out of ${reviewCount} reviews)`
            : 'No reviews registered for this product yet.';
            
        let starsHtml = '';
        const rounded = Math.round(avgRating);
        for (let i = 1; i <= 5; i++) {
            if (i <= rounded) starsHtml += '★';
            else starsHtml += '☆';
        }
        productRatingStars.innerHTML = starsHtml;
    }

    async function loadReviews() {
        try {
            const data = await API.get(`/api/reviews?productId=${productId}`);
            if (data.success && data.reviews) {
                if (data.reviews.length === 0) {
                    reviewsList.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                            No reviews found for this product yet.
                        </div>
                    `;
                    return;
                }

                reviewsList.innerHTML = '';
                data.reviews.forEach(rev => {
                    const date = new Date(rev.created_at).toLocaleDateString();
                    let stars = '';
                    for (let i = 1; i <= 5; i++) {
                        stars += i <= rev.rating ? '★' : '☆';
                    }

                    const div = document.createElement('div');
                    div.className = 'review-item';
                    div.innerHTML = `
                        <div class="review-header">
                            <div>
                                <strong style="font-size: 0.9rem; color: var(--text-primary);">${rev.customer_name}</strong>
                                <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 8px;">(${date})</span>
                            </div>
                            <span class="star-rating" style="font-size: 0.85rem;">${stars}</span>
                        </div>
                        <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4; margin: 4px 0 0 0;">${rev.review_text}</p>
                    `;
                    reviewsList.appendChild(div);
                });
            }
        } catch (error) {
            console.error('Failed to load reviews:', error);
        }
    }

    async function loadRelatedProducts(categoryId) {
        try {
            const data = await API.get(`/api/products?category_id=${categoryId}`);
            if (data.success && data.products) {
                // Filter out current product
                const filtered = data.products.filter(p => p.id !== productId).slice(0, 4);
                
                if (filtered.length === 0) {
                    relatedProductsGrid.innerHTML = `
                        <div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--text-muted);">
                            No related items in this category.
                        </div>
                    `;
                    return;
                }

                relatedProductsGrid.innerHTML = '';
                filtered.forEach(p => {
                    const card = document.createElement('div');
                    card.className = 'product-card';
                    const isOutOfStock = p.stock <= 0;
                    
                    const imgHtml = p.image_url 
                        ? `<img src="${p.image_url}" alt="${p.name}" class="product-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                           <div class="product-image-placeholder" style="display: none;">🎓</div>`
                        : `<div class="product-image-placeholder">🎓</div>`;

                    card.innerHTML = `
                        <div class="product-image-container">
                            ${imgHtml}
                            <span class="product-category-tag">${p.category_name || 'General'}</span>
                        </div>
                        <div class="product-info-wrap">
                            <a href="/pages/product-details.html?id=${p.id}" class="product-title">${p.name}</a>
                            <p class="product-desc">${p.description || ''}</p>
                            <div class="product-price-row">
                                <div>
                                    <div class="product-price">$${p.price.toFixed(2)}</div>
                                </div>
                                <button class="btn btn-primary addToCartBtn" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-stock="${p.stock}" data-image="${p.image_url || ''}" style="font-size: 0.75rem; padding: 6px 10px;" ${isOutOfStock ? 'disabled' : ''}>
                                    + Add
                                </button>
                            </div>
                        </div>
                    `;
                    relatedProductsGrid.appendChild(card);
                });

                // Attach click listeners
                relatedProductsGrid.querySelectorAll('.addToCartBtn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const id = Number(btn.getAttribute('data-id'));
                        const name = btn.getAttribute('data-name');
                        const price = parseFloat(btn.getAttribute('data-price'));
                        const stock = Number(btn.getAttribute('data-stock'));
                        const image = btn.getAttribute('data-image');
                        addToCart(id, name, price, stock, image);
                    });
                });
            }
        } catch (error) {
            console.error('Failed to load related products:', error);
        }
    }

    function updateStarPicker(rating) {
        const stars = ratingPicker.querySelectorAll('.star-btn');
        stars.forEach((star, idx) => {
            if (idx < rating) {
                star.innerText = '★';
                star.classList.add('star-rating');
            } else {
                star.innerText = '☆';
                star.classList.remove('star-rating');
            }
        });
    }

    async function handleReviewSubmit(e) {
        e.preventDefault();
        const rating = Number(reviewRatingVal.value);
        const text = reviewText.value.trim();

        if (rating === 0) {
            triggerToast('Please select a star rating first.', false);
            return;
        }

        try {
            const btn = document.getElementById('submitReviewBtn');
            btn.disabled = true;
            btn.innerText = 'Submitting...';

            const data = await API.post('/api/reviews', {
                productId,
                rating,
                reviewText: text
            });

            if (data.success) {
                triggerToast('Review submitted successfully!', true);
                
                // Clear Form
                reviewText.value = '';
                reviewRatingVal.value = '0';
                updateStarPicker(0);

                // Reload reviews and rating averages
                await loadReviews();
                await loadProductDetails();
            }
        } catch (error) {
            triggerToast(error.message || 'Failed to submit review.', false);
        } finally {
            const btn = document.getElementById('submitReviewBtn');
            btn.disabled = false;
            btn.innerText = 'Submit Review';
        }
    }

    // Cart Helper functions
    function loadLocalCart() {
        const stored = localStorage.getItem('idp_shopping_cart');
        if (stored) {
            try {
                cart = JSON.parse(stored);
            } catch (e) {
                cart = [];
            }
        }
        updateCartUI();
    }

    function saveLocalCart() {
        localStorage.setItem('idp_shopping_cart', JSON.stringify(cart));
        updateCartUI();
    }

    function addToCart(id, name, price, stock, image_url = '') {
        const existing = cart.find(item => item.productId === id);
        
        if (existing) {
            if (existing.quantity >= stock) {
                triggerToast(`Cannot add more. Vendor stock holds maximum of ${stock} items.`, false);
                return;
            }
            existing.quantity++;
        } else {
            cart.push({
                productId: id,
                name,
                price,
                stock,
                image_url,
                quantity: 1
            });
        }

        saveLocalCart();
        triggerToast(`Added "${name}" to cart.`, true);
        window.dispatchEvent(new Event('cartUpdated'));
    }

    function changeCartQty(id, delta) {
        const item = cart.find(item => item.productId === id);
        if (!item) return;

        item.quantity += delta;

        if (item.quantity <= 0) {
            cart = cart.filter(i => i.productId !== id);
        } else if (item.quantity > item.stock) {
            item.quantity = item.stock;
            triggerToast(`Maximum stock limit of ${item.stock} reached.`, false);
        }

        saveLocalCart();
        window.dispatchEvent(new Event('cartUpdated'));
    }

    function updateCartUI() {
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = `
                <div style="text-align: center; padding: 50px 0; color: var(--text-muted);">
                    Your cart is empty.
                </div>
            `;
            cartTotalValue.innerText = '$0.00';
            return;
        }

        cartItemsContainer.innerHTML = '';
        let totalSum = 0;

        cart.forEach(item => {
            const itemCost = item.price * item.quantity;
            totalSum += itemCost;

            const div = document.createElement('div');
            div.className = 'cart-item';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '12px';

            const imgHtml = item.image_url
                ? `<img src="${item.image_url}" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover; border: 1px solid var(--border-glass);" onerror="this.src='/uploads/placeholder.png';">`
                : `<div style="width: 44px; height: 44px; border-radius: 6px; background: #111827; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; border: 1px solid var(--border-glass);">📦</div>`;

            div.innerHTML = `
                ${imgHtml}
                <div class="cart-item-info" style="flex-grow: 1;">
                    <div class="cart-item-name" title="${item.name}">${item.name}</div>
                    <div class="cart-item-price">$${item.price.toFixed(2)} x ${item.quantity}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="cart-item-qty-btn qty-minus" data-id="${item.productId}">-</button>
                    <span style="font-size: 0.85rem; font-weight: 600; width: 16px; text-align: center; display: inline-block;">${item.quantity}</span>
                    <button class="cart-item-qty-btn qty-plus" data-id="${item.productId}">+</button>
                </div>
            `;
            cartItemsContainer.appendChild(div);
        });

        cartTotalValue.innerText = `$${totalSum.toFixed(2)}`;

        // Controls
        cartItemsContainer.querySelectorAll('.qty-minus').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.getAttribute('data-id'));
                changeCartQty(id, -1);
            });
        });

        cartItemsContainer.querySelectorAll('.qty-plus').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.getAttribute('data-id'));
                changeCartQty(id, 1);
            });
        });
    }

    function openCartDrawer() {
        if (window.openCartDrawer) window.openCartDrawer();
    }

    function closeCartDrawer() {
        if (window.closeCartDrawer) window.closeCartDrawer();
    }

    function handleCheckout() {
        const user = Auth.getUser();
        if (!user) {
            triggerToast('Session required. Redirecting to Login...', false);
            setTimeout(() => {
                window.location.href = '/pages/login.html';
            }, 1000);
            return;
        }

        if (Number(user.roleId) !== 3) {
            triggerToast('Access Restricted: Only Student Customers are authorized to place orders.', false);
            return;
        }

        if (cart.length === 0) {
            triggerToast('Your shopping cart is empty.', false);
            return;
        }

        closeCartDrawer();
        window.location.href = '/pages/checkout.html';
    }

    async function checkWishlistStatus() {
        try {
            const data = await API.get(`/api/wishlist/check?productId=${productId}`);
            if (data.success && data.inWishlist) {
                detailsWishlistBtn.classList.add('active');
                detailsWishlistBtn.innerText = '❤️';
            } else {
                detailsWishlistBtn.classList.remove('active');
                detailsWishlistBtn.innerText = '🤍';
            }
        } catch (e) {
            console.error('Failed to check wishlist status:', e);
        }
    }

    async function toggleWishlist() {
        const isActive = detailsWishlistBtn.classList.contains('active');
        try {
            if (isActive) {
                const res = await API.delete('/api/wishlist', { productId });
                if (res.success) {
                    detailsWishlistBtn.classList.remove('active');
                    detailsWishlistBtn.innerText = '🤍';
                    triggerToast('Removed from wishlist.', true);
                }
            } else {
                const res = await API.post('/api/wishlist', { productId });
                if (res.success) {
                    detailsWishlistBtn.classList.add('active');
                    detailsWishlistBtn.innerText = '❤️';
                    triggerToast('Added to wishlist.', true);
                }
            }
        } catch (error) {
            triggerToast(error.message || 'Wishlist action failed.', false);
        }
    }

    async function trackRecentlyViewedProduct() {
        try {
            await API.post('/api/products/viewed', { productId });
        } catch (e) {
            console.error('Failed to track recently viewed:', e);
        }
    }

    function triggerToast(message, isSuccess = true) {
        alertBox.style.display = 'block';
        alertBox.style.background = isSuccess ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)';
        alertBox.style.color = isSuccess ? 'var(--success)' : 'var(--danger)';
        alertBox.style.border = isSuccess ? '1px solid rgba(52, 199, 89, 0.3)' : '1px solid rgba(255, 59, 48, 0.3)';
        alertBox.innerText = message;
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 5000);
    }
});
