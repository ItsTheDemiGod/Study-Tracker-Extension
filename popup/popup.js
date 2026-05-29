'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────

const STUDY_CATS    = new Set(['Study', 'Video Learning', 'Coding', 'Research']);
const DISTRACT_CATS = new Set(['Distraction', 'Entertainment']);

const CAT_COLORS = {
  'Study':          '#22c55e',
  'Coding':         '#3b82f6',
  'Video Learning': '#f59e0b',
  'Research':       '#a855f7',
  'Communication':  '#06b6d4',
  'Distraction':    '#ef4444',
  'Entertainment':  '#ec4899',
  'Uncategorized':  '#64748b',
};

const HEAT_DARK  = ['#1e293b', '#14532d', '#166534', '#15803d', '#16a34a'];
const HEAT_LIGHT = ['#f1f5f9', '#bbf7d0', '#86efac', '#4ade80', '#22c55e'];

// SVG ring circumference for r = 42 in a 100×100 viewBox
const RING_C = 2 * Math.PI * 42; // ≈ 263.9

const SUBJECT_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899', '#a855f7', '#ef4444', '#14b8a6'];

const ACCENT_MAP = {
  indigo:  { dark: '#6366f1', light: '#4f46e5', h: '#4338ca' },
  teal:    { dark: '#14b8a6', light: '#0d9488', h: '#0f766e' },
  rose:    { dark: '#f43f5e', light: '#e11d48', h: '#be123c' },
  amber:   { dark: '#f59e0b', light: '#d97706', h: '#b45309' },
  emerald: { dark: '#10b981', light: '#059669', h: '#047857' },
};

function applyAccentColor(name, dark) {
  const c = ACCENT_MAP[name] || ACCENT_MAP.indigo;
  const app = document.getElementById('app');
  app.style.setProperty('--accent',   dark ? c.dark  : c.light);
  app.style.setProperty('--accent-h', c.h);
}

// ── State ─────────────────────────────────────────────────────────────────────

let liveStartTime    = null;
let isDark           = true;
let pieChart         = null;
let barChart         = null;
let currentPomoState = null;
let currentAiType    = 'weekly';
let aiCache          = {}; // { type: { text, ts } }

// ── Utilities ─────────────────────────────────────────────────────────────────

function todayKey() { return new Date().toISOString().slice(0, 10); }

function fmtTimer(secs) {
  const m = Math.floor(secs / 60);
  return `${m}:${String(secs % 60).padStart(2, '0')}`;
}

