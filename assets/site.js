(function(){
 const $=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
 window.AkiyaUI={
  show(box,msg,ok=false){if(!box)return;box.textContent=msg;box.className='status-box show '+(ok?'ok':'bad')},
  busy(btn,on,label){if(!btn)return;if(on){btn.dataset.old=btn.textContent;btn.disabled=true;btn.textContent=label||'送信中…'}else{btn.disabled=false;btn.textContent=btn.dataset.old||btn.textContent}},
  formData(form){const fd=new FormData(form),o={};for(const [k,v] of fd){if(k.endsWith('[]')){const n=k.slice(0,-2);(o[n]??=[]).push(v)}else if(o[k]!==undefined)o[k]=[].concat(o[k],v);else o[k]=v}return o},
  requirePassword(v){return String(v||'').length>=8},
  logout(){AkiyaAPI.setToken('');location.href='member-login.html'}
 };
 $$('.js-logout').forEach(x=>x.addEventListener('click',e=>{e.preventDefault();AkiyaUI.logout()}));
})();
AkiyaUI.initTurnstile=function(form){
  const key=(window.AKIYA_CONFIG&&window.AKIYA_CONFIG.TURNSTILE_SITE_KEY)||'';
  if(!form||!key||form.dataset.turnstileInitialized==='1')return;
  form.dataset.turnstileInitialized='1';
  let slot=form.querySelector('.turnstile-slot');
  if(!slot){
    slot=document.createElement('div');
    slot.className='turnstile-slot';
    const status=form.querySelector('.status-box');
    (status||form.lastElementChild).before(slot);
  }
  let hidden=form.querySelector('input[name="turnstileToken"]');
  if(!hidden){
    hidden=document.createElement('input');
    hidden.type='hidden';
    hidden.name='turnstileToken';
    form.append(hidden);
  }
  const render=()=>{
    if(!window.turnstile||form.dataset.turnstileRendered==='1')return;
    form.dataset.turnstileRendered='1';
    form._akiyaTurnstileWidgetId=window.turnstile.render(slot,{
      sitekey:key,
      callback:t=>hidden.value=t,
      'expired-callback':()=>hidden.value='',
      'error-callback':()=>hidden.value=''
    });
  };
  if(window.turnstile){render();return}
  if(!document.querySelector('script[data-akiya-turnstile]')){
    const script=document.createElement('script');
    script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async=true;
    script.defer=true;
    script.dataset.akiyaTurnstile='1';
    script.onload=()=>AkiyaUI.turnstileForms().forEach(f=>AkiyaUI.initTurnstile(f));
    document.head.append(script);
  }
  const timer=setInterval(()=>{
    if(window.turnstile){clearInterval(timer);render()}
  },100);
  setTimeout(()=>clearInterval(timer),15000);
};
AkiyaUI.resetTurnstile=function(form){
  if(!form)return;
  const hidden=form.querySelector('input[name="turnstileToken"]');
  if(hidden)hidden.value='';
  const id=form._akiyaTurnstileWidgetId;
  if(window.turnstile&&id!==undefined&&id!==null){
    try{window.turnstile.reset(id)}catch(e){}
  }
};
AkiyaUI.turnstileForms=function(){return ['registerForm','loginForm','resetForm','identifierForm','newPasswordForm'].map(id=>document.getElementById(id)).filter(Boolean)};
if(window.AkiyaAPI&&typeof AkiyaAPI.submit==='function'){const rawSubmit=AkiyaAPI.submit.bind(AkiyaAPI);AkiyaAPI.submit=async function(){try{return await rawSubmit(...arguments)}finally{AkiyaUI.turnstileForms().forEach(AkiyaUI.resetTurnstile)}}}
document.addEventListener('DOMContentLoaded',()=>AkiyaUI.turnstileForms().forEach(AkiyaUI.initTurnstile));
