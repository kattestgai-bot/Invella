const SUPABASE_URL = "https://lwanymjmbcstvggmhevx.supabase.co";

const PLANS = {
  basic: {
    amount: 99000,
    description: "Invella — Базовый тариф"
  },
  pro: {
    amount: 149000,
    description: "Invella — Pro тариф"
  },
  premium: {
    amount: 249000,
    description: "Invella — Premium тариф"
  }
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      plan,
      invitationId,
      promoCode = ""
    } = req.body || {};

    const selected = PLANS[plan];

    if (!selected) {
      return res.status(400).json({
        error: "Не выбран тариф"
      });
    }

    if (!invitationId) {
      return res.status(400).json({
        error: "Не найдено приглашение. Сохраните приглашение и попробуйте снова."
      });
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!shopId || !secretKey || !serviceKey) {
      console.error("Missing server environment variables");

      return res.status(500).json({
        error: "Оплата временно недоступна"
      });
    }

    // Проверяем пользователя
    const auth = req.headers.authorization || "";

    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Войдите в аккаунт ещё раз"
      });
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
      console.error("Supabase user error:", user);

      return res.status(401).json({
        error: "Сессия истекла. Войдите в аккаунт снова."
      });
    }

    // Проверяем, что приглашение принадлежит пользователю
    const invitationResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/invitations?id=eq.${encodeURIComponent(
        invitationId
      )}&owner_id=eq.${encodeURIComponent(
        user.id
      )}&select=id,owner_id`,
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
      console.error("Invitation error:", invitations);

      return res.status(403).json({
        error: "Приглашение не найдено"
      });
    }

    let amountMinor = selected.amount;
    let appliedPromo = null;

    const code = String(promoCode || "")
      .trim()
      .toUpperCase();

    // Проверяем промокод
    if (code) {
      const promoResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(
          code
        )}&select=id,code,discount_type,discount_value,plan_key,active,starts_at,expires_at,max_uses,uses_count`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`
          }
        }
      );

      const promoRows = await promoResponse.json();

      if (!promoResponse.ok) {
        console.error("Promo database error:", promoRows);

        return res.status(500).json({
          error: "Не удалось проверить промокод"
        });
      }

      const promo =
        Array.isArray(promoRows) && promoRows.length
          ? promoRows[0]
          : null;

      const now = Date.now();

      const invalidPromo =
        !promo ||
        promo.active !== true ||
        (promo.plan_key && promo.plan_key !== plan) ||
        (promo.starts_at &&
          Date.parse(promo.starts_at) > now) ||
        (promo.expires_at &&
          Date.parse(promo.expires_at) < now) ||
        (
          promo.max_uses !== null &&
          promo.max_uses !== undefined &&
          Number(promo.uses_count || 0) >=
            Number(promo.max_uses)
        );

      if (invalidPromo) {
        return res.status(400).json({
          error: "Промокод недействителен или больше не доступен"
        });
      }

      let discount = 0;

      if (promo.discount_type === "percent") {
        const percent = Math.min(
          Math.max(Number(promo.discount_value) || 0, 0),
          100
        );

        discount = Math.floor(
          amountMinor * percent / 100
        );
      } else if (promo.discount_type === "fixed") {
        discount =
          Number(promo.discount_value) || 0;
      }

      amountMinor = Math.max(
        100,
        amountMinor - discount
      );

      appliedPromo = promo;
    }

    // Создаём платёж в ЮKassa
    const paymentResponse = await fetch(
      "https://api.yookassa.ru/v3/payments",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          "Idempotence-Key":
            crypto.randomUUID(),

          Authorization:
            "Basic " +
            Buffer.from(
              `${shopId}:${secretKey}`
            ).toString("base64")
        },

        body: JSON.stringify({
          amount: {
            value:
              (amountMinor / 100).toFixed(2),

            currency: "RUB"
          },

          capture: true,

          confirmation: {
            type: "redirect",

            return_url:
              "https://invella-xi.vercel.app/?payment=success"
          },

          description:
            selected.description,

          metadata: {
            plan,

            invitationId,

            ownerId: user.id,

            promoCode:
              appliedPromo?.code || "",

            promoId:
              appliedPromo?.id || "",

            expectedAmountMinor:
              String(amountMinor)
          }
        })
      }
    );

    const payment =
      await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error(
        "YooKassa create payment error:",
        JSON.stringify(payment)
      );

      return res.status(
        paymentResponse.status || 500
      ).json({
        error:
          payment?.description ||
          "Не удалось создать платёж"
      });
    }

    if (
      !payment?.id ||
      !payment?.confirmation?.confirmation_url
    ) {
      console.error(
        "Unexpected YooKassa response:",
        payment
      );

      return res.status(500).json({
        error:
          "ЮKassa не вернула ссылку на оплату"
      });
    }

    return res.status(200).json({
      paymentId: payment.id,

      confirmationUrl:
        payment.confirmation.confirmation_url,

      amountMinor,

      promoCode:
        appliedPromo?.code || null
    });

  } catch (error) {
    console.error(
      "CREATE PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      error:
        "Ошибка создания платежа. Если проблема повторяется, напишите hello.invella@bk.ru"
    });
  }
};
