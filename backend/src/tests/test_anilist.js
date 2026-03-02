const https = require('https');

function fetchAnilist(title) {
    return new Promise((resolve, reject) => {
        const query = `
        query ($search: String) {
            Media (search: $search, type: ANIME) {
                title { romaji english native }
                coverImage { extraLarge large medium }
            }
        }`;

        const variables = { search: title };

        const data = JSON.stringify({ query, variables });

        const options = {
            hostname: 'graphql.anilist.co',
            port: 443,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(body);
                        if (parsed.data && parsed.data.Media) {
                            resolve(parsed.data.Media);
                        } else {
                            resolve(null);
                        }
                    } catch (e) { resolve(null); }
                } else {
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => resolve(null));
        req.write(data);
        req.end();
    });
}

async function run() {
    const titles = [
        "Sakamoto Days",
        "Record of Ragnarok",
        "Boku no Kokoro no Yabai Yatsu",
        "Keikenzumi na Kimi to, Keiken Zero",
        "Kimi no Koto ga Daidaidaidaidaisuki na 100-nin no Kanojo",
        "[Erai-raws] Suki na Ko ga Megane"
    ];

    for (let t of titles) {
        console.log(`Checking: ${t}`);
        const result = await fetchAnilist(t);
        if (result) {
            console.log(` ✅ Found: ${result.title.romaji} -> ${result.coverImage?.extraLarge}`);
        } else {
            console.log(` ❌ Not found`);
        }
    }
}

run();
