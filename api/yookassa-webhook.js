const serverFetch = require('../lib/server-fetch');
const SUPABASE_URL = "https://lwanymjmbcstvggmhevx.supabase.co";

const NORMAL_PRICES = {
  basic: 99000,
  pro: 149000,
  premium: 249000
};

function withConfig(config = {}) {
return async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
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

    const shopId = config.shopId || process.env.YOOKASSA_SHOP_ID;
    const secretKey = config.secretKey || process.env.YOOKASSA_SECRET_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!paymentId || !shopId || !secretKey || !serviceKey) {
      return res.status(500).json({
        error: "Server is not configured"
      });
    }

    // Никогда не доверяем данным самого webhook.
    // Повторно получаем платёж напрямую у платёжного провайдера.
    const paymentResponse = await serverFetch(
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

    if ((payment.test === true) !== (config.testMode === true) ||
        (config.qaRun && payment.metadata?.qa_run !== config.qaRun)) {
      return res.status(400).json({ error: "Неверный режим платежа" });
    }

    const plan = payment.metadata?.plan;
    const invitationId = payment.metadata?.invitationId;
    const metadataOwnerId = payment.metadata?.ownerId;

    if (
      !Object.hasOwn(NORMAL_PRICES,plan) ||
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
      !Number.isSafeInteger(amountMinor) || !Number.isSafeInteger(expectedAmountMinor) || amountMinor !== expectedAmountMinor ||
      expectedAmountMinor > NORMAL_PRICES[plan] ||
      expectedAmountMinor < 100
    ) {
      return res.status(400).json({
        error: "Invalid amount"
      });
    }

    // Находим приглашение.
    const invitationResponse = await serverFetch(
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

    const confirmed = await serverFetch(`${SUPABASE_URL}/rest/v1/rpc/confirm_invella_payment`, {
      method:'POST',headers:{'Content-Type':'application/json',apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},
      body:JSON.stringify({p_payment_id:payment.id,p_owner_id:invitation.owner_id,p_invitation_id:invitationId,p_plan:plan,
        p_amount_minor:amountMinor,p_currency:'RUB',p_promo_id:payment.metadata?.promoId||null,
        p_provider:config.testMode===true?'yookassa_test':'yookassa'})
    });
    if(!confirmed.ok){console.error('Payment confirmation failed',confirmed.status);return res.status(500).json({error:'Payment confirmation failed'})}
    const result=await confirmed.json();

    return res.status(200).json({
      received: true,
      paid: true,
      published: result.published===true
    });
  } catch (error) {
    console.error("WEBHOOK ERROR:", error);

    return res.status(500).json({
      error: "Webhook error"
    });
  }
};
}
module.exports = withConfig();
module.exports.withConfig = withConfig;
