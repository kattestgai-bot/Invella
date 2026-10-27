const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { gzipSync } = require('node:zlib');
const root = path.join(__dirname, '..');
const handler = require('../api/startup-assets');
const source = fs.readFileSync(path.join(root, 'assets/invella-startup.js'), 'utf8');
function response() { return { code: 0, setHeader() {}, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } }; }
async function endpointTests() {
  for (const [asset, file] of Object.entries({ styles: 'assets/invella-bundle.css', sdk: 'supabase.min.js', app: 'assets/invella-app.js', premium: 'assets/invella-premium-fix.js' })) {
    const expected = fs.readFileSync(path.join(root, file)); let offset = 0; const chunks = [];
    while (offset < expected.length) {
      const res = response(); await handler({ method: 'POST', headers: { origin: 'https://invella.ru' }, body: { asset, offset } }, res);
      assert.equal(res.code, 200); assert.ok(Buffer.byteLength(JSON.stringify(res.body)) < 10240);
      assert.equal(res.body.sha256, crypto.createHash('sha256').update(expected).digest('hex'));
      const chunk = Buffer.from(res.body.data, 'base64'); assert.equal(chunk.length, res.body.bytes); chunks.push(chunk); offset += chunk.length;
    }
    assert.deepEqual(Buffer.concat(chunks), expected, 'Fallback must serve the exact canonical public file');
  }
  for (const req of [
    { method: 'GET', headers: {}, body: {} },
    { method: 'POST', headers: { origin: 'https://other.invalid' }, body: { asset: 'sdk', offset: 0 } },
    ...['../../.env', '__proto__', 'constructor', 'api/create-payment.js'].map(asset => ({ method: 'POST', headers: {}, body: { asset, offset: 0 } })),
    ...[-1, 1, 1.5, 999999999].map(offset => ({ method: 'POST', headers: {}, body: { asset: 'sdk', offset } }))
  ]) { const res = response(); await handler(req, res); assert.ok(res.code >= 400); }
}
const texts = {
  styles: ':root{--color:#fff}/*' + 'текст'.repeat(1500) + '*/',
  sdk: '/*' + 'Я'.repeat(4000) + '*/window.order.push("sdk");window.supabase={createClient:function(){}};',
  app: 'window.order.push("app");window.invellaReady=true;',
  premium: 'window.order.push("premium");window.invellaPremiumReady=true;'
};
function runtime(options = {}) {
  const elements = { authMessage: { textContent: '' }, authEmail: { value: 'draft@example.invalid' }, authPassword: { value: 'test-value' }, invellaStartupRetry: { style: {} } };
  const storage = new Map(); const calls = []; let ctx;
  const state = { rejectPosts: !!options.rejectPosts };
  function element(tag) { return { tag, style: {}, children: [], remove() { if (this.id) delete elements[this.id]; }, appendChild(child) { this.children.push(child); if (child.id) elements[child.id] = child; } }; }
  if (options.public) elements.publicLoading = Object.assign(element('div'), { querySelector() { return this; } });
  const document = { readyState: 'complete', documentElement: { classList: { contains: () => !!options.public } }, getElementById: id => elements[id] || null, addEventListener() {}, createElement: element, head: { appendChild(el) { if (el.id) elements[el.id] = el; if (el.tag === 'script') vm.runInContext(el.textContent, ctx); } } };
  const window = { location: { search: options.small ? '?lite=1' : '' }, order: [], crypto: crypto.webcrypto, invellaReady: false };
  const context = { window, location: window.location, document, AbortController, URLSearchParams, Uint8Array, TextEncoder, TextDecoder, atob, setTimeout, clearTimeout, Date, localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) }, console: { error() {} }, fetch: async (url, init = {}) => {
    calls.push({ url, init });
    if (url === '/api/connection-report') return { ok: true, text: async () => '{"ok":true}' };
    let key;
    if (url === '/api/startup-assets') {
      if (state.rejectPosts) return { ok: false, status: 503 };
      const req = JSON.parse(init.body); key = req.asset;
      const bytes = Buffer.from(texts[key]); const chunk = bytes.subarray(req.offset, req.offset + 6144);
      const data = Buffer.from(chunk); if (options.tamper && key === 'sdk' && req.offset === 0) data[0] ^= 1;
      return { ok: true, text: async () => JSON.stringify({ asset: key, offset: req.offset, total: bytes.length, bytes: chunk.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), data: data.toString('base64') }) };
    }
    key = url.includes('supabase.min') ? 'sdk' : url.includes('premium-fix') ? 'premium' : url.includes('bundle.css') ? 'styles' : 'app';
    if (options.stallGets) return { ok: true, text: () => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) };
    return { ok: true, text: async () => texts[key] };
  } };
  ctx = vm.createContext(context);
  vm.runInContext(source.replace('GET_MS=4500,POST_MS=6000', 'GET_MS=5,POST_MS=50'), ctx);
  return { window, elements, calls, state, storage };
}
(async () => {
  await endpointTests();
  let r = runtime(); assert.equal(await r.window.invellaRetryStartup(), true); assert.deepEqual(r.window.order, ['sdk', 'app', 'premium']);
  assert.equal(r.calls.filter(c => c.url === '/api/startup-assets').length, 0);
  r = runtime({ stallGets: true }); assert.equal(await r.window.invellaRetryStartup(), true); assert.deepEqual(r.window.order, ['sdk', 'app', 'premium']);
  assert.equal(r.elements.invellaLoadedStyles.textContent, texts.styles); assert.equal(r.elements.authEmail.value, 'draft@example.invalid'); assert.equal(r.elements.authPassword.value, 'test-value');
  assert.equal(r.elements.authMessage.textContent, '', 'The loading message must disappear when recovery completes');
  assert.equal(r.storage.get('invella_small_startup'), '1'); assert.ok(r.calls.some(c => c.url === '/api/startup-assets'));
  r = runtime({ small: true, tamper: true }); assert.equal(await r.window.invellaRetryStartup(), false); assert.equal(r.window.invellaReady, false); assert.equal(r.elements.invellaStartupRetry.style.display, '');
  r = runtime({ stallGets: true, rejectPosts: true }); assert.equal(await r.window.invellaRetryStartup(), false); r.state.rejectPosts = false;
  assert.equal(await r.window.invellaRetryStartup(), true); assert.deepEqual(r.window.order, ['sdk', 'app', 'premium']);
  r = runtime({ small: true, rejectPosts: true, public: true }); assert.equal(await r.window.invellaRetryStartup(), false); assert.ok(r.elements.invellaPublicStartupFailure); r.state.rejectPosts = false; assert.equal(await r.window.invellaRetryStartup(), true); assert.equal(r.elements.invellaPublicStartupFailure, undefined);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.includes(source.trim()), 'Inline boot and its source must stay synchronized');
  assert.doesNotMatch(html, /<script defer src="\/(?:supabase|assets\/invella-)/);
  assert.doesNotMatch(html, /<link rel="stylesheet"/);
  assert.ok(gzipSync(html).length < 16384, 'Initial compressed document must stay small');
  console.log('PASS: exact public asset chunks, access boundaries, normal boot, stalled-download recovery, UTF-8/integrity, retry and unchanged form values');
})().catch(error => { console.error(error); process.exitCode = 1; });
