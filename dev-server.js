/* ==========================================================================
   Hyico · 本地预览服务器（零依赖）
   --------------------------------------------------------------------------
   用途：在没有 Cloudflare Pages 的情况下本地预览 web/ 目录。
   行为刻意与 Cloudflare Pages 对齐：目录自动找 index.html、未知路径回退 404.html。
   用法：
     node dev-server.js            # 默认 http://localhost:4173
     node dev-server.js 8080       # 指定端口
   ========================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, 'web');
const PORT = Number(process.argv[2]) || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

function send(res, status, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(status, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const target = path.join(ROOT, urlPath);

  // 防目录穿越
  if (!target.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(target, (err, stat) => {
    if (!err && stat.isFile()) {
      send(res, 200, target);
      return;
    }
    if (!err && stat.isDirectory()) {
      send(res, 200, path.join(target, 'index.html'));
      return;
    }
    // 与 Cloudflare Pages 一致：未知路径交给 404.html
    send(res, 404, path.join(ROOT, '404.html'));
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Hyico 本地预览已启动');
  console.log('  站点目录 : ' + ROOT);
  console.log('  访问地址 : http://localhost:' + PORT + '/');
  console.log('');
  console.log('  调试内容覆盖：在任意页面 URL 后加 ?content-debug=1');
  console.log('  停止服务    ：Ctrl + C');
  console.log('');
});
