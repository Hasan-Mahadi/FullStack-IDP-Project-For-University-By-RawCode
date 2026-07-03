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
    const productFeedGrid = document.getElementById('productFeedGrid');
    const topRatedGrid = document.getElementById('topRatedGrid');
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
    let wishlistIds = new Set();

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
    let catalogProducts = [];
    let currentPage = 1;
    const itemsPerPage = 8;

    async function loadCatalog() {
        const query = searchInput.value.trim();
        const priceRange = priceFilter.value;
        
        const isFiltering = query !== '' || priceRange !== 'all';

        // If user is searching/filtering, we want to hide promotional sections for clean list search view
        const heroSection = document.getElementById('heroCarousel');
        const categoriesSection = categoriesGrid ? categoriesGrid.closest('section') : null;
        const flashSection = document.getElementById('flashCountdown') ? document.getElementById('flashCountdown').closest('section') : null;
        const newArrivalsSection = newArrivalsGrid ? newArrivalsGrid.closest('section') : null;
        const trendingSection = document.getElementById('productFeedSection');
        const topRatedSection = document.getElementById('topRatedSection');

        if (isFiltering) {
            if (heroSection) heroSection.style.display = 'none';
            if (categoriesSection) categoriesSection.style.display = 'none';
            if (flashSection) flashSection.style.display = 'none';
            if (newArrivalsSection) newArrivalsSection.style.display = 'none';
            if (trendingSection) trendingSection.style.display = 'none';
            if (topRatedSection) topRatedSection.style.display = 'none';
            
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
                    catalogProducts = data.products || [];
                    currentPage = 1;
                    applyCatalogSortAndRender();
                }
            } catch (error) {
                catalogGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--danger);">
                        Sync Failed: ${error.message}
                    </div>
                `;
                const paginationContainer = document.getElementById('catalogPagination');
                if (paginationContainer) paginationContainer.innerHTML = '';
            }
        } else {
            // Restore sections for standard landing page
            if (heroSection) heroSection.style.display = 'block';
            if (categoriesSection) categoriesSection.style.display = 'block';
            if (flashSection) flashSection.style.display = 'flex';
            if (newArrivalsSection) newArrivalsSection.style.display = 'block';
            if (trendingSection) trendingSection.style.display = 'block';
            if (topRatedSection) topRatedSection.style.display = 'block';

            try {
                catalogGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
                        Catalog synchronizing...
                    </div>
                `;
                const data = await API.get('/api/products/featured');
                if (data.success) {
                    if (productFeedGrid && data.featured) {
                        renderProductGrid(productFeedGrid, data.featured || []);
                        const skeleton = document.getElementById('feedSkeletonLoader');
                        if (skeleton) skeleton.style.display = 'none';
                        const seeMore = document.getElementById('feedSeeMoreWrap');
                        if (seeMore && data.featured.length > 0) seeMore.style.display = 'block';
                    }
                    catalogProducts = data.featured || [];
                    currentPage = 1;
                    applyCatalogSortAndRender();
                    
                    if (newArrivalsGrid && data.newest) {
                        renderProductGrid(newArrivalsGrid, data.newest);
                    }
                    if (topRatedGrid && data.topRated) {
                        renderProductGrid(topRatedGrid, data.topRated);
                    }
                }
            } catch (error) {
                catalogGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--danger);">
                        Sync Failed: ${error.message}
                    </div>
                `;
                const paginationContainer = document.getElementById('catalogPagination');
                if (paginationContainer) paginationContainer.innerHTML = '';
            }
        }
    }

    function applyCatalogSortAndRender() {
        const sortFilter = document.getElementById('sortFilter');
        const sortVal = sortFilter ? sortFilter.value : 'default';

        // 1. Sort
        const sorted = [...catalogProducts];
        if (sortVal === 'price-low-high') {
            sorted.sort((a, b) => a.price - b.price);
        } else if (sortVal === 'price-high-low') {
            sorted.sort((a, b) => b.price - a.price);
        } else if (sortVal === 'newest') {
            sorted.sort((a, b) => new Date(b.created_at || b.id) - new Date(a.created_at || a.id));
        }

        // 2. Paginate
        const totalItems = sorted.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        
        // Safe bounds
        if (currentPage > totalPages) currentPage = Math.max(1, totalPages);
        
        const start = (currentPage - 1) * itemsPerPage;
        const pageProducts = sorted.slice(start, start + itemsPerPage);

        renderProductGrid(catalogGrid, pageProducts);
        renderPaginationControls(totalPages);

        // Trigger animations for newly rendered content
        if (window.AppAnimations && window.AppAnimations.observeAll) {
            window.AppAnimations.observeAll();
        }
    }

    function renderPaginationControls(totalPages) {
        const paginationContainer = document.getElementById('catalogPagination');
        if (!paginationContainer) return;

        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        paginationContainer.innerHTML = '';

        // Prev Button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn btn-secondary btn-sm';
        prevBtn.style.padding = '6px 12px';
        prevBtn.innerText = 'Prev';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                applyCatalogSortAndRender();
                catalogGrid.scrollIntoView({ behavior: 'smooth' });
            }
        });
        paginationContainer.appendChild(prevBtn);

        // Page Numbers
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-secondary'}`;
            pageBtn.style.padding = '6px 12px';
            pageBtn.innerText = i;
            pageBtn.addEventListener('click', () => {
                currentPage = i;
                applyCatalogSortAndRender();
                catalogGrid.scrollIntoView({ behavior: 'smooth' });
            });
            paginationContainer.appendChild(pageBtn);
        }

        // Next Button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-secondary btn-sm';
        nextBtn.style.padding = '6px 12px';
        nextBtn.innerText = 'Next';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                applyCatalogSortAndRender();
                catalogGrid.scrollIntoView({ behavior: 'smooth' });
            }
        });
        paginationContainer.appendChild(nextBtn);
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
                ? `<span class="star-rating" style="font-size: 0.75rem;">⭐ ${Number(p.avg_rating).toFixed(1)} (${p.review_count})</span>`
                : `<span style="font-size: 0.75rem; color: var(--text-muted);">No reviews yet</span>`;

            const isWishlisted = wishlistIds.has(p.id);
            const user = Auth.getUser();
            const isCustomer = user && Number(user.roleId) === 3;
            const heartHtml = isCustomer
                ? `<button class="wishlist-heart-btn ${isWishlisted ? 'active' : ''}" data-id="${p.id}" style="position: absolute; top: 12px; right: 12px; z-index: 10; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-glass); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" title="Save to Wishlist">
                       ${isWishlisted ? '❤️' : '🤍'}
                   </button>`
                : '';

            card.innerHTML = `
                <div class="product-image-container" style="position: relative;">
                    ${imageHtml}
                    <span class="product-category-tag">${p.category_name || 'General'}</span>
                    ${heartHtml}
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
                            ${(p.seller_name && p.seller_name !== 'System Administrator') ? `<span class="product-seller">Vendor: ${p.seller_name}</span>` : ''}
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

        // Add wishlist heart listeners
        container.querySelectorAll('.wishlist-heart-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const id = Number(btn.getAttribute('data-id'));
                await toggleWishlist(id, btn);
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

    // 5. Cart Checkouts Redirect to Secure Checkout Page
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

    // Helper Toast
    function triggerToast(message, isSuccess = true) {
        if (isSuccess) {
            Toast.success(message);
        } else {
            Toast.error(message);
        }
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

    async function loadWishlist() {
        const user = Auth.getUser();
        if (!user || Number(user.roleId) !== 3) return;
        try {
            const data = await API.get('/api/wishlist');
            if (data.success && data.wishlist) {
                wishlistIds = new Set(data.wishlist.map(item => item.product_id));
            }
        } catch (e) {
            console.error('Failed to load wishlist:', e);
        }
    }

    async function toggleWishlist(id, btn) {
        const isActive = btn.classList.contains('active');
        try {
            if (isActive) {
                const res = await API.delete('/api/wishlist', { productId: id });
                if (res.success) {
                    btn.classList.remove('active');
                    btn.innerText = '🤍';
                    wishlistIds.delete(id);
                    triggerToast('Removed from wishlist.', true);
                }
            } else {
                const res = await API.post('/api/wishlist', { productId: id });
                if (res.success) {
                    btn.classList.add('active');
                    btn.innerText = '❤️';
                    wishlistIds.add(id);
                    triggerToast('Added to wishlist.', true);
                }
            }
        } catch (error) {
            triggerToast(error.message || 'Wishlist action failed.', false);
        }
    }

    async function loadRecentlyViewed() {
        const user = Auth.getUser();
        const section = document.getElementById('recentlyViewedSection');
        const grid = document.getElementById('recentlyViewedGrid');
        if (!section || !grid || !user || Number(user.roleId) !== 3) return;

        try {
            const data = await API.get('/api/products/recently-viewed');
            if (data.success && data.products && data.products.length > 0) {
                section.style.display = 'block';
                renderProductGrid(grid, data.products);
            } else {
                section.style.display = 'none';
            }
        } catch (e) {
            console.error('Failed to load recently viewed products:', e);
            section.style.display = 'none';
        }
    }

    // 6. Initializers & Listeners Binding
    updateHeaderAuth();
    loadCategories();
    (async () => {
        await loadWishlist();
        await loadCatalog();
        await loadRecentlyViewed();
    })();
    loadLocalCart();

    // Event Bindings
    searchBtn.addEventListener('click', loadCatalog);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadCatalog();
    });
    priceFilter.addEventListener('change', loadCatalog);
    
    const sortFilter = document.getElementById('sortFilter');
    if (sortFilter) {
        sortFilter.addEventListener('change', () => {
            currentPage = 1;
            applyCatalogSortAndRender();
        });
    }

    if (cartToggle) cartToggle.addEventListener('click', openCartDrawer);
    if (cartClose) cartClose.addEventListener('click', closeCartDrawer);

    checkoutBtn.addEventListener('click', handleCheckout);
});
