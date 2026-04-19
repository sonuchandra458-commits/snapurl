/* ── SESSION ID ─────────────────────────────────────────────
   Random ID saved in localStorage — no login needed.
   Every browser tab gets its own unique user identity.
──────────────────────────────────────────────────────────── */
const SESSION_ID = (() => {
  let id = localStorage.getItem('snapurl_session');
  if (!id) {
    id = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('snapurl_session', id);
  }
  return id;
})();

/* ── THEME ──────────────────────────────────────────────────
   Reads saved preference, applies on load, toggles on click.
──────────────────────────────────────────────────────────── */
const themeBtn = document.getElementById('themeBtn');
let theme = localStorage.getItem('snapurl_theme') || 'light';

function setTheme(t) {
  theme = t;
  document.documentElement.setAttribute('data-theme', t);
  themeBtn.textContent = t === 'dark' ? '☀️ Light' : '🌙 Dark';
  localStorage.setItem('snapurl_theme', t);
}

setTheme(theme);

themeBtn.addEventListener('click', () => {
  setTheme(theme === 'dark' ? 'light' : 'dark');
});

/* ── DOM REFS ─────────────────────────────────────────────── */
const urlInput     = document.getElementById('urlInput');
const aliasInput   = document.getElementById('aliasInput');
const expirySelect = document.getElementById('expirySelect');
const shortenBtn   = document.getElementById('shortenBtn');
const errBox       = document.getElementById('errBox');
const resultCard   = document.getElementById('resultCard');
const resultLink   = document.getElementById('resultLink');
const origUrl      = document.getElementById('origUrl');
const badgeRow     = document.getElementById('badgeRow');
const copyBtn      = document.getElementById('copyBtn');
const qrToggle     = document.getElementById('qrToggle');
const qrArea       = document.getElementById('qrArea');
const qrBox        = document.getElementById('qrBox');
const qrDownload   = document.getElementById('qrDownload');
const historyList  = document.getElementById('historyList');
const emptyState   = document.getElementById('emptyState');
const linkCount    = document.getElementById('linkCount');
const searchBox    = document.getElementById('searchBox');

let allLinks        = [];
let currentShortUrl = '';

/* ── SHORTEN ─────────────────────────────────────────────────
   POST /api/shorten → get short URL → show result card.
──────────────────────────────────────────────────────────── */
shortenBtn.addEventListener('click', shortenUrl);
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') shortenUrl(); });

