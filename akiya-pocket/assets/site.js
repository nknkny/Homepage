/* AKIYA_LEGACY_GITHUB_REDIRECT_V1 */
(function(){
  if(location.hostname==='nknkny.github.io'&&location.pathname.startsWith('/Homepage/akiya-pocket/')&&!location.pathname.startsWith('/Homepage/akiya-pocket/control-center/')){
    const tail=location.pathname.slice('/Homepage/akiya-pocket/'.length);
    location.replace('https://akiya-pocket-aomori.pages.dev/'+tail+location.search+location.hash);
  }
})();
(function(){
 const $=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
 window.AkiyaUI={
  show(box,msg,ok=false){if(!box)return;box.textContent=msg;box.className='status-box show '+(ok?'ok':'bad')},
  busy(btn,on,label){if(!btn)return;if(on){btn.dataset.old=btn.textContent;btn.disabled=true;btn.textContent=label||'送信中…'}else{btn.disabled=false;btn.textContent=btn.dataset.old||btn.textContent}},
  formData(form){const fd=new FormData(form),o={};for(const [k,v] of fd){if(k.endsWith('[]')){const n=k.slice(0,-2);(o[n]??=[]).push(v)}else if(o[k]!==undefined)o[k]=[].concat(o[k],v);else o[k]=v}return o},
  requirePassword(v){return String(v||'').length>=6},
  logout(){AkiyaAPI.setToken('');location.href='member-login.html'}
 };
 $$('.js-logout').forEach(x=>x.addEventListener('click',e=>{e.preventDefault();AkiyaUI.logout()}));
})();
AkiyaUI.initTurnstile=function(form){
  const key=(window.AKIYA_CONFIG&&window.AKIYA_CONFIG.TURNSTILE_SITE_KEY)||'';
  if(!form||!key||form.dataset.turnstileInitialized==='1')return;
  form.dataset.turnstileInitialized='1';
  let slot=form.querySelector('.turnstile-slot');
  if(!slot){slot=document.createElement('div');slot.className='turnstile-slot';const status=form.querySelector('.status-box');(status||form.lastElementChild).before(slot)}
  let hidden=form.querySelector('input[name="turnstileToken"]');
  if(!hidden){hidden=document.createElement('input');hidden.type='hidden';hidden.name='turnstileToken';form.append(hidden)}
  const actionByForm={registerForm:'register_member',loginForm:'member_login'};
  const expectedAction=actionByForm[form.id]||'';
  const render=()=>{if(!window.turnstile||form.dataset.turnstileRendered==='1'||!expectedAction)return;form.dataset.turnstileRendered='1';form._akiyaTurnstileWidgetId=window.turnstile.render(slot,{sitekey:key,action:expectedAction,callback:t=>hidden.value=t,'expired-callback':()=>hidden.value='','error-callback':()=>hidden.value=''})};
  if(window.turnstile){render();return}
  if(!document.querySelector('script[data-akiya-turnstile]')){const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.dataset.akiyaTurnstile='1';script.onload=()=>AkiyaUI.turnstileForms().forEach(f=>AkiyaUI.initTurnstile(f));document.head.append(script)}
  const timer=setInterval(()=>{if(window.turnstile){clearInterval(timer);render()}},100);setTimeout(()=>clearInterval(timer),15000);
};
AkiyaUI.resetTurnstile=function(form){if(!form)return;const hidden=form.querySelector('input[name="turnstileToken"]');if(hidden)hidden.value='';const id=form._akiyaTurnstileWidgetId;if(window.turnstile&&id!==undefined&&id!==null){try{window.turnstile.reset(id)}catch(e){}}};
AkiyaUI.turnstileForms=function(){return ['registerForm','loginForm'].map(id=>document.getElementById(id)).filter(Boolean)};
if(window.AkiyaAPI&&typeof AkiyaAPI.submit==='function'){const rawSubmit=AkiyaAPI.submit.bind(AkiyaAPI);AkiyaAPI.submit=async function(){try{return await rawSubmit(...arguments)}finally{AkiyaUI.turnstileForms().forEach(AkiyaUI.resetTurnstile)}}}
document.addEventListener('DOMContentLoaded',()=>AkiyaUI.turnstileForms().forEach(f=>AkiyaUI.initTurnstile(f)));

