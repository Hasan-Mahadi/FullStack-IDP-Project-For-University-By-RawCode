/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * HTTP RESPONSE UTILITIES (STANDARD FORMATTER)
 * ====================================================================
 * 
 * Provides unified helper functions for HTTP response writing, 
 * JSON response wrapping, API error formats, and static asset streaming.
 */

const fs = require('fs');
const path = require('path');

// Dictionary of popular content MIME-types for static file serving
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8'
};

module.exports = {
    /**
     * Send standard structured JSON response.
     */
    sendJSON(res, statusCode, data) {
        res.writeHead(statusCode, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*', // Enable development CORS
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        });
        res.end(JSON.stringify(data));
    },

    /**
     * Send standardized JSON error response.
     */
    sendError(res, statusCode, message, details = null) {
        this.sendJSON(res, statusCode, {
            success: false,
            error: {
                message,
                details,
                timestamp: new Date().toISOString()
            }
        });
    },

    /**
     * Serve static files directly from local storage.
     * Incorporates basic caching header configurations and custom 404 fallbacks.
     */
    serveStaticFile(res, absolutePath) {
        fs.readFile(absolutePath, (err, data) => {
            if (err) {
                // If static file is missing, return clean HTML 404 page
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                return res.end(`
                    <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                        <h1 style="color: #ff5e57;">404 - Resource Not Found</h1>
                        <p>The requested file or dashboard path could not be located on the server.</p>
                        <a href="/" style="color: #007aff; text-decoration: none; font-weight: bold;">Return to Campus Portal</a>
                    </div>
                `);
            }

            const ext = path.extname(absolutePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' // Prevent aggressive browser caching during testing
            });
            res.end(data);
        });
    }
};
