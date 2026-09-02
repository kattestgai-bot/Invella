const SUPABASE_URL="https://lwanymjmbcstvggmhevx.supabase.co";

export default async function handler(req,res){
  if(req.method!=="POST")
    return res.status(405).json({error:"Method not allowed"});

  try{
    const {paymentId}=req.body||{};

    if(!paymentId)
      return res.status(400).json({error:"Не указан ID платежа"});

    const shopId=process.env.YOOKASSA_SHOP_ID;
    const secretKey=process.env.YOOKASSA_SECRET_KEY;
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;

    if(!shopId||!secretKey||!serviceKey)
      return res.status(500).json({error:"Сервис не настроен"});

    const response=await fetch(
      `https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`,
      {
        headers:{
          Authorization:
            "Basic "+
            Buffer.from(`${shopId}:${secretKey}`).toString("base64")
        }
      }
    );

    const payment=await response.json();

    if(!response.ok)
      return res.status(response.status).json({
        error:"Не удалось проверить платёж"
      });

    let published=false;
    let slug=null;

    const invitationId=payment.metadata?.invitationId||null;

    if(invitationId){
      const ir=await fetch(
        `${SUPABASE_URL}/rest/v1/invitations?id=eq.${encodeURIComponent(invitationId)}&select=status,slug`,
        {
          headers:{
            apikey:serviceKey,
            Authorization:`Bearer ${serviceKey}`
          }
        }
      );

      const rows=await ir.json();

      if(ir.ok&&Array.isArray(rows)&&rows[0]){
        published=rows[0].status==="published";
        slug=rows[0].slug||null;
      }
    }

    return res.status(200).json({
      paymentId:payment.id,
      status:payment.status,
      paid:payment.paid===true,
      plan:payment.metadata?.plan||null,
      invitationId,
      published,
      slug
    });

  }catch(e){
    console.error(e);

    return res.status(500).json({
      error:"Ошибка проверки платежа"
    });
  }
}
