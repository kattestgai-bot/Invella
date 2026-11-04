const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/invella-app.js'),'utf8');
const helper=source.slice(source.indexOf('async function openRequestedDashboard()'),source.indexOf('function restoreRouteView()'));
(async()=>{
 const visits=[],context=vm.createContext({window:{openDashboard:async()=>visits.push('dashboard')},currentUser:null,openAuth:()=>visits.push('login'),URLSearchParams,location:{search:'?account=1&keep=value',pathname:'/',hash:'#details'},history:{replaceState(_state,_title,value){visits.push(value);}}});
 vm.runInContext(helper,context);await context.openRequestedDashboard();assert.deepEqual(visits,['login']);context.currentUser={id:'fixture-owner'};await context.openRequestedDashboard();assert.deepEqual(visits,['login','/?keep=value#details','dashboard']);
 const schedule=source.slice(source.indexOf('function scheduleCloudSave()'),source.indexOf('async function compressImage('));
 for(const [hidden,publicPage,user,expected]of [[true,false,true,0],[false,true,true,0],[false,false,false,0],[false,false,true,1]]){
  const timers=[],ctx=vm.createContext({cloudTimer:null,editorTransition:false,cloudReady:true,currentUser:user?{id:'fixture-owner'}:null,window:{},$:()=>({classList:{contains:()=>hidden}}),isPublicPath:()=>publicPage,clearTimeout(){},setTimeout:fn=>timers.push(fn),cloudSave(){}});vm.runInContext(schedule+';scheduleCloudSave();',ctx);assert.equal(timers.length,expected,'Signing in on the landing/account page must not create a blank draft');
 }
 console.log('PASS: account links wait for sign-in and open the dashboard, other URL state preserved, no blank draft outside the editor');
})().catch(error=>{console.error(error);process.exitCode=1;});
