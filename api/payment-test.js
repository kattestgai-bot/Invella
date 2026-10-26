// Temporary, time-limited QA harness. It only uses YooKassa test credentials
// and a disposable account marked by server-owned app_metadata.
const crypto = require('node:crypto');
const createPayment = require('./create-payment');
const paymentStatus = require('./payment-status');
const webhook = require('./yookassa-webhook');
const SB = 'https://lwanymjmbcstvggmhevx.supabase.co';
const PUBLIC_KEY = 'sb_publishable_EY50r1gV7v1zyD9vBgrteA_JVcOg4_J';

function same(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const gate = process.env.INVELLA_PAYMENT_QA_TOKEN;
  const expires = Number(process.env.INVELLA_PAYMENT_QA_EXPIRES_AT);
  if (!gate || !Number.isFinite(expires) || Date.now() >= expires) return res.status(404).json({ error: 'QA closed' });
  const action = String(req.query.action || 'health');
  const isWebhook = action === 'webhook' && req.method === 'POST';
  const cookie = /(?:^|;\s*)invella_payment_qa=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  const allowed = same(req.headers['x-invella-qa'], gate) || same(cookie, gate);
  if (!allowed && !isWebhook && !(req.method === 'GET' && same(req.query.run, gate))) return res.status(404).json({ error: 'Not found' });
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cfg = {
    shopId: process.env.YOOKASSA_TEST_SHOP_ID,
    secretKey: process.env.YOOKASSA_TEST_SECRET_KEY,
    testMode: true,
    qaRun: crypto.createHash('sha256').update(gate).digest('hex').slice(0, 20),
    returnUrl: 'https://invella.ru/?payment=success'
  };
  if (!serviceKey || cfg.shopId !== '1510320' || !cfg.secretKey?.startsWith('test_')) return res.status(503).json({ error: 'QA is not configured' });
  const adminHeaders = { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' };
  async function json(url, opts = {}) {
    const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { ok: r.ok, status: r.status, data };
  }
  async function qaUser() {
    const r = await json(SB + '/auth/v1/user', { headers: { apikey: serviceKey, Authorization: req.headers.authorization || '' } });
    if (!r.ok || r.data?.app_metadata?.payment_qa_run !== cfg.qaRun) throw new Error('QA account required');
    return r.data;
  }
  try {
    if (req.method === 'GET' && same(req.query.run, gate)) {
      res.setHeader('Set-Cookie', 'invella_payment_qa=' + gate + '; Path=/api/payment-test; HttpOnly; Secure; SameSite=Strict; Max-Age=7200');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send('<!doctype html><html lang="ru"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invella — тест оплаты</title><body><h1>Тест оплаты Invella</h1><p>Тестовый магазин 1510320. Деньги не списываются.</p><button id="start">Начать проверку</button><p id="status"></p><script src="/supabase.min.js"></script><script>document.getElementById("start").onclick=async function(){this.disabled=true;var status=document.getElementById("status");status.textContent="Подготовка тестового аккаунта…";try{var r=await fetch("/api/payment-test?action=fixture",{method:"POST"});var d=await r.json();if(!r.ok)throw Error(d.error);var s=supabase.createClient(location.origin+"/sb","' + PUBLIC_KEY + '");var a=await s.auth.setSession(d.session);if(a.error)throw a.error;localStorage.setItem("invella_payment_qa","1");location.href="/";}catch(e){status.textContent=e.message;this.disabled=false;}};</script></body></html>');
    }
    if (isWebhook) return webhook.withConfig(cfg)(req, res);
    if (action === 'health' && req.method === 'GET') {
      const r = await json('https://api.yookassa.ru/v3/payments?limit=1', { headers: { Authorization: 'Basic ' + Buffer.from(cfg.shopId + ':' + cfg.secretKey).toString('base64') } });
      const db = await json(SB + '/rest/v1/invitations?select=id&limit=1', { headers: adminHeaders });
      return res.status(r.ok && db.ok ? 200 : 503).json({ testShop: cfg.shopId, provider: r.status, database: db.status });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (action === 'fixture') {
      const email = 'invella-payment-qa-' + cfg.qaRun + '@example.invalid';
      const password = crypto.createHash('sha256').update(gate + ':qa-password').digest('base64url');
      const created = await json(SB + '/auth/v1/admin/users', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { payment_qa_run: cfg.qaRun } }) });
      if (!created.ok && created.data?.code !== 'email_exists') throw new Error('QA user creation failed: ' + created.status);
      const login = await json(SB + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: PUBLIC_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!login.ok || !login.data?.user?.id || login.data.user.app_metadata?.payment_qa_run !== cfg.qaRun) throw new Error('QA sign-in failed: ' + login.status);
      const owner = login.data.user.id;
      const fixture = { owner_id: owner, title: 'Проверка оплаты Invella', slug: 'qa-payment-' + cfg.qaRun, template_key: 'classic', status: 'draft', plan: 'draft', content: { names: 'Проверка & Оплата', date: '2026-11-26', time: '15:00', message: 'Тестовое приглашение. Проверяем оплату и сохранение.', qa_run: cfg.qaRun } };
      const saved = await json(SB + '/rest/v1/invitations?on_conflict=slug', { method: 'POST', headers: { ...adminHeaders, Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(fixture) });
      if (!saved.ok) throw new Error('QA invitation creation failed: ' + saved.status);
      return res.status(200).json({ session: { access_token: login.data.access_token, refresh_token: login.data.refresh_token }, invitationId: saved.data?.[0]?.id || null, ownerId: owner, slug: fixture.slug });
    }
    const user = await qaUser();
    if (action === 'create-payment') return createPayment.withConfig(cfg)(req, res);
    if (action === 'payment-status') return paymentStatus.withConfig(cfg)(req, res);
    if (action === 'inspect') {
      const r = await json(SB + '/rest/v1/invitations?owner_id=eq.' + user.id + '&select=id,slug,status,plan,content', { headers: adminHeaders });
      const p = await json(SB + '/rest/v1/payments?owner_id=eq.' + user.id + '&select=provider_payment_id,status,plan_key,amount_minor', { headers: adminHeaders });
      return res.status(r.ok && p.ok ? 200 : 500).json({ invitations: r.data, payments: p.data });
    }
    if (action === 'cleanup') {
      const logout = await fetch(SB + '/auth/v1/logout?scope=global', { method: 'POST', headers: { apikey: serviceKey, Authorization: req.headers.authorization }, signal: AbortSignal.timeout(10000) });
      if (!logout.ok) throw new Error('QA session revoke failed: ' + logout.status);
      for (const table of ['payments', 'invitations']) {
        const r = await fetch(SB + '/rest/v1/' + table + '?owner_id=eq.' + user.id, { method: 'DELETE', headers: adminHeaders, signal: AbortSignal.timeout(10000) });
        if (!r.ok) throw new Error('QA cleanup failed: ' + table);
      }
      const r = await fetch(SB + '/auth/v1/admin/users/' + user.id, { method: 'DELETE', headers: adminHeaders, signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error('QA user cleanup failed');
      res.setHeader('Set-Cookie', 'invella_payment_qa=; Path=/api/payment-test; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
      return res.status(200).json({ cleaned: true });
    }
    return res.status(400).json({ error: 'Unknown QA action' });
  } catch (error) {
    console.error('PAYMENT QA:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
