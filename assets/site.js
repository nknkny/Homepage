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
  if(!form||!key)return;
  let slot=form.querySelector('.turnstile-slot');
  if(!slot){slot=document.createElement('div');slot.className='turnstile-slot';const status=form.querySelector('.status-box');(status||form.lastElementChild).before(slot)}
  const hidden=document.createElement('input');hidden.type='hidden';hidden.name='turnstileToken';form.append(hidden);
  const render=()=>{if(window.turnstile)window.turnstile.render(slot,{sitekey:key,callback:t=>hidden.value=t,'expired-callback':()=>hidden.value='','error-callback':()=>hidden.value=''})};
  if(window.turnstile){render();return}
  if(!document.querySelector('script[data-akiya-turnstile]')){const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.defer=true;s.dataset.akiyaTurnstile='1';s.onload=render;document.head.append(s)}else{const timer=setInterval(()=>{if(window.turnstile){clearInterval(timer);render()}},100)}
};
document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('form').forEach(AkiyaUI.initTurnstile));
