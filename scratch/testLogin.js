/**
 * Test all 4 seed account logins via Node.js http
 * Run: node scratch/testLogin.js
 */
const http = require('http');

const PORT = process.env.PORT || 3001;

const accounts = [
    { username: 'admin',    password: 'admin123'    },
    { username: 'seller',   password: 'seller123'   },
    { username: 'customer', password: 'customer123' },
    { username: 'service',  password: 'service123'  }
];

function testLogin(username, password) {
    return new Promise((resolve) => {
        const body = JSON.stringify({ username, password });

        const options = {
            hostname: 'localhost',
            port: PORT,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed;
                try { parsed = JSON.parse(data); } catch (e) { parsed = { raw: data }; }
                const ok = res.statusCode === 200 && parsed.success;
                console.log(`  [${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}] ${username} / ${password} => HTTP ${res.statusCode} | ${ok ? 'role: ' + parsed.user?.roleName : parsed.error?.details || parsed.error?.message || JSON.stringify(parsed)}`);
                resolve(ok);
            });
        });

        req.on('error', (err) => {
            console.log(`  [\x1b[31mERROR\x1b[0m] ${username}: ${err.message}`);
            resolve(false);
        });

        req.write(body);
        req.end();
    });
}

(async () => {
    console.log(`\n\x1b[36m=== IDP Seed Account Login Test (port ${PORT}) ===\x1b[0m\n`);
    let passed = 0;
    for (const { username, password } of accounts) {
        const ok = await testLogin(username, password);
        if (ok) passed++;
    }
    console.log(`\n\x1b[36mResult: ${passed}/${accounts.length} accounts passed.\x1b[0m`);
    if (passed < accounts.length) process.exit(1);
})();
