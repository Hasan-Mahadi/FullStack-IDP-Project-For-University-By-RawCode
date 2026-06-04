/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * PRODUCT CATALOG CONTROLLER (CATALOG SEARCH, REVIEWS & CRUD)
 * ====================================================================
 * 
 * Manages product listings, stock inventories, catalog searches,
 * product categories, reviews, and product image uploads.
 */

const db = require('../database/connection');
const responseUtils = require('../utils/responseUtils');

/**
 * Custom binary-safe multipart/form-data parser for vanilla Node.js
 */
function parseMultipart(buffer, boundary) {
    const boundaryStr = '--' + boundary;
    const boundaryBuf = Buffer.from(boundaryStr);
    
    let parts = [];
    let startIdx = 0;
    
    while (true) {
        let idx = buffer.indexOf(boundaryBuf, startIdx);
        if (idx === -1) break;
        parts.push(idx);
        startIdx = idx + boundaryBuf.length;
    }
    
    const result = { files: {}, fields: {} };
    
    for (let i = 0; i < parts.length - 1; i++) {
        const start = parts[i] + boundaryBuf.length + 2; // skip \r\n
        const end = parts[i+1] - 2; // ignore \r\n before next boundary
        
        if (start >= end) continue;
        
        const partBuffer = buffer.subarray(start, end);
        const headerEndIdx = partBuffer.indexOf('\r\n\r\n');
        if (headerEndIdx === -1) continue;
        
        const headerStr = partBuffer.subarray(0, headerEndIdx).toString('utf8');
        const bodyVal = partBuffer.subarray(headerEndIdx + 4);
        
        const contentDisposition = headerStr.split('\r\n').find(h => h.toLowerCase().startsWith('content-disposition'));
        if (!contentDisposition) continue;
        
        const nameMatch = contentDisposition.match(/name="([^"]+)"/);
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        
        if (filenameMatch) {
            const fieldName = nameMatch ? nameMatch[1] : 'file';
            const filename = filenameMatch[1];
            const contentTypeLine = headerStr.split('\r\n').find(h => h.toLowerCase().startsWith('content-type'));
            const contentType = contentTypeLine ? contentTypeLine.split(':')[1].trim() : 'application/octet-stream';
            
            result.files[fieldName] = {
                filename,
                contentType,
                data: bodyVal
            };
        } else if (nameMatch) {
            const fieldName = nameMatch[1];
            result.fields[fieldName] = bodyVal.toString('utf8');
        }
    }
    
    return result;
}

