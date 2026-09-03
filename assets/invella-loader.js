(function(){
var parts=["/assets/app-part-01.txt", "/assets/app-part-02.txt", "/assets/app-part-03.txt", "/assets/app-part-04.txt"];
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
async function get(url){var last;for(var i=0;i<6;i++){try{var r=await fetch(url+'?v=4',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);var t=await r.text();if(!t)throw new Error('empty');return t}catch(e){last=e;await sleep(250*(i+1))}}throw last}
(async function(){try{var all=[];for(var i=0;i<parts.length;i++)all.push(await get(parts[i]));(0,eval)(all.join('\n'))}catch(e){console.error('Invella startup failed',e);var d=document.createElement('div');d.style.cssText='position:fixed;z-index:99999;left:12px;right:12px;bottom:12px;padding:12px;background:white;border:1px solid #ddd;border-radius:12px;font:14px Arial';d.innerHTML='Не удалось полностью загрузить сайт. <button onclick="location.reload()">Повторить</button>';document.body.appendChild(d)}})();
})();
