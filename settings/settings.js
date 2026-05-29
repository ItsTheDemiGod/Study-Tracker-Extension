'use strict';

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_WHITELIST = [
  'google.com', 'gmail.com', 'meet.google.com', 'zoom.us', 'classroom.google.com',
];

const ACCENT_COLORS = {
  indigo:  { dark: '#6366f1', h: '#4f46e5' },
  teal:    { dark: '#14b8a6', h: '#0d9488' },
  rose:    { dark: '#f43f5e', h: '#e11d48' },
  amber:   { dark: '#f59e0b', h: '#d97706' },
  emerald: { dark: '#10b981', h: '#059669' },
};

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ── Storage helpers ────────────────────────────────────────────────────────────

async function getSettings() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  return settings;
}

async function patchSettings(patch) {
  const { settings = {} } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...settings, ...patch } });
}

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Accent color (applies CSS vars to this settings page) ─────────────────────

function applyAccent(colorName) {
  const c = ACCENT_COLORS[colorName] || ACCENT_COLORS.indigo;
  document.documentElement.style.setProperty('--accent',   c.dark);
  document.documentElement.style.setProperty('--accent-h', c.h);
}

// ── Section 1: Pomodoro ────────────────────────────────────────────────────────

function initPomodoro(settings) {
  const work     = document.getElementById('pomoWork');
  const brk      = document.getElementById('pomoBreak');
  const longBrk  = document.getElementById('pomoLongBreak');
  const interval = document.getElementById('pomoInterval');

  work.value     = settings.pomodoroWork              ?? 25;
  brk.value      = settings.pomodoroBreak             ?? 5;
  longBrk.value  = settings.pomodoroLongBreak         ?? 15;
  interval.value = settings.pomodoroLongBreakInterval ?? 4;

  const save = () => patchSettings({
    pomodoroWork:              clamp(parseInt(work.value)     || 25, 1,  120),
    pomodoroBreak:             clamp(parseInt(brk.value)      || 5,  1,  60),
    pomodoroLongBreak:         clamp(parseInt(longBrk.value)  || 15, 5,  60),
    pomodoroLongBreakInterval: clamp(parseInt(interval.value) || 4,  1,  10),
  });

  [work, brk, longBrk, interval].forEach(el => el.addEventListener('change', save));
}

// ── Section 2: Goals ───────────────────────────────────────────────────────────

async function initGoals(settings, goals) {
  const dailyH  = document.getElementById('dailyGoalH');
  const dailyM  = document.getElementById('dailyGoalM');
  const weeklyH = document.getElementById('weeklyGoalH');

  const dailySecs  = goals.daily  || 14400;
  const weeklySecs = goals.weekly || 72000;

  dailyH.value  = Math.floor(dailySecs  / 3600);
  dailyM.value  = Math.floor((dailySecs % 3600) / 60);
  weeklyH.value = Math.floor(weeklySecs / 3600);

  const saveGoals = async () => {
    const dh = clamp(parseInt(dailyH.value)  || 0, 0, 24);
    const dm = clamp(parseInt(dailyM.value)  || 0, 0, 59);
    const wh = clamp(parseInt(weeklyH.value) || 0, 0, 168);
    const { goals: g = {} } = await chrome.storage.local.get('goals');
    await chrome.storage.local.set({
      goals: { ...g, daily: dh * 3600 + dm * 60, weekly: wh * 3600 },
    });
  };

  [dailyH, dailyM, weeklyH].forEach(el => el.addEventListener('change', saveGoals));

  renderSubjectGoals(settings, goals);

  document.getElementById('addSubjectBtn').addEventListener('click', addSubject);
  document.getElementById('newSubjectInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addSubject();
  });
}