function fmtTimer2(secs) {
  // MM:SS with zero-padded minutes — for Pomodoro ring display
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtDur(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${secs}s`;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function slugify(s) { return (s || '').toLowerCase().replace(/[\s/]/g, '-'); }
function catColor(c) { return CAT_COLORS[c] || CAT_COLORS['Uncategorized']; }
function siteInitial(h) { return ((h || '?')[0]).toUpperCase(); }
function siteColor(h) {
  const hue = [...(h || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue},50%,${isDark ? 35 : 40}%)`;
}

function show(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? '' : 'none';
}

function msg(type, extra = {}) {
  return new Promise(r => chrome.runtime.sendMessage({ type, ...extra }, res => r(res || {})));
}

function stor(keys) {
  return new Promise(r => chrome.storage.local.get(keys, r));
}

// ── Theme ─────────────────────────────────────────────────────────────────────

function applyTheme(dark) {
  isDark = dark;
  document.getElementById('app').dataset.theme = dark ? 'dark' : 'light';
  document.getElementById('themeToggle').textContent = dark ? '☀️' : '🌙';
  // Update SVG ring background colour
  const ringBg = document.querySelector('.ring-bg');
  if (ringBg) ringBg.style.stroke = dark ? '#252540' : '#e2e8f0';
  if (pieChart && barChart) syncChartTheme();
}

async function toggleTheme() {
  applyTheme(!isDark);
  const { settings = {} } = await stor('settings');
  chrome.storage.local.set({ settings: { ...settings, darkMode: isDark } });
  applyAccentColor(settings.accentColor || 'indigo', isDark);
  await renderHeatmap();
}

function syncChartTheme() {
  const tc = isDark ? '#94a3b8' : '#475569';
  const gc = isDark ? '#252540' : '#e2e8f0';
  const bc = isDark ? '#1a1a2e' : '#ffffff';
  pieChart.options.plugins.legend.labels.color  = tc;
  pieChart.data.datasets[0].borderColor         = bc;
  barChart.options.scales.x.ticks.color         = tc;
  barChart.options.scales.x.grid.color          = gc;
  barChart.options.scales.y.ticks.color         = tc;
  pieChart.update('none');
  barChart.update('none');
}

// ── Chart initialisation ──────────────────────────────────────────────────────

function initCharts() {
  const tc = isDark ? '#94a3b8' : '#475569';
  const gc = isDark ? '#252540' : '#e2e8f0';
  const bc = isDark ? '#1a1a2e' : '#ffffff';

  const centerPlugin = {
    id: 'centerLabel',
    afterDraw(chart) {
      if (chart.config.type !== 'doughnut') return;
      const total = (chart.data.datasets[0]?.data || []).reduce((a, b) => a + b, 0);
      if (!total) return;
      const { ctx, chartArea: { left, top, width, height } } = chart;
      ctx.save();
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmtDur(total), left + width / 2, top + height / 2);
      ctx.restore();
    }
  };

  pieChart = new Chart(document.getElementById('pieChart'), {
    type: 'doughnut',
    plugins: [centerPlugin],
    data: {
      labels: [],
      datasets: [{ data: [], backgroundColor: [], borderWidth: 2, borderColor: bc, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '58%',
      animation: { duration: 400 },
      plugins: {
        legend: { position: 'right', labels: { color: tc, font: { size: 10 }, boxWidth: 10, padding: 8 } },
        tooltip: { callbacks: { label: ctx => ` ${fmtDur(ctx.raw)}` } }
      }
    }
  });

  barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{ data: [], backgroundColor: '#6366f1', borderRadius: 4, borderSkipped: false }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: tc, font: { size: 10 }, callback: v => fmtDur(v) }, grid: { color: gc } },
        y: { ticks: { color: tc, font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

// ── Session card ──────────────────────────────────────────────────────────────

function renderSessionCard({ activeSession, isIdle, isWindowFocused, focusMode }) {
  const icon    = document.getElementById('siteIcon');
  const siteEl  = document.getElementById('currentSite');
  const badge   = document.getElementById('catBadge');
  const dot     = document.getElementById('statusDot');
  const statusT = document.getElementById('statusText');
  const btn     = document.getElementById('focusBtn');

  if (activeSession?.hostname) {
    icon.textContent = siteInitial(activeSession.hostname);
    icon.style.background = siteColor(activeSession.hostname);
    siteEl.textContent = activeSession.hostname;
    badge.textContent  = activeSession.category || 'Uncategorized';
    badge.className    = `cat-badge ${slugify(activeSession.category)}`;
    liveStartTime      = activeSession.startTime;
    dot.className      = 'status-dot on';
    statusT.textContent = focusMode ? '🎯 Focus mode active' : 'Tracking';
  } else {
    icon.textContent = '?';
    icon.style.background = 'var(--bg-3)';
    siteEl.textContent = '—';
    badge.textContent  = '';
    badge.className    = 'cat-badge';
    liveStartTime      = null;
    dot.className      = 'status-dot';
    statusT.textContent = isIdle ? 'Idle' : !isWindowFocused ? 'Window not focused' : 'Waiting...';
  }
  document.getElementById('focusBtnIcon').textContent = focusMode ? '⏹' : '🎯';
  document.getElementById('focusBtnText').textContent = focusMode ? 'Stop Focus' : 'Start Focus';
  btn.classList.toggle('active', !!focusMode);
}

// ── Today stats ───────────────────────────────────────────────────────────────

function renderStats(sessions, activeSession) {
  let study = 0, dist = 0, total = 0;
  for (const s of sessions) {
    total += s.duration;
    if (STUDY_CATS.has(s.category))    study += s.duration;
    if (DISTRACT_CATS.has(s.category)) dist  += s.duration;
  }
  if (activeSession?.startTime) {
    const live = Math.floor((Date.now() - activeSession.startTime) / 1000);
    total += live;
    if (STUDY_CATS.has(activeSession.category))    study += live;
    if (DISTRACT_CATS.has(activeSession.category)) dist  += live;
  }
  const pct = total > 0 ? Math.round((study / total) * 100) : 0;
  document.getElementById('studyTotal').textContent    = fmtDur(study);
  document.getElementById('distractTotal').textContent = fmtDur(dist);
  document.getElementById('productivePct').textContent = `${pct}%`;

  // Focus score badge
  const score   = total > 0 ? Math.max(0, Math.min(100, Math.round(100 - (dist / total) * 100))) : 100;
  const valEl   = document.getElementById('focusScoreVal');
  const badgeEl = document.getElementById('focusScoreBadge');
  if (valEl)   valEl.textContent = `${score}`;
  if (badgeEl) {
    const [cls, label] = score >= 80
      ? ['score-green', 'Focused']
      : score >= 50
        ? ['score-yellow', 'Moderate']
        : ['score-red', 'Distracted'];
    badgeEl.textContent = label;
    badgeEl.className   = `score-badge ${cls}`;
  }
}

// ── Block mode indicator ──────────────────────────────────────────────────────

function renderBlockModeIndicator(settings) {
  const btn = document.getElementById('blockModeBtn');
  if (!btn) return;
  const mode = settings.blockMode || 'gentle';
  if (mode === 'strict')      { btn.textContent = '🛡️'; btn.title = 'Strict block active'; }
  else if (mode === 'gentle') { btn.textContent = '👁️'; btn.title = 'Gentle block active'; }
  else                        { btn.textContent = '🔓'; btn.title = 'Blocking off';        }
}

// ── Charts ────────────────────────────────────────────────────────────────────

function aggregateByCat(sessions, active) {
  const t = {};
  for (const s of sessions) t[s.category] = (t[s.category] || 0) + s.duration;
  if (active?.startTime) {
    const live = Math.floor((Date.now() - active.startTime) / 1000);
    const c = active.category || 'Uncategorized';
    t[c] = (t[c] || 0) + live;
  }
  return t;
}

function aggregateBySite(sessions, active) {
  const t = {};
  for (const s of sessions) t[s.hostname] = (t[s.hostname] || 0) + s.duration;
  if (active?.startTime && active.hostname) {
    const live = Math.floor((Date.now() - active.startTime) / 1000);
    t[active.hostname] = (t[active.hostname] || 0) + live;
  }
  return t;
}

function renderPie(catData) {
  const labels = Object.keys(catData);
  const data   = Object.values(catData);
  const colors = labels.map(catColor);
  const bc     = isDark ? '#1a1a2e' : '#ffffff';
  pieChart.data.labels = labels;
  pieChart.data.datasets[0].data            = data;
  pieChart.data.datasets[0].backgroundColor = colors;
  pieChart.data.datasets[0].borderColor     = bc;
  const has = data.some(v => v > 0);
  show('noDataPie', !has);
  document.getElementById('pieChart').style.display = has ? 'block' : 'none';
  pieChart.update('none');
}

function renderBar(siteData) {
  const sorted = Object.entries(siteData).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const labels = sorted.map(([h]) => h.length > 22 ? h.slice(0, 20) + '…' : h);
  const data   = sorted.map(([, s]) => s);
  barChart.data.labels           = labels;
  barChart.data.datasets[0].data = data;
  const has = data.some(v => v > 0);
  show('noDataBar', !has);
  document.getElementById('barChart').style.display = has ? 'block' : 'none';
  barChart.update('none');
}

// ── Session history ───────────────────────────────────────────────────────────

function renderHistory(sessions) {
  const el     = document.getElementById('sessionList');
  const recent = [...sessions].reverse().slice(0, 5);
  if (!recent.length) {
    el.innerHTML = '<p class="empty-msg">No sessions recorded today.</p>';
    return;
  }
  el.innerHTML = recent.map(s => `
    <div class="session-item">
      <div class="sicon" style="background:${siteColor(s.hostname)}">${siteInitial(s.hostname)}</div>
      <div class="smeta">
        <span class="sdomain">${s.hostname}</span>
        <span class="cat-badge ${slugify(s.category)}" style="font-size:9px;padding:1px 6px">${s.category}</span>
      </div>
      <div class="sright">
        <span class="sdur">${fmtDur(s.duration)}</span>
        <span class="stime">${fmtTime(s.startTime)}</span>
      </div>
    </div>
  `).join('');
}

// ── Weekly heatmap ────────────────────────────────────────────────────────────

async function renderHeatmap() {
  const { sessions = [] } = await stor('sessions');
  const palette = isDark ? HEAT_DARK : HEAT_LIGHT;
  const el      = document.getElementById('weekHeatmap');
  const cells   = [];
  for (let i = 6; i >= 0; i--) {
    const d     = new Date();
    d.setDate(d.getDate() - i);
    const key   = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const secs  = sessions
      .filter(s => s.date === key && STUDY_CATS.has(s.category))
      .reduce((a, s) => a + s.duration, 0);
    const level = secs === 0 ? 0 : secs < 3600 ? 1 : secs < 7200 ? 2 : secs < 14400 ? 3 : 4;
    const hrs   = secs > 0 ? (secs / 3600).toFixed(1) + 'h' : '—';
    cells.push(`
      <div class="heat-cell ${i === 0 ? 'is-today' : ''}">
        <div class="heat-block" style="background:${palette[level]}" title="${label}: ${hrs} study"></div>
        <span class="heat-day">${label}</span>
        <span class="heat-hrs">${hrs}</span>
      </div>`);
  }
  el.innerHTML = cells.join('');
}

// ── Pomodoro ──────────────────────────────────────────────────────────────────

const POMO_MODE_LABELS = {
  IDLE: 'READY', WORK: 'WORK', BREAK: 'BREAK',
  LONG_BREAK: 'LONG BREAK', PAUSED_WORK: 'PAUSED', PAUSED_BREAK: 'PAUSED',
};
const RING_COLORS = {
  IDLE: '#6366f1', WORK: '#6366f1', PAUSED_WORK: '#475569',
  BREAK: '#22c55e', LONG_BREAK: '#06b6d4', PAUSED_BREAK: '#475569',
};

function getPomoRemaining(state) {
  if (!state || state.mode === 'IDLE') return state?.totalSeconds ?? 1500;
  if (state.mode.startsWith('PAUSED')) return state.totalSeconds - (state.accumulatedSecs || 0);
  if (!state.startedAt) return state.totalSeconds;
  const elapsed = (state.accumulatedSecs || 0) + Math.floor((Date.now() - state.startedAt) / 1000);
  return Math.max(0, state.totalSeconds - elapsed);
}

function updatePomoRing(remaining, total) {
  const progress = total > 0 ? remaining / total : 1;
  document.getElementById('ringFg').style.strokeDashoffset = RING_C * (1 - progress);
}

function renderPomo(state) {
  if (!state) return;
  const { mode, totalSeconds, pomodoroCount = 0, snoozeCount = 0, breakType } = state;
  const remaining = getPomoRemaining(state);

  // Timer text
  document.getElementById('pomoTime').textContent      = fmtTimer2(remaining);
  document.getElementById('pomoModeLabel').textContent = POMO_MODE_LABELS[mode] || mode;

  // Ring progress + colour
  updatePomoRing(remaining, totalSeconds);
  document.getElementById('ringFg').style.stroke = RING_COLORS[mode] || '#6366f1';
  const ringBg = document.querySelector('.ring-bg');
  if (ringBg) ringBg.style.stroke = isDark ? '#252540' : '#e2e8f0';

  // Cycle dots (4 per cycle)
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`pomoDot${i}`);
    if (!dot) continue;
    const cyclePos = pomodoroCount % 4;
    dot.className = i < cyclePos ? 'pomo-dot filled'
      : (i === cyclePos && mode === 'WORK') ? 'pomo-dot active'
      : 'pomo-dot';
  }

  // Break suggestion panel
  const isBreakMode = ['BREAK', 'LONG_BREAK', 'PAUSED_BREAK'].includes(mode);
  const suggEl = document.getElementById('breakSuggestion');
  if (isBreakMode && breakType) {
    document.getElementById('breakEmoji').textContent = breakType.emoji;
    document.getElementById('breakLabel').textContent = breakType.label;
    document.getElementById('breakDesc').textContent  = breakType.desc;
    suggEl.style.display = 'flex';
  } else {
    suggEl.style.display = 'none';
  }

  // Button visibility
  const isRunning = ['WORK', 'BREAK', 'LONG_BREAK'].includes(mode);
  const isPaused  = mode.startsWith('PAUSED');
  const isBreak   = ['BREAK', 'LONG_BREAK', 'PAUSED_BREAK'].includes(mode);
  show('pomoStartBtn',  mode === 'IDLE');
  show('pomoPauseBtn',  isRunning);
  show('pomoResumeBtn', isPaused);
  show('pomoResetBtn',  mode !== 'IDLE');
  show('pomoSnoozeBtn', isBreak && (snoozeCount || 0) < 2);
  show('pomoSkipBtn',   isBreak);
}

// Per-second Pomodoro tick (ring + time display only — no storage calls)
function tickPomo() {
  if (!currentPomoState) return;
  const { mode, totalSeconds } = currentPomoState;
  if (mode === 'IDLE' || mode.startsWith('PAUSED')) return;
  const remaining = getPomoRemaining(currentPomoState);
  document.getElementById('pomoTime').textContent = fmtTimer2(remaining);
  updatePomoRing(remaining, totalSeconds);
}

// ── AI Insights ───────────────────────────────────────────────────────────────

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function callGemini(prompt, apiKey) {
  if (!apiKey || !apiKey.trim())
    return 'Please add your Gemini API key in Settings to unlock AI insights.';
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey.trim()}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try { const e = await res.json(); errMsg = e?.error?.message || errMsg; } catch {}
      if (res.status === 401 || res.status === 403) return 'Invalid API key. Please check your key in Settings.';
      if (res.status === 429) return 'Rate limit reached. Please wait a moment and try again.';
      return `Gemini API error: ${errMsg}`;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || 'No content in Gemini response. Please try again.';
  } catch (err) {
    if (err instanceof TypeError) return 'Network error: Could not reach Gemini. Check your internet connection.';
    return `Unexpected error: ${err.message}`;
  }
}

