/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * SYSTEM CONTROL & ANALYTICS CONTROLLER (ADMIN SCOPE)
 * ====================================================================
 * 
 * Provides Admin privileges: listing accounts, managing blocklists,
 * toggling user status, and generating SVG-friendly analytical summaries.
 */

const db = require('../database/connection');
const responseUtils = require('../utils/responseUtils');

module.exports = {
    /**
     * GET /api/admin/users
     * Protected (Admin only): Lists all registered accounts in the system.
     */
    async getAllUsers(req, res) {
        try {
            let usersList = [];

            if (db.isMockMode()) {
                const mock = db.getMock();
                const roles = mock.getTable('roles');
                usersList = mock.getTable('users').map(u => {
                    const r = roles.find(role => role.id === u.role_id);
                    return {
                        id: u.id,
                        username: u.username,
                        email: u.email,
                        role_name: r ? r.name : 'Unknown',
                        full_name: u.full_name,
                        is_active: u.is_active,
                        created_at: u.created_at
                    };
                });
            } else {
                const sql = `
                    SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.created_at, r.name as role_name
                    FROM users u
                    JOIN roles r ON u.role_id = r.id
                    ORDER BY u.id ASC
                `;
                const rows = await db.query(sql);
                usersList = rows.map(row => ({
                    id: Number(row.ID),
                    username: row.USERNAME,
                    email: row.EMAIL,
                    full_name: row.FULL_NAME,
                    is_active: Number(row.IS_ACTIVE),
                    created_at: row.CREATED_AT,
                    role_name: row.ROLE_NAME
                }));
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                users: usersList
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'User Retrieval Failed', error.message);
        }
    },

    /**
     * PUT /api/admin/users/status
     * Protected (Admin only): Enables/disables specific accounts.
     */
    async updateUserStatus(req, res) {
        const { targetUserId, active } = req.body || {}; // active is boolean

        if (!targetUserId || active === undefined) {
            return responseUtils.sendError(res, 400, 'Missing Parameters', 'Target user ID and active state (active: true/false) are required.');
        }

        const uId = Number(targetUserId);
        const nextStatus = active ? 1 : 0;

        if (uId === Number(req.user.userId)) {
            return responseUtils.sendError(res, 400, 'Action Denied', 'Administrators are restricted from deactivating their own credentials.');
        }

        try {
            let userExists = false;

            if (db.isMockMode()) {
                const mock = db.getMock();
                const u = mock.selectOne('users', user => user.id === uId);
                if (u) {
                    userExists = true;
                    mock.update('users', user => user.id === uId, { is_active: nextStatus });
                }
            } else {
                const rows = await db.query('SELECT id FROM users WHERE id = :1', [uId]);
                if (rows.length > 0) {
                    userExists = true;
                    await db.execute('UPDATE users SET is_active = :1 WHERE id = :2', [nextStatus, uId]);
                }
            }

            if (!userExists) {
                return responseUtils.sendError(res, 404, 'User Not Found', 'Target user account could not be found.');
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                message: `Account status updated successfully to ${active ? 'Active' : 'Suspended'}.`
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Account Status Transition Failed', error.message);
        }
    },

    /**
     * GET /api/admin/reports
     * Protected (Admin only): Compile administrative summary analytics.
     */
    async getSystemReports(req, res) {
        try {
            let reports = {};

            if (db.isMockMode()) {
                const mock = db.getMock();
                const users = mock.getTable('users');
                const products = mock.getTable('products');
                const orders = mock.getTable('orders');

                const totalUsers = users.length;
                const activeUsers = users.filter(u => u.is_active === 1).length;
                
                const totalProducts = products.length;
                const outOfStock = products.filter(p => p.stock === 0).length;

                const completedOrders = orders.filter(o => o.status === 'COMPLETED');
                const revenue = completedOrders.reduce((sum, o) => sum + o.total_amount, 0);

                const statusCounts = orders.reduce((acc, o) => {
                    acc[o.status] = (acc[o.status] || 0) + 1;
                    return acc;
                }, {});

                reports = {
                    analytics: {
                        totalUsers,
                        activeUsers,
                        suspendedUsers: totalUsers - activeUsers,
                        totalProducts,
                        outOfStock,
                        activeCatalog: products.filter(p => p.is_active === 1).length,
                        totalOrders: orders.length,
                        completedOrdersCount: completedOrders.length,
                        totalRevenue: Number(revenue.toFixed(2)),
                        statusSummary: statusCounts
                    }
                };
            } else {
                // Oracle SQL analytic counters
                const uCounts = await db.query('SELECT COUNT(*) as tot, SUM(is_active) as act FROM users');
                const pCounts = await db.query('SELECT COUNT(*) as tot, SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as oos FROM products');
                const oCounts = await db.query('SELECT COUNT(*) as tot, SUM(CASE WHEN status = \'COMPLETED\' THEN 1 ELSE 0 END) as comp, SUM(CASE WHEN status = \'COMPLETED\' THEN total_amount ELSE 0 END) as rev FROM orders');
                const statusSummaryRaw = await db.query('SELECT status, COUNT(*) as qty FROM orders GROUP BY status');

                const statusSummary = {};
                statusSummaryRaw.forEach(row => {
                    statusSummary[row.STATUS] = Number(row.QTY);
                });

                reports = {
                    analytics: {
                        totalUsers: Number(uCounts[0].TOT),
                        activeUsers: Number(uCounts[0].ACT),
                        suspendedUsers: Number(uCounts[0].TOT) - Number(uCounts[0].ACT),
                        totalProducts: Number(pCounts[0].TOT),
                        outOfStock: Number(pCounts[0].OOS),
                        totalOrders: Number(oCounts[0].TOT),
                        completedOrdersCount: Number(oCounts[0].COMP),
                        totalRevenue: Number(Number(oCounts[0].REV || 0).toFixed(2)),
                        statusSummary
                    }
                };
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                reports
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Report Synthesis Failed', error.message);
        }
    }
};