async function renderSubjectGoals(settings, goals) {
  const subjects  = settings.subjects  || ['Math', 'Physics', 'DSA', 'Chemistry', 'English'];
  const subjGoals = goals.subjects     || {};
  const list      = document.getElementById('subjectGoalList');
  list.innerHTML  = '';

  if (!subjects.length) {
    list.innerHTML = '<p class="empty-hint">No subjects added yet.</p>';
    return;
  }

  for (const subj of subjects) {
    const goalSecs = subjGoals[subj] || 0;
    const row      = document.createElement('div');
    row.className  = 'subject-goal-row';
    row.innerHTML  = `
      <span class="subject-goal-name">${subj}</span>
      <div class="input-row" style="flex:1;justify-content:flex-end">
        <input type="number" class="s-input s-input-num subj-goal-input"
               min="0" max="24" value="${Math.floor(goalSecs / 3600)}" data-subject="${subj}">
        <span class="s-unit">h/day</span>
      </div>
      <button class="remove-btn" data-subject="${subj}" title="Remove subject">✕</button>
    `;
    list.appendChild(row);
  }

  list.querySelectorAll('.subj-goal-input').forEach(el => {
    el.addEventListener('change', async () => {
      const subj = el.dataset.subject;
      const h    = clamp(parseInt(el.value) || 0, 0, 24);
      el.value   = h;
      const { goals: g = {} } = await chrome.storage.local.get('goals');
      const subjG = { ...(g.subjects || {}) };
      if (h === 0) delete subjG[subj]; else subjG[subj] = h * 3600;
      await chrome.storage.local.set({ goals: { ...g, subjects: subjG } });
    });
  });

  list.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const subj  = btn.dataset.subject;
      const { settings: s = {}, goals: g = {} } =
        await chrome.storage.local.get(['settings', 'goals']);
      const newSubjects = (s.subjects || []).filter(x => x !== subj);
      const newSubjG    = { ...(g.subjects || {}) };
      delete newSubjG[subj];
      await chrome.storage.local.set({
        settings: { ...s, subjects: newSubjects },
        goals:    { ...g, subjects: newSubjG },
      });
      renderSubjectGoals({ ...s, subjects: newSubjects }, { ...g, subjects: newSubjG });
    });
  });
}

async function addSubject() {
  const input = document.getElementById('newSubjectInput');
  const val   = input.value.trim();
  if (!val) return;
  input.value = '';
  const { settings: s = {}, goals: g = {} } =
    await chrome.storage.local.get(['settings', 'goals']);
  const subjects = s.subjects || [];
  if (subjects.includes(val)) return;
  const newSubjects = [...subjects, val];
  await chrome.storage.local.set({ settings: { ...s, subjects: newSubjects } });
  renderSubjectGoals({ ...s, subjects: newSubjects }, g);
}

// ── Section 3: Notifications ───────────────────────────────────────────────────

function initNotifications(settings) {
  const n = settings.notifications || {};

  const toggleMap = {
    notifBreaks:         'breaks',
    notifGoals:          'goals',
    notifDaily:          'daily',
    notifNudge:          'nudge',
    notifSubjectBalance: 'subjectBalance',
  };

  for (const [id, key] of Object.entries(toggleMap)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.checked = n[key] !== false;
    el.addEventListener('change', () => saveNotifPatch({ [key]: el.checked }));
  }

  const dailyHourEl = document.getElementById('dailyHour');
  const nudgeHourEl = document.getElementById('nudgeHour');
  dailyHourEl.value = n.dailyHour ?? 22;
  nudgeHourEl.value = n.nudgeHour ?? 18;

  dailyHourEl.addEventListener('change', () => {
    const v = clamp(parseInt(dailyHourEl.value) || 22, 0, 23);
    dailyHourEl.value = v;
    saveNotifPatch({ dailyHour: v });
    chrome.runtime.sendMessage({ type: 'RESCHEDULE_ALARMS' }).catch(() => {});
  });
  nudgeHourEl.addEventListener('change', () => {
    const v = clamp(parseInt(nudgeHourEl.value) || 18, 0, 23);
    nudgeHourEl.value = v;
    saveNotifPatch({ nudgeHour: v });
    chrome.runtime.sendMessage({ type: 'RESCHEDULE_ALARMS' }).catch(() => {});
  });
}

async function saveNotifPatch(patch) {
  const { settings: s = {} } = await chrome.storage.local.get('settings');
  const notif = { ...(s.notifications || {}), ...patch };
  await patchSettings({ notifications: notif });
}

// ── Section 4: Distraction Blocking ───────────────────────────────────────────

function initDistraction(settings) {
  const bm = settings.blockMode || 'gentle';
  for (const r of document.querySelectorAll('input[name="blockMode"]')) {
    r.checked = r.value === bm;
    r.addEventListener('change', () => { if (r.checked) patchSettings({ blockMode: r.value }); });
  }

  const thEl = document.getElementById('distractThreshold');
  thEl.value = settings.distractionThreshold ?? 10;
  thEl.addEventListener('change', () => {
    const v = clamp(parseInt(thEl.value) || 10, 1, 60);
    thEl.value = v;
    patchSettings({ distractionThreshold: v });
  });

  const whitelist = settings.whitelist?.length ? settings.whitelist : DEFAULT_WHITELIST;
  if (!settings.whitelist?.length) patchSettings({ whitelist });
  renderWhitelist(whitelist);

  document.getElementById('addSiteBtn').addEventListener('click', addSite);
  document.getElementById('whitelistInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addSite();
  });
}