function buildAiContext(allSessions, goals, streaks) {
  const STUDY_C = new Set(['Study', 'Video Learning', 'Coding', 'Research']);
  const DIST_C  = new Set(['Distraction', 'Entertainment']);
  const fmt = s => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  const todayK     = todayKey();
  const todaySess  = allSessions.filter(s => s.date === todayK);
  const studyToday = todaySess.filter(s => STUDY_C.has(s.category)).reduce((a, s) => a + s.duration, 0);
  const distToday  = todaySess.filter(s => DIST_C.has(s.category)).reduce((a, s) => a + s.duration, 0);

  const now = new Date();
  const daysSinceMon = (now.getDay() + 6) % 7;
  const weekStart    = new Date(now);
  weekStart.setDate(now.getDate() - daysSinceMon);
  const weekStartKey = weekStart.toISOString().slice(0, 10);

  const weekLines = [];
  let goalDaysHit = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key   = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const secs  = allSessions.filter(s => s.date === key && STUDY_C.has(s.category)).reduce((a, s) => a + s.duration, 0);
    const hit   = secs >= (goals.daily || 14400);
    if (hit) goalDaysHit++;
    weekLines.push(`  ${label}: ${fmt(secs)} ${hit ? '✓' : '✗'}`);
  }

  const subjMap = {};
  allSessions.filter(s => s.date >= weekStartKey && s.subject).forEach(s => {
    subjMap[s.subject] = (subjMap[s.subject] || 0) + s.duration;
  });
  const subjLines = Object.entries(subjMap).sort((a, b) => b[1] - a[1]).map(([s, t]) => `${s}: ${fmt(t)}`);

  return [
    `=== Today (${todayK}) ===`,
    `Study: ${fmt(studyToday)} | Distraction: ${fmt(distToday)}`,
    `Daily goal: ${fmt(goals.daily || 14400)} | Hit today: ${studyToday >= (goals.daily || 14400) ? 'Yes' : 'No'}`,
    `Streak: ${streaks.current || 0} days (best: ${streaks.longest || 0})`,
    ``,
    `=== This Week ===`,
    ...weekLines,
    `Goal achieved: ${goalDaysHit}/7 days`,
    ``,
    `=== Subjects this week ===`,
    subjLines.length ? subjLines.join(', ') : 'No subject data',
  ].join('\n');
}

