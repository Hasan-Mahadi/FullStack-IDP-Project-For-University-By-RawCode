/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * REST API ROUTER & SECURITY GUARD MAP — v2 (PRODUCTION UPGRADE)
 * ====================================================================
 * 
 * Maps inbound HTTP request methods and endpoint paths to their respective
 * controller triggers. Integrates security route gating and role scopes.
 */

const authController     = require('./controllers/authController');
const prodController     = require('./controllers/prodController');
const ordController      = require('./controllers/ordController');
const userController     = require('./controllers/userController');
const msgController      = require('./controllers/msgController');
const resetController    = require('./controllers/resetController');
const paymentController  = require('./controllers/paymentController');
const profileController  = require('./controllers/profileController');
const wishlistController = require('./controllers/wishlistController');

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
    'POST /api/auth/register':        { handler: authController.register,         auth: false },
    'POST /api/auth/login':           { handler: authController.login,            auth: false },
    'GET /api/auth/me':               { handler: authController.getMe,            auth: true },

    // 2. Password Reset (Forgot Password Flow)
    'POST /api/auth/forgot-password': { handler: resetController.forgotPassword,  auth: false },
    'POST /api/auth/reset-password':  { handler: resetController.resetPassword,   auth: false },

    // 3. Products Catalog
    'GET /api/products':              { handler: prodController.getAllProducts,    auth: false },
    'GET /api/products/details':      { handler: prodController.getProductDetails, auth: false },
    'GET /api/products/featured':     { handler: prodController.getFeaturedProducts, auth: false },
    'GET /api/products/top-rated':    { handler: prodController.getTopRated,      auth: false },
    'GET /api/products/related':      { handler: prodController.getRelatedProducts, auth: false },
    'GET /api/products/recently-viewed': { handler: prodController.getRecentlyViewed, auth: true, roles: [3] },
    'POST /api/products/viewed':      { handler: prodController.trackRecentlyViewed, auth: true, roles: [3] },
    'GET /api/products/my':           { handler: prodController.getMyProducts,    auth: true, roles: [2] },
    'POST /api/products':             { handler: prodController.createProduct,    auth: true, roles: [2] },
    'PUT /api/products':              { handler: prodController.updateProduct,    auth: true, roles: [2] },
    'DELETE /api/products':           { handler: prodController.deleteProduct,    auth: true, roles: [2] },
    'GET /api/categories':            { handler: prodController.getCategories,    auth: false },
    'POST /api/upload/product-image': { handler: prodController.uploadProductImage, auth: true, roles: [2] },
    'POST /api/reviews':              { handler: prodController.createReview,     auth: true, roles: [3] },
    'GET /api/reviews':               { handler: prodController.getProductReviews, auth: false },

    // 4. Transactions & Order Flow
    'POST /api/orders':                    { handler: ordController.createOrder,         auth: true, roles: [3] },
    'GET /api/orders/my':                  { handler: ordController.getMyOrders,         auth: true, roles: [1, 2, 3, 4] },
    'PUT /api/orders/approve':             { handler: ordController.approveOrder,        auth: true, roles: [4] },
    'PUT /api/orders/deliver-warehouse':   { handler: ordController.deliverToWarehouse,  auth: true, roles: [2] },
    'PUT /api/orders/verify-warehouse':    { handler: ordController.verifyWarehouseReceipt, auth: true, roles: [4] },
    'PUT /api/orders/dispatch':            { handler: ordController.dispatchDelivery,    auth: true, roles: [4] },
    'PUT /api/orders/complete':            { handler: ordController.completeOrder,       auth: true, roles: [3] },

    // 5. Payment System
    'GET /api/payments/methods':    { handler: paymentController.getPaymentMethods, auth: false },
    'POST /api/payments/initiate':  { handler: paymentController.initiatePayment,   auth: true, roles: [3] },
    'GET /api/payments/status':     { handler: paymentController.getPaymentStatus,  auth: true, roles: [3] },

    // 6. User Profile Management (All Roles)
    'GET /api/profile':             { handler: profileController.getProfile,     auth: true, roles: [1, 2, 3, 4] },
    'PUT /api/profile':             { handler: profileController.updateProfile,  auth: true, roles: [1, 2, 3, 4] },
    'PUT /api/profile/password':    { handler: profileController.changePassword, auth: true, roles: [1, 2, 3, 4] },
    'POST /api/profile/avatar':     { handler: profileController.uploadAvatar,   auth: true, roles: [1, 2, 3, 4] },

    // 7. Wishlist (Customer only)
    'GET /api/wishlist':            { handler: wishlistController.getWishlist,        auth: true, roles: [3] },
    'POST /api/wishlist':           { handler: wishlistController.addToWishlist,      auth: true, roles: [3] },
    'DELETE /api/wishlist':         { handler: wishlistController.removeFromWishlist, auth: true, roles: [3] },
    'GET /api/wishlist/check':      { handler: wishlistController.checkWishlist,      auth: true, roles: [3] },

    // 8. Communication Channels
    'POST /api/messages':           { handler: msgController.sendMessage,           auth: true, roles: [2, 3, 4] },
    'GET /api/messages':            { handler: msgController.getOrderMessages,       auth: true, roles: [2, 3, 4] },
    'GET /api/notifications':       { handler: msgController.getNotifications,       auth: true, roles: [1, 2, 3, 4] },
    'PUT /api/notifications/read':  { handler: msgController.markNotificationsRead,  auth: true, roles: [1, 2, 3, 4] },

    // 9. Admin Dashboard Controls
    'GET /api/admin/users':         { handler: userController.getAllUsers,     auth: true, roles: [1] },
    'PUT /api/admin/users/status':  { handler: userController.updateUserStatus, auth: true, roles: [1] },
    'GET /api/admin/reports':       { handler: userController.getSystemReports, auth: true, roles: [1] }
};

module.exports = routesRegistry;
