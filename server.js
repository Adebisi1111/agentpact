// Local development server for AgentPact
// Serves the Vite frontend and API routes

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'frontend', 'dist');
const API_DIR = path.join(__dirname, 'api');

// Serve static files
const serveStatic = (res, filePath, contentType) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
};

// API routes
const handleApi = (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  if (pathname === '/api/markets') {
    require('./api/markets.js').default(req, res);
  } else if (pathname === '/api/create-market') {
    require('./api/create-market.js').default(req, res);
  } else if (pathname === '/api/stake') {
    require('./api/stake.js').default(req, res);
  } else if (pathname === '/api/claim') {
    require('./api/claim.js').default(req, res);
  } else if (pathname === '/api/position') {
    require('./api/position.js').default(req, res);
  } else if (pathname === '/api/verify') {
    require('./api/verify.js').default(req, res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  // API routes
  if (pathname.startsWith('/api/')) {
    handleApi(req, res);
    return;
  }
  
  // Serve frontend
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const ext = path.extname(filePath);
  const contentType = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  }[ext] || 'application/octet-stream';
  
  const filePathFull = pathname === '/' 
    ? path.join(PUBLIC_DIR, 'index.html')
    : path.join(PUBLIC_DIR, filePath.substring(1));
  
  fs.readFile(filePathFull, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`AgentPact dev server running at http://localhost:${PORT}`);
});
