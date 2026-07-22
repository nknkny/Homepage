(() => {
  const c = window.SITE_CONFIG || {};
  document.querySelectorAll('[data-config]').forEach((el) => {
    const key = el.dataset.config;
    if (c[key] !== undefined && c[key] !== '') el.textContent = c[key];
  });

  const menuButton = document.querySelector('.menu-button');
  const nav = document.querySelector('.nav');
  if (menuButton && nav) {
    menuButton.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
      nav.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    }));
  }

  const buildMail = (form) => {
    const kind = form.dataset.formKind || 'お問い合わせ';
    const data = new FormData(form);
    const rows = [];
    for (const [k, v] of data.entries()) {
      if (k === 'consent' || k === 'newsletter') continue;
      const label = form.querySelector(`[name="${CSS.escape(k)}"]`)?.dataset.label || k;
      rows.push(`${label}: ${v}`);
    }
    rows.push('利用規約・プライバシーポリシー: 同意済み');
    rows.push(`地域情報・サービス案内メール: ${data.has('newsletter') ? '受信を希望する' : '受信を希望しない'}`);
    const subject = encodeURIComponent(`【空き家レスキュー】${kind}`);
    const body = encodeURIComponent(rows.join('\n'));
    window.location.href = `mailto:${c.inquiryEmail || 'aomori.akiya.rescue@gmail.com'}?subject=${subject}&body=${body}`;
  };

  document.querySelectorAll('form[data-mail-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const consent = form.querySelector('[name="consent"]');
      if (consent && !consent.checked) {
        alert('利用規約とプライバシーポリシーへの同意が必要です。');
        consent.focus();
        return;
      }
      buildMail(form);
    });
  });

  document.querySelectorAll('[data-email-link]').forEach((a) => {
    a.href = `mailto:${c.inquiryEmail || 'aomori.akiya.rescue@gmail.com'}`;
  });

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
