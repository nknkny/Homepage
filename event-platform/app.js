'use strict';
const CONFIG={
  build:'2026-08-15-autopilot-v2',
  root:'event_notice_platform_v2',
  autoHideReports:3,
  maxDailyPosts:10,
  highMatchScore:60,
  staleDays:180,
  firebase:{
    apiKey:'AIzaSyDuwQzcC9HlejgxpLAa8dK68xYwueoNmK4',authDomain:'piano-lesson-system.firebaseapp.com',projectId:'piano-lesson-system',storageBucket:'piano-lesson-system.firebasestorage.app',messagingSenderId:'94459879451',appId:'1:94459879451:web:342958cd3531b61fb818be',databaseURL:'https://piano-lesson-system-default-rtdb.asia-southeast1.firebasedatabase.app'
  }
};
const TYPES={event:'イベント',venue:'会場・場所',promotion:'広報・集客',exhibitor:'出店・販売',performer:'出演・コンテンツ',staff:'運営協力'};
const NEEDS={venue:'会場・場所',promotion:'広報・集客',exhibitor:'出店・販売',performer:'出演・コンテンツ',staff:'運営協力'};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=s=>String(s??'').trim();
const iso=()=>new Date().toISOString();
const day=()=>new Date().toISOString().slice(0,10);
const msDay=86400000;
let db=null,storageMode='boot',records={},requests={},reports={},currentPostType='event',health={};
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),4500)}
function key(k){return `event_platform_v2_${k}`}
function readLocal(k,fallback){try{const v=localStorage.getItem(key(k));return v===null?fallback:JSON.parse(v)}catch{return fallback}}
function writeLocal(k,v){localStorage.setItem(key(k),JSON.stringify(v))}
function uuid(prefix='id'){const a=crypto.getRandomValues(new Uint32Array(4));return `${prefix}_${Date.now().toString(36)}_${[...a].map(x=>x.toString(36)).join('')}`}
function identity(){let v=readLocal('identity',null);if(!v){v={ownerId:uuid('owner'),createdAt:iso(),managementKey:Array.from(crypto.getRandomValues(new Uint8Array(18))).map(b=>b.toString(16).padStart(2,'0')).join('')};writeLocal('identity',v)}return v}
function ownerId(){return identity().ownerId}
function mineIds(){return readLocal('mine',[])}function setMine(v){writeLocal('mine',[...new Set(v)])}
function favIds(){return readLocal('favorites',[])}function setFav(v){writeLocal('favorites',[...new Set(v)])}
function seenMatches(){return readLocal('seenMatches',{})}function setSeenMatches(v){writeLocal('seenMatches',v)}
function safeUrl(v){try{const u=new URL(text(v));return /^https:$/.test(u.protocol)?u.href:''}catch{return''}}
function normalize(s){return text(s).toLowerCase().normalize('NFKC').replace(/\s+/g,' ')}
function tags(v){return text(v).split(/[,、]/).map(normalize).filter(Boolean).slice(0,20)}
function isPast(dateStr){if(!dateStr)return false;return new Date(`${dateStr}T23:59:59`).getTime()<Date.now()}
function daysSince(v){const n=new Date(v||0).getTime();return Number.isFinite(n)?Math.floor((Date.now()-n)/msDay):99999}
function typeLabel(t){return TYPES[t]||t}
function chip(t,label){return `<span class="chip ${esc(t)}">${esc(label)}</span>`}
function needChips(r){return (r.needs||[]).map(n=>`<span class="chip need">${esc(NEEDS[n]||n)}</span>`).join('')}
function statusLabel(r){if(r.status==='review_required')return chip('pending','要修正');if(r.status==='auto_hidden')return chip('hidden','自動停止');if(r.status==='expired')return chip('expired','期限切れ');return''}
function publicRecords(){return Object.values(records||{}).filter(r=>r&&effectiveStatus(r)==='published')}
function allRecords(){return Object.values(records||{}).filter(Boolean)}
function effectiveStatus(r){
  if(!r)return'deleted';if(r.status==='deleted'||r.status==='rejected'||r.status==='auto_hidden')return r.status;
  if(r.type==='event'&&r.dateEnd&&isPast(r.dateEnd))return'expired';
  if(r.type!=='event'&&daysSince(r.updatedAt||r.createdAt)>CONFIG.staleDays)return'stale';
  return r.status||'published';
}
function setStorageStatus(mode,note=''){
  storageMode=mode;const el=$('storageStatus');el.className='status '+(mode==='remote'?'online':mode==='local'?'local':'bad');el.textContent=mode==='remote'?'共有DB接続':mode==='local'?'ローカル退避':'共有DBエラー';$('storageNote').textContent=note;
}
async function initStorage(){
  identity();
  try{
    firebase.initializeApp(CONFIG.firebase);db=firebase.database();
    await db.ref('.info/serverTimeOffset').once('value');
    setStorageStatus('remote','（複数端末で共有）');
    db.ref(`${CONFIG.root}/listings`).on('value',s=>{records=s.val()||{};autoMaintenance().finally(renderAll)});
    db.ref(`${CONFIG.root}/requests`).on('value',s=>{requests=s.val()||{};renderAll()});
    db.ref(`${CONFIG.root}/reports`).on('value',s=>{reports=s.val()||{};applyReportThresholds().finally(renderAll)});
    await runtimeWriteProbe();
  }catch(err){
    console.warn('shared storage unavailable',err);db=null;records=readLocal('records',{});requests=readLocal('requests',{});reports=readLocal('reports',{});setStorageStatus('local','（共有DBへ接続できないため、この端末だけに保存）');renderAll();
  }
}
async function runtimeWriteProbe(){
  if(!db)return false;const id=uuid('probe');const ref=db.ref(`${CONFIG.root}/health/${id}`);try{await ref.set({at:iso(),ownerId:ownerId(),build:CONFIG.build});await ref.remove();health.write=true;return true}catch(e){health.write=false;setStorageStatus('local','（共有DBが読取専用のため、この端末だけに保存）');records=readLocal('records',records);requests=readLocal('requests',requests);reports=readLocal('reports',reports);db=null;return false}
}
async function writeNode(kind,id,data){
  if(db){try{await db.ref(`${CONFIG.root}/${kind}/${id}`).set(data);return}catch(e){console.warn('remote write failed',e);db=null;setStorageStatus('local','（共有書込み失敗。ローカル退避中）')}}
  if(kind==='listings'){records[id]=data;writeLocal('records',records)}if(kind==='requests'){requests[id]=data;writeLocal('requests',requests)}if(kind==='reports'){reports[id]=data;writeLocal('reports',reports)}renderAll();
}
async function updateNode(kind,id,patch){
  if(db){try{await db.ref(`${CONFIG.root}/${kind}/${id}`).update(patch);return}catch(e){console.warn('remote update failed',e);db=null;setStorageStatus('local','（共有更新失敗。ローカル退避中）')}}
  const store=kind==='listings'?records:kind==='requests'?requests:reports;store[id]={...(store[id]||{}),...patch};writeLocal(kind,store);renderAll();
}
async function autoMaintenance(){
  const tasks=[];for(const r of allRecords()){
    const st=effectiveStatus(r);if(st==='expired'&&r.status!=='expired')tasks.push(updateNode('listings',r.id,{status:'expired',autoStatusAt:iso()}));
    if(st==='stale'&&r.status==='published')tasks.push(updateNode('listings',r.id,{status:'stale',autoStatusAt:iso()}));
  }await Promise.allSettled(tasks);generateMatchNotifications();
}
async function applyReportThresholds(){
  const counts={};for(const r of Object.values(reports||{})){if(!r||r.status==='dismissed')continue;(counts[r.listingId]||(counts[r.listingId]=new Set())).add(r.reporterId||r.id)}
  const tasks=[];for(const [id,set] of Object.entries(counts)){const listing=records[id];if(listing&&set.size>=CONFIG.autoHideReports&&listing.status==='published')tasks.push(updateNode('listings',id,{status:'auto_hidden',autoHiddenAt:iso(),autoHiddenReason:`${set.size}件の独立通報`}))}await Promise.allSettled(tasks);
}
function moderation(rec,editing=false){
  let risk=0,errors=[],warnings=[];const d=normalize(rec.description),titleN=normalize(rec.title),combined=`${titleN} ${d}`;
  if(rec.title.length<4)errors.push('タイトルは4文字以上必要です。');if(rec.description.length<20)errors.push('説明は20文字以上必要です。');if(!rec.area)errors.push('地域が必要です。');if(!rec.category)errors.push('カテゴリが必要です。');if(!safeUrl(rec.contactUrl))errors.push('公開用問い合わせURLはHTTPSで入力してください。');
  if(rec.type==='event'){if(!rec.dateStart||!rec.dateEnd)errors.push('開催期間が必要です。');else{if(rec.dateEnd<rec.dateStart)errors.push('終了日は開始日以降にしてください。');if(isPast(rec.dateEnd))errors.push('終了済みイベントは新規掲載できません。')}if(!(rec.needs||[]).length)warnings.push('募集対象が未選択のため、資源マッチングは行われません。')}
  const pii=[/\b0\d{1,4}[-ー\s]?\d{1,4}[-ー\s]?\d{3,4}\b/,/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i];if(pii.some(x=>x.test(rec.description)))errors.push('説明欄に電話番号・メールアドレスを直接掲載しないでください。');
  const hard=['児童ポルノ','覚醒剤','大麻販売','拳銃販売','違法薬物','詐欺募集'];if(hard.some(x=>combined.includes(normalize(x)))){risk+=100;errors.push('掲載できない内容が含まれています。')}
  const soft=['絶対儲かる','必ず儲かる','元本保証','即金','闇バイト','代理購入','現金化'];if(soft.some(x=>combined.includes(normalize(x)))){risk+=40;warnings.push('高リスク表現があるため自動公開できません。')}
  if(rec.description.includes('http://')){risk+=20;warnings.push('説明文中にHTTPリンクがあります。HTTPSを使用してください。')}
  const todayPosts=allRecords().filter(x=>x.ownerId===ownerId()&&String(x.createdAt||'').slice(0,10)===day()&&x.id!==rec.id).length;if(!editing&&todayPosts>=CONFIG.maxDailyPosts){risk+=60;warnings.push('短時間の大量掲載を検知しました。')}
  const duplicate=allRecords().find(x=>x.id!==rec.id&&x.ownerId===ownerId()&&normalize(x.title)===titleN&&normalize(x.area)===normalize(rec.area)&&effectiveStatus(x)!=='deleted');if(duplicate){risk+=50;warnings.push('同一タイトル・地域の重複掲載を検知しました。')}
  let status='published';if(errors.length||risk>=80)status='rejected';else if(risk>=30)status='review_required';return{risk,errors,warnings,status};
}
function listingData(){
  const type=currentPostType;return{type,title:text($('title').value),area:text($('area').value),category:$('category').value,description:text($('description').value),dateStart:type==='event'?$('dateStart').value:'',dateEnd:type==='event'?$('dateEnd').value:'',needs:type==='event'?[...document.querySelectorAll('.need:checked')].map(x=>x.value):[],availableFrom:type!=='event'?$('availableFrom').value:'',availableTo:type!=='event'?$('availableTo').value:'',capacity:type==='venue'?Number($('capacity').value||0):0,priceGuide:type!=='event'?text($('priceGuide').value):'',channels:type==='promotion'?text($('channels').value):'',tags:tags($('tags').value),contactUrl:text($('contactUrl').value)}
}
function matchScore(event,res){
  if(!event||event.type!=='event'||!res||res.type==='event'||!(event.needs||[]).includes(res.type)||effectiveStatus(res)!=='published')return 0;
  let score=10;const ea=normalize(event.area),ra=normalize(res.area);if(ea&&ra){if(ea===ra)score+=30;else if(ea.includes(ra)||ra.includes(ea))score+=20;else{const ep=ea.replace(/[市町村区].*$/,'');const rp=ra.replace(/[市町村区].*$/,'');if(ep&&rp&&ep===rp)score+=10}}
  if(event.category===res.category)score+=18;const et=new Set(event.tags||[]);const overlap=(res.tags||[]).filter(t=>et.has(t)).length;score+=Math.min(20,overlap*5);
  if(res.availableFrom&&event.dateEnd&&res.availableFrom>event.dateEnd)return 0;if(res.availableTo&&event.dateStart&&res.availableTo<event.dateStart)return 0;if(res.availableFrom||res.availableTo)score+=12;
  if(res.type==='venue'&&res.capacity>0)score+=5;return Math.min(100,score);
}
function recommendations(event,limit=8){return publicRecords().filter(r=>r.type!=='event').map(r=>({r,score:matchScore(event,r)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||String(b.r.updatedAt||'').localeCompare(String(a.r.updatedAt||''))).slice(0,limit)}
function opportunitiesForOwner(){
  const mine=allRecords().filter(r=>r.ownerId===ownerId()&&effectiveStatus(r)==='published');const out=[];
  for(const r of mine){if(r.type==='event'){for(const x of recommendations(r,10))out.push({source:r,target:x.r,score:x.score})}else{for(const e of publicRecords().filter(x=>x.type==='event'&&(x.needs||[]).includes(r.type))){const s=matchScore(e,r);if(s>0)out.push({source:r,target:e,score:s})}}}
  return out.sort((a,b)=>b.score-a.score).slice(0,30);
}
function generateMatchNotifications(){
  const seen=seenMatches(),now={...seen};for(const o of opportunitiesForOwner()){if(o.score<CONFIG.highMatchScore)continue;const k=`${o.source.id}:${o.target.id}`;if(seen[k])continue;now[k]=iso();notify(`新しい高一致候補 ${o.score}点`,`${o.source.title} ↔ ${o.target.title}`)}setSeenMatches(now);
}
function notify(title,body){if('Notification'in window&&Notification.permission==='granted'){try{new Notification(title,{body,tag:'event-match'})}catch{}}toast(`${title}：${body}`)}
async function askNotification(){if(!('Notification'in window)){toast('このブラウザは通知に対応していません。');return}const p=await Notification.requestPermission();toast(p==='granted'?'通知を有効にしました。':'通知は有効になりませんでした。')}
function route(id){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===id));if(id==='dashboard')renderDashboard();if(id==='favorites')renderFavorites();window.scrollTo({top:0,behavior:'smooth'});location.hash=id}
function setupNav(){document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();route(b.dataset.nav)}));document.querySelectorAll('[data-post-type]').forEach(b=>b.addEventListener('click',()=>setPostType(b.dataset.postType)));document.querySelectorAll('[data-dash]').forEach(b=>b.addEventListener('click',()=>openDash(b.dataset.dash)));}
function setPostType(t){currentPostType=t;$('postType').value=t;document.querySelectorAll('[data-post-type]').forEach(b=>b.classList.toggle('active',b.dataset.postType===t));document.querySelectorAll('.event-only').forEach(x=>x.style.display=t==='event'?'':'none');document.querySelectorAll('.resource-only').forEach(x=>x.style.display=t!=='event'?'':'none');document.querySelectorAll('.venue-only').forEach(x=>x.style.display=t==='venue'?'':'none');document.querySelectorAll('.promotion-only').forEach(x=>x.style.display=t==='promotion'?'':'none')}
function openDash(id){document.querySelectorAll('[data-dash]').forEach(b=>b.classList.toggle('active',b.dataset.dash===id));document.querySelectorAll('.dash-panel').forEach(p=>p.classList.toggle('active',p.id===id));if(id==='system')renderSystem()}
function filtered(){let a=publicRecords();const q=normalize($('q').value),t=$('typeFilter').value,area=normalize($('areaFilter').value),need=$('needFilter').value;a=a.filter(r=>{const hay=normalize([r.title,r.area,r.category,r.description,(r.tags||[]).join(' ')].join(' '));return(!q||hay.includes(q))&&(!t||r.type===t)&&(!area||normalize(r.area).includes(area))&&(!need||(r.needs||[]).includes(need)||r.type===need)});const sort=$('sort').value;if(sort==='date')a.sort((x,y)=>String(x.dateStart||'9999').localeCompare(String(y.dateStart||'9999')));else if(sort==='popular')a.sort((x,y)=>(y.interestCount||0)-(x.interestCount||0));else a.sort((x,y)=>String(y.createdAt||'').localeCompare(String(x.createdAt||'')));return a}
function card(r,score=null){const fav=favIds().includes(r.id);return `<article class="card"><div class="meta">${chip(r.type,typeLabel(r.type))}${chip('',r.area)}${chip('',r.category)}${needChips(r)}${statusLabel(r)}</div><h3>${esc(r.title)}</h3>${r.type==='event'?`<div class="muted">${esc(r.dateStart||'日程未設定')} 〜 ${esc(r.dateEnd||'')}</div>`:''}<p>${esc(r.description.slice(0,145))}${r.description.length>145?'…':''}</p>${score!==null?`<div class="score">一致度 ${score}点</div>`:''}<div class="card-footer"><button class="btn primary small" type="button" data-detail="${esc(r.id)}">詳細</button><button class="btn ghost small" type="button" data-fav="${esc(r.id)}">${fav?'★':'☆'}</button></div></article>`}
function bindDynamic(root=document){root.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>openDetail(b.dataset.detail));root.querySelectorAll('[data-fav]').forEach(b=>b.onclick=()=>toggleFav(b.dataset.fav));root.querySelectorAll('[data-interest]').forEach(b=>b.onclick=()=>createInterest(b.dataset.interest,b.dataset.source));root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editListing(b.dataset.edit));root.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteListing(b.dataset.delete));root.querySelectorAll('[data-renew]').forEach(b=>b.onclick=()=>renewListing(b.dataset.renew));root.querySelectorAll('[data-request-action]').forEach(b=>b.onclick=()=>requestAction(b.dataset.requestAction,b.dataset.id))}
function renderBrowse(){const a=filtered();$('listingGrid').innerHTML=a.length?a.map(r=>card(r)).join(''):'<div class="empty">条件に合う公開掲載はありません。</div>';bindDynamic($('listingGrid'));const p=publicRecords();$('kEvent').textContent=p.filter(x=>x.type==='event').length;$('kResource').textContent=p.filter(x=>x.type!=='event').length;$('kMatch').textContent=p.filter(x=>x.type==='event').reduce((n,e)=>n+recommendations(e).filter(x=>x.score>=CONFIG.highMatchScore).length,0);$('kRequest').textContent=Object.values(requests||{}).filter(Boolean).length}
function openDetail(id){const r=records[id];if(!r)return;$('modalType').textContent=typeLabel(r.type);$('modalType').className=`chip ${r.type}`;$('modalTitle').textContent=r.title;let extras='';if(r.type==='venue')extras+=`<p><b>収容人数:</b> ${esc(r.capacity||'未設定')}</p>`;if(r.type==='promotion'&&r.channels)extras+=`<p><b>対応媒体:</b> ${esc(r.channels)}</p>`;if(r.type!=='event'&&r.priceGuide)extras+=`<p><b>料金目安:</b> ${esc(r.priceGuide)}</p>`;if(r.availableFrom||r.availableTo)extras+=`<p><b>対応期間:</b> ${esc(r.availableFrom||'指定なし')} 〜 ${esc(r.availableTo||'指定なし')}</p>`;
 let match='';if(r.type==='event'){const recs=recommendations(r,12);const groups=Object.keys(NEEDS).filter(n=>(r.needs||[]).includes(n)).map(n=>{const xs=recs.filter(x=>x.r.type===n);return `<div><div class="subhead">${esc(NEEDS[n])}</div>${xs.length?xs.map(x=>card(x.r,x.score)).join(''):'<div class="empty">候補なし</div>'}</div>`}).join('');match=groups?`<div class="divider"></div><h3>自動マッチ候補</h3><div class="match-columns">${groups}</div>`:''}
 const canInterest=r.ownerId!==ownerId()&&effectiveStatus(r)==='published';$('modalBody').innerHTML=`<div class="meta">${chip('',r.area)}${chip('',r.category)}${needChips(r)}</div>${r.type==='event'?`<p><b>開催:</b> ${esc(r.dateStart)} 〜 ${esc(r.dateEnd)}</p>`:''}<div class="detail-copy">${esc(r.description)}</div>${extras}<div class="actions"><a class="btn primary" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(r.contactUrl))}">公開問い合わせ先</a>${canInterest?`<button type="button" class="btn ok" data-interest="${esc(r.id)}">マッチ希望を送る</button>`:''}<button type="button" class="btn ghost" id="shareBtn">共有</button><button type="button" class="btn ghost" id="reportBtn">通報</button></div>${match}`;$('modal').classList.add('open');bindDynamic($('modalBody'));$('reportBtn').onclick=()=>reportListing(id);$('shareBtn').onclick=()=>shareListing(id)}
