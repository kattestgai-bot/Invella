const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {gzipSync}=require('node:zlib');
const {execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..');
execFileSync(process.execPath,[path.join(root,'scripts/build.cjs')]);
for(const page of ['index.html','admin.html']){
 const html=fs.readFileSync(path.join(root,page),'utf8');
 assert.ok(gzipSync(html).length<16384,'The complete initial page must fit below a 16 KiB compressed response');
 assert.ok(html.indexOf('charset')<1024);
 assert.ok(html.indexOf('id="invellaEarly"')<1024,'Essential controls and early diagnostics must precede styles and content');
 assert.doesNotMatch(html,/\{\{INVELLA_|__INVELLA_BOOT_CONFIG__|<script id="invellaSdk"|<script id="invellaApp"/);
 for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(m[1]);
 assert.match(html,/id="invellaShellReady"/);
 if(page==='index.html'){
  assert.ok(html.indexOf('id="authModal"')<html.indexOf('id="marketing"'));
  assert.match(html,/id="authBtn"[^>]*data-shell="openAuth"/);
  assert.doesNotMatch(html,/id="app"/,'The editor belongs to a separate bounded transfer');
 }
}
const fragment=fs.readFileSync(path.join(root,'assets/invella-fragment.html'),'utf8');
for(const id of ['app','publishModal','paymentSuccessModal','dashboardModal','resetPasswordModal','offer','privacy'])assert.match(fragment,new RegExp('id="'+id+'"'));
assert.doesNotMatch(fragment,/id="authModal"/,'Never replace credentials already entered into the shell');
console.log('PASS: complete page under 16 KiB, early controls, bounded editor fragment, preserved auth form, valid inline scripts');
