function route(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === id));
  if (id === 'dashboard') loadDashboard();
  if (id === 'favorites') renderFavorites();
  if (id === 'calendar') { loadCalendar(); track('calendar_view', null, { route: 'calendar' }); }
  history.replaceState(null, '', `#${id}`); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function quickPost(type) {
  resetForm(); setPostType(type); route('post');
  track('quick_post_path', null, { listingType: type, source: 'home' });
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
  $('calendarSearchBtn').onclick = async () => { await loadCalendar(); track('calendar_view', null, { source: 'search' }); };
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
  initPrefectures(); identity(); sessionId(); bindStatic(); resetForm(false);
  state.dashboard = read('dashboard_cache', state.dashboard);
  const h = location.hash.replace('#',''); if (['discover','calendar','post','dashboard','favorites'].includes(h)) route(h);
  await healthCheck(); if (state.online) await bootstrap();
  await Promise.all([loadBoard(true), loadDashboard(), loadCalendar()]);
  track('page_view', null, { route: h || 'discover' });
}

document.addEventListener('DOMContentLoaded', init);