function closeModal(){$('modal').classList.remove('open')}
async function shareListing(id){const url=`${location.origin}${location.pathname}#listing=${encodeURIComponent(id)}`;try{if(navigator.share)await navigator.share({title:records[id]?.title||document.title,url});else{await navigator.clipboard.writeText(url);toast('URLをコピーしました。')}}catch{}}
function toggleFav(id){const a=favIds(),i=a.indexOf(id);if(i>=0)a.splice(i,1);else a.push(id);setFav(a);renderAll()}
async function reportListing(id){const reason=prompt('問題の内容を簡潔に入力してください。','内容確認依頼');if(reason===null)return;const rid=uuid('report');await writeNode('reports',rid,{id:rid,listingId:id,reporterId:ownerId(),reason:text(reason).slice(0,500),createdAt:iso(),status:'open'});toast('通報を受け付けました。閾値に達すると自動停止します。')}
async function createInterest(targetId,sourceId=''){const target=records[targetId];if(!target||target.ownerId===ownerId())return;const owned=allRecords().filter(r=>r.ownerId===ownerId()&&effectiveStatus(r)==='published');let source=sourceId?records[sourceId]:null;if(!source&&owned.length===1)source=owned[0];if(!source&&owned.length>1){const options=owned.map((r,i)=>`${i+1}: ${r.title}`).join('\n');const n=Number(prompt(`どの掲載からマッチ希望を送りますか？\n${options}`));if(n>=1&&n<=owned.length)source=owned[n-1]}if(!source){toast('先に自分のイベントまたは提供資源を掲載してください。');return}const duplicate=Object.values(requests||{}).find(x=>x&&x.fromOwnerId===ownerId()&&x.sourceListingId===source.id&&x.targetListingId===target.id&&['pending','accepted'].includes(x.status));if(duplicate){toast('同じ相手への有効なマッチ希望があります。');return}const message=prompt('相手へ伝える公開可能な一言（任意）','条件が合えば詳細を相談したいです。');if(message===null)return;const id=uuid('req');const score=source.type==='event'?matchScore(source,target):target.type==='event'?matchScore(target,source):0;const req={id,fromOwnerId:ownerId(),toOwnerId:target.ownerId,sourceListingId:source.id,targetListingId:target.id,message:text(message).slice(0,500),score,status:'pending',createdAt:iso(),updatedAt:iso()};await writeNode('requests',id,req);await updateNode('listings',target.id,{interestCount:Number(target.interestCount||0)+1,updatedAt:target.updatedAt||iso()});toast('マッチ希望を送信しました。');closeModal()}
async function requestAction(action,id){const r=requests[id];if(!r||r.toOwnerId!==ownerId()||!['accept','decline'].includes(action))return;await updateNode('requests',id,{status:action==='accept'?'accepted':'declined',updatedAt:iso()});toast(action==='accept'?'マッチ希望を承認しました。':'マッチ希望を辞退しました。')}
function requestCard(r,incoming){const src=records[r.sourceListingId],target=records[r.targetListingId];return `<article class="request-card"><div class="request-head"><b>${esc(src?.title||'削除済み')} → ${esc(target?.title||'削除済み')}</b><span class="chip ${esc(r.status)}">${esc({pending:'回答待ち',accepted:'成立',declined:'辞退',cancelled:'取消'}[r.status]||r.status)}</span></div><p>${esc(r.message||'')}</p><div class="meta">${r.score?`<span class="score">一致度 ${r.score}点</span>`:''}<span class="muted">${esc(r.createdAt?.slice(0,16).replace('T',' ')||'')}</span></div>${incoming&&r.status==='pending'?`<div class="card-footer"><button class="btn ok small" data-request-action="accept" data-id="${esc(r.id)}">承認</button><button class="btn ghost small" data-request-action="decline" data-id="${esc(r.id)}">辞退</button></div>`:''}</article>`}
function renderDashboard(){const mine=allRecords().filter(r=>r.ownerId===ownerId()||mineIds().includes(r.id));$('mineGrid').innerHTML=mine.length?mine.map(r=>`<article class="card"><div class="meta">${chip(r.type,typeLabel(r.type))}${statusLabel({...r,status:effectiveStatus(r)})}</div><h3>${esc(r.title)}</h3><p>${esc(r.area)} / ${esc(r.category)}</p><div class="card-footer"><button class="btn primary small" data-edit="${esc(r.id)}">編集</button>${effectiveStatus(r)==='stale'?`<button class="btn ok small" data-renew="${esc(r.id)}">掲載更新</button>`:''}<button class="btn danger small" data-delete="${esc(r.id)}">削除</button></div></article>`).join(''):'<div class="empty">この端末からの掲載はありません。</div>';
 const inc=Object.values(requests||{}).filter(r=>r&&r.toOwnerId===ownerId()).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));const out=Object.values(requests||{}).filter(r=>r&&r.fromOwnerId===ownerId()).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));$('incomingList').innerHTML=inc.length?inc.map(r=>requestCard(r,true)).join(''):'<div class="empty">受信したマッチ希望はありません。</div>';$('outgoingList').innerHTML=out.length?out.map(r=>requestCard(r,false)).join(''):'<div class="empty">送信したマッチ希望はありません。</div>';
 const opp=opportunitiesForOwner();$('opportunityGrid').innerHTML=opp.length?opp.map(o=>`<article class="card"><div class="score">一致度 ${o.score}点</div><h3>${esc(o.source.title)}</h3><p>候補：${esc(o.target.title)}</p><div class="card-footer"><button class="btn primary small" data-detail="${esc(o.target.id)}">候補を見る</button>${o.target.ownerId!==ownerId()?`<button class="btn ok small" data-interest="${esc(o.target.id)}" data-source="${esc(o.source.id)}">マッチ希望</button>`:''}</div></article>`).join(''):'<div class="empty">現在、高一致候補はありません。</div>';
 $('identityBox').textContent=`運営ID: ${ownerId()} / この端末の掲載所有権・マッチ受信に使用します。`;bindDynamic($('dashboard'))}
