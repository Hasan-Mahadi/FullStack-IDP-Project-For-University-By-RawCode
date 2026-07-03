/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE CATEGORIES & FILTERS CONTROLLER
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // URL Params
    const urlParams = new URLSearchParams(window.location.search);
    let selectedCategoryId = urlParams.get('category') ? Number(urlParams.get('category')) : null;

    // DOM Elements
    const sidebarCategoriesList = document.getElementById('sidebarCategoriesList');
    const catalogGrid = document.getElementById('catalogGrid');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const priceSort = document.getElementById('priceSort');
    const stockFilter = document.getElementById('stockFilter');
    const catalogSummaryText = document.getElementById('catalogSummaryText');
    
    // Cart elements
    const cartToggle = document.getElementById('cartToggle');
    const cartDrawer = document.getElementById('cartDrawer');
    const cartClose = document.getElementById('cartClose');
    const cartItemsContainer = document.getElementById('cartItems');
    const cartTotalValue = document.getElementById('cartTotalValue');
    const checkoutBtn = document.getElementById('checkoutBtn');

    let categories = [];
    let products = [];
    let cart = [];
    let wishlistIds = new Set();

    // Emoji mapping
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

    init();

    async function init() {
        await loadCategoriesSidebar();
        await loadWishlist();
        await loadProductsList();
        loadLocalCart();

        // Bind events
        searchBtn.addEventListener('click', loadProductsList);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadProductsList();
        });
        priceSort.addEventListener('change', filterAndRenderProducts);
        stockFilter.addEventListener('change', filterAndRenderProducts);

        if (cartToggle) cartToggle.addEventListener('click', openCartDrawer);
        if (cartClose) cartClose.addEventListener('click', closeCartDrawer);
        if (checkoutBtn) checkoutBtn.addEventListener('click', handleCheckout);
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

    async function loadCategoriesSidebar() {
        try {
            const data = await API.get('/api/categories');
            if (data.success && data.categories) {
                categories = data.categories;
                renderCategoriesSidebar();
            }
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    }

    function renderCategoriesSidebar() {
        sidebarCategoriesList.innerHTML = '';
        
        // Add "All" option
        const allLink = document.createElement('div');
        allLink.className = `category-filter-item ${!selectedCategoryId ? 'active' : ''}`;
        allLink.innerHTML = `
            <span>🌐 All Products</span>
            <span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); border: none;">★</span>
        `;
        allLink.onclick = () => {
            selectedCategoryId = null;
            updateActiveCategoryUI();
            loadProductsList();
        };
        sidebarCategoriesList.appendChild(allLink);

        categories.forEach(cat => {
            const emoji = emojiMap[cat.icon] || '📦';
            const link = document.createElement('div');
            link.className = `category-filter-item ${selectedCategoryId === cat.id ? 'active' : ''}`;
            link.setAttribute('data-id', cat.id);
            link.innerHTML = `
                <span>${emoji} ${cat.name}</span>
                <span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); border: none;">›</span>
            `;
            link.onclick = () => {
                selectedCategoryId = cat.id;
                updateActiveCategoryUI();
                loadProductsList();
            };
            sidebarCategoriesList.appendChild(link);
        });
    }

    function updateActiveCategoryUI() {
        const items = sidebarCategoriesList.querySelectorAll('.category-filter-item');
        items.forEach(item => {
            const itemCatId = item.getAttribute('data-id');
            if (!selectedCategoryId && !itemCatId) {
                item.classList.add('active');
            } else if (selectedCategoryId && Number(itemCatId) === selectedCategoryId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    async function loadProductsList() {
        const query = searchInput.value.trim();
        let endpoint = '/api/products';
        
        const params = [];
        if (selectedCategoryId) {
            params.push(`category_id=${selectedCategoryId}`);
        }
        if (query) {
            params.push(`q=${encodeURIComponent(query)}`);
        }
        
        if (params.length > 0) {
            endpoint += `?${params.join('&')}`;
        }

        try {
            catalogGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
                    Catalog synchronizing...
                </div>
            `;

            const data = await API.get(endpoint);
            if (data.success && data.products) {
                products = data.products;
                filterAndRenderProducts();
            }
        } catch (error) {
            catalogGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--danger);">
                    Sync Failed: ${error.message}
                </div>
            `;
        }
    }

    function filterAndRenderProducts() {
        let filtered = [...products];

        // Apply Stock Filter
        const stockMode = stockFilter.value;
        if (stockMode === 'instock') {
            filtered = filtered.filter(p => p.stock > 0);
        }

        // Apply Price Sorting
        const sortMode = priceSort.value;
        if (sortMode === 'low-high') {
            filtered.sort((a, b) => a.price - b.price);
        } else if (sortMode === 'high-low') {
            filtered.sort((a, b) => b.price - a.price);
        }

        renderProductsGrid(filtered);
    }

    function renderProductsGrid(items) {
        catalogSummaryText.innerText = `Found ${items.length} active campus products.`;

        if (items.length === 0) {
            catalogGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 0; color: var(--text-secondary);">
                    No products match the selected criteria.
                </div>
            `;
            return;
        }

        catalogGrid.innerHTML = '';
        items.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card';
            const isOutOfStock = p.stock <= 0;
            const stockDisplay = isOutOfStock 
                ? `<span class="badge badge-danger" style="margin-bottom: 8px;">Out of Stock</span>` 
                : `<span class="badge badge-success" style="margin-bottom: 8px;">${p.stock} In-Stock</span>`;

            const imgHtml = p.image_url 
                ? `<img src="${p.image_url}" alt="${p.name}" class="product-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="product-image-placeholder" style="display: none;">🎓 ${p.name.substring(0,2).toUpperCase()}</div>`
                : `<div class="product-image-placeholder">🎓 ${p.name.substring(0,2).toUpperCase()}</div>`;

            const ratingDisplay = p.avg_rating > 0 
                ? `<span class="star-rating" style="font-size: 0.75rem;">⭐ ${p.avg_rating.toFixed(1)} (${p.review_count})</span>`
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
                    ${imgHtml}
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
            catalogGrid.appendChild(card);
        });

        // Add cart listeners
        catalogGrid.querySelectorAll('.addToCartBtn').forEach(btn => {
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

        // Add wishlist heart listeners
        catalogGrid.querySelectorAll('.wishlist-heart-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const id = Number(btn.getAttribute('data-id'));
                await toggleWishlist(id, btn);
            });
        });

        // Trigger animations
        if (window.AppAnimations && window.AppAnimations.observeAll) {
            window.AppAnimations.observeAll();
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

    const alertBox = document.getElementById('alertBox');
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
