(function(){
'use strict';
var SUPABASE_URL='https://lwanymjmbcstvggmhevx.supabase.co';
var SUPABASE_KEY='sb_publishable_EY50r1gV7v1zyD9vBgrteA_JVcOg4_J';
var sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
var currentUser=null,authMode='login',template='classic',currentInvitationId=null,currentInvitationSlug=null,cloudTimer=null,cloudReady=false,currentPublicPlan=null,currentEditorPlan='draft';
var fields=['eventType','customEvent','names','date','time','venue','address','message','p1t','p1','p2t','p2','p3t','p3','dress','wishes','childrenPolicy','backgroundStyle','backgroundCustomUrl','backgroundCustomPath','c1','c2','c3','c4'];
function $(id){return document.getElementById(id)}
function safeGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function safeSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function planRank(p){return {draft:0,basic:1,pro:2,extended:2,premium:3}[String(p||'draft').toLowerCase()]||0}
function editorHas(plan){return planRank(currentEditorPlan)>=planRank(plan)}
function enforceEditorPlan(){var paid=currentEditorPlan&&currentEditorPlan!=='draft';var pro=editorHas('pro'),premium=editorHas('premium');if(paid&&!pro){if($('backgroundStyle'))$('backgroundStyle').value='auto';if($('showRSVP'))$('showRSVP').checked=false}if(paid&&!premium&&$('backgroundStyle')&&$('backgroundStyle').value==='custom')$('backgroundStyle').value=pro?'silk':'auto';document.querySelectorAll('#bgPicker .bg-choice').forEach(function(b){var need=b.dataset.bg==='auto'?'basic':'pro';b.disabled=paid&&!editorHas(need);b.classList.toggle('plan-locked',b.disabled)});if($('customBackgroundFile'))$('customBackgroundFile').disabled=paid&&!premium;if($('photo'))$('photo').disabled=paid&&!pro;if($('guestNamesForLinks'))$('guestNamesForLinks').disabled=paid&&!pro;var gl=$('guestNamesForLinks')&&$('guestNamesForLinks').parentElement&&$('guestNamesForLinks').parentElement.parentElement;if(gl){var b=gl.querySelector('button');if(b)b.disabled=paid&&!pro}if($('showRSVP'))$('showRSVP').disabled=paid&&!pro;}
function updateAuthUI(){var a=$('authBtn'),l=$('logoutBtn'),c=$('userChip'),m=$('myInvitesBtn');if(currentUser){a.classList.add('hidden');l.classList.remove('hidden');m.classList.remove('hidden');c.classList.remove('hidden');c.textContent=currentUser.email||'Аккаунт'}else{a.classList.remove('hidden');l.classList.add('hidden');m.classList.add('hidden');c.classList.add('hidden');c.textContent=''}}
window.openAuth=function(){setAuthMode('login');$('authModal').classList.remove('hidden');document.body.style.overflow='hidden'}
window.closeAuth=function(){$('authModal').classList.add('hidden');document.body.style.overflow=''}
window.togglePassword=function(id,btn){var input=$(id);if(!input)return;var show=input.type==='password';input.type=show?'text':'password';btn.textContent=show?'◌':'◉';btn.setAttribute('aria-label',show?'Скрыть пароль':'Показать пароль')}
window.setAuthMode=function(mode){authMode=mode;var signup=mode==='signup';$('authTitle').textContent=signup?'Регистрация':'Войти';$('authSubmit').textContent=signup?'Создать аккаунт':'Войти';$('loginTab').className=signup?'ghost':'primary';$('signupTab').className=signup?'primary':'ghost';$('authMessage').textContent='';$('authPassword').autocomplete=signup?'new-password':'current-password';$('confirmPasswordWrap').classList.toggle('hidden',!signup);$('passwordTips').classList.toggle('hidden',!signup);$('forgotPasswordBtn').classList.toggle('hidden',signup)}
window.submitAuth=async function(){var email=$('authEmail').value.trim(),password=$('authPassword').value,confirm=$('authPasswordConfirm').value,msg=$('authMessage'),btn=$('authSubmit');msg.className='auth-message';if(!email||!password){msg.className+=' error';msg.textContent='Введите email и пароль.';return}if(password.length<8){msg.className+=' error';msg.textContent='Пароль должен содержать минимум 8 символов.';return}if(authMode==='signup'&&password!==confirm){msg.className+=' error';msg.textContent='Пароли не совпадают.';return}btn.disabled=true;btn.textContent='Подождите…';try{if(authMode==='signup'){var r=await sb.auth.signUp({email:email,password:password,options:{emailRedirectTo:window.location.origin+window.location.pathname}});if(r.error)throw r.error;msg.className+=' ok';msg.textContent=r.data.session?'Аккаунт создан.':'Готово! Откройте письмо от Invella и подтвердите email.';if(r.data.session){currentUser=r.data.user;updateAuthUI();setTimeout(closeAuth,700)}}else{var r2=await sb.auth.signInWithPassword({email:email,password:password});if(r2.error)throw r2.error;currentUser=r2.data.user;updateAuthUI();closeAuth()}}catch(e){msg.className+=' error';msg.textContent=e.message==='Invalid login credentials'?'Неверный email или пароль.':(e.message||'Не удалось выполнить действие.')}finally{btn.disabled=false;btn.textContent=authMode==='signup'?'Создать аккаунт':'Войти'}}
window.forgotPassword=async function(){var email=$('authEmail').value.trim(),msg=$('authMessage');msg.className='auth-message';if(!email){msg.className+=' error';msg.textContent='Введите email, на который зарегистрирован аккаунт.';return}try{var r=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/?reset=password'});if(r.error)throw r.error;msg.className+=' ok';msg.textContent='Отправили письмо для восстановления пароля. Проверьте почту.'}catch(e){msg.className+=' error';msg.textContent=e.message||'Не удалось отправить письмо.'}}
window.saveNewPassword=async function(){var p=$('newPassword').value,c=$('newPasswordConfirm').value,msg=$('resetPasswordMessage'),btn=$('saveNewPasswordBtn');msg.className='auth-message';if(p.length<8){msg.className+=' error';msg.textContent='Пароль должен содержать минимум 8 символов.';return}if(p!==c){msg.className+=' error';msg.textContent='Пароли не совпадают.';return}btn.disabled=true;btn.textContent='Сохраняем…';try{var r=await sb.auth.updateUser({password:p});if(r.error)throw r.error;msg.className+=' ok';msg.textContent='Пароль изменён. Теперь можно входить с новым паролем.';history.replaceState(null,'','/');setTimeout(function(){$('resetPasswordModal').classList.add('hidden');document.body.style.overflow=''},1100)}catch(e){msg.className+=' error';msg.textContent=e.message||'Не удалось изменить пароль.'}finally{btn.disabled=false;btn.textContent='Сохранить новый пароль'}}
function openResetPassword(){if($('resetPasswordModal')){$('resetPasswordModal').classList.remove('hidden');document.body.style.overflow='hidden'}}
window.logout=async function(){await sb.auth.signOut();currentUser=null;updateAuthUI();if(location.pathname!=='/'){history.replaceState(null,'','/');location.reload()}}
async function initAuth(){var r=await sb.auth.getSession();currentUser=r.data.session?r.data.session.user:null;updateAuthUI();sb.auth.onAuthStateChange(function(event,session){currentUser=session?session.user:null;updateAuthUI();if(event==='PASSWORD_RECOVERY'){openResetPassword();return}if(event==='SIGNED_IN'&&window.location.hash.indexOf('access_token')!==-1){history.replaceState(null,'',window.location.pathname)}})}

async function restoreUserCloudState(){
if(!currentUser)return;
var savedId=safeGet('invella_cloud_id_'+currentUser.id);
if(!savedId)return;
try{
var r=await sb.from('invitations').select('*').eq('id',savedId).eq('owner_id',currentUser.id).maybeSingle();
if(r.error||!r.data)return;
currentInvitationId=r.data.id;
currentInvitationSlug=r.data.slug;
currentEditorPlan=String(r.data.plan||'draft').toLowerCase();
template=r.data.template_key||template;
var d=r.data.content&&typeof r.data.content==='object'?r.data.content:{};
fields.forEach(function(k){if($(k)&&d[k]!=null)$(k).value=d[k]});
['showProgram','showVenue','showDress','showWishes','showRSVP'].forEach(function(k){if($(k)&&d[k]!=null)$(k).checked=Boolean(d[k])});
render();
}catch(e){console.error('Invella restore:',e)}
}

function collectData(){var d={};fields.forEach(function(k){if($(k))d[k]=$(k).value});['showProgram','showVenue','showDress','showWishes','showRSVP'].forEach(function(k){if($(k))d[k]=$(k).checked});return d}
function makeSlug(){var base=($('names').value||'invitation').toLowerCase().replace(/[а-яё]/g,function(ch){var m={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};return m[ch]||''}).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,45);if(base.length<3)base='invitation';return base+'-'+Math.random().toString(36).slice(2,7)}
function eventISO(){var d=$('date').value,t=$('time').value||'12:00';return d?new Date(d+'T'+t+':00').toISOString():null}
async function cloudSave(){if(!currentUser)return false;var data=collectData(),payload={owner_id:currentUser.id,title:$('names').value||'Новое приглашение',event_date:eventISO(),venue_name:$('venue').value,venue_address:$('address').value,template_key:template,content:data,design:{colors:[data.c1,data.c2,data.c3,data.c4]}};try{if(currentInvitationId){var u=await sb.from('invitations').update(payload).eq('id',currentInvitationId).eq('owner_id',currentUser.id).select('id,slug').maybeSingle();if(u.error)throw u.error;if(u.data){currentInvitationSlug=u.data.slug;return true}currentInvitationId=null;currentInvitationSlug=null}payload.slug=makeSlug();var r=await sb.from('invitations').insert(payload).select('id,slug').single();if(r.error)throw r.error;currentInvitationId=r.data.id;currentInvitationSlug=r.data.slug;safeSet('invella_cloud_id_'+currentUser.id,r.data.id);safeSet('invella_cloud_slug_'+currentUser.id,r.data.slug);return true}catch(e){console.error('Invella save:',e);return false}}
function scheduleCloudSave(){clearTimeout(cloudTimer);if(!cloudReady||!currentUser)return;cloudTimer=setTimeout(cloudSave,900)}
async function compressImage(file){if(!file||!file.type.startsWith('image/'))return file;try{var bitmap=await createImageBitmap(file),max=1600,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height)),w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(bitmap,0,0,w,h);bitmap.close();var blob=await new Promise(function(resolve){canvas.toBlob(resolve,'image/webp',.82)});return blob?new File([blob],'cover.webp',{type:'image/webp'}):file}catch(e){return file}}
async function uploadCover(file){if(!currentUser||!currentInvitationId||!file)return;var ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=currentUser.id+'/'+currentInvitationId+'/cover-'+Date.now()+'.'+ext;var u=await sb.storage.from('invitation-media').upload(path,file,{upsert:true});if(u.error)return;await sb.from('invitations').update({cover_url:path}).eq('id',currentInvitationId)}
window.openDashboard=async function(){if(!currentUser)return openAuth();$('dashboardModal').classList.remove('hidden');document.body.style.overflow='hidden';var box=$('dashboardList');box.innerHTML='<p class="sub">Загрузка…</p>';var r=await sb.from('invitations').select('id,title,slug,status,plan,preview_published,updated_at').order('updated_at',{ascending:false});if(r.error){box.textContent='Не удалось загрузить приглашения.';return}if(!r.data.length){box.innerHTML='<p class="sub">У вас пока нет сохранённых приглашений.</p>';return}box.innerHTML=r.data.map(function(x){var openBtn=(x.status==='published'||x.preview_published)?`<button class="ghost" style="margin-left:6px" onclick="window.open('/i/${x.slug}','_blank')">Открыть</button>`:'';var answersBtn=(x.status==='published'||x.preview_published)?`<button class="ghost" style="margin-left:6px;margin-top:8px" onclick="showResponses('${x.id}')">Ответы гостей</button>`:'';var state=x.status==='published'?'Опубликовано':(x.preview_published?'Тестовая публикация':'Черновик');var deleteBtn=(x.status!=='published')?`<button class="ghost" style="margin-left:6px;color:#8b2f2f" onclick="deleteDraft('${x.id}')">Удалить</button>`:'';var adminBtn=(currentUser&&String(currentUser.email||'').toLowerCase()==='gaimana2015@yandex.ru'&&x.status!=='published')?`<button class="ghost" style="margin-left:6px;margin-top:8px" onclick="manualActivate('${x.id}')">Активировать вручную</button>`:'';return `<div class="card" style="margin:10px 0"><b>${escapeHtml(x.title||'Приглашение')}</b><p class="sub" style="margin:8px 0">${state}</p><button class="primary" onclick="editCloudInvitation('${x.id}')">Редактировать</button>${deleteBtn}${openBtn}${answersBtn}${adminBtn}<div id="responses-${x.id}"></div></div>`}).join('')}
window.showResponses=async function(id){var box=$('responses-'+id);if(!box)return;box.innerHTML='<p class="sub">Загрузка ответов…</p>';var r=await sb.from('rsvp_responses').select('guest_name,attendance,guest_count,comment,created_at').eq('invitation_id',id).order('created_at',{ascending:false});if(r.error){box.innerHTML='<p class="sub">Не удалось загрузить ответы.</p>';return}if(!r.data.length){box.innerHTML='<p class="sub" style="margin-top:10px">Ответов пока нет.</p>';return}var labels={yes:'Будет',no:'Не будет',maybe:'Пока не знает'};box.innerHTML='<div style="margin-top:12px">'+r.data.map(function(a){return `<div style="padding:10px 0;border-top:1px solid var(--line)"><b>${escapeHtml(a.guest_name)}</b> · ${labels[a.attendance]||escapeHtml(a.attendance)} · гостей: ${Number(a.guest_count)||1}${a.comment?`<div class="sub" style="margin-top:4px">${escapeHtml(a.comment)}</div>`:''}</div>`}).join('')+'</div>'}
window.manualActivate=async function(id){if(!currentUser)return;var raw=prompt('Какой тариф включить? Введите: basic, pro или premium');if(!raw)return;var plan=raw.trim().toLowerCase();if(!['basic','pro','premium'].includes(plan)){alert('Введите basic, pro или premium.');return}if(!confirm('Активировать тариф '+plan.toUpperCase()+' вручную? Делайте это только после проверки перевода.'))return;try{var sess=await sb.auth.getSession();var token=sess.data&&sess.data.session&&sess.data.session.access_token;if(!token)throw new Error('Сначала войдите в аккаунт владельца.');var resp=await fetch(SUPABASE_URL+'/functions/v1/admin-activate-invitation',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'apikey':SUPABASE_KEY},body:JSON.stringify({invitationId:id,plan:plan})});var data=await resp.json();if(!resp.ok)throw new Error(data.error||'Не удалось активировать.');alert('Готово. Тариф активирован, приглашение опубликовано.');await openDashboard()}catch(e){alert(e.message||'Не удалось активировать приглашение.')}}
window.deleteDraft=async function(id){if(!currentUser)return;if(!confirm('Удалить эту тестовую публикацию/черновик? Это действие нельзя отменить.'))return;var r=await sb.from('invitations').delete().eq('id',id).eq('owner_id',currentUser.id).neq('status','published');if(r.error){alert('Не удалось удалить черновик.');return}if(currentInvitationId===id){currentInvitationId=null;currentInvitationSlug=null;try{localStorage.removeItem('invella_cloud_id_'+currentUser.id);localStorage.removeItem('invella_cloud_slug_'+currentUser.id)}catch(e){}}await openDashboard()}
window.closeDashboard=function(){$('dashboardModal').classList.add('hidden');document.body.style.overflow=''}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
window.editCloudInvitation=async function(id){var r=await sb.from('invitations').select('*').eq('id',id).single();if(r.error||!r.data)return;currentInvitationId=r.data.id;currentInvitationSlug=r.data.slug;currentEditorPlan=String(r.data.plan||'draft').toLowerCase();template=r.data.template_key||'classic';var d=r.data.content||{};fields.forEach(function(k){if($(k)&&d[k]!=null)$(k).value=d[k]});closeDashboard();$('marketing').classList.add('hidden');$('app').classList.remove('hidden');render();scrollTo(0,0)}
function isPublicPath(){return /^\/i\/[a-z0-9-]+\/?$/.test(location.pathname)}
function showPublicNotFound(){document.body.innerHTML='<main class="shell section" style="min-height:100vh;display:grid;place-content:center;text-align:center"><div><div class="eyebrow">INVELLA</div><h2>Приглашение не найдено</h2><p class="sub">Ссылка неверна или приглашение больше не опубликовано.</p><a class="primary" href="/" style="display:inline-block;text-decoration:none">На главную</a></div></main>'}
async function loadPublicInvitation(){
var m=location.pathname.match(/^\/i\/([a-z0-9-]+)\/?$/);
if(!m)return false;
try{
var resp=await fetch(SUPABASE_URL+'/functions/v1/public-invitation',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({slug:m[1]})});
var payload=null;
try{payload=await resp.json()}catch(e){}
if(!resp.ok||!payload){showPublicNotFound();return true}
var x=payload.invitation||payload.data||payload;
if(!x||!x.id||!x.slug||x.slug!==m[1]){showPublicNotFound();return true}
var d=x.content&&typeof x.content==='object'?x.content:{};
template=x.template_key||'classic';
fields.forEach(function(k){if($(k)&&d[k]!=null)$(k).value=d[k]});
['showProgram','showVenue','showDress','showWishes','showRSVP'].forEach(function(k){if($(k)&&d[k]!=null)$(k).checked=Boolean(d[k])});
currentInvitationId=x.id;
currentInvitationSlug=x.slug;
currentPublicPlan=String(x.plan||'basic').toLowerCase();
if(currentPublicPlan==='basic'&&$('backgroundStyle'))$('backgroundStyle').value='auto';
if(currentPublicPlan!=='premium'&&$('backgroundStyle')&&$('backgroundStyle').value==='custom')$('backgroundStyle').value=currentPublicPlan==='pro'?'silk':'auto';
var guestParam=new URLSearchParams(location.search).get('guest');
if(guestParam&&['pro','premium'].includes(currentPublicPlan)){
if($('guest'))$('guest').value=guestParam;
if($('guestGreeting')){$('guestGreeting').textContent='Для вас, '+guestParam;$('guestGreeting').classList.remove('hidden')}
if($('guestHeading'))$('guestHeading').textContent='С особым теплом приглашаем разделить этот день с нами';
}
$('marketing').classList.add('hidden');
$('app').classList.remove('hidden');
var controls=document.querySelector('.controls'),bar=document.querySelector('.appbar'),editor=document.querySelector('.editor');
if(controls)controls.classList.add('hidden');
if(bar)bar.classList.add('hidden');
if(editor)editor.style.gridTemplateColumns='1fr';
render();
if($('publicLoading'))setTimeout(function(){$('publicLoading').classList.add('hidden')},40);
if(x.cover_url){$('invHero').style.backgroundImage='linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.28)),url("'+String(x.cover_url).replace(/"/g,'%22')+'")';$('invHero').style.color='#fff'}
return true;
}catch(e){console.error('Invella public invitation:',e);showPublicNotFound();return true}
}

