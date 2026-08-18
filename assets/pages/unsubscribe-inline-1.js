'use strict';
unsubBtn.addEventListener('click',async()=>{AkiyaUI.busy(unsubBtn,true);try{const r=await AkiyaAPI.submit('unsubscribe',{sessionToken:AkiyaAPI.token()});AkiyaUI.show(unsubStatus,r.message||'案内配信を停止しました。',!!r.ok)}catch(err){AkiyaUI.show(unsubStatus,err.message||'案内配信を停止できませんでした。')}finally{AkiyaUI.busy(unsubBtn,false)}});
