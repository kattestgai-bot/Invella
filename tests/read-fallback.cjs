const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const handler=require('../api/read-data');
const source=fs.readFileSync(path.join(__dirname,'../assets/invella-network.js'),'utf8');
const res=()=>({code:0,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(data){this.data=data;return this},send(data){this.data=data;return this}});
(async()=>{
 let requests=[];
 global.fetch=async(url,opts)=>{requests.push({url,opts});return new Response('[{"id":"owned"}]',{headers:{'Content-Type':'application/json','Content-Range':'0-0/1'}})};
 const req={method:'POST',headers:{host:'invella.ru',origin:'https://invella.ru',authorization:'Bearer customer-session'},body:{path:'/rest/v1/invitations?select=id'}};
 let r=res();await handler(req,r);assert.equal(r.code,200);assert.equal(JSON.parse(r.data)[0].id,'owned');
 assert.equal(requests[0].opts.method,'GET');assert.equal(requests[0].opts.headers.Authorization,'Bearer customer-session');
 assert.match(requests[0].opts.headers.apikey,/^sb_publishable_/);assert.equal(r.headers['Cache-Control'],'no-store');
 for(const p of ['/auth/v1/admin/users','https://other.invalid','/rest/v1/rpc/confirm_invella_payment','/rest/v1/invitations/../../auth/v1/admin']){r=res();await handler({...req,body:{path:p}},r);assert.equal(r.code,400)}
 r=res();await handler({...req,headers:{...req.headers,authorization:''}},r);assert.equal(r.code,401);
 r=res();await handler({...req,headers:{...req.headers,origin:'https://other.invalid'}},r);assert.equal(r.code,403);
 assert.equal(requests.length,1,'Rejected paths and tokens must never reach an upstream');
 const calls=[],saved=new Map();
 const window={location:{origin:'https://invella.ru'},fetch:async(url,opts)=>{
  calls.push({url,opts});
  if(url==='/api/read-data')return new Response('[{"id":"owned"}]',{headers:{'Content-Type':'application/json'}});
  return new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError'))));
 }};
 vm.runInNewContext(source,{window,URL,Headers,Response,AbortController,localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},setTimeout:fn=>setTimeout(fn,10),clearTimeout});
 r=await window.invellaFetch('https://invella.ru/sb/rest/v1/invitations?select=id',{headers:{Authorization:'Bearer customer-session'}});
 assert.equal((await r.json())[0].id,'owned');assert.equal(calls.length,2);assert.equal(calls[1].opts.method,'POST');
 assert.equal(JSON.parse(calls[1].opts.body).path,'/rest/v1/invitations?select=id');
 assert.equal(calls[1].opts.headers.Authorization,'Bearer customer-session');
 await window.invellaFetch('https://invella.ru/sb/rest/v1/rsvp_responses?select=guest_name',{headers:{Authorization:'Bearer customer-session'}});
 assert.equal(calls.length,3,'After recovery, the same session should avoid another stalled GET');
 console.log('PASS: stalled GET recovery via POST, customer token retained, read-only route allowlist, no privileged upstream access');
})().catch(error=>{console.error(error);process.exitCode=1});
