/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * DATABASE SEEDER — ORACLE MODE
 * ====================================================================
 *
 * Generates correct PBKDF2 hashes at runtime using the SAME
 * cryptoUtils.hashPassword() function used during normal registration.
 * This guarantees seeded users and manually-registered users use
 * identical hashing logic — zero mismatch.
 *
 * Usage:
 *   Automatic: Called by server.js on every startup (idempotent — safe
 *              to run repeatedly; skips users that already exist).
 *   Manual:    node server/database/seeder.js
 */

const cryptoUtils = require('../utils/cryptoUtils');

// Canonical seed definitions — plaintext passwords hashed at runtime
const SEED_ROLES = [
    { id: 1, name: 'Admin' },
    { id: 2, name: 'Seller' },
    { id: 3, name: 'Customer' },
    { id: 4, name: 'Service Team' }
];

const SEED_USERS = [
    {
        id: 1, username: 'admin',    plainPassword: 'admin123',
        email: 'admin@idpshop.edu',  role_id: 1,
        full_name: 'System Administrator', is_active: 1
    },
    {
        id: 2, username: 'seller',   plainPassword: 'seller123',
        email: 'seller@idpshop.edu', role_id: 2,
        full_name: 'Elite Campus Seller',  is_active: 1
    },
    {
        id: 3, username: 'customer', plainPassword: 'customer123',
        email: 'customer@idpshop.edu', role_id: 3,
        full_name: 'John Doe Student',    is_active: 1
    },
    {
        id: 4, username: 'service',  plainPassword: 'service123',
        email: 'service@idpshop.edu', role_id: 4,
        full_name: 'Operations Coordinator', is_active: 1
    }
];

const SEED_PRODUCTS = [
    {
        id: 1, seller_id: 2,
        name: 'Engineering Toolkit v3',
        description: 'Complete kit including digital multimeter, breadboard, wire strippers, and microcontrollers for electrical laboratory classes.',
        price: 45.99, stock: 50, is_active: 1
    },
    {
        id: 2, seller_id: 2,
        name: 'Mechanical Drafting Instrument',
        description: 'Professional-grade technical drawing compass set with extension bars, dividers, and precision mechanical lead pens.',
        price: 29.50, stock: 35, is_active: 1
    },
    {
        id: 3, seller_id: 2,
        name: 'University Hooded Sweatshirt',
        description: 'Extra comfort navy blue university design lab hoodie, premium heavy cotton blend.',
        price: 39.99, stock: 120, is_active: 1
    },
    {
        id: 4, seller_id: 2,
        name: 'Reusable Lab Notebook',
        description: 'Synthetically designed spiral smart notebook, dot grid layout, microfiber cloth included.',
        price: 18.00, stock: 200, is_active: 1
    }
];

