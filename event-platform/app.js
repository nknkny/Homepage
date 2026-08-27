'use strict';

const CONFIG = {
  build: '2026-08-28-ui-v5',
  api: 'https://fpgtwgtoqtokpitzlbie.supabase.co/functions/v1/localspace-api',
  pageSize: 60,
  matchThreshold: 65,
  defaultPrefecture: '青森県',
  defaultMunicipality: '青森市',
};

const TYPES = { space: '使える場所', want: '開催場所を探す企画', event: 'イベント' };
const PREFECTURES = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];

const $ = (id) => document.getElementById(id);
const text = (v) => String(v ?? '').trim();
const norm = (v) => text(v).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen = (v) => Number(v) > 0 ? new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(Number(v)) : '';
const dateLabel = (v) => {
  if (!v) return '';
  const d = new Date(`${v}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? v : new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(d);
};
const key = (x) => `localspace_${x}`;
const memoryStore = new Map();
const read = (x, fallback) => {
  const k = key(x);
  try {
    const v = localStorage.getItem(k);
    if (v != null) { memoryStore.set(k, v); return JSON.parse(v); }
  } catch {}
  try { const v = memoryStore.get(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
};
const write = (x, v) => {
  const k = key(x); const raw = JSON.stringify(v); memoryStore.set(k, raw);
  try { localStorage.setItem(k, raw); return true; } catch { return false; }
};
const removeStored = (x) => { const k = key(x); memoryStore.delete(k); try { localStorage.removeItem(k); } catch {} };

let state = {
  online: false,
  bootstrapped: false,
  publicRows: [],
  publicCount: 0,
  publicOffset: 0,
  publicHasMore: false,
  candidateRows: [],
  calendarRows: [],
  cityStats: { space: 0, want: 0, event: 0 },
  previewObjectUrls: [],
  discoverType: 'space',
  dashboard: { listings: [], notifications: [] },
  selectedFiles: [],
  calendarDatePreset: '',
  postType: 'space',
};

function randomSecret() {
  const a = crypto.getRandomValues(new Uint8Array(32));
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_RE = /^[0-9a-f]{64}$/i;
function identity() {
  let v = read('identity', null);
  if (!v || !UUID_RE.test(v.ownerId || '') || !SECRET_RE.test(v.ownerKey || '')) {
    v = { ownerId: crypto.randomUUID(), ownerKey: randomSecret(), createdAt: new Date().toISOString() };
    write('identity', v);
  }
  return v;
}
function sessionId() {
  let v = read('analytics_session', '');
  if (!/^[0-9a-f-]{36}$/i.test(v)) { v = crypto.randomUUID(); write('analytics_session', v); }
  return v;
}
function authHeaders() {
  const i = identity();
  return { 'x-owner-id': i.ownerId, 'x-owner-key': i.ownerKey };
}
function safeHttps(v) {
  try { const u = new URL(text(v)); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
function toast(message) {
  const e = $('toast');
  if (!e) return;
  e.textContent = message;
  e.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => e.classList.remove('show'), 4200);
}
function setConnection(ok, note = '') {
  state.online = ok;
  $('storageStatus').className = `status ${ok ? 'online' : 'bad'}`;
  $('storageStatus').textContent = ok ? 'API接続' : 'API未接続';
  $('storageNote').textContent = note;
  document.querySelectorAll('[data-write-action]').forEach((b) => { b.disabled = !ok; });
}
async function api(action, options = {}) {
  const headers = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth) Object.assign(headers, authHeaders());
  const qs = options.query ? `&${new URLSearchParams(options.query).toString()}` : '';
  const r = await fetch(`${CONFIG.api}?action=${encodeURIComponent(action)}${qs}`, {
    method: options.method || 'GET', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });
  const d = await r.json().catch(() => ({ ok: false, error: 'INVALID_RESPONSE' }));
  if (!r.ok || d.ok === false) {
    const e = new Error(d.error || `HTTP_${r.status}`); e.status = r.status; e.data = d; throw e;
  }
  return d;
}
function errorMessage(e) {
  const d = e?.data || {};
  if (d.errors?.length) return d.errors.join('\n');
  const map = {
    AUTH_REQUIRED: '管理鍵が必要です。', AUTH_FAILED: '管理鍵が一致しません。',
    RATE_LIMIT: '24時間の新規掲載上限に達しました。', DUPLICATE_ACTIVE_LISTING: '同じ内容の公開中掲載があります。',
    IMAGE_LIMIT: '写真は最大3枚です。', IMAGE_SIZE: '写真サイズが上限を超えています。', BAD_IMAGE_SIGNATURE: '画像ファイルの内容を確認できませんでした。',
    ORIGIN_FORBIDDEN: 'このサイトからの接続は許可されていません。', INTERNAL_ERROR: 'サーバー処理でエラーが発生しました。',
  };
  return map[d.error || e?.message] || d.message || d.error || e?.message || '処理に失敗しました。';
}

async function track(eventName, listing = null, properties = {}) {
  try {
    await api('track', { method: 'POST', body: {
      sessionId: sessionId(), eventName,
      listingId: listing?.id || null, listingType: listing?.type || null,
      prefecture: listing?.prefecture || activePrefecture(), municipality: listing?.municipality || activeMunicipality(),
      area: listing?.areaDetail || '', properties,
    }});
  } catch { /* analytics must never block product use */ }
}

function prefectureOptions() {
  return PREFECTURES.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
}
function initPrefectures() {
  for (const id of ['prefectureFilter', 'calendarPrefecture', 'prefecture']) {
    $(id).innerHTML = prefectureOptions();
    $(id).value = CONFIG.defaultPrefecture;
  }
}
function activePrefecture() { return $('prefectureFilter')?.value || CONFIG.defaultPrefecture; }
function activeMunicipality() { return text($('municipalityFilter')?.value || CONFIG.defaultMunicipality); }

function mapListing(r) {
  return {
    id: r.id, type: r.type, title: r.title, prefecture: r.prefecture || '', municipality: r.municipality || '', areaDetail: r.area_detail || '', area: r.area || '',
    category: r.category || '', description: r.description || '', dateStart: r.date_start || '', dateEnd: r.date_end || '', availableFrom: r.available_from || '', availableTo: r.available_to || '',
    capacity: +(r.capacity || 0), sizeSqm: +(r.size_sqm || 0), priceAmount: +(r.price_amount || 0), budgetMax: +(r.budget_max || 0),
    placeName: r.place_name || '', eventPrice: r.event_price || '', spaceKind: r.space_kind || '', indoorOutdoor: r.indoor_outdoor || '',
    allowedUses: r.allowed_uses || '', prohibitedUses: r.prohibited_uses || '', tags: Array.isArray(r.tags) ? r.tags : [], contactUrl: r.contact_url || '',
    status: r.status || 'published', createdAt: r.created_at || '', updatedAt: r.updated_at || '', autoStatusReason: r.auto_status_reason || '',
    spaceAuthority: !!r.space_authority, spaceInfoOnly: !!r.space_info_only, temporaryUseOnly: !!r.temporary_use_only, eventRightsConfirmed: !!r.event_rights_confirmed,
    promoOptIn: !!r.promo_opt_in, convertedFromId: r.converted_from_id || '', imageUrls: Array.isArray(r.image_urls) ? r.image_urls : [], imagePaths: Array.isArray(r.image_paths) ? r.image_paths : [],
  };
}

async function bootstrap() {
  try { await api('bootstrap', { method: 'POST', auth: true, body: {} }); state.bootstrapped = true; return true; }
  catch (e) { console.error(e); state.bootstrapped = false; return false; }
}
async function healthCheck(showToast = false) {
  try {
    const d = await api('health');
    const safe = d.ok && d.structuredGeography === true && d.serverKeywordSearch === true && d.cityStats === true && d.imageSignatureValidation === true && d.accountDeletion === true && d.commercialPayments === false && d.successFee === false && d.booking === false && d.privateMessaging === false && d.employmentMatching === false && d.realEstateBrokerage === false && d.underlyingPayments === false;
    if (!safe) throw new Error('UNSAFE_HEALTH_STATE');
    setConnection(true, `（${d.build}）`);
    if (showToast) toast(`API正常 / ${d.build}`);
    return true;
  } catch (e) {
    console.error(e); setConnection(false, '（投稿・更新を停止）'); if (showToast) toast('APIに接続できません。'); return false;
  }
}
function boardQuery(offset = 0) {
  return {
    type: state.discoverType || '', prefecture: $('prefectureFilter').value, municipality: text($('municipalityFilter').value),
    category: $('categoryFilter').value, q: text($('q').value), limit: CONFIG.pageSize, offset,
  };
}
