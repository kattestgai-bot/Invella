const { randomBytes } = require('node:crypto');
const KEYS = ['home', 'styles', 'auth-sdk', 'app', 'media-editor', 'auth-server'];
const STATES = new Set(['ok', 'http', 'timeout', 'network']);
module.exports = function connectionReport(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (req.headers.origin !== 'https://' + (req.headers.host || 'invella.ru')) return res.status(403).json({ error: 'Origin not allowed' });
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({ error: 'JSON required' });
  if (Number(req.headers['content-length'] || 0) > 4096) return res.status(413).json({ error: 'Report too large' });
  let body = req.body;
  try {
    if (typeof body === 'string') { if (Buffer.byteLength(body) > 4096) return res.status(413).json({ error: 'Report too large' }); body = JSON.parse(body); }
    if (!body || Buffer.byteLength(JSON.stringify(body)) > 4096) return res.status(400).json({ error: 'Invalid report' });
  } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  if(body.phase==='shell'){
    const stages=new Set(['early','head','start','waiting','ready','failed','script-error','click']);
    const actions=new Set(['','openAuth','closeAuth','openTemplates','chooseTemplate','setAuthMode','togglePassword','submitAuth','forgotPassword','login']);
    if(!stages.has(body.stage)||!actions.has(body.action||'')||!/^[a-f0-9]{16}$/.test(body.build||'')||!Number.isInteger(body.code)||!(body.code===0||(body.code>=100&&body.code<=599))||!Array.isArray(body.modules)||body.modules.length!==4||body.modules.some(v=>typeof v!=='boolean')||!['loading','interactive','complete'].includes(body.state)||typeof body.shell!=='boolean')return res.status(400).json({error:'Invalid shell report'});
    const id=randomBytes(5).toString('hex');console.info('Invella shell check',JSON.stringify({id,build:body.build,stage:body.stage,action:body.action||'',code:body.code,modules:body.modules,shell:body.shell,state:body.state,small:body.small===true}));return res.status(201).json({ok:true,id});
  }
  const startup = body.phase === 'startup';
  const keys = startup ? ['styles', 'auth-sdk', 'app', 'media-editor'] : KEYS;
  if (!Array.isArray(body.checks) || body.checks.length !== keys.length) return res.status(400).json({ error: 'Six checks required' });
  const checks = [];
  for (let i = 0; i < keys.length; i++) {
    const r = body.checks[i];
    if (!r || !STATES.has(r.status) || !Number.isInteger(r.code) || !(r.code === 0 || (r.code >= 100 && r.code <= 599)) || !Number.isInteger(r.bytes) || r.bytes < 0 || r.bytes > 20971520 || !Number.isInteger(r.ms) || r.ms < 0 || r.ms > 120000) return res.status(400).json({ error: 'Invalid check' });
    checks.push({ key: keys[i], status: r.status, code: r.code, bytes: r.bytes, ms: r.ms, ...(startup ? { transport: ['get','small','inline'].includes(r.transport) ? r.transport : 'get' } : {}) });
  }
  const id = randomBytes(5).toString('hex');
  console.info(startup ? 'Invella startup check' : 'Invella connection check', JSON.stringify({ id, version: 1, checks }));
  return res.status(201).json({ ok: true, id });
};

