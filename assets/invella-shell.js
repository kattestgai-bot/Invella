(function () {
  'use strict';
  var config = __INVELLA_BOOT_CONFIG__, running, ready = false, cache = {}, last = 'head';
  window.invellaSmallDelivery=location.search.indexOf('delivery=small')!==-1;
  function $(id) { return document.getElementById(id); }
  function notice(text, failed) {
    var box = $('invellaBootStatus');
    if (box) { box.hidden = !text; box.querySelector('span').textContent = text || ''; box.querySelector('button').hidden = !failed; }
    if ($('authMessage') && !ready) $('authMessage').textContent = text || '';
  }
  function xhr(url, method, body, timeout) {
    return new Promise(function (resolve, reject) {
      var request = new XMLHttpRequest();
      request.open(method, url, true); request.timeout = timeout;
      if (body) request.setRequestHeader('Content-Type', 'application/json');
      request.onload = function () { if (request.status >= 200 && request.status < 300) resolve(request.responseText); else { var e = new Error('HTTP ' + request.status); e.status = request.status; reject(e); } };
      request.onerror = function () { reject(new Error('network')); };
      request.ontimeout = function () { reject(new Error('timeout')); };
      request.send(body ? JSON.stringify(body) : null);
    });
  }
  function report(stage, code) {
    try { xhr('/api/connection-report', 'POST', { phase: 'shell', stage: stage, build: config.build, code: code || 0,
      modules: [!!$('invellaCriticalStyles'), !!(window.supabase && window.supabase.createClient), window.invellaReady === true, window.invellaPremiumReady === true],
      shell: !!$('invellaShellReady'), state: document.readyState, small: last === 'small' }, 5000).catch(function () {}); } catch (e) {}
  }
  function mode(value) {
    var signup = value === 'signup'; window.invellaPendingAuthMode = value;
    if (!$('authModal')) return;
    $('authTitle').textContent = signup ? 'Регистрация' : 'Войти';
    $('authSubmit').textContent = signup ? 'Создать аккаунт' : 'Войти';
    $('loginTab').className = signup ? 'ghost' : 'primary'; $('signupTab').className = signup ? 'primary' : 'ghost';
    $('confirmPasswordWrap').classList.toggle('hidden', !signup); $('passwordTips').classList.toggle('hidden', !signup); $('forgotPasswordBtn').classList.toggle('hidden', signup);
  }
  window.openAuth = function () { mode('login'); $('authModal').classList.remove('hidden'); document.body.style.overflow = 'hidden'; };
  window.closeAuth = function () { $('authModal').classList.add('hidden'); document.body.style.overflow = ''; };
  window.setAuthMode = mode;
  window.togglePassword = function (id, button) { var input = $(id); input.type = input.type === 'password' ? 'text' : 'password'; button.textContent = input.type === 'password' ? '◉' : '◌'; };
  window.openTemplates = function () { history.pushState({}, '', '/create/design'); $('templates').scrollIntoView({ block: 'start' }); };
  function deferred(name) { var fallback = function () { var args = arguments; notice('Загружаем редактор…', false); return boot().then(function () { return name==='chooseTemplate'&&window.invellaInitialization ? window.invellaInitialization : null; }).then(function () { var fn = window[name]; if (fn === fallback) throw new Error('handler'); return fn.apply(window, args); }); }; return fallback; }
  window.chooseTemplate = deferred('chooseTemplate');
  window.submitAuth = function () { if (!$('authEmail').value.trim() || !$('authPassword').value) { $('authMessage').textContent = 'Введите email и пароль.'; return; } return deferred('submitAuth')(); };
  window.login = function () { var email=$('email'),password=$('password'); if(email&&password&&(!email.value.trim()||!password.value)){if($('loginMessage'))$('loginMessage').textContent='Введите email и пароль';return}return deferred('login')(); };
  window.forgotPassword = function () { if (!$('authEmail').value.trim()) { $('authMessage').textContent = 'Введите email, на который зарегистрирован аккаунт.'; return; } return deferred('forgotPassword')(); };
  async function tiny(key) {
    var started=Date.now();
    var encoding = typeof DecompressionStream === 'function' ? 'gzip' : 'identity';
    var first = JSON.parse(await xhr('/api/startup-assets', 'POST', { asset: key, offset: 0, protocol: 2, encoding: encoding, build: config.build }, 8000));
    if (!Number.isInteger(first.total) || first.total < 1 || first.total > 1048576 || !/^[a-f0-9]{64}$/.test(first.sha256)) throw new Error('metadata');
    var bytes = new Uint8Array(first.total), next=384;
    function accept(part,offset) {
      if(part.asset!==key||part.offset!==offset||part.total!==first.total||part.sha256!==first.sha256||part.encoding!==encoding||part.build!==config.build||part.bytes!==Math.min(384,first.total-offset)||typeof part.data!=='string'||part.data.length>512)throw new Error('chunk');
      var binary=atob(part.data);if(binary.length!==part.bytes)throw new Error('length');for(var i=0;i<binary.length;i++)bytes[offset+i]=binary.charCodeAt(i);
    }
    accept(first,0);
    async function worker(){while(next<bytes.length){if(Date.now()-started>45000)throw new Error('deadline');var offset=next;next+=384;
      accept(JSON.parse(await xhr('/api/startup-assets','POST',{asset:key,offset:offset,protocol:2,encoding:encoding,build:config.build},8000)),offset);
    }}
    await Promise.all([worker(),worker(),worker(),worker()]);
    if (window.crypto && window.crypto.subtle) {
      var digest = await window.crypto.subtle.digest('SHA-256', bytes), actual = Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      if (actual !== first.sha256) throw new Error('integrity');
    }
    if (encoding === 'gzip') return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  async function asset(key) {
    if (cache[key]) return cache[key];
    var text;
    if (!window.invellaSmallDelivery) {
      try { text = await xhr(config.assets[key] + '?v=' + config.build, 'GET', null, 1800); if (!text || /^\s*</.test(text) && key !== 'fragment') throw new Error('body'); } catch (e) {}
    }
    if (!text) { last = 'small'; window.invellaSmallDelivery=true; text = await tiny(key); }
    cache[key] = text; return text;
  }
  function execute(text, id) { var el = document.createElement('script'); el.id = id; el.textContent = text; document.head.appendChild(el); }
  function shell() { return new Promise(function (resolve,reject) { if ($('invellaShellReady')) return resolve();var started=Date.now(); var timer = setInterval(function () { if ($('invellaShellReady')) { clearInterval(timer); resolve(); }else if(Date.now()-started>20000){clearInterval(timer);reject(new Error('incomplete page'));} }, 25); }); }
  function boot() {
    if (ready) return Promise.resolve(); if (running) return running;
    running = (async function () {
      report('start');
      try {
        var keys = Object.keys(config.assets), result = await Promise.all(keys.map(async function (key) { return { key: key, text: await asset(key) }; })), texts = {};
        result.forEach(function (r) { texts[r.key] = r.text; }); await shell();
        if (config.page === 'main' && !$('app')) { var holder = document.createElement('div'); holder.innerHTML = texts.fragment; while (holder.firstChild) document.body.insertBefore(holder.firstChild, $('authModal')); }
        if (texts.styles && !$('invellaLoadedStyles')) { var style = document.createElement('style'); style.id = 'invellaLoadedStyles'; style.textContent = texts.styles; document.head.appendChild(style); }
        if (!window.supabase) execute(texts.sdk, 'invellaSdk');
        if (!window.supabase || !window.supabase.createClient) throw new Error('sdk');
        if (!window.invellaFetch) execute(texts.network, 'invellaNetwork');
        if(config.page==='admin'){if(!window.invellaAdminReady)execute(texts.admin,'invellaAdmin');if(!window.invellaAdminReady)throw new Error('admin');ready=true;notice('',false);report('ready');return;}
        if (!window.invellaReady) execute(texts.app, 'invellaApp');
        if (!window.invellaReady) throw new Error('app');
        if (!window.invellaPremiumReady) execute(texts.premium, 'invellaEditor');
        if (!window.invellaPremiumReady) throw new Error('editor');
        ready = true; if (window.invellaPendingAuthMode) window.setAuthMode(window.invellaPendingAuthMode); notice('', false); report('ready');
      } catch (error) { notice('Не удалось завершить загрузку. Нажмите «Повторить».', true); report('failed', error.status); throw error; }
      finally { running = null; }
    })(); return running;
  }
  if(config.page==='admin')document.addEventListener('DOMContentLoaded',function(){if(!window.invellaAdminReady){if($('loading'))$('loading').classList.add('hidden');if($('loginBox'))$('loginBox').classList.remove('hidden')}});
  window.invellaRetryBoot = function () { return boot().catch(function () {}); };
  window.addEventListener('error', function () { report('script-error'); });
  report('head'); setTimeout(function () { if (!ready) report('waiting'); }, 5000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.invellaRetryBoot); else window.invellaRetryBoot();
})();
