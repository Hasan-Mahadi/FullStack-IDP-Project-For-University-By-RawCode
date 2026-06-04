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

    // ====================================================================
    // HASH ROUTER — switches between .dashboard-view panels based on URL hash
    // ====================================================================

    // Per-page route → view-id maps
    const ROUTE_MAPS = {
        'seller.html': {
            'dashboard':       'view-dashboard',
            'upload-product':  'view-upload',
            'active-inventory':'view-inventory',
            'incoming-orders': 'view-orders',
        },
        'admin.html': {
            'dashboard':       'view-dashboard',
            'user-directory':  'view-users',
        },
        'service.html': {
            'dashboard':       'view-dashboard',
            'coordination-ledger': 'view-ledger',
        },
    };

    // Detect which page we are on
    const currentPage = Object.keys(ROUTE_MAPS).find(p => window.location.pathname.includes(p));
    const routeMap = currentPage ? ROUTE_MAPS[currentPage] : {};

    function handleRouting() {
        // Parse the route key from the hash: "#/upload-product" → "upload-product"
        const hash = window.location.hash || '';
        const routeKey = hash.replace(/^#\//, '').trim() || 'dashboard';

        // Find the target view ID; fall back to dashboard view
        const targetViewId = routeMap[routeKey] || routeMap['dashboard'];

        // Hide all views, show the matching one
        document.querySelectorAll('.dashboard-view').forEach(view => {
            view.style.display = 'none';
        });

        if (targetViewId) {
            const targetView = document.getElementById(targetViewId);
            if (targetView) {
                targetView.style.display = 'block';
            }
        }

        // Sync sidebar active states
        document.querySelectorAll('.sidebar-item').forEach(item => {
            const itemRoute = item.getAttribute('data-route');
            if (itemRoute === routeKey || (routeKey === '' && itemRoute === 'dashboard')) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // Set default hash if none present
    if (!window.location.hash) {
        window.location.hash = '#/dashboard';
    }

    // Run router on load and on every hash change
    handleRouting();
    window.addEventListener('hashchange', handleRouting);

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
        let myOrders = [];

        async function loadCustomerOrders() {
            try {
                const data = await API.get('/api/orders/my');
                if (data.success && customerOrdersTable) {
                    myOrders = data.orders;
                    customerOrdersTable.innerHTML = '';

                    if (data.orders.length === 0) {
                        customerOrdersTable.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">You have placed no campus orders yet. Go to catalog.</td></tr>`;
                        return;
                    }

                    data.orders.forEach(o => {
                        const tr = document.createElement('tr');
                        const date = new Date(o.created_at).toLocaleDateString();
                        const isDispatched = o.status === 'DISPATCHED';

                        const itemsHtml = o.items.map(i => {
                            const imgHtml = i.image_url 
                                ? `<img src="${i.image_url}" style="width: 28px; height: 28px; border-radius: 4px; object-fit: cover; border: 1px solid var(--border-glass); vertical-align: middle; margin-right: 8px;">`
                                : `<div style="display: inline-flex; width: 28px; height: 28px; border-radius: 4px; background: #111827; align-items: center; justify-content: center; font-size: 0.65rem; border: 1px solid var(--border-glass); vertical-align: middle; margin-right: 8px;">📦</div>`;
                            return `<div style="display: flex; align-items: center; margin-bottom: 6px;">${imgHtml}<span>${i.product_name} (x${i.quantity})</span></div>`;
                        }).join('');

                        tr.innerHTML = `
                            <td>#${o.id}</td>
                            <td>${date}</td>
                            <td>${itemsHtml}</td>
                            <td>$${o.total_amount.toFixed(2)}</td>
                            <td>
                                <span class="badge ${o.status === 'COMPLETED' ? 'badge-success' : o.status === 'REJECTED' ? 'badge-danger' : o.status === 'REJECTED' ? 'badge-danger' : 'badge-pending'}">${o.status}</span>
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
            const order = myOrders.find(o => o.id === orderId);
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
            stepProgressBar.style.setProperty('--vertical-progress', progressWidth);

            // Render confirm package area
            if (status === 'DISPATCHED') {
                confirmReceiptArea.style.display = 'block';
            } else {
                confirmReceiptArea.style.display = 'none';
            }

            // Render Shipment Timeline Area
            const timelineArea = document.getElementById('timelineArea');
            const timelineList = document.getElementById('timelineList');
            if (timelineArea && timelineList && order) {
                timelineArea.style.display = 'block';
                timelineList.innerHTML = '';

                // Helper to format Date
                const formatDate = (dateStr) => {
                    if (!dateStr) return '';
                    const date = new Date(dateStr);
                    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                };

                // Define timeline stages
                const stages = [
                    {
                        key: 'PENDING',
                        status: 'Order Submitted',
                        desc: 'Order placed by customer and sent to queue for review.',
                        date: order.created_at
                    },
                    {
                        key: 'APPROVED',
                        status: 'Order Approved',
                        desc: 'Service team approved order. Directed to seller.',
                        date: (status !== 'PENDING' && status !== 'REJECTED') ? new Date(new Date(order.created_at).getTime() + 45 * 60000).toISOString() : null
                    },
                    {
                        key: 'DELIVERED_TO_WAREHOUSE',
                        status: 'In Warehouse',
                        desc: 'Seller delivered physical items to central warehouse ledger.',
                        date: order.warehouse_arrival_date
                    },
                    {
                        key: 'VERIFIED_IN_WAREHOUSE',
                        status: 'Quality Checked',
                        desc: 'Physical audit and quality match verification complete.',
                        date: (order.warehouse_arrival_date && (status === 'VERIFIED_IN_WAREHOUSE' || status === 'DISPATCHED' || status === 'COMPLETED')) ? new Date(new Date(order.warehouse_arrival_date).getTime() + 60 * 60000).toISOString() : null
                    },
                    {
                        key: 'DISPATCHED',
                        status: 'In-Transit',
                        desc: 'Assigned courier and dispatched to dorm/campus hub.',
                        date: order.dispatch_date
                    },
                    {
                        key: 'COMPLETED',
                        status: 'Delivered',
                        desc: 'Physical package receipt confirmed by customer.',
                        date: status === 'COMPLETED' ? new Date(new Date(order.dispatch_date || order.created_at).getTime() + 120 * 60000).toISOString() : null
                    }
                ];

                stages.forEach((stage, idx) => {
                    const item = document.createElement('div');
                    
                    let stageClass = '';
                    let displayDate = '';

                    if (stage.date) {
                        stageClass = 'completed';
                        displayDate = formatDate(stage.date);
                    } else if (
                        (idx === 0 && status === 'PENDING') ||
                        (idx === 1 && status === 'APPROVED') ||
                        (idx === 2 && status === 'DELIVERED_TO_WAREHOUSE') ||
                        (idx === 3 && status === 'VERIFIED_IN_WAREHOUSE') ||
                        (idx === 4 && status === 'DISPATCHED')
                    ) {
                        stageClass = 'active';
                        displayDate = 'In Progress';
                    } else {
                        stageClass = 'pending';
                        displayDate = 'Pending';
                    }

                    item.className = `timeline-item ${stageClass}`;
                    item.innerHTML = `
                        <div class="timeline-dot"></div>
                        <div class="timeline-content">
                            <div>
                                <div class="timeline-status">${stage.status}</div>
                                <div class="timeline-desc">${stage.desc}</div>
                            </div>
                            <div class="timeline-timestamp">${displayDate}</div>
                        </div>
                    `;
                    timelineList.appendChild(item);
                });
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

        // Image upload inputs and toggles
        const toggleNewFileBtn = document.getElementById('toggleNewFileBtn');
        const toggleNewUrlBtn = document.getElementById('toggleNewUrlBtn');
        const newFileGroup = document.getElementById('newFileGroup');
        const newUrlGroup = document.getElementById('newUrlGroup');
        const newProdImageFile = document.getElementById('newProdImageFile');
        const newProdImageUrl = document.getElementById('newProdImageUrl');

        const toggleEditFileBtn = document.getElementById('toggleEditFileBtn');
        const toggleEditUrlBtn = document.getElementById('toggleEditUrlBtn');
        const editFileGroup = document.getElementById('editFileGroup');
        const editUrlGroup = document.getElementById('editUrlGroup');
        const editProdImageFile = document.getElementById('editProdImageFile');
        const editProdImageUrl = document.getElementById('editProdImageUrl');

        let newUploadMode = 'file'; // 'file' or 'url'
        let editUploadMode = 'file'; // 'file' or 'url'

        // Dynamic chart control states
        let activeSellerChartTab = 'revenue';
        let sellerProducts = [];
        let sellerOrders = [];

        // Bind image toggle event listeners
        if (toggleNewFileBtn && toggleNewUrlBtn) {
            toggleNewFileBtn.addEventListener('click', () => {
                newUploadMode = 'file';
                toggleNewFileBtn.classList.add('active');
                toggleNewUrlBtn.classList.remove('active');
                newFileGroup.style.display = 'block';
                newUrlGroup.style.display = 'none';
            });
            toggleNewUrlBtn.addEventListener('click', () => {
                newUploadMode = 'url';
                toggleNewUrlBtn.classList.add('active');
                toggleNewFileBtn.classList.remove('active');
                newUrlGroup.style.display = 'block';
                newFileGroup.style.display = 'none';
            });
        }

        if (toggleEditFileBtn && toggleEditUrlBtn) {
            toggleEditFileBtn.addEventListener('click', () => {
                editUploadMode = 'file';
                toggleEditFileBtn.classList.add('active');
                toggleEditUrlBtn.classList.remove('active');
                editFileGroup.style.display = 'block';
                editUrlGroup.style.display = 'none';
            });
            toggleEditUrlBtn.addEventListener('click', () => {
                editUploadMode = 'url';
                toggleEditUrlBtn.classList.add('active');
                toggleEditFileBtn.classList.remove('active');
                editUrlGroup.style.display = 'block';
                editFileGroup.style.display = 'none';
            });
        }

        // Bind interactive SVG chart tabs
        const chartTabRevenue = document.getElementById('chartTabRevenue');
        const chartTabOrders = document.getElementById('chartTabOrders');
        const chartTabInventory = document.getElementById('chartTabInventory');

        if (chartTabRevenue && chartTabOrders && chartTabInventory) {
            chartTabRevenue.addEventListener('click', () => {
                activeSellerChartTab = 'revenue';
                chartTabRevenue.classList.add('active');
                chartTabOrders.classList.remove('active');
                chartTabInventory.classList.remove('active');
                triggerChartRender();
            });
            chartTabOrders.addEventListener('click', () => {
                activeSellerChartTab = 'orders';
                chartTabOrders.classList.add('active');
                chartTabRevenue.classList.remove('active');
                chartTabInventory.classList.remove('active');
                triggerChartRender();
            });
            chartTabInventory.addEventListener('click', () => {
                activeSellerChartTab = 'inventory';
                chartTabInventory.classList.add('active');
                chartTabOrders.classList.remove('active');
                chartTabRevenue.classList.remove('active');
                triggerChartRender();
            });
        }

        function triggerChartRender() {
            renderSellerCharts(sellerProducts, sellerOrders);
        }

        // Render interactive SVG charts dynamically
        function renderSellerCharts(products, orders) {
            const chartBox = document.getElementById('sellerAnalyticsChart');
            if (!chartBox) return;

            chartBox.innerHTML = '';
            
            let tooltip = chartBox.querySelector('.chart-tooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.className = 'chart-tooltip';
                chartBox.appendChild(tooltip);
            }

            if (activeSellerChartTab === 'revenue') {
                // Line chart for last 7 calendar days
                const last7Days = [];
                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    last7Days.push({
                        dateStr: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
                        key: d.toISOString().split('T')[0],
                        revenue: 0
                    });
                }

                const completedOrders = orders.filter(o => o.status === 'COMPLETED');
                completedOrders.forEach(o => {
                    const orderDate = new Date(o.created_at).toISOString().split('T')[0];
                    const dayMatch = last7Days.find(day => day.key === orderDate);
                    if (dayMatch) {
                        const sellerRev = o.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                        dayMatch.revenue += sellerRev;
                    }
                });

                let cumulativeRevenue = 0;
                const points = last7Days.map((day, idx) => {
                    cumulativeRevenue += day.revenue;
                    return {
                        label: day.dateStr,
                        value: cumulativeRevenue
                    };
                });

                const maxVal = Math.max(...points.map(p => p.value), 100);
                const svgW = 600;
                const svgH = 260;
                const padding = 40;
                const plotW = svgW - padding * 2;
                const plotH = svgH - padding * 2;

                const coords = points.map((p, idx) => {
                    const x = padding + (idx * (plotW / (points.length - 1)));
                    const y = padding + plotH - ((p.value / maxVal) * plotH);
                    return { x, y, label: p.label, value: p.value };
                });

                let linePath = `M ${coords[0].x} ${coords[0].y}`;
                let areaPath = `M ${coords[0].x} ${coords[0].y}`;
                for (let i = 1; i < coords.length; i++) {
                    linePath += ` L ${coords[i].x} ${coords[i].y}`;
                    areaPath += ` L ${coords[i].x} ${coords[i].y}`;
                }
                areaPath += ` L ${coords[coords.length - 1].x} ${padding + plotH} L ${coords[0].x} ${padding + plotH} Z`;

                let gridLines = '';
                for (let i = 0; i <= 4; i++) {
                    const yVal = padding + (i * (plotH / 4));
                    const labelVal = maxVal - (i * (maxVal / 4));
                    gridLines += `
                        <line class="chart-grid-line" x1="${padding}" y1="${yVal}" x2="${svgW - padding}" y2="${yVal}" />
                        <text x="${padding - 10}" y="${yVal + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">$${Math.round(labelVal)}</text>
                    `;
                }

                let bottomLabels = '';
                coords.forEach((c, idx) => {
                    bottomLabels += `
                        <text x="${c.x}" y="${padding + plotH + 20}" fill="var(--text-muted)" font-size="9" text-anchor="middle">${c.label}</text>
                    `;
                });

                let interactiveCircles = '';
                coords.forEach((c, idx) => {
                    interactiveCircles += `
                        <circle class="chart-point" cx="${c.x}" cy="${c.y}" r="4" fill="var(--success)" stroke="#0d121f" stroke-width="2" 
                                data-label="${c.label}" data-value="$${c.value.toFixed(2)}" />
                    `;
                });

                chartBox.innerHTML += `
                    <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="280">
                        <defs>
                            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="var(--success)" stop-opacity="0.3" />
                                <stop offset="100%" stop-color="var(--success)" stop-opacity="0" />
                            </linearGradient>
                        </defs>
                        ${gridLines}
                        ${bottomLabels}
                        <path class="chart-area" d="${areaPath}" fill="url(#chartGrad)" />
                        <path class="chart-line" d="${linePath}" stroke="var(--success)" stroke-width="3" fill="none" />
                        ${interactiveCircles}
                    </svg>
                `;

            } else if (activeSellerChartTab === 'orders') {
                // Bar chart of orders by status
                const statusMap = {
                    'PENDING': { label: 'Pending', count: 0, color: 'var(--primary)' },
                    'APPROVED': { label: 'Approved', count: 0, color: 'var(--accent)' },
                    'IN-TRANSIT': { label: 'In-Transit', count: 0, color: 'var(--warning)' },
                    'COMPLETED': { label: 'Completed', count: 0, color: 'var(--success)' }
                };

                orders.forEach(o => {
                    if (o.status === 'PENDING') statusMap.PENDING.count++;
                    else if (o.status === 'APPROVED') statusMap.APPROVED.count++;
                    else if (o.status === 'COMPLETED') statusMap.COMPLETED.count++;
                    else statusMap['IN-TRANSIT'].count++;
                });

                const data = Object.values(statusMap);
                const maxVal = Math.max(...data.map(d => d.count), 5);
                const svgW = 600;
                const svgH = 260;
                const padding = 40;
                const plotW = svgW - padding * 2;
                const plotH = svgH - padding * 2;
                const barWidth = (plotW / data.length) * 0.6;
                const barSpacing = (plotW / data.length);

                let bars = '';
                let labels = '';
                let gridLines = '';

                for (let i = 0; i <= 4; i++) {
                    const yVal = padding + (i * (plotH / 4));
                    const labelVal = maxVal - (i * (maxVal / 4));
                    gridLines += `
                        <line class="chart-grid-line" x1="${padding}" y1="${yVal}" x2="${svgW - padding}" y2="${yVal}" />
                        <text x="${padding - 10}" y="${yVal + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">${Math.round(labelVal)}</text>
                    `;
                }

                data.forEach((d, idx) => {
                    const x = padding + (idx * barSpacing) + (barSpacing - barWidth) / 2;
                    const h = (d.count / maxVal) * plotH;
                    const y = padding + plotH - h;

                    bars += `
                        <rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="4" fill="${d.color}" 
                              data-label="${d.label}" data-value="${d.count} orders" />
                        <text x="${x + barWidth / 2}" y="${y - 6}" fill="var(--text-primary)" font-size="9" font-weight="700" text-anchor="middle">${d.count}</text>
                    `;
                    labels += `
                        <text x="${x + barWidth / 2}" y="${padding + plotH + 20}" fill="var(--text-muted)" font-size="9" text-anchor="middle">${d.label}</text>
                    `;
                });

                chartBox.innerHTML += `
                    <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="280">
                        ${gridLines}
                        ${bars}
                        ${labels}
                    </svg>
                `;

            } else if (activeSellerChartTab === 'inventory') {
                // Donut category breakdown
                const catMap = {};
                products.forEach(p => {
                    const catName = p.category_name || 'General';
                    catMap[catName] = (catMap[catName] || 0) + 1;
                });

                const categories = Object.entries(catMap).map(([name, count]) => ({ name, count }));
                
                if (categories.length === 0) {
                    chartBox.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No catalog inventory available to map.</div>`;
                    return;
                }

                const total = products.length;
                const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

                let cumulativePercent = 0;
                let slicesSvg = '';
                let legendHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; width: 100%; border-top: var(--border-glass); padding-top: 16px;">';

                categories.forEach((cat, idx) => {
                    const percent = cat.count / total;
                    const dashArray = 2 * Math.PI * 40;
                    const dashOffset = dashArray * (1 - percent);
                    const rotation = 360 * cumulativePercent;
                    cumulativePercent += percent;
                    const color = colors[idx % colors.length];

                    slicesSvg += `
                        <circle class="donut-slice" cx="50" cy="50" r="40" fill="transparent" stroke="${color}" stroke-width="8"
                                stroke-dasharray="${dashArray}" 
                                stroke-dashoffset="${dashOffset}"
                                transform="rotate(${rotation} 50 50)"
                                stroke-linecap="round"
                                data-label="${cat.name}" data-value="${cat.count} items (${Math.round(percent * 100)}%)" />
                    `;

                    legendHtml += `
                        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem;">
                            <span style="display: inline-flex; align-items: center; gap: 6px; color: var(--text-secondary);">
                                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${color};"></span>
                                ${cat.name}
                            </span>
                            <span style="font-weight: 700; color: var(--text-primary);">${cat.count}</span>
                        </div>
                    `;
                });
                legendHtml += '</div>';

                chartBox.innerHTML += `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; margin: 0 auto; width: 100%; max-width: 320px;">
                        <svg viewBox="0 0 100 100" width="100%" height="180" style="transform: rotate(-90deg); filter: drop-shadow(0px 0px 8px rgba(99, 102, 241, 0.15));">
                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.03)" stroke-width="8"/>
                            ${slicesSvg}
                        </svg>
                        ${legendHtml}
                    </div>
                `;
            }

            const tooltipNode = chartBox.querySelector('.chart-tooltip');
            chartBox.querySelectorAll('.chart-point, .chart-bar, .donut-slice').forEach(el => {
                el.addEventListener('mouseenter', (e) => {
                    const label = e.target.getAttribute('data-label');
                    const val = e.target.getAttribute('data-value');
                    tooltipNode.innerHTML = `<strong>${label}</strong><br/>${val}`;
                    tooltipNode.style.opacity = '1';
                });

                el.addEventListener('mousemove', (e) => {
                    const rect = chartBox.getBoundingClientRect();
                    const x = e.clientX - rect.left + 15;
                    const y = e.clientY - rect.top - 40;
                    tooltipNode.style.left = `${x}px`;
                    tooltipNode.style.top = `${y}px`;
                });

                el.addEventListener('mouseleave', () => {
                    tooltipNode.style.opacity = '0';
                });
            });
        }

        async function loadCategoriesForDropdown() {
            try {
                const res = await API.get('/api/categories');
                if (res.success && res.categories) {
                    const newSelect = document.getElementById('newProdCategory');
                    const editSelect = document.getElementById('editProdCategory');
                    
                    if (newSelect && editSelect) {
                        newSelect.innerHTML = '<option value="">Select Category</option>';
                        editSelect.innerHTML = '<option value="">Select Category</option>';
                        
                        res.categories.forEach(cat => {
                            const opt1 = document.createElement('option');
                            opt1.value = cat.id;
                            opt1.innerText = cat.name;
                            newSelect.appendChild(opt1);
                            
                            const opt2 = document.createElement('option');
                            opt2.value = cat.id;
                            opt2.innerText = cat.name;
                            editSelect.appendChild(opt2);
                        });
                    }
                }
            } catch (e) {
                console.error('Failed to load categories for dropdowns:', e);
            }
        }

        async function loadSellerDashboard() {
            try {
                // 1. Fetch seller's products
                const prodData = await API.get('/api/products/my');
                if (prodData.success) {
                    sellerProducts = prodData.products;
                    if (sellerProductsTable) {
                        sellerProductsTable.innerHTML = '';
                        statSellerTotalProducts.innerText = sellerProducts.length;

                        sellerProducts.forEach(p => {
                            const tr = document.createElement('tr');
                            
                            const imgHtml = p.image_url 
                                ? `<img src="${p.image_url}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover; border: 1px solid var(--border-glass);" onerror="this.src='/uploads/placeholder.png';">`
                                : `<div style="width: 40px; height: 40px; border-radius: 4px; background: #111827; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; border: 1px solid var(--border-glass);">📦</div>`;

                            tr.innerHTML = `
                                <td>#${p.id}</td>
                                <td>${imgHtml}</td>
                                <td>${p.name}</td>
                                <td><span class="badge" style="background: rgba(99,102,241,0.1); color: var(--primary); border: none;">${p.category_name || 'General'}</span></td>
                                <td>$${p.price.toFixed(2)}</td>
                                <td>${p.stock} units</td>
                                <td>
                                    <span class="badge ${p.is_active === 1 ? 'badge-success' : 'badge-danger'}">
                                        ${p.is_active === 1 ? 'Active' : 'Deactivated'}
                                    </span>
                                </td>
                                <td>
                                    <button class="btn btn-secondary btn-sm editStockBtn" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-stock="${p.stock}" data-category="${p.category_id || ''}" data-image="${p.image_url || ''}" style="padding: 6px 12px; font-size: 0.75rem;">Modify</button>
                                    <button class="btn btn-danger btn-sm deleteProductBtn" data-id="${p.id}" style="padding: 6px 12px; font-size: 0.75rem;">Deactivate</button>
                                </td>
                            `;
                            sellerProductsTable.appendChild(tr);
                        });

                        bindProductActions();
                    }
                }

                // 2. Fetch assigned incoming orders
                const ordData = await API.get('/api/orders/my');
                if (ordData.success) {
                    sellerOrders = ordData.orders;
                    if (sellerOrdersTable) {
                        sellerOrdersTable.innerHTML = '';
                        let activeCount = 0;

                        sellerOrders.forEach(o => {
                            if (o.status === 'APPROVED') activeCount++;

                            const tr = document.createElement('tr');
                            
                            const itemsHtml = o.items.map(i => {
                                const imgHtml = i.image_url 
                                    ? `<img src="${i.image_url}" style="width: 28px; height: 28px; border-radius: 4px; object-fit: cover; border: 1px solid var(--border-glass); vertical-align: middle; margin-right: 8px;">`
                                    : `<div style="display: inline-flex; width: 28px; height: 28px; border-radius: 4px; background: #111827; align-items: center; justify-content: center; font-size: 0.65rem; border: 1px solid var(--border-glass); vertical-align: middle; margin-right: 8px;">📦</div>`;
                                return `<div style="display: flex; align-items: center; margin-bottom: 6px;">${imgHtml}<span>${i.product_name} (x${i.quantity})</span></div>`;
                            }).join('');

                            tr.innerHTML = `
                                <td>#${o.id}</td>
                                <td>${o.customer_name}</td>
                                <td>${itemsHtml}</td>
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

                    // Calculate completed sales revenue
                    const completedOrders = sellerOrders.filter(o => o.status === 'COMPLETED');
                    const totalRevenue = completedOrders.reduce((sum, o) => {
                        return sum + o.items.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
                    }, 0);
                    
                    const statSellerRevenue = document.getElementById('statSellerRevenue');
                    if (statSellerRevenue) {
                        statSellerRevenue.innerText = `$${totalRevenue.toFixed(2)}`;
                    }

                    // Trigger dynamic charts render
                    triggerChartRender();
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
                const categoryId = parseInt(document.getElementById('newProdCategory').value);

                if (!categoryId) {
                    alert('Please select a product category.');
                    return;
                }

                let imageUrl = '';
                const publishBtn = uploadForm.querySelector('button[type="submit"]');

                try {
                    publishBtn.disabled = true;
                    publishBtn.innerText = 'Publishing...';

                    if (newUploadMode === 'file' && newProdImageFile.files.length > 0) {
                        const formData = new FormData();
                        formData.append('image', newProdImageFile.files[0]);
                        const uploadRes = await API.uploadFile('/api/upload/product-image', formData);
                        if (uploadRes.success) {
                            imageUrl = uploadRes.url;
                        }
                    } else if (newUploadMode === 'url') {
                        imageUrl = newProdImageUrl.value.trim();
                    }

                    const data = await API.post('/api/products', { name, description, price, stock, categoryId, imageUrl });
                    if (data.success) {
                        uploadForm.reset();
                        if (newProdImageFile) newProdImageFile.value = '';
                        if (newProdImageUrl) newProdImageUrl.value = '';
                        if (toggleNewFileBtn) toggleNewFileBtn.click();
                        loadSellerDashboard();
                    }
                } catch (err) {
                    alert(err.message);
                } finally {
                    publishBtn.disabled = false;
                    publishBtn.innerText = 'Publish Product Listing';
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
                    const categoryId = btn.getAttribute('data-category');
                    const imageUrl = btn.getAttribute('data-image');

                    document.getElementById('editProdId').value = id;
                    document.getElementById('editProdName').value = name;
                    document.getElementById('editProdPrice').value = price;
                    document.getElementById('editProdStock').value = stock;
                    
                    const catSelect = document.getElementById('editProdCategory');
                    if (catSelect) {
                        catSelect.value = categoryId || '';
                    }

                    if (editProdImageUrl) {
                        editProdImageUrl.value = imageUrl || '';
                        editProdImageUrl.setAttribute('data-original-image', imageUrl || '');
                    }

                    if (editProdImageFile) {
                        editProdImageFile.value = '';
                    }

                    if (imageUrl && !imageUrl.startsWith('blob:') && toggleEditUrlBtn) {
                        toggleEditUrlBtn.click();
                    } else if (toggleEditFileBtn) {
                        toggleEditFileBtn.click();
                    }

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
                const categoryId = parseInt(document.getElementById('editProdCategory').value);

                if (!categoryId) {
                    alert('Please select a product category.');
                    return;
                }

                let imageUrl = '';
                const originalImage = editProdImageUrl.getAttribute('data-original-image') || '';
                const applyBtn = editForm.querySelector('button[type="submit"]');

                try {
                    applyBtn.disabled = true;
                    applyBtn.innerText = 'Applying...';

                    if (editUploadMode === 'file' && editProdImageFile.files.length > 0) {
                        const formData = new FormData();
                        formData.append('image', editProdImageFile.files[0]);
                        const uploadRes = await API.uploadFile('/api/upload/product-image', formData);
                        if (uploadRes.success) {
                            imageUrl = uploadRes.url;
                        }
                    } else if (editUploadMode === 'url') {
                        imageUrl = editProdImageUrl.value.trim();
                    } else {
                        imageUrl = originalImage;
                    }

                    if (!imageUrl && editUploadMode === 'file') {
                        imageUrl = originalImage;
                    }

                    const data = await API.put('/api/products', { id, name, price, stock, categoryId, imageUrl });
                    if (data.success) {
                        editModal.classList.remove('active');
                        if (editProdImageFile) editProdImageFile.value = '';
                        if (editProdImageUrl) editProdImageUrl.value = '';
                        loadSellerDashboard();
                    }
                } catch (err) {
                    alert(err.message);
                } finally {
                    applyBtn.disabled = false;
                    applyBtn.innerText = 'Apply Specifications';
                }
            });
        }

        loadCategoriesForDropdown();
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

                        const itemsHtml = o.items.map(i => {
                            const imgHtml = i.image_url 
                                ? `<img src="${i.image_url}" style="width: 28px; height: 28px; border-radius: 4px; object-fit: cover; border: 1px solid var(--border-glass); vertical-align: middle; margin-right: 8px;">`
                                : `<div style="display: inline-flex; width: 28px; height: 28px; border-radius: 4px; background: #111827; align-items: center; justify-content: center; font-size: 0.65rem; border: 1px solid var(--border-glass); vertical-align: middle; margin-right: 8px;">📦</div>`;
                            return `<div style="display: flex; align-items: center; margin-bottom: 6px;">${imgHtml}<span>${i.product_name} (x${i.quantity})</span></div>`;
                        }).join('');

                        tr.innerHTML = `
                            <td>#${o.id}</td>
                            <td>${o.customer_name}</td>
                            <td>${itemsHtml}</td>
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
