function currentFilteredRows() {
  let rows = [...state.publicRows];
  const sort = $('sort').value;
  if (sort === 'date') rows.sort((a,b) => String(a.dateStart || a.availableFrom || '9999').localeCompare(String(b.dateStart || b.availableFrom || '9999')));
  else if (sort === 'price') rows.sort((a,b) => (a.priceAmount || a.budgetMax || Number.MAX_SAFE_INTEGER) - (b.priceAmount || b.budgetMax || Number.MAX_SAFE_INTEGER));
  else rows.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return rows;
}
function renderBrowse() {
  const rows = currentFilteredRows();
  $('listingGrid').innerHTML = rows.length ? rows.map((r) => card(r)).join('') : '<div class="empty">条件に合う掲載はありません。場所または開催企画の最初の1件を無料掲載できます。</div>';
  $('resultMeta').textContent = `公開 ${state.publicCount.toLocaleString('ja-JP')}件中 ${rows.length.toLocaleString('ja-JP')}件を表示`;
  const all = state.candidateRows.length ? state.candidateRows : state.publicRows;
  $('kSpace').textContent = state.cityStats.space;
  $('kWant').textContent = state.cityStats.want;
  $('kEvent').textContent = state.cityStats.event;
  let high = 0; for (const w of all.filter((x) => x.type === 'want' && x.prefecture === activePrefecture() && norm(x.municipality).includes(norm(activeMunicipality())))) high += all.filter((x) => x.type === 'space').filter((sp) => score(w, sp).score >= CONFIG.matchThreshold).length;
  $('kMatch').textContent = high;
  bindDynamic($('listingGrid'));
}
function renderHomeEvents(rows) {
  const root = $('homeEventGrid'); if (!root) return;
  const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const upcoming = [...rows].filter((r) => !r.dateEnd || r.dateEnd >= today).sort((a,b) => String(a.dateStart || '9999').localeCompare(String(b.dateStart || '9999'))).slice(0,8);
  root.innerHTML = upcoming.length ? upcoming.map((r) => card(r)).join('') : '<div class="empty">現在この地域で公開中の開催予定イベントはありません。最初のイベントを無料で告知できます。</div>';
  bindDynamic(root);
}
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dateRangeForPreset(preset) {
  if (!preset) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  if (preset === 'today') return [dateKey(now), dateKey(now)];
  if (preset === 'week') { const end = new Date(now); end.setDate(end.getDate()+6); return [dateKey(now), dateKey(end)]; }
  if (preset === 'weekend') {
    const day = now.getDay(); const add = day === 6 ? 0 : day === 0 ? 0 : 6-day;
    const sat = new Date(now); sat.setDate(sat.getDate()+add);
    const sun = new Date(sat); sun.setDate(sun.getDate()+1);
    return [dateKey(sat), dateKey(sun)];
  }
  return null;
}
function eventInRange(r, range) {
  if (!range) return true;
  const start = r.dateStart || ''; const end = r.dateEnd || start;
  if (!start) return false;
  return start <= range[1] && end >= range[0];
}
function renderCalendar(rows) {
  renderHomeEvents(rows);
  const q = norm($('calendarQ').value);
  const range = dateRangeForPreset(state.calendarDatePreset || '');
  rows = rows.filter((r) => (!q || norm([r.title, r.description, r.placeName, (r.tags || []).join(' ')].join(' ')).includes(q)) && eventInRange(r, range)).sort((a,b) => String(a.dateStart).localeCompare(String(b.dateStart)));
  const presetLabel = {today:'今日',weekend:'今週末',week:'7日以内'}[state.calendarDatePreset] || '';
  if (!rows.length) { $('calendarList').innerHTML = `<div class="empty">${presetLabel ? `${presetLabel}に` : 'この地域で'}掲載中のイベントはありません。条件を変更するか、最初のイベントを無料で告知できます。</div>`; return; }
  const groups = {};
  for (const r of rows) (groups[r.dateStart] ??= []).push(r);
  $('calendarList').innerHTML = `${presetLabel ? `<div class="notice"><strong>${esc(presetLabel)}</strong>のイベントを表示しています。</div>` : ''}${Object.entries(groups).map(([d, items]) => `<section class="calendar-day"><div class="calendar-date"><b>${esc(dateLabel(d))}</b><span>${items.length}件</span></div><div class="grid">${items.map((r) => card(r)).join('')}</div></section>`).join('')}`;
  bindDynamic($('calendarList'));
}

