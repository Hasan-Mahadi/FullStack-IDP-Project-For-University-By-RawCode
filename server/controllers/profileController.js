/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * USER PROFILE MANAGEMENT CONTROLLER (ALL ROLES)
 * ====================================================================
 *
 * Handles viewing/editing personal info, avatar uploads, and
 * password changes for all authenticated roles.
 * Oracle DB + MockDB dual mode.
 */

const db          = require('../database/connection');
const cryptoUtils = require('../utils/cryptoUtils');
const responseUtils = require('../utils/responseUtils');
const fs          = require('fs');
const path        = require('path');

const AVATAR_DIR = path.join(__dirname, '../../client/uploads/profiles');

module.exports = {
    /**
     * GET /api/profile
     * Protected (All Roles): Returns own profile data.
     */
    async getProfile(req, res) {
        const userId = req.user.userId;

        try {
            let profile = null;

            if (db.isMockMode()) {
                const mock = db.getMock();
                const u    = mock.selectOne('users', x => x.id === userId);
                if (u) {
                    profile = {
                        id:           u.id,
                        username:     u.username,
                        email:        u.email,
                        full_name:    u.full_name,
                        role_id:      u.role_id,
                        is_active:    u.is_active,
                        phone_number: u.phone_number || null,
                        address:      u.address || null,
                        avatar_url:   u.avatar_url || null,
                        created_at:   u.created_at
                    };
                }
            } else {
                const rows = await db.query(
                    `SELECT u.id, u.username, u.email, u.full_name, u.role_id, u.is_active,
                            u.phone_number, u.address, u.avatar_url, u.created_at, r.name as role_name
                     FROM users u JOIN roles r ON u.role_id = r.id
                     WHERE u.id = :1`,
                    [userId]
                );
                if (rows.length > 0) {
                    const row = rows[0];
                    profile = {
                        id:           Number(row.ID),
                        username:     row.USERNAME,
                        email:        row.EMAIL,
                        full_name:    row.FULL_NAME,
                        role_id:      Number(row.ROLE_ID),
                        role_name:    row.ROLE_NAME,
                        is_active:    Number(row.IS_ACTIVE),
                        phone_number: row.PHONE_NUMBER || null,
                        address:      row.ADDRESS || null,
                        avatar_url:   row.AVATAR_URL || null,
                        created_at:   row.CREATED_AT
                    };
                }
            }

            if (!profile) {
                return responseUtils.sendError(res, 404, 'Profile Not Found', 'User profile not found.');
            }

            return responseUtils.sendJSON(res, 200, { success: true, profile });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Profile Fetch Error', error.message);
        }
    },

    /**
     * PUT /api/profile
     * Protected (All Roles): Updates personal info (full_name, phone_number, address, email).
     */
    async updateProfile(req, res) {
        const userId = req.user.userId;
        const { fullName, phoneNumber, address, email } = req.body || {};

        if (!fullName || fullName.trim().length < 2) {
            return responseUtils.sendError(res, 400, 'Validation Error', 'Full name must be at least 2 characters.');
        }

        if (email && !email.includes('@')) {
            return responseUtils.sendError(res, 400, 'Validation Error', 'Invalid email format.');
        }

        try {
            if (db.isMockMode()) {
                const mock    = db.getMock();
                const current = mock.selectOne('users', u => u.id === userId);
                if (!current) return responseUtils.sendError(res, 404, 'User Not Found', 'User not found.');

                // Check email uniqueness if changed
                if (email && email.toLowerCase() !== current.email.toLowerCase()) {
                    const existing = mock.selectOne('users', u => u.email.toLowerCase() === email.toLowerCase() && u.id !== userId);
                    if (existing) return responseUtils.sendError(res, 409, 'Email Taken', 'Email address is already in use.');
                }

                mock.update('users', u => u.id === userId, {
                    full_name:    fullName.trim(),
                    phone_number: phoneNumber || current.phone_number || null,
                    address:      address || current.address || null,
                    email:        email ? email.trim().toLowerCase() : current.email
                });
            } else {
                // Check email uniqueness
                if (email) {
                    const dup = await db.query(
                        'SELECT id FROM users WHERE LOWER(email) = :1 AND id != :2',
                        [email.toLowerCase(), userId]
                    );
                    if (dup.length > 0) return responseUtils.sendError(res, 409, 'Email Taken', 'Email is already in use.');
                }

                await db.execute(
                    `UPDATE users SET full_name = :1, phone_number = :2, address = :3
                     ${email ? ', email = :4' : ''}
                     WHERE id = ${email ? ':5' : ':4'}`,
                    email
                        ? [fullName.trim(), phoneNumber || null, address || null, email.toLowerCase(), userId]
                        : [fullName.trim(), phoneNumber || null, address || null, userId]
                );
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                message: 'Profile updated successfully.'
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Profile Update Error', error.message);
        }
    },

    /**
     * PUT /api/profile/password
     * Protected (All Roles): Change password.
     */
    async changePassword(req, res) {
        const userId = req.user.userId;
        const { currentPassword, newPassword, confirmPassword } = req.body || {};

        if (!currentPassword || !newPassword || !confirmPassword) {
            return responseUtils.sendError(res, 400, 'Missing Fields', 'Current password, new password, and confirmation are required.');
        }

        if (newPassword.length < 6) {
            return responseUtils.sendError(res, 400, 'Weak Password', 'New password must be at least 6 characters.');
        }

        if (newPassword !== confirmPassword) {
            return responseUtils.sendError(res, 400, 'Password Mismatch', 'New password and confirmation do not match.');
        }

        try {
            let userRecord = null;

            if (db.isMockMode()) {
                userRecord = db.getMock().selectOne('users', u => u.id === userId);
            } else {
                const rows = await db.query('SELECT id, password_hash FROM users WHERE id = :1', [userId]);
                if (rows.length > 0) userRecord = { id: Number(rows[0].ID), password_hash: rows[0].PASSWORD_HASH };
            }

            if (!userRecord) return responseUtils.sendError(res, 404, 'User Not Found', 'User not found.');

            const isCurrentValid = cryptoUtils.verifyPassword(currentPassword, userRecord.password_hash);
            if (!isCurrentValid) {
                return responseUtils.sendError(res, 401, 'Incorrect Password', 'Current password is incorrect.');
            }

            const newHash = cryptoUtils.hashPassword(newPassword);

            if (db.isMockMode()) {
                db.getMock().update('users', u => u.id === userId, { password_hash: newHash });
            } else {
                await db.execute('UPDATE users SET password_hash = :1 WHERE id = :2', [newHash, userId]);
            }

            return responseUtils.sendJSON(res, 200, {
                success: true,
                message: 'Password changed successfully.'
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Password Change Error', error.message);
        }
    },

    /**
     * POST /api/profile/avatar
     * Protected (All Roles): Upload avatar image.
     * Expects multipart/form-data with field "avatar".
     */
    async uploadAvatar(req, res) {
        const userId = req.user.userId;

        try {
            const contentType = req.headers['content-type'] || '';
            if (!contentType.includes('multipart/form-data')) {
                return responseUtils.sendError(res, 400, 'Invalid Content Type', 'Avatar upload requires multipart/form-data.');
            }

            // Parse boundary
            const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
            if (!boundaryMatch) {
                return responseUtils.sendError(res, 400, 'Parse Error', 'Could not extract multipart boundary.');
            }

            const boundary = boundaryMatch[1];
            const body     = req.rawBodyBuffer || req.rawBody;

            // Parse multipart
            const parsed = parseMultipart(body, boundary);
            const avatarFile = parsed.files['avatar'];

            if (!avatarFile) {
                return responseUtils.sendError(res, 400, 'No File', 'No avatar file was uploaded.');
            }

            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(avatarFile.contentType)) {
                return responseUtils.sendError(res, 400, 'Invalid File Type', 'Only JPEG, PNG, GIF, and WebP images are allowed.');
            }

            // Ensure upload directory
            if (!fs.existsSync(AVATAR_DIR)) {
                fs.mkdirSync(AVATAR_DIR, { recursive: true });
            }

            // Save file with userId-based name to avoid conflicts
            const ext      = avatarFile.filename.split('.').pop().toLowerCase();
            const filename = `avatar-${userId}-${Date.now()}.${ext}`;
            const fullPath = path.join(AVATAR_DIR, filename);

            fs.writeFileSync(fullPath, avatarFile.data);

            const avatarUrl = `/uploads/profiles/${filename}`;

            if (db.isMockMode()) {
                db.getMock().update('users', u => u.id === userId, { avatar_url: avatarUrl });
            } else {
                await db.execute('UPDATE users SET avatar_url = :1 WHERE id = :2', [avatarUrl, userId]);
            }

            return responseUtils.sendJSON(res, 200, {
                success:   true,
                avatarUrl,
                message:   'Avatar uploaded successfully.'
            });

        } catch (error) {
            console.error('[AVATAR UPLOAD ERROR]', error);
            return responseUtils.sendError(res, 500, 'Avatar Upload Failed', error.message);
        }
    }
};

// Reuse multipart parser logic (same as prodController)
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
        const start = parts[i] + boundaryBuf.length + 2;
        const end   = parts[i + 1] - 2;
        if (start >= end) continue;
        const partBuffer = buffer.subarray(start, end);
        const headerEndIdx = partBuffer.indexOf('\r\n\r\n');
        if (headerEndIdx === -1) continue;
        const headerStr = partBuffer.subarray(0, headerEndIdx).toString('utf8');
        const bodyVal   = partBuffer.subarray(headerEndIdx + 4);
        const cd = headerStr.split('\r\n').find(h => h.toLowerCase().startsWith('content-disposition'));
        if (!cd) continue;
        const nameMatch     = cd.match(/name="([^"]+)"/);
        const filenameMatch = cd.match(/filename="([^"]+)"/);
        if (filenameMatch) {
            const fieldName  = nameMatch ? nameMatch[1] : 'file';
            const ctLine     = headerStr.split('\r\n').find(h => h.toLowerCase().startsWith('content-type'));
            const ct         = ctLine ? ctLine.split(':')[1].trim() : 'application/octet-stream';
            result.files[fieldName] = { filename: filenameMatch[1], contentType: ct, data: bodyVal };
        } else if (nameMatch) {
            result.fields[nameMatch[1]] = bodyVal.toString('utf8');
        }
    }
    return result;
}
