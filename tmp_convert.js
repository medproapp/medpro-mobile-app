const fs = require('fs');
const buffer = fs.readFileSync('photo.jpg');
console.log(`Buffer size: ${buffer.length}`);
console.log(Buffer.from(buffer).toString('base64').slice(0, 80));
