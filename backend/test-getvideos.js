require('dotenv').config();
const { getVideos } = require('./src/controllers/video');
console.log(JSON.stringify(getVideos(), null, 2));
