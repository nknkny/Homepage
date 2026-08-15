'use strict';
(() => {
  const API='https://fpgtwgtoqtokpitzlbie.supabase.co/functions/v1/event-platform-api';
  const STORAGE_KEY='event_platform_identity';
  const VERSION='2026-08-15-paid-ui-v1';
  const $=id=>document.getElementById(id);
  const txt=v=>String(v??'').trim();
  let billing={plan:'free',isPro:false,status:'inactive',currentPeriodEnd:null,freeActiveLimit:3};

  function makeSecret(){const a=crypto.getRandomValues(new Uint8Array(32));return[...a].map(b=>b.toString(16).padStart(2,'0')).join('')}
  function identity(){
    let v=null;
    try{v=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{}
    if(!v||!/^[0-9a-f-]{36}$/i.test(v.ownerId||'')||txt(v.ownerKey).length<32){v={ownerId:crypto.randomUUID(),ownerKey:makeSecret(),createdAt:new Date().toISOString()};localStorage.setItem(STORAGE_KEY,JSON.stringify(v))}
    return v;
  }
  function headers(){const i=identity();return{'Content-Type':'application/json','x-owner-id':i.ownerId,'x-owner-key':i.ownerKey}}
  async function api(action,{method='GET',body}={}){
    const r=await fetch(`${API}?action=${encodeURIComponent(action)}`,{method,headers:headers(),body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
    const d=await r.json().catch(()=>({ok:false,error:'INVALID_RESPONSE'}));
    if(!r.ok||d.ok===false){const e=new Error(d.error||`HTTP_${r.status}`);e.data=d;throw e}
    return d;
  }
  function dateJP(v){if(!v)return'';const d=new Date(v);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'long',day:'numeric'}).format(d):''}
  function remaining(v){if(!v)return 0;return Math.max(0,Math.ceil((new Date(v).getTime()-Date.now())/86400000))}
  function render(){
    const isPro=!!billing.isPro;
    const expiry=isPro?dateJP(billing.currentPeriodEnd):'';
    const days=isPro?remaining(billing.currentPeriodEnd):0;
    const html=isPro?`<strong>Pro有効</strong>　有効期限：${expiry}（残り約${days}日）／自動更新なし`:`<strong>無料プラン</strong>　同時掲載は${billing.freeActiveLimit||3}件まで。Pro 30日パスで掲載上限解除・高一致自動通知を利用できます。`;
    ['billingState','dashboardBilling'].forEach(id=>{const el=$(id);if(el){el.className='billing-state'+(isPro?' pro':'');el.innerHTML=html}});
    const btn=$('buyProBtn');if(btn){btn.textContent=isPro?'Proを30日延長する — 1,980円':'Pro 30日パスを購入 — 1,980円';btn.disabled=false}
  }
  async function load(){
    try{const d=await api('dashboard');billing=d.billing||billing;render();return true}
    catch{try{const d=await api('bootstrap',{method:'POST',body:{}});billing=d.billing||billing;render();return true}catch{return false}}
  }
  function openPurchase(){
    const modal=$('purchaseModal');if(!modal)return;
    $('purchaseConsent').checked=false;$('purchaseGo').disabled=true;$('purchaseResult').textContent='';
    const period=$('purchasePeriod');if(period)period.textContent=billing.isPro?`現在の有効期限 ${dateJP(billing.currentPeriodEnd)} の末尾から30日追加`:'決済確認後から30日間';
    modal.classList.add('open');document.body.style.overflow='hidden';
  }
  function closePurchase(){const m=$('purchaseModal');if(m)m.classList.remove('open');document.body.style.overflow=''}
  async function purchase(){
    if(!$('purchaseConsent')?.checked)return;
    const go=$('purchaseGo');const result=$('purchaseResult');go.disabled=true;result.textContent='購入情報を準備しています…';
    try{
      const d=await api('prepare_pro_purchase',{method:'POST',body:{accepted:true}});
      if(!d.checkoutUrl)throw new Error('CHECKOUT_URL_MISSING');
      result.textContent='Stripeの安全な決済画面へ移動します。';
      location.assign(d.checkoutUrl);
    }catch(e){console.error(e);result.textContent='購入画面を準備できませんでした。接続状態を確認して再度お試しください。';go.disabled=false}
  }
  async function afterPayment(){
    const q=new URLSearchParams(location.search);if(q.get('billing')!=='success')return;
    const result=$('billingReturn');if(result)result.textContent='決済結果を確認しています…';
    for(let n=0;n<8;n++){
      const ok=await load();if(ok&&billing.isPro){if(result)result.textContent=`決済を確認しました。Proは${dateJP(billing.currentPeriodEnd)}まで有効です。`;history.replaceState(null,'',`${location.pathname}#dashboard`);return}
      await new Promise(r=>setTimeout(r,1500));
    }
    if(result)result.textContent='決済処理は完了しています。Pro表示への反映に時間がかかっている場合は「管理」を再読み込みしてください。';
  }
  function wire(){
    $('buyProBtn')?.addEventListener('click',openPurchase);
    $('purchaseClose')?.addEventListener('click',closePurchase);
    $('purchaseCancel')?.addEventListener('click',closePurchase);
    $('purchaseModal')?.addEventListener('click',e=>{if(e.target===$('purchaseModal'))closePurchase()});
    $('purchaseConsent')?.addEventListener('change',e=>{$('purchaseGo').disabled=!e.target.checked});
    $('purchaseGo')?.addEventListener('click',purchase);
    window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY)load()});
  }
  window.addEventListener('DOMContentLoaded',async()=>{wire();await load();await afterPayment();console.info(`billing ${VERSION}`)});
})();