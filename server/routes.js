/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * REST API ROUTER & SECURITY GUARD MAP
 * ====================================================================
 * 
 * Maps inbound HTTP request methods and endpoint paths to their respective
 * controller triggers. Integrates security route gating and role scopes.
 */

const authController = require('./controllers/authController');
const prodController = require('./controllers/prodController');
const ordController = require('./controllers/ordController');
const userController = require('./controllers/userController');
const msgController = require('./controllers/msgController');

/**
 * Registry of secure and public API routing endpoints.
 * Key format: "METHOD /path"
 * Value parameters:
 *  - handler: Controller function
 *  - auth: Boolean to enforce authorized tokens
 *  - roles: Array of authorized Role IDs (1: Admin, 2: Seller, 3: Customer, 4: Service Team)
 */
const routesRegistry = {
    // 1. Authentication
    'POST /api/auth/register': { handler: authController.register, auth: false },
    'POST /api/auth/login': { handler: authController.login, auth: false },
    'GET /api/auth/me': { handler: authController.getMe, auth: true },

    // 2. Products Catalog
    'GET /api/products': { handler: prodController.getAllProducts, auth: false },
    'GET /api/products/my': { handler: prodController.getMyProducts, auth: true, roles: [2] },
    'POST /api/products': { handler: prodController.createProduct, auth: true, roles: [2] },
    'PUT /api/products': { handler: prodController.updateProduct, auth: true, roles: [2] },
    'DELETE /api/products': { handler: prodController.deleteProduct, auth: true, roles: [2] },

    // 3. Transactions & Order Flow
    'POST /api/orders': { handler: ordController.createOrder, auth: true, roles: [3] },
    'GET /api/orders/my': { handler: ordController.getMyOrders, auth: true, roles: [1, 2, 3, 4] },
    'PUT /api/orders/approve': { handler: ordController.approveOrder, auth: true, roles: [4] },
    'PUT /api/orders/deliver-warehouse': { handler: ordController.deliverToWarehouse, auth: true, roles: [2] },
    'PUT /api/orders/verify-warehouse': { handler: ordController.verifyWarehouseReceipt, auth: true, roles: [4] },
    'PUT /api/orders/dispatch': { handler: ordController.dispatchDelivery, auth: true, roles: [4] },
    'PUT /api/orders/complete': { handler: ordController.completeOrder, auth: true, roles: [3] },

    // 4. Communication channels
    'POST /api/messages': { handler: msgController.sendMessage, auth: true, roles: [2, 3, 4] },
    'GET /api/messages': { handler: msgController.getOrderMessages, auth: true, roles: [2, 3, 4] },
    'GET /api/notifications': { handler: msgController.getNotifications, auth: true, roles: [1, 2, 3, 4] },
    'PUT /api/notifications/read': { handler: msgController.markNotificationsRead, auth: true, roles: [1, 2, 3, 4] },

    // 5. Admin Dashboard Controls
    'GET /api/admin/users': { handler: userController.getAllUsers, auth: true, roles: [1] },
    'PUT /api/admin/users/status': { handler: userController.updateUserStatus, auth: true, roles: [1] },
    'GET /api/admin/reports': { handler: userController.getSystemReports, auth: true, roles: [1] }
};

module.exports = routesRegistry;
