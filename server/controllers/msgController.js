/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * CHAT BRIDGE & NOTIFICATIONS CONTROLLER
 * ====================================================================
 * 
 * Enforces the university design requirement: Customers and Sellers
 * cannot talk directly. All communications route through the Service Team.
 * 
 * Includes real-time system alerts (notifications) CRUD.
 */

const db = require('../database/connection');
const responseUtils = require('../utils/responseUtils');

module.exports = {
    /**
     * POST /api/messages
     * Protected (All Roles): Sends message regarding a specific order.
     */
    async sendMessage(req, res) {
        const senderId = Number(req.user.userId);
        const senderRoleId = Number(req.user.roleId);
        const { orderId, messageText, receiverId } = req.body || {};

        if (!orderId || !messageText) {
            return responseUtils.sendError(res, 400, 'Message Construction Error', 'Order ID and Message text are required.');
        }

        const oId = Number(orderId);
        let resolvedReceiverId = Number(receiverId);

        try {
            const mock = db.getMock();
            let order = null;

            if (db.isMockMode()) {
                order = mock.selectOne('orders', o => o.id === oId);
            } else {
                const rows = await db.query('SELECT customer_id FROM orders WHERE id = :1', [oId]);
                if (rows.length > 0) order = { customer_id: Number(rows[0].CUSTOMER_ID) };
            }

            if (!order) return responseUtils.sendError(res, 404, 'Order Not Found', 'The associated order does not exist.');

            // Communication Bridge Rules:
            // 1. Customers can ONLY send to Service (default receiver: User 4 - Operations Coordinator)
            // 2. Sellers can ONLY send to Service (default receiver: User 4)
            // 3. Service can send to Customer or Seller (must specify target receiverId)
            
            if (senderRoleId === 3) {
                // Customer sending
                resolvedReceiverId = 4; // Forces routing to Service Team Coordinator
            } else if (senderRoleId === 2) {
                // Seller sending
                resolvedReceiverId = 4; // Forces routing to Service Team Coordinator
            } else if (senderRoleId === 4) {
                // Service sending
                if (!resolvedReceiverId) {
                    return responseUtils.sendError(res, 400, 'Receiver ID Required', 'Service Team must specify a target user ID (Customer or Seller).');
                }
            } else {
                return responseUtils.sendError(res, 403, 'Forbidden', 'Administrators are excluded from standard order coordinate chat threads.');
            }

            let insertedMsg = null;

            if (db.isMockMode()) {
                insertedMsg = mock.insert('messages', {
                    sender_id: senderId,
                    receiver_id: resolvedReceiverId,
                    order_id: oId,
                    message_text: messageText,
                    is_service_bridge: 1
                });
            } else {
                await db.execute(
                    'INSERT INTO messages (sender_id, receiver_id, order_id, message_text, is_service_bridge) VALUES (:1, :2, :3, :4, 1)',
                    [senderId, resolvedReceiverId, oId, messageText]
                );
                insertedMsg = {
                    sender_id: senderId,
                    receiver_id: resolvedReceiverId,
                    order_id: oId,
                    message_text: messageText
                };
            }

            // Create system alert notification for receiver
            const senderName = req.user.fullName;
            if (db.isMockMode()) {
                mock.insert('notifications', {
                    user_id: resolvedReceiverId,
                    message: `New message on Order #${oId} from ${senderName}: "${messageText.substring(0, 30)}..."`,
                    is_read: 0
                });
            } else {
                await db.execute(
                    'INSERT INTO notifications (user_id, message, is_read) VALUES (:1, :2, 0)',
                    [resolvedReceiverId, `New message on Order #${oId} from ${senderName}: "${messageText.substring(0, 30)}..."`]
                );
            }

            return responseUtils.sendJSON(res, 201, {
                success: true,
                message: 'Message successfully sent.',
                chat: insertedMsg
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Message Transmission Failed', error.message);
        }
    },

    /**
     * GET /api/messages
     * Protected (All Roles): Fetches messaging logs regarding an order.
     */
    async getOrderMessages(req, res) {
        const { orderId } = req.query || {};
        const userId = Number(req.user.userId);
        const roleId = Number(req.user.roleId);

        if (!orderId) return responseUtils.sendError(res, 400, 'Order ID Required', 'Provide order ID in query string (?orderId=1).');
        const oId = Number(orderId);

        try {
            let filteredLogs = [];
            const mock = db.getMock();

            if (db.isMockMode()) {
                const allMsg = mock.getTable('messages');
                const allUsers = mock.getTable('users');

                let thread = allMsg.filter(m => m.order_id === oId);

                // Scope permissions:
                // Customer sees: messages sent by them or received by them
                // Seller sees: messages sent by them or received by them
                // Service Team & Admin: sees ALL messages!
                if (roleId === 3 || roleId === 2) {
                    thread = thread.filter(m => m.sender_id === userId || m.receiver_id === userId);
                }

                // Denormalize user names
                filteredLogs = thread.map(m => {
                    const sender = allUsers.find(u => u.id === m.sender_id);
                    const receiver = allUsers.find(u => u.id === m.receiver_id);
                    return {
                        id: m.id,
                        order_id: m.order_id,
                        sender_id: m.sender_id,
                        sender_name: sender ? sender.full_name : 'Unknown User',
                        sender_role: sender ? sender.role_id : null,
                        receiver_id: m.receiver_id,
                        receiver_name: receiver ? receiver.full_name : 'Unknown User',
                        message_text: m.message_text,
                        created_at: m.created_at
                    };
                });

            } else {
                // Oracle SQL fetch with joint account full names
                let sql = `
                    SELECT m.id, m.order_id, m.sender_id, s.full_name as sender_name, s.role_id as sender_role,
                           m.receiver_id, r.full_name as receiver_name, m.message_text, m.created_at
                    FROM messages m
                    JOIN users s ON m.sender_id = s.id
                    JOIN users r ON m.receiver_id = r.id
                    WHERE m.order_id = :1
                `;
                let binds = [oId];

                if (roleId === 3 || roleId === 2) {
                    sql += ' AND (m.sender_id = :2 OR m.receiver_id = :3)';
                    binds.push(userId, userId);
                }

                sql += ' ORDER BY m.id ASC';

                const rows = await db.query(sql, binds);
                filteredLogs = rows.map(row => ({
                    id: Number(row.ID),
                    order_id: Number(row.ORDER_ID),
                    sender_id: Number(row.SENDER_ID),
                    sender_name: row.SENDER_NAME,
                    sender_role: Number(row.SENDER_ROLE),
                    receiver_id: Number(row.RECEIVER_ID),
                    receiver_name: row.RECEIVER_NAME,
                    message_text: row.MESSAGE_TEXT,
                    created_at: row.CREATED_AT
                }));
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                messages: filteredLogs
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Chat Retrieval Failed', error.message);
        }
    },

    /**
     * GET /api/notifications
     * Protected (All Roles): Fetches account alert notifications.
     */
    async getNotifications(req, res) {
        const userId = Number(req.user.userId);

        try {
            let alerts = [];

            if (db.isMockMode()) {
                const mock = db.getMock();
                alerts = mock.select('notifications', n => n.user_id === userId).reverse(); // newest first
            } else {
                const sql = 'SELECT id, message, is_read, created_at FROM notifications WHERE user_id = :1 ORDER BY id DESC';
                const rows = await db.query(sql, [userId]);
                alerts = rows.map(row => ({
                    id: Number(row.ID),
                    message: row.MESSAGE,
                    is_read: Number(row.IS_READ),
                    created_at: row.CREATED_AT
                }));
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                notifications: alerts
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Notification Fetching Failed', error.message);
        }
    },

    /**
     * PUT /api/notifications/read
     * Protected (All Roles): Mark all active user notifications as read.
     */
    async markNotificationsRead(req, res) {
        const userId = Number(req.user.userId);

        try {
            if (db.isMockMode()) {
                const mock = db.getMock();
                mock.update('notifications', n => n.user_id === userId, { is_read: 1 });
            } else {
                await db.execute('UPDATE notifications SET is_read = 1 WHERE user_id = :1', [userId]);
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                message: 'All notifications marked as read.'
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Notification Audit Update Failed', error.message);
        }
    }
};
