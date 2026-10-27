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
 const nodes={invellaShellReady:{},invellaCriticalStyles:{},authEmail:{value:'kept@example.invalid'},authPassword:{value:'preserved-test-value'},authMessage:{textContent:''}},calls=[],reports=[],state={fail:options.fail};
 const notice={hidden:true,querySelector:selector=>selector==='span'?{textContent:''}:{hidden:true}};nodes.invellaBootStatus=notice;
 const window={crypto:crypto.webcrypto,addEventListener(){}};let context;
 const document={readyState:'complete',getElementById:id=>nodes[id],addEventListener(){},createElement(tag){
  if(tag==='div'){const holder={children:[]};Object.defineProperty(holder,'innerHTML',{set(){holder.children=[{id:'app',holder}]}});Object.defineProperty(holder,'firstChild',{get(){return holder.children[0]}});return holder}
  return{tag};
 },body:{style:{},insertBefore(el){el.holder.children.shift();nodes[el.id]=el}},head:{appendChild(el){if(el.id)nodes[el.id]=el;if(el.tag==='script')vm.runInContext(el.textContent,context)}}};
 function XHR(){}XHR.prototype.open=function(method,url){this.method=method;this.url=url};XHR.prototype.setRequestHeader=function(){};
 XHR.prototype.send=function(raw){const body=raw?JSON.parse(raw):null;calls.push({url:this.url,body});queueMicrotask(()=>{
  if(this.url==='/api/connection-report'){reports.push(body);this.status=201;this.responseText='{}';return this.onload()}
  if(this.method==='GET'){this.status=200;return this.ontimeout()}
  if(state.fail){this.status=503;return this.onload()}
  const bytes=body.encoding==='gzip'?gzipSync(Buffer.from(texts[body.asset])):Buffer.from(texts[body.asset]),chunk=bytes.subarray(body.offset,body.offset+384);
  this.responseText=JSON.stringify({asset:body.asset,offset:body.offset,bytes:chunk.length,total:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),encoding:body.encoding,build,data:chunk.toString('base64')});
  assert.ok(Buffer.byteLength(this.responseText)<1024);this.status=200;this.onload();
 });};
 const config={build,page:'main',assets:Object.fromEntries(Object.keys(texts).map(key=>[key,'/'+key]))};
 context=vm.createContext({window,document,location:{search:options.small?'?delivery=small':''},XMLHttpRequest:XHR,Promise,Number,Date,Uint8Array,Array,JSON,TextDecoder,Response,Blob,DecompressionStream:options.legacy?undefined:DecompressionStream,atob,setInterval,clearInterval,setTimeout:()=>0});
 vm.runInContext(source.replace('__INVELLA_BOOT_CONFIG__',JSON.stringify(config)),context);
 return{window,nodes,calls,reports,state};
}
(async()=>{
 for(const legacy of [false,true]){const r=runtime({legacy});await r.window.invellaRetryBoot();assert.equal(r.window.invellaReady,true);assert.equal(r.window.invellaPremiumReady,true);assert.ok(r.nodes.app);assert.equal(r.nodes.authEmail.value,'kept@example.invalid');assert.equal(r.nodes.authPassword.value,'preserved-test-value');assert.ok(r.calls.some(c=>c.body?.protocol===2));assert.ok(r.reports.some(x=>x.stage==='ready'&&x.small));}
 const r=runtime({fail:true,small:true});await r.window.invellaRetryBoot();assert.notEqual(r.window.invellaReady,true);assert.ok(r.reports.some(x=>x.stage==='failed'&&x.code===503),'Keep actual HTTP error codes');r.state.fail=false;await r.window.invellaRetryBoot();assert.equal(r.window.invellaReady,true);
 console.log('PASS: stalled 200 responses recover via sub-1-KiB XHR, gzip/older browser decoding, unchanged credentials, actual failure code and retry');
})().catch(e=>{console.error(e);process.exitCode=1});