const AI_PROMPTS = {
  weekly:   ctx => `You are a study coach. Based on this student's study data:\n\n${ctx}\n\nAnalyze their weekly patterns. Identify productive days and concerns. Be specific and encouraging. Under 150 words.`,
  subject:  ctx => `You are a study coach. Based on this student's data:\n\n${ctx}\n\nIs their subject balance healthy or are they neglecting subjects? Suggest redistribution if needed. Under 100 words.`,
  schedule: ctx => `You are a study coach. Based on these patterns:\n\n${ctx}\n\nSuggest an optimal daily study schedule for tomorrow with time blocks for each subject. Under 150 words.`,
  daily:    ctx => `You are a study coach. Summarize today's session:\n\n${ctx}\n\nWhat went well, what needs improvement, one motivational message. Under 100 words, end encouragingly.`,
};

function updateAiTimestamp(ts) {
  const diff = Math.floor((Date.now() - ts) / 60000);
  if (diff < 1)  return 'just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

function renderAiPanel() {
  const emptyEl    = document.getElementById('aiEmpty');
  const loadingEl  = document.getElementById('aiLoading');
  const responseEl = document.getElementById('aiResponse');
  if (!emptyEl) return;
  const cached = aiCache[currentAiType];
  if (cached) {
    emptyEl.style.display    = 'none';
    loadingEl.style.display  = 'none';
    responseEl.style.display = '';
    document.getElementById('aiText').textContent      = cached.text;
    document.getElementById('aiTimestamp').textContent = cached.ts;
  } else {
    emptyEl.style.display    = '';
    loadingEl.style.display  = 'none';
    responseEl.style.display = 'none';
  }
}

async function triggerAiInsights() {
  const emptyEl    = document.getElementById('aiEmpty');
  const loadingEl  = document.getElementById('aiLoading');
  const responseEl = document.getElementById('aiResponse');
  emptyEl.style.display    = 'none';
  loadingEl.style.display  = '';
  responseEl.style.display = 'none';

  try {
    const data       = await stor(['sessions', 'goals', 'streaks', 'settings', 'aiInsights']);
    const settings   = data.settings   || {};
    const aiInsights = data.aiInsights || {};
    const now        = Date.now();
    const ONE_HOUR   = 3600000;

    const stored = aiInsights[currentAiType];
    if (stored && (now - stored.ts) < ONE_HOUR) {
      aiCache[currentAiType] = { text: stored.text, ts: updateAiTimestamp(stored.ts) };
      renderAiPanel();
      return;
    }

    const context = buildAiContext(data.sessions || [], data.goals || {}, data.streaks || {});
    const prompt  = AI_PROMPTS[currentAiType](context);
    const text    = await callGemini(prompt, settings.geminiApiKey || '');

    aiCache[currentAiType] = { text, ts: updateAiTimestamp(now) };
    const updated = { ...aiInsights, [currentAiType]: { text, ts: now } };
    chrome.storage.local.set({ aiInsights: updated });
  } catch (err) {
    aiCache[currentAiType] = { text: `Error: ${err.message}`, ts: 'just now' };
  }
  renderAiPanel();
}

// ── Goals & Streaks ───────────────────────────────────────────────────────────

function renderGoals(goals, streaks, allSessions, activeSession) {
  const dailyGoal  = goals.daily  || 14400;
  const weeklyGoal = goals.weekly || 72000;
  const today      = todayKey();

  let todayStudy = allSessions
    .filter(s => s.date === today && STUDY_CATS.has(s.category))
    .reduce((a, s) => a + s.duration, 0);
  if (activeSession?.startTime && STUDY_CATS.has(activeSession.category)) {
    todayStudy += Math.floor((Date.now() - activeSession.startTime) / 1000);
  }

  const now = new Date();
  const daysSinceMon = (now.getDay() + 6) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysSinceMon);
  const weekStartKey = weekStart.toISOString().slice(0, 10);
  let weekStudy = allSessions
    .filter(s => s.date >= weekStartKey && STUDY_CATS.has(s.category))
    .reduce((a, s) => a + s.duration, 0);
  if (activeSession?.startTime && STUDY_CATS.has(activeSession.category)) {
    weekStudy += Math.floor((Date.now() - activeSession.startTime) / 1000);
  }

  document.getElementById('streakCurrent').textContent = streaks.current || 0;
  document.getElementById('streakLongest').textContent = streaks.longest || 0;

  const dailyPct  = Math.min(100, (todayStudy / dailyGoal) * 100);
  const dailyFill = document.getElementById('dailyGoalFill');
  dailyFill.style.width = `${dailyPct.toFixed(1)}%`;
  document.getElementById('dailyGoalMeta').textContent =
    `${fmtDur(todayStudy)} / ${fmtDur(dailyGoal)}`;
  if (dailyPct >= 100 && !dailyFill.dataset.hit) {
    dailyFill.dataset.hit = '1';
    dailyFill.classList.add('goal-hit');
    setTimeout(() => dailyFill.classList.remove('goal-hit'), 700);
  }

  const weeklyPct  = Math.min(100, (weekStudy / weeklyGoal) * 100);
  const weeklyFill = document.getElementById('weeklyGoalFill');
  weeklyFill.style.width = `${weeklyPct.toFixed(1)}%`;
  document.getElementById('weeklyGoalMeta').textContent =
    `${fmtDur(weekStudy)} / ${fmtDur(weeklyGoal)}`;
}