function favorites() { return read('favorites', []); }
function setFavorites(v) { write('favorites', [...new Set(v)]); }
function toggleFavorite(id) {
  let f = favorites();
  if (f.includes(id)) f = f.filter((x) => x !== id); else f.push(id);
  setFavorites(f); renderBrowse(); renderFavorites(); renderHomeEvents(state.calendarRows); track('favorite', findListing(id), { source: 'button' });
}
function renderFavorites() {
  const map = new Map([...state.publicRows, ...state.calendarRows, ...state.dashboard.listings].map((r) => [r.id, r]));
  const rows = favorites().map((id) => map.get(id)).filter(Boolean);
  $('favGrid').innerHTML = rows.length ? rows.map((r) => card(r)).join('') : '<div class="empty">お気に入りはまだありません。</div>';
  bindDynamic($('favGrid'));
}
function findListing(id) { return state.publicRows.find((r) => r.id === id) || state.calendarRows.find((r) => r.id === id) || state.dashboard.listings.find((r) => r.id === id) || null; }

function gallery(r) {
  const imgs = (r.imageUrls || []).map(safeHttps).filter(Boolean);
  return imgs.length ? `<div class="detail-gallery">${imgs.map((u) => `<img src="${esc(u)}" alt="${esc(r.title)}" loading="lazy">`).join('')}</div>` : '';
}
function detail(id) {
  const r = findListing(id); if (!r) return;
  track('listing_view', r, { source: 'detail' });
  const own = state.dashboard.listings.some((x) => x.id === r.id); const contact = safeHttps(r.contactUrl);
  let extra = '';
  if (r.type === 'space') extra = `<dl class="detail-list"><div><dt>場所の種類</dt><dd>${esc(r.spaceKind || '未設定')} ${esc(r.indoorOutdoor || '')}</dd></div><div><dt>広さ</dt><dd>${r.sizeSqm ? esc(`${r.sizeSqm}㎡`) : '未設定'}</dd></div><div><dt>利用できること</dt><dd>${esc(r.allowedUses || '個別確認')}</dd></div><div><dt>できないこと・注意</dt><dd>${esc(r.prohibitedUses || '個別確認')}</dd></div></dl>`;
  if (r.type === 'event') extra = `<dl class="detail-list"><div><dt>開催場所</dt><dd>${esc(r.placeName)}</dd></div><div><dt>来場料金</dt><dd>${esc(r.eventPrice || '未設定')}</dd></div></dl>`;
  const recs = recommendationsFor(r).slice(0, 6);
  $('modalBody').innerHTML = `${gallery(r)}<div class="meta">${chip(r.type, TYPES[r.type])}${chip('', areaLabel(r))}</div><h2 id="modalTitle">${esc(r.title)}</h2><p class="detail-period">${esc(periodLabel(r))}${moneyLabel(r) ? ` / ${esc(moneyLabel(r))}` : ''}</p>${extra}<p class="detail-copy">${esc(r.description)}</p><div class="tags">${(r.tags || []).map((x) => chip('tag', x)).join('')}</div>
    ${contact ? `<div class="external-contact"><strong>掲載者へ直接問い合わせ</strong><p>このサイトは通信・交渉・契約・支払いを中継しません。外部サイトで当事者同士が直接確認してください。</p><a class="btn primary" href="${esc(contact)}" target="_blank" rel="noopener noreferrer" data-contact="${esc(r.id)}">外部問い合わせ先を開く</a></div>` : ''}
    ${recs.length ? `<hr><h3>条件の近い候補</h3><div class="grid compact-grid">${recs.map((x) => card(x.row, x)).join('')}</div>` : ''}
    <div class="modal-actions">${own ? `<button class="btn ghost small" data-edit="${esc(r.id)}" type="button">編集</button>` : ''}<button class="btn ghost small" data-report="${esc(r.id)}" type="button">問題を通報</button></div>`;
  $('modal').classList.add('open'); $('modal').setAttribute('aria-hidden', 'false'); document.body.classList.add('modal-open');
  bindDynamic($('modalBody'));
  $('modalBody').querySelectorAll('[data-contact]').forEach((a) => a.addEventListener('click', () => track('contact_click', r, { source: 'detail' })));
}
function closeModal() { $('modal').classList.remove('open'); $('modal').setAttribute('aria-hidden', 'true'); document.body.classList.remove('modal-open'); }