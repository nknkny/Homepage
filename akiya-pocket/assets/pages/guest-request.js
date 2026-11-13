'use strict';
(function(){
  const f=document.getElementById('requestForm'),status=document.getElementById('requestStatus');
  if(!f)return;
  const KEY='akiya_customer_prefill_v1',DAYS=180,fields=['customerName','customerEmail','customerPhone','propertyAddress','requestRelationship','propertyStatus'];
  const banner=document.getElementById('savedInfoBanner'),remember=document.getElementById('rememberDetails');
  const get=(key)=>{try{return localStorage.getItem(key)}catch{return null}};
  const del=()=>{try{localStorage.removeItem(KEY)}catch{}};
  function readSaved(){
    try{const v=JSON.parse(get(KEY)||'null');if(!v||v.version!==1||!v.savedAt||Date.now()-v.savedAt>DAYS*86400000){del();return null}
      if(!v.data||typeof v.data!=='object')return null;return v.data;
    }catch{return null}
  }
  function fill(data){
    for(const key of fields){const el=f.elements.namedItem(key);if(!el||!Object.hasOwn(data,key))continue;
      const value=String(data[key]??'').slice(0,240);
      if(el.tagName==='SELECT'){if(Array.from(el.options).some(x=>x.value===value))el.value=value}
      else el.value=value;
    }
  }
  let previous=readSaved();
  if(previous){fill(previous);banner.hidden=false;}
  document.getElementById('reuseSavedInfo')?.addEventListener('click',()=>{const v=readSaved();if(v){fill(v);AkiyaUI.show(status,'前回の情報を入力しました。内容をご確認ください。',true)}});
  document.getElementById('forgetSavedInfo')?.addEventListener('click',()=>{del();previous=null;banner.hidden=true;remember.checked=false;AkiyaUI.show(status,'保存した入力情報を削除しました。現在の入力内容は残っています。',true)});
  function save(){
    if(!remember?.checked){del();return}
    const data={};
    for(const key of fields){const el=f.elements.namedItem(key);if(el)data[key]=String(el.value||'').slice(0,240)}
    try{localStorage.setItem(KEY,JSON.stringify({version:1,savedAt:Date.now(),data}))}catch{}
  }
  f.addEventListener('submit',async function(ev){
    ev.preventDefault();if(!f.reportValidity())return;
    const btn=f.querySelector('button[type="submit"]');AkiyaUI.busy(btn,true);
    try{
      const data=AkiyaUI.formData(f);
      delete data.rememberDetails;
      if(window.AkiyaAnalytics)Object.assign(data,AkiyaAnalytics.acquisitionPayload());
      const r=await AkiyaAPI.submit('create_guest_request',data);
      if(!r.ok)throw Error(r.message||'送信に失敗しました。');
      save();
      sessionStorage.setItem('akiya_guest_'+r.requestId,r.guestToken);
      sessionStorage.setItem('akiya_pending_guest_request_id',r.requestId);
      AkiyaUI.show(status,'受付番号 '+r.requestId+'：'+(r.message||'依頼を受け付けました。'),true);
      if(r.canPayNow)location.href='checkout.html?request_id='+encodeURIComponent(r.requestId);
      else {
        for(const el of f.querySelectorAll('input,select,textarea,button'))el.disabled=true;
        status.scrollIntoView({behavior:'smooth',block:'center'});
      }
    }catch(err){AkiyaUI.show(status,err?.message||'通信に失敗しました。')}
    finally{AkiyaUI.busy(btn,false)}
  });
})();