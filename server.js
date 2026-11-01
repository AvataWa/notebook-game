// 极简静态服务器：npm run dev -- --port 7100 --host 0.0.0.0
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

let port = 7100, host = '0.0.0.0';
process.argv.forEach((a, i) => {
  if (a === '--port') port = +process.argv[i + 1];
  else if (a === '--host') host = process.argv[i + 1];
  else if (a.startsWith('--port=')) port = +a.slice(7);
  else if (a.startsWith('--host=')) host = a.slice(7);
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(__dirname, path.normalize(p).replace(/^([/\\])+/, ''));
  if (!file.startsWith(__dirname)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, host, () => console.log(`dev server: http://localhost:${port}/`));
