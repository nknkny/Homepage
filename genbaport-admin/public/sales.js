(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const KEY = 'genbaport_sales_local_v1';
  const CONTACTED_STATUSES = new Set(['送信済み', '返信あり', '商談']);

  const EXISTING_COMPANIES = [
    { company: '株式会社佐々通オンサイト', domain: 'sasatsu.co.jp' },
    { company: '株式会社エスコ', domain: 'esco.jp' },
    { company: 'ビーモーション株式会社', domain: 'bemotion.co.jp' },
    { company: '株式会社mitoriz', domain: 'service.mitoriz.co.jp' },
    { company: 'インパクトホールディングス株式会社／インパクトフィールド', domain: 'impact-h.co.jp' },
    { company: '株式会社エーエスピー', domain: 'asp-agency.co.jp' },
    { company: 'フィールドマーケティングシステムズ株式会社', domain: 'fmsnet.co.jp' },
    { company: '共同印刷株式会社', domain: 'kyodoprinting.co.jp' },
    { company: '株式会社プロモ', domain: 'promo-inc.jp' },
    { company: 'macs REALIZ株式会社', domain: 'macs-realiz.jp' },
    { company: '株式会社ヒカリパートナーズ', domain: 'genchisatsuei.com' },
    { company: '株式会社ナビット', domain: 'navit-j.com' },
    { company: 'ギグワークス株式会社', domain: 'add.gig.co.jp' },
    { company: '株式会社MS&Consulting', domain: 'msandc.co.jp' },
    { company: '株式会社セレブリックス', domain: 'cerebrix.jp' },
    { company: '株式会社エイジス', domain: 'ajis.jp' }
  ];

  const EXCLUDED_WORK = [
    { label: 'IT保守', patterns: [/it\s*保守/i, /システム保守/] },
    { label: 'PC設定', patterns: [/pc\s*設定/i, /パソコン設定/] },
    { label: 'ネットワーク設定', patterns: [/ネットワーク設定/, /lan\s*設定/i] },
    { label: '配線', patterns: [/配線/] },
    { label: '修理', patterns: [/修理/, /リペア/] },
    { label: '機器交換', patterns: [/機器交換/, /端末交換/] },
    { label: '電気工事', patterns: [/電気工事/] },
    { label: '設備保守', patterns: [/設備保守/, /設備メンテナンス/] },
    { label: '法定点検', patterns: [/法定点検/] },
    { label: '建築診断', patterns: [/建築診断/, /建物診断/] },
    { label: '測量', patterns: [/測量/] },
    { label: '専門測定', patterns: [/専門測定/] },
    { label: '施工', patterns: [/施工/] },
    { label: '危険作業', patterns: [/危険作業/, /高所作業/] }
  ];

  const PROMPTS = {
    lead: `現場ポートの新規営業候補を30社、公開情報だけで調査し、Google Sheet「地方フィールドBPO_Phase0_管理正本」の候補欄へ追加してください。この工程では重複除外・営業文作成・送信をまだ行いません。\n\n必須記録項目：\n1. 正式企業名\n2. 法人番号（公開確認できる場合）\n3. 公式ドメイン\n4. 公開メール（掲載がある場合のみ。推測禁止）\n5. 問い合わせフォームURL\n6. 公式サイト等の根拠URL\n7. 主な事業内容と、地方・遠隔地・多拠点・スポット訪問需要の根拠\n\nメール送信・問い合わせフォーム送信は絶対に行わないでください。`,
    dedupe: `Google Sheet「地方フィールドBPO_Phase0_管理正本」の新規候補を、01_営業先・02_CRM・07_既出企業台帳の全件と照合してください。\n\n照合キーは、①正式企業名の表記ゆれを除いた値、②13桁の法人番号、③公式ドメイン、④公開メール、⑤問い合わせフォームURLです。利用可能なキーをすべて使い、どれか1つでも同一企業を示す場合は新規営業候補から除外してください。除外した企業も既出企業台帳に残し、今後の再候補化を防いでください。\n\n営業文作成・メール送信・問い合わせフォーム送信は行わないでください。`,
    screen: `重複排除済みの営業候補について、公式サイトの事業内容を確認し、対象外業種を除外してください。\n\n企業の中心業務が次のいずれかなら営業対象外です：IT保守、PC設定、ネットワーク設定、配線、修理、機器交換、電気工事、設備保守、法定点検、建築診断、測量、専門測定、施工、危険作業。\n\n単語が掲載されているだけで機械的に断定せず、中心業務かを公式情報で判定してください。対象外企業は理由と根拠URLを記録して除外状態にし、既出企業台帳には残してください。\n\n営業文作成・メール送信・問い合わせフォーム送信は行わないでください。`,
    draft: `重複排除と対象外業種除外を通過した企業だけについて、1社ずつ個別の営業メール下書きを作成してください。\n\n絶対条件：\n1. 宛名は「正式企業名 ご担当者様」とする。\n2. 本文にも正式企業名と「ご担当者様」を必ず入れる。\n3. 各社の公式情報で確認した、その会社固有の提案理由を本文に入れる。\n4. 会社名だけを差し替えた同文面は禁止する。\n5. 担当者名・メール・実績・効果を推測または捏造しない。\n6. 件名、本文、固有の提案理由、根拠URL、作成日時を記録する。\n7. Gmailの送信は絶対に行わず、下書き作成までで停止する。`
  };

  function normalizeText(value) {
    return String(value || '').normalize('NFKC').toLowerCase().trim();
  }

  function normalizeCompany(value) {
    return normalizeText(value)
      .replace(/株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|公益社団法人|公益財団法人|\(株\)|㈱/g, '')
      .replace(/[\s　・･.,，．／/\\\-_―ー]/g, '');
  }

  function normalizeCorporateNumber(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function normalizeEmail(value) {
    return normalizeText(value).replace(/^mailto:/, '');
  }

  function normalizeDomain(value) {
    let input = normalizeText(value);
    if (!input) return '';
    if (input.includes('@') && !input.includes('/')) input = input.split('@').pop();
    try {
      const url = new URL(/^https?:\/\//.test(input) ? input : `https://${input}`);
      return url.hostname.replace(/^www\./, '').replace(/\.$/, '');
    } catch {
      return input.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '').replace(/\.$/, '');
    }
  }

  function cleanHttpUrl(value) {
    const input = String(value || '').trim();
    if (!input) return '';
    try {
      const url = new URL(input);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      url.hash = '';
      return url.toString().replace(/\/$/, '');
    } catch {
      return input;
    }
  }

  function normalizeFormUrl(value) {
    const input = String(value || '').trim();
    if (!input) return '';
    try {
      const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      const path = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
      return `${host}${path}`;
    } catch {
      return normalizeText(input).replace(/[?#].*$/, '').replace(/\/$/, '');
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function loadRows() {
    try {
      const rows = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  function writeRows(rows) {
    localStorage.setItem(KEY, JSON.stringify(rows));
  }

  function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove('show'), 2600);
  }

  function dataFromForm() {
    const form = $('#sales-form');
    const data = Object.fromEntries(new FormData(form).entries());
    data.company = String(data.company || '').trim();
    data.corporateNumber = normalizeCorporateNumber(data.corporateNumber);
    data.domain = normalizeDomain(data.domain);
    data.email = normalizeEmail(data.email);
    data.sourceUrl = cleanHttpUrl(data.sourceUrl);
    data.formUrl = cleanHttpUrl(data.formUrl);
    data.recipient = String(data.recipient || '').trim();
    data.subject = String(data.subject || '').trim();
    data.body = String(data.body || '').trim();
    data.personalization = String(data.personalization || '').trim();
    data.businessSummary = String(data.businessSummary || '').trim();
    data.exclusionReason = String(data.exclusionReason || '').trim();
    data.ledgerChecked = form.elements.ledgerChecked.checked;
    data.humanReviewed = form.elements.humanReviewed.checked;
    data.updatedAt = new Date().toISOString();
    if (!data.domain && data.sourceUrl) data.domain = normalizeDomain(data.sourceUrl);
    return data;
  }

  function identifierValues(record) {
    return {
      company: normalizeCompany(record.company),
      corporateNumber: normalizeCorporateNumber(record.corporateNumber),
      domain: normalizeDomain(record.domain || record.sourceUrl),
      email: normalizeEmail(record.email),
      formUrl: normalizeFormUrl(record.formUrl)
    };
  }

  function domainsMatch(first, second) {
    return Boolean(first && second && (first === second || first.endsWith(`.${second}`) || second.endsWith(`.${first}`)));
  }

  function duplicateMatch(record, rows = loadRows()) {
    const candidate = identifierValues(record);
    const fields = [
      ['company', '正式企業名'],
      ['corporateNumber', '法人番号'],
      ['domain', '公式ドメイン'],
      ['email', '公開メール'],
      ['formUrl', '問い合わせフォームURL']
    ];
    const sources = [
      ...EXISTING_COMPANIES.map((item) => ({ ...item, source: '組込済み既出企業' })),
      ...rows.filter((item) => item.id !== record.id).map((item) => ({ ...item, source: 'この端末' }))
    ];

    for (const source of sources) {
      const existing = identifierValues(source);
      for (const [field, label] of fields) {
        const matches = field === 'domain'
          ? domainsMatch(candidate[field], existing[field])
          : candidate[field] && existing[field] && candidate[field] === existing[field];
        if (matches) {
          return { field, label, company: source.company || '既存企業', source: source.source };
        }
      }
    }
    return null;
  }

  function matchedExcludedWork(record) {
    const haystack = `${record.industry || ''}\n${record.businessSummary || ''}`;
    return EXCLUDED_WORK.filter((item) => item.patterns.some((pattern) => pattern.test(haystack))).map((item) => item.label);
  }

  function industryIssues(record) {
    const issues = [];
    const matched = matchedExcludedWork(record);
    if (!record.businessSummary) issues.push('公開情報で確認した事業内容がありません');
    if (!record.eligibility || record.eligibility === 'pending') issues.push('対象判定が未確認です');
    if (record.eligibility === 'excluded' && !record.exclusionReason) issues.push('対象外とした根拠を記録してください');
    if (record.eligibility === 'eligible' && matched.length && !record.exclusionReason) {
      issues.push(`対象外語句（${matched.join('・')}）があるため、中心業務ではない根拠を記録してください`);
    }
    return { issues, matched };
  }

  function messageFingerprint(record) {
    if (!record.body) return '';
    let body = String(record.body).normalize('NFKC').toLowerCase();
    [record.recipient, record.company, record.email].filter(Boolean).forEach((value) => {
      body = body.split(String(value).normalize('NFKC').toLowerCase()).join('{{variable}}');
    });
    return body.replace(/\s+/g, '').replace(/[。、,.，．]/g, '');
  }

  function duplicateMessageCompany(record, rows = loadRows()) {
    const fingerprint = messageFingerprint(record);
    if (!fingerprint || fingerprint.length < 80) return '';
    const duplicate = rows.find((item) => item.id !== record.id && item.company && messageFingerprint(item) === fingerprint);
    return duplicate ? duplicate.company : '';
  }

  function messageIssues(record, rows = loadRows()) {
    const issues = [];
    if (!record.recipient) issues.push('宛名がありません');
    if (record.company && record.recipient && !record.recipient.includes(record.company)) issues.push('宛名に正式企業名がありません');
    if (record.recipient && !record.recipient.includes('ご担当者様')) issues.push('宛名に「ご担当者様」がありません');
    if (!record.personalization) issues.push('この会社だけに連絡する理由がありません');
    if (!record.subject) issues.push('件名がありません');
    if (!record.body) issues.push('本文がありません');
    if (record.body && record.company && !record.body.includes(record.company)) issues.push('本文に正式企業名がありません');
    if (record.body && !record.body.includes('ご担当者様')) issues.push('本文に「ご担当者様」がありません');
    if (record.body && record.personalization && !record.body.includes(record.personalization)) issues.push('本文に会社固有の提案理由が反映されていません');
    const sameMessageCompany = duplicateMessageCompany(record, rows);
    if (sameMessageCompany) issues.push(`${sameMessageCompany}と会社名差し替えだけの同一文面です`);
    return issues;
  }

  function sendBlockers(record, rows = loadRows()) {
    const blockers = [];
    if (!record.company) blockers.push('正式企業名がありません');
    const duplicate = duplicateMatch(record, rows);
    if (duplicate) blockers.push(`${duplicate.label}が${duplicate.company}と重複しています`);
    if (!record.ledgerChecked) blockers.push('正本の重複照合が未完了です');
    const industry = industryIssues(record);
    blockers.push(...industry.issues);
    if (record.eligibility === 'excluded' || record.status === '除外') blockers.push('営業対象外です');
    if (!record.email) blockers.push('公開メールがありません');
    blockers.push(...messageIssues(record, rows));
    if (!record.humanReviewed) blockers.push('人間による文面確認が未完了です');
    if (CONTACTED_STATUSES.has(record.status)) blockers.push('すでに送信済みまたは商談中です');
    return [...new Set(blockers)];
  }

  function draftPrerequisiteIssues(record, rows = loadRows()) {
    const issues = [];
    const duplicate = duplicateMatch(record, rows);
    if (duplicate) issues.push(`${duplicate.label}が「${duplicate.company}」と重複しています`);
    if (!record.ledgerChecked) issues.push('先に正本の重複照合を完了してください');
    if (record.eligibility !== 'eligible') issues.push('先に対象外業種の確認を終え、営業対象と判定してください');
    issues.push(...industryIssues(record).issues);
    return [...new Set(issues)];
  }

  function stageFor(record, rows = loadRows()) {
    if (record.eligibility === 'excluded' || record.status === '除外') return { label: '対象外', className: 'stop', order: 3 };
    if (CONTACTED_STATUSES.has(record.status)) return { label: record.status, className: 'ready', order: 6 };
    if (!record.ledgerChecked) return { label: '2 重複確認', className: '', order: 2 };
    if (!record.eligibility || record.eligibility === 'pending' || industryIssues(record).issues.length) return { label: '3 業種判定', className: '', order: 3 };
    if (!record.subject || !record.body || !record.personalization) return { label: '4 文面作成', className: '', order: 4 };
    if (messageIssues(record, rows).length || !record.humanReviewed || !record.email) return { label: '5 最終確認', className: '', order: 5 };
    return { label: 'Gmail確認可', className: 'ready', order: 5 };
  }

  function validateRecordBasics(record) {
    const errors = [];
    if (!record.company) errors.push('正式企業名を入力してください');
    if (record.corporateNumber && record.corporateNumber.length !== 13) errors.push('法人番号は13桁で入力してください');
    if (!record.corporateNumber && !record.domain && !record.email && !record.formUrl) {
      errors.push('法人番号・公式ドメイン・公開メール・問い合わせフォームURLのいずれか1つを確認してください');
    }
    if (record.sourceUrl && !/^https?:\/\//i.test(record.sourceUrl)) errors.push('根拠URLは https:// から入力してください');
    if (record.formUrl && !/^https?:\/\//i.test(record.formUrl)) errors.push('問い合わせフォームURLは https:// から入力してください');
    return errors;
  }

  function saveRecord() {
    const record = dataFromForm();
    const rows = loadRows();
    const errors = validateRecordBasics(record);
    const duplicate = duplicateMatch(record, rows);
    if (duplicate) errors.push(`${duplicate.label}が「${duplicate.company}」と重複しています。同一企業への再営業は禁止です`);
    if (record.eligibility !== 'pending' && !record.ledgerChecked) {
      errors.push('対象外業種の判定は、正本の重複照合を完了してから保存してください');
    }
    if (record.recipient || record.subject || record.body || record.personalization || record.humanReviewed) {
      errors.push(...draftPrerequisiteIssues(record, rows).map((item) => `文面作成前の確認：${item}`));
    }
    if (record.eligibility === 'excluded') {
      record.status = '除外';
      record.humanReviewed = false;
    }
    if (CONTACTED_STATUSES.has(record.status)) {
      const contactErrors = sendBlockers({ ...record, status: '送信準備完了' }, rows);
      errors.push(...contactErrors.map((item) => `送信済みにする前の確認：${item}`));
    }
    if (errors.length) {
      alert(`保存を停止しました。\n\n・${[...new Set(errors)].join('\n・')}`);
      renderFormChecks();
      return;
    }

    if (!record.id) record.id = `LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const index = rows.findIndex((item) => item.id === record.id);
    if (index >= 0) rows[index] = record;
    else rows.unshift(record);
    writeRows(rows);
    resetForm();
    render();
    toast(record.status === '除外' ? '対象外企業として保存しました。再候補化を防ぎます。' : '1社を保存しました。次の未完了工程を確認してください。');
  }

  function resetForm() {
    const form = $('#sales-form');
    form.reset();
    form.elements.id.value = '';
    form.elements.status.value = '未接触';
    form.elements.priority.value = 'S';
    form.elements.eligibility.value = 'pending';
    renderFormChecks();
  }

  function editRecord(id) {
    const record = loadRows().find((item) => item.id === id);
    if (!record) return;
    const form = $('#sales-form');
    form.reset();
    Object.entries(record).forEach(([key, value]) => {
      if (!form.elements[key]) return;
      if (form.elements[key].type === 'checkbox') form.elements[key].checked = Boolean(value);
      else form.elements[key].value = value ?? '';
    });
    renderFormChecks();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast(`${record.company}を編集中です`);
  }

  function deleteRecord(id) {
    const record = loadRows().find((item) => item.id === id);
    if (!record) return;
    if (!confirm(`「${record.company}」をこの端末から削除しますか？\n正本Google Sheetは削除されません。`)) return;
    writeRows(loadRows().filter((item) => item.id !== id));
    render();
    toast('この端末の登録を削除しました');
  }

  function openGmail(id) {
    const rows = loadRows();
    const record = rows.find((item) => item.id === id);
    if (!record) return;
    const blockers = sendBlockers(record, rows);
    if (blockers.length) {
      alert(`Gmailを開けません。\n\n・${blockers.join('\n・')}`);
      return;
    }
    const url = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(record.email) + '&su=' + encodeURIComponent(record.subject) + '&body=' + encodeURIComponent(record.body);
    window.open(url, '_blank', 'noopener');
    toast('Gmail作成画面を開きました。内容を再確認し、人間が送信してください。');
  }

  function setRecipient() {
    const form = $('#sales-form');
    const company = form.elements.company.value.trim();
    if (!company) {
      alert('先に正式企業名を入力してください。');
      form.elements.company.focus();
      return;
    }
    const prerequisiteIssues = draftPrerequisiteIssues(dataFromForm());
    if (prerequisiteIssues.length) {
      alert(`宛名作成へ進めません。\n\n・${prerequisiteIssues.join('\n・')}`);
      return;
    }
    form.elements.recipient.value = `${company} ご担当者様`;
    form.elements.humanReviewed.checked = false;
    renderFormChecks();
  }

  function buildDraft() {
    const form = $('#sales-form');
    const company = form.elements.company.value.trim();
    const personalization = form.elements.personalization.value.trim();
    const prerequisiteIssues = draftPrerequisiteIssues(dataFromForm());
    if (prerequisiteIssues.length) {
      alert(`文面作成へ進めません。\n\n・${prerequisiteIssues.join('\n・')}`);
      return;
    }
    if (!company || !personalization) {
      alert('正式企業名と「この会社だけに連絡する理由」を先に入力してください。');
      return;
    }
    if ((form.elements.subject.value.trim() || form.elements.body.value.trim()) && !confirm('現在の件名・本文を会社別ひな型で上書きしますか？')) return;
    const recipient = `${company} ご担当者様`;
    form.elements.recipient.value = recipient;
    form.elements.subject.value = '青森市の現地確認業務について（現場ポート）';
    form.elements.body.value = `${recipient}\n\n突然のご連絡失礼いたします。\n青森市で、企業様に代わって写真撮影・目視確認・数量確認・チェックリスト記録を行う「現場ポート」です。\n\n貴社の公開情報を拝見し、${personalization}\n\n青森市内で「現地へ行かなければ確認できないが、専門資格や工事を必要としない業務」がございましたら、指定手順に沿って現地確認し、写真と事実記録を納品できます。\n\n対応範囲は、広告・POP掲出確認、店舗・物件の外観確認、指定対象の有無・数量確認などです。IT保守、設定、配線、修理、工事、専門診断、法定点検、測量、危険作業はお受けしておりません。\n\n青森市でのスポット確認が発生した際に、候補の一つとしてご検討いただけましたら幸いです。\n\n現場ポート\ngenbaport@gmail.com`;
    form.elements.humanReviewed.checked = false;
    renderFormChecks();
    toast('会社別ひな型を作成しました。事実と表現を人間が確認してください。');
  }

  function renderFormChecks() {
    const record = dataFromForm();
    const rows = loadRows();
    const duplicatePanel = $('#duplicate-check');
    const duplicate = duplicateMatch(record, rows);
    const identifiers = identifierValues(record);
    const used = [
      ['正式企業名', identifiers.company],
      ['法人番号', identifiers.corporateNumber],
      ['公式ドメイン', identifiers.domain],
      ['公開メール', identifiers.email],
      ['フォームURL', identifiers.formUrl]
    ].filter((item) => item[1]).map((item) => item[0]);

    if (!record.company) {
      setCheckPanel(duplicatePanel, '', '重複チェック待ち', '企業名を入力すると、この端末と組込済み既出企業を照合します。');
    } else if (duplicate) {
      setCheckPanel(duplicatePanel, 'danger', '重複のため登録・営業禁止', `${duplicate.label}が「${duplicate.company}」（${duplicate.source}）と一致しています。`);
    } else if (record.ledgerChecked) {
      setCheckPanel(duplicatePanel, 'ok', '重複確認完了', `${used.join('・')}でこの端末を照合し、正本の照合完了も確認済みです。`);
    } else {
      setCheckPanel(duplicatePanel, '', 'この端末内では重複なし', `${used.join('・') || '正式企業名'}で照合しました。次に正本3シートを確認し、チェックを入れてください。`);
    }

    const industryPanel = $('#industry-check');
    const industry = industryIssues(record);
    if (record.eligibility === 'excluded') {
      setCheckPanel(industryPanel, 'danger', '営業対象外', industry.issues.length ? industry.issues.join(' / ') : '対象外企業として保存し、今後の再候補化を防ぎます。');
    } else if (record.eligibility === 'eligible' && !industry.issues.length) {
      const detail = industry.matched.length ? `対象外語句（${industry.matched.join('・')}）を確認済み。記録した根拠により中心業務ではないと判定しています。` : '対象外業務が企業の中心ではないと確認済みです。';
      setCheckPanel(industryPanel, 'ok', '営業対象', detail);
    } else {
      const detail = industry.issues.length ? industry.issues.join(' / ') : '事業内容を入力し、対象判定を選択してください。';
      setCheckPanel(industryPanel, industry.matched.length ? 'danger' : '', '業種確認が未完了', detail);
    }

    const messagePanel = $('#message-check');
    const issues = messageIssues(record, rows);
    if (!record.recipient && !record.subject && !record.body) {
      setCheckPanel(messagePanel, '', '文面チェック待ち', '会社固有の提案理由を入力し、会社別の文面を作ってください。');
    } else if (issues.length) {
      setCheckPanel(messagePanel, 'danger', 'この文面はGmailへ進めません', issues.join(' / '));
    } else if (!record.humanReviewed) {
      setCheckPanel(messagePanel, '', '文面の内容は揃っています', '人間が宛先・件名・本文・公開事実を確認し、確認欄にチェックしてください。');
    } else {
      setCheckPanel(messagePanel, 'ok', '個別文面の人間確認完了', '保存後、ほかのゲートも通過していればGmailの作成画面を開けます。');
    }
  }

  function setCheckPanel(element, state, title, detail) {
    element.className = `check-panel${state ? ` ${state}` : ''}`;
    element.innerHTML = `<strong>${escapeHtml(title)}</strong>${escapeHtml(detail)}`;
  }

  function safeLink(url, label) {
    if (!/^https?:\/\//i.test(String(url || ''))) return '—';
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
  }

  function render() {
    const rows = loadRows();
    $('#kpi-total').textContent = rows.length;
    $('#kpi-dedupe').textContent = rows.filter((item) => !item.ledgerChecked && item.status !== '除外').length;
    $('#kpi-screen').textContent = rows.filter((item) => item.ledgerChecked && (!item.eligibility || item.eligibility === 'pending')).length;
    $('#kpi-draft').textContent = rows.filter((item) => item.eligibility === 'eligible' && !CONTACTED_STATUSES.has(item.status) && stageFor(item, rows).order >= 4 && stageFor(item, rows).label !== 'Gmail確認可').length;
    $('#kpi-contacted').textContent = rows.filter((item) => CONTACTED_STATUSES.has(item.status)).length;

    const body = $('#sales-rows');
    body.innerHTML = rows.length ? rows.map((record) => {
      const stage = stageFor(record, rows);
      const blockers = sendBlockers(record, rows);
      const gmailReady = blockers.length === 0;
      const rowClass = record.eligibility === 'excluded' || record.status === '除外' ? 'row-excluded' : CONTACTED_STATUSES.has(record.status) ? 'row-sent' : '';
      const eligibility = record.eligibility === 'eligible' ? '対象' : record.eligibility === 'excluded' ? '対象外' : '未確認';
      const identity = [record.corporateNumber ? `法人番号 ${record.corporateNumber}` : '', record.domain || ''].filter(Boolean).map(escapeHtml).join('<br>') || '識別情報なし';
      const sourceLinks = [safeLink(record.sourceUrl, '根拠'), safeLink(record.formUrl, 'フォーム')].filter((item) => item !== '—').join(' / ') || '—';
      return `<tr class="${rowClass}">
        <td><span class="stage-pill ${stage.className}">${escapeHtml(stage.label)}</span></td>
        <td><b>${escapeHtml(record.company)}</b><div class="tiny">${identity}</div></td>
        <td>${record.ledgerChecked ? '<span class="stage-pill ready">正本照合済み</span>' : '<span class="stage-pill">正本照合待ち</span>'}</td>
        <td><b>${escapeHtml(eligibility)}</b><div class="tiny">${escapeHtml(record.industry || '業種未入力')}</div></td>
        <td>${escapeHtml(record.recipient || '宛名未作成')}<div class="tiny">${escapeHtml(record.email || '公開メールなし')}</div></td>
        <td><span class="status-pill">${escapeHtml(record.status || '未接触')}</span></td>
        <td>${sourceLinks}</td>
        <td><div class="row-actions"><button class="mini" data-edit="${escapeHtml(record.id)}" type="button">編集</button>${gmailReady ? `<button class="mini" data-gmail="${escapeHtml(record.id)}" type="button">Gmailで最終確認</button>` : '<button class="mini" type="button" disabled>Gmail準備未完了</button>'}<button class="mini" data-delete="${escapeHtml(record.id)}" type="button">削除</button></div>${gmailReady ? '<span class="tiny">自動送信はしません</span>' : `<span class="block-reason">${escapeHtml(blockers[0] || '確認が必要です')}</span>`}</td>
      </tr>`;
    }).join('') : '<tr><td class="empty-state" colspan="8"><b>まだ企業が登録されていません。</b><br>左の「候補企業と識別情報」から1社を登録すると、次に行う作業がここに表示されます。</td></tr>';

    $$('[data-edit]').forEach((button) => { button.onclick = () => editRecord(button.dataset.edit); });
    $$('[data-delete]').forEach((button) => { button.onclick = () => deleteRecord(button.dataset.delete); });
    $$('[data-gmail]').forEach((button) => { button.onclick = () => openGmail(button.dataset.gmail); });
    renderWorkflow(rows);
    renderFormChecks();
  }

  function renderWorkflow(rows) {
    const active = rows.filter((item) => item.eligibility !== 'excluded' && item.status !== '除外');
    const step2Done = rows.length > 0 && rows.every((item) => item.ledgerChecked);
    const step3Done = step2Done && rows.every((item) => item.eligibility && item.eligibility !== 'pending');
    const step4Done = step3Done && active.every((item) => CONTACTED_STATUSES.has(item.status) || (messageIssues(item, rows).length === 0 && item.humanReviewed));
    const ready = active.filter((item) => sendBlockers(item, rows).length === 0);
    const allContacted = active.length > 0 && active.every((item) => CONTACTED_STATUSES.has(item.status));
    const states = [
      { done: rows.length > 0, current: rows.length === 0, label: rows.length ? `${rows.length}社登録` : '候補を登録' },
      { done: step2Done, current: rows.length > 0 && !step2Done, label: step2Done ? '照合完了' : '照合前' },
      { done: step3Done, current: step2Done && !step3Done, label: step3Done ? '判定完了' : '判定前' },
      { done: step4Done, current: step3Done && !step4Done, label: step4Done ? '文面確認済み' : '未作成' },
      { done: allContacted, current: ready.length > 0, label: allContacted ? '対応済み' : ready.length ? `${ready.length}社確認可` : '自動送信なし' }
    ];
    states.forEach((state, index) => {
      const element = $(`#flow-${index + 1}`);
      element.classList.toggle('done', state.done);
      element.classList.toggle('current', state.current);
      element.classList.toggle('blocked', index === 2 && rows.some((item) => item.eligibility === 'excluded'));
      $('em', element).textContent = state.label;
    });

    const next = rows
      .filter((item) => item.eligibility !== 'excluded' && item.status !== '除外' && !CONTACTED_STATUSES.has(item.status))
      .map((item) => ({ record: item, stage: stageFor(item, rows) }))
      .sort((a, b) => a.stage.order - b.stage.order)[0];
    if (!rows.length) {
      setNextAction('まず候補企業を1社登録してください', '正式企業名と、公開情報で確認できた識別情報を入力します。');
    } else if (next) {
      const details = {
        2: '正本3シートを5種類の識別情報で照合し、完了チェックを入れてください。',
        3: '公式事業内容を確認し、対象か対象外かを記録してください。',
        4: '会社固有の提案理由を入力し、正式企業名入りの個別文面を作ってください。',
        5: next.stage.label === 'Gmail確認可' ? 'Gmailで宛先・件名・本文を再確認し、人間が送信してください。' : '文面の不足を直し、人間確認のチェックを入れてください。'
      };
      setNextAction(`${next.record.company}：${next.stage.label}`, details[next.stage.order] || '企業情報を確認してください。');
    } else if (rows.some((item) => item.eligibility === 'excluded' || item.status === '除外')) {
      setNextAction('対象外企業は送信せず台帳に保持します', '新しい候補を追加するか、送信済み企業の返信・次回アクションを更新してください。');
    } else {
      setNextAction('未完了の営業作業はありません', '送信済み企業の返信状況と次回アクション日を更新してください。');
    }
  }

  function setNextAction(title, detail) {
    $('#next-action-title').textContent = title;
    $('#next-action-detail').textContent = detail;
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function exportCsv() {
    const columns = ['id', 'company', 'corporateNumber', 'domain', 'email', 'formUrl', 'sourceUrl', 'priority', 'status', 'lastContact', 'nextDate', 'ledgerChecked', 'industry', 'eligibility', 'businessSummary', 'exclusionReason', 'facts', 'personalization', 'recipient', 'subject', 'body', 'humanReviewed', 'notes', 'updatedAt'];
    const rows = loadRows();
    const csv = '\ufeff' + [columns, ...rows.map((record) => columns.map((column) => record[column] ?? ''))]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `genbaport-sales-local-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function copyPrompt(type) {
    const text = PROMPTS[type];
    $('#prompt-preview').value = text;
    if (!navigator.clipboard) {
      $('#prompt-preview').focus();
      $('#prompt-preview').select();
      toast('指示文を選択しました');
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => toast('指示文をコピーしました'))
      .catch(() => {
        $('#prompt-preview').focus();
        $('#prompt-preview').select();
        toast('指示文を選択しました');
      });
  }

  function init() {
    const form = $('#sales-form');
    $('#save-company').onclick = saveRecord;
    $('#reset-company').onclick = resetForm;
    $('#export-sales').onclick = exportCsv;
    $('#set-recipient').onclick = setRecipient;
    $('#build-draft').onclick = buildDraft;
    $$('.copy-prompt').forEach((button) => { button.onclick = () => copyPrompt(button.dataset.prompt); });

    ['company', 'corporateNumber', 'domain', 'email', 'formUrl', 'sourceUrl'].forEach((name) => {
      form.elements[name].addEventListener('input', () => {
        form.elements.ledgerChecked.checked = false;
        form.elements.humanReviewed.checked = false;
        renderFormChecks();
      });
    });
    ['recipient', 'subject', 'body', 'personalization', 'facts'].forEach((name) => {
      form.elements[name].addEventListener('input', () => {
        form.elements.humanReviewed.checked = false;
        renderFormChecks();
      });
    });
    ['industry', 'businessSummary', 'exclusionReason'].forEach((name) => {
      form.elements[name].addEventListener('input', () => {
        form.elements.humanReviewed.checked = false;
        renderFormChecks();
      });
    });
    form.elements.eligibility.addEventListener('change', () => {
      if (form.elements.eligibility.value === 'excluded') form.elements.status.value = '除外';
      else if (form.elements.status.value === '除外') form.elements.status.value = '未接触';
      form.elements.humanReviewed.checked = false;
      renderFormChecks();
    });
    form.elements.ledgerChecked.addEventListener('change', renderFormChecks);
    form.elements.humanReviewed.addEventListener('change', renderFormChecks);

    $('#prompt-preview').value = PROMPTS.lead;
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