(function(){
  'use strict';
  const FIRST_TOUCH_KEY='akiya_first_touch_v1';
  const ANON_KEY='akiya_anon_v1';
  const SESSION_KEY='akiya_analytics_session_v1';
  const MAX_AGE_MS=180*24*60*60*1000;
  const cut=(v,n)=>String(v||'').trim().slice(0,n);
  const uid=p=>(window.AkiyaAPI&&AkiyaAPI.uid?AkiyaAPI.uid(p):p+'-'+Date.now().toString(36));
  function anonymousId(){let v=localStorage.getItem(ANON_KEY)||'';if(!v){v=uid('ANON');localStorage.setItem(ANON_KEY,v)}return v.slice(0,80)}
  function sessionId(){let v=sessionStorage.getItem(SESSION_KEY)||'';if(!v){v=uid('SES');sessionStorage.setItem(SESSION_KEY,v)}return v.slice(0,80)}
  function referrerHost(){try{return document.referrer?new URL(document.referrer).hostname.slice(0,180):''}catch(e){return''}}
  function captureFirstTouch(){let old=null;try{old=JSON.parse(localStorage.getItem(FIRST_TOUCH_KEY)||'null')}catch(e){}if(old&&old.capturedAt&&Date.now()-Number(old.capturedAt)<MAX_AGE_MS)return old;const q=new URLSearchParams(location.search),rh=referrerHost();const source=cut(q.get('utm_source')||(rh&&rh!==location.hostname?rh:'direct'),100);const medium=cut(q.get('utm_medium')||(source==='direct'?'(none)':'referral'),100);const obj={capturedAt:Date.now(),source,medium,campaign:cut(q.get('utm_campaign'),160),content:cut(q.get('utm_content'),160),term:cut(q.get('utm_term'),160),partnerCode:cut(q.get('partner_code')||q.get('partner')||q.get('ref'),100),referrerHost:rh,landingPage:cut(location.pathname,240)};try{localStorage.setItem(FIRST_TOUCH_KEY,JSON.stringify(obj))}catch(e){}return obj}
  const first=captureFirstTouch();
  function acquisitionPayload(){const a=first||{};return{analyticsAnonymousId:anonymousId(),analyticsSessionId:sessionId(),analyticsSource:a.source||'direct',analyticsMedium:a.medium||'(none)',analyticsCampaign:a.campaign||'',analyticsContent:a.content||'',analyticsTerm:a.term||'',analyticsPartnerCode:a.partnerCode||'',analyticsReferrerHost:a.referrerHost||'',analyticsLandingPage:a.landingPage||location.pathname}}
  function eventPayload(eventType,details){details=details||{};return Object.assign({},acquisitionPayload(),{eventType:cut(eventType,80),page:cut(details.page||location.pathname,240),contentCategory:cut(details.contentCategory,80),contentId:cut(details.contentId,120),actionLabel:cut(details.actionLabel,120),value:details.value===undefined?'':cut(details.value,40),anonymousId:anonymousId(),sessionId:sessionId()})}
  async function track(eventType,details){const token=window.AkiyaAPI&&AkiyaAPI.token?AkiyaAPI.token():'';if(!token)return{ok:false,skipped:true};try{return await AkiyaAPI.submit('track_event',Object.assign({sessionToken:token},eventPayload(eventType,details)),20000)}catch(e){return{ok:false,skipped:true}}}
  async function publicTrack(eventType,details){try{return await AkiyaAPI.submit('track_public_event',eventPayload(eventType,details),20000)}catch(e){return{ok:false,skipped:true}}}
  function normalizedPath(){let p=location.pathname.replace(/\/+$/,'');if(p.endsWith('.html'))p=p.slice(0,-5);return p||'/'}
  function isRegisterPath(){const p=normalizedPath();return p==='/register'||p.endsWith('/register')}
  window.AkiyaAnalytics={acquisitionPayload,track,publicTrack,anonymousId,sessionId};
  document.addEventListener('DOMContentLoaded',()=>{
    publicTrack('site_visit',{contentCategory:'funnel',contentId:'site',actionLabel:'page_view'});
    if(isRegisterPath())publicTrack('register_view',{contentCategory:'registration',contentId:'member_registration',actionLabel:'view'});
    document.querySelectorAll('a[href*="register"]').forEach(a=>a.addEventListener('click',()=>publicTrack('register_cta_click',{contentCategory:'registration',contentId:'member_registration',actionLabel:'cta_click'}),{passive:true}));
  });
})();

/* AKIYA_REGISTRATION_FIRST_HOME_CTA_V1 */
(function(){
  'use strict';
  document.addEventListener('DOMContentLoaded',()=>{
    const path=location.pathname.replace(/\/+$/,'');
    const isHome=path===''||path==='/'||path.endsWith('/index.html');
    if(!isHome)return;
    const track=(label)=>{try{if(window.AkiyaAnalytics&&window.AkiyaAnalytics.publicTrack)window.AkiyaAnalytics.publicTrack('registration_cta_click',{contentCategory:'registration',contentId:'free_membership',actionLabel:label,value:'0'})}catch(e){}};
    const retarget=(el,label,text,campaign)=>{
      if(!el)return;
      el.textContent=text;
      el.href='register.html?utm_source=homepage&utm_medium=owned&utm_campaign='+campaign;
      el.dataset.registrationFirst='1';
      el.addEventListener('click',()=>track(label),{passive:true});
    };
    retarget(document.querySelector('.home-main-btn'),'hero_free_registration','無料会員登録する','aomori_registration_hero');
    retarget(document.querySelector('.home-cta'),'header_free_registration','無料会員登録','aomori_registration_header');
    const priceBtn=document.querySelector('.home-price-card .btn-primary');
    retarget(priceBtn,'price_free_registration','まず無料会員登録','aomori_registration_price');
    const secure=document.querySelector('.home-secure');
    if(secure)secure.textContent='会員登録は0円・月額0円。登録だけでは料金は発生しません。現地確認が必要になった場合だけ、支払い前に条件と1回3,480円（税込）を確認して依頼できます。';
    const heroBtn=document.querySelector('.home-main-btn');
    if(heroBtn&&!document.querySelector('.home-proof-btn')){
      const proof=document.createElement('a');
      proof.className='btn btn-ghost home-proof-btn';
      proof.href='report-sample.html?utm_source=homepage&utm_medium=owned&utm_campaign=aomori_registration_proof';
      proof.textContent='報告見本を先に見る';
      proof.style.marginLeft='8px';
      proof.addEventListener('click',()=>track('hero_report_sample'),{passive:true});
      heroBtn.insertAdjacentElement('afterend',proof);
    }
  });
})();