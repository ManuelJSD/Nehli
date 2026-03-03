const fs = require('fs');
const path = require('path');
require('dotenv').config();

const videoFolder = process.env.VIDEO_FOLDER || './videos';
console.log('Scanning Video Folder:', videoFolder);

try {
    const items = fs.readdirSync(videoFolder);
    console.log('Found items:', items);

    items.forEach(item => {
        const fullPath = path.join(videoFolder, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            console.log(`[DIR] ${item}`);
            try {
                const subItems = fs.readdirSync(fullPath);
                console.log(`  -> Sub-items count: ${subItems.length}`);
            } catch (e) {
                console.log(`  -> Error reading: ${e.message}`);
            }
        } else {
            console.log(`[FILE] ${item}`);
        }
    });
} catch (err) {
    console.error('Error reading video folder:', err.message);
}
