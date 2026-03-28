const http = require('http');
const d = JSON.stringify({ username: 'testuser', password: 'test123' });
const opts = {
  hostname: 'localhost', port: 3000,
  path: '/api/register', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) }
};
const req = http.request(opts, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => console.log('STATUS:', res.statusCode, '\nBODY:', body));
});
req.on('error', e => console.error('ERROR:', e.message));
req.write(d);
req.end();
