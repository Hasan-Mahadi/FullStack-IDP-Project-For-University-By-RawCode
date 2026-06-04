/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * DUAL-MODE UNIFIED DATABASE CONNECTOR (ORACLE DB & MOCK DB FALLBACK)
 * ====================================================================
 * 
 * This module manages connections to the Oracle Database.
 * If the 'oracledb' library is not found or connection credentials are
 * absent, it activates the custom in-memory JSON fallback database.
 * 
 * This ensures the application is completely robust and ready to demo 
 * in any academic environment, while maintaining professional SQL code.
 */

const mockDb = require('./mockDb');

// Database configuration loaded from process.env
const dbConfig = {
    user: process.env.DB_USER || 'ecommerce_user',
    password: process.env.DB_PASSWORD || 'password123',
    connectString: process.env.DB_CONNECTION_STRING || 'localhost:1521/XEPDB1'
};

let oracledb = null;
let isMock = false; // Default to false (Oracle DB mode)
let connectionPool = null;

// Dynamic load of Oracle DB driver
try {
    oracledb = require('oracledb');
    // Enable outFormat as object to get JSON-like results back from Oracle
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    oracledb.autoCommit = true;
    
    // Fallback to mock mode ONLY if explicitly requested via environment variable
    if (process.env.FORCE_MOCK === 'true') {
        isMock = true;
    }
} catch (e) {
    // oracledb dependency not installed, fallback to mock DB
    isMock = true;
}

// Initialize the database connection / pool
async function initialize() {
    if (isMock) {
        console.log('\x1b[35m%s\x1b[0m', '>> [DB Engine] ACTIVE MODE: Oracle SQL-Mock JSON Engine (Self-contained)');
        console.log('\x1b[35m%s\x1b[0m', '   * Perfect for quick IDP presentations and environment-independent grading!');
        console.log('\x1b[35m%s\x1b[0m', '   * Persists real-time changes to: server/database/db_store.json');
        return true;
    }

    try {
        console.log('\x1b[36m%s\x1b[0m', `>> [DB Engine] Connecting to Oracle Database at: ${dbConfig.connectString}...`);
        connectionPool = await oracledb.createPool(dbConfig);
        // Test connection to ensure credentials are valid and password has not expired
        const conn = await connectionPool.getConnection();
        await conn.close();
        console.log('\x1b[32m%s\x1b[0m', '>> [DB Engine] SUCCESS: Connected to Oracle Database Pool established.');
        return true;
    } catch (err) {
        console.warn('\x1b[33m%s\x1b[0m', `>> [DB Engine] WARNING: Oracle Database connection failed. Falling back to Mock DB...`);
        console.warn('\x1b[33m%s\x1b[0m', `   Reason: ${err.message}`);
        isMock = true;
        console.log('\x1b[35m%s\x1b[0m', '>> [DB Engine] ACTIVE MODE: Fallback to Oracle SQL-Mock JSON Engine (Self-contained)');
        return true;
    }
}

// Unified query runner
async function query(sql, binds = [], mockTable = null, mockFilterFn = null) {
    if (isMock) {
        // Fallback to JS Mock Engine
        if (mockTable) {
            return mockDb.select(mockTable, mockFilterFn);
        }
        // If mockTable is not passed, attempt an analytical lookup based on standard tables
        console.warn(`>> [MockDB] Direct SQL query executed in Mock mode: "${sql}". Returning empty or fallback result.`);
        return [];
    }

    let connection;
    try {
        connection = await oracledb.getConnection();
        const result = await connection.execute(sql, binds);
        return result.rows;
    } catch (err) {
        console.error('>> [Oracle DB Error] Query failed:', err);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
}

// Unified mutation runner (Insert, Update, Delete)
async function execute(sql, binds = [], mockTable = null, mockActionFn = null) {
    if (isMock) {
        // Fallback to JS Mock Engine mutations
        if (mockTable && mockActionFn) {
            return mockActionFn(mockDb);
        }
        return { rowsAffected: 0 };
    }

    let connection;
    try {
        connection = await oracledb.getConnection();
        const result = await connection.execute(sql, binds, { autoCommit: true });
        return {
            rowsAffected: result.rowsAffected,
            insertId: result.lastRowid || null
        };
    } catch (err) {
        console.error('>> [Oracle DB Error] Execution failed:', err);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
}

module.exports = {
    initialize,
    query,
    execute,
    isMockMode: () => isMock,
    getMock: () => mockDb
};
