const SUPABASE_URL = "https://lwanymjmbcstvggmhevx.supabase.co";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const event = req.body;

    if (!event || !event.type || !event.object) {
      return res.status(400).json({ error: "Invalid notification" });
    }

    const payment = event.object;

    // Нас интересуют успешные платежи.
    if (event.type !== "payment.succeeded") {
      return res.status(200).json({ received: true });
    }

    const paymentId = payment.id;
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!shopId || !secretKey || !serviceKey) {
      console.error("Missing server environment variables");
      return res.status(500).json({ error: "Server is not configured" });
    }

    if (!paymentId) {
      return res.status(400).json({ error: "Payment ID missing" });
    }

    // Не доверяем данным webhook вслепую:
    // повторно получаем платёж напрямую из API YooKassa.
    const checkResponse = await fetch(
      `https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${shopId}:${secretKey}`).toString("base64")
        }
      }
    );

    const verifiedPayment = await checkResponse.json();

    if (!checkResponse.ok) {
      console.error("YooKassa verification error:", verifiedPayment);
      return res.status(500).json({ error: "Payment verification failed" });
    }

    if (
      verifiedPayment.status !== "succeeded" ||
      verifiedPayment.paid !== true
    ) {
      return res.status(200).json({ received: true, paid: false });
    }

    const plan = verifiedPayment.metadata?.plan;
    const invitationId = verifiedPayment.metadata?.invitationId;

    const prices = {
      basic: 99000,
      pro: 149000,
      premium: 249000
    };

    if (!plan || !invitationId || !prices[plan]) {
      console.error("Invalid payment metadata", verifiedPayment.metadata);
      return res.status(400).json({ error: "Invalid payment metadata" });
    }

    // Проверяем сумму на сервере.
    const amountMinor = Math.round(
      Number(verifiedPayment.amount?.value || 0) * 100
    );

    if (
      verifiedPayment.amount?.currency !== "RUB" ||
      amountMinor !== prices[plan]
    ) {
      console.error("Invalid payment amount");
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    // Получаем владельца приглашения.
    const invitationResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/invitations?id=eq.${encodeURIComponent(
        invitationId
      )}&select=id,owner_id,slug`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`
        }
      }
    );

    const invitations = await invitationResponse.json();

    if (
      !invitationResponse.ok ||
      !Array.isArray(invitations) ||
      invitations.length !== 1
    ) {
      console.error("Invitation not found:", invitations);
      return res.status(404).json({ error: "Invitation not found" });
    }

    const invitation = invitations[0];

    // Записываем платёж. provider_payment_id не даст
    // одному webhook активировать приглашение дважды.
    const paymentResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/payments?on_conflict=provider_payment_id`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify({
          owner_id: invitation.owner_id,
          invitation_id: invitationId,
          provider: "yookassa",
          provider_payment_id: paymentId,
          plan_key: plan,
          amount_minor: amountMinor,
          currency: "RUB",
          status: "succeeded",
          confirmed_at: new Date().toISOString()
        })
      }
    );

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text();
      console.error("Payment database error:", errorText);
      return res.status(500).json({ error: "Payment database error" });
    }

    // Активируем тариф и публикуем приглашение.
    const publishResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/invitations?id=eq.${encodeURIComponent(
        invitationId
      )}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          plan: plan,
          status: "published",
          preview_published: false,
          published_at: new Date().toISOString()
        })
      }
    );

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      console.error("Invitation publish error:", errorText);
      return res.status(500).json({ error: "Invitation publish error" });
    }

    return res.status(200).json({
      received: true,
      paid: true,
      published: true
    });

  } catch (error) {
    console.error("YooKassa webhook error:", error);
    return res.status(500).json({ error: "Webhook error" });
  }
}
