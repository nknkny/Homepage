const ROUTES = new Set(['discover','calendar','post','dashboard','favorites']);
function route(id, historyMode = 'push') {
  if (!ROUTES.has(id)) id = 'discover';
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === id));
  if (id === 'dashboard') loadDashboard();
  if (id === 'favorites') renderFavorites();
  if (id === 'calendar') { loadCalendar(); track('calendar_view', null, { route: 'calendar' }); }
  const nextHash = `#${id}`;
  if (historyMode === 'replace') history.replaceState({ route: id }, '', nextHash);
  else if (historyMode === 'push' && location.hash !== nextHash) history.pushState({ route: id }, '', nextHash);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function routeFromHistory() { const h = location.hash.replace('#',''); route(ROUTES.has(h) ? h : 'discover', 'none'); }
function quickPost(type) {
  resetForm(); setPostType(type); route('post');
  track('quick_post_path', null, { listingType: type, source: 'home' });
}

function installEnterpriseStyles() {
  if (document.querySelector('link[data-enterprise-layer]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = 'enterprise.css?v=20260827-1'; link.dataset.enterpriseLayer = 'true';
  document.head.appendChild(link);
}

function installEnterpriseDiscovery() {
  const heroCopy = document.querySelector('#discover .hero-copy');
  if (!heroCopy || document.getElementById('enterpriseSearch')) return;
  const intro = heroCopy.querySelector('p:not(.hero-note)');
  const box = document.createElement('div');
  box.className = 'enterprise-search'; box.id = 'enterpriseSearch';
  box.setAttribute('role', 'search');
  box.innerHTML = `
    <div class="enterprise-search-field"><label for="enterpriseLocation">地域</label><input id="enterpriseLocation" maxlength="40" value="${esc(CONFIG.defaultMunicipality)}" aria-label="イベントを探す地域"></div>
    <div class="enterprise-search-field"><label for="enterpriseKeyword">イベント・キーワード</label><input id="enterpriseKeyword" maxlength="80" placeholder="音楽、マルシェ、ワークショップ…" aria-label="イベント検索キーワード"></div>
    <div class="enterprise-search-field"><label for="enterpriseDate">日付</label><select id="enterpriseDate" aria-label="開催日"><option value="">すべての日付</option><option value="today">今日</option><option value="weekend">今週末</option><option value="week">7日以内</option></select></div>
    <button id="enterpriseSearchBtn" class="enterprise-search-btn" type="button">イベントを探す</button>`;
  intro?.insertAdjacentElement('afterend', box);

  const quick = document.createElement('div');
  quick.className = 'enterprise-quick';
  quick.innerHTML = '<button type="button" data-enterprise-date="today">今日</button><button type="button" data-enterprise-date="weekend">今週末</button><button type="button" data-enterprise-date="week">7日以内</button>';
  box.insertAdjacentElement('afterend', quick);

  const hero = document.querySelector('#discover .hero');
  const rail = document.createElement('section');
  rail.className = 'enterprise-discovery-rail';
  rail.innerHTML = `<div class="wrap enterprise-discovery-inner"><span class="enterprise-discovery-label">カテゴリから探す</span>${['ポップアップ・物販','音楽・ライブ','展示・アート','飲食・フード','ワークショップ','地域活動'].map((c) => `<button type="button" class="enterprise-category" data-enterprise-category="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
  hero?.insertAdjacentElement('afterend', rail);

  const runSearch = (preset = null) => {
    const locationValue = text($('enterpriseLocation').value) || CONFIG.defaultMunicipality;
    const keywordValue = text($('enterpriseKeyword').value);
    if (preset !== null) $('enterpriseDate').value = preset;
    state.calendarDatePreset = $('enterpriseDate').value;
    $('calendarPrefecture').value = CONFIG.defaultPrefecture;
    $('calendarMunicipality').value = locationValue;
    $('calendarQ').value = keywordValue;
    $('calendarCategory').value = '';
    track('enterprise_event_search', null, { municipality: locationValue, datePreset: state.calendarDatePreset, hasKeyword: !!keywordValue });
    route('calendar');
  };
  $('enterpriseSearchBtn').onclick = () => runSearch();
  $('enterpriseKeyword').addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });
  quick.querySelectorAll('[data-enterprise-date]').forEach((b) => { b.onclick = () => runSearch(b.dataset.enterpriseDate); });
  rail.querySelectorAll('[data-enterprise-category]').forEach((b) => {
    b.onclick = () => {
      state.calendarDatePreset = '';
      $('calendarPrefecture').value = CONFIG.defaultPrefecture;
      $('calendarMunicipality').value = text($('enterpriseLocation').value) || CONFIG.defaultMunicipality;
      $('calendarQ').value = '';
      $('calendarCategory').value = b.dataset.enterpriseCategory;
      track('enterprise_category', null, { category: b.dataset.enterpriseCategory });
      route('calendar');
    };
  });
}

