/* AKIYA_LEGACY_GITHUB_REDIRECT_V1 */
(function(){
  if(location.hostname==='nknkny.github.io'&&location.pathname.startsWith('/Homepage/akiya-pocket/')&&!location.pathname.startsWith('/Homepage/akiya-pocket/control-center/')){
    const tail=location.pathname.slice('/Homepage/akiya-pocket/'.length);
    location.replace('https://akiya-pocket-aomori.pages.dev/'+tail+location.search+location.hash);
  }
})();
(function(){
 const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
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
 let slot=form.querySelector('.turnstile-slot');if(!slot){slot=document.createElement('div');slot.className='turnstile-slot';const status=form.querySelector('.status-box');(status||form.lastElementChild).before(slot)}
 let hidden=form.querySelector('input[name="turnstileToken"]');if(!hidden){hidden=document.createElement('input');hidden.type='hidden';hidden.name='turnstileToken';form.append(hidden)}
 const actionByForm={registerForm:'register_member',loginForm:'member_login'},expectedAction=actionByForm[form.id]||'';
 const render=()=>{if(!window.turnstile||form.dataset.turnstileRendered==='1'||!expectedAction)return;form.dataset.turnstileRendered='1';form._akiyaTurnstileWidgetId=window.turnstile.render(slot,{sitekey:key,action:expectedAction,callback:t=>hidden.value=t,'expired-callback':()=>hidden.value='','error-callback':()=>hidden.value=''})};
 if(window.turnstile){render();return}
 if(!document.querySelector('script[data-akiya-turnstile]')){const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.dataset.akiyaTurnstile='1';script.onload=()=>AkiyaUI.turnstileForms().forEach(f=>AkiyaUI.initTurnstile(f));document.head.append(script)}
 const timer=setInterval(()=>{if(window.turnstile){clearInterval(timer);render()}},100);setTimeout(()=>clearInterval(timer),15000);
};
AkiyaUI.resetTurnstile=function(form){if(!form)return;const hidden=form.querySelector('input[name="turnstileToken"]');if(hidden)hidden.value='';const id=form._akiyaTurnstileWidgetId;if(window.turnstile&&id!==undefined&&id!==null){try{window.turnstile.reset(id)}catch{}}};
AkiyaUI.turnstileForms=function(){return ['registerForm','loginForm'].map(id=>document.getElementById(id)).filter(Boolean)};
if(window.AkiyaAPI&&typeof AkiyaAPI.submit==='function'){const rawSubmit=AkiyaAPI.submit.bind(AkiyaAPI);AkiyaAPI.submit=async function(){try{return await rawSubmit(...arguments)}finally{AkiyaUI.turnstileForms().forEach(AkiyaUI.resetTurnstile)}}}
document.addEventListener('DOMContentLoaded',()=>AkiyaUI.turnstileForms().forEach(f=>AkiyaUI.initTurnstile(f)));

/* Full-funnel attribution: immutable first touch + per-session touch. */
(function(){
 'use strict';
 const FIRST_TOUCH_KEY='akiya_first_touch_v2',SESSION_TOUCH_KEY='akiya_session_touch_v2',ANON_KEY='akiya_anon_v1',SESSION_KEY='akiya_analytics_session_v1',MAX_AGE_MS=180*24*60*60*1000;
 const cut=(v,n)=>String(v||'').trim().slice(0,n),uid=p=>(window.AkiyaAPI&&AkiyaAPI.uid?AkiyaAPI.uid(p):p+'-'+Date.now().toString(36));
 function safeGet(store,key){try{return store.getItem(key)||''}catch{return''}}function safeSet(store,key,val){try{store.setItem(key,val)}catch{}}
 function anonymousId(){let v=safeGet(localStorage,ANON_KEY);if(!v){v=uid('ANON');safeSet(localStorage,ANON_KEY,v)}return v.slice(0,100)}
 function sessionId(){let v=safeGet(sessionStorage,SESSION_KEY);if(!v){v=uid('SES');safeSet(sessionStorage,SESSION_KEY,v)}return v.slice(0,100)}
 function referrerHost(){try{return document.referrer?new URL(document.referrer).hostname.slice(0,180):''}catch{return''}}
 function touch(){const q=new URLSearchParams(location.search),rh=referrerHost(),external=rh&&rh!==location.hostname;const source=cut(q.get('utm_source')||(external?rh:'direct'),100);return{capturedAt:Date.now(),source,medium:cut(q.get('utm_medium')||(source==='direct'?'(none)':'referral'),100),campaign:cut(q.get('utm_campaign'),160),content:cut(q.get('utm_content'),160),term:cut(q.get('utm_term'),160),partnerCode:cut(q.get('partner_code')||q.get('partner')||q.get('ref'),100),referrerHost:rh,landingPage:cut(location.pathname,240)}}
 function firstTouch(){let old=null;try{old=JSON.parse(safeGet(localStorage,FIRST_TOUCH_KEY)||'null')}catch{}if(old&&old.capturedAt&&Date.now()-Number(old.capturedAt)<MAX_AGE_MS)return old;const x=touch();safeSet(localStorage,FIRST_TOUCH_KEY,JSON.stringify(x));return x}
 function sessionTouch(){let old=null;try{old=JSON.parse(safeGet(sessionStorage,SESSION_TOUCH_KEY)||'null')}catch{}if(old&&old.capturedAt)return old;const x=touch();safeSet(sessionStorage,SESSION_TOUCH_KEY,JSON.stringify(x));return x}
 const first=firstTouch(),session=sessionTouch();
 function audienceJob(pathname=location.pathname){const p=pathname.toLowerCase();if(p.includes('remote-home'))return'remote_home';if(p.includes('inherited-home'))return'inheritance';if(p.includes('parent-facility'))return'parent_facility';if(p.includes('vacant-home-notice'))return'notice_received';if(p.includes('vacant-home-weeds'))return'weeds_grounds';if(p.includes('after-storm'))return'after_storm';if(p.includes('snow-vacant'))return'snow';if(p.includes('one-time-check'))return'one_time_check';if(p.includes('photo-report')||p.includes('report-sample'))return'report_proof';if(p.includes('checklist'))return'checklist';if(p.includes('register'))return'free_membership';if(p.includes('aomori-city'))return'aomori_city';return'general'}
 function acquisitionPayload(){return{analyticsAnonymousId:anonymousId(),analyticsSessionId:sessionId(),analyticsSource:first.source||'direct',analyticsMedium:first.medium||'(none)',analyticsCampaign:first.campaign||'',analyticsContent:first.content||'',analyticsTerm:first.term||'',analyticsPartnerCode:first.partnerCode||'',analyticsReferrerHost:first.referrerHost||'',analyticsLandingPage:first.landingPage||location.pathname,analyticsSessionSource:session.source||'direct',analyticsSessionMedium:session.medium||'(none)',analyticsSessionCampaign:session.campaign||'',analyticsSessionContent:session.content||'',analyticsSessionTerm:session.term||'',analyticsSessionReferrerHost:session.referrerHost||'',analyticsSessionLandingPage:session.landingPage||location.pathname}}
 function eventPayload(eventType,details){details=details||{};return Object.assign({},acquisitionPayload(),{eventType:cut(eventType,80),page:cut(details.page||location.pathname,240),contentCategory:cut(details.contentCategory,80),contentId:cut(details.contentId,120),actionLabel:cut(details.actionLabel,120),value:details.value===undefined?'':cut(details.value,80),audienceJob:cut(details.audienceJob||audienceJob(),100),anonymousId:anonymousId(),sessionId:sessionId()})}
 async function track(eventType,details){const token=window.AkiyaAPI&&AkiyaAPI.token?AkiyaAPI.token():'';if(!token)return{ok:false,skipped:true};try{return await AkiyaAPI.submit('track_event',Object.assign({sessionToken:token},eventPayload(eventType,details)),20000)}catch{return{ok:false,skipped:true}}}
 async function publicTrack(eventType,details){try{return await AkiyaAPI.submit('track_public_event',eventPayload(eventType,details),20000)}catch{return{ok:false,skipped:true}}}
 function norm(){let p=location.pathname.replace(/\/+$/,'');if(p.endsWith('.html'))p=p.slice(0,-5);return p||'/'}
 window.AkiyaAnalytics={acquisitionPayload,track,publicTrack,anonymousId,sessionId,audienceJob};
 document.addEventListener('DOMContentLoaded',()=>{
   const job=audienceJob();publicTrack('site_visit',{contentCategory:'funnel',contentId:'site',actionLabel:'page_view',audienceJob:job});
   const p=norm();if(['/remote-home-aomori','/inherited-home-aomori','/parent-facility-home-aomori','/vacant-home-notice-aomori','/vacant-home-weeds-aomori','/vacant-home-after-storm-aomori','/snow-vacant-home-aomori','/aomori-vacant-house-one-time-check'].some(x=>p.endsWith(x)))publicTrack('trigger_page_view',{contentCategory:'intent_landing',contentId:p,actionLabel:'view',audienceJob:job});
   if(p.endsWith('/register'))publicTrack('register_view',{contentCategory:'registration',contentId:'member_registration',actionLabel:'view',audienceJob:job});
   if(p.endsWith('/report-sample')||p.endsWith('/aomori-vacant-house-photo-report')){publicTrack('report_sample_view',{contentCategory:'proof',contentId:p,actionLabel:'view',audienceJob:job});publicTrack('value_engagement',{contentCategory:'proof',contentId:p,actionLabel:'report_view',audienceJob:job})}
   if(p.endsWith('/aomori-vacant-house-checklist'))publicTrack('value_engagement',{contentCategory:'value_first',contentId:'aomori_vacant_house_checklist',actionLabel:'checklist_view',audienceJob:job});
   if(p.endsWith('/aomori-vacant-house-one-time-check'))publicTrack('one_time_check_view',{contentCategory:'service',contentId:'one_time_check',actionLabel:'view',value:'3480',audienceJob:job});
   document.querySelectorAll('a[href]').forEach(a=>a.addEventListener('click',()=>{const href=String(a.getAttribute('href')||'');if(href.includes('register'))publicTrack('register_cta_click',{contentCategory:'registration',contentId:'member_registration',actionLabel:a.textContent||'cta',audienceJob:job});else if(href.includes('report-sample')||href.includes('photo-report'))publicTrack('trigger_cta_click',{contentCategory:'proof',contentId:'report',actionLabel:a.textContent||'cta',audienceJob:job});else if(href.includes('checklist'))publicTrack('trigger_cta_click',{contentCategory:'value_first',contentId:'checklist',actionLabel:a.textContent||'cta',audienceJob:job});else if(href.includes('one-time-check'))publicTrack('trigger_cta_click',{contentCategory:'service',contentId:'one_time_check',actionLabel:a.textContent||'cta',audienceJob:job})},{passive:true}));
 });
})();

/* Keep public analytics reliable during page unload/navigation. */
(function(){
 'use strict';if(!window.AkiyaAPI||typeof AkiyaAPI.submit!=='function')return;const rawSubmit=AkiyaAPI.submit.bind(AkiyaAPI);
 AkiyaAPI.submit=async function(action,data,timeout){if(String(action||'')!=='track_public_event')return rawSubmit(action,data,timeout);const endpoint=String((window.AKIYA_CONFIG&&window.AKIYA_CONFIG.API_URL)||'').trim();if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/akiya-pocket-api$/i.test(endpoint))return rawSubmit(action,data,timeout);const clientRequestId=AkiyaAPI.uid('track_public_event'),payload=Object.assign({},data||{},{action:'track_public_event',clientRequestId});try{const r=await fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const x=await r.json().catch(()=>null);return x&&typeof x==='object'?x:{ok:r.ok}}catch{return rawSubmit(action,data,timeout)}};
})();

