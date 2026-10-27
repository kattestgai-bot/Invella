import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 if(req.method!=='POST') return json({error:'Method not allowed'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')!; const anon=Deno.env.get('SUPABASE_ANON_KEY')!; const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth=req.headers.get('Authorization')||'';
  const uc=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:ue}=await uc.auth.getUser(); if(ue||!user) return json({error:'Unauthorized'},401);
  const db=createClient(url,service);
  const {data:adm}=await db.from('invella_admins').select('user_id').eq('user_id',user.id).maybeSingle(); if(!adm) return json({error:'Forbidden'},403);
  const b=await req.json(); const action=String(b.action||'');
  if(action==='list'){
   const {data:invs,error:ie}=await db.from('invitations').select('id,owner_id,title,event_type,slug,status,plan,created_at,published_at').order('created_at',{ascending:false}).limit(100); if(ie) throw ie;
   const ownerIds=[...new Set((invs||[]).map((x:any)=>x.owner_id).filter(Boolean))]; let profiles:any[]=[];
   if(ownerIds.length){const {data,error}=await db.from('profiles').select('id,email,display_name').in('id',ownerIds); if(error) throw error; profiles=data||[];}
   const pm=new Map(profiles.map((p:any)=>[p.id,p]));
   const invitations=(invs||[]).map((x:any)=>({...x,email:pm.get(x.owner_id)?.email||'',display_name:pm.get(x.owner_id)?.display_name||''}));
   const {data:promos,error:pe}=await db.from('promo_codes').select('id,code,discount_type,discount_value,plan_key,active,starts_at,expires_at,max_uses,uses_count,created_at').order('created_at',{ascending:false}); if(pe) throw pe;
   return json({ok:true,invitations,promos:promos||[]});
  }
  if(action==='activate'){
   const id=String(b.invitationId||''); const plan=String(b.plan||''); if(!id||!['basic','pro','premium'].includes(plan)) return json({error:'Некорректные данные'},400);
   const {data,error}=await db.from('invitations').update({plan,status:'published',published_at:new Date().toISOString(),preview_published:false}).eq('id',id).select('id,slug,plan,status').single(); if(error) throw error; return json({ok:true,invitation:data});
  }
  if(action==='disable'){
   const id=String(b.invitationId||''); if(!id) return json({error:'Не выбрано приглашение'},400);
   const {data,error}=await db.from('invitations').update({status:'disabled'}).eq('id',id).select('id,slug,plan,status').single(); if(error) throw error; return json({ok:true,invitation:data});
  }
  if(action==='promo_create'){
   const code=String(b.code||'').trim().toUpperCase(); const type=String(b.discountType||'percent'); const value=Number(b.discountValue); const plan=b.planKey?String(b.planKey):null; const max=b.maxUses===null||b.maxUses===''||b.maxUses===undefined?null:Number(b.maxUses); const expires=b.expiresAt?new Date(b.expiresAt).toISOString():null;
   if(!/^[A-Z0-9_-]{2,40}$/.test(code)||!['percent','fixed'].includes(type)||!Number.isFinite(value)||value<=0||(type==='percent'&&value>100)||(plan&&!['basic','pro','premium'].includes(plan))||(max!==null&&(!Number.isInteger(max)||max<1))) return json({error:'Проверьте данные промокода'},400);
   const {data,error}=await db.from('promo_codes').insert({code,discount_type:type,discount_value:value,plan_key:plan,active:true,max_uses:max,expires_at:expires}).select().single(); if(error) return json({error:error.code==='23505'?'Такой промокод уже существует':error.message},400); return json({ok:true,promo:data});
  }
  if(action==='promo_toggle'){
   const id=String(b.id||''); const active=b.active===true; if(!id) return json({error:'Не выбран промокод'},400); const {data,error}=await db.from('promo_codes').update({active}).eq('id',id).select().single(); if(error) throw error; return json({ok:true,promo:data});
  }
  return json({error:'Unknown action'},400);
 }catch(e){console.error(e); return json({error:e?.message||'Server error'},500);}
});