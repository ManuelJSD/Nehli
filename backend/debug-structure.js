const fs = require('fs');
const path = require('path');
require('dotenv').config();

const videoFolder = process.env.VIDEO_FOLDER || './videos';
console.log('Target Folder:', videoFolder);

function getStructure(dir, depth = 0) {
    if (depth > 2) return;
    try {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            const indent = '  '.repeat(depth);
            if (stat.isDirectory()) {
                console.log(`${indent}[DIR] ${item}`);
                getStructure(itemPath, depth + 1);
            } else {
                console.log(`${indent}[FILE] ${item}`);
            }
        });
    } catch (e) {
        console.log('Error reading ' + dir + ': ' + e.message);
    }
}

getStructure(videoFolder);
