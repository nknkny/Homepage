async function loadCityStats() {
  try {
    const d = await api('city_stats', { query: { prefecture: $('prefectureFilter').value, municipality: text($('municipalityFilter').value) } });
    state.cityStats = { space: +(d.space || 0), want: +(d.want || 0), event: +(d.event || 0) };
  } catch (e) { console.error(e); state.cityStats = { space: 0, want: 0, event: 0 }; }
  renderBrowse();
}
async function loadCandidatePools() {
  const areas = new Map();
  const own = state.dashboard.listings.filter((r) => ['space','want'].includes(r.type) && r.prefecture && r.municipality);
  for (const r of own) areas.set(`${r.prefecture}\u0000${r.municipality}`, [r.prefecture, r.municipality]);
  if (!areas.size) areas.set(`${activePrefecture()}\u0000${activeMunicipality()}`, [activePrefecture(), activeMunicipality()]);
  const merged = new Map();
  await Promise.all([...areas.values()].slice(0,20).map(async ([prefecture, municipality]) => {
    try {
      const d = await api('public_listings', { query: { prefecture, municipality, limit: 500, offset: 0 } });
      for (const row of (d.listings || []).filter((x) => ['space','want'].includes(x.type)).map(mapListing)) merged.set(row.id, row);
    } catch (e) { console.error(e); }
  }));
  state.candidateRows = [...merged.values()];
  renderDashboard();
  renderBrowse();
}
async function loadBoard(reset = true) {
  const offset = reset ? 0 : state.publicOffset;
  try {
    const d = await api('public_listings', { query: boardQuery(offset) });
    const rows = (d.listings || []).filter((x) => TYPES[x.type]).map(mapListing);
    state.publicRows = reset ? rows : [...state.publicRows, ...rows];
    state.publicCount = d.count || 0;
    state.publicOffset = offset + rows.length;
    state.publicHasMore = !!d.hasMore;
    write('board_cache', state.publicRows);
    renderBrowse();
    $('loadMoreBtn').hidden = !state.publicHasMore;
    if (reset) loadCityStats();
    return true;
  } catch (e) {
    console.error(e);
    if (reset) state.publicRows = read('board_cache', []);
    renderBrowse();
    return false;
  }
}
async function loadCalendar() {
  try {
    const d = await api('public_listings', { query: {
      type: 'event', prefecture: $('calendarPrefecture').value, municipality: text($('calendarMunicipality').value), category: $('calendarCategory').value, limit: 500, offset: 0,
    }});
    state.calendarRows = (d.listings || []).map(mapListing);
    renderCalendar(state.calendarRows);
  } catch (e) { console.error(e); state.calendarRows = []; renderCalendar([]); }
}
async function loadDashboard() {
  if (!state.online) return;
  if (!state.bootstrapped && !(await bootstrap())) return;
  try {
    const d = await api('dashboard', { auth: true });
    state.dashboard = { listings: (d.listings || []).filter((x) => TYPES[x.type]).map(mapListing), notifications: d.notifications || [] };
    write('dashboard_cache', state.dashboard);
  } catch (e) { console.error(e); state.dashboard = read('dashboard_cache', state.dashboard); }
  renderDashboard();
  await loadCandidatePools();
}

