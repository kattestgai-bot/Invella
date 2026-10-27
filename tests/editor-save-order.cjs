const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../assets/invella-app.js'),'utf8');
function editor() {
  const nodes = new Map(), storage = new Map(), updates = [], inserts = [];
  let readGate = null;
  const node = id => {
    if(!nodes.has(id))nodes.set(id,{value:'',checked:false,textContent:'',style:{},classList:{contains:()=>false,add(){},remove(){},toggle(){}},addEventListener(){}});
    return nodes.get(id);
  };
  const db={from(table){
    assert.equal(table,'invitations');
    let op='read',payload,filters={};
    const query={select(){return query},eq(k,v){filters[k]=v;return query},update(p){op='update';payload=p;return query},insert(p){op='insert';payload=p;return query},
      async maybeSingle(){if(op==='read'){if(readGate)await readGate;return{data:{content:{}},error:null}}updates.push({payload,filters});return{data:{id:filters.id,slug:'saved-slug'},error:null}},
      async single(){inserts.push(payload);return{data:{id:'new-id',slug:'new-slug'},error:null}}};
    return query;
  }};
  const window={location:{origin:'https://test.invalid'},fetch:()=>{},supabase:{createClient:()=>db},addEventListener(){}};
  const document={readyState:'loading',addEventListener(){},getElementById:node,querySelector:()=>null,querySelectorAll:()=>[]};
  const instrumented=source.replace('window.invellaReady=true;',`window.auditEditor={setup:function(id){currentUser={id:'owner'};currentInvitationId=id;cloudReady=true},switchTarget:function(id){currentInvitationId=id;editorEpoch++},save:cloudSave,state:function(){return currentInvitationId}};window.invellaReady=true;`);
  vm.runInNewContext(instrumented,{window,document,console:{error(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{pathname:'/'},Request,AbortController,URLSearchParams,setTimeout,clearTimeout,alert(){}});
  return{audit:window.auditEditor,window,nodes,node,updates,inserts,gate:p=>{readGate=p}};
}
(async()=>{
  let e=editor();e.audit.setup(null);e.node('names').value='One draft';
  assert.deepEqual(await Promise.all([e.audit.save(),e.audit.save()]),[true,true]);
  assert.equal(e.inserts.length,1,'Concurrent autosave/manual save must create one draft');
  assert.equal(e.updates.length,1);assert.equal(e.updates[0].filters.id,'new-id');assert.equal(e.updates[0].filters.owner_id,'owner');
  e=editor();e.audit.setup('original');let release;e.gate(new Promise(resolve=>{release=resolve}));
  const pending=e.audit.save();await new Promise(resolve=>setImmediate(resolve));e.audit.switchTarget('another');release();
  assert.equal(await pending,false);assert.equal(e.updates.length,0,'A stale save must never write another editor');
  e=editor();e.audit.setup('original');e.window.invellaBeforeCloudSave=async()=>{throw Error('upload offline')};
  assert.equal(await e.window.invellaPrepareTransition(),false,'Failed media save must block navigation');
  assert.equal(e.audit.state(),'original');assert.equal(e.updates.length,0);
  console.log('PASS: concurrent draft creation, pinned owner/target, stale save rejected, failed upload blocks navigation');
})().catch(error=>{console.error(error);process.exitCode=1});
