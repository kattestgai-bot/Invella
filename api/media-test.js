// Temporary media QA bootstrap. Disabled by expiry and removed after the run.
const crypto = require('node:crypto');
const SB = 'https://lwanymjmbcstvggmhevx.supabase.co';
const PK = 'sb_publishable_EY50r1gV7v1zyD9vBgrteA_JVcOg4_J';
function same(a,b){a=Buffer.from(String(a||''));b=Buffer.from(String(b||''));return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(a,b)}
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  const gate=process.env.INVELLA_PAYMENT_QA_TOKEN,expiry=Number(process.env.INVELLA_PAYMENT_QA_EXPIRES_AT);
  if(!gate||!Number.isFinite(expiry)||Date.now()>=expiry)return res.status(404).json({error:'QA closed'});
  const cookie=/(?:^|;\s*)invella_media_qa=([^;]+)/.exec(req.headers.cookie||'')?.[1];
  if(!same(req.query.run,gate)&&!same(req.headers['x-invella-qa'],gate)&&!same(cookie,gate))return res.status(404).json({error:'Not found'});
  if(req.method==='GET'){
    res.setHeader('Set-Cookie','invella_media_qa='+gate+'; Path=/api/media-test; HttpOnly; Secure; SameSite=Strict; Max-Age=7200');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.status(200).send('<!doctype html><html lang="ru"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Проверка сохранения файлов</title><h1>Проверка сохранения файлов Invella</h1><p>Отдельная тестовая учётная запись. Настоящие приглашения не используются.</p><button id="start">Открыть тестовый редактор</button><p id="status"></p><script src="/supabase.min.js"></script><script>document.getElementById("start").onclick=async function(){this.disabled=true;var status=document.getElementById("status");status.textContent="Подготовка…";try{var r=await fetch("/api/media-test",{method:"POST"});var d=await r.json();if(!r.ok)throw Error(d.error);var s=supabase.createClient(location.origin+"/sb","'+PK+'");var v=await s.auth.setSession(d.session);if(v.error)throw v.error;location.href="/?view=edit&id="+encodeURIComponent(d.invitationId)}catch(e){status.textContent=e.message;this.disabled=false}};</script></html>');
  }
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const sk=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!sk)throw Error('QA is not configured');
    const run=crypto.createHash('sha256').update(gate).digest('hex').slice(0,20);
    const email='invella-media-qa-'+run+'@example.invalid',password=crypto.createHash('sha256').update(gate+':media').digest('base64url');
    async function call(path,headers,body){const r=await fetch(SB+path,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const data=await r.json();return{ok:r.ok,status:r.status,data}}
    const admin={apikey:sk,Authorization:'Bearer '+sk,'Content-Type':'application/json'};
    const made=await call('/auth/v1/admin/users',admin,{email,password,email_confirm:true,app_metadata:{media_qa_run:run}});
    if(!made.ok&&made.status!==422)throw Error('QA account creation failed: '+made.status);
    const login=await call('/auth/v1/token?grant_type=password',{apikey:PK,'Content-Type':'application/json'},{email,password});
    if(!login.ok||login.data.user?.app_metadata?.media_qa_run!==run)throw Error('QA sign-in failed: '+login.status);
    const user=login.data.user;
    const headers={apikey:PK,Authorization:'Bearer '+login.data.access_token,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'};
    const saved=await call('/rest/v1/invitations?on_conflict=slug',headers,{owner_id:user.id,title:'[ТЕСТ] Фото и музыка',slug:'qa-media-'+run,template_key:'classic',status:'draft',plan:'draft',content:{names:'Тест фото & Тест музыки',date:'2026-12-26',time:'15:00',message:'Проверка сохранения обложки, галереи и музыки.',media_qa_run:run}});
    if(!saved.ok)throw Error('QA invitation creation failed: '+saved.status);
    let id=saved.data?.[0]?.id;
    if(!id){const r=await fetch(SB+'/rest/v1/invitations?slug=eq.qa-media-'+run+'&select=id',{headers,signal:AbortSignal.timeout(20000)});const rows=await r.json();id=rows?.[0]?.id}
    if(!id)throw Error('QA invitation not found');
    return res.status(200).json({ownerId:user.id,invitationId:id,slug:'qa-media-'+run,run,session:{access_token:login.data.access_token,refresh_token:login.data.refresh_token}});
  }catch(e){console.error('MEDIA QA:',e.message);return res.status(500).json({error:e.message})}
};
