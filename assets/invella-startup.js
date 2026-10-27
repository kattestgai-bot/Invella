(function(){
'use strict';
if(window.invellaStartupBoot)return;
window.invellaStartupBoot=true;
var GET_MS=4500,POST_MS=6000;
var urls={styles:'/assets/invella-bundle.css?v=20261026-media-verified-2',sdk:'/supabase.min.js?v=20261001-stable-1',app:'/assets/invella-app.js?v=20261027-startup-1',premium:'/assets/invella-premium-fix.js?v=20261027-startup-1'};
var texts={},active=null,trace={};
var small=new URLSearchParams(location.search).get('lite')==='1';
try{if(new URLSearchParams(location.search).get('lite')==='0')localStorage.removeItem('invella_small_startup');else if(localStorage.getItem('invella_small_startup')==='1')small=true}catch(error){}
var domReady=document.readyState==='loading'?new Promise(function(resolve){document.addEventListener('DOMContentLoaded',resolve,{once:true})}):Promise.resolve();
function message(text){var el=document.getElementById('authMessage');if(el&&!window.invellaReady)el.textContent=text}
async function request(url,options,ms){var controller=new AbortController(),timer=setTimeout(function(){controller.abort()},ms);try{var response=await fetch(url,Object.assign({},options,{signal:controller.signal}));if(!response.ok)throw new Error('HTTP '+response.status);return await response.text()}finally{clearTimeout(timer)}}
async function smallAsset(key){
 var chunks=[],offset=0,total=0,hash='',started=Date.now();
 do{
  if(Date.now()-started>45000)throw new Error('Asset deadline');
  var raw;
  for(var attempt=0;attempt<2;attempt++){try{raw=await request('/api/startup-assets',{method:'POST',credentials:'same-origin',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({asset:key,offset:offset})},POST_MS);break}catch(error){if(attempt===1)throw error}}
  var part=JSON.parse(raw);
  if(part.asset!==key||part.offset!==offset||!Number.isInteger(part.total)||part.total<1||part.total>1048576||!Number.isInteger(part.bytes)||part.bytes<1||part.bytes>6144||!/^[a-f0-9]{64}$/.test(part.sha256)||typeof part.data!=='string'||part.data.length>8192)throw new Error('Invalid asset response');
  if(offset&&(part.total!==total||part.sha256!==hash))throw new Error('Asset version changed');
  total=part.total;hash=part.sha256;
  var binary=atob(part.data),chunk=new Uint8Array(binary.length);if(binary.length!==part.bytes||offset+binary.length>total)throw new Error('Invalid asset chunk');
  for(var i=0;i<binary.length;i++)chunk[i]=binary.charCodeAt(i);chunks.push(chunk);offset+=chunk.length;
 }while(offset<total);
 var bytes=new Uint8Array(total),at=0;chunks.forEach(function(chunk){bytes.set(chunk,at);at+=chunk.length});
 if(window.crypto&&window.crypto.subtle){var digest=await window.crypto.subtle.digest('SHA-256',bytes),actual=Array.from(new Uint8Array(digest)).map(function(b){return b.toString(16).padStart(2,'0')}).join('');if(actual!==hash)throw new Error('Asset integrity failed')}
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
async function asset(key){
 if(texts[key])return texts[key];var started=Date.now(),recovered=small;
 try{
  var text;
  if(!small){try{text=await request(urls[key],{credentials:'same-origin'},GET_MS);if(!text||/^\s*</.test(text))throw new Error('Invalid asset body')}catch(error){recovered=true}}
  if(recovered){message('Восстанавливаем загрузку входа…');text=await smallAsset(key);try{localStorage.setItem('invella_small_startup','1')}catch(error){}}
  texts[key]=text;trace[key]={key:key,status:'ok',bytes:new TextEncoder().encode(text).length,ms:Date.now()-started,transport:recovered?'small':'get'};return text;
 }catch(error){trace[key]={key:key,status:'timeout',bytes:0,ms:Math.min(120000,Date.now()-started),transport:recovered?'small':'get'};throw error}
}
function execute(text){var script=document.createElement('script');script.textContent=text+'\n//# sourceURL=invella-startup-inline.js';document.head.appendChild(script);script.remove()}
function installStyles(text){if(document.getElementById('invellaLoadedStyles'))return;var style=document.createElement('style');style.id='invellaLoadedStyles';style.textContent=text;document.head.appendChild(style)}
function retryButton(show){var el=document.getElementById('invellaStartupRetry');if(el)el.style.display=show?'':'none'}
function publicFailure(show){var old=document.getElementById('invellaPublicStartupFailure');if(old)old.remove();var loader=document.getElementById('publicLoading');if(!show||!loader||!document.documentElement.classList.contains('public-pending'))return;var box=document.createElement('div');box.id='invellaPublicStartupFailure';var text=document.createElement('p');text.textContent='Не удалось завершить загрузку приглашения.';var retry=document.createElement('button');retry.type='button';retry.textContent='Повторить загрузку';retry.onclick=ensure;box.appendChild(text);box.appendChild(retry);(loader.querySelector('.public-loading-card')||loader).appendChild(box)}
async function report(){try{await request('/api/connection-report',{method:'POST',credentials:'same-origin',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({phase:'startup',checks:['styles','sdk','app','premium'].map(function(key){var r=trace[key]||{status:'network',bytes:0,ms:0,transport:'get'};return{status:r.status,code:r.status==='ok'?200:0,bytes:r.bytes,ms:r.ms,transport:r.transport}})})},POST_MS)}catch(error){}}
function ensure(){
 if(active)return active;
 window.invellaStartupState='loading';retryButton(false);publicFailure(false);
 active=(async function(){
  await domReady;
  var jobs={};Object.keys(urls).forEach(function(key){jobs[key]=asset(key).then(function(text){return{text:text}},function(error){return{error:error}})});
  async function result(key){var r=await jobs[key];if(r.error)throw r.error;return r.text}
  try{
   var css=await result('styles');installStyles(css);await domReady;
   var sdk=await result('sdk');if(!window.supabase)execute(sdk);if(!window.supabase||!window.supabase.createClient)throw new Error('Auth module unavailable');
   var app=await result('app'),premium=await result('premium');if(!window.invellaReady)execute(app);if(!window.invellaReady)throw new Error('App module unavailable');
   if(!window.invellaPremiumReady)execute(premium);if(!window.invellaPremiumReady)throw new Error('Editor module unavailable');
   window.invellaStartupState='ready';retryButton(false);
   return true;
  }catch(error){window.invellaStartupState='failed';message('Не удалось завершить загрузку. Нажмите «Повторить загрузку».');retryButton(true);publicFailure(true);console.error('Invella startup:',error.message);return false}
  finally{await Promise.all(Object.keys(jobs).map(function(key){return jobs[key]}));active=null;report()}
 })();return active;
}
window.invellaRetryStartup=ensure;
ensure();
})();


