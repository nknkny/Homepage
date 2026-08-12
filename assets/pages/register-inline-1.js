'use strict';
const prefs=['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
for(const id of ['residencePrefecture','propertyPrefecture']){const s=document.getElementById(id);prefs.forEach(p=>s.add(new Option(p,p)))}

let registrationStarted=false,propertyStarted=false;
const publicTrack=(type,label,value)=>{
  if(!window.AkiyaAnalytics||!AkiyaAnalytics.publicTrack)return;
  AkiyaAnalytics.publicTrack(type,{contentCategory:'registration',contentId:'member_registration',actionLabel:label||'',value:value===undefined?'':value});
};
registerForm.addEventListener('input',()=>{
  if(!registrationStarted){registrationStarted=true;publicTrack('register_start','first_input')}
});
registerForm.addEventListener('change',e=>{
  if(!registrationStarted){registrationStarted=true;publicTrack('register_start','first_change')}
  if(!propertyStarted&&['propertyPrefecture','propertyCity','relationship','propertyStatus'].includes(e.target&&e.target.id)){
    propertyStarted=true;publicTrack('register_property_start','property_section_started');
  }
});
registerForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const box=registerStatus,btn=e.submitter;
  publicTrack('register_submit_attempt','submit_clicked');
  const d=AkiyaUI.formData(registerForm);
  if(window.AkiyaAnalytics)Object.assign(d,AkiyaAnalytics.acquisitionPayload());
  if(!d.email){publicTrack('register_client_validation_error','email_missing');return AkiyaUI.show(box,'メールアドレスを入力してください。')}
  if(!AkiyaUI.requirePassword(d.password)){publicTrack('register_client_validation_error','password_too_short');return AkiyaUI.show(box,'パスワードは6文字以上で入力してください。')}
  if(d.password!==passwordConfirm.value){publicTrack('register_client_validation_error','password_mismatch');return AkiyaUI.show(box,'確認用パスワードが一致しません。')}
  if(!d.propertyPrefecture||!d.propertyCity){publicTrack('register_client_validation_error','property_location_missing');return AkiyaUI.show(box,'実家・空き家の都道府県と市区町村を入力してください。')}
  if(!d.relationship||!d.propertyStatus){publicTrack('register_client_validation_error','property_context_missing');return AkiyaUI.show(box,'物件との関係と現在の状況を選択してください。')}
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
