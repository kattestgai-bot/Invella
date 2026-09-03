const SUPABASE_URL = "https://lwanymjmbcstvggmhevx.supabase.co";

const NORMAL_PRICES = {
  basic: 99000,
  pro: 149000,
  premium: 249000
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const event = req.body;

    if (!event?.object) {
      return res.status(400).json({ error: "Invalid notification" });
    }

    // Остальные события пока просто принимаем.
    if (event.type !== "payment.succeeded") {
      return res.status(200).json({ received: true });
    }

    const paymentId = event.object.id;

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!paymentId || !shopId || !secretKey || !serviceKey) {
      return res.status(500).json({
        error: "Server is not configured"
      });
    }

    // Никогда не доверяем данным самого webhook.
    // Повторно получаем платёж напрямую у платёжного провайдера.
    const paymentResponse = await fetch(
      `https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${shopId}:${secretKey}`).toString("base64")
        }
      }
    );

    const payment = await paymentResponse.json();

    if (
      !paymentResponse.ok ||
      payment.status !== "succeeded" ||
      payment.paid !== true
    ) {
      return res.status(400).json({
        error: "Payment verification failed"
      });
    }

    const plan = payment.metadata?.plan;
    const invitationId = payment.metadata?.invitationId;
    const metadataOwnerId = payment.metadata?.ownerId;

    if (
      !NORMAL_PRICES[plan] ||
      !invitationId ||
      !metadataOwnerId
    ) {
      return res.status(400).json({
        error: "Invalid metadata"
      });
    }

    const amountMinor = Math.round(
      Number(payment.amount?.value || 0) * 100
    );

    const expectedAmountMinor = Number(
      payment.metadata?.expectedAmountMinor || NORMAL_PRICES[plan]
    );

    if (
      payment.amount?.currency !== "RUB" ||
      amountMinor !== expectedAmountMinor ||
      expectedAmountMinor > NORMAL_PRICES[plan] ||
      expectedAmountMinor < 100
    ) {
      return res.status(400).json({
        error: "Invalid amount"
      });
    }

    // Находим приглашение.
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
      return res.status(404).json({
        error: "Invitation not found"
      });
    }

    const invitation = invitations[0];

    // Защита от подмены ownerId.
    if (invitation.owner_id !== metadataOwnerId) {
      return res.status(403).json({
        error: "Invitation owner mismatch"
      });
    }

    // Записываем платёж.
    const paymentDbResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/payments?on_conflict=provider_payment_id`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "resolution=merge-duplicates,return=representation"
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

    const paymentRows = await paymentDbResponse.json();

    if (!paymentDbResponse.ok) {
      console.error("PAYMENT DB ERROR:", paymentRows);

      return res.status(500).json({
        error: "Payment database error"
      });
    }

    // Публикуем приглашение и выдаём купленный тариф.
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
          plan,
          status: "published",
          preview_published: false,
          published_at: new Date().toISOString()
        })
      }
    );

    if (!publishResponse.ok) {
      const publishError = await publishResponse.text();

      console.error("INVITATION PUBLISH ERROR:", publishError);

      return res.status(500).json({
        error: "Invitation publish error"
      });
    }

    // Учитываем использование промокода.
    const promoId = payment.metadata?.promoId || "";

    if (promoId) {
      const redemptionResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/promo_redemptions?provider_payment_id=eq.${encodeURIComponent(
          paymentId
        )}&select=id`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`
          }
        }
      );

      const existingRedemptions =
        await redemptionResponse.json();

      if (
        redemptionResponse.ok &&
        Array.isArray(existingRedemptions) &&
        existingRedemptions.length === 0
      ) {
        const insertRedemptionResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/promo_redemptions`,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`
            },

            body: JSON.stringify({
              promo_code_id: promoId,
              payment_id: paymentRows?.[0]?.id || null,
              owner_id: invitation.owner_id,
              invitation_id: invitationId,
              provider_payment_id: paymentId
            })
          }
        );

        if (insertRedemptionResponse.ok) {
          const incrementResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/increment_promo_use`,
            {
              method: "POST",

              headers: {
                "Content-Type": "application/json",
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`
              },

              body: JSON.stringify({
                p_id: promoId
              })
            }
          );

          if (!incrementResponse.ok) {
            console.error(
              "PROMO INCREMENT ERROR:",
              await incrementResponse.text()
            );
          }
        } else {
          console.error(
            "PROMO REDEMPTION ERROR:",
            await insertRedemptionResponse.text()
          );
        }
      }
    }

    return res.status(200).json({
      received: true,
      paid: true,
      published: true
    });
  } catch (error) {
    console.error("WEBHOOK ERROR:", error);

    return res.status(500).json({
      error: "Webhook error"
    });
  }
};
