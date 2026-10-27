import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 try{
  const url=Deno.env.get('SUPABASE_URL')!;
  const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth=req.headers.get('Authorization')||'';
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:ue}=await userClient.auth.getUser();
  if(ue||!user) return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers:{...cors,'Content-Type':'application/json'}});
  const admin=createClient(url,service);
  const {data:isAdmin}=await admin.from('invella_admins').select('user_id').eq('user_id',user.id).maybeSingle();
  if(!isAdmin) return new Response(JSON.stringify({error:'Forbidden'}),{status:403,headers:{...cors,'Content-Type':'application/json'}});
  const body=await req.json();
  const invitationId=String(body.invitationId||'');
  const plan=String(body.plan||'');
  if(!invitationId||!['basic','pro','premium'].includes(plan)) return new Response(JSON.stringify({error:'Invalid request'}),{status:400,headers:{...cors,'Content-Type':'application/json'}});
  const {data:inv,error:ie}=await admin.from('invitations').select('id,slug').eq('id',invitationId).maybeSingle();
  if(ie||!inv) return new Response(JSON.stringify({error:'Invitation not found'}),{status:404,headers:{...cors,'Content-Type':'application/json'}});
  const {error:up}=await admin.from('invitations').update({plan,status:'published',published_at:new Date().toISOString(),preview_published:false}).eq('id',invitationId);
  if(up) throw up;
  return new Response(JSON.stringify({ok:true,plan,slug:inv.slug}),{headers:{...cors,'Content-Type':'application/json'}});
 }catch(e){return new Response(JSON.stringify({error:e?.message||'Server error'}),{status:500,headers:{...cors,'Content-Type':'application/json'}})}
});