// ── Subject stats ─────────────────────────────────────────────────────────────

function renderSubjects(allSessions, settings) {
  const subjects = settings.subjects || ['Math', 'Physics', 'DSA', 'Chemistry', 'English'];
  const today    = todayKey();
  const stats    = Object.fromEntries(subjects.map(s => [s, 0]));

  for (const s of allSessions) {
    if (s.date !== today || !s.subject) continue;
    stats[s.subject] = (stats[s.subject] ?? 0) + s.duration;
  }

  const el     = document.getElementById('subjectList');
  const maxVal = Math.max(...Object.values(stats), 1);
  const anyData = Object.values(stats).some(v => v > 0);

  if (!anyData) {
    el.innerHTML = '<p class="empty-msg">No subject data yet — tag your sessions!</p>';
    return;
  }

  el.innerHTML = subjects.map((subj, i) => {
    const secs   = stats[subj] || 0;
    const color  = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
    const barPct = (secs / maxVal) * 100;
    return `
      <div class="subject-item">
        <div class="subject-dot" style="background:${color}"></div>
        <span class="subject-name">${subj}</span>
        <div class="subject-bar-wrap">
          <div class="subject-bar-fill" style="width:${barPct.toFixed(1)}%;background:${color}"></div>
        </div>
        <span class="subject-dur">${secs > 0 ? fmtDur(secs) : '—'}</span>
      </div>`;
  }).join('');
}

