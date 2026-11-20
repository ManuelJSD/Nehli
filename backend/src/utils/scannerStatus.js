const fs = require('node:fs/promises');
const { constants } = require('node:fs');

function createScannerStatus(root) {
    let snapshot = { lastScan: null, files: 0, added: 0, failed: false };
    let previous = new Set();

    async function checkDirectory() {
        try {
            await fs.access(root, constants.R_OK | constants.X_OK);
            return (await fs.stat(root)).isDirectory();
        } catch { return false; }
    }

    return {
        checkDirectory,
        complete(ids) {
            const current = new Set(ids);
            const added = [...current].filter(id => !previous.has(id)).length;
            snapshot = { lastScan: Date.now(), files: current.size, added, failed: false };
            previous = current;
        },
        fail() { snapshot = { ...snapshot, failed: true }; },
        async read(scanning) { return { ...snapshot, scanning, available: await checkDirectory() }; }
    };
}

module.exports = { createScannerStatus };
