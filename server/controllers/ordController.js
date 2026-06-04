/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * ORDER WORKFLOW CONTROLLER (COORDINATED LOGISTICS ENGINE)
 * ====================================================================
 * 
 * Orchestrates the full transactional lifecycle of role-based orders:
 * 1. Customer places order (Pending)
 * 2. Service Team reviews order (Approve/Reject)
 * 3. Seller delivers physical stock to Central Warehouse (Delivered to Warehouse)
 * 4. Service Team audits and verifies quantities (Verified in Warehouse)
 * 5. Service Team assigns courier and dispatches package (Dispatched)
 * 6. Customer confirms physical arrival (Completed)
 */

const db = require('../database/connection');
const responseUtils = require('../utils/responseUtils');

// Helper to push a notification record into database
async function createNotification(userId, message, mockDbRef = null) {
    if (db.isMockMode()) {
        const mock = mockDbRef || db.getMock();
        mock.insert('notifications', {
            user_id: Number(userId),
            message,
            is_read: 0
        });
    } else {
        await db.execute(
            'INSERT INTO notifications (user_id, message, is_read) VALUES (:1, :2, 0)',
            [userId, message]
        );
    }
}

module.exports = {
    /**
     * POST /api/orders
     * Protected (Customer only): Places a new order.
     */
    async createOrder(req, res) {
        const customerId = req.user.userId;
        const { items } = req.body || {}; // items is array of { productId, quantity }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return responseUtils.sendError(res, 400, 'Empty Checkout', 'Your shopping cart must contain at least one item.');
        }

        try {
            const mock = db.getMock();
            let totalAmount = 0;
            const itemsToPurchase = [];

            // 1. Validate stocks and fetch prices
            for (let item of items) {
                const pId = Number(item.productId);
                const qty = parseInt(item.quantity);

                if (isNaN(qty) || qty <= 0) {
                    return responseUtils.sendError(res, 400, 'Invalid Quantity', 'Purchase quantity must be greater than zero.');
                }

                let product = null;
                if (db.isMockMode()) {
                    product = mock.selectOne('products', p => p.id === pId && p.is_active === 1);
                } else {
                    const rows = await db.query('SELECT id, price, stock, seller_id, name FROM products WHERE id = :1 AND is_active = 1', [pId]);
                    if (rows.length > 0) {
                        product = {
                            id: rows[0].ID,
                            price: Number(rows[0].PRICE),
                            stock: Number(rows[0].STOCK),
                            seller_id: rows[0].SELLER_ID,
                            name: rows[0].NAME
                        };
                    }
                }

                if (!product) {
                    return responseUtils.sendError(res, 404, 'Product Not Available', `The selected item (ID: ${pId}) is no longer active in the catalog.`);
                }

                if (product.stock < qty) {
                    return responseUtils.sendError(res, 409, 'Stock Discrepancy', `Insufficient stock for product "${product.name}". Requested: ${qty}, In-Stock: ${product.stock}`);
                }

                const itemTotal = product.price * qty;
                totalAmount += itemTotal;

                itemsToPurchase.push({
                    product,
                    quantity: qty,
                    price: product.price
                });
            }

            // 2. Perform checkout transactions
            let orderId = null;

            if (db.isMockMode()) {
                // Insert order
                const newOrder = mock.insert('orders', {
                    customer_id: customerId,
                    total_amount: totalAmount,
                    status: 'PENDING'
                });
                orderId = newOrder.id;

                // Insert items and decrement stocks
                for (let purchase of itemsToPurchase) {
                    mock.insert('order_items', {
                        order_id: orderId,
                        product_id: purchase.product.id,
                        quantity: purchase.quantity,
                        price: purchase.price
                    });

                    // Decrement stock
                    const currentStock = purchase.product.stock;
                    mock.update('products', p => p.id === purchase.product.id, {
                        stock: currentStock - purchase.quantity
                    });
                }

                // Initialize delivery channel
                mock.insert('deliveries', {
                    order_id: orderId,
                    status: 'PENDING',
                    assigned_service_id: null
                });

            } else {
                // Oracle DB transactional inserts
                const resOrder = await db.execute(
                    'INSERT INTO orders (customer_id, total_amount, status) VALUES (:1, :2, \'PENDING\')',
                    [customerId, totalAmount]
                );
                // Oracle standard returns insert IDs or sequences can be fetched. For safety, we resolve ID:
                const latest = await db.query('SELECT MAX(id) as last_id FROM orders WHERE customer_id = :1', [customerId]);
                orderId = Number(latest[0].LAST_ID);

                for (let purchase of itemsToPurchase) {
                    // Insert items
                    await db.execute(
                        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (:1, :2, :3, :4)',
                        [orderId, purchase.product.id, purchase.quantity, purchase.price]
                    );

                    // Decrement stock
                    await db.execute(
                        'UPDATE products SET stock = stock - :1 WHERE id = :2',
                        [purchase.quantity, purchase.product.id]
                    );
                }

                // Initialize delivery
                await db.execute(
                    'INSERT INTO deliveries (order_id, status) VALUES (:1, \'PENDING\')',
                    [orderId]
                );
            }

            // 3. Dispatch Notifications
            // Alert Customer
            await createNotification(customerId, `Your order #${orderId} for $${totalAmount.toFixed(2)} has been successfully submitted and is awaiting Service Team approval.`);

            // Alert Service Team members
            let serviceUsers = [];
            if (db.isMockMode()) {
                serviceUsers = mock.select('users', u => u.role_id === 4);
            } else {
                const rows = await db.query('SELECT id FROM users WHERE role_id = 4');
                serviceUsers = rows.map(r => ({ id: r.ID }));
            }

            for (let svc of serviceUsers) {
                await createNotification(svc.id, `New order pending verification: Order #${orderId} was submitted by student customer.`);
            }

            return responseUtils.sendJSON(res, 201, {
                success: true,
                message: 'Order successfully placed. Awaiting operational approval.',
                orderId
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Checkout Transaction Failed', error.message);
        }
    },

    /**
     * GET /api/orders/my
     * Protected (All Roles): Fetches relevant order list based on role scopes.
     */
    async getMyOrders(req, res) {
        const { userId, roleId } = req.user;

        try {
            let ordersList = [];
            const mock = db.getMock();

            if (db.isMockMode()) {
                const allOrders = mock.getTable('orders');
                const allItems = mock.getTable('order_items');
                const allProducts = mock.getTable('products');
                const allUsers = mock.getTable('users');
                const allDeliveries = mock.getTable('deliveries');

                // Scope criteria
                let scopedOrders = [];
                if (roleId === 1 || roleId === 4) {
                    // Admin & Service see everything
                    scopedOrders = allOrders;
                } else if (roleId === 3) {
                    // Customer sees their own
                    scopedOrders = allOrders.filter(o => o.customer_id === userId);
                } else if (roleId === 2) {
                    // Seller sees orders containing their products
                    const sellerProdIds = allProducts.filter(p => p.seller_id === userId).map(p => p.id);
                    const matchingOrderIds = allItems.filter(item => sellerProdIds.includes(item.product_id)).map(item => item.order_id);
                    scopedOrders = allOrders.filter(o => matchingOrderIds.includes(o.id));
                }

                // Denormalize records with details
                ordersList = scopedOrders.map(o => {
                    const customer = allUsers.find(u => u.id === o.customer_id);
                    const delivery = allDeliveries.find(d => d.order_id === o.id);
                    
                    // Fetch order items and expand details
                    const oItems = allItems.filter(item => item.order_id === o.id).map(item => {
                        const prod = allProducts.find(p => p.id === item.product_id);
                        return {
                            ...item,
                            product_name: prod ? prod.name : 'Unknown Product',
                            seller_id: prod ? prod.seller_id : null,
                            image_url: prod ? prod.image_url : null
                        };
                    });

                    // If user is Seller, filter items to show only theirs
                    const filteredItems = roleId === 2 
                        ? oItems.filter(item => item.seller_id === userId) 
                        : oItems;

                    return {
                        id: o.id,
                        customer_id: o.customer_id,
                        customer_name: customer ? customer.full_name : 'Student',
                        total_amount: o.total_amount,
                        status: o.status,
                        created_at: o.created_at,
                        items: filteredItems,
                        delivery_status: delivery ? delivery.status : 'PENDING',
                        warehouse_arrival_date: delivery ? delivery.warehouse_arrival_date : null,
                        dispatch_date: delivery ? delivery.dispatch_date : null
                    };
                });

            } else {
                // Oracle SQL implementation
                let sql = '';
                let binds = [];

                if (roleId === 1 || roleId === 4) {
                    sql = `
                        SELECT o.id, o.customer_id, u.full_name as customer_name, o.total_amount, o.status, o.created_at, 
                               d.status as delivery_status, d.warehouse_arrival_date, d.dispatch_date
                        FROM orders o
                        JOIN users u ON o.customer_id = u.id
                        LEFT JOIN deliveries d ON o.id = d.order_id
                        ORDER BY o.id DESC
                    `;
                } else if (roleId === 3) {
                    sql = `
                        SELECT o.id, o.customer_id, u.full_name as customer_name, o.total_amount, o.status, o.created_at, 
                               d.status as delivery_status, d.warehouse_arrival_date, d.dispatch_date
                        FROM orders o
                        JOIN users u ON o.customer_id = u.id
                        LEFT JOIN deliveries d ON o.id = d.order_id
                        WHERE o.customer_id = :1
                        ORDER BY o.id DESC
                    `;
                    binds.push(userId);
                } else if (roleId === 2) {
                    sql = `
                        SELECT DISTINCT o.id, o.customer_id, u.full_name as customer_name, o.total_amount, o.status, o.created_at, 
                                        d.status as delivery_status, d.warehouse_arrival_date, d.dispatch_date
                        FROM orders o
                        JOIN users u ON o.customer_id = u.id
                        JOIN order_items oi ON o.id = oi.order_id
                        JOIN products p ON oi.product_id = p.id
                        LEFT JOIN deliveries d ON o.id = d.order_id
                        WHERE p.seller_id = :1
                        ORDER BY o.id DESC
                    `;
                    binds.push(userId);
                }

                const rows = await db.query(sql, binds);
                ordersList = [];

                for (let row of rows) {
                    const oId = Number(row.ID);
                    
                    // Fetch items for this order
                    let itemSql = `
                        SELECT oi.id, oi.product_id, oi.quantity, oi.price, p.name as product_name, p.seller_id, p.image_url
                        FROM order_items oi
                        JOIN products p ON oi.product_id = p.id
                        WHERE oi.order_id = :1
                    `;
                    const itemBinds = [oId];
                    if (roleId === 2) {
                        itemSql += ' AND p.seller_id = :2';
                        itemBinds.push(userId);
                    }

                    const itemRows = await db.query(itemSql, itemBinds);
                    const items = itemRows.map(iRow => ({
                        id: Number(iRow.ID),
                        product_id: Number(iRow.PRODUCT_ID),
                        quantity: Number(iRow.QUANTITY),
                        price: Number(iRow.PRICE),
                        product_name: iRow.PRODUCT_NAME,
                        seller_id: Number(iRow.SELLER_ID),
                        image_url: iRow.IMAGE_URL
                    }));

                    ordersList.push({
                        id: oId,
                        customer_id: Number(row.CUSTOMER_ID),
                        customer_name: row.CUSTOMER_NAME,
                        total_amount: Number(row.TOTAL_AMOUNT),
                        status: row.STATUS,
                        created_at: row.CREATED_AT,
                        items,
                        delivery_status: row.DELIVERY_STATUS,
                        warehouse_arrival_date: row.WAREHOUSE_ARRIVAL_DATE || null,
                        dispatch_date: row.DISPATCH_DATE || null
                    });
                }
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                orders: ordersList
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Order Fetching Error', error.message);
        }
    },

    /**
     * PUT /api/orders/approve
     * Protected (Service Team only): Approves or rejects orders.
     */
    async approveOrder(req, res) {
        const { orderId, approve } = req.body || {}; // approve is boolean

        if (!orderId || approve === undefined) {
            return responseUtils.sendError(res, 400, 'Invalid Approval Data', 'Order ID and approval decision (approve: true/false) are required.');
        }

        const oId = Number(orderId);
        const nextStatus = approve ? 'APPROVED' : 'REJECTED';

        try {
            const mock = db.getMock();
            let order = null;

            if (db.isMockMode()) {
                order = mock.selectOne('orders', o => o.id === oId);
            } else {
                const rows = await db.query('SELECT customer_id, total_amount, status FROM orders WHERE id = :1', [oId]);
                if (rows.length > 0) order = { customer_id: Number(rows[0].CUSTOMER_ID), total_amount: Number(rows[0].TOTAL_AMOUNT), status: rows[0].STATUS };
            }

            if (!order) {
                return responseUtils.sendError(res, 404, 'Order Not Found', 'Target order could not be located.');
            }

            if (order.status !== 'PENDING') {
                return responseUtils.sendError(res, 400, 'Workflow Conflict', `Order #${oId} has already been reviewed. Current Status: ${order.status}`);
            }

            // Update database status
            if (db.isMockMode()) {
                mock.update('orders', o => o.id === oId, { status: nextStatus });
                if (!approve) {
                    // RESTORE STOCK IF REJECTED
                    const items = mock.select('order_items', oi => oi.order_id === oId);
                    for (let item of items) {
                        const prod = mock.selectOne('products', p => p.id === item.product_id);
                        if (prod) {
                            mock.update('products', p => p.id === prod.id, { stock: prod.stock + item.quantity });
                        }
                    }
                }
            } else {
                await db.execute('UPDATE orders SET status = :1 WHERE id = :2', [nextStatus, oId]);
                if (!approve) {
                    // Restore stock
                    const items = await db.query('SELECT product_id, quantity FROM order_items WHERE order_id = :1', [oId]);
                    for (let item of items) {
                        await db.execute('UPDATE products SET stock = stock + :1 WHERE id = :2', [Number(item.QUANTITY), Number(item.PRODUCT_ID)]);
                    }
                }
            }

            // Send notification to Customer
            await createNotification(
                order.customer_id, 
                approve 
                    ? `Good news! Your order #${oId} has been APPROVED by the Service Team and sent to the Sellers for packaging.`
                    : `We regret to inform you that your order #${oId} has been REJECTED by the Service Team. Stock holds have been released.`
            );

            if (approve) {
                // Alert Sellers of the items
                let sellerIds = [];
                if (db.isMockMode()) {
                    const items = mock.select('order_items', oi => oi.order_id === oId);
                    const prodIds = items.map(i => i.product_id);
                    sellerIds = mock.select('products', p => prodIds.includes(p.id)).map(p => p.seller_id);
                } else {
                    const rows = await db.query(
                        'SELECT DISTINCT p.seller_id FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = :1',
                        [oId]
                    );
                    sellerIds = rows.map(r => Number(r.SELLER_ID));
                }

                for (let sId of sellerIds) {
                    await createNotification(sId, `New operational directive: Incoming approved Order #${oId} has been assigned to you. Prepare items and dispatch to central warehouse.`);
                }
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                message: `Order #${oId} successfully marked as ${nextStatus}.`
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Order Approval Processing Failed', error.message);
        }
    },

    /**
     * PUT /api/orders/deliver-warehouse
     * Protected (Seller only): Confirm physical shipping from seller's site to Central Warehouse.
     */
    async deliverToWarehouse(req, res) {
        const sellerId = req.user.userId;
        const { orderId } = req.body || {};

        if (!orderId) {
            return responseUtils.sendError(res, 400, 'Order ID Required', 'Specify target order ID.');
        }

        const oId = Number(orderId);

        try {
            const mock = db.getMock();
            let order = null;
            let sellerItems = [];

            if (db.isMockMode()) {
                order = mock.selectOne('orders', o => o.id === oId);
                const items = mock.select('order_items', oi => oi.order_id === oId);
                const prodIds = items.map(i => i.product_id);
                sellerItems = mock.select('products', p => prodIds.includes(p.id) && p.seller_id === sellerId);
            } else {
                const rows = await db.query('SELECT status, customer_id FROM orders WHERE id = :1', [oId]);
                if (rows.length > 0) order = { status: rows[0].STATUS, customer_id: Number(rows[0].CUSTOMER_ID) };
                
                const rowsSeller = await db.query(
                    'SELECT oi.product_id, oi.quantity FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = :1 AND p.seller_id = :2',
                    [oId, sellerId]
                );
                sellerItems = rowsSeller.map(r => ({ id: Number(r.PRODUCT_ID), quantity: Number(r.QUANTITY) }));
            }

            if (!order) return responseUtils.sendError(res, 404, 'Order Not Found', 'Target order could not be located.');
            if (order.status !== 'APPROVED') return responseUtils.sendError(res, 400, 'Workflow Conflict', 'Only approved orders can be delivered to the warehouse.');
            if (sellerItems.length === 0) return responseUtils.sendError(res, 403, 'Unauthorized', 'You do not own any products contained in this order.');

            // Update Statuses
            const arrivalDate = new Date().toISOString();
            if (db.isMockMode()) {
                mock.update('orders', o => o.id === oId, { status: 'DELIVERED_TO_WAREHOUSE' });
                mock.update('deliveries', d => d.order_id === oId, {
                    status: 'ARRIVED_AT_WAREHOUSE',
                    warehouse_arrival_date: arrivalDate
                });

                // Populate warehouse ledger for service audit
                const allItems = mock.select('order_items', oi => oi.order_id === oId);
                for (let item of allItems) {
                    mock.insert('warehouse', {
                        product_id: item.product_id,
                        quantity: item.quantity,
                        location: 'Aisle-B',
                        verified_status: 'PENDING',
                        verified_by: null,
                        verified_at: null
                    });
                }
            } else {
                await db.execute('UPDATE orders SET status = \'DELIVERED_TO_WAREHOUSE\' WHERE id = :1', [oId]);
                await db.execute(
                    'UPDATE deliveries SET status = \'ARRIVED_AT_WAREHOUSE\', warehouse_arrival_date = CURRENT_TIMESTAMP WHERE order_id = :1',
                    [oId]
                );

                // Populate warehouse ledger
                const allItems = await db.query('SELECT product_id, quantity FROM order_items WHERE order_id = :1', [oId]);
                for (let item of allItems) {
                    await db.execute(
                        'INSERT INTO warehouse (product_id, quantity, location, verified_status) VALUES (:1, :2, \'Aisle-B\', \'PENDING\')',
                        [Number(item.PRODUCT_ID), Number(item.QUANTITY)]
                    );
                }
            }

            // Alert service team
            let serviceUsers = [];
            if (db.isMockMode()) {
                serviceUsers = mock.select('users', u => u.role_id === 4);
            } else {
                const rows = await db.query('SELECT id FROM users WHERE role_id = 4');
                serviceUsers = rows.map(r => ({ id: r.ID }));
            }
            for (let svc of serviceUsers) {
                await createNotification(svc.id, `Audit requirement: Seller has shipped items for Order #${oId} to Central Warehouse. Conduct verification.`);
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                message: 'Package registered at central warehouse. Awaiting quality audit.'
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Warehouse Shipping Registration Failed', error.message);
        }
    },

    /**
     * PUT /api/orders/verify-warehouse
     * Protected (Service Team only): Audit physical goods matching.
     */
    async verifyWarehouseReceipt(req, res) {
        const serviceId = req.user.userId;
        const { orderId, approved } = req.body || {}; // approved: true (quantity matched) or false (mismatch)

        if (!orderId || approved === undefined) {
            return responseUtils.sendError(res, 400, 'Verification Variables Missing', 'Order ID and auditing checks are mandatory.');
        }

        const oId = Number(orderId);

        try {
            const mock = db.getMock();
            let order = null;

            if (db.isMockMode()) {
                order = mock.selectOne('orders', o => o.id === oId);
            } else {
                const rows = await db.query('SELECT status, customer_id FROM orders WHERE id = :1', [oId]);
                if (rows.length > 0) order = { status: rows[0].STATUS, customer_id: Number(rows[0].CUSTOMER_ID) };
            }

            if (!order) return responseUtils.sendError(res, 404, 'Order Not Found', 'Target order could not be located.');
            if (order.status !== 'DELIVERED_TO_WAREHOUSE') {
                return responseUtils.sendError(res, 400, 'Workflow Conflict', 'Only warehouse-received packages can be verified.');
            }

            const verifiedStatus = approved ? 'VERIFIED' : 'DISCREPANCY';
            const nextStatus = approved ? 'VERIFIED_IN_WAREHOUSE' : 'PENDING'; // revert to pending if discrepancy

            if (db.isMockMode()) {
                mock.update('orders', o => o.id === oId, { status: nextStatus });
                mock.update('deliveries', d => d.order_id === oId, { status: verifiedStatus });
                
                // Update warehouse verified log
                const items = mock.select('order_items', oi => oi.order_id === oId);
                const prodIds = items.map(i => i.product_id);
                mock.update('warehouse', w => prodIds.includes(w.product_id) && w.verified_status === 'PENDING', {
                    verified_status: verifiedStatus,
                    verified_by: serviceId,
                    verified_at: new Date().toISOString()
                });
            } else {
                await db.execute('UPDATE orders SET status = :1 WHERE id = :2', [nextStatus, oId]);
                await db.execute('UPDATE deliveries SET status = :1 WHERE order_id = :2', [verifiedStatus, oId]);

                // Update warehouse
                const items = await db.query('SELECT product_id FROM order_items WHERE order_id = :1', [oId]);
                for (let item of items) {
                    await db.execute(
                        'UPDATE warehouse SET verified_status = :1, verified_by = :2, verified_at = CURRENT_TIMESTAMP WHERE product_id = :3 AND verified_status = \'PENDING\'',
                        [verifiedStatus, serviceId, Number(item.PRODUCT_ID)]
                    );
                }
            }

            // Notifications
            if (approved) {
                await createNotification(order.customer_id, `Quality checked: Your Order #${oId} has passed central warehouse verification and is being prepared for direct dispatch.`);
            } else {
                await createNotification(order.customer_id, `Shipping Alert: Order #${oId} encountered a logistics discrepancy during warehouse auditing. Rest assured, our service team is coordinating.`);
                
                // Alert seller about discrepancy
                let sellerIds = [];
                if (db.isMockMode()) {
                    const items = mock.select('order_items', oi => oi.order_id === oId);
                    const prodIds = items.map(i => i.product_id);
                    sellerIds = mock.select('products', p => prodIds.includes(p.id)).map(p => p.seller_id);
                } else {
                    const rows = await db.query(
                        'SELECT DISTINCT p.seller_id FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = :1',
                        [oId]
                    );
                    sellerIds = rows.map(r => Number(r.SELLER_ID));
                }
                for (let sId of sellerIds) {
                    await createNotification(sId, `Discrepancy alert: Order #${oId} items failed warehouse physical audits. Contact Service Team immediately.`);
                }
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                message: `Logistics audit completed. Result: ${verifiedStatus}.`
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Warehouse Auditing Verification Failed', error.message);
        }
    },

    /**
     * PUT /api/orders/dispatch
     * Protected (Service Team only): Dispatch parcel to student's campus location.
     */
    async dispatchDelivery(req, res) {
        const serviceId = req.user.userId;
        const { orderId } = req.body || {};

        if (!orderId) return responseUtils.sendError(res, 400, 'Order ID Required', 'Specify target order ID.');
        const oId = Number(orderId);

        try {
            const mock = db.getMock();
            let order = null;

            if (db.isMockMode()) {
                order = mock.selectOne('orders', o => o.id === oId);
            } else {
                const rows = await db.query('SELECT status, customer_id FROM orders WHERE id = :1', [oId]);
                if (rows.length > 0) order = { status: rows[0].STATUS, customer_id: Number(rows[0].CUSTOMER_ID) };
            }

            if (!order) return responseUtils.sendError(res, 404, 'Order Not Found', 'Target order could not be located.');
            if (order.status !== 'VERIFIED_IN_WAREHOUSE') {
                return responseUtils.sendError(res, 400, 'Workflow Conflict', 'Only verified warehouse goods can be dispatched.');
            }

            const dispatchDate = new Date().toISOString();
            if (db.isMockMode()) {
                mock.update('orders', o => o.id === oId, { status: 'DISPATCHED' });
                mock.update('deliveries', d => d.order_id === oId, {
                    status: 'DISPATCHED',
                    assigned_service_id: serviceId,
                    dispatch_date: dispatchDate
                });
            } else {
                await db.execute('UPDATE orders SET status = \'DISPATCHED\' WHERE id = :1', [oId]);
                await db.execute(
                    'UPDATE deliveries SET status = \'DISPATCHED\', assigned_service_id = :1, dispatch_date = CURRENT_TIMESTAMP WHERE order_id = :2',
                    [serviceId, oId]
                );
            }

            // Notify Customer
            await createNotification(order.customer_id, `Courier assigned: Order #${oId} has been dispatched from the warehouse and is currently in-transit to your dorm/campus location.`);

            return responseUtils.sendJSON(res, 200, {
                success: true,
                message: 'Parcel dispatched successfully.'
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Delivery Dispatch Fail', error.message);
        }
    },

    /**
     * PUT /api/orders/complete
     * Protected (Customer only): Confirm package receipt.
     */
    async completeOrder(req, res) {
        const customerId = req.user.userId;
        const { orderId } = req.body || {};

        if (!orderId) return responseUtils.sendError(res, 400, 'Order ID Required', 'Specify target order ID.');
        const oId = Number(orderId);

        try {
            const mock = db.getMock();
            let order = null;

            if (db.isMockMode()) {
                order = mock.selectOne('orders', o => o.id === oId);
            } else {
                const rows = await db.query('SELECT status, customer_id FROM orders WHERE id = :1', [oId]);
                if (rows.length > 0) order = { status: rows[0].STATUS, customer_id: Number(rows[0].CUSTOMER_ID) };
            }

            if (!order) return responseUtils.sendError(res, 404, 'Order Not Found', 'Target order could not be located.');
            if (Number(order.customer_id) !== Number(customerId)) {
                return responseUtils.sendError(res, 403, 'Access Forbidden', 'You do not own this order and cannot mark it as complete.');
            }
            if (order.status !== 'DISPATCHED') {
                return responseUtils.sendError(res, 400, 'Workflow Conflict', 'Only dispatched in-transit orders can be confirmed as completed.');
            }

            if (db.isMockMode()) {
                mock.update('orders', o => o.id === oId, { status: 'COMPLETED' });
                mock.update('deliveries', d => d.order_id === oId, { status: 'DELIVERED' });
            } else {
                await db.execute('UPDATE orders SET status = \'COMPLETED\' WHERE id = :1', [oId]);
                await db.execute('UPDATE deliveries SET status = \'DELIVERED\' WHERE order_id = :1', [oId]);
            }

            // Notify logistics stakeholders
            // Get Service assigned coordinator
            let serviceId = null;
            let sellerIds = [];

            if (db.isMockMode()) {
                const deliv = mock.selectOne('deliveries', d => d.order_id === oId);
                serviceId = deliv ? deliv.assigned_service_id : null;

                const items = mock.select('order_items', oi => oi.order_id === oId);
                const prodIds = items.map(i => i.product_id);
                sellerIds = mock.select('products', p => prodIds.includes(p.id)).map(p => p.seller_id);
            } else {
                const rowsD = await db.query('SELECT assigned_service_id FROM deliveries WHERE order_id = :1', [oId]);
                if (rowsD.length > 0) serviceId = Number(rowsD[0].ASSIGNED_SERVICE_ID);

                const rowsS = await db.query(
                    'SELECT DISTINCT p.seller_id FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = :1',
                    [oId]
                );
                sellerIds = rowsS.map(r => Number(r.SELLER_ID));
            }

            // Alert service coordinator
            if (serviceId) {
                await createNotification(serviceId, `Fulfillment Success: Order #${oId} has been marked as completed/delivered by the customer.`);
            }

            // Alert sellers
            for (let sId of sellerIds) {
                await createNotification(sId, `Transaction Finished: Customer John Doe has confirmed delivery of Order #${oId}. Funds released.`);
            }

            // Alert customer
            await createNotification(customerId, `Thank you for shopping! Transaction for Order #${oId} is officially complete.`);

            return responseUtils.sendJSON(res, 200, {
                success: true,
                message: 'Transaction successfully completed. Stock delivered.'
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Order Completion Failure', error.message);
        }
    }
};
