function bindDynamic(root = document) {
  root.querySelectorAll('[data-detail]').forEach((b) => { b.onclick = () => detail(b.dataset.detail); });
  root.querySelectorAll('[data-fav]').forEach((b) => { b.onclick = () => toggleFavorite(b.dataset.fav); });
  root.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => editListing(b.dataset.edit); });
  root.querySelectorAll('[data-delete]').forEach((b) => { b.onclick = () => deleteListing(b.dataset.delete); });
  root.querySelectorAll('[data-renew]').forEach((b) => { b.onclick = () => renewListing(b.dataset.renew); });
  root.querySelectorAll('[data-convert]').forEach((b) => { b.onclick = () => convertToEvent(b.dataset.convert); });
  root.querySelectorAll('[data-report]').forEach((b) => { b.onclick = () => reportListing(b.dataset.report); });
  root.querySelectorAll('[data-delete-image]').forEach((b) => { b.onclick = () => deleteImage(b.dataset.listing, b.dataset.deleteImage); });
}

function setPostType(type) {
  state.postType = type; $('postType').value = type;
  document.querySelectorAll('[data-post-type]').forEach((b) => b.classList.toggle('active', b.dataset.postType === type));
  for (const t of ['space','want','event']) document.querySelectorAll(`.${t}-only`).forEach((e) => { e.hidden = t !== type; });
  $('postExplainer').innerHTML = type === 'space'
    ? '<strong>場所を貸したい</strong><p>所有者・管理者等、掲載権限を持つ人が催し等の一時利用情報を公開します。予約・条件交渉・契約・支払いはサイト外で直接行います。</p>'
    : type === 'want'
      ? '<strong>イベントを開きたい</strong><p>ポップアップ、物販、ライブ等の一時利用企画を公開し、公開条件の近い開催場所を探します。</p>'
      : '<strong>イベントを告知</strong><p>開催が決まった地域の小さな催しを無料カレンダーへ掲載します。</p>';
}
function resetForm(preserveRegion = true) {
  const pref = preserveRegion ? $('prefecture').value : CONFIG.defaultPrefecture;
  const muni = preserveRegion ? $('municipality').value : CONFIG.defaultMunicipality;
  $('postForm').reset(); $('editId').value = ''; $('convertedFromId').value = ''; $('prefecture').value = pref || CONFIG.defaultPrefecture; $('municipality').value = muni || CONFIG.defaultMunicipality;
  for (const u of state.previewObjectUrls) URL.revokeObjectURL(u); state.previewObjectUrls = [];
  state.selectedFiles = []; $('imagePreview').innerHTML = ''; $('existingImages').innerHTML = ''; $('descriptionCount').textContent = '0'; $('validationBox').innerHTML = '';
  setPostType('space');
}
function formBody() {
  const tags = text($('tags').value).split(/[,、\n]/).map((x) => norm(x)).filter(Boolean).slice(0,20);
  return {
    id: text($('editId').value) || undefined, convertedFromId: text($('convertedFromId').value) || undefined, type: state.postType,
    title: text($('title').value), prefecture: $('prefecture').value, municipality: text($('municipality').value), areaDetail: text($('areaDetail').value), category: $('category').value,
    description: text($('description').value), dateStart: $('dateStart').value, dateEnd: $('dateEnd').value, availableFrom: $('availableFrom').value, availableTo: $('availableTo').value,
    capacity: Number($('capacity').value || 0), sizeSqm: Number($('sizeSqm').value || 0), priceAmount: Number($('priceAmount').value || 0), budgetMax: Number($('budgetMax').value || 0),
    placeName: text($('placeName').value), eventPrice: text($('eventPrice').value), spaceKind: $('spaceKind').value, indoorOutdoor: $('indoorOutdoor').value,
    allowedUses: text($('allowedUses').value), prohibitedUses: text($('prohibitedUses').value), tags, contactUrl: text($('contactUrl').value),
    spaceAuthority: $('spaceAuthority').checked, spaceInfoOnly: $('spaceInfoOnly').checked, temporaryUseOnly: $('temporaryUseOnly').checked,
    eventRightsConfirmed: $('eventRightsConfirmed').checked, promoOptIn: $('promoOptIn').checked, termsAccepted: $('terms').checked,
  };
}
function clientValidate(body) {
  const errors = [];
  if (body.title.length < 4) errors.push('タイトルは4文字以上必要です。');
  if (!PREFECTURES.includes(body.prefecture)) errors.push('都道府県を選択してください。');
  if (!body.municipality) errors.push('市区町村を入力してください。');
  if (!body.category) errors.push('用途・カテゴリを選択してください。');
  if (body.description.length < 20) errors.push('説明は20文字以上必要です。');
  if (!safeHttps(body.contactUrl)) errors.push('公開用問い合わせURLはHTTPSで入力してください。');
  if (!body.termsAccepted) errors.push('利用規約等への同意が必要です。');
  if (body.type === 'space' && !body.spaceAuthority) errors.push('掲載権限の確認が必要です。');
  if (body.type === 'space' && !body.spaceInfoOnly) errors.push('情報掲載型の確認が必要です。');
  if (body.type === 'space' && !body.spaceKind) errors.push('場所の種類を選択してください。');
  if (body.type === 'want' && !body.temporaryUseOnly) errors.push('一時利用の確認が必要です。');
  if (body.type !== 'space' && (!body.dateStart || !body.dateEnd)) errors.push('日付を入力してください。');
  if (body.type !== 'space' && body.dateStart && body.dateEnd && body.dateEnd < body.dateStart) errors.push('終了日は開始日以降にしてください。');
  if (body.type === 'space' && body.availableFrom && body.availableTo && body.availableTo < body.availableFrom) errors.push('利用可能期間の終了日は開始日以降にしてください。');
  if ([body.capacity, body.sizeSqm, body.priceAmount, body.budgetMax].some((v) => !Number.isFinite(v) || v < 0)) errors.push('人数・広さ・料金・予算は0以上の数値で入力してください。');
  if (body.capacity > 0 && !Number.isInteger(body.capacity)) errors.push('人数は整数で入力してください。');
  if (body.type === 'event' && !body.eventRightsConfirmed) errors.push('告知権限の確認が必要です。');
  if (body.type === 'event' && !body.placeName) errors.push('開催場所名を入力してください。');
  if (state.selectedFiles.length && !$('imageRightsConfirmed').checked) errors.push('写真の権利確認が必要です。');
  return errors;
}
function showErrors(errors) { $('validationBox').innerHTML = errors.length ? `<div class="error-box">${errors.map((x) => `<div>${esc(x)}</div>`).join('')}</div>` : ''; }

