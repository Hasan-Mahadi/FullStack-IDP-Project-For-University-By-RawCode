/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * CENTRAL SHOPPING CART & CATALOG BROWSER MODULE
 * ====================================================================
 * 
 * Drives catalog listings, filters, local storage shopping cart,
 * and order submissions. Incorporates responsive side drawer views.
 * Adds hero carousel, countdown, and category navigation.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const catalogGrid = document.getElementById('catalogGrid');
    const categoriesGrid = document.getElementById('categoriesGrid');
    const newArrivalsGrid = document.getElementById('newArrivalsGrid');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const priceFilter = document.getElementById('priceFilter');
    const cartToggle = document.getElementById('cartToggle');
    const cartDrawer = document.getElementById('cartDrawer');
    const cartClose = document.getElementById('cartClose');
    const cartItemsContainer = document.getElementById('cartItems');
    const cartTotalValue = document.getElementById('cartTotalValue');
    const cartBadge = document.getElementById('cartBadge');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const alertBox = document.getElementById('alertBox');

    // Cart memory store state
    let cart = [];

    // Category emoji mapping
    const emojiMap = {
        'laptop': '💻',
        'tshirt': '👕',
        'book': '📚',
        'flask': '🧪',
        'pen': '✏️',
        'dumbbell': '💪',
        'home': '🏠',
        'gem': '💎'
    };

    // 1. Session verification & Header UI updates
    function updateHeaderAuth() {
        if (window.updateAuthNav) {
            window.updateAuthNav();
        }
    }

    // 2. Fetch categories and render in UI
    async function loadCategories() {
        if (!categoriesGrid) return;
        try {
            const data = await API.get('/api/categories');
            if (data.success && data.categories) {
                categoriesGrid.innerHTML = '';
                data.categories.forEach(cat => {
                    const emoji = emojiMap[cat.icon] || '📦';
                    const card = document.createElement('a');
                    card.href = `/pages/categories.html?category=${cat.id}`;
                    card.className = 'category-card';
                    card.innerHTML = `
                        <div class="category-icon-wrap">
                            <span>${emoji}</span>
                        </div>
                        <h4 style="font-weight: 700; margin: 0;">${cat.name}</h4>
                        <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">${cat.description}</p>
                    `;
                    categoriesGrid.appendChild(card);
                });
            }
        } catch (error) {
            console.error('>> Failed to load categories:', error);
        }
    }

    // 3. Fetch products and render in UI
    async function loadCatalog() {
        const query = searchInput.value.trim();
        const priceRange = priceFilter.value;
        
        const isFiltering = query !== '' || priceRange !== 'all';

        // If user is searching/filtering, we want to hide promotional sections for clean list search view
        const heroSection = document.getElementById('heroCarousel');
        const categoriesSection = categoriesGrid ? categoriesGrid.closest('section') : null;
        const flashSection = document.getElementById('flashCountdown') ? document.getElementById('flashCountdown').closest('section') : null;
        const newArrivalsSection = newArrivalsGrid ? newArrivalsGrid.closest('section') : null;

        if (isFiltering) {
            if (heroSection) heroSection.style.display = 'none';
            if (categoriesSection) categoriesSection.style.display = 'none';
            if (flashSection) flashSection.style.display = 'none';
            if (newArrivalsSection) newArrivalsSection.style.display = 'none';
            
            let endpoint = `/api/products?q=${encodeURIComponent(query)}`;
            if (priceRange === '0-20') {
                endpoint += '&min_price=0&max_price=20';
            } else if (priceRange === '20-50') {
                endpoint += '&min_price=20&max_price=50';
            } else if (priceRange === '50-above') {
                endpoint += '&min_price=50';
            }

            try {
                catalogGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
                        Filtering products...
                    </div>
                `;
                const data = await API.get(endpoint);
                if (data.success) {
                    renderProductGrid(catalogGrid, data.products);
                }
            } catch (error) {
                catalogGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--danger);">
                        Sync Failed: ${error.message}
                    </div>
                `;
            }
        } else {
            // Restore sections for standard landing page
            if (heroSection) heroSection.style.display = 'block';
            if (categoriesSection) categoriesSection.style.display = 'block';
            if (flashSection) flashSection.style.display = 'flex';
            if (newArrivalsSection) newArrivalsSection.style.display = 'block';

            try {
                catalogGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
                        Catalog synchronizing...
                    </div>
                `;
                const data = await API.get('/api/products/featured');
                if (data.success) {
                    renderProductGrid(catalogGrid, data.featured || []);
                    if (newArrivalsGrid && data.newest) {
                        renderProductGrid(newArrivalsGrid, data.newest);
                    }
                }
            } catch (error) {
                catalogGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--danger);">
                        Sync Failed: ${error.message}
                    </div>
                `;
            }
        }

        // Trigger animations for newly rendered content
        if (window.AppAnimations && window.AppAnimations.observeAll) {
            window.AppAnimations.observeAll();
        }
    }

    function renderProductGrid(container, products) {
        if (!products || products.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
                    No active campus products found. Try modifying filters.
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        products.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card';
            
            const isOutOfStock = p.stock <= 0;
            const stockDisplay = isOutOfStock 
                ? `<span class="badge badge-danger" style="margin-bottom: 8px;">Out of Stock</span>` 
                : `<span class="badge badge-success" style="margin-bottom: 8px;">${p.stock} In-Stock</span>`;

            const imageHtml = p.image_url 
                ? `<img src="${p.image_url}" alt="${p.name}" class="product-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="product-image-placeholder" style="display: none;">🎓 ${p.name.substring(0,2).toUpperCase()}</div>`
                : `<div class="product-image-placeholder">🎓 ${p.name.substring(0,2).toUpperCase()}</div>`;

            const ratingDisplay = p.avg_rating > 0 
                ? `<span class="star-rating" style="font-size: 0.75rem;">⭐ ${p.avg_rating.toFixed(1)} (${p.review_count})</span>`
                : `<span style="font-size: 0.75rem; color: var(--text-muted);">No reviews yet</span>`;

            card.innerHTML = `
                <div class="product-image-container">
                    ${imageHtml}
                    <span class="product-category-tag">${p.category_name || 'General'}</span>
                </div>
                <div class="product-info-wrap">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        ${stockDisplay}
                        ${ratingDisplay}
                    </div>
                    <a href="/pages/product-details.html?id=${p.id}" class="product-title">${p.name}</a>
                    <p class="product-desc">${p.description || 'No description listed by vendor.'}</p>
                    <div class="product-price-row">
                        <div>
                            <div class="product-price">$${p.price.toFixed(2)}</div>
                            <span class="product-seller">Vendor: ${p.seller_name}</span>
                        </div>
                        <button class="btn btn-primary addToCartBtn" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-stock="${p.stock}" data-image="${p.image_url || ''}" style="font-size: 0.8rem; padding: 8px 12px;" ${isOutOfStock ? 'disabled' : ''}>
                            ${isOutOfStock ? 'Sold Out' : 'Add to Cart'}
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        // Add cart listeners
        container.querySelectorAll('.addToCartBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const pId = Number(btn.getAttribute('data-id'));
                const pName = btn.getAttribute('data-name');
                const pPrice = parseFloat(btn.getAttribute('data-price'));
                const pStock = Number(btn.getAttribute('data-stock'));
                const pImage = btn.getAttribute('data-image');

                addToCart(pId, pName, pPrice, pStock, pImage);
            });
        });
    }

    // 4. Cart State Logic
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
        
        // Dispatch event for other pages / shared headers to update
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
        // Update badge
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartBadge) {
            if (totalItems > 0) {
                cartBadge.innerText = totalItems;
                cartBadge.style.display = 'block';
            } else {
                cartBadge.style.display = 'none';
            }
        }

        // Render drawer items
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

        // Attach controls event listeners
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

    // Drawer Opening/Closing
    function openCartDrawer() {
        if (window.openCartDrawer) window.openCartDrawer();
    }

    function closeCartDrawer() {
        if (window.closeCartDrawer) window.closeCartDrawer();
    }

    // 5. Cart Checkouts Submission
    async function handleCheckout() {
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

        const items = cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity
        }));

        try {
            checkoutBtn.disabled = true;
            checkoutBtn.innerText = 'Submitting...';

            const data = await API.post('/api/orders', { items });

            if (data.success) {
                triggerToast('Order placed successfully! Awaiting Service Team approval.', true);
                
                // Clear cart state
                cart = [];
                saveLocalCart();
                closeCartDrawer();

                // Redirect to customer tracking panel
                setTimeout(() => {
                    window.location.href = '/pages/customer.html';
                }, 1000);
            }
        } catch (error) {
            triggerToast(error.message || 'Checkout failed. Stock holds might have expired.', false);
        } finally {
            checkoutBtn.disabled = false;
            checkoutBtn.innerText = 'Submit Order for Approval';
        }
    }

    // Helper Toast
    function triggerToast(message, isSuccess = true) {
        alertBox.style.display = 'block';
        alertBox.style.background = isSuccess ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)';
        alertBox.style.color = isSuccess ? 'var(--success)' : 'var(--danger)';
        alertBox.style.border = isSuccess ? '1px solid rgba(52, 199, 89, 0.3)' : '1px solid rgba(255, 59, 48, 0.3)';
        alertBox.innerText = message;

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 5000);
    }

    // Carousel Autoplay Logic
    let carouselIndex = 0;
    const track = document.getElementById('carouselTrack');
    const dots = document.querySelectorAll('.carousel-dot');
    let carouselInterval;

    function showSlide(index) {
        if (!track) return;
        const slides = track.querySelectorAll('.carousel-slide');
        if (slides.length === 0) return;
        
        if (index >= slides.length) carouselIndex = 0;
        else if (index < 0) carouselIndex = slides.length - 1;
        else carouselIndex = index;
        
        track.style.transform = `translateX(-${carouselIndex * 25}%)`;
        
        // Update dots
        dots.forEach((dot, idx) => {
            if (idx === carouselIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    function startCarouselAutoplay() {
        carouselInterval = setInterval(() => {
            showSlide(carouselIndex + 1);
        }, 5000);
    }

    function resetCarouselInterval() {
        clearInterval(carouselInterval);
        startCarouselAutoplay();
    }

    // Bind Carousel Actions
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');

    if (prevBtn && nextBtn && track) {
        prevBtn.addEventListener('click', () => {
            showSlide(carouselIndex - 1);
            resetCarouselInterval();
        });

        nextBtn.addEventListener('click', () => {
            showSlide(carouselIndex + 1);
            resetCarouselInterval();
        });

        dots.forEach((dot, idx) => {
            dot.addEventListener('click', () => {
                showSlide(idx);
                resetCarouselInterval();
            });
        });

        startCarouselAutoplay();
    }

    // Flash Countdown Logic
    const targetTime = new Date();
    targetTime.setHours(23, 59, 59, 999); // Tonight midnight

    function updateCountdown() {
        const now = new Date().getTime();
        const diff = targetTime.getTime() - now;

        if (diff <= 0) {
            document.getElementById('countdownHours').innerText = '00';
            document.getElementById('countdownMinutes').innerText = '00';
            document.getElementById('countdownSeconds').innerText = '00';
            return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        document.getElementById('countdownHours').innerText = String(hours).padStart(2, '0');
        document.getElementById('countdownMinutes').innerText = String(minutes).padStart(2, '0');
        document.getElementById('countdownSeconds').innerText = String(seconds).padStart(2, '0');
    }

    if (document.getElementById('flashCountdown')) {
        updateCountdown();
        setInterval(updateCountdown, 1000);
    }

    // 6. Initializers & Listeners Binding
    updateHeaderAuth();
    loadCategories();
    loadCatalog();
    loadLocalCart();

    // Event Bindings
    searchBtn.addEventListener('click', loadCatalog);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadCatalog();
    });
    priceFilter.addEventListener('change', loadCatalog);

    if (cartToggle) cartToggle.addEventListener('click', openCartDrawer);
    if (cartClose) cartClose.addEventListener('click', closeCartDrawer);

    checkoutBtn.addEventListener('click', handleCheckout);
});
