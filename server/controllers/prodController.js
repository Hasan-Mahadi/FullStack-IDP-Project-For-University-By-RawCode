/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * PRODUCT CATALOG CONTROLLER (CATALOG SEARCH & CRUD)
 * ====================================================================
 * 
 * Manages product listings, stock inventories, and catalog searches.
 * Handles dual execution pathways for Oracle SQL or in-memory tables.
 */

const db = require('../database/connection');
const responseUtils = require('../utils/responseUtils');

module.exports = {
    /**
     * GET /api/products
     * Returns list of all active products. Supports dynamic query search.
     */
    async getAllProducts(req, res) {
        // Query parameters (e.g. ?q=toolkit&min_price=10&max_price=50)
        const q = (req.query.q || '').toLowerCase();
        const minPrice = parseFloat(req.query.min_price) || 0;
        const maxPrice = parseFloat(req.query.max_price) || Infinity;

        try {
            let productsList = [];

            if (db.isMockMode()) {
                const mock = db.getMock();
                // Fetch active products, filter by search and price boundaries
                productsList = mock.select('products', p => {
                    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
                    const matchesPrice = p.price >= minPrice && p.price <= maxPrice;
                    return p.is_active === 1 && matchesSearch && matchesPrice;
                });

                // Attach Seller full names for display in catalog
                productsList = productsList.map(p => {
                    const seller = mock.selectOne('users', u => u.id === p.seller_id);
                    return {
                        ...p,
                        seller_name: seller ? seller.full_name : 'Elite Seller'
                    };
                });
            } else {
                // Oracle SQL execution
                const sql = `
                    SELECT p.id, p.seller_id, p.name, p.description, p.price, p.stock, p.is_active, p.created_at, u.full_name as seller_name
                    FROM products p
                    JOIN users u ON p.seller_id = u.id
                    WHERE p.is_active = 1
                      AND (LOWER(p.name) LIKE :1 OR LOWER(p.description) LIKE :2)
                      AND p.price >= :3
                      AND p.price <= :4
                    ORDER BY p.id DESC
                `;
                const binds = [`%${q}%`, `%${q}%`, minPrice, maxPrice === Infinity ? 999999.99 : maxPrice];
                const rows = await db.query(sql, binds);
                
                productsList = rows.map(row => ({
                    id: row.ID,
                    seller_id: row.SELLER_ID,
                    name: row.NAME,
                    description: row.DESCRIPTION,
                    price: Number(row.PRICE),
                    stock: Number(row.STOCK),
                    is_active: Number(row.IS_ACTIVE),
                    created_at: row.CREATED_AT,
                    seller_name: row.SELLER_NAME
                }));
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                products: productsList
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Catalog Fetch Failed', error.message);
        }
    },

    /**
     * GET /api/products/my
     * Protected (Sellers only): Returns products uploaded by the current seller.
     */
    async getMyProducts(req, res) {
        const sellerId = req.user.userId;

        try {
            let myProducts = [];

            if (db.isMockMode()) {
                const mock = db.getMock();
                myProducts = mock.select('products', p => p.seller_id === sellerId);
            } else {
                const sql = `
                    SELECT id, seller_id, name, description, price, stock, is_active, created_at 
                    FROM products 
                    WHERE seller_id = :1 
                    ORDER BY id DESC
                `;
                const rows = await db.query(sql, [sellerId]);
                myProducts = rows.map(row => ({
                    id: row.ID,
                    seller_id: row.SELLER_ID,
                    name: row.NAME,
                    description: row.DESCRIPTION,
                    price: Number(row.PRICE),
                    stock: Number(row.STOCK),
                    is_active: Number(row.IS_ACTIVE),
                    created_at: row.CREATED_AT
                }));
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                products: myProducts
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Seller Product Retrieval Failed', error.message);
        }
    },

    /**
     * POST /api/products
     * Protected (Sellers only): Uploads a new product.
     */
    async createProduct(req, res) {
        const sellerId = req.user.userId;
        const { name, description, price, stock } = req.body || {};

        if (!name || price === undefined || stock === undefined) {
            return responseUtils.sendError(res, 400, 'Invalid Input Data', 'Product name, price, and initial stock quantities are required fields.');
        }

        const priceVal = parseFloat(price);
        const stockVal = parseInt(stock);

        if (isNaN(priceVal) || priceVal < 0) {
            return responseUtils.sendError(res, 400, 'Invalid Price', 'Price must be a valid positive decimal number.');
        }
        if (isNaN(stockVal) || stockVal < 0) {
            return responseUtils.sendError(res, 400, 'Invalid Stock Quantity', 'Stock must be a positive integer.');
        }

        try {
            let newProduct = null;

            if (db.isMockMode()) {
                const mock = db.getMock();
                newProduct = mock.insert('products', {
                    seller_id: sellerId,
                    name,
                    description: description || '',
                    price: priceVal,
                    stock: stockVal,
                    is_active: 1
                });
            } else {
                const sql = `
                    INSERT INTO products (seller_id, name, description, price, stock, is_active)
                    VALUES (:1, :2, :3, :4, :5, 1)
                `;
                const binds = [sellerId, name, description || '', priceVal, stockVal];
                const result = await db.execute(sql, binds);
                newProduct = {
                    id: result.insertId,
                    seller_id: sellerId,
                    name,
                    description: description || '',
                    price: priceVal,
                    stock: stockVal,
                    is_active: 1
                };
            }

            return responseUtils.sendJSON(res, 201, {
                success: true,
                message: 'Product successfully uploaded to catalog.',
                product: newProduct
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Product Upload Failed', error.message);
        }
    },

    /**
     * PUT /api/products
     * Protected (Sellers only): Modifies an existing product's details and stock.
     */
    async updateProduct(req, res) {
        const sellerId = req.user.userId;
        const { id, name, description, price, stock, isActive } = req.body || {};

        if (!id) {
            return responseUtils.sendError(res, 400, 'Product ID Required', 'Specify the target product ID to apply modifications.');
        }

        const targetId = Number(id);
        const updateFields = {};

        if (name !== undefined) updateFields.name = name;
        if (description !== undefined) updateFields.description = description;
        if (price !== undefined) {
            const val = parseFloat(price);
            if (isNaN(val) || val < 0) return responseUtils.sendError(res, 400, 'Invalid Price', 'Price must be a valid positive number.');
            updateFields.price = val;
        }
        if (stock !== undefined) {
            const val = parseInt(stock);
            if (isNaN(val) || val < 0) return responseUtils.sendError(res, 400, 'Invalid Stock', 'Stock must be a positive integer.');
            updateFields.stock = val;
        }
        if (isActive !== undefined) {
            updateFields.is_active = isActive ? 1 : 0;
        }

        try {
            let productRecord = null;

            // Verify ownership
            if (db.isMockMode()) {
                const mock = db.getMock();
                productRecord = mock.selectOne('products', p => p.id === targetId);
            } else {
                const rows = await db.query('SELECT seller_id FROM products WHERE id = :1', [targetId]);
                if (rows.length > 0) {
                    productRecord = { seller_id: rows[0].SELLER_ID };
                }
            }

            if (!productRecord) {
                return responseUtils.sendError(res, 404, 'Product Not Found', 'The requested product listing does not exist.');
            }

            if (Number(productRecord.seller_id) !== Number(sellerId)) {
                return responseUtils.sendError(res, 403, 'Access Forbidden', 'You do not own this product and cannot edit it.');
            }

            // Execute update
            if (db.isMockMode()) {
                const mock = db.getMock();
                mock.update('products', p => p.id === targetId, updateFields);
            } else {
                // Build dynamic SQL statement for Oracle update
                const setClauses = [];
                const binds = [];
                let counter = 1;

                for (let key of Object.keys(updateFields)) {
                    let col = key;
                    if (key === 'isActive') col = 'is_active';
                    setClauses.push(`${col} = :${counter}`);
                    binds.push(updateFields[key]);
                    counter++;
                }

                binds.push(targetId);
                const sql = `UPDATE products SET ${setClauses.join(', ')} WHERE id = :${counter}`;
                await db.execute(sql, binds);
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                message: 'Product listings successfully updated.'
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Product Update Failed', error.message);
        }
    },

    /**
     * DELETE /api/products
     * Protected (Sellers only): Deactivates a product catalog entry.
     */
    async deleteProduct(req, res) {
        const sellerId = req.user.userId;
        const { id } = req.body || {};

        if (!id) {
            return responseUtils.sendError(res, 400, 'Product ID Required', 'Specify the target product ID to delete.');
        }

        const targetId = Number(id);

        try {
            let productRecord = null;

            if (db.isMockMode()) {
                const mock = db.getMock();
                productRecord = mock.selectOne('products', p => p.id === targetId);
            } else {
                const rows = await db.query('SELECT seller_id FROM products WHERE id = :1', [targetId]);
                if (rows.length > 0) {
                    productRecord = { seller_id: rows[0].SELLER_ID };
                }
            }

            if (!productRecord) {
                return responseUtils.sendError(res, 404, 'Product Not Found', 'The requested product listing does not exist.');
            }

            if (Number(productRecord.seller_id) !== Number(sellerId)) {
                return responseUtils.sendError(res, 403, 'Access Forbidden', 'You do not own this product and cannot delete it.');
            }

            // In typical e-commerce designs, deactivation is preferred to prevent broken foreign key references in historical orders!
            if (db.isMockMode()) {
                const mock = db.getMock();
                mock.update('products', p => p.id === targetId, { is_active: 0 });
            } else {
                await db.execute('UPDATE products SET is_active = 0 WHERE id = :1', [targetId]);
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                message: 'Product successfully deactivated from campus catalog.'
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Product Deactivation Failed', error.message);
        }
    }
};
