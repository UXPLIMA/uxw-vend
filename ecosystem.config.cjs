const fs = require('fs');
const path = require('path');

// Load .env file
const envFile = path.join(__dirname, '.env');
const env = {};
if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf-8').split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) return;
        let key = line.slice(0, eqIdx);
        let val = line.slice(eqIdx + 1);
        // Strip quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        env[key] = val;
    });
}

module.exports = {
    apps: [{
        name: 'uxwvend',
        script: 'npx',
        args: 'next start -p 3001 -H 0.0.0.0',
        cwd: __dirname,
        env: env,
    }]
};
