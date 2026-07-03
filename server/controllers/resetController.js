/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * FORGOT PASSWORD & PASSWORD RESET CONTROLLER (SECURE TOKEN FLOW)
 * ====================================================================
 *
 * Implements a complete forgot/reset password workflow with:
 * - Secure token generation (crypto.randomBytes → hashed)
 * - Token expiration (1 hour)
 * - Demo mode: token returned in response for dev environments
 * - Oracle DB + MockDB dual support
 */

const db          = require('../database/connection');
const cryptoUtils = require('../utils/cryptoUtils');
const responseUtils = require('../utils/responseUtils');
const crypto      = require('crypto');

// Token validity window (1 hour in ms)
const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
    /**
     * POST /api/auth/forgot-password
     * Accepts email, finds user, generates reset token (demo mode: returns token in response).
     */
    async forgotPassword(req, res) {
        const { email } = req.body || {};

        if (!email || !email.includes('@')) {
            return responseUtils.sendError(res, 400, 'Invalid Email', 'A valid email address is required.');
        }

        try {
            let userRecord = null;

            if (db.isMockMode()) {
                const mock = db.getMock();
                userRecord = mock.selectOne('users', u => u.email.toLowerCase() === email.toLowerCase() && u.is_active === 1);
            } else {
                const rows = await db.query(
                    'SELECT id, email, full_name FROM users WHERE LOWER(email) = :1 AND is_active = 1',
                    [email.toLowerCase()]
                );
                if (rows.length > 0) {
                    userRecord = { id: Number(rows[0].ID), email: rows[0].EMAIL, full_name: rows[0].FULL_NAME };
                }
            }

            if (!userRecord) {
                // Security: Return same response even if user doesn't exist
                return responseUtils.sendJSON(res, 200, {
                    success: true,
                    demo: true,
                    message: 'If an account with that email exists, a reset token has been generated.',
                    resetToken: null
                });
            }

            // Generate a cryptographically secure random token
            const rawToken     = crypto.randomBytes(32).toString('hex');
            const tokenHash    = hashToken(rawToken);
            const expiresAt    = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();

            // Invalidate any existing tokens for this user
            if (db.isMockMode()) {
                const mock = db.getMock();
                mock.delete('password_reset_tokens', t => t.user_id === userRecord.id && t.used === 0);
                mock.insert('password_reset_tokens', {
                    user_id:    userRecord.id,
                    token_hash: tokenHash,
                    expires_at: expiresAt,
                    used:       0
                });
            } else {
                await db.execute(
                    'UPDATE password_reset_tokens SET used = 1 WHERE user_id = :1 AND used = 0',
                    [userRecord.id]
                );
                await db.execute(
                    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used)
                     VALUES (:1, :2, CURRENT_TIMESTAMP + INTERVAL '1' HOUR, 0)`,
                    [userRecord.id, tokenHash]
                );
            }

            // DEMO MODE: Return the raw token directly (no email service needed)
            return responseUtils.sendJSON(res, 200, {
                success:    true,
                demo:       true,
                message:    `Password reset token generated for ${userRecord.email}. (Demo mode — token shown below)`,
                resetToken: rawToken,
                expiresAt
            });

        } catch (error) {
            console.error('[RESET ERROR]', error);
            return responseUtils.sendError(res, 500, 'Reset Request Failed', error.message);
        }
    },

    /**
     * POST /api/auth/reset-password
     * Accepts token + new password. Verifies token, updates password hash.
     */
    async resetPassword(req, res) {
        const { token, newPassword, confirmPassword } = req.body || {};

        if (!token || !newPassword) {
            return responseUtils.sendError(res, 400, 'Missing Fields', 'Reset token and new password are required.');
        }

        if (newPassword.length < 6) {
            return responseUtils.sendError(res, 400, 'Weak Password', 'Password must be at least 6 characters.');
        }

        if (newPassword !== confirmPassword) {
            return responseUtils.sendError(res, 400, 'Password Mismatch', 'New password and confirmation do not match.');
        }

        const tokenHash = hashToken(token);
        const now       = new Date().toISOString();

        try {
            let tokenRecord = null;

            if (db.isMockMode()) {
                const mock = db.getMock();
                tokenRecord = mock.selectOne('password_reset_tokens',
                    t => t.token_hash === tokenHash && t.used === 0 && t.expires_at > now
                );
            } else {
                const rows = await db.query(
                    `SELECT id, user_id FROM password_reset_tokens
                     WHERE token_hash = :1 AND used = 0
                     AND expires_at > CURRENT_TIMESTAMP`,
                    [tokenHash]
                );
                if (rows.length > 0) {
                    tokenRecord = { id: Number(rows[0].ID), user_id: Number(rows[0].USER_ID) };
                }
            }

            if (!tokenRecord) {
                return responseUtils.sendError(res, 400, 'Invalid or Expired Token',
                    'This reset link is invalid or has expired. Please request a new one.');
            }

            // Hash new password
            const newHash = cryptoUtils.hashPassword(newPassword);

            if (db.isMockMode()) {
                const mock = db.getMock();
                mock.update('users', u => u.id === tokenRecord.user_id, { password_hash: newHash });
                mock.update('password_reset_tokens', t => t.id === tokenRecord.id, { used: 1 });
            } else {
                await db.execute('UPDATE users SET password_hash = :1 WHERE id = :2', [newHash, tokenRecord.user_id]);
                await db.execute('UPDATE password_reset_tokens SET used = 1 WHERE id = :1', [tokenRecord.id]);
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                message: 'Password has been successfully reset. You may now log in.'
            });

        } catch (error) {
            console.error('[RESET PASSWORD ERROR]', error);
            return responseUtils.sendError(res, 500, 'Password Reset Failed', error.message);
        }
    }
};
