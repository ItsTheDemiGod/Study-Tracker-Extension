'use strict';

// ── Overlay styles (isolated in Shadow DOM to avoid page-style conflicts) ─────
const OVERLAY_CSS = `
  #st-overlay {
    position: fixed;
    inset: 0;
    background: rgba(8, 8, 18, 0.92);
    backdrop-filter: blur(10px) saturate(0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: st-bg-in 0.2s ease;
  }
  @keyframes st-bg-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .st-card {
    background: #1a1a2e;
    border: 1px solid #2d2d50;
    border-radius: 22px;
    padding: 38px 42px;
    max-width: 400px;
    width: calc(100vw - 48px);
    text-align: center;
    box-shadow: 0 28px 72px rgba(0,0,0,0.65);
    animation: st-card-in 0.3s cubic-bezier(0.34,1.56,0.64,1);
  }
  @keyframes st-card-in {
    from { transform: scale(0.83) translateY(20px); opacity: 0; }
    to   { transform: scale(1)    translateY(0);    opacity: 1; }
  }
  .st-icon  { font-size: 54px; margin-bottom: 14px; display: block; line-height: 1; }
  .st-title { font-size: 20px; font-weight: 700; color: #e2e8f0; margin: 0 0 8px; }
  .st-site  { font-size: 14px; font-weight: 600; color: #6366f1; margin: 0 0 14px; }
  .st-sub   { font-size: 14px; color: #94a3b8; margin: 0 0 26px; line-height: 1.6; }
  #st-countdown { font-weight: 800; color: #f59e0b; font-size: 16px; }
  .st-quote {
    font-size: 13px; color: #4a5568; font-style: italic;
    margin: 0 0 28px; line-height: 1.75;
    border-left: 3px solid #2d2d50; padding-left: 14px; text-align: left;
  }
  .st-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
  .st-btn {
    padding: 10px 22px; border-radius: 9px; font-size: 13px;
    font-weight: 600; cursor: pointer; border: 1px solid;
    transition: background 0.15s, color 0.15s; font-family: inherit;
  }
  .st-btn-back { background: #252540; color: #94a3b8; border-color: #2d2d50; }
  .st-btn-back:hover { background: #2d2d50; color: #e2e8f0; }
  .st-fade-out { animation: st-fade 0.38s ease forwards; }
  @keyframes st-fade {
    to { opacity: 0; transform: scale(0.95); }
  }
`;

const QUOTES = [
  "The secret of getting ahead is getting started.",
  "Focus is the art of knowing what to ignore.",
  "Small progress is still progress. Keep going.",
  "Your future self is watching. Make them proud.",
  "One focused hour beats three distracted ones.",
];

// ── State ─────────────────────────────────────────────────────────────────────
let overlayActive  = false;
let countdownTimer = null;
let hostEl         = null;
let shadowRoot     = null;

// ── DOM helpers ───────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function createOverlay(inner) {
  removeExistingOverlay();
  hostEl = document.createElement('div');
  hostEl.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:auto;';
  shadowRoot = hostEl.attachShadow({ mode: 'open' });
  shadowRoot.innerHTML =
    `<style>${OVERLAY_CSS}</style>` +
    `<div id="st-overlay"><div class="st-card">${inner}</div></div>`;
  document.body.appendChild(hostEl);
}

function removeExistingOverlay() {
  clearInterval(countdownTimer);
  countdownTimer = null;
  if (hostEl) { hostEl.remove(); hostEl = null; shadowRoot = null; }
  overlayActive = false;
}

function fadeOutAndRemove() {
  if (!shadowRoot) { removeExistingOverlay(); return; }
  const ov = shadowRoot.getElementById('st-overlay');
  if (ov) ov.classList.add('st-fade-out');
  setTimeout(removeExistingOverlay, 420);
}

// ── Gentle overlay — 10-second countdown, then auto-dismiss ──────────────────
function showGentleOverlay(hostname) {
  overlayActive = true;
  createOverlay(`
    <span class="st-icon">⚠️</span>
    <h2 class="st-title">You're supposed to be studying!</h2>
    <p class="st-site">${escHtml(hostname)}</p>
    <p class="st-sub">Continuing in <span id="st-countdown">10</span> seconds…</p>
    <div class="st-actions">
      <button class="st-btn st-btn-back" id="st-back">← Go Back Now</button>
    </div>
  `);

  shadowRoot.getElementById('st-back').addEventListener('click', () => history.back());

  let n = 10;
  countdownTimer = setInterval(() => {
    n--;
    const el = shadowRoot?.getElementById('st-countdown');
    if (el) el.textContent = n;
    if (n <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      fadeOutAndRemove();
    }
  }, 1000);
}

// ── Strict block — redirect to blocked.html (no bypass) ──────────────────────
function doStrictBlock(hostname) {
  location.replace(
    chrome.runtime.getURL('blocked/blocked.html') +
    '?hostname=' + encodeURIComponent(hostname)
  );
}

// ── Query background for block decision ───────────────────────────────────────
async function checkBlock() {
  if (overlayActive) return;
  if (!location.href.startsWith('http')) return;

  let res;
  try {
    res = await new Promise((resolve, reject) => {
      const tid = setTimeout(() => reject(new Error('timeout')), 3000);
      chrome.runtime.sendMessage({ type: 'CONTENT_CHECK', url: location.href }, r => {
        clearTimeout(tid);
        if (chrome.runtime.lastError) { reject(chrome.runtime.lastError); return; }
        resolve(r || { action: 'none' });
      });
    });
  } catch {
    return;
  }

  if (!res || res.action === 'none') return;
  if (res.action === 'gentle') showGentleOverlay(res.hostname);
  else if (res.action === 'strict') doStrictBlock(res.hostname);
}

// ── Listen for focus mode changes pushed from background ─────────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'FOCUS_UPDATE') return;
  if (message.focusMode) {
    checkBlock();
  } else {
    removeExistingOverlay();
  }
});

// ── Run on every page load ────────────────────────────────────────────────────
checkBlock();
