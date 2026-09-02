const SUPABASE_URL="https://lwanymjmbcstvggmhevx.supabase.co";

const PLANS={
  basic:{amount:99000,description:"Invella — Базовый тариф"},
  pro:{amount:149000,description:"Invella — Pro тариф"},
  premium:{amount:249000,description:"Invella — Premium тариф"}
};

export default async function handler(req,res){
  if(req.method!=="POST")
    return res.status(405).json({error:"Method not allowed"});

  try{
    const {plan,invitationId,promoCode}=req.body||{};
    const selected=PLANS[plan];

    if(!selected||!invitationId)
      return res.status(400).json({error:"Не указан тариф или приглашение"});

    const shopId=process.env.YOOKASSA_SHOP_ID;
    const secretKey=process.env.YOOKASSA_SECRET_KEY;
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;

    if(!shopId||!secretKey||!serviceKey)
      return res.status(500).json({error:"Оплата временно недоступна"});

    const auth=req.headers.authorization||"";

    if(!auth.startsWith("Bearer "))
      return res.status(401).json({error:"Войдите в аккаунт ещё раз"});

    const ur=await fetch(`${SUPABASE_URL}/auth/v1/user`,{
      headers:{
        apikey:serviceKey,
        Authorization:auth
      }
    });

    const user=await ur.json();

    if(!ur.ok||!user.id)
      return res.status(401).json({error:"Сессия истекла. Войдите снова"});

    const ir=await fetch(
      `${SUPABASE_URL}/rest/v1/invitations?id=eq.${encodeURIComponent(invitationId)}&owner_id=eq.${encodeURIComponent(user.id)}&select=id`,
      {
        headers:{
          apikey:serviceKey,
          Authorization:`Bearer ${serviceKey}`
        }
      }
    );

    const inv=await ir.json();

    if(!ir.ok||!Array.isArray(inv)||inv.length!==1)
      return res.status(403).json({error:"Приглашение не найдено"});

    let amountMinor=selected.amount;
    let appliedPromo=null;

    const code=String(promoCode||"").trim().toUpperCase();

    if(code){
      const pr=await fetch(
        `${SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(code)}&active=eq.true&select=id,code,discount_type,discount_value,plan_key,starts_at,expires_at,max_uses,uses_count`,
        {
          headers:{
            apikey:serviceKey,
            Authorization:`Bearer ${serviceKey}`
          }
        }
      );

      const rows=await pr.json();
      const p=Array.isArray(rows)?rows[0]:null;
      const now=Date.now();

      if(
        !p ||
        (p.plan_key&&p.plan_key!==plan) ||
        (p.starts_at&&Date.parse(p.starts_at)>now) ||
        (p.expires_at&&Date.parse(p.expires_at)<now) ||
        (p.max_uses!==null&&p.uses_count>=p.max_uses)
      ){
        return res.status(400).json({
          error:"Промокод недействителен или больше не доступен"
        });
      }

      const discount=
        p.discount_type==="percent"
          ? Math.floor(amountMinor*Math.min(p.discount_value,100)/100)
          : p.discount_value;

      amountMinor=Math.max(100,amountMinor-discount);
      appliedPromo=p;
    }

    const response=await fetch("https://api.yookassa.ru/v3/payments",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Idempotence-Key":crypto.randomUUID(),
        Authorization:
          "Basic "+
          Buffer.from(`${shopId}:${secretKey}`).toString("base64")
      },
      body:JSON.stringify({
        amount:{
          value:(amountMinor/100).toFixed(2),
          currency:"RUB"
        },
        capture:true,
        confirmation:{
          type:"redirect",
          return_url:"https://invella-xi.vercel.app/?payment=success"
        },
        description:selected.description,
        metadata:{
          plan,
          invitationId,
          ownerId:user.id,
          promoCode:appliedPromo?.code||"",
          promoId:appliedPromo?.id||"",
          expectedAmountMinor:String(amountMinor)
        }
      })
    });

    const payment=await response.json();

    if(!response.ok)
      return res.status(response.status).json({
        error:"Не удалось создать платёж"
      });

    return res.status(200).json({
      paymentId:payment.id,
      confirmationUrl:payment.confirmation?.confirmation_url,
      amountMinor,
      promoCode:appliedPromo?.code||null
    });

  }catch(e){
    console.error(e);

    return res.status(500).json({
      error:"Ошибка создания платежа. Напишите hello.invella@bk.ru, если проблема повторяется"
    });
  }
}