async function shortenUrl() {
  const rawUrl = urlInput.value.trim();
  const alias  = aliasInput.value.trim();
  const expiry = expirySelect.value;

  clearError();

  if (!rawUrl) return showError('Please paste a URL first!');
  if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://'))
    return showError('URL must start with http:// or https://');

  shortenBtn.innerHTML = '<span class="spinner"></span> Shortening…';
  shortenBtn.disabled  = true;

  try {
    const res  = await fetch('/api/shorten', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url:       rawUrl,
        sessionId: SESSION_ID,
        alias:     alias,
        expiresIn: expiry
      })
    });

    const data = await res.json();

    if (!res.ok)
      return showError('Error ' + res.status + ': ' + (data.error || 'Unknown error'));

    showResult(data);
    urlInput.value   = '';
    aliasInput.value = '';
    await loadHistory();

  } catch (err) {
    showError('Cannot reach server. Is Node.js running on port 3000?\n' + err.message);
  } finally {
    shortenBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
      </svg> Shorten URL`;
    shortenBtn.disabled = false;
  }
}

/* ── SHOW RESULT ─────────────────────────────────────────── */
function showResult(data) {
  currentShortUrl        = data.shortUrl;
  resultLink.href        = data.shortUrl;
  resultLink.textContent = data.shortUrl;
  origUrl.textContent    = data.originalUrl;

  badgeRow.innerHTML = '';
  if (data.alias)     addBadge('Custom alias', 'b-blue');
  if (data.expiresAt) addBadge('Expires ' + fmtDate(data.expiresAt), 'b-orange');
  else                addBadge('Never expires', 'b-green');

  qrArea.classList.add('hidden');
  qrBox.innerHTML = '';

  resultCard.classList.remove('hidden');
  resultCard.classList.add('slide-up');
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function addBadge(text, cls) {
  const s = document.createElement('span');
  s.className   = 'badge ' + cls;
  s.textContent = text;
  badgeRow.appendChild(s);
}

/* ── COPY BUTTON ─────────────────────────────────────────── */
copyBtn.addEventListener('click', () => {
  if (!currentShortUrl) return;
  navigator.clipboard.writeText(currentShortUrl)
    .then(() => {
      copyBtn.classList.add('btn-copied');
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => {
        copyBtn.classList.remove('btn-copied');
        copyBtn.textContent = '📋 Copy';
      }, 2000);
    })
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = currentShortUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
    });
});

/* ── QR CODE ─────────────────────────────────────────────── */
qrToggle.addEventListener('click', () => {
  if (!qrArea.classList.contains('hidden')) {
    qrArea.classList.add('hidden');
    return;
  }
  qrBox.innerHTML = '';
  new QRCode(qrBox, {
    text:         currentShortUrl,
    width:        160,
    height:       160,
    colorDark:    '#000000',
    colorLight:   '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
  qrArea.classList.remove('hidden');
});

qrDownload.addEventListener('click', () => {
  const canvas = qrBox.querySelector('canvas');
  if (!canvas) return;
  const a    = document.createElement('a');
  a.download = 'snapurl-qr.png';
  a.href     = canvas.toDataURL('image/png');
  a.click();
});

/* ── LOAD HISTORY ────────────────────────────────────────────
   GET /api/history?session=SESSION_ID
──────────────────────────────────────────────────────────── */
async function loadHistory() {
  try {
    const res = await fetch('/api/history?session=' + SESSION_ID);
    if (!res.ok) return;
    allLinks = await res.json();
    renderHistory(allLinks);
  } catch {
    // server not running yet — silent fail on page load
  }
}

/* ── RENDER HISTORY ─────────────────────────────────────── */
function renderHistory(links) {
  linkCount.textContent = links.length;
  historyList.querySelectorAll('.h-item').forEach(el => el.remove());

  if (!links.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  links.forEach(link => {
    const expired = link.expiresAt && new Date() > new Date(link.expiresAt);
    const div = document.createElement('div');
    div.className = 'h-item slide-up';
    div.innerHTML = `
      <div class="h-top">
        <a class="h-short" href="${escHtml(link.shortUrl)}"
           target="_blank" rel="noopener">${escHtml(link.shortUrl)}</a>
        <div class="h-actions">
          <button class="btn btn-sm copy-h-btn"
                  data-url="${escHtml(link.shortUrl)}"
                  title="Copy">📋</button>
          <button class="btn btn-sm btn-red del-btn"
                  data-id="${link._id}"
                  title="Delete">🗑</button>
        </div>
      </div>
      <div class="h-orig" title="${escHtml(link.originalUrl)}">
        ${escHtml(link.originalUrl)}
      </div>
      <div class="h-meta">
        <span>📅 ${fmtDateTime(link.createdAt)}</span>
        <span class="h-clicks">${link.clicks} click${link.clicks !== 1 ? 's' : ''}</span>
        ${expired
          ? '<span class="h-expired">Expired</span>'
          : link.expiresAt
            ? `<span>⏳ Expires ${fmtDate(link.expiresAt)}</span>`
            : ''}
      </div>
    `;
    historyList.appendChild(div);
  });

  // copy buttons inside history
  historyList.querySelectorAll('.copy-h-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.url).catch(() => {});
      const old = btn.textContent;
      btn.textContent = '✅';
      setTimeout(() => { btn.textContent = old; }, 1500);
    });
  });

  // delete buttons
  historyList.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this short link?')) return;
      try {
        await fetch('/api/url/' + btn.dataset.id + '?session=' + SESSION_ID,
          { method: 'DELETE' });
        await loadHistory();
      } catch {
        alert('Could not delete — is the server running?');
      }
    });
  });
}

/* ── SEARCH ─────────────────────────────────────────────── */
searchBox.addEventListener('input', () => {
  const q = searchBox.value.trim().toLowerCase();
  if (!q) { renderHistory(allLinks); return; }
  renderHistory(allLinks.filter(l =>
    l.shortUrl.toLowerCase().includes(q) ||
    l.originalUrl.toLowerCase().includes(q) ||
    (l.alias && l.alias.toLowerCase().includes(q))
  ));
});

/* ── ERROR HELPERS ──────────────────────────────────────── */
function showError(msg) {
  errBox.textContent = '⚠️  ' + msg;
  errBox.classList.remove('hidden');
}
function clearError() {
  errBox.textContent = '';
  errBox.classList.add('hidden');
}

/* ── DATE FORMATTERS ────────────────────────────────────── */
function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}
function fmtDateTime(d) {
  return new Date(d).toLocaleString(undefined, {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });
}

/* ── XSS SAFETY ─────────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── INIT ───────────────────────────────────────────────── */
loadHistory();