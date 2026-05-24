/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * AUTHENTICATION & ACCESS CONTROL MIDDLEWARE
 * ====================================================================
 * 
 * Secures REST API routes by extracting and validating the custom session 
 * token. Implements granular role checks for route authorization.
 */

const cryptoUtils = require('../utils/cryptoUtils');
const responseUtils = require('../utils/responseUtils');

module.exports = {
    /**
     * Extracts token, verifies signature, checks expiration, and mounts
     * the authorized user payload onto the request object.
     * Returns true if authorized, false otherwise (handles failure response).
     */
    authorize(req, res) {
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            responseUtils.sendError(res, 401, 'Access Token Required', 'Please log in to access this resource.');
            return false;
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
            responseUtils.sendError(res, 401, 'Malformed Authorization Header', 'Expected Format: Bearer <token>');
            return false;
        }

        const token = parts[1];
        const decodedUser = cryptoUtils.verifyToken(token);

        if (!decodedUser) {
            responseUtils.sendError(res, 401, 'Invalid or Expired Token', 'Session has expired. Please sign in again.');
            return false;
        }

        // Attach parsed user profile data to the request object
        req.user = decodedUser;
        return true;
    },

    /**
     * Verifies if the authorized user has one of the allowed role IDs.
     * Returns true if authorized, false otherwise.
     */
    checkRoles(req, res, allowedRoleIds) {
        if (!req.user) {
            responseUtils.sendError(res, 401, 'Unauthorized', 'Session details not verified.');
            return false;
        }

        if (!allowedRoleIds.includes(Number(req.user.roleId))) {
            responseUtils.sendError(res, 403, 'Forbidden', 'Your account does not possess the permissions required to access this endpoint.');
            return false;
        }

        return true;
    }
};