module.exports = {
    /**
     * GET /api/products
     * Returns list of all active products. Supports dynamic query search, category filtering, and single-id lookup.
     */
    async getAllProducts(req, res) {
        const id = req.query.id ? parseInt(req.query.id) : null;
        const q = (req.query.q || '').toLowerCase();
        const minPrice = parseFloat(req.query.min_price) || 0;
        const maxPrice = parseFloat(req.query.max_price) || Infinity;
        const categoryId = req.query.category_id ? parseInt(req.query.category_id) : null;

        try {
            // 1. Single Product Lookup by ID
            if (id) {
                if (db.isMockMode()) {
                    const mock = db.getMock();
                    const p = mock.selectOne('products', x => x.id === id);
                    if (p) {
                        const seller = mock.selectOne('users', u => u.id === p.seller_id);
                        const category = mock.selectOne('categories', c => c.id === p.category_id);
                        const productDetails = {
                            ...p,
                            seller_name: seller ? seller.full_name : 'Elite Seller',
                            category_name: category ? category.name : 'Uncategorized'
                        };
                        return responseUtils.sendJSON(res, 200, {
                            success: true,
                            product: productDetails
                        });
                    }
                } else {
                    const sql = `
                        SELECT p.id, p.seller_id, p.name, p.description, p.price, p.stock, p.is_active, p.created_at, 
                               u.full_name as seller_name, p.category_id, c.name as category_name, p.image_url
                        FROM products p
                        JOIN users u ON p.seller_id = u.id
                        LEFT JOIN categories c ON p.category_id = c.id
                        WHERE p.id = :1
                    `;
                    const rows = await db.query(sql, [id]);
                    if (rows.length > 0) {
                        const row = rows[0];
                        return responseUtils.sendJSON(res, 200, {
                            success: true,
                            product: {
                                id: row.ID,
                                seller_id: row.SELLER_ID,
                                name: row.NAME,
                                description: row.DESCRIPTION,
                                price: Number(row.PRICE),
                                stock: Number(row.STOCK),
                                is_active: Number(row.IS_ACTIVE),
                                created_at: row.CREATED_AT,
                                seller_name: row.SELLER_NAME,
                                category_id: row.CATEGORY_ID ? Number(row.CATEGORY_ID) : null,
                                category_name: row.CATEGORY_NAME,
                                image_url: row.IMAGE_URL
                            }
                        });
                    }
                }
                return responseUtils.sendError(res, 404, 'Product Not Found', 'The requested product listing does not exist.');
            }

            // 2. Query products catalog with filters
            let productsList = [];

            if (db.isMockMode()) {
                const mock = db.getMock();
                productsList = mock.select('products', p => {
                    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
                    const matchesPrice = p.price >= minPrice && p.price <= maxPrice;
                    const matchesCategory = !categoryId || p.category_id === categoryId;
                    return p.is_active === 1 && matchesSearch && matchesPrice && matchesCategory;
                });

                productsList = productsList.map(p => {
                    const seller = mock.selectOne('users', u => u.id === p.seller_id);
                    const category = mock.selectOne('categories', c => c.id === p.category_id);
                    return {
                        ...p,
                        seller_name: seller ? seller.full_name : 'Elite Seller',
                        category_name: category ? category.name : 'Uncategorized'
                    };
                });
            } else {
                let sql = `
                    SELECT p.id, p.seller_id, p.name, p.description, p.price, p.stock, p.is_active, p.created_at, 
                           u.full_name as seller_name, p.category_id, c.name as category_name, p.image_url
                    FROM products p
                    JOIN users u ON p.seller_id = u.id
                    LEFT JOIN categories c ON p.category_id = c.id
                    WHERE p.is_active = 1
                      AND (LOWER(p.name) LIKE :1 OR LOWER(p.description) LIKE :2)
                      AND p.price >= :3
                      AND p.price <= :4
                `;
                const binds = [`%${q}%`, `%${q}%`, minPrice, maxPrice === Infinity ? 999999.99 : maxPrice];
                if (categoryId) {
                    sql += ` AND p.category_id = :5`;
                    binds.push(categoryId);
                }
                sql += ` ORDER BY p.id DESC`;

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
                    seller_name: row.SELLER_NAME,
                    category_id: row.CATEGORY_ID ? Number(row.CATEGORY_ID) : null,
                    category_name: row.CATEGORY_NAME,
                    image_url: row.IMAGE_URL
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
                myProducts = myProducts.map(p => {
                    const category = mock.selectOne('categories', c => c.id === p.category_id);
                    return {
                        ...p,
                        category_name: category ? category.name : 'Uncategorized'
                    };
                });
            } else {
                const sql = `
                    SELECT p.id, p.seller_id, p.name, p.description, p.price, p.stock, p.is_active, p.created_at, p.category_id, c.name as category_name, p.image_url
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id
                    WHERE p.seller_id = :1 
                    ORDER BY p.id DESC
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
                    created_at: row.CREATED_AT,
                    category_id: row.CATEGORY_ID ? Number(row.CATEGORY_ID) : null,
                    category_name: row.CATEGORY_NAME,
                    image_url: row.IMAGE_URL
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
        const { name, description, price, stock, categoryId, imageUrl } = req.body || {};

        if (!name || price === undefined || stock === undefined) {
            return responseUtils.sendError(res, 400, 'Invalid Input Data', 'Product name, price, and initial stock quantities are required fields.');
        }

        const priceVal = parseFloat(price);
        const stockVal = parseInt(stock);
        const catIdVal = categoryId ? parseInt(categoryId) : null;

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
                    is_active: 1,
                    category_id: catIdVal,
                    image_url: imageUrl || ''
                });
            } else {
                const sql = `
                    INSERT INTO products (seller_id, name, description, price, stock, is_active, category_id, image_url)
                    VALUES (:1, :2, :3, :4, :5, 1, :6, :7)
                `;
                const binds = [sellerId, name, description || '', priceVal, stockVal, catIdVal, imageUrl || null];
                const result = await db.execute(sql, binds);
                newProduct = {
                    id: result.insertId,
                    seller_id: sellerId,
                    name,
                    description: description || '',
                    price: priceVal,
                    stock: stockVal,
                    is_active: 1,
                    category_id: catIdVal,
                    image_url: imageUrl || ''
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
        const { id, name, description, price, stock, isActive, categoryId, imageUrl } = req.body || {};

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
        if (categoryId !== undefined) {
            updateFields.category_id = categoryId ? parseInt(categoryId) : null;
        }
        if (imageUrl !== undefined) {
            updateFields.image_url = imageUrl;
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
    },

    /**
     * GET /api/categories
     * Public: Returns all active categories.
     */
    async getCategories(req, res) {
        try {
            if (db.isMockMode()) {
                const mock = db.getMock();
                const list = mock.select('categories', c => c.is_active === 1);
                return responseUtils.sendJSON(res, 200, { success: true, categories: list });
            } else {
                const sql = `SELECT id, name, description, icon FROM categories WHERE is_active = 1 ORDER BY id ASC`;
                const rows = await db.query(sql);
                const list = rows.map(row => ({
                    id: row.ID,
                    name: row.NAME,
                    description: row.DESCRIPTION,
                    icon: row.ICON
                }));
                return responseUtils.sendJSON(res, 200, { success: true, categories: list });
            }
        } catch (error) {
            return responseUtils.sendError(res, 500, 'Categories Fetch Failed', error.message);
        }
    },

    /**
     * GET /api/reviews
     * Public: Returns all reviews submitted for a single product.
     */
    async getProductReviews(req, res) {
        const productId = parseInt(req.query.productId);
        if (isNaN(productId)) {
            return responseUtils.sendError(res, 400, 'Bad Request', 'Valid Product ID parameter is required.');
        }

        try {
            if (db.isMockMode()) {
                const mock = db.getMock();
                const list = mock.select('reviews', r => r.product_id === productId);
                const reviewsWithUser = list.map(r => {
                    const customer = mock.selectOne('users', u => u.id === r.customer_id);
                    return {
                        id: r.id,
                        product_id: r.product_id,
                        customer_id: r.customer_id,
                        rating: r.rating,
                        review_text: r.review_text,
                        created_at: r.created_at,
                        customer_name: customer ? customer.full_name : 'Student Reviewer'
                    };
                });
                return responseUtils.sendJSON(res, 200, { success: true, reviews: reviewsWithUser });
            } else {
                const sql = `
                    SELECT r.id, r.product_id, r.customer_id, r.rating, r.review_text, r.created_at, u.full_name as customer_name
                    FROM reviews r
                    JOIN users u ON r.customer_id = u.id
                    WHERE r.product_id = :1
                    ORDER BY r.created_at DESC
                `;
                const rows = await db.query(sql, [productId]);
                const list = rows.map(row => ({
                    id: row.ID,
                    product_id: Number(row.PRODUCT_ID),
                    customer_id: Number(row.CUSTOMER_ID),
                    rating: Number(row.RATING),
                    review_text: row.REVIEW_TEXT,
                    created_at: row.CREATED_AT,
                    customer_name: row.CUSTOMER_NAME
                }));
                return responseUtils.sendJSON(res, 200, { success: true, reviews: list });
            }
        } catch (error) {
            return responseUtils.sendError(res, 500, 'Reviews Fetch Failed', error.message);
        }
    },

    /**
     * POST /api/reviews
     * Protected (Customers only): Submits a review rating and text for a product.
     */
    async createReview(req, res) {
        const customerId = req.user.userId;
        const { productId, rating, reviewText } = req.body || {};

        if (!productId || !rating) {
            return responseUtils.sendError(res, 400, 'Bad Request', 'Product ID and Rating are required.');
        }

        const ratingVal = parseInt(rating);
        const prodIdVal = parseInt(productId);

        if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
            return responseUtils.sendError(res, 400, 'Bad Request', 'Rating must be an integer between 1 and 5.');
        }

        try {
            if (db.isMockMode()) {
                const mock = db.getMock();
                const existing = mock.selectOne('reviews', r => r.product_id === prodIdVal && r.customer_id === customerId);
                if (existing) {
                    return responseUtils.sendError(res, 400, 'Duplicate Review', 'You have already reviewed this product.');
                }
                const newReview = mock.insert('reviews', {
                    product_id: prodIdVal,
                    customer_id: customerId,
                    rating: ratingVal,
                    review_text: reviewText || ''
                });
                return responseUtils.sendJSON(res, 201, { success: true, review: newReview });
            } else {
                const sqlCheck = `SELECT id FROM reviews WHERE product_id = :1 AND customer_id = :2`;
                const existing = await db.query(sqlCheck, [prodIdVal, customerId]);
                if (existing.length > 0) {
                    return responseUtils.sendError(res, 400, 'Duplicate Review', 'You have already reviewed this product.');
                }
                const sql = `
                    INSERT INTO reviews (product_id, customer_id, rating, review_text)
                    VALUES (:1, :2, :3, :4)
                `;
                await db.execute(sql, [prodIdVal, customerId, ratingVal, reviewText || '']);
                return responseUtils.sendJSON(res, 201, { success: true, message: 'Review submitted successfully.' });
            }
        } catch (error) {
            return responseUtils.sendError(res, 500, 'Review Submission Failed', error.message);
        }
    },

    /**
     * GET /api/products/details
     * Public: Returns detailed product info including seller, category, avg rating, and review count.
     */
    async getProductDetails(req, res) {
        const productId = parseInt(req.query.id);
        if (isNaN(productId)) {
            return responseUtils.sendError(res, 400, 'Bad Request', 'Valid product ID is required.');
        }

        try {
            let product = null;

            if (db.isMockMode()) {
                const mock = db.getMock();
                const p = mock.selectOne('products', x => x.id === productId);
                if (!p) {
                    return responseUtils.sendError(res, 404, 'Product Not Found', 'The requested product does not exist.');
                }
                const seller = mock.selectOne('users', u => u.id === p.seller_id);
                const category = mock.selectOne('categories', c => c.id === p.category_id);
                const reviews = mock.select('reviews', r => r.product_id === productId);
                const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
                const relatedProducts = mock.select('products', x => x.category_id === p.category_id && x.id !== productId && x.is_active === 1).slice(0, 4);

                product = {
                    ...p,
                    seller_name: seller ? seller.full_name : 'Elite Seller',
                    category_name: category ? category.name : 'Uncategorized',
                    avg_rating: Math.round(avgRating * 10) / 10,
                    review_count: reviews.length,
                    related_products: relatedProducts.map(rp => {
                        const rpCat = mock.selectOne('categories', c => c.id === rp.category_id);
                        return { ...rp, category_name: rpCat ? rpCat.name : 'Uncategorized' };
                    })
                };
            } else {
                const sql = `
                    SELECT p.id, p.seller_id, p.name, p.description, p.price, p.stock, p.is_active, p.created_at,
                           u.full_name as seller_name, p.category_id, c.name as category_name, p.image_url,
                           NVL((SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.product_id = p.id), 0) as avg_rating,
                           NVL((SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id), 0) as review_count
                    FROM products p
                    JOIN users u ON p.seller_id = u.id
                    LEFT JOIN categories c ON p.category_id = c.id
                    WHERE p.id = :1
                `;
                const rows = await db.query(sql, [productId]);
                if (rows.length === 0) {
                    return responseUtils.sendError(res, 404, 'Product Not Found', 'The requested product does not exist.');
                }
                const row = rows[0];
                product = {
                    id: row.ID,
                    seller_id: row.SELLER_ID,
                    name: row.NAME,
                    description: row.DESCRIPTION,
                    price: Number(row.PRICE),
                    stock: Number(row.STOCK),
                    is_active: Number(row.IS_ACTIVE),
                    created_at: row.CREATED_AT,
                    seller_name: row.SELLER_NAME,
                    category_id: row.CATEGORY_ID ? Number(row.CATEGORY_ID) : null,
                    category_name: row.CATEGORY_NAME,
                    image_url: row.IMAGE_URL,
                    avg_rating: Number(row.AVG_RATING),
                    review_count: Number(row.REVIEW_COUNT)
                };

                // Fetch related products
                const relSql = `
                    SELECT p.id, p.name, p.price, p.image_url, p.category_id, c.name as category_name
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id
                    WHERE p.category_id = :1 AND p.id != :2 AND p.is_active = 1 AND ROWNUM <= 4
                `;
                const relRows = await db.query(relSql, [product.category_id, productId]);
                product.related_products = relRows.map(r => ({
                    id: r.ID, name: r.NAME, price: Number(r.PRICE),
                    image_url: r.IMAGE_URL, category_name: r.CATEGORY_NAME
                }));
            }

            return responseUtils.sendJSON(res, 200, { success: true, product });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Product Details Fetch Failed', error.message);
        }
    },

    /**
     * GET /api/products/featured
     * Public: Returns featured/trending product collections for the homepage.
     */
    async getFeaturedProducts(req, res) {
        try {
            if (db.isMockMode()) {
                const mock = db.getMock();
                const allProducts = mock.select('products', p => p.is_active === 1);
                const enriched = allProducts.map(p => {
                    const seller = mock.selectOne('users', u => u.id === p.seller_id);
                    const category = mock.selectOne('categories', c => c.id === p.category_id);
                    const reviews = mock.select('reviews', r => r.product_id === p.id);
                    const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
                    return {
                        ...p,
                        seller_name: seller ? seller.full_name : 'Elite Seller',
                        category_name: category ? category.name : 'Uncategorized',
                        avg_rating: Math.round(avgRating * 10) / 10,
                        review_count: reviews.length
                    };
                });

                // Sort by rating for "top rated"
                const topRated = [...enriched].sort((a, b) => b.avg_rating - a.avg_rating).slice(0, 4);
                // Sort by id desc for "newest arrivals"
                const newest = [...enriched].sort((a, b) => b.id - a.id).slice(0, 4);
                // All as "featured"
                const featured = enriched.slice(0, 8);

                return responseUtils.sendJSON(res, 200, {
                    success: true,
                    featured,
                    topRated,
                    newest
                });
            } else {
                // Featured: all active
                const featSql = `
                    SELECT p.id, p.seller_id, p.name, p.description, p.price, p.stock, p.created_at,
                           u.full_name as seller_name, p.category_id, c.name as category_name, p.image_url,
                           NVL((SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.product_id = p.id), 0) as avg_rating,
                           NVL((SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id), 0) as review_count
                    FROM products p
                    JOIN users u ON p.seller_id = u.id
                    LEFT JOIN categories c ON p.category_id = c.id
                    WHERE p.is_active = 1 AND ROWNUM <= 8
                    ORDER BY p.id DESC
                `;
                const featRows = await db.query(featSql);
                const mapRow = row => ({
                    id: row.ID, seller_id: row.SELLER_ID, name: row.NAME, description: row.DESCRIPTION,
                    price: Number(row.PRICE), stock: Number(row.STOCK), created_at: row.CREATED_AT,
                    seller_name: row.SELLER_NAME, category_id: row.CATEGORY_ID ? Number(row.CATEGORY_ID) : null,
                    category_name: row.CATEGORY_NAME, image_url: row.IMAGE_URL,
                    avg_rating: Number(row.AVG_RATING), review_count: Number(row.REVIEW_COUNT)
                });

                const featured = featRows.map(mapRow);
                const topRated = [...featured].sort((a, b) => b.avg_rating - a.avg_rating).slice(0, 4);
                const newest = [...featured].sort((a, b) => b.id - a.id).slice(0, 4);

                return responseUtils.sendJSON(res, 200, {
                    success: true,
                    featured,
                    topRated,
                    newest
                });
            }
        } catch (error) {
            return responseUtils.sendError(res, 500, 'Featured Products Fetch Failed', error.message);
        }
    },

    /**
     * POST /api/upload/product-image
     * Protected (Sellers only): Uploads an image file and saves it in client/uploads/products.
     */
    async uploadProductImage(req, res) {
        try {
            const contentType = req.headers['content-type'] || '';
            if (!contentType.includes('multipart/form-data')) {
                return responseUtils.sendError(res, 400, 'Bad Request', 'Content-Type must be multipart/form-data');
            }

            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            if (!boundaryMatch) {
                return responseUtils.sendError(res, 400, 'Bad Request', 'Multipart boundary is missing.');
            }
            const boundary = boundaryMatch[1];

            const fs = require('fs');
            const path = require('path');
            const parsed = parseMultipart(req.rawBody, boundary);
            
            const fileKey = Object.keys(parsed.files)[0];
            if (!fileKey) {
                return responseUtils.sendError(res, 400, 'No File', 'No file was uploaded.');
            }

            const file = parsed.files[fileKey];

            // Validate image type
            const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            const ext = path.extname(file.filename).toLowerCase() || '.png';
            if (!allowedExts.includes(ext)) {
                return responseUtils.sendError(res, 400, 'Invalid File Type', 'Only image files (jpg, jpeg, png, gif, webp) are allowed.');
            }

            // Validate file size (5MB max)
            const maxSize = 5 * 1024 * 1024;
            if (file.data.length > maxSize) {
                return responseUtils.sendError(res, 400, 'File Too Large', 'Maximum upload size is 5MB.');
            }

            const newFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
            const uploadDir = path.join(__dirname, '../../client/uploads/products');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            fs.writeFileSync(path.join(uploadDir, newFilename), file.data);

            const imageUrl = `/uploads/products/${newFilename}`;
            return responseUtils.sendJSON(res, 200, {
                success: true,
                imageUrl
            });

        } catch (error) {
            console.error('Upload Error:', error);
            return responseUtils.sendError(res, 500, 'Upload Failed', error.message);
        }
    }
};