// ── Subject dropdown ──────────────────────────────────────────────────────────

function populateSubjectDropdown(activeSession, subjects) {
  const list = subjects || ['Math', 'Physics', 'DSA', 'Chemistry', 'English'];
  const sel  = document.getElementById('subjectSelect');
  if (!sel) return;
  const hasSession = !!activeSession?.hostname;
  sel.style.display = hasSession ? '' : 'none';
  if (!hasSession) return;
  const current = activeSession.subject || '';
  sel.innerHTML =
    `<option value="">Tag subject...</option>` +
    list.map(s => `<option value="${s}"${s === current ? ' selected' : ''}>${s}</option>`).join('');
}

// ── Main refresh (every 5 s) ──────────────────────────────────────────────────

async function refresh() {
  const [status, data] = await Promise.all([
    msg('GET_STATUS'),
    stor(['sessions', 'goals', 'streaks', 'settings'])
  ]);
  const allSessions   = data.sessions  || [];
  const goals         = data.goals     || {};
  const streaks       = data.streaks   || {};
  const settings      = data.settings  || {};
  const todaySessions = allSessions.filter(s => s.date === todayKey());
  const { activeSession, pomodoroState } = status;

  currentPomoState = pomodoroState || null;

  renderSessionCard(status);
  renderStats(todaySessions, activeSession);
  renderPie(aggregateByCat(todaySessions, activeSession));
  renderBar(aggregateBySite(todaySessions, activeSession));
  renderHistory(todaySessions);
  await renderHeatmap();
  if (currentPomoState) renderPomo(currentPomoState);
  renderGoals(goals, streaks, allSessions, activeSession);
  renderSubjects(allSessions, settings);
  populateSubjectDropdown(activeSession, settings.subjects);
  renderBlockModeIndicator(settings);
}

