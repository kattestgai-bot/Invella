const SUPABASE_URL = "https://lwanymjmbcstvggmhevx.supabase.co";
const NORMAL_PRICES = { basic: 99000, pro: 149000, premium: 249000 };

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { paymentId } = req.body || {};

    if (!paymentId || !/^[a-zA-Z0-9-]{1,100}$/.test(String(paymentId))) {
      return res.status(400).json({ error: "Не указан ID платежа" });
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!shopId || !secretKey || !serviceKey) {
      return res.status(500).json({ error: "Сервис не настроен" });
    }

    // Пользователь обязательно должен быть авторизован.
    const auth = req.headers.authorization || "";

    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Войдите в аккаунт ещё раз" });
    }

    const userResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: auth
        }
      }
    );

    const user = await userResponse.json();

    if (!userResponse.ok || !user?.id) {
      return res.status(401).json({
        error: "Сессия истекла. Войдите в аккаунт снова."
      });
    }

    // Получаем реальный платёж непосредственно у платёжного провайдера.
    const response = await fetch(
      `https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${shopId}:${secretKey}`).toString("base64")
        }
      }
    );

    const payment = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Не удалось проверить платёж"
      });
    }

    const invitationId = payment.metadata?.invitationId || null;
    const ownerId = payment.metadata?.ownerId || null;
    const plan = payment.metadata?.plan;

    // Нельзя проверять чужой платёж.
    if (!invitationId || ownerId !== user.id) {
      return res.status(403).json({
        error: "Платёж не принадлежит этому аккаунту"
      });
    }

    if (!NORMAL_PRICES[plan]) {
      return res.status(400).json({ error: "Неизвестный тариф платежа" });
    }

    let published = false;
    let slug = null;

    const ir = await fetch(
      `${SUPABASE_URL}/rest/v1/invitations?id=eq.${encodeURIComponent(
        invitationId
      )}&owner_id=eq.${encodeURIComponent(
        user.id
      )}&select=id,status,slug,plan`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`
        }
      }
    );

    const rows = await ir.json();

    if (!ir.ok || !Array.isArray(rows) || rows.length !== 1) {
      return res.status(404).json({ error: "Приглашение платежа не найдено" });
    }
    published = rows[0].status === "published";
    slug = rows[0].slug || null;

    // Возврат покупателя с оплаты восстанавливает публикацию, если webhook задержался.
    // Повторный запрос безопасен благодаря уникальному provider_payment_id.
    if (payment.status === "succeeded" && payment.paid === true) {
      const amountMinor = Math.round(Number(payment.amount?.value || 0) * 100);
      const expectedMinor = Number(payment.metadata?.expectedAmountMinor || NORMAL_PRICES[plan]);
      if (payment.amount?.currency !== "RUB" || !Number.isSafeInteger(amountMinor) ||
          amountMinor !== expectedMinor || expectedMinor < 100 || expectedMinor > NORMAL_PRICES[plan]) {
        return res.status(400).json({ error: "Сумма платежа не совпадает с тарифом" });
      }
      const headers = {
        "Content-Type": "application/json", apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`
      };
      const saved = await fetch(`${SUPABASE_URL}/rest/v1/payments?on_conflict=provider_payment_id`, {
        method: "POST", headers: { ...headers, Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({ owner_id: user.id, invitation_id: invitationId,
          provider: "yookassa", provider_payment_id: payment.id, plan_key: plan,
          amount_minor: amountMinor, currency: "RUB", status: "succeeded",
          confirmed_at: new Date().toISOString() })
      });
      if (!saved.ok) throw new Error(`Payment record failed: ${saved.status}`);
      if (!published) {
        const updated = await fetch(`${SUPABASE_URL}/rest/v1/invitations?id=eq.${encodeURIComponent(invitationId)}&owner_id=eq.${encodeURIComponent(user.id)}`, {
          method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ plan, status: "published", preview_published: false,
            published_at: new Date().toISOString() })
        });
        if (!updated.ok) throw new Error(`Invitation publish failed: ${updated.status}`);
        published = true;
      }
    }

    return res.status(200).json({
      paymentId: payment.id,
      status: payment.status,
      paid: payment.paid === true,
      plan,
      invitationId,
      published,
      slug
    });
  } catch (error) {
    console.error("PAYMENT STATUS ERROR:", error);

    return res.status(500).json({
      error: "Ошибка проверки платежа"
    });
  }
};
