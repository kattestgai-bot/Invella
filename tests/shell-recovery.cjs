const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {gzipSync}=require('node:zlib');
const source=fs.readFileSync(path.join(__dirname,'../assets/invella-shell.js'),'utf8');
const build='0123456789abcdef',noise=crypto.randomBytes(2500).toString('base64');
const texts={styles:'.test{}',sdk:'window.supabase={createClient:function(){}};',network:'window.invellaFetch=function(){};',app:'window.invellaReady=true;window.setAuthMode=function(){};window.submitAuth=function(){window.submissions=(window.submissions||0)+1};',premium:'window.invellaPremiumReady=true;',fragment:'<div id="app"></div>'};
for(const key of ['sdk','network','app','premium'])texts[key]='/*'+noise+'*/'+texts[key];
function runtime(options={}){
 const assetTexts={...texts};if(options.waitingAccount)assetTexts.app+='window.invellaInitialization=new Promise(function(resolve){window.releaseAccount=resolve});window.chooseTemplate=function(value){window.chosen=value};';
 const nodes={invellaShellReady:{},invellaCriticalStyles:{},authEmail:{value:'kept@example.invalid'},authPassword:{value:'preserved-test-value'},authMessage:{textContent:''}},calls=[],reports=[],state={fail:options.fail,active:0,max:0};
 const notice={hidden:true,querySelector:selector=>selector==='span'?{textContent:''}:{hidden:true}};nodes.invellaBootStatus=notice;
 const window={crypto:crypto.webcrypto,addEventListener(){}};let context;
 const document={readyState:'complete',getElementById:id=>nodes[id],addEventListener(){},createElement(tag){
  if(tag==='div'){const holder={children:[]};Object.defineProperty(holder,'innerHTML',{set(){holder.children=[{id:'app',holder}]}});Object.defineProperty(holder,'firstChild',{get(){return holder.children[0]}});return holder}
  return{tag};
 },body:{style:{},insertBefore(el){el.holder.children.shift();nodes[el.id]=el}},head:{appendChild(el){if(el.id)nodes[el.id]=el;if(el.tag==='script')vm.runInContext(el.textContent,context)}}};
 function XHR(){}XHR.prototype.open=function(method,url){this.method=method;this.url=url};XHR.prototype.setRequestHeader=function(){};
 XHR.prototype.abort=function(){this.aborted=true;if(this.release)this.release();if(this.onabort)this.onabort();};
 XHR.prototype.send=function(raw){const mirrored=this.url.startsWith('https://assets.example.invalid/');let body=raw?JSON.parse(raw):null;
  if(mirrored){body=Object.fromEntries(new URL(this.url).searchParams);body.offset=Number(body.offset);body.chunkSize=Number(body.chunkSize);}
  const transfer=mirrored||this.url==='/api/startup-assets';if(transfer){state.active++;state.max=Math.max(state.max,state.active);let done=false;this.release=()=>{if(!done){done=true;state.active--;}};}
  calls.push({url:this.url,body});queueMicrotask(()=>{
  if(this.aborted)return;if(this.release)this.release();
  if(this.url==='/api/connection-report'){reports.push(body);this.status=201;this.responseText='{}';return this.onload()}
  if((this.method==='GET'&&!mirrored)||(mirrored&&options.mirrorBlocked)||(!mirrored&&options.originBlocked)){this.status=200;return this.ontimeout()}
  if(state.fail){this.status=503;return this.onload()}
  const size=body.chunkSize||384,bytes=body.encoding==='gzip'?gzipSync(Buffer.from(assetTexts[body.asset])):Buffer.from(assetTexts[body.asset]),chunk=bytes.subarray(body.offset,body.offset+size);
  this.responseText=JSON.stringify({asset:body.asset,offset:body.offset,bytes:chunk.length,total:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),encoding:body.encoding,build,data:chunk.toString('base64')});
  assert.ok(Buffer.byteLength(this.responseText)<6144);this.status=200;this.onload();
 });};
 const config={build,page:'main',assets:Object.fromEntries(Object.keys(texts).map(key=>[key,'/'+key])),...(options.mirror?{mirror:'https://assets.example.invalid/public',mirrorKey:'publishable-fixture'}:{})};
 context=vm.createContext({window,document,location:{search:options.small?'?delivery=small':''},XMLHttpRequest:XHR,Promise,Number,Date,Uint8Array,Array,JSON,TextDecoder,Response,Blob,DecompressionStream:options.legacy?undefined:DecompressionStream,atob,setInterval,clearInterval,setTimeout:()=>0});
 vm.runInContext(source.replace('__INVELLA_BOOT_CONFIG__',JSON.stringify(config)),context);
 return{window,nodes,calls,reports,state};
}
(async()=>{
 for(const legacy of [false,true]){const r=runtime({legacy});await r.window.invellaRetryBoot();assert.equal(r.window.invellaReady,true);assert.equal(r.window.invellaSmallDelivery,true,'Recovered sessions also use the compatible transport for account reads');assert.equal(r.window.invellaPremiumReady,true);assert.ok(r.nodes.app);assert.equal(r.nodes.authEmail.value,'kept@example.invalid');assert.equal(r.nodes.authPassword.value,'preserved-test-value');assert.ok(r.calls.some(c=>c.body?.protocol===2));assert.ok(r.reports.some(x=>x.stage==='ready'&&x.small));}
 const waiting=runtime({waitingAccount:true,small:true}),choice=waiting.window.chooseTemplate('classic');await waiting.window.invellaRetryBoot();assert.equal(waiting.window.chosen,undefined);waiting.window.releaseAccount();await choice;assert.equal(waiting.window.chosen,'classic');
 for(const legacy of [false,true]){const alternate=runtime({mirror:true,originBlocked:true,small:true,legacy});await alternate.window.invellaRetryBoot();assert.equal(alternate.window.invellaReady,true,'Every original asset request can fail while the independent origin restores the editor');assert.ok(alternate.calls.some(c=>c.url.startsWith('https://assets.example.invalid/')));assert.ok(!alternate.calls.some(c=>c.url==='/api/startup-assets'));assert.ok(alternate.state.max<=2,'All assets share a two-request concurrency limit');assert.equal(JSON.stringify(alternate.calls).includes('preserved-test-value'),false);}
 const mirrorDown=runtime({mirror:true,mirrorBlocked:true,small:true});await mirrorDown.window.invellaRetryBoot();assert.equal(mirrorDown.window.invellaReady,true,'If the mirror is unavailable the original source remains usable');assert.ok(mirrorDown.calls.some(c=>c.url==='/api/startup-assets'));
 const r=runtime({fail:true,small:true});await r.window.invellaRetryBoot();assert.notEqual(r.window.invellaReady,true);assert.ok(r.reports.some(x=>x.stage==='failed'&&x.code===503),'Keep actual HTTP error codes');r.state.fail=false;await r.window.invellaRetryBoot();assert.equal(r.window.invellaReady,true);
 assert.ok(r.reports.some(x=>x.stage==='failed'&&x.asset==='styles'&&x.reason==='http'),'A failed module and reason must be visible without relying on remote logs');
 console.log('PASS: stalled 200 responses recover over bounded compressed XHR, gzip/older browser decoding, unchanged credentials, actual module/failure code and retry');
})().catch(e=>{console.error(e);process.exitCode=1});
