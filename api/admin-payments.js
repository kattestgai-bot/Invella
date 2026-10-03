const SUPABASE_URL = 'https://lwanymjmbcstvggmhevx.supabase.co';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({ error: 'Войдите в аккаунт администратора' });
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    if (!serviceKey || !shopId || !secretKey) return res.status(503).json({ error: 'Сверка оплат не настроена' });
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000)
    });
    const user = await userResponse.json();
    if (!userResponse.ok || !user?.id) return res.status(401).json({ error: 'Сессия истекла' });
    const adminResponse = await fetch(`${SUPABASE_URL}/rest/v1/invella_admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(10000)
    });
    const admins = await adminResponse.json();
    if (!adminResponse.ok) throw new Error('Admin lookup failed');
    if (!Array.isArray(admins) || admins.length !== 1) return res.status(403).json({ error: 'Нет прав администратора' });

    const from = new Date(String(req.query.from || ''));
    const to = new Date(String(req.query.to || ''));
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to - from > 7 * 86400000)
      return res.status(400).json({ error: 'Укажите период до 7 дней' });
    const amount = Number(req.query.amount || 0);
    if (!Number.isInteger(amount) || amount < 0 || amount > 1000000)
      return res.status(400).json({ error: 'Неверная сумма' });
    const auth = 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
    const items = [];
    let cursor = '';
    let truncated = false;
    for (let page = 0; page < 10; page++) {
      const url = new URL('https://api.yookassa.ru/v3/payments');
      url.searchParams.set('created_at.gte', from.toISOString());
      url.searchParams.set('created_at.lte', to.toISOString());
      url.searchParams.set('limit', '100');
      if (cursor) url.searchParams.set('cursor', cursor);
      const response = await fetch(url, { headers: { Authorization: auth }, signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) {
        console.error('YooKassa payments list error', response.status, data?.type);
        return res.status(502).json({ error: 'ЮKassa не ответила на запрос списка оплат' });
      }
      for (const p of data.items || []) {
        if (amount && Math.round(Number(p.amount?.value || 0) * 100) !== amount * 100) continue;
        items.push({ id: p.id, createdAt: p.created_at, status: p.status, paid: p.paid === true,
          amount: p.amount?.value, currency: p.amount?.currency,
          invitationId: p.metadata?.invitationId || null, plan: p.metadata?.plan || null,
          description: p.description || '' });
      }
      cursor = data.next_cursor || '';
      if (!cursor) break;
      if (page === 9) truncated = true;
    }
    return res.status(200).json({ items, truncated });
  } catch (error) {
    console.error('ADMIN PAYMENTS ERROR', error);
    return res.status(500).json({ error: 'Не удалось сверить оплаты' });
  }
};
