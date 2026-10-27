
if(!window.supabase){document.getElementById('loading').textContent='Не удалось загрузить вход. Обновите страницу.';throw new Error('Supabase SDK unavailable')}
const SUPABASE_URL = location.origin+"/sb";

const SUPABASE_KEY =
  "sb_publishable_EY50r1gV7v1zyD9vBgrteA_JVcOg4_J";

const fetch=window.invellaFetch||window.fetch.bind(window);
function adminFetch(input,options){
  const url=String(input?.url||input);
  const login=/\/auth\/v1\/token\?grant_type=password(?:&|$)/.test(url);
  const upstream=options?.signal;
  function attempt(target,ms){
    const controller=new AbortController();
    const cancel=()=>controller.abort();
    if(upstream){if(upstream.aborted)controller.abort();else upstream.addEventListener('abort',cancel,{once:true})}
    const timer=setTimeout(cancel,ms);
    return fetch(target,{...options,signal:controller.signal}).finally(()=>{
      clearTimeout(timer);
      if(upstream)upstream.removeEventListener('abort',cancel);
    });
  }
  if(login&&url.startsWith(SUPABASE_URL+'/auth/')){
    const direct=url.replace(SUPABASE_URL,'https://lwanymjmbcstvggmhevx.supabase.co');
    const directInput=input instanceof Request?new Request(direct,input.clone()):direct;
    return attempt(input,12000).catch(error=>{
      if(upstream?.aborted)throw error;
      return attempt(directInput,18000);
    });
  }
  return attempt(input,20000);
}

const sb =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {global:{fetch:adminFetch}}
  );

let invitations = [];
let promos = [];

