(()=>{'use strict';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const menuBtn=q('[data-menu-button]'),mobileNav=q('[data-mobile-nav]');
const closeMenu=()=>{if(!menuBtn||!mobileNav)return;mobileNav.classList.remove('open');menuBtn.setAttribute('aria-expanded','false');menuBtn.setAttribute('aria-label','メニューを開く');};
if(menuBtn&&mobileNav){menuBtn.addEventListener('click',()=>{const open=!mobileNav.classList.contains('open');mobileNav.classList.toggle('open',open);menuBtn.setAttribute('aria-expanded',String(open));menuBtn.setAttribute('aria-label',open?'メニューを閉じる':'メニューを開く');});qa('a',mobileNav).forEach(a=>a.addEventListener('click',closeMenu));document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});document.addEventListener('click',e=>{if(mobileNav.classList.contains('open')&&!mobileNav.contains(e.target)&&!menuBtn.contains(e.target))closeMenu();});}
const sites=q('#sites'),estimate=q('#estimate');
const calc=()=>{if(!sites||!estimate)return;const raw=sites.value.trim();const n=Number(raw);const valid=raw!==''&&Number.isInteger(n)&&n>=1&&n<=100;if(!valid){estimate.textContent='1〜100の整数を入力';return;}estimate.textContent=(5000+4000*n).toLocaleString('ja-JP')+'円（税別）';};
if(sites&&estimate){sites.addEventListener('input',calc);sites.addEventListener('blur',()=>{const n=Number(sites.value);if(!Number.isFinite(n)||n<1)sites.value='1';else if(n>100)sites.value='100';else sites.value=String(Math.round(n));calc();});calc();}
const form=q('#inquiry-form'),status=q('#form-status'),copyBtn=q('#copy-inquiry');
const buildInquiry=()=>{if(!form)return null;const fd=new FormData(form);const sitesRaw=String(fd.get('sites')||'').trim();const n=Number(sitesRaw);if(!Number.isInteger(n)||n<1){const el=q('#form-sites');if(el){el.setCustomValidity('拠点数は1以上の整数で入力してください。');el.reportValidity();}return null;}const el=q('#form-sites');if(el)el.setCustomValidity('');const get=k=>String(fd.get(k)||'').trim();const subject=`現場ポート 案件相談｜${get('company')||'会社名未入力'}`;const body=[
'現場ポート ご担当者様','',
'【会社名】',get('company'),
'【担当者名】',get('name'),
'【メールアドレス】',get('email'),
'【電話番号】',get('phone')||'未記入',
'【現場地域】',get('area'),
'【拠点数】',`${n}拠点`,
'【希望実施日】',get('preferred_date')||'未記入',
'【依頼内容】',get('details'),
'【必要成果物・補足】',get('deliverables')||'未記入','',
'※このメールは現場ポートの案件相談フォームで作成しました。'
].join('\n');return{subject,body};};
if(form){form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const d=buildInquiry();if(!d)return;if(status){status.classList.remove('error');status.textContent='メールアプリを開きます。開かない場合は「内容をコピー」をご利用ください。';}location.href=`mailto:genbaport@gmail.com?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;});}
if(copyBtn){copyBtn.addEventListener('click',async()=>{if(form&&!form.reportValidity())return;const d=buildInquiry();if(!d)return;const text=`件名: ${d.subject}\n\n${d.body}`;try{await navigator.clipboard.writeText(text);if(status){status.classList.remove('error');status.textContent='相談内容をクリップボードへコピーしました。';}}catch(_){if(status){status.classList.add('error');status.textContent='自動コピーできませんでした。メールアプリから送信してください。';}}});}
qa('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{const id=a.getAttribute('href');if(id&&id.length>1){const t=q(id);if(t)setTimeout(()=>t.setAttribute('tabindex','-1'),0);}}));
})();