async function imageToWebp(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('対応画像はJPEG/PNG/WebPです。');
  if (file.size > 12_000_000) throw new Error('元画像は12MB以下にしてください。');
  const bitmap = await createImageBitmap(file);
  const maxDim = 1600; const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale)); const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) { bitmap.close?.(); throw new Error('画像処理を開始できませんでした。'); }
  ctx.drawImage(bitmap, 0, 0, w, h); bitmap.close?.();
  let quality = 0.84; let blob;
  while (quality >= 0.5) {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (blob && blob.size <= 1_350_000) break;
    quality -= 0.08;
  }
  if (!blob || blob.size > 1_500_000) throw new Error('画像を1.5MB以下に圧縮できませんでした。');
  return blob;
}
function blobToBase64(blob) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.onerror = reject; r.readAsDataURL(blob); });
}
function previewSelectedFiles() {
  for (const u of state.previewObjectUrls) URL.revokeObjectURL(u);
  state.previewObjectUrls = state.selectedFiles.map((f) => URL.createObjectURL(f));
  $('imagePreview').innerHTML = state.selectedFiles.map((f, i) => `<div class="image-tile"><img src="${esc(state.previewObjectUrls[i])}" alt="選択画像${i+1}"><span>${esc(f.name || `画像${i+1}`)}</span></div>`).join('');
}
async function uploadSelectedImages(listing) {
  for (const file of state.selectedFiles) {
    const blob = await imageToWebp(file); const base64 = await blobToBase64(blob);
    await api('upload_image', { method: 'POST', auth: true, body: { listingId: listing.id, mime: 'image/webp', base64, rightsConfirmed: true } });
  }
}

async function ensureReady() {
  if (!state.online && !(await healthCheck())) return false;
  if (!state.bootstrapped && !(await bootstrap())) { toast('管理鍵の初期化に失敗しました。'); return false; }
  return true;
}
async function submitForm(e) {
  e.preventDefault(); const body = formBody(); const errors = clientValidate(body); showErrors(errors); if (errors.length) return;
  if (!(await ensureReady())) return;
  const btn = $('submitBtn'); btn.disabled = true; btn.textContent = '掲載処理中…';
  try {
    const d = await api('save_listing', { method: 'POST', auth: true, body });
    if (state.selectedFiles.length) await uploadSelectedImages(d.listing);
    await track('post_success', mapListing(d.listing), { source: body.id ? 'edit' : 'new' });
    if (body.convertedFromId && body.type === 'event') await track('want_to_event', mapListing(d.listing), { source: 'dashboard' });
    toast(d.status === 'review_required' ? '掲載を確認待ちとして保存しました。' : '掲載しました。');
    resetForm(); await Promise.all([loadBoard(true), loadDashboard(), loadCalendar()]); route('dashboard');
  } catch (e2) { showErrors(errorMessage(e2).split('\n')); }
  finally { btn.disabled = !state.online; btn.textContent = '自動審査して掲載'; }
}
