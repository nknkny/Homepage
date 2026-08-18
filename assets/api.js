(function(){
  'use strict';
  const cfg=window.AKIYA_CONFIG||{};
  const apiUrl=String(cfg.API_URL||'').trim();
  const paymentApiUrl=String(cfg.PAYMENT_API_URL||'').trim();
  const requiredBuild=String(cfg.REQUIRED_API_BUILD||'').trim();
  const siteOrigin=String(cfg.SITE_ORIGIN||'').trim();
  const defaultTimeout=Math.max(15000,Math.min(90000,Number(cfg.API_TIMEOUT_MS)||45000));

  function randomHex(bytes){
    const b=new Uint8Array(bytes);
    if(window.crypto&&crypto.getRandomValues)crypto.getRandomValues(b);
    else for(let i=0;i<b.length;i++)b[i]=Math.floor(Math.random()*256);
    return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  function uid(prefix='WEB'){return prefix+'-'+Date.now().toString(36).toUpperCase()+'-'+randomHex(12)}
  function validApiUrl(url){return /^https:\/\/fpgtwgtoqtokpitzlbie\.supabase\.co\/functions\/v1\/akiya-pocket-(?:api|payment-api)$/.test(url)}
  function validSiteOrigin(origin){return /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)&&origin===window.location.origin}
  function normalizedResult(result,clientRequestId,checkBuild){
    if(!result||typeof result!=='object')return{ok:false,code:'INVALID_API_RESPONSE',message:'サーバーから正しい応答を受信できませんでした。'};
    if(checkBuild&&requiredBuild&&result.buildVersion!==requiredBuild)return{ok:false,code:'API_VERSION_MISMATCH',message:'システム更新中です。しばらく時間をおいて再度お試しください。',buildVersion:result.buildVersion||''};
    if(checkBuild&&result.clientRequestId!==clientRequestId)return{ok:false,code:'RESPONSE_ID_MISMATCH',message:'通信結果を確認できませんでした。もう一度お試しください。'};
    return result;
  }
  async function submit(action,data,timeout){
    if(!validSiteOrigin(siteOrigin))return{ok:false,code:'SITE_ORIGIN_MISMATCH',message:'このページからは登録・依頼受付を利用できません。公式サイトを開き直してください。'};
    const isPayment=action==='start_card_payment'||action==='verify_card_payment';
    const target=isPayment?paymentApiUrl:apiUrl;
    if(!validApiUrl(target))return{ok:false,code:'API_NOT_DEPLOYED',message:'現在、登録・依頼受付を利用できません。時間をおいて再度お試しください。'};
    const clientRequestId=uid(String(action||'WEB').slice(0,18).replace(/[^A-Za-z0-9_-]/g,'_'));
    const payload=Object.assign({},data||{},{action:String(action||''),clientRequestId});
    const controller=new AbortController();
    const wait=Math.max(15000,Math.min(90000,Number(timeout)||defaultTimeout));
    const timer=setTimeout(()=>controller.abort(),wait);
    try{
      const r=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal,credentials:'omit',cache:'no-store'});
      let result=null;
      try{result=await r.json()}catch{}
      if(!result||typeof result!=='object')throw new Error('サーバーから正しい応答を受信できませんでした。');
      return normalizedResult(result,clientRequestId,!isPayment);
    }catch(err){
      if(err&&err.name==='AbortError')throw new Error('通信がタイムアウトしました。入力内容は保持されています。時間をおいて再度お試しください。');
      throw new Error((err&&err.message)||'通信できませんでした。時間をおいて再度お試しください。');
    }finally{clearTimeout(timer)}
  }
  function token(){
    const legacy=localStorage.getItem('akiya_session')||'';
    if(legacy){sessionStorage.setItem('akiya_session',legacy);localStorage.removeItem('akiya_session')}
    return sessionStorage.getItem('akiya_session')||''
  }
  function setToken(value){
    localStorage.removeItem('akiya_session');
    value?sessionStorage.setItem('akiya_session',String(value)):sessionStorage.removeItem('akiya_session')
  }
  window.AkiyaAPI={submit,token,setToken,uid};
})();
