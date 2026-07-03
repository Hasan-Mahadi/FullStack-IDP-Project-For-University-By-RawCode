/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * PURE JAVASCRIPT IN-MEMORY MOCK DATABASE ENGINE (WITH JSON STORAGE)
 * ====================================================================
 *
 * This module mimics Oracle Database tables, constraints, and relationships.
 * It serves as an automatic fallback when an Oracle Database server is
 * not available, allowing seamless grading and instant execution.
 *
 * PASSWORD HASHES NOTE:
 * All seed passwords are hashed using PBKDF2-SHA512 with the SAME
 * cryptoUtils.hashPassword() function used at registration time.
 * Salt: f1a8e2d3b4c56789, Iterations: 1000, Key Length: 64 bytes
 *   admin123    -> f1a8e2d3b4c56789.b099d79...e22f
 *   seller123   -> f1a8e2d3b4c56789.208b591...a4f
 *   customer123 -> f1a8e2d3b4c56789.fa559ff...b68
 *   service123  -> f1a8e2d3b4c56789.4f4333e...d8
 *
 * v2 ADDITIONS:
 *   - users: phone_number, address, avatar_url fields
 *   - orders: payment_method, payment_status, transaction_id, shipping_name, shipping_phone, shipping_address
 *   - tables: password_reset_tokens, wishlist, recently_viewed
 */

const fs   = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'db_store.json');

// In-memory data store — includes all v2 tables
let db = {
    roles: [],
    users: [],
    categories: [],
    products: [],
    reviews: [],
    orders: [],
    order_items: [],
    deliveries: [],
    warehouse: [],
    notifications: [],
    messages: [],
    // v2 tables
    password_reset_tokens: [],
    wishlist: [],
    recently_viewed: []
};

