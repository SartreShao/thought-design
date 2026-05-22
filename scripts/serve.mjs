import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8000);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

function resolveRequestPath(requestUrl) {
  const { pathname } = new URL(requestUrl, `http://${host}:${port}`);
  const decodedPath = decodeURIComponent(pathname);
  const relativePath = normalize(decodedPath).replace(/^([/\\])+/, '');
  const filePath = resolve(join(root, relativePath || 'index.html'));

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    return null;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    return join(filePath, 'index.html');
  }

  return filePath;
}

const server = createServer((req, res) => {
  const filePath = resolveRequestPath(req.url);

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'content-type': contentTypes[extname(filePath)] || 'application/octet-stream',
    'cache-control': 'no-store'
  });

  createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Thought Design is running at http://${host}:${port}/`);
});