function resetPublicLayout(){var controls=document.querySelector('.controls'),bar=document.querySelector('.appbar'),editor=document.querySelector('.editor');if(controls)controls.classList.remove('hidden');if(bar)bar.classList.remove('hidden');if(editor)editor.style.gridTemplateColumns='';currentInvitationId=null;currentInvitationSlug=null;currentPublicPlan=null}

window.openTemplates=function(){history.pushState({view:'design'},'','/create/design');resetPublicLayout();$('marketing').classList.remove('hidden');$('app').classList.add('hidden');setTimeout(function(){$('templates').scrollIntoView({behavior:'smooth',block:'start'})},20)}
window.chooseTemplate=function(t){template=t;safeSet('invella_template',t);history.pushState({view:'editor'},'','/create/editor');$('marketing').classList.add('hidden');$('app').classList.remove('hidden');load();render();scrollTo(0,0)}
window.goHome=function(){history.pushState({view:'home'},'','/');resetPublicLayout();$('app').classList.add('hidden');$('marketing').classList.remove('hidden');scrollTo(0,0)}
function load(){template=safeGet('invella_template')||template;var raw=safeGet('invella_draft');if(!raw)return;try{var d=JSON.parse(raw);fields.forEach(function(k){if($(k)&&d[k]!=null)$(k).value=d[k]});['showProgram','showVenue','showDress','showWishes','showRSVP'].forEach(function(k){if($(k)&&d[k]!=null)$(k).checked=!!d[k]})}catch(e){}}
function save(){var d=collectData();safeSet('invella_draft',JSON.stringify(d));scheduleCloudSave()}
function dateText(){var e=$('date');if(!e.value)return'Дата события';var p=e.value.split('-'),d=new Date(+p[0],+p[1]-1,+p[2],12),s=d.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});return s+($('time').value?' · '+$('time').value:'')}
function setText(id,v){if($(id))$(id).textContent=v}
function automaticBackground(){var ev=($('eventType')&&$('eventType').value||'').toLowerCase();if(template==='dark')return'noir';if(template==='botanical')return'garden';if(template==='romance')return'blush';if(template==='editorial'||template==='modern')return'editorial';if(ev.includes('день рождения')||ev.includes('вечерин'))return'blush';if(ev.includes('корпоратив')||ev.includes('выпуск'))return'editorial';if(ev.includes('baby')||ev.includes('гендер'))return'silk';return'silk'}
window.setInvitationBackground=function(v){if(currentEditorPlan!=='draft'&&v!=='auto'&&!editorHas('pro'))return alert('Выбор дизайнерского фона доступен в Pro и Premium.');if(v==='custom'&&currentEditorPlan!=='draft'&&!editorHas('premium'))return alert('Собственный фон доступен только в Premium.');if($('backgroundStyle'))$('backgroundStyle').value=v;applyInvitationBackground();if(!isPublicPath())save()}
function applyInvitationBackground(){var chosen=$('backgroundStyle')?$('backgroundStyle').value:'auto',stage=$('invitationStage');if(!stage)return;var actual=chosen==='auto'?automaticBackground():chosen;stage.dataset.bg=actual==='custom'?'auto':actual;stage.style.backgroundImage='';if(actual==='custom'&&$('backgroundCustomUrl')&&$('backgroundCustomUrl').value){stage.style.backgroundImage='linear-gradient(rgba(20,16,12,.10),rgba(20,16,12,.10)),url("'+$('backgroundCustomUrl').value.replace(/"/g,'%22')+'")';stage.style.backgroundSize='cover';stage.style.backgroundPosition='center'}document.querySelectorAll('#bgPicker .bg-choice').forEach(function(b){b.classList.toggle('active',b.dataset.bg===chosen)})}
function applyTemplate(){var h=$('invHero'),inv=document.querySelector('.invitation'),map={classic:['#e8ded4','#201d1b'],editorial:['#f4eee5','#201d1b'],dark:['#20201e','#fff'],botanical:['#e6eadf','#201d1b'],romance:['#eadce0','#201d1b'],modern:['#dce4e7','#201d1b']},x=map[template]||map.classic;h.style.backgroundImage='none';h.style.backgroundColor=x[0];h.style.color=x[1];if(inv){inv.className='invitation theme-'+template}applyInvitationBackground()}
function toggleCustomEvent(){var other=$('eventType').value==='Другое событие';$('customEventWrap').classList.toggle('hidden',!other);if(!other)$('customEvent').value=''}
function setBlockVisible(id,checkboxId){var el=$(id),c=$(checkboxId);if(el&&c)el.classList.toggle('hidden',!c.checked)}
function render(){enforceEditorPlan();toggleCustomEvent();var eventLabel=$('eventType').value==='Другое событие'?($('customEvent').value.trim()||'Ваше событие'):$('eventType').value;setText('vEventType',eventLabel||'Ваш праздник');setText('vNames',$('names').value||'Ваш праздник');setText('vDate',dateText());setText('vMessage',$('message').value);setText('vVenue',$('venue').value);setText('vAddress',$('address').value);setText('vDress',$('dress').value);setText('vWishes',$('wishes').value);['1','2','3'].forEach(function(n){setText('vp'+n+'t',$('p'+n+'t').value);setText('vp'+n,$('p'+n).value)});['1','2','3','4'].forEach(function(n){$('d'+n).style.backgroundColor=$('c'+n).value});setBlockVisible('blockProgram','showProgram');setBlockVisible('blockVenue','showVenue');setBlockVisible('blockDress','showDress');setBlockVisible('blockWishes','showWishes');var cp=$('childrenPolicy')?$('childrenPolicy').value:'unspecified';if($('blockChildren'))$('blockChildren').classList.toggle('hidden',cp!=='adults_only');if($('childQuestion'))$('childQuestion').classList.toggle('hidden',cp!=='welcome');var publicMode=isPublicPath()&&currentPublicPlan!==null;var canUseRSVP=!publicMode||['pro','premium'].includes(currentPublicPlan);var rsvp=$('blockRSVP');if(rsvp)rsvp.classList.toggle('hidden',!canUseRSVP||!$('showRSVP').checked);applyTemplate();if(!publicMode)save()}
window.route=function(){var a=$('address').value.trim();if(!a)return alert('Сначала укажите адрес мероприятия.');window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(a),'_blank')}
window.sendRSVP=async function(){if(!['pro','premium'].includes(String(currentPublicPlan||'').toLowerCase()))return alert('RSVP доступен только в тарифах Pro и Premium.');var name=$('guest').value.trim();if(!name)return alert('Пожалуйста, укажите имя и фамилию.');if(!currentInvitationSlug||location.pathname.indexOf('/i/')!==0)return alert('Ответ можно отправить только из опубликованного приглашения.');var r=await sb.rpc('submit_rsvp',{p_slug:currentInvitationSlug,p_guest_name:name,p_attendance:$('attendance').value,p_guest_count:Number($('guestCount').value)||1,p_comment:('Напитки: '+(Array.from(document.querySelectorAll('#alcoholChoices input:checked')).map(function(x){return x.value}).join(', ')||'Не указано')+(($('childrenPolicy')&&$('childrenPolicy').value==='welcome')?' | С ребёнком: '+(($('withChild')&&$('withChild').value==='yes')?'Да':'Нет'):'')+($('comment').value.trim()?' | Комментарий: '+$('comment').value.trim():''))});if(r.error)return alert('Не удалось отправить ответ. Попробуйте ещё раз.');$('rsvpOk').classList.remove('hidden');$('guest').value='';$('comment').value=''}
window.addWishPreset=function(type){var texts={flowers:'Пожалуйста, не дарите нам цветы — после праздника мы не сможем насладиться ими в полной мере.',gifts:'Если захотите порадовать нас подарком, будем благодарны за вклад в осуществление нашей общей мечты.',taxi:'Пожалуйста, не переживайте о дороге домой — после праздника воспользуйтесь такси и берегите себя.'};if(!texts[type])return;var w=$('wishes');w.value=(w.value.trim()?w.value.trim()+'\n\n':'')+texts[type];render()}
async function uploadCustomBackground(file){if(!file)return;if(currentEditorPlan!=='draft'&&!editorHas('premium')){if($('customBackgroundFile'))$('customBackgroundFile').value='';return alert('Загрузка собственного фона доступна только в Premium.');}var f=await compressImage(file),r=new FileReader();r.onload=function(){$('backgroundCustomUrl').value=r.result;$('backgroundStyle').value='custom';$('customBgPreview').style.backgroundImage='url("'+r.result+'")';$('customBgPreview').textContent='';applyInvitationBackground();save()};r.readAsDataURL(f);if(currentUser){var saved=await cloudSave();if(saved&&currentInvitationId){var path=currentUser.id+'/'+currentInvitationId+'/background-'+Date.now()+'.webp';var u=await sb.storage.from('invitation-media').upload(path,f,{upsert:true});if(!u.error){$('backgroundCustomPath').value=path;$('backgroundCustomUrl').value='';$('backgroundStyle').value='custom';await cloudSave()}}}}
window.publishDemo=function(){if(!currentUser){openAuth();$('authMessage').textContent='Чтобы опубликовать приглашение, сначала войдите или зарегистрируйтесь.';return}history.pushState({view:'publish'},'','/create/publish');$('publishModal').classList.remove('hidden');document.body.style.overflow='hidden'}
window.closePublish=function(){$('publishModal').classList.add('hidden');document.body.style.overflow='';if(location.pathname==='/create/publish')history.pushState({view:'editor'},'','/create/editor')}
var appliedPromoCode='';
function rub(v){return Number(v).toLocaleString('ru-RU')+' ₽'}
function resetPromoPrices(){var base={basic:990,pro:1490,premium:2490};Object.keys(base).forEach(function(k){var p=$('price-'+k),b=$('pay-'+k);if(p)p.textContent=rub(base[k]);if(b)b.textContent='Оплатить '+rub(base[k]);});appliedPromoCode='';}
window.applyPromoCode=async function(){
  var input=$('promoCode'),m=$('promoMessage');
  var code=(input&&input.value||'').trim().toUpperCase();
  if(input)input.value=code;
  resetPromoPrices();
  if(!code){if(m){m.className='auth-message error';m.textContent='Введите промокод.';}return;}
  if(m){m.className='auth-message';m.textContent='Проверяем промокод…';}
  try{
    var saved=await cloudSave();
    if(!saved||!currentInvitationId)throw new Error('Не удалось сохранить приглашение. Попробуйте ещё раз.');
    var sess=await sb.auth.getSession(),token=sess.data&&sess.data.session&&sess.data.session.access_token;
    if(!token)throw new Error('Сессия истекла. Войдите в аккаунт ещё раз.');
    var base={basic:990,pro:1490,premium:2490};
    var plans=['basic','pro','premium'];
    var results=await Promise.all(plans.map(async function(plan){
      var resp=await fetch('/api/create-payment',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({plan:plan,invitationId:currentInvitationId,promoCode:code,validatePromoOnly:true})});
      var data={};try{data=await resp.json()}catch(e){}
      return {plan:plan,ok:resp.ok&&data.validPromo===true,data:data};
    }));
    var valid=results.filter(function(x){return x.ok});
    if(!valid.length){if(m){m.className='auth-message error';m.textContent='Неверный промокод';}return;}
    appliedPromoCode=code;
    valid.forEach(function(x){var k=x.plan,r=Math.round(Number(x.data.amountMinor||0)/100),p=$('price-'+k),b=$('pay-'+k);if(r>0){if(p)p.innerHTML='<span style="text-decoration:line-through;opacity:.45;font-size:.58em;margin-right:8px">'+rub(base[k])+'</span>'+rub(r);if(b)b.textContent='Оплатить '+rub(r);}});
    var first=valid[0].data,label='';
    if(first.discountType==='percent')label=' — скидка '+first.discountValue+'%';
    else if(first.discountType==='fixed')label=' — скидка '+rub(Math.round(Number(first.discountValue||0)/100));
    if(m){m.className='auth-message ok';m.textContent='Промокод применён'+label;}
  }catch(e){if(m){m.className='auth-message error';m.textContent=e.message||'Не удалось проверить промокод';}}
}
if($('promoCode'))$('promoCode').addEventListener('input',function(){if(appliedPromoCode&&this.value.trim().toUpperCase()!==appliedPromoCode){resetPromoPrices();if($('promoMessage'))$('promoMessage').textContent='';}});
window.selectPlan=async function(plan,price,btn){
if(!currentUser)return openAuth();
var saved=await cloudSave();
if(!saved||!currentInvitationId)return alert('Не удалось сохранить приглашение. Попробуйте ещё раз.');
if(btn){btn.disabled=true;btn.textContent='Переходим к оплате…'}
try{
var sess=await sb.auth.getSession(),token=sess.data&&sess.data.session&&sess.data.session.access_token;if(!token)throw new Error('Сессия истекла. Войдите в аккаунт ещё раз.');var resp=await fetch('/api/create-payment',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({plan:plan,invitationId:currentInvitationId,promoCode:appliedPromoCode})});
var data=await resp.json();
if(!resp.ok||!data.confirmationUrl)throw new Error(data.error||'Не удалось создать платёж');
safeSet('invella_pending_payment',JSON.stringify({paymentId:data.paymentId,plan:plan,invitationId:currentInvitationId}));
location.href=data.confirmationUrl;
}catch(e){
alert((e.message||'Не удалось перейти к оплате.')+' Если проблема повторяется, напишите нам: hello.invella@bk.ru');
if(btn){btn.disabled=false;btn.textContent='Оплатить '+price.toLocaleString('ru-RU')+' ₽'}
}
}
window.makeGuestLinks=function(){
if(currentEditorPlan!=='draft'&&!editorHas('pro'))return alert('Персональные ссылки доступны в Pro и Premium.');
var box=$('guestLinksBox'),raw=$('guestNamesForLinks').value.trim();
if(!raw){box.textContent='Добавьте хотя бы одно имя гостя.';return}
if(!currentInvitationSlug){box.textContent='Сначала сохраните и опубликуйте приглашение, чтобы появилась ссылка.';return}
var names=raw.split(/\n+/).map(function(x){return x.trim()}).filter(Boolean);
box.innerHTML=names.map(function(name){
var url=location.origin+'/i/'+currentInvitationSlug+'?guest='+encodeURIComponent(name);
return '<div style="padding:9px 0;border-top:1px solid var(--line)"><b>'+escapeHtml(name)+'</b><br><button type="button" class="ghost" style="margin-top:6px" data-link="'+escapeHtml(url)+'" onclick="copyGuestLink(this)">Скопировать ссылку</button></div>'
}).join('');
}
window.copyGuestLink=async function(btn){
var url=btn.getAttribute('data-link');
try{await navigator.clipboard.writeText(url);btn.textContent='Скопировано ✓';setTimeout(function(){btn.textContent='Скопировать ссылку'},1500)}
catch(e){prompt('Скопируйте ссылку:',url)}
}
window.closePaymentSuccess=function(){$('paymentSuccessModal').classList.add('hidden');document.body.style.overflow=''}
window.openPaidInvitation=function(){closePaymentSuccess();if(currentInvitationSlug)location.href='/i/'+currentInvitationSlug;else openDashboard()}
async function maybeShowPaymentSuccess(){
var q=new URLSearchParams(location.search);
var raw=safeGet('invella_pending_payment'),p=null;
try{p=raw?JSON.parse(raw):null}catch(e){}
if(!p&&q.get('recoverPayment'))p={paymentId:q.get('recoverPayment')};
if(q.get('payment')==='success'||q.get('paid')==='1')history.replaceState(null,'',location.pathname);
if(!currentUser||!p||!p.paymentId)return;
try{
var sess=await sb.auth.getSession();
var token=sess.data&&sess.data.session&&sess.data.session.access_token;
if(!token)return;
var resp=await fetch('/api/payment-status',{
method:'POST',
headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
body:JSON.stringify({paymentId:p.paymentId})
});
var data=await resp.json();
if(!resp.ok||!data.paid)return;
currentInvitationId=data.invitationId||p.invitationId||currentInvitationId;
if(data.slug)currentInvitationSlug=data.slug;
/* Webhook can arrive a moment after the browser returns from YooKassa. */
if(!data.published){
  for(var attempt=0;attempt<6&&!data.published;attempt++){
    await new Promise(function(resolve){setTimeout(resolve,1200)});
    var retry=await fetch('/api/payment-status',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({paymentId:p.paymentId})});
    if(retry.ok)data=await retry.json();
    if(data.slug)currentInvitationSlug=data.slug;
  }
}
var plan=data.plan||p.plan,labels={basic:'Базовый',pro:'Pro',extended:'Pro',premium:'Premium'};
$('paymentSuccessText').textContent=data.published?'Тариф '+(labels[plan]||plan)+' успешно оплачен. Ваше приглашение опубликовано.':'Оплата прошла. Публикация приглашения завершается — оно появится в «Моих приглашениях» через несколько секунд.';
if(window.ym){try{ym(112266204,'reachGoal','payment_success',{plan:plan||'',payment_id:p.paymentId||''});}catch(e){}}
$('paymentSuccessModal').classList.remove('hidden');
document.body.style.overflow='hidden';
if(data.published){try{localStorage.removeItem('invella_pending_payment')}catch(e){}}
}catch(e){console.error('Payment recovery:',e)}
}
function restoreRouteView(){
var p=location.pathname;
if(p==='/create/editor'||p==='/create/publish'){$('marketing').classList.add('hidden');$('app').classList.remove('hidden');}
else if(p==='/create/design'){$('app').classList.add('hidden');$('marketing').classList.remove('hidden');setTimeout(function(){$('templates').scrollIntoView({block:'start'})},20);}
else{$('app').classList.add('hidden');$('marketing').classList.remove('hidden');}
}
window.addEventListener('popstate',function(){if(isPublicPath())return;restoreRouteView();if(location.pathname==='/create/publish'&&currentUser){$('publishModal').classList.remove('hidden');document.body.style.overflow='hidden'}else if($('publishModal')){$('publishModal').classList.add('hidden');document.body.style.overflow=''}});
async function init(){
currentInvitationId=null;
currentInvitationSlug=null;
if(isPublicPath()){
if($('publicLoading'))$('publicLoading').classList.remove('hidden');
await loadPublicInvitation();
return;
}
restoreRouteView();
load();
fields.forEach(function(id){if($(id)){$(id).addEventListener('input',render);$(id).addEventListener('change',render)}});
['showProgram','showVenue','showDress','showWishes','showRSVP'].forEach(function(id){if($(id))$(id).addEventListener('change',render)});
$('photo').addEventListener('change',async function(e){var original=e.target.files[0];if(!original)return;var f=await compressImage(original);var r=new FileReader();r.onload=function(){$('invHero').style.backgroundImage='linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.28)),url("'+r.result+'")';$('invHero').style.color='#fff'};r.readAsDataURL(f);var saved=await cloudSave();if(saved)await uploadCover(f)});
if($('customBackgroundFile'))$('customBackgroundFile').addEventListener('change',function(e){uploadCustomBackground(e.target.files[0])});
render();
await initAuth();
await restoreUserCloudState();
cloudReady=true;
if(location.pathname==='/create/publish'&&currentUser){$('publishModal').classList.remove('hidden');document.body.style.overflow='hidden'}
await maybeShowPaymentSuccess();
[$('authModal'),$('publishModal'),$('dashboardModal'),$('paymentSuccessModal'),$('resetPasswordModal')].forEach(function(m){if(m)m.addEventListener('click',function(e){if(e.target===m){m.classList.add('hidden');document.body.style.overflow=''}})});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
