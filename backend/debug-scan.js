const fs = require('fs');
const path = require('path');
require('dotenv').config();

const videoFolder = process.env.VIDEO_FOLDER || './videos';
console.log('--- SCAN DEBUG ---');
console.log('Target Folder:', videoFolder);

try {
    const items = fs.readdirSync(videoFolder);
    console.log('Found top-level items:', items.length);

    items.forEach(item => {
        const fullPath = path.join(videoFolder, item);
        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                const subItems = fs.readdirSync(fullPath);
                console.log(`[OK] Category: "${item}" - Sub-items: ${subItems.length}`);
            } else {
                console.log(`[FILE] ${item}`);
            }
        } catch (e) {
            console.log(`[ERROR] Accessing "${item}":`, e.message);
        }
    });

} catch (err) {
    console.error('CRITICAL ERROR reading videoFolder:', err.message);
}
console.log('--- END DEBUG ---');
