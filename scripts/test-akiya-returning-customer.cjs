/* Account-free returning-customer regression: no network, no payment, no dependencies. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dist/assets/pages/guest-request.js','utf8');
const storage=new Map();
const persistent={
 getItem(k){return storage.has(k)?storage.get(k):null},
 setItem(k,v){storage.set(k,String(v))},
 removeItem(k){storage.delete(k)}
};
function formPage(){
 const values={customerName:'',customerEmail:'',customerPhone:'',propertyAddress:'',requestRelationship:'',propertyStatus:'',accessPermission:'',requestConsent:'yes',rememberDetails:'yes'};
 const controls={};const callbacks={};const marks=[];
 for(const [name,value] of Object.entries(values)){
  controls[name]={name,value,tagName:['requestRelationship','propertyStatus','accessPermission'].includes(name)?'SELECT':'INPUT',options:[]};
  if(controls[name].tagName==='SELECT'){
   let opts=name==='requestRelationship'?['','所有者本人','所有者の家族','相続人・共有者','管理を任されている','その他']:name==='propertyStatus'?['','現在空き家','家族が居住中','一時的に不在','相続・売却検討中','その他']:['','所有者本人として依頼する','所有者から許可を得ている','共有者・相続人として必要な調整を済ませている','管理を委任されている'];
   controls[name].options=opts.map(v=>({value:v}));
  }
 }
 const btn={disabled:false,textContent:'依頼を送信する'};
 const form={elements:{namedItem:n=>controls[n]||null},addEventListener:(e,cb)=>callbacks[e]=cb,reportValidity:()=>true,querySelector:(q)=>q.startsWith('button')?btn:null,querySelectorAll:()=>Object.values(controls)};
 const banner={hidden:true},remember={checked:true};
 const extras={requestForm:form,requestStatus:{},savedInfoBanner:banner,rememberDetails:remember,reuseSavedInfo:{addEventListener:(e,cb)=>callbacks.reuse=cb},forgetSavedInfo:{addEventListener:(e,cb)=>callbacks.forget=cb}};
 const location={href:'request.html'},session=new Map();
 const env={
  document:{getElementById:id=>extras[id]||null},
  localStorage:persistent,
  sessionStorage:{setItem:(k,v)=>session.set(k,v),getItem:k=>session.get(k)||null},
  location,
  window:{},
  AkiyaUI:{formData:()=>Object.fromEntries(Object.entries(controls).map(([k,v])=>[k,v.value])),busy:()=>{},show:(_,msg)=>marks.push(msg)},
  AkiyaAPI:{submit:async(a,p)=>{assert.equal(a,'create_guest_request');assert.equal(p.attendancePreference,undefined);return {ok:true,requestId:'AKR-20261113-AABBCCDDEEFF0011',guestToken:'TEST_TOKEN_'.repeat(4),canPayNow:true};}},
 };
 vm.runInNewContext(source,env,{filename:'guest-request.js'});
 return {controls,callbacks,banner,remember,location,session,marks};
}
(async()=>{
 const first=formPage();
 Object.assign(first.controls.customerName,{value:'テスト利用者'});
 Object.assign(first.controls.customerEmail,{value:'unit-test@example.com'});
 Object.assign(first.controls.customerPhone,{value:'09012345678'});
 Object.assign(first.controls.propertyAddress,{value:'青森県青森市架空町1-1'});
 Object.assign(first.controls.requestRelationship,{value:'所有者本人'});
 Object.assign(first.controls.propertyStatus,{value:'現在空き家'});
 Object.assign(first.controls.accessPermission,{value:'所有者本人として依頼する'});
 await first.callbacks.submit({preventDefault(){}});
 assert(first.location.href.includes('checkout.html?request_id=AKR-'));
 assert.equal(first.session.get('akiya_pending_guest_request_id'),'AKR-20261113-AABBCCDDEEFF0011');
 const saved=JSON.parse(persistent.getItem('akiya_customer_prefill_v1'));
 assert.equal(saved.data.customerName,'テスト利用者');
 assert.equal(saved.data.propertyAddress,'青森県青森市架空町1-1');
 assert.equal(saved.data.accessPermission,undefined,'Permission must be reconfirmed');
 assert.equal(saved.data.requestConsent,undefined,'Agreement must be reconfirmed');
 const repeat=formPage();
 assert.equal(repeat.banner.hidden,false,'Saved-information banner should appear');
 assert.equal(repeat.controls.customerName.value,'テスト利用者');
 assert.equal(repeat.controls.customerEmail.value,'unit-test@example.com');
 assert.equal(repeat.controls.propertyAddress.value,'青森県青森市架空町1-1');
 assert.equal(repeat.controls.accessPermission.value,'','Permission must not be silently reused');
 repeat.controls.customerName.value='変更後';
 repeat.callbacks.reuse();
 assert.equal(repeat.controls.customerName.value,'テスト利用者','Reuse button restores saved data');
 repeat.callbacks.forget();
 assert.equal(persistent.getItem('akiya_customer_prefill_v1'),null,'Delete button removes saved personal data');
 assert.equal(repeat.controls.customerName.value,'テスト利用者','Delete should not erase unsent input');
 const noSave=formPage();
 Object.assign(noSave.controls.customerName,{value:'テスト利用者'});
 Object.assign(noSave.controls.customerEmail,{value:'unit-test@example.com'});
 Object.assign(noSave.controls.propertyAddress,{value:'青森県青森市架空町1-1'});
 noSave.remember.checked=false;
 await noSave.callbacks.submit({preventDefault(){}});
 assert.equal(persistent.getItem('akiya_customer_prefill_v1'),null,'Opt-out must not save data');
 console.log('PASS: initial submit, safe local storage, repeat autofill, permission reconfirmation, delete, opt-out, no attendance');
})().catch(e=>{console.error(e);process.exitCode=1});
