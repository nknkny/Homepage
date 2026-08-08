(function(){
  'use strict';
  const cfg=window.AKIYA_CONFIG||{};
  const pending=new Map();
  const apiUrl=String(cfg.API_URL||'').trim();
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
  function validApiUrl(url){return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)}
  function validSiteOrigin(origin){return /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)&&origin===window.location.origin}
  function trustedApiMessageOrigin(origin){
    origin=String(origin||'');
    return origin==='https://script.google.com'||origin==='https://script.googleusercontent.com'||/^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/i.test(origin);
  }
  function normalizedResult(result,clientRequestId){
    if(!result||typeof result!=='object')return{ok:false,code:'INVALID_API_RESPONSE',message:'サーバーから正しい応答を受信できませんでした。'};
    if(requiredBuild&&result.buildVersion!==requiredBuild)return{ok:false,code:'API_VERSION_MISMATCH',message:'システム更新中です。しばらく時間をおいて再度お試しください。',buildVersion:result.buildVersion||''};
    if(result.clientRequestId!==clientRequestId)return{ok:false,code:'RESPONSE_ID_MISMATCH',message:'通信結果を確認できませんでした。もう一度お試しください。'};
    return result;
  }
  function submit(action,data,timeout){
    if(!validApiUrl(apiUrl))return Promise.resolve({ok:false,code:'API_NOT_DEPLOYED',message:'現在、登録・依頼受付を利用できません。時間をおいて再度お試しください。'});
    if(!validSiteOrigin(siteOrigin))return Promise.resolve({ok:false,code:'SITE_ORIGIN_MISMATCH',message:'このページからは登録・依頼受付を利用できません。公式サイトを開き直してください。'});
    const clientRequestId=uid(String(action||'WEB').slice(0,18).replace(/[^A-Za-z0-9_-]/g,'_'));
    return new Promise((resolve,reject)=>{
      const iframe=document.createElement('iframe');
      iframe.name='api_'+clientRequestId;
      iframe.hidden=true;
      iframe.setAttribute('aria-hidden','true');
      const form=document.createElement('form');
      form.method='POST';
      form.action=apiUrl;
      form.target=iframe.name;
      form.hidden=true;
      form.acceptCharset='UTF-8';
      const payload=Object.assign({},data||{},{action:String(action||''),clientRequestId,responseOrigin:siteOrigin});
      Object.entries(payload).forEach(([k,v])=>{
        if(v===undefined||v===null)return;
        const input=document.createElement('input');
        input.type='hidden';
        input.name=String(k);
        input.value=typeof v==='object'?JSON.stringify(v):String(v);
        form.appendChild(input);
      });
      let settled=false;
      const wait=Math.max(15000,Math.min(90000,Number(timeout)||defaultTimeout));
      const timer=setTimeout(()=>{
        if(settled)return;
        settled=true;
        cleanup();
        reject(new Error('通信がタイムアウトしました。入力内容は保持されています。時間をおいて再度お試しください。'));
      },wait);
      function cleanup(){
        clearTimeout(timer);
        pending.delete(clientRequestId);
        form.remove();
        setTimeout(()=>iframe.remove(),500);
      }
      document.body.append(iframe,form);
      pending.set(clientRequestId,{
        source:iframe.contentWindow,
        done:result=>{
          if(settled)return;
          settled=true;
          cleanup();
          resolve(normalizedResult(result,clientRequestId));
        }
      });
      try{form.submit()}catch(err){settled=true;cleanup();reject(new Error('送信を開始できませんでした。ページを再読み込みしてお試しください。'))}
    });
  }
  window.addEventListener('message',event=>{
    const data=event.data;
    if(!data||typeof data!=='object'||data.source!=='akiya-rescue-api'||!data.clientRequestId)return;
    const item=pending.get(String(data.clientRequestId));
    if(!item)return;
    if(!trustedApiMessageOrigin(event.origin))return;
    item.done(data);
  });
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
