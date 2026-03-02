const https = require('https');

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Nehli-App/1.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject('Error parsing JSON');
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function testJikan(title) {
    console.log(`Testing Jikan (Anime): ${title}`);
    try {
        const data = await fetchJSON(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
        if (data && data.data && data.data.length > 0) {
            console.log(`✅ Found: ${data.data[0].title} - ${data.data[0].images?.jpg?.large_image_url}`);
        } else {
            console.log(`❌ Not found`);
        }
    } catch (e) { console.log(`❌ Error: ${e.message}`); }
}

async function testTVMaze(title) {
    console.log(`Testing TVMaze (Series): ${title}`);
    try {
        const data = await fetchJSON(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`);
        if (data && data.length > 0) {
            console.log(`✅ Found: ${data[0].show.name} - ${data[0].show.image?.original}`);
        } else {
            console.log(`❌ Not found`);
        }
    } catch (e) { console.log(`❌ Error: ${e.message}`); }
}

async function runTests() {
    await testTVMaze('Padre de Familia');
    await testTVMaze('Family Guy');
    await testJikan('Boku no Hero Academia');
    await testJikan('Gachiakuta');
    await testJikan('Kanojo, Okarishimasu');
    await testJikan('Keikenzumi na Kimi to, Keiken Zero');
    await testJikan('Kimi no Koto ga Daidaidaidaidai');

    // Testing the cleaner behavior specifically
    const rawIds = [
        "Padre de Familia (1999) S19 [PACK]",
        "Boku no Hero Academia",
        "Keikenzumi na Kimi to, Keiken Zero...",
        "Kimi no Koto ga Daidaidaidaidaisuki na 100-nin no Kanojo",
        "Kanojo, Okarishimasu T4"
    ];

    console.log('\n--- CLEANER TEST ---');
    function cleanTitle(rawName) {
        let clean = rawName;
        clean = clean.replace(/\[.*?\]/g, '');
        clean = clean.replace(/\b(Season|Temporada|S|T)\s*\d+.*$/i, '');
        clean = clean.replace(/\(\d{4}\).*$/, '');
        clean = clean.replace(/\(.*?\)/g, '');
        clean = clean.replace(/-.*$/, '');
        return clean.trim();
    }

    rawIds.forEach(id => {
        console.log(`Original: "${id}" => Clean: "${cleanTitle(id)}"`);
    });
}

runTests();
