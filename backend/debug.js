require('dotenv').config();
const fs = require('fs');
const { getVideos } = require('./src/controllers/video');

try {
    console.log('VIDEO_FOLDER is:', process.env.VIDEO_FOLDER);
    const result = getVideos();
    fs.writeFileSync('test-output.json', JSON.stringify(result, null, 2));
    console.log('Success, wrote to test-output.json');
} catch (err) {
    fs.writeFileSync('test-error.txt', err.toString() + '\\n' + err.stack);
    console.log('Error, wrote to test-error.txt');
}
