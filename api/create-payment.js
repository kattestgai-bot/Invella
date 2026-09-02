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
      promoCode = "",
      validatePromoOnly = false
    } = req.body || {};

    const selected = PLANS[plan];

    if (!selected) {
      return res.status(400).json({
        error: "Не выбран тариф"
      });
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return res.status(500).json({
        error: "Сервис временно недоступен"
      });
    }

    /* =========================
       ПРОВЕРКА ПОЛЬЗОВАТЕЛЯ
    ========================= */

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
      return res.status(401).json({
        error: "Сессия истекла. Войдите в аккаунт снова."
      });
    }

    /* =========================
       ПРОВЕРКА ПРИГЛАШЕНИЯ
    ========================= */

    if (!invitationId) {
      return res.status(400).json({
        error: "Не найдено приглашение"
      });
    }

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
      return res.status(403).json({
        error: "Приглашение не найдено"
      });
    }

    /* =========================
       ПРОМОКОД
    ========================= */

    let amountMinor = selected.amount;
    let appliedPromo = null;

    const code = String(promoCode || "")
      .trim()
      .toUpperCase();

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
        console.error(
          "Promo database error:",
          promoRows
        );

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
        (
          promo.starts_at &&
          Date.parse(promo.starts_at) > now
        ) ||
        (
          promo.expires_at &&
          Date.parse(promo.expires_at) < now
        ) ||
        (
          promo.max_uses !== null &&
          promo.max_uses !== undefined &&
          Number(promo.uses_count || 0) >=
            Number(promo.max_uses)
        );

      if (invalidPromo) {
        return res.status(400).json({
          validPromo: false,
          error: "Неверный промокод"
        });
      }

      let discountMinor = 0;

      if (promo.discount_type === "percent") {
        const percent = Math.min(
          Math.max(
            Number(promo.discount_value) || 0,
            0
          ),
          100
        );

        discountMinor = Math.floor(
          amountMinor * percent / 100
        );
      }

      if (promo.discount_type === "fixed") {
        discountMinor =
          Number(promo.discount_value) || 0;
      }

      amountMinor = Math.max(
        100,
        amountMinor - discountMinor
      );

      appliedPromo = promo;
    }

    /* =========================
       ТОЛЬКО ПРОВЕРКА ПРОМОКОДА
       ПЛАТЁЖ НЕ СОЗДАЁТСЯ
    ========================= */

    if (validatePromoOnly === true) {
      if (!code || !appliedPromo) {
        return res.status(400).json({
          validPromo: false,
          error: "Неверный промокод"
        });
      }

      return res.status(200).json({
        validPromo: true,

        promoCode: appliedPromo.code,

        discountType:
          appliedPromo.discount_type,

        discountValue:
          appliedPromo.discount_value,

        originalAmountMinor:
          selected.amount,

        amountMinor,

        originalAmount:
          (selected.amount / 100).toFixed(0),

        amount:
          (amountMinor / 100).toFixed(0)
      });
    }

    /* =========================
       СОЗДАНИЕ ПЛАТЕЖА
    ========================= */

    if (!shopId || !secretKey) {
      return res.status(500).json({
        error: "Оплата временно недоступна"
      });
    }

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

            ownerId:
              user.id,

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
        "YooKassa error:",
        payment
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
      return res.status(500).json({
        error:
          "Не удалось открыть страницу оплаты"
      });
    }

    return res.status(200).json({
      paymentId:
        payment.id,

      confirmationUrl:
        payment.confirmation.confirmation_url,

      originalAmountMinor:
        selected.amount,

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
