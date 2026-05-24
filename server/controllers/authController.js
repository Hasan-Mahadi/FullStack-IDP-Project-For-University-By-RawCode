/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * AUTHENTICATION CONTROLLER (REGISTER, LOGIN, PROFILE STATUS)
 * ====================================================================
 *
 * Handles user onboarding and secure session logins. Automatically
 * branches between Oracle SQL statements and JavaScript Mock DB triggers.
 *
 * DEBUG LOGGING:
 *   Set env var DEBUG_AUTH=true to enable verbose auth flow logging.
 *   e.g.  DEBUG_AUTH=true node server/server.js
 *   (Always enabled in development — remove the flag for production.)
 */

const db          = require('../database/connection');
const cryptoUtils = require('../utils/cryptoUtils');
const responseUtils = require('../utils/responseUtils');

// Enable debug auth logging — always on so every login attempt is traceable
const DEBUG_AUTH = true;

function authLog(...args) {
    if (DEBUG_AUTH) console.log('\x1b[35m[AUTH DEBUG]\x1b[0m', ...args);
}

module.exports = {
    /**
     * POST /api/auth/register
     * Registers a new user account.
     */
    async register(req, res) {
        const { username, password, email, roleId, fullName } = req.body || {};

        // 1. Validation
        if (!username || !password || !email || !roleId || !fullName) {
            return responseUtils.sendError(res, 400, 'Missing Credentials',
                'All registration fields (username, password, email, roleId, fullName) are mandatory.');
        }

        const normalizedRole = Number(roleId);
        if (![1, 2, 3, 4].includes(normalizedRole)) {
            return responseUtils.sendError(res, 400, 'Invalid Account Role',
                'Selected user role ID must correspond to Admin (1), Seller (2), Customer (3), or Service Team (4).');
        }

        try {
            let existingUser = null;

            // 2. Uniqueness checks
            if (db.isMockMode()) {
                const mock = db.getMock();
                existingUser = mock.selectOne('users', u =>
                    u.username.toLowerCase() === username.toLowerCase() ||
                    u.email.toLowerCase() === email.toLowerCase()
                );
            } else {
                const results = await db.query(
                    'SELECT id FROM users WHERE LOWER(username) = :1 OR LOWER(email) = :2',
                    [username.toLowerCase(), email.toLowerCase()]
                );
                if (results.length > 0) existingUser = results[0];
            }

            if (existingUser) {
                return responseUtils.sendError(res, 409, 'Conflict Detected',
                    'Username or email address has already been registered.');
            }

            // 3. Hash password using shared cryptoUtils (same as login comparison)
            const hashedPasswordHash = cryptoUtils.hashPassword(password);

            // 4. Database Insertion
            let newUser = null;
            if (db.isMockMode()) {
                const mock = db.getMock();
                newUser = mock.insert('users', {
                    username,
                    password_hash: hashedPasswordHash,
                    email,
                    role_id: normalizedRole,
                    full_name: fullName,
                    is_active: 1
                });
            } else {
                const result = await db.execute(
                    'INSERT INTO users (username, password_hash, email, role_id, full_name, is_active) VALUES (:1, :2, :3, :4, :5, 1)',
                    [username, hashedPasswordHash, email, normalizedRole, fullName]
                );
                newUser = {
                    id: result.insertId,
                    username,
                    email,
                    role_id: normalizedRole,
                    full_name: fullName,
                    is_active: 1
                };
            }

            // 5. Build token payload (exclude password hash)
            const roleName = normalizedRole === 1 ? 'Admin' :
                             normalizedRole === 2 ? 'Seller' :
                             normalizedRole === 3 ? 'Customer' : 'Service Team';
            const tokenPayload = {
                userId: newUser.id,
                username: newUser.username,
                roleId: normalizedRole,
                roleName,
                fullName: newUser.full_name
            };

            const token = cryptoUtils.generateToken(tokenPayload);

            return responseUtils.sendJSON(res, 201, {
                success: true,
                message: 'User account successfully created.',
                token,
                user: tokenPayload
            });

        } catch (error) {
            return responseUtils.sendError(res, 500, 'Registration Failure', error.message);
        }
    },

    /**
     * POST /api/auth/login
     * Authenticates credentials and issues a signed session token.
     *
     * Debug flow:
     *   [1] username lookup (case-insensitive)
     *   [2] active-account check
     *   [3] PBKDF2 password match
     *   [4] role resolution
     *   [5] token generation
     */
    async login(req, res) {
        const { username, password } = req.body || {};

        authLog(`Login attempt — username: "${username}" | Active DB Storage: ${db.isMockMode() ? 'MOCK JSON DB' : 'REAL ORACLE DATABASE'}`);

        if (!username || !password) {
            return responseUtils.sendError(res, 400, 'Credentials Required',
                'Username and password fields are both required.');
        }

        try {
            let userRecord = null;

            // ── STEP 1: Fetch user record by username (case-insensitive) ──────
            if (db.isMockMode()) {
                const mock = db.getMock();
                userRecord = mock.selectOne('users',
                    u => u.username.toLowerCase() === username.toLowerCase()
                );
                authLog(`[MockDB] User lookup for "${username.toLowerCase()}":`,
                    userRecord ? `FOUND (id=${userRecord.id}, role_id=${userRecord.role_id})` : 'NOT FOUND');
            } else {
                const sql = `
                    SELECT u.id, u.username, u.password_hash, u.email,
                           u.role_id, r.name AS role_name, u.full_name, u.is_active
                    FROM   users u
                    JOIN   roles r ON u.role_id = r.id
                    WHERE  LOWER(u.username) = :1
                `;
                const results = await db.query(sql, [username.toLowerCase()]);

                authLog(`[Oracle] User lookup for "${username.toLowerCase()}":`,
                    results.length > 0
                        ? `FOUND (id=${results[0].ID}, role_id=${results[0].ROLE_ID})`
                        : 'NOT FOUND');

                if (results.length > 0) {
                    const row = results[0];
                    userRecord = {
                        id:            row.ID,
                        username:      row.USERNAME,
                        password_hash: row.PASSWORD_HASH,
                        email:         row.EMAIL,
                        role_id:       Number(row.ROLE_ID),
                        role_name:     row.ROLE_NAME,
                        full_name:     row.FULL_NAME,
                        is_active:     Number(row.IS_ACTIVE)
                    };
                }
            }

            console.log(`>>> [Auth] User record fetched: ${userRecord ? 'found' : 'not found'}`);
            if (!userRecord) {
                authLog(`Login FAILED — username "${username}" not found in database.`);
                return responseUtils.sendError(res, 401, 'Unauthorized', 'Invalid username or password.');
            }

            // ── STEP 2: Active account check ──────────────────────────────────
            authLog(`Account active check — is_active: ${userRecord.is_active}`);
            if (Number(userRecord.is_active) !== 1) {
                authLog(`Login FAILED — account "${username}" is suspended.`);
                return responseUtils.sendError(res, 403, 'Account Suspended',
                    'Your account has been deactivated by the administrator. Contact support.');
            }

            // ── STEP 3: PBKDF2 password verification ──────────────────────────
            //   Verify using the SAME salt+iterations that were used when hashing.
            //   The stored hash format is:  salt.hash
            const hashStored    = userRecord.password_hash || '';
            const hashHasDot    = hashStored.includes('.');
            const hashLength    = hashStored.length;

            authLog(`Password hash check — hash present: ${!!hashStored}, ` +
                    `has dot separator: ${hashHasDot}, stored length: ${hashLength}`);

            if (!hashHasDot) {
                authLog(`Login FAILED — stored password_hash for "${username}" is malformed (no dot separator). ` +
                        `This user's record may have been inserted with a plaintext or incorrectly formatted hash.`);
                return responseUtils.sendError(res, 401, 'Unauthorized', 'Invalid username or password.');
            }

            // ── STEP 3: Verify Password Hash ────────────────────────────────
            authLog('>>> [Auth] Verifying password hash');
            const isValid = cryptoUtils.verifyPassword(password, userRecord.password_hash);
            authLog(`>>> [Auth] Password verification result: ${isValid}`);
            if (!isValid) {
                authLog(`Login FAILED — password mismatch for user "${username}".`);
                return responseUtils.sendError(res, 401, 'Unauthorized', 'Invalid username or password.');
            }

            // ── STEP 4: Resolve Role Name if in mock mode ────────────────────────
            let roleName = userRecord.role_name;
            if (db.isMockMode()) {
                const mock    = db.getMock();
                const roleObj = mock.selectOne('roles', r => r.id === userRecord.role_id);
                roleName      = roleObj ? roleObj.name : 'Unknown';
            }
            authLog(`>>> [Auth] Role resolved: ${roleName} (role_id=${userRecord.role_id})`);

            // ── STEP 5: Generate Access Token ─────────────────────────────────────
            const tokenPayload = {
                userId:   userRecord.id,
                username: userRecord.username,
                roleId:   userRecord.role_id,
                roleName,
                fullName: userRecord.full_name
            };
            const token = cryptoUtils.generateToken(tokenPayload);
            authLog(`>>> [Auth] Login SUCCESS — token issued for "${username}" (${roleName})`);

            return responseUtils.sendJSON(res, 200, {
                success: true,
                message: 'Login successful.',
                token,
                user: tokenPayload
            });

        } catch (error) {
            console.error('[AUTH ERROR]', error);
            return responseUtils.sendError(res, 500, 'Authentication Error', error.message);
        }
    },

    /**
     * GET /api/auth/me
     * Returns profile details for authorized sessions.
     */
    async getMe(req, res) {
        return responseUtils.sendJSON(res, 200, {
            success: true,
            user: req.user
        });
    }
};
