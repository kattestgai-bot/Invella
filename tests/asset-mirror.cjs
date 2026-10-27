const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const startup=require('../api/startup-assets');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/invella-startup-manifest.json')));
const key='sb_publishable_EY50r1gV7v1zyD9vBgrteA_JVcOg4_J';
function request(changes={},headers={}){
 const params=new URLSearchParams({key,asset:'styles',offset:'0',encoding:'gzip',build:manifest.build,chunkSize:'4096',...changes});
 return new Request('https://example.supabase.co/functions/v1/invella-assets?'+params,{headers:{Origin:'https://invella.ru',...headers}});
}
(async()=>{
 const {createAssetHandler}=await import(pathToFileURL(path.join(__dirname,'../supabase/functions/invella-assets/handler.mjs')));
 const calls=[];const originalInfo=console.info,originalWarn=console.warn;console.info=()=>{};console.warn=()=>{};
 try{
  const handler=createAssetHandler(async(url,options)=>{
   calls.push({url,options});const body=JSON.parse(options.body);const res={statusCode:0,setHeader(){},status(code){this.statusCode=code;return this;},json(data){this.body=data;}};
   await startup({method:'POST',headers:{},body},res);return Response.json(res.body,{status:res.statusCode});
  });
  const first=await handler(request({}, {Authorization:'Bearer DO_NOT_FORWARD',Cookie:'DO_NOT_FORWARD'}));assert.equal(first.status,200);assert.equal(first.headers.get('access-control-allow-origin'),'https://invella.ru');assert.match(first.headers.get('cache-control'),/immutable/);
  const part=await first.json();assert.equal(part.asset,'styles');assert.equal(part.build,manifest.build);assert.equal(part.bytes,4096);assert.equal(calls[0].url,'https://invella.ru/api/startup-assets');assert.equal(JSON.stringify(calls).includes('DO_NOT_FORWARD'),false);assert.deepEqual(Object.keys(calls[0].options.headers),['Content-Type']);
  assert.equal((await handler(request())).status,200);assert.equal(calls.length,1,'Cache the public immutable chunk');
  for(const changes of [{key:'not-the-project-key'},{asset:'../../admin-panel'},{asset:'constructor'},{asset:'invitations'},{asset:'sdk',offset:'-1'},{offset:'0.5'},{chunkSize:'1048576'},{encoding:'br'},{target:'https://other.invalid'}])assert.ok((await handler(request(changes))).status>=400);
  assert.equal(calls.length,1,'Reject arbitrary paths, methods and inputs before fetching anything');
  const other=await handler(request({}, {Origin:'https://other.invalid'}));assert.equal(other.status,403);assert.equal(other.headers.has('access-control-allow-origin'),false);
  const preflight=await handler(new Request(request().url,{method:'OPTIONS',headers:{Origin:'https://invella.ru'}}));assert.equal(preflight.status,204);
  assert.equal((await handler(new Request(request().url,{method:'POST'}))).status,405);
  const noQueryKey=request();const noKeyUrl=new URL(noQueryKey.url);noKeyUrl.searchParams.delete('key');assert.equal((await handler(new Request(noKeyUrl,{headers:{apikey:key}}))).status,200);
  const stale=createAssetHandler(async()=>Response.json({error:'old'},{status:409}));assert.equal((await stale(request())).status,409);
  const bad=createAssetHandler(async()=>Response.json({...part,asset:'invitations',private:'DO_NOT_RETURN'}));const badResponse=await bad(request());assert.equal(badResponse.status,502);assert.equal((await badResponse.text()).includes('DO_NOT_RETURN'),false);
  const oversized=createAssetHandler(async()=>new Response('x'.repeat(9000)));assert.equal((await oversized(request())).status,502);
  const stalled=createAssetHandler(async(_url,{signal})=>({ok:true,status:200,headers:new Headers(),text:()=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))))}),5);assert.equal((await stalled(request())).status,502,'The deadline must cover the complete response body');
 }finally{console.info=originalInfo;console.warn=originalWarn;}
 console.log('PASS: independent public-asset delivery, exact project key/origin checks, fixed upstream, no caller credentials, cache, version checks and whole-body deadline');
})().catch(error=>{console.error(error);process.exitCode=1;});