// -----------------------------------------------------------------------
// ORACLE DB SEEDER
// -----------------------------------------------------------------------
async function seedOracle(db) {
    console.log('\x1b[36m%s\x1b[0m', '>> [Seeder] Running Oracle DB seed checks...');

    // 1. Seed roles (skip existing)
    for (const role of SEED_ROLES) {
        try {
            const existing = await db.query(
                'SELECT id FROM roles WHERE id = :1', [role.id]
            );
            if (existing.length === 0) {
                await db.execute(
                    'INSERT INTO roles (id, name) VALUES (:1, :2)',
                    [role.id, role.name]
                );
                console.log(`   >> [Seeder] Inserted role: ${role.name}`);
            }
        } catch (e) {
            console.warn(`   >> [Seeder] Role seed warning for "${role.name}": ${e.message}`);
        }
    }

    // 2. Seed users — hash each plaintext password fresh at runtime
    for (const u of SEED_USERS) {
        try {
            const existing = await db.query(
                'SELECT id, password_hash FROM users WHERE LOWER(username) = :1', [u.username.toLowerCase()]
            );
            if (existing.length === 0) {
                // Hash the plain password using the SAME function as registration
                const hashedPw = cryptoUtils.hashPassword(u.plainPassword);
                await db.execute(
                    `INSERT INTO users (id, username, password_hash, email, role_id, full_name, is_active)
                     VALUES (:1, :2, :3, :4, :5, :6, :7)`,
                    [u.id, u.username, hashedPw, u.email, u.role_id, u.full_name, u.is_active]
                );
                console.log(`\x1b[32m   >> [Seeder] Seeded user: ${u.username} (role_id=${u.role_id})\x1b[0m`);
            } else {
                // Verify the stored hash is actually correct and valid
                const row = existing[0];
                const storedHash = row.PASSWORD_HASH;
                const passwordOk = cryptoUtils.verifyPassword(u.plainPassword, storedHash);
                if (!passwordOk) {
                    // Hash is stale or incorrect — update it in-place using the fresh hash
                    const hashedPw = cryptoUtils.hashPassword(u.plainPassword);
                    await db.execute(
                        'UPDATE users SET password_hash = :1 WHERE id = :2',
                        [hashedPw, Number(row.ID)]
                    );
                    console.log(`\x1b[33m   >> [Seeder] Oracle: Patched stale hash for user "${u.username}"\x1b[0m`);
                } else {
                    console.log(`   >> [Seeder] User "${u.username}" already exists & hash OK — skipping.`);
                }
            }
        } catch (e) {
            console.warn(`   >> [Seeder] User seed warning for "${u.username}": ${e.message}`);
        }
    }

    // 3. Seed products (skip existing)
    for (const p of SEED_PRODUCTS) {
        try {
            const existing = await db.query(
                'SELECT id FROM products WHERE id = :1', [p.id]
            );
            if (existing.length === 0) {
                await db.execute(
                    `INSERT INTO products (id, seller_id, name, description, price, stock, is_active)
                     VALUES (:1, :2, :3, :4, :5, :6, :7)`,
                    [p.id, p.seller_id, p.name, p.description, p.price, p.stock, p.is_active]
                );
                console.log(`   >> [Seeder] Inserted product: ${p.name}`);
            }
        } catch (e) {
            console.warn(`   >> [Seeder] Product seed warning for "${p.name}": ${e.message}`);
        }
    }

    console.log('\x1b[32m%s\x1b[0m', '>> [Seeder] Oracle seed check complete.');
}

// -----------------------------------------------------------------------
// MOCK DB SEEDER (re-seeds in-memory store if hashes are stale)
// -----------------------------------------------------------------------
function seedMock(mockDb) {
    console.log('\x1b[36m%s\x1b[0m', '>> [Seeder] Verifying MockDB seed integrity...');

    for (const u of SEED_USERS) {
        const existing = mockDb.selectOne('users', x => x.username.toLowerCase() === u.username.toLowerCase());

        if (!existing) {
            const hashedPw = cryptoUtils.hashPassword(u.plainPassword);
            mockDb.insert('users', {
                id: u.id, username: u.username, password_hash: hashedPw,
                email: u.email, role_id: u.role_id,
                full_name: u.full_name, is_active: u.is_active
            });
            console.log(`\x1b[32m   >> [Seeder] Mock: Inserted user "${u.username}"\x1b[0m`);
        } else {
            // Verify the stored hash is actually correct
            const passwordOk = cryptoUtils.verifyPassword(u.plainPassword, existing.password_hash);
            if (!passwordOk) {
                // Hash is stale — patch it in-place
                const hashedPw = cryptoUtils.hashPassword(u.plainPassword);
                mockDb.update(
                    'users',
                    x => x.username.toLowerCase() === u.username.toLowerCase(),
                    { password_hash: hashedPw }
                );
                console.log(`\x1b[33m   >> [Seeder] Mock: Patched stale hash for user "${u.username}"\x1b[0m`);
            } else {
                console.log(`   >> [Seeder] Mock: User "${u.username}" hash OK — no change.`);
            }
        }
    }

    console.log('\x1b[32m%s\x1b[0m', '>> [Seeder] MockDB seed verification complete.');
}

// -----------------------------------------------------------------------
// Main export — called by server.js after db.initialize()
// -----------------------------------------------------------------------
module.exports = {
    async run(db) {
        if (db.isMockMode()) {
            seedMock(db.getMock());
        } else {
            await seedOracle(db);
        }
    }
};

// -----------------------------------------------------------------------
// Allow running directly: node server/database/seeder.js
// -----------------------------------------------------------------------
if (require.main === module) {
    const db = require('./connection');
    (async () => {
        await db.initialize();
        const seeder = module.exports;
        await seeder.run(db);
        console.log('>> [Seeder] Manual seed run complete.');
        process.exit(0);
    })();
}