function chip(cls, label) { return `<span class="chip ${esc(cls || '')}">${esc(label)}</span>`; }
function areaLabel(r) { return [r.prefecture, r.municipality, r.areaDetail].filter(Boolean).join(' '); }
function periodLabel(r) {
  if (r.type === 'space') return (!r.availableFrom && !r.availableTo) ? '利用可能日：応相談' : `利用可能：${dateLabel(r.availableFrom) || '指定なし'}〜${dateLabel(r.availableTo) || '指定なし'}`;
  return `${dateLabel(r.dateStart)}${r.dateEnd && r.dateEnd !== r.dateStart ? `〜${dateLabel(r.dateEnd)}` : ''}`;
}
function moneyLabel(r) {
  if (r.type === 'space' && r.priceAmount > 0) return `${yen(r.priceAmount)} / 日（目安）`;
  if (r.type === 'want' && r.budgetMax > 0) return `予算上限 ${yen(r.budgetMax)} / 日`;
  if (r.type === 'event' && r.eventPrice) return r.eventPrice;
  return '';
}
function statusChip(r) {
  const m = { review_required:['pending','確認待ち'], auto_hidden:['hidden','自動停止'], expired:['expired','期限切れ'], stale:['expired','更新待ち'] };
  return m[r.status] ? chip(m[r.status][0], m[r.status][1]) : '';
}
function score(want, space) {
  if (!want || want.type !== 'want' || !space || space.type !== 'space') return { score: 0, reasons: [] };
  let n = 5; const reasons = ['掲載種別 +5'];
  if (want.prefecture && want.prefecture === space.prefecture) { n += 20; reasons.push('都道府県一致 +20'); }
  else return { score: 0, reasons: ['都道府県不一致'] };
  if (norm(want.municipality) === norm(space.municipality)) { n += 30; reasons.push('市区町村一致 +30'); }
  else if (norm(want.municipality).includes(norm(space.municipality)) || norm(space.municipality).includes(norm(want.municipality))) { n += 15; reasons.push('市区町村近似 +15'); }
  if (want.category === space.category) { n += 15; reasons.push('用途一致 +15'); }
  if (want.dateEnd && space.availableFrom && space.availableFrom > want.dateEnd) return { score: 0, reasons: ['日程不一致'] };
  if (want.dateStart && space.availableTo && space.availableTo < want.dateStart) return { score: 0, reasons: ['日程不一致'] };
  if ((space.availableFrom || space.availableTo) && want.dateStart) { n += 10; reasons.push('日程確認可 +10'); }
  if (want.capacity > 0 && space.capacity > 0) {
    if (space.capacity < want.capacity) return { score: 0, reasons: ['人数不一致'] };
    n += 8; reasons.push('人数条件 +8');
  }
  if (want.budgetMax > 0 && space.priceAmount > 0) {
    if (space.priceAmount <= want.budgetMax) { n += 10; reasons.push('予算内 +10'); }
    else if (space.priceAmount <= want.budgetMax * 1.2) { n += 3; reasons.push('予算に近い +3'); }
  }
  const wt = new Set(want.tags || []); const shared = (space.tags || []).filter((x) => wt.has(x));
  if (shared.length) { const add = Math.min(12, shared.length * 4); n += add; reasons.push(`共通タグ${shared.length}件 +${add}`); }
  return { score: Math.min(100, n), reasons };
}
function recommendationsFor(r) {
  const pool = state.candidateRows.length ? state.candidateRows : state.publicRows;
  if (r.type === 'want') return pool.filter((x) => x.type === 'space').map((x) => ({ row: x, ...score(r, x) })).filter((x) => x.score > 0).sort((a,b) => b.score - a.score);
  if (r.type === 'space') return pool.filter((x) => x.type === 'want').map((x) => ({ row: x, ...score(x, r) })).filter((x) => x.score > 0).sort((a,b) => b.score - a.score);
  return [];
}
function firstImage(r) { return (r.imageUrls || []).map(safeHttps).find(Boolean) || ''; }
function card(r, match = null) {
  const fav = favorites().includes(r.id); const image = firstImage(r);
  const facts = [];
  if (r.type === 'space' && r.spaceKind) facts.push(r.spaceKind);
  if (r.type === 'space' && r.indoorOutdoor) facts.push(r.indoorOutdoor);
  if (r.capacity > 0) facts.push(`${r.capacity}人程度`);
  if (r.type === 'event' && r.placeName) facts.push(r.placeName);
  return `<article class="card card-${esc(r.type)}">
    ${image ? `<button class="card-image" data-detail="${esc(r.id)}" type="button"><img src="${esc(image)}" loading="lazy" alt="${esc(r.title)}"></button>` : ''}
    <div class="meta">${chip(r.type, TYPES[r.type])}${chip('', areaLabel(r))}${statusChip(r)}</div>
    <h3>${esc(r.title)}</h3>
    <div class="card-facts"><span>${esc(periodLabel(r))}</span>${facts.length ? `<span>${esc(facts.join('・'))}</span>` : ''}${moneyLabel(r) ? `<strong>${esc(moneyLabel(r))}</strong>` : ''}</div>
    <p>${esc((r.description || '').slice(0, 165))}${(r.description || '').length > 165 ? '…' : ''}</p>
    <div class="tags">${(r.tags || []).slice(0, 6).map((x) => chip('tag', x)).join('')}</div>
    ${match ? `<div class="score-box"><strong>一致度 ${match.score}点</strong><span>${esc(match.reasons.join(' / '))}</span></div>` : ''}
    <div class="card-footer"><button class="btn primary small" data-detail="${esc(r.id)}" type="button">詳細を見る</button><button class="btn ghost small fav-btn" aria-label="お気に入り" data-fav="${esc(r.id)}" type="button">${fav ? '★' : '☆'}</button></div>
  </article>`;
}
