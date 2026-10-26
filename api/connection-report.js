const { randomBytes } = require('node:crypto');
const KEYS = ['home', 'styles', 'auth-sdk', 'app', 'media-editor', 'auth-server'];
const STATES = new Set(['ok', 'http', 'timeout', 'network']);
module.exports = function connectionReport(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (req.headers.origin !== 'https://invella.ru') return res.status(403).json({ error: 'Origin not allowed' });
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({ error: 'JSON required' });
  if (Number(req.headers['content-length'] || 0) > 4096) return res.status(413).json({ error: 'Report too large' });
  let body = req.body;
  try {
    if (typeof body === 'string') { if (Buffer.byteLength(body) > 4096) return res.status(413).json({ error: 'Report too large' }); body = JSON.parse(body); }
    if (!body || Buffer.byteLength(JSON.stringify(body)) > 4096) return res.status(400).json({ error: 'Invalid report' });
  } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  if (!Array.isArray(body.checks) || body.checks.length !== KEYS.length) return res.status(400).json({ error: 'Six checks required' });
  const checks = [];
  for (let i = 0; i < KEYS.length; i++) {
    const r = body.checks[i];
    if (!r || !STATES.has(r.status) || !Number.isInteger(r.code) || !(r.code === 0 || (r.code >= 100 && r.code <= 599)) || !Number.isInteger(r.bytes) || r.bytes < 0 || r.bytes > 20971520 || !Number.isInteger(r.ms) || r.ms < 0 || r.ms > 120000) return res.status(400).json({ error: 'Invalid check' });
    checks.push({ key: KEYS[i], status: r.status, code: r.code, bytes: r.bytes, ms: r.ms });
  }
  const id = randomBytes(5).toString('hex');
  console.info('Invella connection check', JSON.stringify({ id, version: 1, checks }));
  return res.status(201).json({ ok: true, id });
};
