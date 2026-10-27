(function () {
  'use strict';
  var config = __INVELLA_BOOT_CONFIG__, running, ready = false, cache = {}, last = 'head', transfers = [], active = 0;
  window.invellaSmallDelivery=location.search.indexOf('delivery=small')!==-1;
  function $(id) { return document.getElementById(id); }
  function notice(text, failed) {
    var box = $('invellaBootStatus');
    if (box) { box.hidden = !text; box.querySelector('span').textContent = text || ''; box.querySelector('button').hidden = !failed; }
    if ($('authMessage') && !ready && !window.invellaStandaloneAuth) $('authMessage').textContent = text || '';
  }
  function xhr(url, method, body, timeout, scope) {
    return new Promise(function (resolve, reject) {
      if(scope&&scope.cancelled)return reject(new Error('cancelled'));
      var request = new XMLHttpRequest();
      request.open(method, url, true); request.timeout = timeout;
      if(scope)scope.requests.push(request);
      function finish(error){if(scope){var i=scope.requests.indexOf(request);if(i>=0)scope.requests.splice(i,1);}if(error)reject(error);else resolve(request.responseText);}
      if (body) request.setRequestHeader('Content-Type', 'application/json');
      request.onload = function () { if (request.status >= 200 && request.status < 300) finish(); else { var e = new Error('http'); e.status = request.status; finish(e); } };
      request.onerror = function () { finish(new Error('network')); };
      request.ontimeout = function () { finish(new Error('timeout')); };
      request.onabort = function () { finish(new Error('cancelled')); };
      request.send(body ? JSON.stringify(body) : null);
    });
  }
  function report(stage, error) {
    try { xhr('/api/connection-report', 'POST', { phase: 'shell', stage: stage, build: config.build, code: error && error.status || 0, asset: error && error.asset || '', reason: error && error.message || '',
      modules: [!!$('invellaCriticalStyles'), !!(window.supabase && window.supabase.createClient), window.invellaReady === true, window.invellaPremiumReady === true],
      shell: !!$('invellaShellReady'), state: document.readyState, small: last === 'small' }, 5000).catch(function () {}); } catch (e) {}
  }
  function deferred(name) { var fallback = function () { var args = arguments; notice('Загружаем редактор…', false); return boot().then(function () { return name==='chooseTemplate'&&window.invellaInitialization ? window.invellaInitialization : null; }).then(function () { var fn = window[name]; if (fn === fallback) throw new Error('handler'); return fn.apply(window, args); }); }; return fallback; }
  if(config.page==='main'){
    window.openAuth = function () { window.setAuthMode('login'); $('authModal').classList.remove('hidden'); document.body.style.overflow = 'hidden'; };
    window.closeAuth = function () { $('authModal').classList.add('hidden'); document.body.style.overflow = ''; };
    window.togglePassword = function (id, button) { var input = $(id); input.type = input.type === 'password' ? 'text' : 'password'; button.textContent = input.type === 'password' ? '◉' : '◌'; };
    window.openTemplates = function () { history.pushState({}, '', '/create/design'); $('templates').scrollIntoView({ block: 'start' }); };
    window.chooseTemplate = deferred('chooseTemplate');
  }else window.login = function () { var email=$('email'),password=$('password'); if(email&&password&&(!email.value.trim()||!password.value)){if($('loginMessage'))$('loginMessage').textContent='Введите email и пароль';return}return deferred('login')(); };
  function part(body,scope){
    return new Promise(function(resolve,reject){
      transfers.push(function(){
        if(scope.cancelled)return Promise.reject(new Error('cancelled'));
        var task;
        if(config.mirror){var query=Object.keys(body).filter(function(k){return k!=='protocol';}).map(function(k){return k+'='+encodeURIComponent(body[k]);}).join('&');
          task=xhr(config.mirror+'?key='+encodeURIComponent(config.mirrorKey)+'&'+query,'GET',null,12000,scope).then(function(text){window.invellaDirectBackend=true;return text;}).catch(function(error){if(scope.cancelled)throw error;if(error.status===409)config.mirror='';return xhr('/api/startup-assets','POST',body,12000,scope);});
        }else task=xhr('/api/startup-assets','POST',body,12000,scope);
        return task.then(JSON.parse);
      });transfers[transfers.length-1].resolve=resolve;transfers[transfers.length-1].reject=reject;pump();
    });
  }
  function pump(){while(active<2&&transfers.length){active++;(function(job){job().then(job.resolve,job.reject).then(function(){active--;pump();});})(transfers.shift());}}
  async function tiny(key,scope) {
    var started=Date.now();
    var encoding = typeof DecompressionStream === 'function' ? 'gzip' : 'identity';
    // Compressed 4 KiB chunks keep replies below 6 KiB without hundreds of round trips.
    var size=4096;
    var first = await part({ asset: key, offset: 0, protocol: 2, encoding: encoding, chunkSize:size, build: config.build },scope);
    if (!Number.isInteger(first.total) || first.total < 1 || first.total > 1048576 || !/^[a-f0-9]{64}$/.test(first.sha256)) throw new Error('metadata');
    var bytes = new Uint8Array(first.total), next=size;
    function accept(part,offset) {
      if(part.asset!==key||part.offset!==offset||part.total!==first.total||part.sha256!==first.sha256||part.encoding!==encoding||part.build!==config.build||part.bytes!==Math.min(size,first.total-offset)||typeof part.data!=='string'||part.data.length>Math.ceil(size/3)*4)throw new Error('chunk');
      var binary=atob(part.data);if(binary.length!==part.bytes)throw new Error('length');for(var i=0;i<binary.length;i++)bytes[offset+i]=binary.charCodeAt(i);
    }
    accept(first,0);
    async function worker(){while(next<bytes.length){if(Date.now()-started>45000)throw new Error('deadline');var offset=next;next+=size;
      accept(await part({asset:key,offset:offset,protocol:2,encoding:encoding,chunkSize:size,build:config.build},scope),offset);
    }}
    await Promise.all([worker(),worker(),worker(),worker()]);
    if (window.crypto && window.crypto.subtle) {
      var digest = await window.crypto.subtle.digest('SHA-256', bytes), actual = Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      if (actual !== first.sha256) throw new Error('integrity');
    }
    if (encoding === 'gzip') return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  async function asset(key,scope) {
    if (cache[key]) return cache[key];
    var text;
    if (!window.invellaSmallDelivery) {
      try { text = await xhr(config.assets[key] + '?v=' + config.build, 'GET', null, 1800,scope); if (!text || /^\s*</.test(text) && key !== 'fragment') throw new Error('body'); } catch (e) {}
    }
    if (!text) { last = 'small'; window.invellaSmallDelivery=true;try{text = await tiny(key,scope);}catch(error){error.asset=key;throw error;} }
    if(scope.cancelled)throw new Error('cancelled');
    cache[key] = text; return text;
  }
  function execute(text, id) { var el = document.createElement('script'); el.id = id; el.textContent = text; document.head.appendChild(el); }
  function shell() { return new Promise(function (resolve,reject) { if ($('invellaShellReady')) return resolve();var started=Date.now(); var timer = setInterval(function () { if ($('invellaShellReady')) { clearInterval(timer); resolve(); }else if(Date.now()-started>20000){clearInterval(timer);reject(new Error('incomplete page'));} }, 25); }); }
  function boot() {
    if (ready) return Promise.resolve(); if (running) return running;
    running = (async function () {
      var scope={cancelled:false,requests:[]};
      report('start');
      try {
        var keys = Object.keys(config.assets), result = await Promise.all(keys.map(async function (key) { return { key: key, text: await asset(key,scope) }; })), texts = {};
        result.forEach(function (r) { texts[r.key] = r.text; }); await shell();
        if (config.page === 'main' && !$('app')) { var holder = document.createElement('div'); holder.innerHTML = texts.fragment; while (holder.firstChild) document.body.insertBefore(holder.firstChild, $('authModal')); }
        if (texts.styles && !$('invellaLoadedStyles')) { var style = document.createElement('style'); style.id = 'invellaLoadedStyles'; style.textContent = texts.styles; document.head.appendChild(style); }
        if (!window.supabase) execute(texts.sdk, 'invellaSdk');
        if (!window.supabase || !window.supabase.createClient) throw new Error('sdk');
        if (!window.invellaFetch) execute(texts.network, 'invellaNetwork');
        if(config.page==='admin'){if(!window.invellaAdminReady)execute(texts.admin,'invellaAdmin');if(!window.invellaAdminReady)throw new Error('admin');ready=true;notice('',false);report('ready');return;}
        if(window.invellaAuthPending)await window.invellaAuthPending;
        if (!window.invellaReady) execute(texts.app, 'invellaApp');
        if (!window.invellaReady) throw new Error('app');
        if (!window.invellaPremiumReady) execute(texts.premium, 'invellaEditor');
        if (!window.invellaPremiumReady) throw new Error('editor');
        ready = true; if (window.invellaPendingAuthMode) window.setAuthMode(window.invellaPendingAuthMode); notice('', false); report('ready');
      } catch (error) { scope.cancelled=true;scope.requests.slice().forEach(function(request){if(request.abort)request.abort();});var reasons=['http','network','timeout','metadata','chunk','length','deadline','integrity','sdk','app','editor','admin','incomplete page'],reason=reasons.indexOf(error.message)!==-1?error.message:'format';notice('Не удалось загрузить редактор. Код: '+(error.asset||'page')+'/'+reason+(error.status?'/'+error.status:'')+'. Нажмите «Повторить».', true); report('failed', {asset:error.asset,message:reason,status:error.status}); throw error; }
      finally { running = null; }
    })(); return running;
  }
  if(config.page==='admin')document.addEventListener('DOMContentLoaded',function(){if(!window.invellaAdminReady){if($('loading'))$('loading').classList.add('hidden');if($('loginBox'))$('loginBox').classList.remove('hidden')}});
  window.invellaRetryBoot = function () { return boot().catch(function () {}); };
  window.addEventListener('error', function () { report('script-error'); });
  report('head'); setTimeout(function () { if (!ready) report('waiting'); }, 5000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.invellaRetryBoot); else window.invellaRetryBoot();
})();
