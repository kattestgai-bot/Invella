const assert = require('node:assert/strict');
const create = require('../api/create-payment');
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
const keys = [], bodies = [];
let published = false, calls = 0;
const response = data => ({ ok:true,status:200,json:async()=>data });
global.fetch = async (url, options={}) => {
  calls++;
  if(url.includes('/auth/v1/user'))return response({id:'owner'});
  if(url.includes('/rest/v1/invitations?'))return response([{id:'invitation',owner_id:'owner',status:published?'published':'draft'}]);
  if(url==='https://api.yookassa.ru/v3/payments'){
    keys.push(options.headers['Idempotence-Key']);bodies.push(JSON.parse(options.body));
    return response({id:'provider-payment',test:false,confirmation:{confirmation_url:'https://yoomoney.ru/checkout/test'}});
  }
  throw Error('Unexpected call '+url);
};
const handler=create.withConfig({shopId:'test-shop',secretKey:'test-secret'});
const req=plan=>({method:'POST',headers:{authorization:'Bearer test-session'},body:{plan,invitationId:'invitation',requestId:'00000000-0000-4000-8000-000000000001'}});
const res=()=>({code:0,setHeader(){},status(n){this.code=n;return this},json(data){this.data=data;return this}});
(async()=>{
  for(let i=0;i<2;i++){const r=res();await handler(req('basic'),r);assert.equal(r.code,200)}
  assert.equal(keys[0],keys[1],'Retrying one checkout must reuse the provider operation');
  assert.match(keys[0],/^[a-f0-9]{64}$/);
  const r=res();await handler(req('pro'),r);assert.equal(r.code,200);assert.notEqual(keys[0],keys[2]);
  assert.equal(bodies[0].amount.value,'990.00');assert.equal(bodies[2].amount.value,'1490.00');
  for(const plan of ['constructor','__proto__','toString']){const before=calls,r=res();await handler(req(plan),r);assert.equal(r.code,400);assert.equal(calls,before)}
  published=true;const before=keys.length,blocked=res();await handler(req('basic'),blocked);assert.equal(blocked.code,409);assert.equal(keys.length,before);
  console.log('PASS: checkout retry idempotency, tariff-bound operations, prototype keys rejected, paid invite blocks another checkout');
})().catch(error=>{console.error(error);process.exitCode=1});
