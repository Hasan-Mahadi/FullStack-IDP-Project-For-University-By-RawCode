/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * CENTRAL SHOPPING CART & CATALOG BROWSER MODULE
 * ====================================================================
 * 
 * Drives catalog listings, filters, local storage shopping cart,
 * and order submissions. Incorporates responsive side drawer views.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const catalogGrid = document.getElementById('catalogGrid');
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
    const authActions = document.getElementById('authActions');
    const alertBox = document.getElementById('alertBox');

    // Cart memory store state
    let cart = [];

    // 1. Session verification & Header UI updates
    function updateHeaderAuth() {
        const user = Auth.getUser();
        if (user) {
            // User is authenticated, substitute register buttons with active dashboard link
            authActions.innerHTML = `
                <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">
                    Hi, ${user.fullName} (${user.roleName})
                </span>
                <button id="dashboardBtn" class="btn btn-primary" style="padding: 8px 16px; font-size: 0.85rem;">
                    Access Console
                </button>
                <button id="signoutBtn" class="btn btn-secondary" style="padding: 8px 16px; font-size: 0.85rem;">
                    Sign Out
                </button>
            `;

            document.getElementById('dashboardBtn').addEventListener('click', () => {
                Auth.redirectDashboard(user.roleId);
            });

            document.getElementById('signoutBtn').addEventListener('click', () => {
                Auth.logout();
            });
        }
    }

    // 2. Fetch products and render in UI
    async function loadCatalog() {
        const query = searchInput.value.trim();
        const priceRange = priceFilter.value;
        
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
                    Catalog synchronizing...
                </div>
            `;

            const data = await API.get(endpoint);

            if (data.success) {
                renderCatalog(data.products);
            }
        } catch (error) {
            catalogGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--danger);">
                    Sync Failed: ${error.message}
                </div>
            `;
        }
    }

    function renderCatalog(products) {
        if (!products || products.length === 0) {
            catalogGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
                    No active campus products found. Try modifying filters.
                </div>
            `;
            return;
        }

        catalogGrid.innerHTML = '';
        products.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card';
            
            const isOutOfStock = p.stock <= 0;
            const stockDisplay = isOutOfStock 
                ? `<span class="badge badge-danger" style="margin-bottom: 8px;">Out of Stock</span>` 
                : `<span class="badge badge-success" style="margin-bottom: 8px;">${p.stock} In-Stock</span>`;

            card.innerHTML = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        ${stockDisplay}
                        <span style="font-size: 0.7rem; color: var(--text-secondary);">Seller: ${p.seller_name}</span>
                    </div>
                    <h3 class="product-title">${p.name}</h3>
                    <p class="product-desc">${p.description || 'No description listed by vendor.'}</p>
                </div>
                <div style="margin-top: 16px;">
                    <div class="product-price" style="margin-bottom: 12px;">$${p.price.toFixed(2)}</div>
                    <button class="btn btn-primary addToCartBtn" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-stock="${p.stock}" style="width: 100%; font-size: 0.8rem; padding: 10px;" ${isOutOfStock ? 'disabled' : ''}>
                        ${isOutOfStock ? 'Sold Out' : 'Add to Lab Cart'}
                    </button>
                </div>
            `;
            catalogGrid.appendChild(card);
        });

        // Add cart listeners
        document.querySelectorAll('.addToCartBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pId = Number(btn.getAttribute('data-id'));
                const pName = btn.getAttribute('data-name');
                const pPrice = parseFloat(btn.getAttribute('data-price'));
                const pStock = Number(btn.getAttribute('data-stock'));

                addToCart(pId, pName, pPrice, pStock);
            });
        });
    }

    // 3. Cart State Logic
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

    function addToCart(id, name, price, stock) {
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
                quantity: 1
            });
        }

        saveLocalCart();
        triggerToast(`Added "${name}" to cart.`, true);
        openCartDrawer();
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
    }

    function updateCartUI() {
        // Update badge
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (totalItems > 0) {
            cartBadge.innerText = totalItems;
            cartBadge.style.display = 'block';
        } else {
            cartBadge.style.display = 'none';
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
            div.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name" title="${item.name}">${item.name}</div>
                    <div class="cart-item-price">$${item.price.toFixed(2)} x ${item.quantity}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="cart-item-qty-btn qty-minus" data-id="${item.productId}">-</button>
                    <span style="font-size: 0.85rem; font-weight: 600; width: 16px; text-align: center;">${item.quantity}</span>
                    <button class="cart-item-qty-btn qty-plus" data-id="${item.productId}">+</button>
                </div>
            `;
            cartItemsContainer.appendChild(div);
        });

        cartTotalValue.innerText = `$${totalSum.toFixed(2)}`;

        // Attach controls event listeners
        document.querySelectorAll('.qty-minus').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.getAttribute('data-id'));
                changeCartQty(id, -1);
            });
        });

        document.querySelectorAll('.qty-plus').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.getAttribute('data-id'));
                changeCartQty(id, 1);
            });
        });
    }

    // Drawer Opening/Closing
    function openCartDrawer() {
        cartDrawer.classList.add('active');
    }

    function closeCartDrawer() {
        cartDrawer.classList.remove('active');
    }

    // 4. Cart Checkouts Submission
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

    // 5. Initializers & Listeners Binding
    updateHeaderAuth();
    loadCatalog();
    loadLocalCart();

    // Event Bindings
    searchBtn.addEventListener('click', loadCatalog);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadCatalog();
    });
    priceFilter.addEventListener('change', loadCatalog);

    cartToggle.addEventListener('click', openCartDrawer);
    cartClose.addEventListener('click', closeCartDrawer);

    checkoutBtn.addEventListener('click', handleCheckout);
});
