(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const KEY='genbaport_ops_v1';
const state={photos:[]};
const yen=n=>new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(Number(n||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const toast=msg=>{const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1800)};
const today=()=>new Date().toISOString().slice(0,10);
function serializeForm(form){return Object.fromEntries(new FormData(form).entries())}
function fillForm(form,data={}){Object.entries(data).forEach(([k,v])=>{const el=form.elements[k];if(el)el.value=v??''})}
function getStore(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function setStore(obj){localStorage.setItem(KEY,JSON.stringify(obj));updateSavedAt()}
function updateSavedAt(){const s=getStore();$('#report-saved-at').textContent=s.reportSavedAt||'未保存';$('#invoice-saved-at').textContent=s.invoiceSavedAt||'未保存'}
function stamp(){return new Date().toLocaleString('ja-JP',{hour12:false})}

function resultRow(data={}){const tr=document.createElement('tr');tr.innerHTML=`<td class="num"></td><td><input data-k="item" value="${esc(data.item||'')}"></td><td><input data-k="result" value="${esc(data.result||'')}"></td><td><input data-k="evidence" value="${esc(data.evidence||'')}"></td><td><input data-k="note" value="${esc(data.note||'')}"></td><td><button class="remove-row" type="button" aria-label="削除">×</button></td>`;tr.addEventListener('input',renderReport);$('.remove-row',tr).onclick=()=>{tr.remove();renumberResults();renderReport()};$('#result-rows').appendChild(tr);renumberResults()}
function renumberResults(){$$('#result-rows tr').forEach((tr,i)=>$('.num',tr).textContent=i+1)}
function getResults(){return $$('#result-rows tr').map(tr=>Object.fromEntries($$('input[data-k]',tr).map(x=>[x.dataset.k,x.value])))}
function setResults(rows){$('#result-rows').innerHTML='';(rows?.length?rows:[{},{},{},{}]).forEach(resultRow)}

function itemRow(data={description:'',qty:1,unit:0,tax:10}){const tr=document.createElement('tr');tr.innerHTML=`<td><input data-k="description" value="${esc(data.description||'')}"></td><td><input data-k="qty" type="number" min="0" step="1" value="${Number(data.qty??1)}"></td><td><input data-k="unit" type="number" min="0" step="1" value="${Number(data.unit??0)}"></td><td><select data-k="tax"><option value="10" ${Number(data.tax)===10?'selected':''}>10%</option><option value="8" ${Number(data.tax)===8?'selected':''}>8%</option><option value="0" ${Number(data.tax)===0?'selected':''}>0%</option></select></td><td><button class="remove-row" type="button" aria-label="削除">×</button></td>`;tr.addEventListener('input',renderInvoice);tr.addEventListener('change',renderInvoice);$('.remove-row',tr).onclick=()=>{tr.remove();renderInvoice()};$('#item-rows').appendChild(tr)}
function getItems(){return $$('#item-rows tr').map(tr=>Object.fromEntries($$('[data-k]',tr).map(x=>[x.dataset.k,x.value]))).map(x=>({...x,qty:Number(x.qty||0),unit:Number(x.unit||0),tax:Number(x.tax||0)}))}
function setItems(rows){$('#item-rows').innerHTML='';(rows?.length?rows:[{description:'案件基本料',qty:1,unit:5000,tax:10},{description:'現地確認料',qty:1,unit:4000,tax:10}]).forEach(itemRow)}

function reportData(){return {...serializeForm($('#report-form')),results:getResults()}}
function invoiceData(){return {...serializeForm($('#invoice-form')),items:getItems()}}
function renderReport(){const d=reportData();$('#pv-job').textContent='JOB ID '+(d.jobId||'—');$('#report-meta').innerHTML=[['顧客',d.client],['担当者',d.contact],['現場',d.site],['住所',d.address],['実施日',d.date],['実施時刻',d.time]].map(([k,v])=>`<div class="k">${esc(k)}</div><div>${esc(v||'—')}</div>`).join('');$('#pv-request').textContent=d.request||'—';$('#pv-summary').textContent=d.summary||'—';$('#pv-results').innerHTML=d.results.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.item||'')}</td><td>${esc(r.result||'')}</td><td>${esc(r.evidence||'')}</td><td>${esc(r.note||'')}</td></tr>`).join('')||'<tr><td colspan="5">—</td></tr>';renderPhotoPreview()}
function renderInvoice(){
  const d=invoiceData();
  $('#pv-invoice-no').textContent=d.invoiceNo||'—';
  $('#pv-issue-date').textContent=d.issueDate?`発行日 ${d.issueDate}`:'';
  $('#pv-service-date').textContent=d.serviceDate?`取引日 ${d.serviceDate}`:'';
  $('#pv-client').textContent=d.client||'御中';
  $('#pv-issuer').textContent=d.issuer||'現場ポート';
  $('#pv-issuer-email').textContent=d.issuerEmail||'';
  $('#pv-registration').textContent=d.registrationNo?`登録番号 ${d.registrationNo}`:'';
  const byRate={};let subtotal=0;
  $('#pv-items').innerHTML=d.items.map(x=>{const amount=x.qty*x.unit;subtotal+=amount;byRate[x.tax]=(byRate[x.tax]||0)+amount;return `<tr><td>${esc(x.description||'')}</td><td>${x.qty}</td><td>${yen(x.unit)}</td><td>${x.tax}%</td><td>${yen(amount)}</td></tr>`}).join('')||'<tr><td colspan="5">—</td></tr>';
  let totalTax=0;
  const breakdown=Object.keys(byRate).map(Number).sort((a,b)=>b-a).map(rate=>{const base=byRate[rate];const tax=rate===0?0:Math.floor(base*rate/100);totalTax+=tax;return `<div><span>${rate}%対象額</span><b>${yen(base)}</b><span>消費税額</span><b>${yen(tax)}</b></div>`}).join('');
  $('#pv-tax-breakdown').innerHTML=breakdown;
  $('#pv-subtotal').textContent=yen(subtotal);$('#pv-tax').textContent=yen(totalTax);$('#pv-total').textContent=$('#pv-grand').textContent=yen(subtotal+totalTax);
  $('#pv-due').textContent=d.dueDate||'—';$('#pv-bank').textContent=d.bank||'—';$('#pv-memo').textContent=[d.jobId?`JOB ID: ${d.jobId}`:'',d.memo||''].filter(Boolean).join('\n')||'—';
}

function handlePhotos(files){[...files].forEach(file=>{if(!file.type.startsWith('image/'))return;const reader=new FileReader();reader.onload=()=>{state.photos.push({name:file.name,url:reader.result,caption:''});renderPhotoEditor();renderPhotoPreview()};reader.readAsDataURL(file)})}
function renderPhotoEditor(){const box=$('#photo-editor');box.innerHTML='';state.photos.forEach((p,i)=>{const card=document.createElement('div');card.className='photo-edit-card';card.innerHTML=`<img src="${p.url}" alt=""><div><b>PHOTO-${String(i+1).padStart(2,'0')}</b><input value="${esc(p.caption)}" placeholder="写真説明"><button class="remove-row" type="button">写真を削除</button></div>`;$('input',card).oninput=e=>{p.caption=e.target.value;renderPhotoPreview()};$('button',card).onclick=()=>{state.photos.splice(i,1);renderPhotoEditor();renderPhotoPreview()};box.appendChild(card)})}
function renderPhotoPreview(){const box=$('#pv-photos');box.innerHTML='';state.photos.forEach((p,i)=>{const d=document.createElement('div');d.className='photo-card';d.innerHTML=`<img src="${p.url}" alt=""><b>PHOTO-${String(i+1).padStart(2,'0')} ${esc(p.caption)}</b>`;box.appendChild(d)});$('#pv-photo-section').style.display=state.photos.length?'block':'none'}

function saveReport(){const s=getStore();s.report=reportData();s.reportSavedAt=stamp();setStore(s);toast('報告書の下書きを保存しました')}
function saveInvoice(){const s=getStore();s.invoice=invoiceData();s.invoiceSavedAt=stamp();setStore(s);toast('請求書の下書きを保存しました')}
function resetReport(){if(!confirm('報告書を新規状態にしますか？'))return;$('#report-form').reset();$('#report-form').elements.date.value=today();setResults();state.photos=[];renderPhotoEditor();renderReport()}
function resetInvoice(){if(!confirm('請求書を新規状態にしますか？'))return;$('#invoice-form').reset();$('#invoice-form').elements.issueDate.value=today();$('#invoice-form').elements.serviceDate.value=today();$('#invoice-form').elements.issuer.value='現場ポート';$('#invoice-form').elements.issuerEmail.value='genbaport@gmail.com';setItems();renderInvoice()}
function printDoc(panelId,paperId){$$('.panel,.paper').forEach(x=>x.classList.remove('printing'));$(panelId).classList.add('printing');$(paperId).classList.add('printing');setTimeout(()=>window.print(),50)}
window.addEventListener('afterprint',()=>$$('.printing').forEach(x=>x.classList.remove('printing')));

function init(){
  $$('.nav').forEach(btn=>btn.onclick=()=>{$$('.nav').forEach(x=>x.classList.remove('active'));$$('.panel').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$('#'+btn.dataset.target).classList.add('active')});
  $('#add-result').onclick=()=>{resultRow();renderReport()};$('#add-item').onclick=()=>{itemRow();renderInvoice()};
  $('#report-form').addEventListener('input',renderReport);$('#invoice-form').addEventListener('input',renderInvoice);$('#invoice-form').addEventListener('change',renderInvoice);
  $('#photo-input').onchange=e=>{handlePhotos(e.target.files);e.target.value=''};
  $('#report-save').onclick=saveReport;$('#invoice-save').onclick=saveInvoice;$('#report-reset').onclick=resetReport;$('#invoice-reset').onclick=resetInvoice;
  $('#report-print').onclick=()=>printDoc('#report-panel','#report-preview');$('#invoice-print').onclick=()=>printDoc('#invoice-panel','#invoice-preview');
  $('#print-current').onclick=()=>$('#report-panel').classList.contains('active')?printDoc('#report-panel','#report-preview'):$('#invoice-panel').classList.contains('active')?printDoc('#invoice-panel','#invoice-preview'):toast('報告書か請求書を開いてください');
  $('#export-data').onclick=()=>{const blob=new Blob([JSON.stringify(getStore(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`genbaport-ops-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  $('#import-data').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);setStore(d);loadStored();toast('バックアップを読み込みました')}catch{alert('JSONファイルを読み込めませんでした')}};r.readAsText(f);e.target.value=''};
  $('#clear-data').onclick=()=>{if(confirm('この端末に保存した報告書・請求書データをすべて削除しますか？')){localStorage.removeItem(KEY);loadStored();toast('保存データを削除しました')}};
  loadStored();
}
function loadStored(){const s=getStore();const rf=$('#report-form'),inf=$('#invoice-form');rf.reset();inf.reset();fillForm(rf,s.report||{});fillForm(inf,s.invoice||{});if(!rf.elements.date.value)rf.elements.date.value=today();if(!inf.elements.issueDate.value)inf.elements.issueDate.value=today();if(!inf.elements.serviceDate.value)inf.elements.serviceDate.value=today();if(!inf.elements.issuer.value)inf.elements.issuer.value='現場ポート';if(!inf.elements.issuerEmail.value)inf.elements.issuerEmail.value='genbaport@gmail.com';setResults(s.report?.results);setItems(s.invoice?.items);state.photos=[];renderPhotoEditor();renderReport();renderInvoice();updateSavedAt()}
document.addEventListener('DOMContentLoaded',init);
})();
