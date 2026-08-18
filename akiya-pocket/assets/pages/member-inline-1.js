'use strict';
if(window.AkiyaAnalytics)AkiyaAnalytics.track('member_page_view',{contentCategory:'member',contentId:'dashboard',actionLabel:'view'});
(async()=>{
  const t=AkiyaAPI.token();if(!t){location.replace('member-login.html');return}
  const paymentReturn=new URLSearchParams(location.search).get('payment')==='success';
  const pendingRequestId=sessionStorage.getItem('akiya_pending_payment_request_id')||'';
  const pendingStartedAt=Number(sessionStorage.getItem('akiya_pending_payment_started_at')||0);
  const recentPending=!!pendingRequestId&&pendingStartedAt>0&&(Date.now()-pendingStartedAt)<2*60*60*1000;
  const isPaid=x=>String(x?.paymentStatus||'').toLowerCase()==='paid'||x?.paymentStatus==='支払済み';
  const renderDashboard=async()=>{
    const r=await AkiyaAPI.submit('get_dashboard',{sessionToken:t});
    if(!r.ok){AkiyaAPI.setToken('');AkiyaUI.show(dashboardStatus,r.message||'ログインが必要です。');setTimeout(()=>location.replace('member-login.html'),900);return null}
    const m=r.member;mName.textContent=m.name||'';mEmail.textContent=m.emailMasked||'未登録';mPhone.textContent=m.phoneMasked||'未登録';mProperty.textContent=[m.propertyPrefecture,m.propertyCity].filter(Boolean).join(' ')||'未登録';mMarketing.textContent=m.marketingOptIn?'受け取る':'受け取らない';mAiTraining.textContent=m.aiTrainingOptIn?'同意中':'同意していない';mStatus.textContent=m.status||'無料会員';welcome.textContent=(m.name||'会員')+' 様';
    const rows=r.requests||[];
    if(rows.length){noHistory.classList.add('hidden');historyTable.classList.remove('hidden');const tb=historyTable.querySelector('tbody');tb.textContent='';rows.forEach(x=>{const tr=document.createElement('tr');[x.requestId,x.createdAt,x.propertySummary,x.status,x.quotedTotal?Number(x.quotedTotal).toLocaleString('ja-JP')+'円':'未提示',x.paymentStatus||'未設定'].forEach(v=>{const td=document.createElement('td');td.textContent=v||'';tr.append(td)});const action=document.createElement('td');const paid=isPaid(x);if(x.cardAvailable&&x.quotedTotal&&!paid&&!x.contractedAt&&x.status!=='取消'&&x.status!=='返金済み'){const a=document.createElement('a');a.className='btn btn-primary';a.href='checkout.html?request_id='+encodeURIComponent(x.requestId);a.textContent='最終確認・カード払い';action.append(a)}else if(x.reportUrl&&/^https:\/\//i.test(String(x.reportUrl))){const a=document.createElement('a');a.className='btn btn-ghost';a.href=x.reportUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent='報告書を見る';action.append(a)}else if(paid){action.textContent='支払い確認済み'}else action.textContent='—';tr.append(action);tb.append(tr)})}
    dashboard.classList.remove('hidden');return rows;
  };
  const exactPaid=rows=>{if(!recentPending)return false;const x=(rows||[]).find(r=>r.requestId===pendingRequestId);return !!x&&isPaid(x)};
  try{
    let rows=await renderDashboard();if(!rows)return;
    if(paymentReturn){
      if(!recentPending){AkiyaUI.show(dashboardStatus,'Stripeから戻りました。支払い状況は履歴で確認してください。重ねて支払わないでください。',true);history.replaceState({},'',location.pathname);return}
      let paid=exactPaid(rows);
      if(paid){AkiyaUI.show(dashboardStatus,'Stripeでのお支払いを確認しました。',true);sessionStorage.removeItem('akiya_pending_payment_request_id');sessionStorage.removeItem('akiya_pending_payment_started_at');history.replaceState({},'',location.pathname)}
      else{
        AkiyaUI.show(dashboardStatus,'Stripeでのお支払いを確認中です。通常は数秒で反映されます。',true);
        for(const delay of [1500,2500,4000,6000]){
          await new Promise(resolve=>setTimeout(resolve,delay));
          rows=await renderDashboard();if(!rows)return;
          paid=exactPaid(rows);
          if(paid){AkiyaUI.show(dashboardStatus,'Stripeでのお支払いを確認しました。',true);sessionStorage.removeItem('akiya_pending_payment_request_id');sessionStorage.removeItem('akiya_pending_payment_started_at');history.replaceState({},'',location.pathname);break}
        }
        if(!paid)AkiyaUI.show(dashboardStatus,'決済の反映に時間がかかっています。支払いを重ねて行わず、しばらくしてから再読み込みしてください。反映しない場合はお問い合わせください。',false);
      }
    }
  }catch(e){AkiyaUI.show(dashboardStatus,e.message||'会員情報を取得できませんでした。')}
})();
