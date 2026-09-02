const SUPABASE_URL="https://lwanymjmbcstvggmhevx.supabase.co";

export default async function handler(req,res){
  if(req.method!=="POST")
    return res.status(405).json({error:"Method not allowed"});

  try{
    const event=req.body;

    if(!event?.object)
      return res.status(400).json({error:"Invalid notification"});

    if(event.type!=="payment.succeeded")
      return res.status(200).json({received:true});

    const paymentId=event.object.id;
    const shopId=process.env.YOOKASSA_SHOP_ID;
    const secretKey=process.env.YOOKASSA_SECRET_KEY;
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;

    if(!paymentId||!shopId||!secretKey||!serviceKey)
      return res.status(500).json({error:"Server is not configured"});

    const cr=await fetch(
      `https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`,
      {
        headers:{
          Authorization:
            "Basic "+
            Buffer.from(`${shopId}:${secretKey}`).toString("base64")
        }
      }
    );

    const p=await cr.json();

    if(!cr.ok||p.status!=="succeeded"||p.paid!==true)
      return res.status(400).json({error:"Payment verification failed"});

    const plan=p.metadata?.plan;
    const invitationId=p.metadata?.invitationId;

    const normal={
      basic:99000,
      pro:149000,
      premium:249000
    };

    if(!normal[plan]||!invitationId)
      return res.status(400).json({error:"Invalid metadata"});

    const amountMinor=Math.round(Number(p.amount?.value||0)*100);
    const expected=Number(
      p.metadata?.expectedAmountMinor||normal[plan]
    );

    if(
      p.amount?.currency!=="RUB" ||
      amountMinor!==expected ||
      expected>normal[plan] ||
      expected<100
    ){
      return res.status(400).json({error:"Invalid amount"});
    }

    const ir=await fetch(
      `${SUPABASE_URL}/rest/v1/invitations?id=eq.${encodeURIComponent(invitationId)}&select=id,owner_id,slug`,
      {
        headers:{
          apikey:serviceKey,
          Authorization:`Bearer ${serviceKey}`
        }
      }
    );

    const invs=await ir.json();

    if(!ir.ok||!Array.isArray(invs)||invs.length!==1)
      return res.status(404).json({error:"Invitation not found"});

    const inv=invs[0];

    const payr=await fetch(
      `${SUPABASE_URL}/rest/v1/payments?on_conflict=provider_payment_id`,
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          apikey:serviceKey,
          Authorization:`Bearer ${serviceKey}`,
          Prefer:"resolution=merge-duplicates,return=representation"
        },
        body:JSON.stringify({
          owner_id:inv.owner_id,
          invitation_id:invitationId,
          provider:"yookassa",
          provider_payment_id:paymentId,
          plan_key:plan,
          amount_minor:amountMinor,
          currency:"RUB",
          status:"succeeded",
          confirmed_at:new Date().toISOString()
        })
      }
    );

    const payRows=await payr.json();

    if(!payr.ok)
      return res.status(500).json({error:"Payment database error"});

    const pub=await fetch(
      `${SUPABASE_URL}/rest/v1/invitations?id=eq.${encodeURIComponent(invitationId)}`,
      {
        method:"PATCH",
        headers:{
          "Content-Type":"application/json",
          apikey:serviceKey,
          Authorization:`Bearer ${serviceKey}`,
          Prefer:"return=minimal"
        },
        body:JSON.stringify({
          plan,
          status:"published",
          preview_published:false,
          published_at:new Date().toISOString()
        })
      }
    );

    if(!pub.ok)
      return res.status(500).json({error:"Invitation publish error"});

    const promoId=p.metadata?.promoId||"";

    if(promoId){
      const exists=await fetch(
        `${SUPABASE_URL}/rest/v1/promo_redemptions?provider_payment_id=eq.${encodeURIComponent(paymentId)}&select=id`,
        {
          headers:{
            apikey:serviceKey,
            Authorization:`Bearer ${serviceKey}`
          }
        }
      );

      const ex=await exists.json();

      if(Array.isArray(ex)&&ex.length===0){
        await fetch(
          `${SUPABASE_URL}/rest/v1/promo_redemptions`,
          {
            method:"POST",
            headers:{
              "Content-Type":"application/json",
              apikey:serviceKey,
              Authorization:`Bearer ${serviceKey}`
            },
            body:JSON.stringify({
              promo_code_id:promoId,
              payment_id:payRows?.[0]?.id||null,
              owner_id:inv.owner_id,
              invitation_id:invitationId,
              provider_payment_id:paymentId
            })
          }
        );

        await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/increment_promo_use`,
          {
            method:"POST",
            headers:{
              "Content-Type":"application/json",
              apikey:serviceKey,
              Authorization:`Bearer ${serviceKey}`
            },
            body:JSON.stringify({
              p_id:promoId
            })
          }
        );
      }
    }

    return res.status(200).json({
      received:true,
      paid:true,
      published:true
    });

  }catch(e){
    console.error(e);

    return res.status(500).json({
      error:"Webhook error"
    });
  }
                }
