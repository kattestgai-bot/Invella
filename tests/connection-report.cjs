const assert = require('node:assert/strict');
const handler = require('../api/connection-report');
const logs = [];
const originalLog = console.info;
console.info = (...args) => logs.push(args.join(' '));
function response() { return { code: 0, setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } }; }
function request() { return { method: 'POST', headers: { origin: 'https://invella.ru', 'content-type': 'application/json' }, body: { checks: Array.from({ length: 6 }, () => ({ status: 'ok', code: 200, bytes: 100, ms: 30, label: 'ignored', password: 'DO_NOT_LOG' })), token: 'DO_NOT_LOG' } }; }
try {
  let req = request(), res = response(); handler(req, res);
  assert.equal(res.code, 201); assert.match(res.data.id, /^[a-f0-9]{10}$/); assert.equal(logs.length, 1);
  assert.ok(!logs[0].includes('DO_NOT_LOG')); assert.ok(!logs[0].includes('ignored'));
  req = request(); req.body.checks[2] = { status: 'timeout', code: 200, bytes: 16384, ms: 15000 }; res = response(); handler(req, res);
  assert.equal(res.code, 201); assert.ok(logs[1].includes('16384'));
  for (const mutate of [r => { r.headers.origin = 'https://other.invalid'; }, r => { r.method = 'GET'; }, r => { r.body.checks = []; }, r => { r.body.checks[0].status = 'user supplied text'; }, r => { r.headers['content-length'] = '5000'; }, r => { r.body = '{'; }]) {
    req = request(); mutate(req); res = response(); handler(req, res); assert.ok(res.code >= 400); assert.equal(logs.length, 2);
  }
} finally { console.info = originalLog; }
console.log('PASS: automatic diagnostic reports, partial transfers, bounded validation, ignored private/extra fields');
