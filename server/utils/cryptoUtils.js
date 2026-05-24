/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * NATIVE CRYPTOGRAPHIC UTILITIES (SECURITY COMPLIANT)
 * ====================================================================
 * 
 * This module implements highly secure password hashing and token signing
 * using ONLY Node.js native 'crypto' library. 
 * 
 * It fully implements a custom, secure HMAC-SHA256 Token system 
 * which mimics JSON Web Tokens (JWT) for authentication without external packages.
 */

const crypto = require('crypto');

// Server secret key for token signature validation (should ideally come from environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'idp_framework_free_super_secret_key_2026';

// Base64URL encoding helpers
function base64url(str, encoding = 'utf8') {
    return Buffer.from(str, encoding)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function base64urlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
}

module.exports = {
    /**
     * Hashes a plain-text password using PBKDF2-SHA512.
     * Stores password in 'salt.hash' format.
     */
    hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(
            password,
            salt,
            1000, // Iterations
            64,   // Key length (bytes)
            'sha512'
        ).toString('hex');
        
        return `${salt}.${hash}`;
    },

    /**
     * Verifies if the plain-text password matches the stored PBKDF2 hash.
     */
    verifyPassword(password, storedHash) {
        if (!storedHash || !storedHash.includes('.')) {
            return false;
        }
        
        const [salt, originalHash] = storedHash.split('.');
        const computedHash = crypto.pbkdf2Sync(
            password,
            salt,
            1000,
            64,
            'sha512'
        ).toString('hex');

        // Timing-safe verification to prevent timing attacks
        return crypto.timingSafeEqual(
            Buffer.from(computedHash, 'hex'),
            Buffer.from(originalHash, 'hex')
        );
    },

    /**
     * Generates a custom cryptographically signed JWT-like token.
     * Formatted as: header.payload.signature
     */
    generateToken(payload, lifespanHours = 24) {
        const header = { alg: 'HS256', typ: 'JWT' };
        
        // Add expiration claim (exp)
        const exp = Math.floor(Date.now() / 1000) + (lifespanHours * 3600);
        const tokenPayload = { ...payload, exp };

        const encodedHeader = base64url(JSON.stringify(header));
        const encodedPayload = base64url(JSON.stringify(tokenPayload));
        
        // Create HMAC SHA256 signature
        const signature = crypto.createHmac('sha256', JWT_SECRET)
            .update(`${encodedHeader}.${encodedPayload}`)
            .digest();
        const encodedSignature = base64url(signature, 'binary');

        return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
    },

    /**
     * Decodes and cryptographically verifies a JWT-like token.
     * Returns the payload if valid, otherwise returns null.
     */
    verifyToken(token) {
        if (!token) return null;
        
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [encodedHeader, encodedPayload, encodedSignature] = parts;

        try {
            // Verify HMAC signature
            const computedSignature = crypto.createHmac('sha256', JWT_SECRET)
                .update(`${encodedHeader}.${encodedPayload}`)
                .digest();
            const reEncodedSignature = base64url(computedSignature, 'binary');

            if (encodedSignature !== reEncodedSignature) {
                return null; // Signature mismatch, token is tampered!
            }

            const payload = JSON.parse(base64urlDecode(encodedPayload));
            
            // Check expiration time (exp)
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp && now > payload.exp) {
                return null; // Token has expired
            }

            return payload;
        } catch (e) {
            return null; // JSON parsing or decoding error
        }
    }
};
