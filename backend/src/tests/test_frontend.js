const http = require('http');

const titles = [
    'GrandBlueS2',
    'Kanojo, Okarishimasu T4',
    'Keikenzumi na Kimi to, Keiken Zero...',
    'Kimi no Koto ga Daidaidaidaidai...',
    'Oniichan wa Oshimai!',
    'Record of Ragnarok (2021) S01 [PA...',
    'Sakamoto Days T2',
    'Seishun Buta Yarou',
    'Tougen Anki',
    'Yofukashi no Uta T2',
    '[Erai-raws] Suki na Ko ga Megane...',
    '[Ñ] Golden Kamuy'
];

function checkTitle(title) {
    return new Promise((resolve) => {
        http.get(`http://localhost:3000/api/video/thumbnail?category=Anime&title=${encodeURIComponent(title)}`, (res) => {
            resolve(`[${res.statusCode}] ${title} -> ${res.headers.location || 'Not Found'}`);
        }).on('error', (err) => resolve(`[ERROR] ${title}: ${err.message}`));
    });
}

async function run() {
    for (const t of titles) {
        const res = await checkTitle(t);
        console.log(res);
    }
}

run();
