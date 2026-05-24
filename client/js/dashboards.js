/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * CENTRAL DASHBOARDS CONTROLLER (THE MULTI-ROLE INTERACTION ENGINE)
 * ====================================================================
 * 
 * Drives all dynamic components, interactive buttons, REST API fetchers,
 * and SVG data graphics for: Admin, Seller, Customer, and Service Team.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. GLOBAL INITIALIZATION & CHECKS
    const user = Auth.getUser();
    if (!user) {
        window.location.href = '/pages/login.html';
        return;
    }

    // Populate user profile info in the sidebar footer
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    const sidebarName = document.getElementById('sidebarName');
    const sidebarRole = document.getElementById('sidebarRole');
    const signoutBtn = document.getElementById('signoutBtn');

    if (sidebarAvatar) sidebarAvatar.innerText = user.fullName.charAt(0).toUpperCase();
    if (sidebarName) sidebarName.innerText = user.fullName;
    if (sidebarRole) sidebarRole.innerText = user.roleName;

    if (signoutBtn) {
        signoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });
    }

    // 2. REAL-TIME SYSTEM NOTIFICATIONS COORDINATOR
    const notificationBell = document.getElementById('notificationBell');
    const notificationInbox = document.getElementById('notificationInbox');
    const notificationBadge = document.getElementById('notificationBadge');
    const notificationList = document.getElementById('notificationList');
    const markReadBtn = document.getElementById('markReadBtn');

    if (notificationBell) {
        notificationBell.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationInbox.classList.toggle('active');
            if (notificationInbox.classList.contains('active')) {
                loadNotifications();
            }
        });
        
        // Hide notification inbox on outside clicks
        document.addEventListener('click', () => {
            notificationInbox.classList.remove('active');
        });
        notificationInbox.addEventListener('click', e => e.stopPropagation());
    }

    async function loadNotifications() {
        try {
            const data = await API.get('/api/notifications');
            if (data.success && notificationList) {
                const unreadCount = data.notifications.filter(n => n.is_read === 0).length;
                
                // Update badge
                if (unreadCount > 0 && notificationBadge) {
                    notificationBadge.innerText = unreadCount;
                    notificationBadge.style.display = 'block';
                } else if (notificationBadge) {
                    notificationBadge.style.display = 'none';
                }

                // Render list
                if (data.notifications.length === 0) {
                    notificationList.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-muted);">No notifications yet.</div>`;
                    return;
                }

                notificationList.innerHTML = '';
                data.notifications.forEach(n => {
                    const div = document.createElement('div');
                    div.className = `notification-item ${n.is_read === 0 ? 'unread' : ''}`;
                    
                    const date = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    div.innerHTML = `
                        <div style="font-weight: 500; margin-bottom: 2px;">${n.message}</div>
                        <div style="font-size: 0.65rem; color: var(--text-muted);">${date}</div>
                    `;
                    notificationList.appendChild(div);
                });
            }
        } catch (e) {
            console.error('>> Notifications fetch error:', e.message);
        }
    }

    if (markReadBtn) {
        markReadBtn.addEventListener('click', async () => {
            try {
                await API.put('/api/notifications/read');
                loadNotifications();
            } catch (e) {
                console.error(e.message);
            }
        });
    }

    // Auto-poll notifications every 10 seconds
    loadNotifications();
    setInterval(loadNotifications, 10000);

    // ====================================================================
    // 3. SERVICE TEAM COORDINATION CHAT BRIDGE (POPUP MODAL SHIELDS)
    // ====================================================================
    const chatModal = document.getElementById('chatModal');
    const chatCloseBtn = document.getElementById('chatCloseBtn');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatOrderTitle = document.getElementById('chatOrderTitle');
    const chatReceiverSelect = document.getElementById('chatReceiverSelect'); // Only visible on service dashboard

    let activeChatOrderId = null;
    let chatPollTimer = null;

    if (chatCloseBtn) {
        chatCloseBtn.addEventListener('click', () => {
            chatModal.classList.remove('active');
            activeChatOrderId = null;
            if (chatPollTimer) clearInterval(chatPollTimer);
        });
    }

    window.openOrderChat = function(orderId, orderTitle) {
        activeChatOrderId = orderId;
        if (chatOrderTitle) chatOrderTitle.innerText = orderTitle || `Coordination Chat - Order #${orderId}`;
        chatModal.classList.add('active');
        
        loadChatMessages();
        
        // Auto-poll messages every 4 seconds
        if (chatPollTimer) clearInterval(chatPollTimer);
        chatPollTimer = setInterval(loadChatMessages, 4000);
    };

    async function loadChatMessages() {
        if (!activeChatOrderId || !chatMessages) return;

        try {
            const data = await API.get(`/api/messages?orderId=${activeChatOrderId}`);
            if (data.success) {
                chatMessages.innerHTML = '';
                
                if (data.messages.length === 0) {
                    chatMessages.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 20px;">No messages regarding order #${activeChatOrderId} yet.</div>`;
                    return;
                }

                data.messages.forEach(m => {
                    const div = document.createElement('div');
                    const isMe = Number(m.sender_id) === Number(user.userId);
                    div.className = `chat-bubble ${isMe ? 'chat-bubble-sent' : 'chat-bubble-received'}`;
                    
                    const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    div.innerHTML = `
                        <div>${m.message_text}</div>
                        <div class="chat-meta">
                            <span style="font-weight: bold;">${isMe ? 'You' : m.sender_name}</span>
                            <span>${time}</span>
                        </div>
                    `;
                    chatMessages.appendChild(div);
                });

                // Scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        } catch (e) {
            console.error('Chat load fail:', e.message);
        }
    }

    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', submitChatMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitChatMessage();
        });
    }

    async function submitChatMessage() {
        const text = chatInput.value.trim();
        if (!text || !activeChatOrderId) return;

        const payload = {
            orderId: activeChatOrderId,
            messageText: text
        };

        // If service coordinator, capture chosen recipient (customer or seller)
        if (Number(user.roleId) === 4 && chatReceiverSelect) {
            payload.receiverId = Number(chatReceiverSelect.value);
        }

        try {
            chatInput.disabled = true;
            const data = await API.post('/api/messages', payload);
            if (data.success) {
                chatInput.value = '';
                loadChatMessages();
            }
        } catch (e) {
            console.error(e.message);
        } finally {
            chatInput.disabled = false;
            chatInput.focus();
        }
    }


    // ====================================================================
    // 4. CUSTOMER INTERACTION WORKFLOWS
    // ====================================================================
    if (window.location.pathname.includes('customer.html')) {
        const customerOrdersTable = document.getElementById('customerOrdersTable');
        const stepperCard = document.getElementById('stepperCard');
        const stepPending = document.getElementById('stepPending');
        const stepApproved = document.getElementById('stepApproved');
        const stepWarehouse = document.getElementById('stepWarehouse');
        const stepVerified = document.getElementById('stepVerified');
        const stepDispatched = document.getElementById('stepDispatched');
        const stepCompleted = document.getElementById('stepCompleted');
        const stepProgressBar = document.getElementById('stepProgressBar');
        const stepperOrderTitle = document.getElementById('stepperOrderTitle');
        const confirmReceiptArea = document.getElementById('confirmReceiptArea');
        const confirmReceiptBtn = document.getElementById('confirmReceiptBtn');
        
        let selectedOrderIdForReceipt = null;

        async function loadCustomerOrders() {
            try {
                const data = await API.get('/api/orders/my');
                if (data.success && customerOrdersTable) {
                    customerOrdersTable.innerHTML = '';

                    if (data.orders.length === 0) {
                        customerOrdersTable.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">You have placed no campus orders yet. Go to catalog.</td></tr>`;
                        return;
                    }

                    data.orders.forEach(o => {
                        const tr = document.createElement('tr');
                        const date = new Date(o.created_at).toLocaleDateString();
                        const isDispatched = o.status === 'DISPATCHED';

                        tr.innerHTML = `
                            <td>#${o.id}</td>
                            <td>${date}</td>
                            <td>${o.items.map(i => `${i.product_name} (x${i.quantity})`).join('<br>')}</td>
                            <td>$${o.total_amount.toFixed(2)}</td>
                            <td>
                                <span class="badge ${o.status === 'COMPLETED' ? 'badge-success' : o.status === 'REJECTED' ? 'badge-danger' : 'badge-pending'}">${o.status}</span>
                            </td>
                            <td>
                                <button class="btn btn-secondary btn-sm trackOrderBtn" data-id="${o.id}" data-status="${o.status}" style="padding: 6px 12px; font-size: 0.75rem;">Track</button>
                                <button class="btn btn-primary btn-sm chatOrderBtn" onclick="openOrderChat(${o.id}, 'Chat Service Bridge - Order #${o.id}')" style="padding: 6px 12px; font-size: 0.75rem;">Support</button>
                            </td>
                        `;
                        customerOrdersTable.appendChild(tr);
                    });

                    // Track triggers
                    document.querySelectorAll('.trackOrderBtn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const oId = Number(btn.getAttribute('data-id'));
                            const status = btn.getAttribute('data-status');
                            renderOrderTracking(oId, status);
                        });
                    });
                }
            } catch (e) {
                console.error(e.message);
            }
        }

        function renderOrderTracking(orderId, status) {
            stepperOrderTitle.innerText = `Logistics Pipeline Tracking - Order #${orderId}`;
            stepperCard.style.display = 'block';
            selectedOrderIdForReceipt = orderId;

            // Reset node classes
            const steps = [stepPending, stepApproved, stepWarehouse, stepVerified, stepDispatched, stepCompleted];
            steps.forEach(node => {
                node.className = 'step-node';
            });

            let progressWidth = '0%';
            
            // Map statuses onto vertical timeline widths and nodes
            if (status === 'PENDING') {
                stepPending.className = 'step-node active';
                progressWidth = '0%';
            } else if (status === 'APPROVED') {
                stepPending.className = 'step-node completed';
                stepApproved.className = 'step-node active';
                progressWidth = '20%';
            } else if (status === 'DELIVERED_TO_WAREHOUSE') {
                stepPending.className = 'step-node completed';
                stepApproved.className = 'step-node completed';
                stepWarehouse.className = 'step-node active';
                progressWidth = '40%';
            } else if (status === 'VERIFIED_IN_WAREHOUSE') {
                stepPending.className = 'step-node completed';
                stepApproved.className = 'step-node completed';
                stepWarehouse.className = 'step-node completed';
                stepVerified.className = 'step-node active';
                progressWidth = '60%';
            } else if (status === 'DISPATCHED') {
                stepPending.className = 'step-node completed';
                stepApproved.className = 'step-node completed';
                stepWarehouse.className = 'step-node completed';
                stepVerified.className = 'step-node completed';
                stepDispatched.className = 'step-node active';
                progressWidth = '80%';
            } else if (status === 'COMPLETED') {
                steps.forEach(node => node.className = 'step-node completed');
                progressWidth = '100%';
            }

            stepProgressBar.style.width = progressWidth;

            // Render confirm package area
            if (status === 'DISPATCHED') {
                confirmReceiptArea.style.display = 'block';
            } else {
                confirmReceiptArea.style.display = 'none';
            }
        }

        if (confirmReceiptBtn) {
            confirmReceiptBtn.addEventListener('click', async () => {
                if (!selectedOrderIdForReceipt) return;
                try {
                    confirmReceiptBtn.disabled = true;
                    confirmReceiptBtn.innerText = 'Completing...';
                    const data = await API.put('/api/orders/complete', { orderId: selectedOrderIdForReceipt });
                    if (data.success) {
                        stepperCard.style.display = 'none';
                        loadCustomerOrders();
                    }
                } catch (e) {
                    alert(e.message);
                } finally {
                    confirmReceiptBtn.disabled = false;
                    confirmReceiptBtn.innerText = 'Confirm Physical Package Arrival';
                }
            });
        }

        loadCustomerOrders();
    }


    // ====================================================================
    // 5. SELLER MANAGEMENT PORTS
    // ====================================================================
    if (window.location.pathname.includes('seller.html')) {
        const sellerProductsTable = document.getElementById('sellerProductsTable');
        const sellerOrdersTable = document.getElementById('sellerOrdersTable');
        const uploadForm = document.getElementById('uploadForm');
        
        // Dynamic stats
        const statSellerTotalProducts = document.getElementById('statSellerTotalProducts');
        const statSellerActiveOrders = document.getElementById('statSellerActiveOrders');

        async function loadSellerDashboard() {
            try {
                // 1. Fetch seller's products
                const prodData = await API.get('/api/products/my');
                if (prodData.success && sellerProductsTable) {
                    sellerProductsTable.innerHTML = '';
                    statSellerTotalProducts.innerText = prodData.products.length;

                    prodData.products.forEach(p => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>#${p.id}</td>
                            <td>${p.name}</td>
                            <td>$${p.price.toFixed(2)}</td>
                            <td>${p.stock} units</td>
                            <td>
                                <span class="badge ${p.is_active === 1 ? 'badge-success' : 'badge-danger'}">
                                    ${p.is_active === 1 ? 'Active' : 'Deactivated'}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-secondary btn-sm editStockBtn" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-stock="${p.stock}" style="padding: 6px 12px; font-size: 0.75rem;">Modify</button>
                                <button class="btn btn-danger btn-sm deleteProductBtn" data-id="${p.id}" style="padding: 6px 12px; font-size: 0.75rem;">Deactivate</button>
                            </td>
                        `;
                        sellerProductsTable.appendChild(tr);
                    });

                    // Edit & Delete handlers
                    bindProductActions();
                }

                // 2. Fetch assigned incoming orders
                const ordData = await API.get('/api/orders/my');
                if (ordData.success && sellerOrdersTable) {
                    sellerOrdersTable.innerHTML = '';
                    let activeCount = 0;

                    ordData.orders.forEach(o => {
                        if (o.status === 'APPROVED') activeCount++;

                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>#${o.id}</td>
                            <td>${o.customer_name}</td>
                            <td>${o.items.map(i => `${i.product_name} (x${i.quantity})`).join('<br>')}</td>
                            <td>
                                <span class="badge ${o.status === 'APPROVED' ? 'badge-primary' : 'badge-pending'}">${o.status}</span>
                            </td>
                            <td>
                                ${o.status === 'APPROVED' 
                                    ? `<button class="btn btn-success btn-sm shipWarehouseBtn" data-id="${o.id}" style="padding: 6px 12px; font-size: 0.75rem;">Deliver to Warehouse</button>` 
                                    : `<span class="badge badge-success">Shipped</span>`}
                                <button class="btn btn-secondary btn-sm" onclick="openOrderChat(${o.id}, 'Message Service Coordinator - Order #${o.id}')" style="padding: 6px 12px; font-size: 0.75rem;">Message Service</button>
                            </td>
                        `;
                        sellerOrdersTable.appendChild(tr);
                    });

                    statSellerActiveOrders.innerText = activeCount;

                    // Ship to warehouse button handlers
                    document.querySelectorAll('.shipWarehouseBtn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const oId = Number(btn.getAttribute('data-id'));
                            if (confirm(`Confirm physical shipping of items in Order #${oId} to the campus central warehouse?`)) {
                                try {
                                    btn.disabled = true;
                                    const res = await API.put('/api/orders/deliver-warehouse', { orderId: oId });
                                    if (res.success) {
                                        loadSellerDashboard();
                                    }
                                } catch (e) {
                                    alert(e.message);
                                }
                            }
                        });
                    });
                }

            } catch (e) {
                console.error(e.message);
            }
        }

        // Product CRUD triggers
        if (uploadForm) {
            uploadForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('newProdName').value.trim();
                const description = document.getElementById('newProdDesc').value.trim();
                const price = parseFloat(document.getElementById('newProdPrice').value);
                const stock = parseInt(document.getElementById('newProdStock').value);

                try {
                    const data = await API.post('/api/products', { name, description, price, stock });
                    if (data.success) {
                        uploadForm.reset();
                        loadSellerDashboard();
                    }
                } catch (err) {
                    alert(err.message);
                }
            });
        }

        const editModal = document.getElementById('editProductModal');
        const editForm = document.getElementById('editProductForm');
        const editModalClose = document.getElementById('editProductClose');
        
        if (editModalClose) {
            editModalClose.addEventListener('click', () => editModal.classList.remove('active'));
        }

        function bindProductActions() {
            document.querySelectorAll('.editStockBtn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const name = btn.getAttribute('data-name');
                    const price = btn.getAttribute('data-price');
                    const stock = btn.getAttribute('data-stock');

                    document.getElementById('editProdId').value = id;
                    document.getElementById('editProdName').value = name;
                    document.getElementById('editProdPrice').value = price;
                    document.getElementById('editProdStock').value = stock;

                    editModal.classList.add('active');
                });
            });

            document.querySelectorAll('.deleteProductBtn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = Number(btn.getAttribute('data-id'));
                    if (confirm('Deactivate product from campus catalog? Historical orders will be preserved, but new students cannot buy it.')) {
                        try {
                            const res = await API.delete('/api/products', { id });
                            if (res.success) {
                                loadSellerDashboard();
                            }
                        } catch (e) {
                            alert(e.message);
                        }
                    }
                });
            });
        }

        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = Number(document.getElementById('editProdId').value);
                const name = document.getElementById('editProdName').value.trim();
                const price = parseFloat(document.getElementById('editProdPrice').value);
                const stock = parseInt(document.getElementById('editProdStock').value);

                try {
                    const data = await API.put('/api/products', { id, name, price, stock });
                    if (data.success) {
                        editModal.classList.remove('active');
                        loadSellerDashboard();
                    }
                } catch (err) {
                    alert(err.message);
                }
            });
        }

        loadSellerDashboard();
    }


    // ====================================================================
    // 6. SERVICE TEAM OPERATIONAL LOGISTICS
    // ====================================================================
    if (window.location.pathname.includes('service.html')) {
        const serviceOrdersTable = document.getElementById('serviceOrdersTable');
        const statPendingReview = document.getElementById('statPendingReview');
        const statWarehouseAudits = document.getElementById('statWarehouseAudits');
        const statCourierDispatches = document.getElementById('statCourierDispatches');

        async function loadServiceDashboard() {
            try {
                const data = await API.get('/api/orders/my');
                if (data.success && serviceOrdersTable) {
                    serviceOrdersTable.innerHTML = '';
                    
                    let pendingReview = 0;
                    let warehouseAudits = 0;
                    let courierDispatches = 0;

                    data.orders.forEach(o => {
                        if (o.status === 'PENDING') pendingReview++;
                        if (o.status === 'DELIVERED_TO_WAREHOUSE') warehouseAudits++;
                        if (o.status === 'VERIFIED_IN_WAREHOUSE') courierDispatches++;

                        const tr = document.createElement('tr');
                        const date = new Date(o.created_at).toLocaleDateString();
                        
                        // Formulate action button based on order state
                        let actionHtml = '';
                        if (o.status === 'PENDING') {
                            actionHtml = `
                                <button class="btn btn-primary btn-sm reviewBtn" data-id="${o.id}" data-approve="true" style="padding: 6px 10px; font-size: 0.75rem;">Approve</button>
                                <button class="btn btn-danger btn-sm reviewBtn" data-id="${o.id}" data-approve="false" style="padding: 6px 10px; font-size: 0.75rem;">Reject</button>
                            `;
                        } else if (o.status === 'DELIVERED_TO_WAREHOUSE') {
                            actionHtml = `
                                <button class="btn btn-warning btn-sm verifyWarehouseBtn" data-id="${o.id}" data-approve="true" style="padding: 6px 10px; font-size: 0.75rem;">Verify items match</button>
                                <button class="btn btn-danger btn-sm verifyWarehouseBtn" data-id="${o.id}" data-approve="false" style="padding: 6px 10px; font-size: 0.75rem;">Discrepancy</button>
                            `;
                        } else if (o.status === 'VERIFIED_IN_WAREHOUSE') {
                            actionHtml = `
                                <button class="btn btn-primary btn-sm dispatchBtn" data-id="${o.id}" style="padding: 6px 10px; font-size: 0.75rem;">Dispatch Delivery</button>
                            `;
                        } else {
                            actionHtml = `<span class="badge badge-success">Coordination Complete</span>`;
                        }

                        // Communication coordinator button
                        const messageHtml = `
                            <button class="btn btn-secondary btn-sm" onclick="openServiceBridgeChat(${o.id}, ${o.customer_id}, ${o.items[0]?.seller_id || 2})" style="padding: 6px 10px; font-size: 0.75rem;">Bridge Chat</button>
                        `;

                        tr.innerHTML = `
                            <td>#${o.id}</td>
                            <td>${o.customer_name}</td>
                            <td>${o.items.map(i => `${i.product_name} (x${i.quantity})`).join('<br>')}</td>
                            <td>$${o.total_amount.toFixed(2)}</td>
                            <td>
                                <span class="badge ${o.status === 'COMPLETED' ? 'badge-success' : o.status === 'REJECTED' ? 'badge-danger' : 'badge-pending'}">${o.status}</span>
                            </td>
                            <td style="display: flex; gap: 6px; flex-wrap: wrap;">
                                ${actionHtml}
                                ${messageHtml}
                            </td>
                        `;
                        serviceOrdersTable.appendChild(tr);
                    });

                    statPendingReview.innerText = pendingReview;
                    statWarehouseAudits.innerText = warehouseAudits;
                    statCourierDispatches.innerText = courierDispatches;

                    bindServiceActions();
                }
            } catch (e) {
                console.error(e.message);
            }
        }

        // Bridge Chat modal setup for Service Team
        window.openServiceBridgeChat = function(orderId, customerId, sellerId) {
            if (chatReceiverSelect) {
                chatReceiverSelect.style.display = 'block';
                chatReceiverSelect.innerHTML = `
                    <option value="${customerId}">Send to Student Customer</option>
                    <option value="${sellerId}">Send to Merchant Seller</option>
                `;
            }
            openOrderChat(orderId, `Service Coordinator Bridge - Order #${orderId}`);
        };

        function bindServiceActions() {
            // Approval buttons
            document.querySelectorAll('.reviewBtn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const oId = Number(btn.getAttribute('data-id'));
                    const approve = btn.getAttribute('data-approve') === 'true';
                    
                    try {
                        btn.disabled = true;
                        const res = await API.put('/api/orders/approve', { orderId: oId, approve });
                        if (res.success) {
                            loadServiceDashboard();
                        }
                    } catch (e) {
                        alert(e.message);
                    }
                });
            });

            // Verification physical audits
            document.querySelectorAll('.verifyWarehouseBtn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const oId = Number(btn.getAttribute('data-id'));
                    const approved = btn.getAttribute('data-approve') === 'true';

                    try {
                        btn.disabled = true;
                        const res = await API.put('/api/orders/verify-warehouse', { orderId: oId, approved });
                        if (res.success) {
                            loadServiceDashboard();
                        }
                    } catch (e) {
                        alert(e.message);
                    }
                });
            });

            // Dispatch buttons
            document.querySelectorAll('.dispatchBtn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const oId = Number(btn.getAttribute('data-id'));

                    try {
                        btn.disabled = true;
                        const res = await API.put('/api/orders/dispatch', { orderId: oId });
                        if (res.success) {
                            loadServiceDashboard();
                        }
                    } catch (e) {
                        alert(e.message);
                    }
                });
            });
        }

        loadServiceDashboard();
    }


    // ====================================================================
    // 7. ADMIN SECURITY PANEL & SVG GRAPH DATA GENERATORS
    // ====================================================================
    if (window.location.pathname.includes('admin.html')) {
        const adminUsersTable = document.getElementById('adminUsersTable');
        
        // Dynamic analytics stat variables
        const statAdminTotalUsers = document.getElementById('statAdminTotalUsers');
        const statAdminTotalRevenue = document.getElementById('statAdminTotalRevenue');
        const statAdminTotalOrders = document.getElementById('statAdminTotalOrders');
        const statAdminCatalogSize = document.getElementById('statAdminCatalogSize');

        async function loadAdminDashboard() {
            try {
                // 1. Fetch user accounts
                const userData = await API.get('/api/admin/users');
                if (userData.success && adminUsersTable) {
                    adminUsersTable.innerHTML = '';
                    statAdminTotalUsers.innerText = userData.users.length;

                    userData.users.forEach(u => {
                        const tr = document.createElement('tr');
                        const date = new Date(u.created_at).toLocaleDateString();
                        const isMe = Number(u.id) === Number(user.userId);

                        tr.innerHTML = `
                            <td>#${u.id}</td>
                            <td>${u.full_name}</td>
                            <td>${u.username}</td>
                            <td>${u.email}</td>
                            <td>
                                <span class="badge ${u.role_name === 'Admin' ? 'badge-danger' : u.role_name === 'Seller' ? 'badge-primary' : 'badge-pending'}">${u.role_name}</span>
                            </td>
                            <td>
                                <span class="badge ${u.is_active === 1 ? 'badge-success' : 'badge-danger'}">
                                    ${u.is_active === 1 ? 'Active' : 'Suspended'}
                                </span>
                            </td>
                            <td>
                                ${isMe 
                                    ? `<span style="font-size: 0.75rem; color: var(--text-muted);">Root System</span>`
                                    : `<button class="btn ${u.is_active === 1 ? 'btn-danger' : 'btn-success'} btn-sm toggleUserBtn" data-id="${u.id}" data-active="${u.is_active}" style="padding: 6px 12px; font-size: 0.75rem;">
                                        ${u.is_active === 1 ? 'Suspend' : 'Activate'}
                                       </button>`
                                }
                            </td>
                        `;
                        adminUsersTable.appendChild(tr);
                    });

                    // Activate/suspend bindings
                    document.querySelectorAll('.toggleUserBtn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const uId = Number(btn.getAttribute('data-id'));
                            const currentlyActive = Number(btn.getAttribute('data-active')) === 1;

                            if (confirm(`Are you sure you want to ${currentlyActive ? 'SUSPEND' : 'ACTIVATE'} this user account?`)) {
                                try {
                                    btn.disabled = true;
                                    const res = await API.put('/api/admin/users/status', {
                                        targetUserId: uId,
                                        active: !currentlyActive
                                    });
                                    if (res.success) {
                                        loadAdminDashboard();
                                    }
                                } catch (e) {
                                    alert(e.message);
                                }
                            }
                        });
                    });
                }

                // 2. Fetch analytical reporting
                const repData = await API.get('/api/admin/reports');
                if (repData.success) {
                    const r = repData.reports.analytics;
                    statAdminTotalRevenue.innerText = `$${r.totalRevenue.toFixed(2)}`;
                    statAdminTotalOrders.innerText = r.totalOrders;
                    statAdminCatalogSize.innerText = r.totalProducts;

                    // Dynamically render premium graphical charts using native vector SVGs!
                    renderSvgReportCharts(r);
                }

            } catch (e) {
                console.error(e.message);
            }
        }

        // Beautiful SVG graphical drawing logic
        function renderSvgReportCharts(analytics) {
            const chartBox = document.getElementById('adminAnalyticsChart');
            if (!chartBox) return;

            const total = analytics.totalOrders || 1;
            const completed = analytics.statusSummary?.COMPLETED || 0;
            const rejected = analytics.statusSummary?.REJECTED || 0;
            const pending = analytics.statusSummary?.PENDING || 0;
            const other = total - completed - rejected - pending;

            // Generate a sleek vector percentage SVG circle
            const compPercent = Math.round((completed / total) * 100);
            const pendPercent = Math.round((pending / total) * 100);
            const otherPercent = Math.round((other / total) * 100);

            chartBox.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; margin: 0 auto; width: 100%; max-width: 320px;">
                    <svg viewBox="0 0 100 100" width="100%" height="220" style="transform: rotate(-90deg); filter: drop-shadow(0px 0px 10px rgba(0, 122, 255, 0.15));">
                        <!-- Background Circle -->
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.05)" stroke-width="8"/>
                        
                        <!-- Completed orders (Green) -->
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--success)" stroke-width="8"
                                stroke-dasharray="${2 * Math.PI * 40}" 
                                stroke-dashoffset="${2 * Math.PI * 40 * (1 - completed/total)}"
                                stroke-linecap="round"/>
                                
                        <!-- Pending reviews (Amber) -->
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--warning)" stroke-width="8"
                                stroke-dasharray="${2 * Math.PI * 40}" 
                                stroke-dashoffset="${2 * Math.PI * 40}"
                                transform="rotate(${360 * completed/total} 50 50)"
                                stroke-dashoffset="${2 * Math.PI * 40 * (1 - pending/total)}"
                                stroke-linecap="round"
                                style="opacity: ${pending > 0 ? 1 : 0};"/>
                    </svg>

                    <!-- Chart Legend -->
                    <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; font-size: 0.8rem; border-top: var(--border-glass); padding-top: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: var(--success);"></span>Fulfillment Rate (Completed)</span>
                            <span style="font-weight: 700; color: var(--success);">${compPercent}%</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: var(--warning);"></span>Operational Pipeline (Pending)</span>
                            <span style="font-weight: 700; color: var(--warning);">${pendPercent}%</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: var(--primary);"></span>Active Logistics (In-Transit)</span>
                            <span style="font-weight: 700; color: var(--primary);">${otherPercent}%</span>
                        </div>
                    </div>
                </div>
            `;
        }

        loadAdminDashboard();
    }
});
