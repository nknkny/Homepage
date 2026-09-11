(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const KEY='genbaport_sales_local_v1';
const MASTER='https://docs.google.com/spreadsheets/d/1V7X07PBur89mZbaiuQ3MLZaSor8Ao6y3Ryb88Gmkpy8/edit';
const SEEN_KEYS=new Set([
'佐々通オンサイト|sasatsu.co.jp','エスコ|esco.jp','ビーモーション|bemotion.co.jp','mitoriz|service.mitoriz.co.jp',
'インパクトホールディングスインパクトフィールド|impact-h.co.jp','エーエスピー|asp-agency.co.jp','フィールドマーケティングシステムズ|fmsnet.co.jp','共同印刷|kyodoprinting.co.jp',
'プロモ|promo-inc.jp','macsrealiz|macs-realiz.jp','ヒカリパートナーズ|genchisatsuei.com','ナビット|navit-j.com','ギグワークス|add.gig.co.jp',
'ms&consulting|msandc.co.jp','セレブリックス|cerebrix.jp','エイジス|ajis.jp'
]);
const PROMPTS={
lead:`現場ポートの新規営業先を30社調査して、Google Sheet「地方フィールドBPO_Phase0_管理正本」に追加して。絶対条件：\n1) 企業名・事業内容・公式URL・問い合わせ先は公開情報で確認し、推測しない。\n2) 01_営業先、02_CRM、07_既出企業台帳を必ず先に照合し、一度でも既出の企業は再候補化しない。企業名だけでなくドメイン、メール、問い合わせフォームURLも重複確認する。\n3) 公式サイト等の根拠URLを各社に保存する。確認できない担当者名・メールは空欄。\n4) 現場ポートの「青森市で現地に行かないと終わらない仕事を代行」に需要がありそうな企業を優先する。\n5) 調査後、07_既出企業台帳にも追加して今後の再出現を防ぐ。\n6) メール送信・問い合わせフォーム送信は絶対にしない。`,
draft:`Google Sheet「地方フィールドBPO_Phase0_管理正本」の営業候補について、企業別の営業メール下書きを作って09_メール下書きに保存して。絶対条件：\n1) 各社の公式サイト・根拠URLを確認し、会社ごとに内容を変える。同文コピペは禁止。\n2) 公開情報で確認できない担当者名は捏造せず「〇〇株式会社 ご担当者様」等にする。メールアドレスも推測しない。\n3) 件名・本文・企業別の確認事実・根拠URL・作成日時を記録する。\n4) 過度な誇張、架空実績、虚偽の緊急性は使わない。\n5) Gmailの送信は絶対にしない。下書き作成まで。`,
sync:`GmailとGoogle Sheet「地方フィールドBPO_Phase0_管理正本」を照合して営業CRMを更新して。絶対条件：\n1) 01_営業先・02_CRM・07_既出企業台帳にある企業について、Gmailの送受信を確認する。\n2) 新しい送受信があれば08_送受信履歴へ日時、方向、宛先、件名、Gmail Thread ID、Message ID、返信分類、次回アクションを記録する。\n3) 02_CRMの状態、最終接触日、次回連絡日も必要に応じて更新する。\n4) 既存履歴とMessage IDを照合し二重記録しない。\n5) メール送信・返信・問い合わせフォーム送信は絶対にしない。`
};
const seenCompanyNames=new Set(['株式会社佐々通オンサイト','株式会社エスコ','ビーモーション株式会社','株式会社mitoriz','インパクトホールディングス株式会社／インパクトフィールド','株式会社エーエスピー','フィールドマーケティングシステムズ株式会社','共同印刷株式会社','株式会社プロモ','macs REALIZ株式会社','株式会社ヒカリパートナーズ','株式会社ナビット','ギグワークス株式会社','株式会社MS&Consulting','株式会社セレブリックス','株式会社エイジス'].map(normalizeCompany));
function normalizeCompany(s){return String(s||'').toLowerCase().replace(/[\s　]/g,'').replace(/株式会社|有限会社|合同会社|一般社団法人|一般財団法人/g,'').replace(/[／/]/g,'')}
function normalizeDomain(s){let v=String(s||'').trim().toLowerCase();try{if(/^https?:\/\//.test(v))v=new URL(v).hostname}catch{}return v.replace(/^www\./,'').replace(/\/$/,'')}
function cleanUrl(s){return String(s||'').trim().replace(/#.*$/,'').replace(/\/$/,'')}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return []}}
function store(rows){localStorage.setItem(KEY,JSON.stringify(rows));render()}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2200)}
function dataFromForm(){const d=Object.fromEntries(new FormData($('#sales-form')).entries());d.company=d.company.trim();d.domain=normalizeDomain(d.domain);d.email=d.email.trim().toLowerCase();d.sourceUrl=cleanUrl(d.sourceUrl);d.formUrl=cleanUrl(d.formUrl);d.updatedAt=new Date().toISOString();return d}
function duplicateReason(d,rows){const n=normalizeCompany(d.company), key=`${n}|${d.domain}`;if(SEEN_KEYS.has(key)||seenCompanyNames.has(n))return '既出企業台帳に登録済みです';for(const r of rows){if(r.id===d.id)continue;const rn=normalizeCompany(r.company),rk=`${rn}|${normalizeDomain(r.domain)}`;if(key!=='|'&&rk===key)return '企業名＋ドメインが重複しています';if(d.email&&r.email&&d.email===r.email.toLowerCase())return 'メールアドレスが重複しています';if(d.formUrl&&r.formUrl&&cleanUrl(d.formUrl)===cleanUrl(r.formUrl))return '問い合わせフォームURLが重複しています';if(n&&rn===n)return '企業名が重複しています'}return ''}
function save(){const d=dataFromForm();if(!d.company){toast('企業名を入力してください');return}const rows=load(), reason=duplicateReason(d,rows);if(reason){alert(`保存を停止しました。${reason}\n正本の07_既出企業台帳も確認してください。`);return}if(!d.id)d.id=`LOCAL-${Date.now()}`;const i=rows.findIndex(x=>x.id===d.id);if(i>=0)rows[i]=d;else rows.unshift(d);store(rows);reset();toast('保存しました。正本への反映はGoogle Sheetで管理してください')}
function reset(){const f=$('#sales-form');f.reset();f.elements.id.value='';f.elements.status.value='未接触';f.elements.priority.value='S'}
function edit(id){const r=load().find(x=>x.id===id);if(!r)return;const f=$('#sales-form');Object.entries(r).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v??''});window.scrollTo({top:0,behavior:'smooth'})}
function del(id){if(!confirm('この端末の登録から削除しますか？ 正本Google Sheetは削除されません。'))return;store(load().filter(x=>x.id!==id));toast('この端末の登録を削除しました')}
function render(){const rows=load();$('#kpi-total').textContent=rows.length;$('#kpi-new').textContent=rows.filter(x=>x.status==='未接触').length;$('#kpi-draft').textContent=rows.filter(x=>x.subject||x.body||x.status==='下書き作成').length;$('#kpi-reply').textContent=rows.filter(x=>['返信あり','商談'].includes(x.status)).length;$('#sales-rows').innerHTML=rows.map(r=>`<tr><td><b>${esc(r.company)}</b><div class="tiny">${esc(r.priority||'')}</div></td><td>${esc(r.domain||'—')}</td><td>${esc(r.recipient||'—')}<div class="tiny">${esc(r.email||'')}</div></td><td><span class="status-pill">${esc(r.status||'')}</span></td><td>${esc(r.lastContact||'—')}</td><td>${esc(r.nextDate||'—')}</td><td>${r.sourceUrl?`<a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">根拠</a>`:'—'}</td><td><button class="mini" data-edit="${esc(r.id)}">編集</button> <button class="mini" data-del="${esc(r.id)}">削除</button></td></tr>`).join('')||'<tr><td colspan="8">この端末にはまだ登録がありません。正本Google Sheetの既存企業は別管理です。</td></tr>';$$('[data-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.edit));$$('[data-del]').forEach(b=>b.onclick=()=>del(b.dataset.del))}
function csvCell(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function exportCsv(){const cols=['id','company','domain','email','recipient','sourceUrl','formUrl','status','priority','lastContact','nextDate','facts','subject','body','notes','updatedAt'];const rows=load();const csv='\ufeff'+[cols,...rows.map(r=>cols.map(c=>r[c]??''))].map(row=>row.map(csvCell).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`genbaport-sales-local-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function copyPrompt(type){const text=PROMPTS[type];$('#prompt-preview').value=text;navigator.clipboard?.writeText(text).then(()=>toast('指示文をコピーしました')).catch(()=>{$('#prompt-preview').focus();$('#prompt-preview').select();toast('指示文を選択しました')})}
function init(){$('#save-company').onclick=save;$('#reset-company').onclick=reset;$('#export-sales').onclick=exportCsv;$$('.copy-prompt').forEach(b=>b.onclick=()=>copyPrompt(b.dataset.prompt));$('#prompt-preview').value=PROMPTS.lead;render();}
document.addEventListener('DOMContentLoaded',init);
})();