function renderWhitelist(list) {
  const ul = document.getElementById('whitelistList');
  ul.innerHTML = '';
  if (!list.length) {
    ul.innerHTML = '<li class="whitelist-empty">No sites added yet.</li>';
    return;
  }
  for (const site of list) {
    const li = document.createElement('li');
    li.className = 'whitelist-item';
    li.innerHTML = `
      <span class="whitelist-domain">${site}</span>
      <button class="whitelist-remove" data-site="${site}" title="Remove">✕</button>
    `;
    li.querySelector('.whitelist-remove').addEventListener('click', async () => {
      const s  = await getSettings();
      const wl = (s.whitelist || DEFAULT_WHITELIST).filter(x => x !== site);
      await patchSettings({ whitelist: wl });
      renderWhitelist(wl);
    });
    ul.appendChild(li);
  }
}

async function addSite() {
  const input = document.getElementById('whitelistInput');
  let val = input.value.trim()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
  if (!val) return;
  input.value = '';
  const s  = await getSettings();
  const wl = s.whitelist?.length ? s.whitelist : DEFAULT_WHITELIST;
  if (wl.includes(val)) return;
  const newList = [...wl, val];
  await patchSettings({ whitelist: newList });
  renderWhitelist(newList);
}

// ── Section 5: Site Categories ─────────────────────────────────────────────────

const CAT_CLASSES = {
  'Study':         'study',
  'Video Learning':'video-learning',
  'Coding':        'coding',
  'Research':      'research',
  'Communication': 'communication',
  'Distraction':   'distraction',
  'Entertainment': 'entertainment',
};

async function initCategories() {
  const { customCategories = {} } = await chrome.storage.local.get('customCategories');
  renderCategories(customCategories);

  document.getElementById('addCatBtn').addEventListener('click', addCategory);
  document.getElementById('catDomainInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addCategory();
  });
}

function renderCategories(cats) {
  const list    = document.getElementById('customCatList');
  list.innerHTML = '';
  const entries  = Object.entries(cats);
  if (!entries.length) {
    list.innerHTML = '<p class="empty-hint">No custom overrides yet.</p>';
    return;
  }
  for (const [domain, cat] of entries) {
    const row       = document.createElement('div');
    row.className   = 'cat-row';
    const cls       = CAT_CLASSES[cat] || 'uncategorized';
    row.innerHTML   = `
      <span class="cat-domain">${domain}</span>
      <span class="cat-pill cat-${cls}">${cat}</span>
      <button class="remove-btn" data-domain="${domain}" title="Remove">✕</button>
    `;
    row.querySelector('.remove-btn').addEventListener('click', async () => {
      const { customCategories: cc = {} } = await chrome.storage.local.get('customCategories');
      delete cc[domain];
      await chrome.storage.local.set({ customCategories: cc });
      renderCategories(cc);
    });
    list.appendChild(row);
  }
}

async function addCategory() {
  const domainEl = document.getElementById('catDomainInput');
  const catEl    = document.getElementById('catSelectInput');
  let domain = domainEl.value.trim()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
  if (!domain) return;
  domainEl.value = '';
  const { customCategories: cc = {} } = await chrome.storage.local.get('customCategories');
  cc[domain] = catEl.value;
  await chrome.storage.local.set({ customCategories: cc });
  renderCategories(cc);
}

// ── Section 6: Gemini API Key ──────────────────────────────────────────────────

function initGemini(settings) {
  const keyInput = document.getElementById('geminiKeyInput');
  keyInput.value = settings.geminiApiKey || '';
  document.getElementById('saveKeyBtn').addEventListener('click', saveGeminiKey);
  document.getElementById('testKeyBtn').addEventListener('click', testGeminiKey);
  keyInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveGeminiKey(); });
}

function showApiResult(text, ok) {
  const el = document.getElementById('apiKeyResult');
  el.textContent = text;
  el.className   = `api-key-result ${ok ? 'ok' : 'err'}`;
  setTimeout(() => { el.textContent = ''; el.className = 'api-key-result'; }, 4000);
}

