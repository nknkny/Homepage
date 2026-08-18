'use strict';
setTimeout(()=>{if(AkiyaAPI.token())location.replace('member.html?payment=success');else location.replace('member-login.html')},300);
