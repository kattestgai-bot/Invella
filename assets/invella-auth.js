(function () {
  'use strict';
  // The sign-in form must not wait for the editor, media code, or the SDK.
  var key = 'sb_publishable_EY50r1gV7v1zyD9vBgrteA_JVcOg4_J';
  var direct = 'https://lwanymjmbcstvggmhevx.supabase.co/auth/v1';
  var pending = null;
  function node(id) { return document.getElementById(id); }
  function message(text, ok) { var el=node('authMessage');if(el){el.className='auth-message '+(ok?'ok':'error');el.textContent=text;} }
  function failure(kind, status, data) { var e=new Error(kind);e.reason=kind;e.status=status||0;e.data=data||{};return e; }
  function request(path, body, base) {
    return new Promise(function(resolve,reject){
      var xhr=new XMLHttpRequest();xhr.open('POST',(base||'/sb/auth/v1')+path,true);xhr.timeout=12000;
      xhr.setRequestHeader('Content-Type','application/json');xhr.setRequestHeader('apikey',key);
      xhr.onload=function(){var data;try{data=JSON.parse(xhr.responseText||'{}');}catch(e){reject(failure('format',xhr.status));return;}
        if(xhr.status>=200&&xhr.status<300)resolve(data);else reject(failure('http',xhr.status,data));};
      xhr.onerror=function(){reject(failure('network'));};xhr.ontimeout=function(){reject(failure('timeout'));};xhr.onabort=function(){reject(failure('aborted'));};
      xhr.send(JSON.stringify(body));
    });
  }
  function errorText(error) {
    var data=error.data||{},code=data.error_code||data.code||'',text=String(data.msg||data.message||data.error_description||'');
    if(code==='invalid_credentials'||/Invalid login credentials/i.test(text))return 'Неверный email или пароль.';
    if(code==='email_not_confirmed'||/Email not confirmed/i.test(text))return 'Подтвердите email по ссылке из письма.';
    if(code==='user_already_exists'||/already registered/i.test(text))return 'Этот email уже зарегистрирован. Войдите или восстановите пароль.';
    if(error.status===429||/rate limit|too many|security purposes/i.test(text))return 'Слишком много попыток. Подождите немного и повторите.';
    return 'Не удалось связаться с сервером входа. Код: auth/'+error.reason+(error.status?'/'+error.status:'')+'.';
  }
  function storeSession(data) {
    if(!data||typeof data.access_token!=='string'||!data.access_token||typeof data.refresh_token!=='string'||!data.refresh_token||!data.user||typeof data.user.id!=='string'||!Number.isFinite(Number(data.expires_in))||Number(data.expires_in)<=0)throw failure('session');
    var session={access_token:data.access_token,refresh_token:data.refresh_token,token_type:data.token_type||'bearer',expires_in:Number(data.expires_in),expires_at:Number(data.expires_at)||Math.floor(Date.now()/1000)+Number(data.expires_in),user:data.user};
    window.invellaPendingSession=session;
    // This is the existing SDK's storage key and session shape, not a second account store.
    try{localStorage.setItem('sb-'+location.hostname.split('.')[0]+'-auth-token',JSON.stringify(session));}catch(e){}
    window.invellaEarlyAuthenticated=true;
    if(node('authPassword'))node('authPassword').value='';if(node('authPasswordConfirm'))node('authPasswordConfirm').value='';
    message('Вход выполнен. Загружаем личный кабинет…',true);
  }
  function run(button, operation) {
    if(pending)return pending;
    window.invellaEarlyAuthActive=true;button.disabled=true;button.textContent='Подождите…';
    pending=Promise.resolve().then(operation).catch(function(error){
      message(errorText(error),false);
      if(window.invellaEarlyReport)window.invellaEarlyReport('auth-failed','',{asset:'auth',reason:error.reason||'unknown',code:error.status||0});
    }).then(function(){
      button.disabled=false;button.textContent=button.id==='forgotPasswordBtn'?'Забыли пароль?':window.invellaPendingAuthMode==='signup'?'Создать аккаунт':'Войти';
      window.invellaEarlyAuthActive=false;pending=null;window.invellaAuthPending=null;
    });
    window.invellaAuthPending=pending;return pending;
  }
  window.setAuthMode=function(mode){
    var signup=mode==='signup';window.invellaPendingAuthMode=signup?'signup':'login';
    if(!node('authModal'))return;
    node('authTitle').textContent=signup?'Регистрация':'Войти';node('authSubmit').textContent=signup?'Создать аккаунт':'Войти';
    node('loginTab').className=signup?'ghost':'primary';node('signupTab').className=signup?'primary':'ghost';
    node('authPassword').autocomplete=signup?'new-password':'current-password';
    node('confirmPasswordWrap').classList.toggle('hidden',!signup);node('passwordTips').classList.toggle('hidden',!signup);node('forgotPasswordBtn').classList.toggle('hidden',signup);
    if(!pending)message('',false);
  };
  window.submitAuth=function(){
    if(pending)return pending;
    var email=node('authEmail').value.trim(),password=node('authPassword').value,signup=window.invellaPendingAuthMode==='signup';
    if(!email||!password){message('Введите email и пароль.',false);return;}
    if(signup&&password.length<8){message('Пароль должен содержать минимум 8 символов.',false);return;}
    if(signup&&password!==node('authPasswordConfirm').value){message('Пароли не совпадают.',false);return;}
    return run(node('authSubmit'),function(){
      var body={email:email,password:password};
      var task=signup?request('/signup?redirect_to='+encodeURIComponent(location.origin+location.pathname),body):request('/token?grant_type=password',body).catch(function(error){
        if(error.reason!=='network'&&error.reason!=='timeout')throw error;return request('/token?grant_type=password',body,direct);
      });
      return task.then(function(data){if(data.access_token)storeSession(data);else if(signup)message('Готово! Откройте письмо от Invella и подтвердите email.',true);else throw failure('session');});
    });
  };
  window.forgotPassword=function(){
    if(pending)return pending;
    var email=node('authEmail').value.trim();if(!email){message('Введите email, на который зарегистрирован аккаунт.',false);return;}
    return run(node('forgotPasswordBtn'),function(){return request('/recover?redirect_to='+encodeURIComponent(location.origin+'/?reset=password'),{email:email}).then(function(){message('Отправили письмо для восстановления пароля. Проверьте почту.',true);});});
  };
  document.addEventListener('keydown',function(event){if(event.key==='Enter'&&event.target&&/^auth(?:Email|Password|PasswordConfirm)$/.test(event.target.id)){event.preventDefault();window.submitAuth();}});
  window.invellaStandaloneAuth=true;
})();