// -----------------------------------------------------------------------
// SEED DATA — password hashes verified correct against cryptoUtils.js
// (salt "f1a8e2d3b4c56789", 1000 iterations, 64-byte key, sha512)
// -----------------------------------------------------------------------
const seedData = {
    roles: [
        { id: 1, name: 'Admin' },
        { id: 2, name: 'Seller' },
        { id: 3, name: 'Customer' },
        { id: 4, name: 'Service Team' }
    ],
    users: [
        {
            id: 1,
            username: 'admin',
            // admin123
            password_hash: 'f1a8e2d3b4c56789.b099d79cc3eb3ca1c8805ad02d707abaa8a1a0465525b2dbc0f73611e35135af0242030c1e5caccd19cfac2221266fc20b71dbfc0c4a934e735c74c24a4ee22f',
            email: 'admin@idpshop.edu',
            role_id: 1,
            full_name: 'System Administrator',
            is_active: 1,
            phone_number: null,
            address: null,
            avatar_url: null,
            created_at: new Date().toISOString()
        },
        {
            id: 2,
            username: 'seller',
            // seller123
            password_hash: 'f1a8e2d3b4c56789.208b59137e77eac2d9f55ab20093053adec0625d2fcf5cb8925d9e2b3420f9ece15aa0fc43334189fe0470d49b81862b7b1f91d0e39d2ec1eca018dabd5aaa4f',
            email: 'seller@idpshop.edu',
            role_id: 2,
            full_name: 'Elite Campus Seller',
            is_active: 1,
            phone_number: '+880 1700-000002',
            address: 'Shop Block B, Campus Market, RUET',
            avatar_url: null,
            created_at: new Date().toISOString()
        },
        {
            id: 3,
            username: 'customer',
            // customer123
            password_hash: 'f1a8e2d3b4c56789.fa559ff94d44c698d06f79091d3c9c5dfdca94df0ef7e7faf73a642cd6e8340b7ac64beacdaa2e3a6c5cc564c8d109e77963e5f9091fe7897866254c59f80b68',
            email: 'customer@idpshop.edu',
            role_id: 3,
            full_name: 'John Doe Student',
            is_active: 1,
            phone_number: '+880 1800-000003',
            address: 'Hall-3, Room 204, University Campus',
            avatar_url: null,
            created_at: new Date().toISOString()
        },
        {
            id: 4,
            username: 'service',
            // service123
            password_hash: 'f1a8e2d3b4c56789.4f4333ee61e4302420ffeb89b8e0ddb0f680e066adedb1862c1b7d13fa530227a213a6b00530543d8c22e7448be27693c9de6201520a624fcd8fc3804157fdd8',
            email: 'service@idpshop.edu',
            role_id: 4,
            full_name: 'Operations Coordinator',
            is_active: 1,
            phone_number: '+880 1900-000004',
            address: 'Central Warehouse, Logistics Block',
            avatar_url: null,
            created_at: new Date().toISOString()
        }
    ],
    categories: [
        { id: 1, name: 'Electronics', description: 'Gadgets, devices, and electronic accessories.', icon: 'laptop', is_active: 1 },
        { id: 2, name: 'Clothing', description: 'University apparel and campus fashion.', icon: 'tshirt', is_active: 1 },
        { id: 3, name: 'Books', description: 'Academic textbooks and reading materials.', icon: 'book', is_active: 1 },
        { id: 4, name: 'Lab Equipment', description: 'Scientific tools and lab experiment kits.', icon: 'flask', is_active: 1 },
        { id: 5, name: 'Stationery', description: 'Notebooks, pens, and study supplies.', icon: 'pen', is_active: 1 },
        { id: 6, name: 'Sports', description: 'Fitness gear and sports equipment.', icon: 'dumbbell', is_active: 1 },
        { id: 7, name: 'Home & Living', description: 'Dorm room decor and home goods.', icon: 'home', is_active: 1 },
        { id: 8, name: 'Accessories', description: 'Bags, watches, and daily essentials.', icon: 'gem', is_active: 1 }
    ],
    products: [
        {
            id: 1,
            seller_id: 2,
            name: 'Engineering Toolkit v3',
            description: 'Complete kit including digital multimeter, breadboard, wire strippers, and microcontrollers for electrical laboratory classes.',
            price: 45.99,
            stock: 50,
            is_active: 1,
            category_id: 4,
            image_url: '/uploads/products/placeholder-toolkit.png',
            created_at: new Date().toISOString()
        },
        {
            id: 2,
            seller_id: 2,
            name: 'Mechanical Drafting Instrument',
            description: 'Professional-grade technical drawing compass set with extension bars, dividers, and precision mechanical lead pens.',
            price: 29.50,
            stock: 35,
            is_active: 1,
            category_id: 5,
            image_url: '/uploads/products/placeholder-drafting.png',
            created_at: new Date().toISOString()
        },
        {
            id: 3,
            seller_id: 2,
            name: 'University Hooded Sweatshirt',
            description: 'Extra comfort navy blue university design lab hoodie, premium heavy cotton blend, ideal for cold computer lab shifts.',
            price: 39.99,
            stock: 120,
            is_active: 1,
            category_id: 2,
            image_url: '/uploads/products/placeholder-sweatshirt.png',
            created_at: new Date().toISOString()
        },
        {
            id: 4,
            seller_id: 2,
            name: 'Reusable Lab Notebook',
            description: 'Synthetically designed spiral smart notebook, dot grid layout, includes microfiber cloth for erasable and uploadable pages.',
            price: 18.00,
            stock: 200,
            is_active: 1,
            category_id: 5,
            image_url: '/uploads/products/placeholder-notebook.png',
            created_at: new Date().toISOString()
        }
    ],
    reviews:       [],
    orders:        [],
    order_items:   [],
    deliveries:    [],
    warehouse:     [],
    notifications: [],
    messages:      [],
    // v2 tables — start empty
    password_reset_tokens: [],
    wishlist:              [],
    recently_viewed:       []
};