function renderFavorites(){const a=favIds().map(id=>records[id]).filter(r=>r&&effectiveStatus(r)==='published');$('favGrid').innerHTML=a.length?a.map(r=>card(r)).join(''):'<div class="empty">お気に入りはありません。</div>';bindDynamic($('favGrid'))}
function renderSystem(){const pub=publicRecords(),hidden=allRecords().filter(r=>['auto_hidden','review_required','rejected','expired','stale'].includes(effectiveStatus(r))).length;$('systemBox').innerHTML=`<h3>自動運転状態</h3><p>Build: <b>${esc(CONFIG.build)}</b></p><p>保存: <b>${storageMode==='remote'?'共有DB':'ローカル退避'}</b> / 書込自己診断: <b>${health.write===true?'成功':health.write===false?'失敗':'未実行'}</b></p><p>公開 ${pub.length}件 / 自動非公開・要修正 ${hidden}件 / 通報 ${Object.values(reports||{}).filter(Boolean).length}件</p><p>自動処理: 期限切れ非表示、180日未更新資源の停止、重複・個人連絡先・高リスク表現の審査、3端末以上の通報で停止、高一致候補通知。</p><div class="notice-warn">決済・手数料は過去会話から確定仕様を取得できていないため未有効化。金額や徴収ルールを推測して実装していません。</div>`}
function renderAll(){renderBrowse();renderDashboard();renderFavorites();renderSystem()}
function resetForm(){$('postForm').reset();$('editId').value='';$('submitBtn').textContent='自動審査して掲載';$('postHeading').textContent='掲載する';$('validationBox').innerHTML='';setPostType(currentPostType)}
function showValidation(m){const cls=m.status==='rejected'?'notice-bad':m.status==='review_required'?'notice-warn':'notice-ok';const lines=[...m.errors,...m.warnings];$('validationBox').innerHTML=lines.length?`<div class="${cls}">${lines.map(esc).join('<br>')}</div>`:`<div class="notice-ok">自動審査: 公開可能です。</div>`}
async function submitListing(e){e.preventDefault();if(!$('terms').checked){toast('掲載条件への同意が必要です。');return}const base=listingData(),editing=!!$('editId').value,id=$('editId').value||uuid(base.type),old=records[id]||{};if(editing&&old.ownerId!==ownerId()&&!mineIds().includes(id)){toast('この端末の所有掲載ではありません。');return}const rec={...old,...base,id,ownerId:old.ownerId||ownerId(),createdAt:old.createdAt||iso(),updatedAt:iso(),status:'published',interestCount:Number(old.interestCount||0)};const m=moderation(rec,editing);showValidation(m);if(m.status==='rejected'){toast('自動審査で掲載できません。表示された項目を修正してください。');return}rec.status=m.status;rec.moderation={risk:m.risk,warnings:m.warnings,checkedAt:iso(),build:CONFIG.build};await writeNode('listings',id,rec);setMine([...mineIds(),id]);toast(m.status==='published'?(editing?'更新・公開しました。':'自動審査を通過し公開しました。'):'公開せず要修正として保存しました。');resetForm();route('dashboard')}
function editListing(id){const r=records[id];if(!r||!(r.ownerId===ownerId()||mineIds().includes(id)))return;route('post');setPostType(r.type);$('editId').value=id;$('postHeading').textContent='掲載を編集';$('submitBtn').textContent='自動審査して更新';$('title').value=r.title||'';$('area').value=r.area||'';$('category').value=r.category||'';$('description').value=r.description||'';$('dateStart').value=r.dateStart||'';$('dateEnd').value=r.dateEnd||'';$('availableFrom').value=r.availableFrom||'';$('availableTo').value=r.availableTo||'';$('capacity').value=r.capacity||'';$('priceGuide').value=r.priceGuide||'';$('channels').value=r.channels||'';$('tags').value=(r.tags||[]).join(', ');$('contactUrl').value=r.contactUrl||'';document.querySelectorAll('.need').forEach(c=>c.checked=(r.needs||[]).includes(c.value));$('terms').checked=true}
async function deleteListing(id){const r=records[id];if(!r||!(r.ownerId===ownerId()||mineIds().includes(id))||!confirm('この掲載を削除しますか？'))return;await updateNode('listings',id,{status:'deleted',deletedAt:iso(),updatedAt:iso()});toast('削除しました。')}
async function renewListing(id){const r=records[id];if(!r||r.ownerId!==ownerId())return;await updateNode('listings',id,{status:'published',updatedAt:iso(),renewedAt:iso()});toast('掲載を更新しました。')}
async function runHealth(){health={build:CONFIG.build,dom:true,identity:!!ownerId(),remote:!!db,write:null};if(db)await runtimeWriteProbe();else health.write=false;renderSystem();toast(health.write?'自己診断: 共有DBの読書き正常':'自己診断: ローカル退避で動作中')}
function exportBackup(){const payload={version:CONFIG.build,exportedAt:iso(),identity:identity(),listings:allRecords().filter(r=>r.ownerId===ownerId()||mineIds().includes(r.id)),requests:Object.values(requests||{}).filter(r=>r&&[r.fromOwnerId,r.toOwnerId].includes(ownerId())),favorites:favIds()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`event-platform-backup-${day()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function openHash(){const h=location.hash.slice(1);if(h.startsWith('listing=')){const id=decodeURIComponent(h.slice(8));if(records[id])openDetail(id);else setTimeout(()=>records[id]&&openDetail(id),1200)}else if(['browse','post','dashboard','favorites'].includes(h))route(h)}
function wire(){setupNav();['q','areaFilter'].forEach(id=>$(id).addEventListener('input',renderBrowse));['typeFilter','needFilter','sort'].forEach(id=>$(id).addEventListener('change',renderBrowse));$('postForm').addEventListener('submit',submitListing);$('resetBtn').onclick=resetForm;$('modalClose').onclick=closeModal;$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal()});$('notifyBtn').onclick=askNotification;$('healthBtn').onclick=runHealth;$('exportBtn').onclick=exportBackup;window.addEventListener('hashchange',openHash);setPostType('event')}
window.addEventListener('DOMContentLoaded',async()=>{wire();await initStorage();openHash();setInterval(()=>{if(storageMode==='remote')autoMaintenance().catch(console.warn)},10*60*1000)});