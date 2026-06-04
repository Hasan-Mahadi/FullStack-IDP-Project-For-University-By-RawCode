/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * PURE NODE.JS CORE WEB SERVER & ROUTING ENGINE (FRAMEWORK-FREE)
 * ====================================================================
 * 
 * Serves as the primary server coordinator. It provides:
 * 1. An automated static file server (for the Vanilla HTML/CSS/JS frontend).
 * 2. An API router with manual stream-body parsing.
 * 3. Standard CORS preflight handles.
 * 4. Automatic connection layer initialization.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');
const db = require('./database/connection');
const seeder = require('./database/seeder');   // Auto-seed on startup
const routes = require('./routes');
const authMiddleware = require('./middleware/authMiddleware');
const responseUtils = require('./utils/responseUtils');

const PORT = process.env.PORT || 3001;
const CLIENT_DIR = path.join(__dirname, '../client');

// Global request dispatcher
const server = http.createServer(async (req, res) => {
    // 1. CORS Preflight & Global Headers Configuration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // 2. Static Asset Server Route Scope
    if (!pathname.startsWith('/api/')) {
        // Resolve target file path in client directory
        let filePath = path.join(CLIENT_DIR, pathname === '/' ? 'index.html' : pathname);
        
        // Security check: Prevent directory traversal attacks
        if (!filePath.startsWith(CLIENT_DIR)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            return res.end('Access Forbidden');
        }
        
        return responseUtils.serveStaticFile(res, filePath);
    }

    // 3. API Router Route Scope
    const routeKey = `${req.method} ${pathname}`;
    const matchedRoute = routes[routeKey];

    if (!matchedRoute) {
        return responseUtils.sendError(res, 404, 'Endpoint Not Found', `Method ${req.method} on ${pathname} is not mapped.`);
    }

    // Map URL queries onto the request object
    req.query = {};
    parsedUrl.searchParams.forEach((value, key) => {
        req.query[key] = value;
    });

    // 4. Request Stream Buffer Body Parser (Binary-Safe)
    let chunks = [];
    req.on('data', chunk => {
        chunks.push(chunk);
    });

    req.on('end', async () => {
        try {
            const bodyBuffer = Buffer.concat(chunks);
            req.rawBody = bodyBuffer;
            req.rawBodyBuffer = bodyBuffer;

            // Parse JSON body if present
            if (bodyBuffer.length > 0 && req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
                req.body = JSON.parse(bodyBuffer.toString('utf8'));
            } else {
                req.body = {};
            }

            // 5. Auth Middleware Guarding
            if (matchedRoute.auth) {
                const isAuthorized = authMiddleware.authorize(req, res);
                if (!isAuthorized) return; // Error response already handled

                // Role Guarding check
                if (matchedRoute.roles) {
                    const isRoleAllowed = authMiddleware.checkRoles(req, res, matchedRoute.roles);
                    if (!isRoleAllowed) return; // Error response already handled
                }
            }

            // 6. Execute Controller Handler
            await matchedRoute.handler(req, res);

        } catch (error) {
            console.error(`>> [Server Error] Route: ${routeKey} failed.`, error);
            return responseUtils.sendError(res, 500, 'Server Execution Failure', error.message);
        }
    });
});

// Bootstrapper function
async function boot() {
    try {
        // Create client/uploads/products directory if it doesn't exist
        const uploadsDir = path.join(__dirname, '../client/uploads/products');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            console.log('>> [Server] Created upload directory at: client/uploads/products');
        }

        // 1. Establish database connection pool / mock fallbacks
        const dbReady = await db.initialize();
        if (!dbReady) {
            throw new Error('Database initialization failed.');
        }

        // 2. Run idempotent seeder — ensures all default users exist with correct
        //    PBKDF2 hashes. Safe to run on every startup; skips existing records.
        await seeder.run(db);

        // 3. Start HTTP Server Listener
        server.listen(PORT, () => {
            console.log('\x1b[32m%s\x1b[0m', `====================================================================`);
            console.log('\x1b[32m%s\x1b[0m', `>> [Server Engine] STATUS: Online & Listening`);
            console.log('\x1b[32m%s\x1b[0m', `>> [Server Engine] HOST URL: http://localhost:${PORT}`);
            console.log('\x1b[32m%s\x1b[0m', `====================================================================`);
            console.log('\x1b[36m%s\x1b[0m', `>> Default accounts: admin/admin123  seller/seller123  customer/customer123  service/service123`);
        });

    } catch (e) {
        console.error('>> [Server Boot Crash] Fatal Exception:', e.message);
        process.exit(1);
    }
}

boot();

