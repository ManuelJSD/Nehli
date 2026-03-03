const fs = require('fs');
const path = require('path');
require('dotenv').config();

const videoFolder = process.env.VIDEO_FOLDER || './videos';

function scan(dir, depth = 0) {
    if (depth > 2) return;
    try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        items.forEach(item => {
            const p = path.join(dir, item.name);
            console.log('  '.repeat(depth) + (item.isDirectory() ? '[D] ' : '[F] ') + item.name);
            if (item.isDirectory()) {
                scan(p, depth + 1);
            }
        });
    } catch (e) {
        console.log('Error scanning ' + dir + ': ' + e.message);
    }
}

console.log('--- SCANNING ' + videoFolder + ' ---');
scan(videoFolder);
console.log('--- SCAN COMPLETE ---');
