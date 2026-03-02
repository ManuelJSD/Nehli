require('dotenv').config();
const { getVideos } = require('./src/controllers/video');

(async () => {
    try {
        console.time('Primer getVideos (Sin caché)');
        const v1 = await getVideos();
        console.timeEnd('Primer getVideos (Sin caché)');
        console.log(`- Categorías encontradas: ${Object.keys(v1).join(', ')}`);

        console.time('Segundo getVideos (Con caché)');
        const v2 = await getVideos();
        console.timeEnd('Segundo getVideos (Con caché)');

    } catch (err) {
        console.error(err);
    }
})();