// ── Per-second tick ───────────────────────────────────────────────────────────

function tick() {
  // Session timer
  document.getElementById('sessionTimer').textContent = liveStartTime
    ? fmtTimer(Math.floor((Date.now() - liveStartTime) / 1000))
    : '0:00';
  // Pomodoro ring
  tickPomo();
}

// ── Initialise ────────────────────────────────────────────────────────────────

async function init() {
  const { settings = {}, aiInsights = {} } = await stor(['settings', 'aiInsights']);
  for (const [type, entry] of Object.entries(aiInsights)) {
    if (entry && entry.text) aiCache[type] = { text: entry.text, ts: updateAiTimestamp(entry.ts) };
  }
  applyTheme(settings.darkMode !== false);
  applyAccentColor(settings.accentColor || 'indigo', settings.darkMode !== false);
  document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });
  initCharts();
  await refresh();
  renderAiPanel();
  setInterval(refresh, 5000);
  setInterval(tick,    1000);
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.getElementById('themeToggle').addEventListener('click', toggleTheme);

document.getElementById('blockModeBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('focusBtn').addEventListener('click', async () => {
  await msg('TOGGLE_FOCUS');
  await refresh();
});

document.getElementById('pomoStartBtn').addEventListener('click', async () => {
  await msg('POMO_START');
  await refresh();
});
document.getElementById('pomoPauseBtn').addEventListener('click', async () => {
  await msg('POMO_PAUSE');
  await refresh();
});
document.getElementById('pomoResumeBtn').addEventListener('click', async () => {
  await msg('POMO_RESUME');
  await refresh();
});
document.getElementById('pomoResetBtn').addEventListener('click', async () => {
  await msg('POMO_RESET');
  await refresh();
});
document.getElementById('pomoSnoozeBtn').addEventListener('click', async () => {
  await msg('POMO_SNOOZE');
  await refresh();
});
document.getElementById('pomoSkipBtn').addEventListener('click', async () => {
  await msg('POMO_SKIP');
  await refresh();
});

document.getElementById('subjectSelect').addEventListener('change', async (e) => {
  await msg('SET_SESSION_SUBJECT', { subject: e.target.value || null });
});

// AI tab switching
document.querySelectorAll('.ai-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ai-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentAiType = btn.dataset.type;
    renderAiPanel();
  });
});

document.getElementById('aiGetBtn').addEventListener('click', triggerAiInsights);

document.getElementById('aiRefreshBtn').addEventListener('click', async () => {
  delete aiCache[currentAiType];
  await triggerAiInsights();
});

init();
