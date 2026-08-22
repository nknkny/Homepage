'use strict';
let registrationStarted=false;
const publicTrack=(type,label,value)=>{
  if(!window.AkiyaAnalytics||!AkiyaAnalytics.publicTrack)return;
  AkiyaAnalytics.publicTrack(type,{contentCategory:'registration',contentId:'member_registration',actionLabel:label||'',value:value===undefined?'':value});
};
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
  if(d.password!==passwordConfirm.value){publicTrack('register_client_validation_error','password_mismatch');return AkiyaUI.show(box,'確認用パスワードが一致しません。')}
  if(!d.requiredConsent){publicTrack('register_client_validation_error','required_consent_missing');return AkiyaUI.show(box,'規約とプライバシーポリシーへの同意が必要です。')}
  AkiyaUI.busy(btn,true);
  try{
    const r=await AkiyaAPI.submit('register_member',d);
    if(!r.ok){publicTrack('register_server_error',String(r.code||'server_rejected'));return AkiyaUI.show(box,r.message||'登録できませんでした。')}
    AkiyaAPI.setToken(r.sessionToken);
    sessionStorage.setItem('akiya_registered_name',d.name);
    location.href='register-complete.html';
  }catch(err){
    publicTrack('register_server_error','network_or_exception');
    AkiyaUI.show(box,err.message);
  }finally{AkiyaUI.busy(btn,false)}
});
