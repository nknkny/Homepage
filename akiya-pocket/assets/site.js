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

/* AKIYA_VALUE_FIRST_ANALYTICS_KEEPALIVE_V1 */
(function(){
  'use strict';
  if(!window.AkiyaAPI||typeof AkiyaAPI.submit!=='function')return;
  const rawSubmit=AkiyaAPI.submit.bind(AkiyaAPI);
  AkiyaAPI.submit=async function(action,data,timeout){
    if(String(action||'')!=='track_public_event')return rawSubmit(action,data,timeout);
    const endpoint=String((window.AKIYA_CONFIG&&window.AKIYA_CONFIG.API_URL)||'').trim();
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/akiya-pocket-api$/i.test(endpoint))return rawSubmit(action,data,timeout);
    const clientRequestId=AkiyaAPI.uid('track_public_event');
    const payload=Object.assign({},data||{},{action:'track_public_event',clientRequestId});
    try{
      const r=await fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const x=await r.json().catch(()=>null);
      return x&&typeof x==='object'?x:{ok:r.ok};
    }catch(e){return rawSubmit(action,data,timeout)}
  };
})();

/* AKIYA_VALUE_FIRST_CHECKLIST_MICROCOMMITMENT_V1 */
(function(){
  'use strict';
  document.addEventListener('DOMContentLoaded',()=>{
    let path=location.pathname.replace(/\/+$/,'');if(path.endsWith('.html'))path=path.slice(0,-5);
    if(!path.endsWith('/aomori-vacant-house-checklist'))return;
    const panel=document.querySelector('.section .panel');
    if(!panel)return;
    const boxes=Array.from(panel.querySelectorAll('.choice input[type="checkbox"]'));
    if(!boxes.length)return;
    const grid=panel.querySelector('.grid-2');
    const notice=panel.querySelector('.notice');
    const actions=panel.querySelector('.form-actions');
    const primary=actions&&actions.querySelector('a[href*="register"]');
    const secondary=actions&&actions.querySelector('a[href^="#"]');
    const progress=document.createElement('div');
    progress.setAttribute('aria-live','polite');
    progress.style.margin='16px 0 0';
    progress.innerHTML='<p style="margin:0 0 7px"><b id="akiyaChecklistCount">0 / '+boxes.length+' 項目を確認済み</b></p><div role="progressbar" aria-valuemin="0" aria-valuemax="'+boxes.length+'" aria-valuenow="0" style="height:8px;border-radius:999px;background:#e8edf3;overflow:hidden"><span style="display:block;width:0;height:100%;background:currentColor;transition:width .2s ease"></span></div><p class="small muted" style="margin:8px 0 0">チェックできない項目は「未確認」のままで構いません。まず分かっていることだけ整理してください。</p>';
    if(grid)grid.insertAdjacentElement('afterend',progress);else panel.insertBefore(progress,notice||actions||null);
    if(secondary){secondary.className='small muted';secondary.textContent='まだ保存せず、このまま公開版を続ける';secondary.style.display='inline-block';secondary.style.margin='10px 0 0'}
    let firstTracked=false;
    const update=()=>{
      const count=boxes.filter(x=>x.checked).length;
      const label=progress.querySelector('#akiyaChecklistCount');
      const bar=progress.querySelector('[role="progressbar"]');
      const fill=bar&&bar.querySelector('span');
      if(label)label.textContent=count+' / '+boxes.length+' 項目を確認済み';
      if(bar)bar.setAttribute('aria-valuenow',String(count));
      if(fill)fill.style.width=(100*count/boxes.length)+'%';
      if(primary)primary.textContent=count>0?count+'項目のチェック状態を無料で保存する':'チェック状態を無料で保存する';
      if(window.AkiyaAnalytics&&window.AkiyaAnalytics.publicTrack){
        AkiyaAnalytics.publicTrack('checklist_progress',{contentCategory:'value_first',contentId:'aomori_vacant_house_checklist',actionLabel:firstTracked?'progress_changed':'first_check',value:String(count)});
        firstTracked=true;
      }
    };
    boxes.forEach(b=>b.addEventListener('change',update));
  });
})();