'use strict';
let registrationStarted=false;
const publicTrack=(type,label,value)=>{
  if(!window.AkiyaAnalytics||!AkiyaAnalytics.publicTrack)return;
  AkiyaAnalytics.publicTrack(type,{contentCategory:'registration',contentId:'member_registration',actionLabel:label||'',value:value===undefined?'':value});
};
const params=new URLSearchParams(location.search);
const campaign=()=>params.get('utm_campaign')||'';
const paidIntentCampaign=()=>/^aomori_paid_intent_/.test(campaign());
const registrationIntentContext=()=>{
  const c=campaign();
  if(/one_time|photo_report|remote_snapshot/.test(c)){
    return {
      key:'one_time_check',
      html:'<b>1回だけの現地確認を見て来た方へ</b><br>無料会員登録後、必要な場合だけ青森市の現地確認（1回3,480円・税込）を別途依頼できます。登録だけでは課金されません。無料チェックリストは登録後すぐ使えます。'
    };
  }
  if(/checklist|free_member|family_chat/.test(c)){
    return {
      key:'checklist',
      html:'<b>無料チェックリストを使いたい方へ</b><br>登録後すぐ、確認済み・未確認を保存できる会員版チェックリストへ進めます。登録料0円・月額0円。現地確認の申込みは必須ではありません。'
    };
  }
  return null;
};
document.addEventListener('DOMContentLoaded',()=>{
  const hero=document.querySelector('.page-hero');
  const formSection=document.getElementById('free-register');
  const heroCta=document.querySelector('.page-hero a[href="#free-register"]');
  const heroSecondary=document.querySelector('.page-hero a.btn-ghost[href="aomori-vacant-house-checklist.html"]');

  // Registration-page visitors were reaching the page but not starting the form.
  // Keep the value proposition in the hero, then place the 3-field form immediately after it.
  // Preview/proof content remains on the same page below the form.
  if(hero&&formSection&&hero.nextElementSibling!==formSection){
    hero.insertAdjacentElement('afterend',formSection);
  }

  const context=registrationIntentContext();
  if(context&&formSection){
    const wrap=formSection.querySelector('.wrap.form-shell');
    if(wrap&&!wrap.querySelector('[data-registration-intent-context]')){
      const notice=document.createElement('div');
      notice.className='notice';
      notice.dataset.registrationIntentContext=context.key;
      notice.style.marginBottom='18px';
      notice.innerHTML=context.html;
      wrap.insertAdjacentElement('afterbegin',notice);
      publicTrack('registration_intent_context_view',context.key);
    }
  }

  if(formSection&&'IntersectionObserver' in window){
    let seen=false;
    const observer=new IntersectionObserver(entries=>{
      if(!seen&&entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>=0.25)){
        seen=true;
        publicTrack('register_form_view','form_visible');
        observer.disconnect();
      }
    },{threshold:[0.25]});
    observer.observe(formSection);
  }

  if(heroCta){
    heroCta.textContent='3項目で無料チェックリストを使う';
    heroCta.setAttribute('aria-label','3項目を入力して実家・空き家の状況整理チェックリストを無料で使う');
    heroCta.addEventListener('click',()=>publicTrack('register_cta_click','hero_primary'));
  }
  if(heroSecondary){
    heroSecondary.addEventListener('click',()=>publicTrack('checklist_preview_click','hero_secondary'));
  }
  document.querySelectorAll('a[href="#free-register"]').forEach((a,i)=>{
    if(a===heroCta)return;
    a.addEventListener('click',()=>publicTrack('register_cta_click',`inline_${i+1}`));
  });
});
registerForm.addEventListener('input',()=>{
  if(!registrationStarted){registrationStarted=true;publicTrack('register_start','first_input')}
});
registerForm.addEventListener('change',()=>{
  if(!registrationStarted){registrationStarted=true;publicTrack('register_start','first_change')}
});
registerForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const box=registerStatus,btn=e.submitter;
  publicTrack('register_submit_attempt','submit_clicked');
  const d=AkiyaUI.formData(registerForm);
  if(window.AkiyaAnalytics)Object.assign(d,AkiyaAnalytics.acquisitionPayload());
  if(!d.name){publicTrack('register_client_validation_error','name_missing');return AkiyaUI.show(box,'お名前を入力してください。')}
  if(!d.email){publicTrack('register_client_validation_error','email_missing');return AkiyaUI.show(box,'メールアドレスを入力してください。')}
  if(!AkiyaUI.requirePassword(d.password)){publicTrack('register_client_validation_error','password_too_short');return AkiyaUI.show(box,'パスワードは6文字以上で入力してください。')}
  if(!d.requiredConsent){publicTrack('register_client_validation_error','required_consent_missing');return AkiyaUI.show(box,'規約とプライバシーポリシーへの同意が必要です。')}
  AkiyaUI.busy(btn,true);
  try{
    const r=await AkiyaAPI.submit('register_member',d);
    if(!r.ok){publicTrack('register_server_error',String(r.code||'server_rejected'));return AkiyaUI.show(box,r.message||'登録できませんでした。')}
    AkiyaAPI.setToken(r.sessionToken);
    sessionStorage.setItem('akiya_registered_name',d.name);
    if(paidIntentCampaign()){
      publicTrack('paid_intent_registration_complete','continue_to_request','3480');
      location.href='request.html?from=paid_intent_registration';
    }else{
      location.href='register-complete.html';
    }
  }catch(err){
    publicTrack('register_server_error','network_or_exception');
    AkiyaUI.show(box,err.message);
  }finally{AkiyaUI.busy(btn,false)}
});
