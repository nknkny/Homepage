function renderExistingImages(r) {
  const urls = r.imageUrls || [], paths = r.imagePaths || [];
  $('existingImages').innerHTML = urls.map((u, i) => `<div class="image-tile"><img src="${esc(safeHttps(u))}" alt="登録画像${i+1}"><button type="button" class="image-remove" data-listing="${esc(r.id)}" data-delete-image="${esc(paths[i] || '')}">削除</button></div>`).join('');
  bindDynamic($('existingImages'));
}
function editListing(id) {
  const r = state.dashboard.listings.find((x) => x.id === id); if (!r) return;
  closeModal(); route('post'); setPostType(r.type);
  $('editId').value = r.id; $('convertedFromId').value = r.convertedFromId || ''; $('title').value = r.title; $('prefecture').value = r.prefecture || CONFIG.defaultPrefecture; $('municipality').value = r.municipality; $('areaDetail').value = r.areaDetail;
  $('category').value = r.category; $('description').value = r.description; $('descriptionCount').textContent = String(r.description.length); $('dateStart').value = r.dateStart; $('dateEnd').value = r.dateEnd; $('availableFrom').value = r.availableFrom; $('availableTo').value = r.availableTo;
  $('capacity').value = r.capacity || ''; $('sizeSqm').value = r.sizeSqm || ''; $('priceAmount').value = r.priceAmount || ''; $('budgetMax').value = r.budgetMax || ''; $('placeName').value = r.placeName; $('eventPrice').value = r.eventPrice;
  $('spaceKind').value = r.spaceKind; $('indoorOutdoor').value = r.indoorOutdoor; $('allowedUses').value = r.allowedUses; $('prohibitedUses').value = r.prohibitedUses; $('tags').value = (r.tags || []).join(', '); $('contactUrl').value = r.contactUrl;
  $('spaceAuthority').checked = r.spaceAuthority; $('spaceInfoOnly').checked = r.spaceInfoOnly; $('temporaryUseOnly').checked = r.temporaryUseOnly; $('eventRightsConfirmed').checked = r.eventRightsConfirmed; $('promoOptIn').checked = r.promoOptIn; $('terms').checked = true;
  for (const u of state.previewObjectUrls) URL.revokeObjectURL(u); state.previewObjectUrls = []; state.selectedFiles = []; $('imagePreview').innerHTML = ''; renderExistingImages(r); window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function deleteImage(listingId, path) {
  if (!path || !confirm('この写真を削除しますか？')) return;
  if (!(await ensureReady())) return;
  try { await api('delete_image', { method: 'POST', auth: true, body: { listingId, path } }); toast('写真を削除しました。'); await loadDashboard(); const r = state.dashboard.listings.find((x) => x.id === listingId); if (r) renderExistingImages(r); await loadBoard(true); }
  catch (e) { toast(errorMessage(e)); }
}
async function deleteListing(id) {
  if (!confirm('この掲載を削除しますか？公開写真も削除されます。')) return;
  if (!(await ensureReady())) return;
  try { await api('delete_listing', { method: 'POST', auth: true, body: { id } }); toast('掲載を削除しました。'); closeModal(); await Promise.all([loadBoard(true), loadDashboard(), loadCalendar()]); }
  catch (e) { toast(errorMessage(e)); }
}
async function renewListing(id) {
  if (!(await ensureReady())) return;
  try { await api('renew_listing', { method: 'POST', auth: true, body: { id } }); toast('掲載を再公開しました。'); await Promise.all([loadBoard(true), loadDashboard()]); }
  catch (e) { toast(errorMessage(e)); }
}
async function reportListing(id) {
  const r = findListing(id); if (!r) return;
  const reason = prompt('問題の内容を4文字以上で入力してください。個人情報は書かないでください。'); if (reason == null) return;
  if (text(reason).length < 4) { toast('通報理由は4文字以上必要です。'); return; }
  if (!(await ensureReady())) return;
  try { await api('report', { method: 'POST', auth: true, body: { listingId: id, reason: text(reason) } }); toast('通報を受け付けました。'); }
  catch (e) { toast(errorMessage(e)); }
}
function convertToEvent(id) {
  const r = state.dashboard.listings.find((x) => x.id === id && x.type === 'want'); if (!r) return;
  route('post'); setPostType('event'); $('convertedFromId').value = r.id; $('title').value = r.title; $('prefecture').value = r.prefecture || CONFIG.defaultPrefecture; $('municipality').value = r.municipality; $('areaDetail').value = r.areaDetail; $('category').value = r.category; $('description').value = r.description; $('descriptionCount').textContent = String(r.description.length); $('dateStart').value = r.dateStart; $('dateEnd').value = r.dateEnd; $('capacity').value = r.capacity || ''; $('tags').value = (r.tags || []).join(', '); $('contactUrl').value = r.contactUrl; $('terms').checked = false; $('eventRightsConfirmed').checked = false; window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderDashboard() {
  const d = state.dashboard; const i = identity();
  $('identityBox').innerHTML = `<strong>この端末の管理鍵</strong><p>掲載の編集・削除に使います。ブラウザデータを消す前にバックアップしてください。ID: <code>${esc(i.ownerId.slice(0,8))}…</code></p><button id="deleteAccountBtn" type="button" class="btn danger small">自分の掲載・管理データをすべて削除</button>`;
  $('mineGrid').innerHTML = d.listings.length ? d.listings.map((r) => `${card(r)}<div class="owner-actions">${r.type === 'want' && ['published','stale'].includes(r.status) ? `<button class="btn primary small" data-convert="${esc(r.id)}" type="button">開催決定 → EVENTへ</button>` : ''}${r.status === 'stale' && r.type === 'space' ? `<button class="btn ghost small" data-renew="${esc(r.id)}" type="button">再公開</button>` : ''}<button class="btn ghost small" data-edit="${esc(r.id)}" type="button">編集</button><button class="btn danger small" data-delete="${esc(r.id)}" type="button">削除</button></div>`).join('') : '<div class="empty">自分の掲載はありません。</div>';
  bindDynamic($('mineGrid'));
  const blocks = d.listings.filter((r) => ['space','want'].includes(r.type)).map((r) => {
    const recs = recommendationsFor(r).slice(0,8);
    return `<section class="recommend-block"><h3>${esc(r.title)}</h3>${recs.length ? `<div class="grid compact-grid">${recs.map((x) => card(x.row, x)).join('')}</div>` : '<div class="empty">現在の検索範囲には候補がありません。地域検索を変更すると候補が増える場合があります。</div>'}</section>`;
  });
  $('recommendationGrid').innerHTML = blocks.length ? blocks.join('') : '<div class="empty">SPACEまたはWANTを掲載すると候補を比較できます。</div>';
  bindDynamic($('recommendationGrid'));
  $('notificationList').innerHTML = d.notifications.length ? d.notifications.map((n) => `<div class="notice ${n.status === 'unread' ? 'unread' : ''}"><strong>${esc(n.title)}</strong><p>${esc(n.message)}</p><small>${esc(new Date(n.created_at).toLocaleString('ja-JP'))}</small></div>`).join('') : '<div class="empty">通知はありません。</div>';
  const delBtn=$('deleteAccountBtn'); if(delBtn) delBtn.onclick=deleteAccount;
  renderFavorites();
}

async function deleteAccount() {
  if (!confirm('この管理鍵に紐づく掲載・写真・通知・通報者IDをすべて削除します。元に戻せません。続けますか？')) return;
  if (!confirm('最終確認です。本当にすべて削除しますか？')) return;
  if (!(await ensureReady())) return;
  try {
    await api('delete_account', { method: 'POST', auth: true, body: {} });
    for (const k of ['identity','dashboard_cache']) localStorage.removeItem(key(k));
    state.dashboard={listings:[],notifications:[]}; state.bootstrapped=false;
    identity(); await bootstrap(); await Promise.all([loadBoard(true), loadDashboard()]);
    toast('自分の掲載・管理データを削除しました。');
  } catch (e) { toast(errorMessage(e)); }
}

function exportIdentity() {
  const payload = { app: 'localspace', version: 1, ...identity() };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); a.download = `localspace-management-key-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
}
async function importIdentity(file) {
  try {
    const v = JSON.parse(await file.text());
    if (v.app !== 'localspace' || !/^[0-9a-f-]{36}$/i.test(v.ownerId || '') || text(v.ownerKey).length < 32) throw new Error('INVALID');
    write('identity', { ownerId: v.ownerId, ownerKey: v.ownerKey, createdAt: v.createdAt || new Date().toISOString() }); state.bootstrapped = false; if (!(await bootstrap())) throw new Error('AUTH_FAILED'); await loadDashboard(); toast('管理鍵を復元しました。');
  } catch { toast('管理鍵ファイルを確認できませんでした。'); }
}