function bindStatic() {
  document.querySelectorAll('[data-nav]').forEach((b) => { b.onclick = () => route(b.dataset.nav); });
  document.querySelectorAll('[data-quick-post]').forEach((b) => { b.onclick = () => quickPost(b.dataset.quickPost); });
  document.querySelectorAll('[data-discover-type]').forEach((b) => { b.onclick = async () => { state.discoverType = b.dataset.discoverType; document.querySelectorAll('[data-discover-type]').forEach((x) => x.classList.toggle('active', x === b)); await loadBoard(true); }; });
  document.querySelectorAll('[data-post-type]').forEach((b) => { b.onclick = () => { resetForm(); setPostType(b.dataset.postType); }; });
  document.querySelectorAll('[data-post-event]').forEach((b) => { b.onclick = () => { resetForm(); setPostType('event'); route('post'); }; });
  $('searchBtn').onclick = async () => { await Promise.all([loadBoard(true), loadCandidatePools()]); track('search', null, { filterType: state.discoverType, sort: $('sort').value }); };
  $('resetSearchBtn').onclick = async () => { $('prefectureFilter').value = CONFIG.defaultPrefecture; $('municipalityFilter').value = CONFIG.defaultMunicipality; $('q').value = ''; $('categoryFilter').value = ''; $('sort').value = 'new'; await Promise.all([loadBoard(true), loadCandidatePools()]); };
  $('loadMoreBtn').onclick = () => loadBoard(false);
  $('calendarSearchBtn').onclick = async () => { state.calendarDatePreset = ''; await loadCalendar(); track('calendar_view', null, { source: 'search' }); };
  $('sort').addEventListener('change', renderBrowse); $('calendarQ').addEventListener('input', () => renderCalendar(state.calendarRows));
  $('postForm').addEventListener('submit', submitForm); $('resetBtn').onclick = () => resetForm();
  $('description').addEventListener('input', () => { $('descriptionCount').textContent = String($('description').value.length); });
  $('images').addEventListener('change', () => { const files = [...$('images').files].slice(0,3); state.selectedFiles = files; previewSelectedFiles(); if ($('images').files.length > 3) toast('写真は最大3枚です。先頭3枚だけ選択しました。'); });
  $('modalClose').onclick = closeModal; $('modal').onclick = (e) => { if (e.target === $('modal')) closeModal(); }; document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  $('exportBtn').onclick = exportIdentity; $('importBtn').onclick = () => $('importFile').click(); $('importFile').onchange = (e) => { const f = e.target.files?.[0]; if (f) importIdentity(f); e.target.value = ''; };
  $('markReadBtn').onclick = async () => { if (!(await ensureReady())) return; try { await api('mark_notifications_read', { method: 'POST', auth: true, body: {} }); await loadDashboard(); } catch (e) { toast(errorMessage(e)); } };
  $('healthBtn').onclick = () => healthCheck(true);
  document.querySelectorAll('[data-dash]').forEach((b) => { b.onclick = () => { document.querySelectorAll('[data-dash]').forEach((x) => x.classList.toggle('active', x === b)); document.querySelectorAll('.dash-panel').forEach((p) => p.classList.toggle('active', p.id === b.dataset.dash)); }; });
}

async function init() {
  installEnterpriseStyles();
  initPrefectures(); identity(); sessionId(); bindStatic(); installEnterpriseDiscovery(); resetForm(false);
  state.dashboard = read('dashboard_cache', state.dashboard);
  state.calendarDatePreset = '';
  const h = location.hash.replace('#',''); route(ROUTES.has(h) ? h : 'discover', 'replace');
  await healthCheck(); if (state.online) await bootstrap();
  await Promise.all([loadBoard(true), loadDashboard(), loadCalendar()]);
  track('page_view', null, { route: h || 'discover' });
}

window.addEventListener('popstate', routeFromHistory);
document.addEventListener('DOMContentLoaded', init);