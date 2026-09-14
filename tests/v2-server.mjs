import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createWizardServer } from '../v2/serve.mjs';

const server = createWizardServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
function get(path, method = 'GET', host = `127.0.0.1:${port}`) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers: { Host: host } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', part => { body += part; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}
try {
  assert.equal((await get('/')).status, 200);
  assert.equal((await get('/questions.json')).status, 200);
  assert.equal((await get('/', 'HEAD')).body, '');
  for (const path of ['/cli.mjs', '/session.json', '/../README.md', '/%2e%2e/.env']) {
    assert.equal((await get(path)).status, 404);
  }
  assert.equal((await get('/', 'POST')).status, 405);
  assert.equal((await get('/', 'GET', 'example.com')).status, 403);
  console.log('PASS: loopback wizard serves only public assets, rejects writes and foreign Host headers.');
} finally { await new Promise(resolve => server.close(resolve)); }
