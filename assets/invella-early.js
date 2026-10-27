(function () {
  'use strict';
  var build = '__INVELLA_BUILD__', seen = {};
  function node(id) { return document.getElementById(id); }
  function report(stage, action, detail) {
    try {
      var r = new XMLHttpRequest(); r.open('POST', '/api/connection-report', true); r.timeout = 5000;
      r.setRequestHeader('Content-Type', 'application/json');
      r.send(JSON.stringify({phase:'shell',stage:stage,build:build,action:action||'',code:detail&&detail.code||0,asset:detail&&detail.asset||'',reason:detail&&detail.reason||'',state:document.readyState,
        shell:!!node('invellaShellReady'),small:false,modules:[!!node('invellaCriticalStyles'),!!(window.supabase&&window.supabase.createClient),window.invellaReady===true,window.invellaPremiumReady===true]}));
    } catch (e) {}
  }
  window.invellaEarlyReport = report;
  window.openAuth = function () { if(node('authModal')) { node('authModal').classList.remove('hidden'); document.body.style.overflow='hidden'; } };
  window.closeAuth = function () { if(node('authModal'))node('authModal').classList.add('hidden');document.body.style.overflow=''; };
  window.openTemplates = function () { if(node('templates'))node('templates').scrollIntoView(); };
  document.addEventListener('click',function(event){
    var el=event.target;
    while(el&&el!==document&&!el.getAttribute('data-shell'))el=el.parentNode;
    if(!el||el===document)return;
    var name=el.getAttribute('data-shell');
    if(!/^(openAuth|closeAuth|openTemplates|chooseTemplate|setAuthMode|togglePassword|submitAuth|forgotPassword|login)$/.test(name))return;
    if(typeof window[name]!=='function')return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!seen[name]){seen[name]=true;report('click',name);}
    if(name==='chooseTemplate'&&window.invellaInitialization){var value=el.getAttribute('data-value');window.invellaInitialization.then(function(){window[name](value);});}
    else if(name==='togglePassword')window[name](el.getAttribute('data-value'),el);
    else if(name==='chooseTemplate'||name==='setAuthMode')window[name](el.getAttribute('data-value'));
    else window[name]();
  },true);
  window.addEventListener('error',function(){report('script-error');});
  report('early');setTimeout(function(){if(!window.invellaReady&&!window.invellaAdminReady)report('waiting');},5000);
})();