/* Checklist micro-commitment and measurable value engagement. */
(function(){
 'use strict';document.addEventListener('DOMContentLoaded',()=>{let path=location.pathname.replace(/\/+$/,'');if(path.endsWith('.html'))path=path.slice(0,-5);if(!path.endsWith('/aomori-vacant-house-checklist'))return;const panel=document.querySelector('.section .panel');if(!panel)return;const boxes=Array.from(panel.querySelectorAll('.choice input[type="checkbox"]'));if(!boxes.length)return;const grid=panel.querySelector('.grid-2'),notice=panel.querySelector('.notice'),actions=panel.querySelector('.form-actions'),primary=actions&&actions.querySelector('a[href*="register"]'),secondary=actions&&actions.querySelector('a[href^="#"]');const progress=document.createElement('div');progress.setAttribute('aria-live','polite');progress.className='check-progress';progress.innerHTML='<p><b id="akiyaChecklistCount">0 / '+boxes.length+' 項目を確認済み</b></p><div class="check-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="'+boxes.length+'" aria-valuenow="0"><span></span></div><p class="small muted">分からない項目は「未確認」のままで構いません。</p>';if(grid)grid.insertAdjacentElement('afterend',progress);else panel.insertBefore(progress,notice||actions||null);if(secondary){secondary.className='small muted';secondary.textContent='まだ保存せず、このまま公開版を続ける'}let firstTracked=false;const update=()=>{const count=boxes.filter(x=>x.checked).length,label=progress.querySelector('#akiyaChecklistCount'),bar=progress.querySelector('[role="progressbar"]'),fill=bar&&bar.querySelector('span');if(label)label.textContent=count+' / '+boxes.length+' 項目を確認済み';if(bar)bar.setAttribute('aria-valuenow',String(count));if(fill)fill.style.width=(100*count/boxes.length)+'%';if(primary)primary.textContent=count>0?count+'項目のチェック状態を無料で保存する':'チェック状態を無料で保存する';if(window.AkiyaAnalytics){AkiyaAnalytics.publicTrack('checklist_progress',{contentCategory:'value_first',contentId:'aomori_vacant_house_checklist',actionLabel:firstTracked?'progress_changed':'first_check',value:String(count),audienceJob:'checklist'});if(!firstTracked)AkiyaAnalytics.publicTrack('value_engagement',{contentCategory:'value_first',contentId:'aomori_vacant_house_checklist',actionLabel:'first_check',value:String(count),audienceJob:'checklist'});firstTracked=true}};boxes.forEach(b=>b.addEventListener('change',update));});
})();
