export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { plan, invitationId } = req.body || {};

    const plans = {
      basic: {
        amount: "990.00",
        description: "Invella — Базовый тариф"
      },
      pro: {
        amount: "1490.00",
        description: "Invella — Pro тариф"
      },
      premium: {
        amount: "2490.00",
        description: "Invella — Premium тариф"
      }
    };

    const selectedPlan = plans[plan];

    if (!selectedPlan) {
      return res.status(400).json({
        error: "Неизвестный тариф"
      });
    }

    if (!invitationId) {
      return res.status(400).json({
        error: "Не указано приглашение"
      });
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;

    if (!shopId || !secretKey) {
      return res.status(500).json({
        error: "YooKassa не настроена"
      });
    }

    const idempotenceKey = crypto.randomUUID();

    const response = await fetch(
      "https://api.yookassa.ru/v3/payments",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Idempotence-Key": idempotenceKey,
          Authorization:
            "Basic " +
            Buffer.from(`${shopId}:${secretKey}`).toString("base64")
        },

        body: JSON.stringify({
          amount: {
            value: selectedPlan.amount,
            currency: "RUB"
          },

          capture: true,

          confirmation: {
            type: "redirect",
            return_url:
              "https://invella-xi.vercel.app/?payment=success"
          },

          description: selectedPlan.description,

          metadata: {
            plan: plan,
            invitationId: invitationId
          }
        })
      }
    );

    const payment = await response.json();

    if (!response.ok) {
      console.error("YooKassa error:", payment);

      return res.status(response.status).json({
        error: "Не удалось создать платёж"
      });
    }

    return res.status(200).json({
      paymentId: payment.id,
      confirmationUrl:
        payment.confirmation?.confirmation_url
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Ошибка создания платежа"
    });
  }
}
