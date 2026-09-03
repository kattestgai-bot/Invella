const SUPABASE_URL = "https://lwanymjmbcstvggmhevx.supabase.co";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { paymentId } = req.body || {};

    if (!paymentId) {
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

    // Нельзя проверять чужой платёж.
    if (!invitationId || ownerId !== user.id) {
      return res.status(403).json({
        error: "Платёж не принадлежит этому аккаунту"
      });
    }

    let published = false;
    let slug = null;

    const ir = await fetch(
      `${SUPABASE_URL}/rest/v1/invitations?id=eq.${encodeURIComponent(
        invitationId
      )}&owner_id=eq.${encodeURIComponent(
        user.id
      )}&select=status,slug`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`
        }
      }
    );

    const rows = await ir.json();

    if (ir.ok && Array.isArray(rows) && rows[0]) {
      published = rows[0].status === "published";
      slug = rows[0].slug || null;
    }

    return res.status(200).json({
      paymentId: payment.id,
      status: payment.status,
      paid: payment.paid === true,
      plan: payment.metadata?.plan || null,
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
