/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * WISHLIST CONTROLLER (CUSTOMER SCOPE)
 * ====================================================================
 *
 * Manages customer product wishlists.
 * Oracle DB + MockDB dual mode.
 */

const db          = require('../database/connection');
const responseUtils = require('../utils/responseUtils');

module.exports = {
    /**
     * GET /api/wishlist
     * Protected (Customer): Get all wishlisted products.
     */
    async getWishlist(req, res) {
        const customerId = req.user.userId;

        try {
            let items = [];

            if (db.isMockMode()) {
                const mock     = db.getMock();
                const entries  = mock.select('wishlist', w => w.customer_id === customerId);
                const products = mock.getTable('products');
                const reviews  = mock.getTable('reviews');

                items = entries.map(entry => {
                    const p = products.find(prod => prod.id === entry.product_id);
                    if (!p) return null;
                    const prodReviews = reviews.filter(r => r.product_id === p.id);
                    const avgRating   = prodReviews.length > 0
                        ? (prodReviews.reduce((s, r) => s + r.rating, 0) / prodReviews.length).toFixed(1)
                        : null;
                    return {
                        wishlist_id:  entry.id,
                        product_id:   p.id,
                        name:         p.name,
                        description:  p.description,
                        price:        p.price,
                        stock:        p.stock,
                        image_url:    p.image_url,
                        category_id:  p.category_id,
                        is_active:    p.is_active,
                        avg_rating:   avgRating,
                        review_count: prodReviews.length,
                        added_at:     entry.created_at
                    };
                }).filter(Boolean);
            } else {
                const sql = `
                    SELECT w.id as wishlist_id, w.created_at as added_at,
                           p.id as product_id, p.name, p.description, p.price, p.stock,
                           p.image_url, p.category_id, p.is_active,
                           ROUND(AVG(r.rating), 1) as avg_rating,
                           COUNT(r.id) as review_count
                    FROM wishlist w
                    JOIN products p ON w.product_id = p.id
                    LEFT JOIN reviews r ON p.id = r.product_id
                    WHERE w.customer_id = :1
                    GROUP BY w.id, w.created_at, p.id, p.name, p.description, p.price,
                             p.stock, p.image_url, p.category_id, p.is_active
                    ORDER BY w.created_at DESC
                `;
                const rows = await db.query(sql, [customerId]);
                items = rows.map(row => ({
                    wishlist_id:  Number(row.WISHLIST_ID),
                    product_id:   Number(row.PRODUCT_ID),
                    name:         row.NAME,
                    description:  row.DESCRIPTION,
                    price:        Number(row.PRICE),
                    stock:        Number(row.STOCK),
                    image_url:    row.IMAGE_URL,
                    category_id:  row.CATEGORY_ID ? Number(row.CATEGORY_ID) : null,
                    is_active:    Number(row.IS_ACTIVE),
                    avg_rating:   row.AVG_RATING ? Number(row.AVG_RATING) : null,
                    review_count: Number(row.REVIEW_COUNT),
                    added_at:     row.ADDED_AT
                }));
            }

            return responseUtils.sendJSON(res, 200, { success: true, wishlist: items });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Wishlist Fetch Error', error.message);
        }
    },

    /**
     * POST /api/wishlist
     * Protected (Customer): Add product to wishlist.
     */
    async addToWishlist(req, res) {
        const customerId = req.user.userId;
        const { productId } = req.body || {};

        if (!productId) {
            return responseUtils.sendError(res, 400, 'Missing Field', 'productId is required.');
        }

        const pId = Number(productId);

        try {
            if (db.isMockMode()) {
                const mock = db.getMock();

                // Check product exists
                const product = mock.selectOne('products', p => p.id === pId && p.is_active === 1);
                if (!product) return responseUtils.sendError(res, 404, 'Product Not Found', 'Product not found.');

                // Check duplicate
                const existing = mock.selectOne('wishlist', w => w.customer_id === customerId && w.product_id === pId);
                if (existing) {
                    return responseUtils.sendJSON(res, 200, { success: true, message: 'Already in wishlist.', alreadyExists: true });
                }

                mock.insert('wishlist', { customer_id: customerId, product_id: pId });
            } else {
                const prodRows = await db.query('SELECT id FROM products WHERE id = :1 AND is_active = 1', [pId]);
                if (prodRows.length === 0) return responseUtils.sendError(res, 404, 'Product Not Found', 'Product not found.');

                try {
                    await db.execute(
                        'INSERT INTO wishlist (customer_id, product_id) VALUES (:1, :2)',
                        [customerId, pId]
                    );
                } catch (dupErr) {
                    if (dupErr.message && dupErr.message.includes('ORA-00001')) {
                        return responseUtils.sendJSON(res, 200, { success: true, message: 'Already in wishlist.', alreadyExists: true });
                    }
                    throw dupErr;
                }
            }

            return responseUtils.sendJSON(res, 201, { success: true, message: 'Added to wishlist.' });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Wishlist Add Error', error.message);
        }
    },

    /**
     * DELETE /api/wishlist
     * Protected (Customer): Remove product from wishlist.
     * Body: { productId }
     */
    async removeFromWishlist(req, res) {
        const customerId = req.user.userId;
        const { productId } = req.body || {};

        if (!productId) {
            return responseUtils.sendError(res, 400, 'Missing Field', 'productId is required.');
        }

        const pId = Number(productId);

        try {
            if (db.isMockMode()) {
                const mock    = db.getMock();
                const deleted = mock.delete('wishlist', w => w.customer_id === customerId && w.product_id === pId);
                if (deleted === 0) return responseUtils.sendError(res, 404, 'Not Found', 'Item not in wishlist.');
            } else {
                const rows = await db.query(
                    'SELECT id FROM wishlist WHERE customer_id = :1 AND product_id = :2',
                    [customerId, pId]
                );
                if (rows.length === 0) return responseUtils.sendError(res, 404, 'Not Found', 'Item not in wishlist.');
                await db.execute(
                    'DELETE FROM wishlist WHERE customer_id = :1 AND product_id = :2',
                    [customerId, pId]
                );
            }

            return responseUtils.sendJSON(res, 200, { success: true, message: 'Removed from wishlist.' });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Wishlist Remove Error', error.message);
        }
    },

    /**
     * GET /api/wishlist/check
     * Protected (Customer): Check if a specific product is in wishlist.
     */
    async checkWishlist(req, res) {
        const customerId = req.user.userId;
        const productId  = parseInt(req.query.productId);

        if (!productId) {
            return responseUtils.sendError(res, 400, 'Missing Field', 'productId query param required.');
        }

        try {
            let inWishlist = false;

            if (db.isMockMode()) {
                inWishlist = !!db.getMock().selectOne('wishlist',
                    w => w.customer_id === customerId && w.product_id === productId
                );
            } else {
                const rows = await db.query(
                    'SELECT id FROM wishlist WHERE customer_id = :1 AND product_id = :2',
                    [customerId, productId]
                );
                inWishlist = rows.length > 0;
            }

            return responseUtils.sendJSON(res, 200, { success: true, inWishlist });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Wishlist Check Error', error.message);
        }
    }
};
