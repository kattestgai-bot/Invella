const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const FILES = { styles: 'assets/invella-bundle.css', sdk: 'supabase.min.js', app: 'assets/invella-app.js', premium: 'assets/invella-premium-fix.js' };
const CHUNK_BYTES = 6144;
module.exports = async function startupAssets(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const ownOrigin = 'https://' + (req.headers.host || 'invella.ru');
  if (req.headers.origin && req.headers.origin !== ownOrigin) return res.status(403).json({ error: 'Origin not allowed' });
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  if (!body || !Object.prototype.hasOwnProperty.call(FILES, body.asset) || !Number.isInteger(body.offset) || body.offset < 0 || body.offset % CHUNK_BYTES !== 0) return res.status(400).json({ error: 'Invalid asset or offset' });
  try {
    let bytes;
    try { bytes = await fs.readFile(path.join(process.cwd(), FILES[body.asset])); }
    catch (error) { if (error.code !== 'ENOENT') throw error; bytes = await fs.readFile(path.join(__dirname, '..', FILES[body.asset])); }
    if (body.offset >= bytes.length || bytes.length > 1048576) return res.status(400).json({ error: 'Offset out of range' });
    const chunk = bytes.subarray(body.offset, body.offset + CHUNK_BYTES);
    return res.status(200).json({ asset: body.asset, offset: body.offset, bytes: chunk.length, total: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), data: chunk.toString('base64') });
  } catch (error) { console.error('Invella startup asset:', body.asset, error.code || 'read_failed'); return res.status(503).json({ error: 'Asset unavailable' }); }
};
