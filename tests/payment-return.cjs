const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../assets/invella-payment-return.js'),'utf8');
const paymentId='fixture-payment',owner='fixture-owner';
function storage(values={}){const items=new Map(Object.entries(values));return{getItem:key=>items.get(key)||null,setItem:(key,value)=>items.set(key,String(value)),removeItem:key=>items.delete(key),items};}
function runtime(answers=[],options={}){
 const nodes=Object.fromEntries(['paymentState','paymentTitle','paymentMessage','retryPayment','openInvitation'].map(id=>[id,{id,hidden:true,textContent:'',setAttribute(name,value){this[name]=value;}}]));
 const local=storage(options.noSession?{}:{'sb-invella-auth-token':JSON.stringify({access_token:'fixture-token',user:{id:owner}}),'invella_pending_payment':JSON.stringify({paymentId})});
 if(options.noPending)local.removeItem('invella_pending_payment');
 const tab=storage(),calls=[],goals=[],timers=[],queue=[];
 function XHR(){}XHR.prototype.open=function(method,url){this.method=method;this.url=url;};XHR.prototype.setRequestHeader=function(name,value){(this.headers||(this.headers={}))[name]=value;};
 XHR.prototype.send=function(raw){calls.push({method:this.method,url:this.url,body:JSON.parse(raw),headers:this.headers});queue.push(()=>{const answer=answers.shift()||{status:200,data:{paymentId,status:'pending',paid:false}};if(answer.before)answer.before(local);if(answer.error)return this[answer.error]();this.status=answer.status;this.responseText=answer.raw===undefined?JSON.stringify(answer.data):answer.raw;this.onload();});};
 const document={getElementById:id=>nodes[id]},window={ym:(...args)=>goals.push(args)},location={hostname:'invella.ru',search:'?payment=success&paid=1'};
 const context=vm.createContext({window,document,location,localStorage:local,sessionStorage:tab,XMLHttpRequest:XHR,Date,Number,Object,JSON,setTimeout:fn=>timers.push(fn)});
 vm.runInContext(source,context);
 function flush(){let guard=0;while(queue.length||timers.length){if(++guard>30)throw Error('Unbounded payment polling');if(queue.length)queue.shift()();else timers.shift()();}}
 return{nodes,local,tab,calls,goals,flush,queue,timers,context};
}
function paid(extra={}){return{status:200,data:{paymentId,status:'succeeded',paid:true,published:true,slug:'fixture-invitation',plan:'pro',...extra}};}
const r=runtime([paid(),paid()]);r.flush();assert.equal(r.nodes.paymentState['data-state'],'confirmed');assert.equal(r.nodes.openInvitation.href,'/i/fixture-invitation');assert.equal(r.nodes.openInvitation.hidden,false);assert.equal(r.local.getItem('invella_pending_payment'),null);assert.equal(r.goals.length,1);assert.deepEqual(JSON.parse(JSON.stringify(r.goals[0][3])),{plan:'pro'});assert.equal(JSON.stringify(r.goals).includes(paymentId),false);assert.equal(r.calls[0].url,'/api/payment-status');assert.equal(r.calls[0].headers.Authorization,'Bearer fixture-token');
r.nodes.retryPayment.onclick();r.flush();assert.equal(r.nodes.paymentState['data-state'],'confirmed','Refresh/recheck can use the owner-bound completed record');assert.equal(r.goals.length,1,'A confirmed payment must count once');
const empty=runtime([],{noSession:true});empty.flush();assert.equal(empty.calls.length,0);assert.equal(empty.nodes.paymentState['data-state'],'account','URL success flags never prove payment');
const noPending=runtime([],{noPending:true});noPending.flush();assert.equal(noPending.calls.length,0);
const pending=runtime();pending.flush();assert.equal(pending.calls.length,5);assert.equal(pending.nodes.paymentState['data-state'],'pending');assert.equal(pending.nodes.retryPayment.hidden,false);assert.equal(pending.goals.length,0);
const later=runtime([{status:200,data:{paymentId,status:'pending',paid:false}},paid()]);later.flush();assert.equal(later.nodes.paymentState['data-state'],'confirmed');assert.equal(later.calls.length,2);
const canceled=runtime([{status:200,data:{paymentId,status:'canceled',paid:false}}]);canceled.flush();assert.equal(canceled.nodes.paymentState['data-state'],'canceled');assert.equal(canceled.nodes.openInvitation.hidden,true);assert.equal(canceled.goals.length,0);
for(const status of [401,403]){const a=runtime([{status,data:{error:'private backend message'}}]);a.flush();assert.equal(a.nodes.paymentState['data-state'],'account');assert.equal(a.nodes.openInvitation.hidden,true);assert.equal(a.nodes.paymentMessage.textContent.includes('private backend'),false);}
for(const error of ['onerror','ontimeout']){const a=runtime([{error}]);a.flush();assert.equal(a.nodes.paymentState['data-state'],'error');assert.equal(a.nodes.retryPayment.disabled,false);assert.equal(a.nodes.retryPayment.hidden,false);}
const malformed=runtime([{status:200,raw:'<html>unavailable</html>'}]);malformed.flush();assert.equal(malformed.nodes.paymentState['data-state'],'error');
const switched=runtime([paid({paymentId:'other-payment'})]);switched.flush();assert.equal(switched.nodes.paymentState['data-state'],'error');assert.equal(switched.goals.length,0);
const disabled=runtime([paid({published:false,invitationStatus:'disabled'})]);disabled.flush();assert.equal(disabled.nodes.paymentState['data-state'],'support');assert.equal(disabled.nodes.openInvitation.hidden,true);
const injected=runtime([paid({slug:'javascript:alert(1)'})]);injected.flush();assert.equal(injected.nodes.openInvitation.hidden,true);
const overlap=runtime([paid()]);overlap.nodes.retryPayment.onclick();assert.equal(overlap.calls.length,1,'A double click cannot start overlapping status requests');overlap.flush();
const newCheckout=runtime([{...paid(),before:local=>local.setItem('invella_pending_payment',JSON.stringify({paymentId:'new-payment'}))}]);newCheckout.flush();assert.equal(JSON.parse(newCheckout.local.getItem('invella_pending_payment')).paymentId,'new-payment','Completing one payment must not discard another tab\'s pending checkout');
const html=fs.readFileSync(path.join(__dirname,'../src/payment-complete.html'),'utf8');assert.match(html,/Что делать дальше/);assert.doesNotMatch(html,/invella-shell|invella-app|supabase\.min/,'The instruction must render independently of the editor');
console.log('PASS: standalone payment return, verified status only, bounded polling, auth/errors/cancel, safe links, conversion deduplication and concurrent checkout protection');
