/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * MULTI-STEP CHECKOUT WIZARD DRIVER (Vanillajs)
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Authenticated customer guard (Customer role ID = 3)
    if (!Auth.checkPageGuard([3])) return;

    // DOM elements
    const steps = [
        document.getElementById('checkoutStep1'),
        document.getElementById('checkoutStep2'),
        document.getElementById('checkoutStep3'),
        document.getElementById('checkoutStep4')
    ];
    const prevBtn = document.getElementById('prevStepBtn');
    const nextBtn = document.getElementById('nextStepBtn');
    const cartContainer = document.getElementById('checkoutCartItems');
    const subtotalText = document.getElementById('checkoutSubtotal');
    
    // Forms & Inputs
    const shippingForm = document.getElementById('shippingForm');
    const cardForm = document.getElementById('cardForm');
    const cardContainer = document.getElementById('cardDetailsContainer');
    
    // Card inputs & visualizers
    const inputCardNum = document.getElementById('cardNumber');
    const inputCardName = document.getElementById('cardName');
    const inputCardExpiry = document.getElementById('cardExpiry');
    const inputCardCvv = document.getElementById('cardCvv');
    
    const mockCardNum = document.getElementById('mockCardNumber');
    const mockCardName = document.getElementById('mockCardHolder');
    const mockCardExpiry = document.getElementById('mockCardExpiry');

    // Summary fields
    const summaryName = document.getElementById('summaryName');
    const summaryPhone = document.getElementById('summaryPhone');
    const summaryAddress = document.getElementById('summaryAddress');
    const summaryPayment = document.getElementById('summaryPaymentMethod');
    const summaryStatusWrap = document.getElementById('summaryPaymentStatusContainer');
    const summaryStatus = document.getElementById('summaryPaymentStatus');
    const summaryItems = document.getElementById('summaryItemsList');
    const summaryTotal = document.getElementById('summaryTotal');

    let currentStep = 0; // 0-indexed corresponding to step 1-4
    let cart = [];
    let subtotal = 0;
    let selectedPaymentMethod = null;
    let paymentMethods = [];

    // Load Cart from localStorage
    function loadCart() {
        const stored = localStorage.getItem('idp_shopping_cart');
        if (stored) {
            try {
                cart = JSON.parse(stored);
            } catch (e) {
                cart = [];
            }
        }
        if (cart.length === 0) {
            triggerToast('Your shopping cart is empty. Redirecting to home...', false);
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
            return;
        }
        renderCartItems();
    }

    // Render cart items for Step 1
    function renderCartItems() {
        cartContainer.innerHTML = '';
        subtotal = 0;
        cart.forEach(item => {
            subtotal += item.price * item.quantity;
            const row = document.createElement('div');
            row.className = 'glass-card';
            row.style.padding = '16px';
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.gap = '16px';
            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 16px;">
                    <img src="${item.imageUrl || '/uploads/products/placeholder.png'}" style="width: 50px; height: 50px; border-radius: var(--radius-sm); object-fit: cover; border: 1px solid var(--border-glass);">
                    <div>
                        <h4 style="font-weight: 700; font-size: 0.95rem;">${item.name}</h4>
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">$${item.price.toFixed(2)} x ${item.quantity}</span>
                    </div>
                </div>
                <span style="font-weight: 700; color: var(--text-primary); font-size: 1rem;">$${(item.price * item.quantity).toFixed(2)}</span>
            `;
            cartContainer.appendChild(row);
        });
        subtotalText.innerText = `$${subtotal.toFixed(2)}`;
    }

    // Wizard navigation controls
    function updateWizardUI() {
        // Hide all steps
        steps.forEach((step, idx) => {
            step.style.display = idx === currentStep ? 'block' : 'none';
            const indicator = document.getElementById(`stepIndicator${idx + 1}`);
            if (indicator) {
                indicator.className = 'wizard-step';
                if (idx < currentStep) {
                    indicator.classList.add('completed');
                    indicator.innerHTML = '✓';
                } else if (idx === currentStep) {
                    indicator.classList.add('active');
                    indicator.innerHTML = idx + 1;
                } else {
                    indicator.innerHTML = idx + 1;
                }
            }
        });

        // Prev button visibility
        prevBtn.style.visibility = currentStep === 0 ? 'hidden' : 'visible';

        // Next/Place button label
        if (currentStep === steps.length - 1) {
            nextBtn.innerText = 'Place Order & Pay';
            nextBtn.className = 'btn btn-success';
        } else {
            nextBtn.innerText = 'Continue →';
            nextBtn.className = 'btn btn-primary';
        }
    }

    // Step 2 Validation: Shipping Info
    function validateStep2() {
        const name = document.getElementById('shippingName').value.trim();
        const phone = document.getElementById('shippingPhone').value.trim();
        const address = document.getElementById('shippingAddress').value.trim();

        if (name.length < 2) {
            triggerToast('Please enter a valid recipient name (min 2 chars).', false);
            return false;
        }
        if (!/^\+?[0-9\s\-]{8,15}$/.test(phone)) {
            triggerToast('Please enter a valid contact phone number.', false);
            return false;
        }
        if (address.length < 10) {
            triggerToast('Please provide a descriptive campus delivery address (min 10 chars).', false);
            return false;
        }
        return true;
    }

    // Fetch Payment Methods
    async function loadPaymentMethods() {
        const grid = document.getElementById('paymentMethodsGrid');
        grid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: var(--text-muted);">Syncing gateway channels...</div>';
        
        try {
            const data = await API.get('/api/payments/methods');
            if (data.success && data.methods) {
                paymentMethods = data.methods;
                grid.innerHTML = '';
                paymentMethods.forEach(method => {
                    const card = document.createElement('div');
                    card.className = `payment-card ${method.available ? '' : 'disabled'}`;
                    if (method.id === selectedPaymentMethod) card.classList.add('active');
                    if (!method.available) {
                        card.style.opacity = '0.5';
                        card.style.cursor = 'not-allowed';
                    }
                    card.innerHTML = `
                        <div class="payment-card-icon">${method.icon}</div>
                        <div class="payment-card-title">${method.label}</div>
                        <div class="payment-card-desc">${method.description}</div>
                    `;
                    if (method.available) {
                        card.addEventListener('click', () => {
                            document.querySelectorAll('.payment-card').forEach(c => c.classList.remove('active'));
                            card.classList.add('active');
                            selectPaymentMethod(method.id);
                        });
                    }
                    grid.appendChild(card);
                });
            }
        } catch (error) {
            grid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: var(--danger);">Failed to load payment methods.</div>';
        }
    }

    function selectPaymentMethod(methodId) {
        selectedPaymentMethod = methodId;
        if (methodId === 'MOCK_CARD') {
            cardContainer.style.display = 'block';
        } else {
            cardContainer.style.display = 'none';
        }
    }

    // Step 3 Validation: Payment
    function validateStep3() {
        if (!selectedPaymentMethod) {
            triggerToast('Please select a payment method.', false);
            return false;
        }
        if (selectedPaymentMethod === 'MOCK_CARD') {
            const num = inputCardNum.value.replace(/\s+/g, '');
            const name = inputCardName.value.trim();
            const exp = inputCardExpiry.value.trim();
            const cvv = inputCardCvv.value.trim();

            if (num.length !== 16 || !/^\d+$/.test(num)) {
                triggerToast('Please enter a valid 16-digit card number.', false);
                return false;
            }
            if (name.length < 2) {
                triggerToast('Please enter the cardholder name.', false);
                return false;
            }
            if (!/^\d{2}\/\d{2}$/.test(exp)) {
                triggerToast('Please enter a valid expiry date (MM/YY).', false);
                return false;
            }
            if (cvv.length !== 3 || !/^\d+$/.test(cvv)) {
                triggerToast('Please enter a valid 3-digit CVV.', false);
                return false;
            }
        }
        return true;
    }

    // Card Input Listeners for Visual Mock Card Synchronization
    if (inputCardNum) {
        inputCardNum.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            let formatted = val.match(/.{1,4}/g)?.join(' ') || '';
            e.target.value = formatted;
            mockCardNum.innerText = formatted || '•••• •••• •••• ••••';
        });
    }

    if (inputCardName) {
        inputCardName.addEventListener('input', (e) => {
            let val = e.target.value.toUpperCase();
            mockCardName.innerText = val || 'CARDHOLDER NAME';
        });
    }

    if (inputCardExpiry) {
        inputCardExpiry.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            if (val.length >= 2) {
                val = val.substring(0, 2) + '/' + val.substring(2, 4);
            }
            e.target.value = val;
            mockCardExpiry.innerText = val || 'MM/YY';
        });
    }

    // Step 4 Summary Setup
    function setupStep4Summary() {
        summaryName.innerText = document.getElementById('shippingName').value.trim();
        summaryPhone.innerText = document.getElementById('shippingPhone').value.trim();
        summaryAddress.innerText = document.getElementById('shippingAddress').value.trim();
        
        const method = paymentMethods.find(m => m.id === selectedPaymentMethod);
        summaryPayment.innerText = method ? method.label : selectedPaymentMethod;

        if (selectedPaymentMethod === 'MOCK_CARD') {
            summaryStatusWrap.style.display = 'block';
            summaryStatus.innerText = 'PAID (Processed via Card)';
            summaryStatus.style.color = 'var(--success)';
        } else {
            summaryStatusWrap.style.display = 'block';
            summaryStatus.innerText = 'COD_PENDING (Pay on delivery)';
            summaryStatus.style.color = 'var(--warning)';
        }

        // Render summary items
        summaryItems.innerHTML = '';
        cart.forEach(item => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.fontSize = '0.85rem';
            row.innerHTML = `
                <span style="color: var(--text-secondary);">${item.name} <span style="color: var(--text-muted);">x ${item.quantity}</span></span>
                <span style="font-weight: 600;">$${(item.price * item.quantity).toFixed(2)}</span>
            `;
            summaryItems.appendChild(row);
        });
        summaryTotal.innerText = `$${subtotal.toFixed(2)}`;
    }

    // Next Button Actions
    nextBtn.addEventListener('click', async () => {
        if (currentStep === 0) {
            currentStep = 1;
            updateWizardUI();
        } else if (currentStep === 1) {
            if (validateStep2()) {
                currentStep = 2;
                updateWizardUI();
                loadPaymentMethods();
            }
        } else if (currentStep === 2) {
            if (validateStep3()) {
                setupStep4Summary();
                currentStep = 3;
                updateWizardUI();
            }
        } else if (currentStep === 3) {
            // PLACE ORDER API SUBMISSIONS
            await submitCheckoutOrder();
        }
    });

    // Prev Button Actions
    prevBtn.addEventListener('click', () => {
        if (currentStep > 0) {
            currentStep--;
            updateWizardUI();
        }
    });

    // Submit order & process payments
    async function submitCheckoutOrder() {
        const items = cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity
        }));
        
        const shippingInfo = {
            name: document.getElementById('shippingName').value.trim(),
            phone: document.getElementById('shippingPhone').value.trim(),
            address: document.getElementById('shippingAddress').value.trim()
        };

        try {
            nextBtn.disabled = true;
            nextBtn.innerText = 'Processing Transaction...';

            // 1. Submit Order
            const orderRes = await API.post('/api/orders', {
                items,
                shippingInfo,
                paymentMethod: selectedPaymentMethod
            });

            if (!orderRes.success) {
                throw new Error(orderRes.message || 'Order submission failed.');
            }

            const orderId = orderRes.orderId;

            // 2. Initiate Payment Processing
            const paymentRes = await API.post('/api/payments/initiate', {
                orderId,
                paymentMethod: selectedPaymentMethod
            });

            if (!paymentRes.success) {
                throw new Error(paymentRes.message || 'Payment initiation failed.');
            }

            const successHTML = `
                <div style="display: flex; align-items: flex-start; gap: 12px; text-align: left;">
                    <div style="font-size: 1.5rem; line-height: 1; color: var(--success); flex-shrink: 0;">✓</div>
                    <div>
                        <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 4px; color: var(--text-primary);">Order placed successfully.</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">Your order has been received and is now awaiting processing.</div>
                    </div>
                </div>
            `;
            triggerToast(successHTML, true, true);

            // 3. Clear Cart & redirect
            localStorage.removeItem('idp_shopping_cart');
            window.dispatchEvent(new Event('cartUpdated'));

            setTimeout(() => {
                window.location.href = '/pages/customer.html';
            }, 3000);

        } catch (error) {
            triggerToast(error.message || 'An error occurred during transaction processing.', false, false);
            nextBtn.disabled = false;
            nextBtn.innerText = 'Place Order & Pay';
        }
    }

    // Helper Alert Box Toast
    function triggerToast(message, isSuccess = true, isHTML = false) {
        const alertBox = document.getElementById('alertBox');
        alertBox.style.display = 'block';
        alertBox.style.background = isSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        alertBox.style.color = isSuccess ? 'var(--success)' : 'var(--danger)';
        alertBox.style.border = isSuccess ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)';
        if (isHTML) {
            alertBox.innerHTML = message;
        } else {
            alertBox.innerText = message;
        }

        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 4000);
    }

    // Initialize Page
    loadCart();
    updateWizardUI();
});
