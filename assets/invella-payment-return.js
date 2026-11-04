(function(){
  'use strict';
  var running=false,seen=Object.create(null);
  function $(id){return document.getElementById(id);}
  function read(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch(error){return null;}}
  function completed(session){try{var saved=JSON.parse(sessionStorage.getItem('invella_completed_payment')||'null');return saved&&session&&session.user&&saved.ownerId===session.user.id&&Number.isFinite(saved.at)&&Date.now()-saved.at>=0&&Date.now()-saved.at<86400000?saved:null;}catch(error){return null;}}
  function confirmed(pending,session){
    try{sessionStorage.setItem('invella_completed_payment',JSON.stringify({paymentId:pending.paymentId,ownerId:session.user&&session.user.id,at:Date.now()}));}catch(error){}
    try{var latest=read('invella_pending_payment');if(latest&&latest.paymentId===pending.paymentId)localStorage.removeItem('invella_pending_payment');}catch(error){}
  }
  function trackPaid(pending,data){try{var key='invella_payment_seen_'+pending.paymentId;if(!seen[key]&&typeof window.ym==='function'&&!localStorage.getItem(key)){var plan=data.plan==='extended'?'pro':data.plan;window.ym(112266204,'reachGoal','payment_success',{plan:['basic','pro','premium'].indexOf(plan)>=0?plan:''});seen[key]=true;localStorage.setItem(key,'1');}}catch(error){}}
  function show(state,title,message,retry){$('paymentState').setAttribute('data-state',state);$('paymentTitle').textContent=title;$('paymentMessage').textContent=message;$('retryPayment').hidden=!retry;$('openInvitation').hidden=true;}
  function end(state,title,message,retry){running=false;$('retryPayment').disabled=false;show(state,title,message,retry);}
  function check(){
    if(running)return;
    var session=read('sb-'+location.hostname.split('.')[0]+'-auth-token'),pending=read('invella_pending_payment')||completed(session);
    if(!session||typeof session.access_token!=='string'||!session.access_token){end('account','Войдите в свой аккаунт','Откройте «Мои приглашения» и войдите в аккаунт, из которого оплачивали заказ. Там можно проверить доступ к приглашению.',false);return;}
    if(!pending||typeof pending.paymentId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(pending.paymentId)){end('account','Проверьте «Мои приглашения»','На этом устройстве не найдены данные незавершённой проверки. Статус приглашения доступен в вашем аккаунте.',false);return;}
    running=true;$('retryPayment').disabled=true;show('checking','Проверяем оплату','Ожидаем подтверждение от платёжного сервиса. Повторно оплачивать заказ сейчас не нужно.',false);
    var started=Date.now();
    function attempt(index){
      var remaining=20000-(Date.now()-started);if(remaining<=0){finishPending();return;}
      var xhr=new XMLHttpRequest();xhr.open('POST','/api/payment-status',true);xhr.timeout=Math.min(8000,remaining);
      xhr.setRequestHeader('Content-Type','application/json');xhr.setRequestHeader('Authorization','Bearer '+session.access_token);
      xhr.onload=function(){
        if(xhr.status===401){end('account','Войдите, чтобы проверить оплату','Сессия завершилась. Откройте «Мои приглашения» и войдите в тот же аккаунт.',false);return;}
        if(xhr.status===403){end('account','Проверьте аккаунт','Этот платёж недоступен в текущем аккаунте. Откройте «Мои приглашения» в аккаунте, из которого оплачивали заказ.',false);return;}
        if(xhr.status<200||xhr.status>=300){failed('payment/http/'+xhr.status);return;}
        var data;try{data=JSON.parse(xhr.responseText);}catch(error){failed('payment/format');return;}
        if(!data||data.paymentId!==pending.paymentId){failed('payment/response');return;}
        if(data.paid===true&&data.status==='succeeded'){
          trackPaid(pending,data);
          if(data.published===true){
            end('confirmed','Оплата подтверждена','Ваше приглашение опубликовано. Теперь проверьте его и отправьте ссылку гостям.',false);
            if(typeof data.slug==='string'&&/^[a-z0-9-]{3,63}$/.test(data.slug)){$('openInvitation').href='/i/'+data.slug;$('openInvitation').hidden=false;}
            confirmed(pending,session);
            return;
          }
          if(data.invitationStatus==='disabled'||data.invitationStatus==='completed'){end('support','Оплата подтверждена, публикация недоступна','Доступ к публикации отключён. Напишите в поддержку, чтобы мы проверили приглашение.',false);return;}
          if(index<4&&Date.now()-started<18000){setTimeout(function(){attempt(index+1);},1500);return;}
          end('pending','Оплата подтверждена','Публикация ещё завершается. Проверьте «Мои приглашения» или повторите проверку немного позже.',true);return;
        }
        if(data.status==='canceled'){end('canceled','Оплата не завершена','Платёж отменён. Откройте приглашение в личном кабинете - при необходимости оплату можно начать заново.',false);return;}
        if(data.status==='pending'||data.status==='waiting_for_capture'){
          if(index<4&&Date.now()-started<18000){setTimeout(function(){attempt(index+1);},1500);return;}
          finishPending();return;
        }
        failed('payment/status');
      };
      xhr.onerror=function(){failed('payment/network');};xhr.ontimeout=function(){failed('payment/timeout');};
      xhr.send(JSON.stringify({paymentId:pending.paymentId}));
    }
    function finishPending(){end('pending','Подтверждение ещё ожидается','Проверьте статус в «Моих приглашениях» или повторите проверку позже. Если вы уже оплатили заказ, не оплачивайте его повторно до уточнения статуса.',true);}
    function failed(code){end('error','Не удалось проверить оплату','Откройте «Мои приглашения» или повторите проверку. Если вы уже оплатили заказ, повторная оплата пока не требуется. Код: '+code+'.',true);}
    attempt(0);
  }
  $('retryPayment').onclick=check;
  check();
})();
