(function(){
  const cfg=window.AKIYA_CONFIG||{};const pending=new Map();
  function uid(prefix='WEB'){const b=new Uint8Array(12);crypto.getRandomValues(b);return prefix+'-'+Array.from(b,x=>x.toString(16).padStart(2,'0')).join('').toUpperCase()}
  function submit(action,data,timeout=25000){
    if(!cfg.API_URL) return Promise.resolve({ok:false,code:'API_NOT_DEPLOYED',message:'現在、登録・依頼受付を利用できません。時間をおいて再度お試しください。'});
    const clientRequestId=uid();
    return new Promise((resolve,reject)=>{
      const iframe=document.createElement('iframe');iframe.name='api_'+clientRequestId;iframe.hidden=true;
      const form=document.createElement('form');form.method='POST';form.action=cfg.API_URL;form.target=iframe.name;form.hidden=true;
      const payload={...data,action,clientRequestId};Object.entries(payload).forEach(([k,v])=>{const i=document.createElement('input');i.type='hidden';i.name=k;i.value=typeof v==='object'?JSON.stringify(v):String(v??'');form.appendChild(i)});
      const timer=setTimeout(()=>{cleanup();reject(new Error('通信がタイムアウトしました。'));},timeout);
      function cleanup(){clearTimeout(timer);pending.delete(clientRequestId);form.remove();setTimeout(()=>iframe.remove(),250)}
      document.body.append(iframe,form);pending.set(clientRequestId,{source:iframe.contentWindow,done:r=>{cleanup();resolve(r)}});form.submit();
    });
  }
  window.addEventListener('message',e=>{const d=e.data;if(!d||d.source!=='akiya-rescue-api'||!d.clientRequestId)return;const p=pending.get(d.clientRequestId);if(!p||p.source!==e.source)return;p.done(d)});
  function token(){return localStorage.getItem('akiya_session')||''}function setToken(v){v?localStorage.setItem('akiya_session',v):localStorage.removeItem('akiya_session')}
  window.AkiyaAPI={submit,token,setToken,uid};
})();