async function saveGeminiKey() {
  const val = document.getElementById('geminiKeyInput').value.trim();
  await patchSettings({ geminiApiKey: val });
  showApiResult(val ? 'API key saved.' : 'API key cleared.', true);
}

async function testGeminiKey() {
  const val = document.getElementById('geminiKeyInput').value.trim();
  if (!val) { showApiResult('Please enter a key first.', false); return; }
  showApiResult('Testing…', true);
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${val}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] }),
    });
    if (res.ok)                                        showApiResult('✓ Key is valid!', true);
    else if (res.status === 401 || res.status === 403) showApiResult('✗ Invalid API key.', false);
    else if (res.status === 429)                       showApiResult('✗ Rate limit hit — try again.', false);
    else                                               showApiResult(`✗ Error ${res.status}`, false);
  } catch {
    showApiResult('✗ Network error.', false);
  }
}

// ── Section 7: Data & Privacy ──────────────────────────────────────────────────

async function initDataPrivacy() {
  refreshStorageUsage();

  document.getElementById('exportJsonBtn').addEventListener('click', async () => {
    const data = await chrome.storage.local.get(null);
    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(json, `studytracker-export-${date}.json`, 'application/json');
  });

  document.getElementById('exportCsvBtn').addEventListener('click', async () => {
    const { sessions = [] } = await chrome.storage.local.get('sessions');
    const headers = ['date', 'domain', 'category', 'subject', 'duration_mins', 'session_start', 'session_end'];
    const rows    = sessions.map(s => [
      s.date     || '',
      s.hostname || '',
      s.category || '',
      s.subject  || '',
      ((s.duration || 0) / 60).toFixed(2),
      s.startTime ? new Date(s.startTime).toISOString() : '',
      s.endTime   ? new Date(s.endTime).toISOString()   : '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv  = [headers.join(','), ...rows].join('\n');
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(csv, `studytracker-sessions-${date}.csv`, 'text/csv');
  });

  document.getElementById('clearTodayBtn').addEventListener('click', async () => {
    if (!confirm('Clear all study data from today? This cannot be undone.')) return;
    const today = new Date().toISOString().slice(0, 10);
    const { sessions = [], dailyStats = {}, dailyGoalNotified = {} } =
      await chrome.storage.local.get(['sessions', 'dailyStats', 'dailyGoalNotified']);
    const filtered = sessions.filter(s => s.date !== today);
    delete dailyStats[today];
    delete dailyGoalNotified[today];
    await chrome.storage.local.set({ sessions: filtered, dailyStats, dailyGoalNotified });
    refreshStorageUsage();
    alert("Today's data has been cleared.");
  });

  document.getElementById('clearAllBtn').addEventListener('click', async () => {
    if (!confirm('This will delete ALL your study data permanently. Are you absolutely sure?')) return;
    if (!confirm('Last chance — this cannot be undone. Delete everything?')) return;
    const { settings = {} } = await chrome.storage.local.get('settings');
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ settings });
    refreshStorageUsage();
    alert('All study history has been cleared. Your settings have been kept.');
  });
}

function refreshStorageUsage() {
  chrome.storage.local.getBytesInUse(null, bytes => {
    const el = document.getElementById('storageUsage');
    if (el) el.textContent = `${(bytes / 1024).toFixed(1)} KB`;
  });
}

// ── Section 8: Appearance ──────────────────────────────────────────────────────

function initAppearance(settings) {
  const darkToggle = document.getElementById('darkModeToggle');
  darkToggle.checked = settings.darkMode !== false;
  darkToggle.addEventListener('change', () => patchSettings({ darkMode: darkToggle.checked }));

  const colorName = settings.accentColor || 'indigo';
  applyAccent(colorName);

  document.querySelectorAll('.color-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === colorName);
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const c = btn.dataset.color;
      applyAccent(c);
      await patchSettings({ accentColor: c });
    });
  });
}

// ── Init ───────────────────────────────────────────────────────────────────────

async function init() {
  const { settings = {}, goals = {} } = await chrome.storage.local.get(['settings', 'goals']);

  initPomodoro(settings);
  await initGoals(settings, goals);
  initNotifications(settings);
  initDistraction(settings);
  await initCategories();
  initGemini(settings);
  await initDataPrivacy();
  initAppearance(settings);
}

init();
