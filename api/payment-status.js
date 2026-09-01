export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { paymentId } = req.body || {};

    if (!paymentId) {
      return res.status(400).json({
        error: "Не указан ID платежа"
      });
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;

    if (!shopId || !secretKey) {
      return res.status(500).json({
        error: "YooKassa не настроена"
      });
    }

    const response = await fetch(
      `https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`,
      {
        method: "GET",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${shopId}:${secretKey}`).toString("base64")
        }
      }
    );

    const payment = await response.json();

    if (!response.ok) {
      console.error("YooKassa status error:", payment);

      return res.status(response.status).json({
        error: "Не удалось проверить платёж"
      });
    }

    return res.status(200).json({
      paymentId: payment.id,
      status: payment.status,
      paid: payment.paid === true,
      plan: payment.metadata?.plan || null,
      invitationId: payment.metadata?.invitationId || null
    });

  } catch (error) {
    console.error("Payment status error:", error);

    return res.status(500).json({
      error: "Ошибка проверки платежа"
    });
  }
        }
