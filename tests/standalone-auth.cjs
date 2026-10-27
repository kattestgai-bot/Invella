const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
global.self=global;
const {createClient}=require('../supabase.min.js');
const source=fs.readFileSync(path.join(__dirname,'../assets/invella-auth.js'),'utf8');
const session={access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user:{id:'00000000-0000-4000-8000-000000000001',email:'fixture@example.invalid'}};
function runtime(answers=[],options={}){
 const nodes={},calls=[],saved={},reports=[];
 for(const id of ['authModal','authTitle','authSubmit','loginTab','signupTab','authEmail','authPassword','authPasswordConfirm','confirmPasswordWrap','passwordTips','forgotPasswordBtn','authMessage'])nodes[id]={id,value:'',textContent:'',disabled:false,classList:{toggle(){}},className:''};
 const window={addEventListener(){},invellaEarlyReport:(stage,action,detail)=>reports.push({stage,...detail})},events={};
 const statusText={textContent:''},retry={hidden:true};nodes.invellaShellReady={};nodes.invellaCriticalStyles={};nodes.invellaBootStatus={hidden:true,querySelector:selector=>selector==='span'?statusText:retry};
 const document={readyState:'complete',getElementById:id=>nodes[id],addEventListener:(name,fn)=>events[name]=fn};
 function XHR(){}XHR.prototype.open=function(method,url){this.method=method;this.url=url};XHR.prototype.setRequestHeader=function(name,value){(this.headers||(this.headers={}))[name]=value};
 XHR.prototype.send=function(body){calls.push({url:this.url,method:this.method,body:JSON.parse(body),headers:this.headers});const answer=this.url.startsWith('/api/')?{status:this.url.includes('connection-report')?201:503,data:{}}:answers.shift()||{status:200,data:session};queueMicrotask(()=>{if(answer.delay){options.release=()=>{this.status=answer.status;this.responseText=JSON.stringify(answer.data);this.onload();};return;}if(answer.error)return this[answer.error]();this.status=answer.status;this.responseText=answer.raw===undefined?JSON.stringify(answer.data):answer.raw;this.onload();});};
 const localStorage={getItem:key=>saved[key]||null,setItem(key,value){if(options.noStorage)throw Error('denied');saved[key]=value;},removeItem:key=>delete saved[key]};
 const context=vm.createContext({window,document,location:{origin:'https://invella.ru',hostname:'invella.ru',pathname:'/',search:'?delivery=small'},XMLHttpRequest:XHR,localStorage,Promise,Number,Date,encodeURIComponent,setTimeout:()=>0});
 vm.runInContext(source,context);
 nodes.authEmail.value='fixture@example.invalid';nodes.authPassword.value='fixture-password';
 return{window,nodes,calls,saved,reports,events,localStorage,context,statusText};
}
(async()=>{
 const r=runtime();assert.equal(r.window.supabase,undefined);await r.window.submitAuth();
 assert.equal(r.calls.length,1);assert.equal(r.calls[0].url,'/sb/auth/v1/token?grant_type=password');assert.equal(r.calls[0].headers.apikey.startsWith('sb_publishable_'),true);
 assert.equal(r.window.invellaEarlyAuthenticated,true);assert.equal(r.nodes.authPassword.value,'');assert.match(r.nodes.authMessage.textContent,/Вход выполнен/);
 const stored=JSON.parse(r.saved['sb-invella-auth-token']);assert.equal(stored.user.id,session.user.id);assert.ok(stored.expires_at>Date.now()/1000);assert.equal('password'in stored,false);assert.equal(JSON.stringify(r.saved).includes('fixture-password'),false);
 // Use the project's real pinned SDK to prove the early session is readable, with no second login request.
 const sdk=createClient('https://invella.ru/sb','sb_publishable_fixture',{auth:{storage:r.localStorage,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:()=>{throw Error('Unexpected network request')}}});
 const found=await sdk.auth.getSession();assert.equal(found.error,null);assert.equal(found.data.session.user.id,session.user.id);await sdk.auth.stopAutoRefresh();
 const noStorage=runtime([],{noStorage:true});await noStorage.window.submitAuth();assert.equal(noStorage.window.invellaPendingSession.user.id,session.user.id,'Keep the session in memory for SDK handoff when storage is unavailable');
 const failedEditor=runtime(),originalSubmit=failedEditor.window.submitAuth;
 const shell=fs.readFileSync(path.join(__dirname,'../assets/invella-shell.js'),'utf8').replace('__INVELLA_BOOT_CONFIG__',JSON.stringify({build:'0123456789abcdef',page:'main',assets:{sdk:'/supabase.min.js'}}));
 vm.runInContext(shell,failedEditor.context);await failedEditor.window.invellaRetryBoot();assert.equal(failedEditor.window.invellaReady,undefined);assert.equal(failedEditor.window.submitAuth,originalSubmit,'A failed editor must leave standalone sign-in active');assert.match(failedEditor.statusText.textContent,/sdk\/http\/503/);await failedEditor.window.submitAuth();assert.equal(failedEditor.window.invellaEarlyAuthenticated,true);assert.match(failedEditor.nodes.authMessage.textContent,/Вход выполнен/);
 const wrong=runtime([{status:400,data:{error_code:'invalid_credentials',msg:'Invalid login credentials'}}]);await wrong.window.submitAuth();assert.match(wrong.nodes.authMessage.textContent,/Неверный/);assert.equal(wrong.calls.length,1,'Do not retry rejected credentials');assert.equal(wrong.window.invellaEarlyAuthenticated,undefined);assert.equal(wrong.reports[0].code,400);assert.equal(JSON.stringify(wrong.reports).includes('fixture'),false);
 const fallback=runtime([{error:'ontimeout'},{status:200,data:session}]);await fallback.window.submitAuth();assert.equal(fallback.calls.length,2);assert.equal(fallback.calls[1].url,'https://lwanymjmbcstvggmhevx.supabase.co/auth/v1/token?grant_type=password');
 const blocked=runtime([{error:'onerror'},{error:'ontimeout'}]);await blocked.window.submitAuth();assert.match(blocked.nodes.authMessage.textContent,/auth\/timeout/);assert.equal(blocked.nodes.authSubmit.disabled,false);assert.equal(blocked.window.invellaAuthPending,null);
 const malformed=runtime([{status:200,raw:'<html>broken</html>'}]);await malformed.window.submitAuth();assert.match(malformed.nodes.authMessage.textContent,/auth\/format\/200/);assert.equal(malformed.window.invellaEarlyAuthenticated,undefined);
 const duplicateOptions={},duplicate=runtime([{status:200,data:session,delay:true}],duplicateOptions);const one=duplicate.window.submitAuth(),two=duplicate.window.submitAuth();assert.equal(one,two);await Promise.resolve();await Promise.resolve();assert.equal(duplicate.calls.length,1);duplicateOptions.release();await one;
 const signup=runtime([{status:200,data:{id:session.user.id}}]);signup.window.setAuthMode('signup');signup.nodes.authPasswordConfirm.value='different';await signup.window.submitAuth();assert.equal(signup.calls.length,0);signup.nodes.authPasswordConfirm.value='fixture-password';await signup.window.submitAuth();assert.match(signup.calls[0].url,/^\/sb\/auth\/v1\/signup\?redirect_to=/);assert.match(signup.nodes.authMessage.textContent,/подтвердите email/);assert.equal(signup.window.invellaEarlyAuthenticated,undefined);
 const recovery=runtime([{status:200,data:{}}]);recovery.nodes.authPassword.value='';await recovery.window.forgotPassword();assert.match(recovery.calls[0].url,/^\/sb\/auth\/v1\/recover\?redirect_to=/);assert.deepEqual(Object.keys(recovery.calls[0].body),['email']);assert.match(recovery.nodes.authMessage.textContent,/письмо/);
 const empty=runtime();empty.nodes.authEmail.value='';await empty.window.submitAuth();await empty.window.forgotPassword();assert.equal(empty.calls.length,0);
 console.log('PASS: sign-in without SDK/editor, real SDK session handoff, invalid credentials, bounded network fallback, no password storage/logging, signup/recovery and duplicate submission');
})().catch(error=>{console.error(error);process.exitCode=1});
