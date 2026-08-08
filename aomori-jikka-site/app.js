(()=>{
  const c=window.SITE_CONFIG||{};
  document.querySelectorAll('[data-config]').forEach(el=>{
    const k=el.dataset.config;
    if(c[k]!==undefined&&c[k]!=="") el.textContent=c[k];
  });
  document.querySelectorAll('[data-phone-link]').forEach(a=>{a.href=c.phoneHref||'#';});
  document.querySelectorAll('[data-email-link]').forEach(a=>{a.href=c.emailHref||'#';});
  const bind=(sel,url,label,fallback)=>document.querySelectorAll(sel).forEach(a=>{
    const target=url||fallback;
    if(target){a.href=target;if(!target.startsWith('mailto:')&&!target.startsWith('tel:')){a.target='_blank';a.rel='noopener';}}
    else{a.href='#contact';a.classList.add('btn-disabled');a.setAttribute('aria-disabled','true');a.addEventListener('click',e=>{e.preventDefault();alert(label+'は現在準備中です。')});}
  });
  bind('[data-membership-link]',c.membershipPaymentUrl,'月額会員のお申込み',c.inquiryUrl);
  bind('[data-member-visit-link]',c.memberVisitPaymentUrl,'会員向け実家現地確認のお申込み',c.inquiryUrl);
  bind('[data-nonmember-visit-link]',c.nonMemberVisitPaymentUrl,'非会員向け実家現地確認のお申込み',c.inquiryUrl);
  bind('[data-inquiry-link]',c.inquiryUrl,'お問い合わせ','');
  bind('[data-cancel-link]',c.cancellationUrl,'解約手続','');
  const t=document.querySelector('.mobile-toggle'),n=document.querySelector('.nav');
  if(t&&n){t.addEventListener('click',()=>{const open=n.classList.toggle('open');t.setAttribute('aria-expanded',String(open))});n.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{n.classList.remove('open');t.setAttribute('aria-expanded','false')}));}
  document.querySelectorAll('[data-status-banner]').forEach(el=>{
    if(c.serviceStatus==='live') el.hidden=true;
    else if(c.serviceStatus==='inquiry') el.textContent='お問い合わせ受付中です。オンライン申込み・決済は現在準備中です。';
  });
})();