function esc(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function message(id,text,type="ok"){
  const el=document.getElementById(id);

  if(!text){
    el.innerHTML="";
    return;
  }

  el.innerHTML=
    '<div class="message '+type+'">'+
    esc(text)+
    '</div>';
}

async function getToken(){

  const {
    data:{session}
  }=await sb.auth.getSession();

  return session?.access_token || "";
}

async function api(body){

  const token=await getToken();

  if(!token){
    throw new Error("Необходимо войти");
  }

  const response=await fetch(
    SUPABASE_URL+"/functions/v1/admin-panel",
    {
      method:"POST",

      headers:{
        "Content-Type":"application/json",
        "Authorization":"Bearer "+token,
        "apikey":SUPABASE_KEY
      },

      body:JSON.stringify(body),
      signal:AbortSignal.timeout(20000)
    }
  );

  let data={};

  try{
    data=await response.json();
  }catch(e){}

  if(!response.ok){
    if(response.status===403){
      throw new Error(
        "У этого аккаунта нет прав администратора"
      );
    }

    throw new Error(
      data.error || "Ошибка сервера"
    );
  }

  return data;
}

async function login(){

  message("loginMessage","");

  const email=
    document.getElementById("email").value.trim();

  const password=
    document.getElementById("password").value;

  if(!email || !password){
    message(
      "loginMessage",
      "Введите email и пароль",
      "error"
    );
    return;
  }

  let error;
  try{
    ({error}=await sb.auth.signInWithPassword({email,password}));
  }catch(e){
    message("loginMessage","Сервер долго не отвечает. Попробуйте ещё раз.","error");
    return;
  }

  if(error){
    message(
      "loginMessage",
      "Неверный email или пароль",
      "error"
    );
    return;
  }

  await start();
}

async function logout(){

  await sb.auth.signOut();

  location.reload();
}

async function start(){

  document.getElementById("loading")
    .classList.remove("hidden");

  document.getElementById("loginBox")
    .classList.add("hidden");

  document.getElementById("admin")
    .classList.add("hidden");

  let session;
  try{
    ({data:{session}}=await sb.auth.getSession());
  }catch(e){
    document.getElementById("loading").classList.add("hidden");
    document.getElementById("loginBox").classList.remove("hidden");
    message("loginMessage","Сервер долго не отвечает. Попробуйте ещё раз.","error");
    return;
  }

  if(!session){

    document.getElementById("loading")
      .classList.add("hidden");

    document.getElementById("loginBox")
      .classList.remove("hidden");

    return;
  }

  try{

    await loadData();

    document.getElementById("loading")
      .classList.add("hidden");

    document.getElementById("admin")
      .classList.remove("hidden");

  }catch(e){

    document.getElementById("loading")
      .classList.add("hidden");

    document.getElementById("loginBox")
      .classList.remove("hidden");

    message(
      "loginMessage",
      e.message,
      "error"
    );
  }
}

async function loadData(){

  const data=
    await api({
      action:"list"
    });

  invitations=data.invitations || [];
  promos=data.promos || [];

  renderInvitations();
  renderPromos();
}

function showTab(tab){

  const inv=
    tab==="invitations";

  document.getElementById("invitationsTab")
    .classList.toggle("hidden",!inv);

  document.getElementById("promosTab")
    .classList.toggle("hidden",tab!=="promos");

  document.getElementById("paymentsTab")
    .classList.toggle("hidden",tab!=="payments");

  document.getElementById("tabInv")
    .classList.toggle("active",inv);

  document.getElementById("tabPromo")
    .classList.toggle("active",tab==="promos");

  document.getElementById("tabPayments")
    .classList.toggle("active",tab==="payments");
}

async function loadPayments(){
  const result=document.getElementById('paymentsResult');
  const from=document.getElementById('paymentsFrom').value;
  const to=document.getElementById('paymentsTo').value;
  const amount=document.getElementById('paymentsAmount').value;
  if(!from||!to){message('paymentsResult','Укажите обе даты','error');return}
  const button=document.querySelector('#paymentsTab button');
  button.disabled=true;
  result.textContent='Проверяем…';
  try{
    const token=await getToken();
    if(!token)throw new Error('Сессия истекла');
    const q=new URLSearchParams({from:from+'T00:00:00+03:00',to:to+'T23:59:59+03:00',amount});
    const response=await fetch('/api/admin-payments?'+q,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Не удалось проверить оплаты');
    result.innerHTML=data.items.length?data.items.map(p=>
      `<div class="card"><b>${esc(p.amount)} ₽ · ${esc(p.status)}</b><p>${esc(new Date(p.createdAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}))} · ID ${esc(p.id)}</p><p>Приглашение: ${esc(p.invitationId||'не указано')} · тариф: ${esc(p.plan||'не указан')}</p></div>`
    ).join(''):'<p class="muted">Операций на эту сумму за выбранные даты в подключённом магазине не найдено.</p>';
    if(data.truncated)result.insertAdjacentHTML('beforeend','<p>Найдено слишком много операций. Уменьшите период.</p>');
  }catch(e){message('paymentsResult',e.message||'Ошибка проверки','error')}
  finally{button.disabled=false}
}

function renderInvitations(){

  const root=
    document.getElementById("invitations");

  const q=
    document.getElementById("search")
      .value
      .trim()
      .toLowerCase();

  const list=invitations.filter(x=>{

    const hay=[
      x.title,
      x.email,
      x.display_name,
      x.slug,
      x.event_type,
      x.plan,
      x.status
    ]
      .join(" ")
      .toLowerCase();

    return !q || hay.includes(q);
  });

  if(!list.length){

    root.innerHTML=
      '<p class="muted">Ничего не найдено.</p>';

    return;
  }

  root.innerHTML=list.map(x=>{

    const url=
      x.slug
      ? location.origin+"/i/"+x.slug
      : "";

    return `
      <div class="item">

        <div class="item-head">

          <div>

            <div class="item-title">
              ${esc(x.title || "Без названия")}
            </div>

            <div class="meta">

              ${x.email
                ? "Клиент: "+esc(x.email)+"<br>"
                : ""
              }

              ${x.event_type
                ? "Событие: "+esc(x.event_type)+"<br>"
                : ""
              }

              ${url
                ? "Ссылка: "+esc(url)
                : ""
              }

            </div>

          </div>

          <div>

            <span class="badge ${x.status==="published"?"published":""}">
              ${esc(x.plan || "draft")}
              ·
              ${esc(x.status)}
            </span>

          </div>

        </div>

        <div class="actions">

          <button
            onclick="activateInvitation(
              '${esc(x.id)}',
              'basic'
            )">
            Выдать Basic
          </button>

          <button
            onclick="activateInvitation(
              '${esc(x.id)}',
              'pro'
            )">
            Выдать Pro
          </button>

          <button
            onclick="activateInvitation(
              '${esc(x.id)}',
              'premium'
            )">
            Выдать Premium
          </button>

          ${url ? `
            <button
              class="secondary"
              onclick="window.open(
                '${esc(url)}',
                '_blank'
              )">
              Открыть
            </button>
          ` : ""}

          <button
            class="danger"
            onclick="disableInvitation(
              '${esc(x.id)}'
            )">
            Отключить
          </button>

        </div>

      </div>
    `;
  }).join("");
}

async function activateInvitation(id,plan){

  const names={
    basic:"Basic",
    pro:"Pro",
    premium:"Premium"
  };

  if(!confirm(
    "Выдать тариф "+names[plan]+
    " и опубликовать приглашение?"
  )){
    return;
  }

  message("invitationMessage","");

  try{

    await api({
      action:"activate",
      invitationId:id,
      plan
    });

    message(
      "invitationMessage",
      "Тариф "+names[plan]+
      " успешно выдан."
    );

    await loadData();

  }catch(e){

    message(
      "invitationMessage",
      e.message,
      "error"
    );
  }
}

async function disableInvitation(id){

  if(!confirm(
    "Отключить это приглашение?"
  )){
    return;
  }

  try{

    await api({
      action:"disable",
      invitationId:id
    });

    message(
      "invitationMessage",
      "Приглашение отключено."
    );

    await loadData();

  }catch(e){

    message(
      "invitationMessage",
      e.message,
      "error"
    );
  }
}

function renderPromos(){

  const root=
    document.getElementById("promos");

  if(!promos.length){

    root.innerHTML=
      '<p class="muted">Промокодов пока нет.</p>';

    return;
  }

  root.innerHTML=promos.map(p=>{

    let discount="";

    if(p.discount_type==="percent"){
      discount=p.discount_value+"%";
    }else{
      discount=
        (Number(p.discount_value)/100)+" ₽";
    }

    const plan=
      p.plan_key
      ? p.plan_key.toUpperCase()
      : "Все тарифы";

    const uses=
      p.max_uses
      ? p.uses_count+" / "+p.max_uses
      : p.uses_count+" / ∞";

    return `
      <div class="promo-row">

        <div>

          <div class="promo-code">
            ${esc(p.code)}
          </div>

          <div class="meta">

            Скидка:
            ${esc(discount)}
            ·
            ${esc(plan)}
            <br>

            Использовано:
            ${esc(uses)}

            ${p.expires_at
              ? "<br>До: "+
                esc(
                  new Date(
                    p.expires_at
                  ).toLocaleString("ru-RU")
                )
              : ""
            }

          </div>

        </div>

        <button
          class="${p.active ? "danger" : "green"}"
          onclick="togglePromo(
            '${esc(p.id)}',
            ${!p.active}
          )"
        >

          ${p.active
            ? "Выключить"
            : "Включить"
          }

        </button>

      </div>
    `;
  }).join("");
}

async function createPromo(){

  message("promoMessage","");

  const code=
    document.getElementById("promoCode")
      .value
      .trim()
      .toUpperCase();

  const discountType=
    document.getElementById("discountType")
      .value;

  const discountValue=
    Number(
      document.getElementById("discountValue")
        .value
    );

  const planKey=
    document.getElementById("planKey")
      .value || null;

  const maxRaw=
    document.getElementById("maxUses")
      .value;

  const maxUses=
    maxRaw ? Number(maxRaw) : null;

  const expiresRaw=
    document.getElementById("expiresAt")
      .value;

  if(!code || !discountValue){

    message(
      "promoMessage",
      "Введите код и размер скидки.",
      "error"
    );

    return;
  }

  try{

    await api({
      action:"promo_create",
      code,
      discountType,
      discountValue,
      planKey,
      maxUses,
      expiresAt:expiresRaw || null
    });

    document.getElementById("promoCode").value="";
    document.getElementById("discountValue").value="";
    document.getElementById("maxUses").value="";
    document.getElementById("expiresAt").value="";

    message(
      "promoMessage",
      "Промокод создан."
    );

    await loadData();

  }catch(e){

    message(
      "promoMessage",
      e.message,
      "error"
    );
  }
}

async function togglePromo(id,active){

  try{

    await api({
      action:"promo_toggle",
      id,
      active
    });

    await loadData();

  }catch(e){

    message(
      "promoMessage",
      e.message,
      "error"
    );
  }
}

start();

window.invellaAdminReady=true;