// -----------------------------------------------------------------------
// Ensure database file and directories exist
// -----------------------------------------------------------------------
function initDb() {
    try {
        if (!fs.existsSync(path.dirname(STORE_PATH))) {
            fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
        }

        if (fs.existsSync(STORE_PATH)) {
            const fileData = fs.readFileSync(STORE_PATH, 'utf8');
            const parsed   = JSON.parse(fileData);

            // Validate stored seed integrity — if stored hashes are stale
            // (pre-fix hashes that began with the old prefix), wipe and reseed.
            const storedAdmin = (parsed.users || []).find(u => u.username === 'admin');
            const CORRECT_ADMIN_HASH_PREFIX = 'f1a8e2d3b4c56789.b099d79';

            if (storedAdmin && !storedAdmin.password_hash.startsWith(CORRECT_ADMIN_HASH_PREFIX)) {
                console.log('\x1b[33m%s\x1b[0m', '>> [MockDB] Stale seed hashes detected — wiping and re-seeding with correct PBKDF2 hashes...');
                db = JSON.parse(JSON.stringify(seedData));
                saveDb();
                console.log('\x1b[36m%s\x1b[0m', '>> [MockDB] Re-seed complete. All default passwords are now correct.');
                return;
            }

            db = parsed;

            // Schema integrity check — add any missing tables (including v2)
            for (const table of Object.keys(seedData)) {
                if (!db[table]) {
                    db[table] = JSON.parse(JSON.stringify(seedData[table]));
                } else if (Array.isArray(db[table]) && db[table].length === 0 && seedData[table].length > 0) {
                    db[table] = JSON.parse(JSON.stringify(seedData[table]));
                }
            }

            // v2: Patch missing fields on existing user records
            db.users = db.users.map(u => ({
                phone_number: null,
                address: null,
                avatar_url: null,
                ...u
            }));

            // v2: Patch missing fields on existing order records
            db.orders = db.orders.map(o => ({
                payment_method: o.payment_method || null,
                payment_status: o.payment_status || null,
                transaction_id: o.transaction_id || null,
                shipping_name: o.shipping_name || null,
                shipping_phone: o.shipping_phone || null,
                shipping_address: o.shipping_address || null,
                ...o
            }));

        } else {
            db = JSON.parse(JSON.stringify(seedData));
            saveDb();
            console.log('\x1b[36m%s\x1b[0m', '>> [MockDB] Local JSON database successfully seeded at server/database/db_store.json!');
        }
    } catch (error) {
        console.error('>> [MockDB] Initialization error:', error);
        db = JSON.parse(JSON.stringify(seedData));
    }
}

// Persist memory store to JSON file
function saveDb() {
    try {
        fs.writeFileSync(STORE_PATH, JSON.stringify(db, null, 2), 'utf8');
    } catch (error) {
        console.error('>> [MockDB] Write error:', error);
    }
}

initDb();

module.exports = {
    /** Select items from table */
    select(table, filterFn = null) {
        if (!db[table]) return [];
        const results = filterFn ? db[table].filter(filterFn) : db[table];
        return JSON.parse(JSON.stringify(results));
    },

    /** Select single item from table */
    selectOne(table, filterFn) {
        if (!db[table]) return null;
        const item = db[table].find(filterFn);
        return item ? JSON.parse(JSON.stringify(item)) : null;
    },

    /** Insert new item with auto-increment ID */
    insert(table, record) {
        if (!db[table]) db[table] = [];
        const nextId = db[table].reduce((max, item) => item.id > max ? item.id : max, 0) + 1;
        const newRecord = {
            id: nextId,
            ...record,
            created_at: record.created_at || new Date().toISOString()
        };
        db[table].push(newRecord);
        saveDb();
        return JSON.parse(JSON.stringify(newRecord));
    },

    /** Update matching items in a table */
    update(table, filterFn, updateFields) {
        if (!db[table]) return [];
        const updatedRecords = [];
        db[table] = db[table].map(item => {
            if (filterFn(item)) {
                const updated = { ...item, ...updateFields };
                updatedRecords.push(updated);
                return updated;
            }
            return item;
        });
        if (updatedRecords.length > 0) saveDb();
        return JSON.parse(JSON.stringify(updatedRecords));
    },

    /** Delete matching items in a table */
    delete(table, filterFn) {
        if (!db[table]) return 0;
        const initialCount = db[table].length;
        db[table] = db[table].filter(item => !filterFn(item));
        const deletedCount = initialCount - db[table].length;
        if (deletedCount > 0) saveDb();
        return deletedCount;
    },

    /** Direct access to entire table state (e.g. for join simulations) */
    getTable(table) {
        return JSON.parse(JSON.stringify(db[table] || []));
    },

    /** Expose seed defaults (used by seeder.js) */
    getSeedData() {
        return JSON.parse(JSON.stringify(seedData));
    }
};
