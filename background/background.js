import { initStorage, saveSession, updateDailyTime, getTodayKey } from '../utils/storage.js';
import { getCategoryForURL } from '../utils/categorizer.js';
import {
  notifyBreakStart, notifyBackToWork,
  notifyGoalProgress, notifyInactivityNudge, notifyDailyReport,
  notifyDistractionAlert, notifyAiSummary, notifySubjectBalance,
} from '../utils/notifications.js';
import { autoSuggestSubject } from '../utils/subjects.js';
import { callGemini, buildStudyContext, buildPrompt } from '../utils/gemini.js';

// ── Alarm names ───────────────────────────────────────────────────────────────

const SAVE_ALARM     = 'study-tracker-save';
const POMO_END_ALARM = 'pomo-end';
const NUDGE_ALARM    = 'nudge-daily';
const REPORT_ALARM   = 'report-daily';
const MIDNIGHT_ALARM         = 'midnight-streak';
const SUBJECT_BALANCE_ALARM  = 'subject-balance';

const DEFAULT_WHITELIST = ['google.com', 'gmail.com', 'meet.google.com', 'zoom.us', 'classroom.google.com'];

const IDLE_THRESHOLD_SECS = 120; // 2 minutes

// ── Break type definitions ────────────────────────────────────────────────────

const BREAK_TYPES = [
  { type: 'eye-rest',  emoji: '👀', label: 'Eye Rest',   desc: '20-20-20: look 20 ft away for 20 seconds',      isLong: false },
  { type: 'hydration', emoji: '💧', label: 'Hydration',  desc: 'Drink a full glass of water',                   isLong: false },
  { type: 'breathing', emoji: '🧘', label: 'Breathing',  desc: '4-7-8 breathing: inhale 4s, hold 7s, exhale 8s', isLong: false },
  { type: 'walk',      emoji: '🚶', label: 'Walk Break', desc: 'Stand up and walk around for 15 minutes',        isLong: true  },
];

const STUDY_CATS = new Set(['Study', 'Video Learning', 'Coding', 'Research']);

// ── In-memory state ───────────────────────────────────────────────────────────

let activeSession   = null;
let isIdle          = false;
let isWindowFocused = true;
let focusMode       = false;
let stateLoaded     = false;

const alertCooldowns = {}; // { hostname: lastAlertTimestamp } — in-memory, acceptable

let pomoState = {
  mode:            'IDLE',   // IDLE | WORK | BREAK | LONG_BREAK | PAUSED_WORK | PAUSED_BREAK
  totalSeconds:    1500,
  accumulatedSecs: 0,
  startedAt:       null,
  pomodoroCount:   0,
  snoozeCount:     0,
  breakType:       null,
  todayDate:       '',
};

// ── Initialisation ────────────────────────────────────────────────────────────

async function ensureState() {
  if (stateLoaded) return;
  const data = await chrome.storage.local.get(['activeSession', 'focusMode', 'pomodoroState']);
  activeSession = data.activeSession   || null;
  focusMode     = data.focusMode       || false;
  if (data.pomodoroState) pomoState = data.pomodoroState;
  stateLoaded = true;
}

async function init() {
  await initStorage();
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECS);

  const saveAlarm = await chrome.alarms.get(SAVE_ALARM);
  if (!saveAlarm) chrome.alarms.create(SAVE_ALARM, { periodInMinutes: 1 });

  await setupDailyAlarms();
  await ensureState();
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await init();
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }
});
chrome.runtime.onStartup.addListener(init);

// ── Tracking helpers ──────────────────────────────────────────────────────────

function getHostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return null; }
}

function isTrackableURL(url) {
  return !!url && url.startsWith('http') &&
    !url.startsWith('chrome://') && !url.startsWith('chrome-extension://') &&
    !url.startsWith('about:')    && !url.startsWith('edge://');
}

async function startTracking(tabId, url) {
  await flushSession(true);
  if (!isTrackableURL(url)) {
    activeSession = null;
    await chrome.storage.local.remove('activeSession');
    updateBadge();
    return;
  }
  const hostname = getHostname(url);
  if (!hostname) return;
  const now = Date.now();
  activeSession = {
    tabId, hostname, url,
    category:    getCategoryForURL(url),
    subject:     autoSuggestSubject(url) || null,
    startTime:   now,
    lastSavedAt: now,
    date:        getTodayKey(),
  };
  await chrome.storage.local.set({ activeSession });
  updateBadge();
}

async function flushSession(endSession = true) {
  if (!activeSession) return;
  const now   = Date.now();
  const delta = Math.floor((now - activeSession.lastSavedAt) / 1000);
  if (delta > 0) await updateDailyTime(activeSession.hostname, delta, activeSession.date);

  if (endSession) {
    const total = Math.floor((now - activeSession.startTime) / 1000);
    if (total >= 2) {
      await saveSession({
        hostname:  activeSession.hostname,
        url:       activeSession.url,
        category:  activeSession.category,
        subject:   activeSession.subject || null,
        startTime: activeSession.startTime,
        endTime:   now,
        duration:  total,
        date:      activeSession.date,
      });
      if (STUDY_CATS.has(activeSession.category)) {
        const { settings: s = {} } = await chrome.storage.local.get('settings');
        await checkGoalProgress(s);
      }
    }
    activeSession = null;
    await chrome.storage.local.remove('activeSession');
  } else {
    activeSession.lastSavedAt = now;
    await chrome.storage.local.set({ activeSession });
  }
  updateBadge();
}

async function updateBadge() {
  const { sessions = [], goals = {} } = await chrome.storage.local.get(['sessions', 'goals']);
  const today    = getTodayKey();
  let studySecs  = sessions
    .filter(s => s.date === today && STUDY_CATS.has(s.category))
    .reduce((a, s) => a + s.duration, 0);
  if (activeSession?.startTime && STUDY_CATS.has(activeSession.category)) {
    studySecs += Math.floor((Date.now() - activeSession.startTime) / 1000);
  }
  if (studySecs === 0) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  const hrs  = studySecs / 3600;
  const text = hrs >= 1
    ? `${(Math.floor(hrs * 10) / 10)}h`
    : `${Math.floor(studySecs / 60)}m`;
  chrome.action.setBadgeText({ text: text.slice(0, 4) });
  const goalSecs = goals.daily || 14400;
  chrome.action.setBadgeBackgroundColor({
    color: studySecs >= goalSecs ? '#22c55e' : '#6366f1',
  });
}

// ── Tab / window / idle events ────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await ensureState();
  if (isIdle || !isWindowFocused) return;
  try { const t = await chrome.tabs.get(tabId); if (t.url) await startTracking(tabId, t.url); } catch (_) {}
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  await ensureState();
  if (isIdle || !isWindowFocused) return;
  try {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active?.id === tabId && tab.url) await startTracking(tabId, tab.url);
  } catch (_) {}
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  await ensureState();
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    isWindowFocused = false;
    await flushSession(true);
    updateBadge();
  } else {
    isWindowFocused = true;
    if (!isIdle) {
      try {
        const [active] = await chrome.tabs.query({ active: true, windowId });
        if (active?.url) await startTracking(active.id, active.url);
      } catch (_) {}
    }
  }
});

chrome.idle.onStateChanged.addListener(async (newState) => {
  await ensureState();
  if (newState === 'idle' || newState === 'locked') {
    isIdle = true;
    await flushSession(true);
    updateBadge();
  } else if (newState === 'active') {
    isIdle = false;
    if (isWindowFocused) {
      try {
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (active?.url) await startTracking(active.id, active.url);
      } catch (_) {}
    }
  }
});

// ── Distraction alert ─────────────────────────────────────────────────────────

async function checkDistractionAlert() {
  if (!focusMode || !activeSession) return;
  const cat = activeSession.category;
  if (cat !== 'Distraction' && cat !== 'Entertainment') return;

  const { settings = {} } = await chrome.storage.local.get('settings');
  const threshold = (settings.distractionThreshold || 10) * 60;
  const elapsed   = Math.floor((Date.now() - activeSession.startTime) / 1000);
  if (elapsed < threshold) return;

  const last = alertCooldowns[activeSession.hostname] || 0;
  if (Date.now() - last < 30 * 60 * 1000) return;

  notifyDistractionAlert(activeSession.hostname, Math.floor(elapsed / 60));
  alertCooldowns[activeSession.hostname] = Date.now();
}

// ── Broadcast focus state to all content scripts ──────────────────────────────

async function broadcastFocusUpdate() {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { type: 'FOCUS_UPDATE', focusMode }).catch(() => {});
  }
}

// ── Pomodoro helpers ──────────────────────────────────────────────────────────

function getBreakType(count) {
  return BREAK_TYPES[(count - 1) % BREAK_TYPES.length];
}

function getNextOccurrence(hour, minute = 0) {
  const now = new Date();
  const t   = new Date();
  t.setHours(hour, minute, 0, 0);
  if (t <= now) t.setDate(t.getDate() + 1);
  return t.getTime();
}

function getNextSundayEightPM() {
  const now = new Date();
  const t   = new Date(now);
  const dow = t.getDay();                        // 0=Sun
  t.setDate(t.getDate() + (dow === 0 ? 0 : 7 - dow));
  t.setHours(20, 0, 0, 0);
  if (t <= now) t.setDate(t.getDate() + 7);
  return t.getTime();
}

async function setupDailyAlarms() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const nudgeHour = settings.notifications?.nudgeHour ?? 18;
  const dailyHour = settings.notifications?.dailyHour ?? 22;

  const [nudge, report, midnight, subj] = await Promise.all([
    chrome.alarms.get(NUDGE_ALARM),
    chrome.alarms.get(REPORT_ALARM),
    chrome.alarms.get(MIDNIGHT_ALARM),
    chrome.alarms.get(SUBJECT_BALANCE_ALARM),
  ]);
  if (!nudge)    chrome.alarms.create(NUDGE_ALARM,           { when: getNextOccurrence(nudgeHour) });
  if (!report)   chrome.alarms.create(REPORT_ALARM,          { when: getNextOccurrence(dailyHour) });
  if (!midnight) chrome.alarms.create(MIDNIGHT_ALARM,        { when: getNextOccurrence(0) });
  if (!subj)     chrome.alarms.create(SUBJECT_BALANCE_ALARM, { when: getNextSundayEightPM() });
}

async function savePomodoroState() {
  await chrome.storage.local.set({ pomodoroState: pomoState });
}

async function setPomoEndAlarm(seconds) {
  await chrome.alarms.clear(POMO_END_ALARM);
  if (seconds > 0) {
    chrome.alarms.create(POMO_END_ALARM, { delayInMinutes: seconds / 60 });
  }
}

async function recordBreakHistory(type, taken) {
  const { breakHistory = [] } = await chrome.storage.local.get('breakHistory');
  breakHistory.push({ date: getTodayKey(), type, taken, skipped: !taken, timestamp: Date.now() });
  if (breakHistory.length > 500) breakHistory.splice(0, breakHistory.length - 500);
  await chrome.storage.local.set({ breakHistory });
}

async function checkGoalProgress(settings) {
  if (!settings?.notifications?.goals) return;
  const { sessions = [], goals = {}, dailyGoalNotified = {} } =
    await chrome.storage.local.get(['sessions', 'goals', 'dailyGoalNotified']);
  const today    = getTodayKey();
  const studySecs = sessions
    .filter(s => s.date === today && STUDY_CATS.has(s.category))
    .reduce((a, s) => a + s.duration, 0);
  const goalSecs  = goals.daily || 14400;
  const pct       = (studySecs / goalSecs) * 100;
  const notified  = dailyGoalNotified[today] || { p50: false, p100: false };

  if (pct >= 100 && !notified.p100) {
    notifyGoalProgress(100, studySecs, goalSecs);
    notified.p100 = true;
  } else if (pct >= 50 && !notified.p50) {
    notifyGoalProgress(50, studySecs, goalSecs);
    notified.p50 = true;
  }

  dailyGoalNotified[today] = notified;
  await chrome.storage.local.set({ dailyGoalNotified });
}

// ── Pomodoro actions ──────────────────────────────────────────────────────────

async function startWork() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const workSecs = (settings.pomodoroWork || 25) * 60;
  const today    = getTodayKey();
  const count    = (pomoState.todayDate === today) ? (pomoState.pomodoroCount || 0) : 0;

  pomoState = {
    mode:            'WORK',
    totalSeconds:    workSecs,
    accumulatedSecs: 0,
    startedAt:       Date.now(),
    pomodoroCount:   count,
    snoozeCount:     0,
    breakType:       null,
    todayDate:       today,
  };
  await savePomodoroState();
  await setPomoEndAlarm(workSecs);
}

async function startBreak(count) {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const bt        = getBreakType(count);
  const breakSecs = bt.isLong
    ? (settings.pomodoroLongBreak || 15) * 60
    : (settings.pomodoroBreak || 5) * 60;

  pomoState = {
    ...pomoState,
    mode:            bt.isLong ? 'LONG_BREAK' : 'BREAK',
    totalSeconds:    breakSecs,
    accumulatedSecs: 0,
    startedAt:       Date.now(),
    snoozeCount:     0,
    breakType:       bt,
  };
  await savePomodoroState();
  await setPomoEndAlarm(breakSecs);
}

async function pausePomo() {
  if (!['WORK', 'BREAK', 'LONG_BREAK'].includes(pomoState.mode)) return;
  const elapsed  = Math.floor((Date.now() - (pomoState.startedAt || Date.now())) / 1000);
  const prevMode = pomoState.mode;
  pomoState.accumulatedSecs = (pomoState.accumulatedSecs || 0) + elapsed;
  pomoState.startedAt       = null;
  pomoState.mode            = prevMode === 'WORK' ? 'PAUSED_WORK' : 'PAUSED_BREAK';
  await chrome.alarms.clear(POMO_END_ALARM);
  await savePomodoroState();
}

async function resumePomo() {
  if (!['PAUSED_WORK', 'PAUSED_BREAK'].includes(pomoState.mode)) return;
  const remaining = pomoState.totalSeconds - (pomoState.accumulatedSecs || 0);
  const prevMode  = pomoState.mode;
  pomoState.startedAt = Date.now();
  pomoState.mode      = prevMode === 'PAUSED_WORK'
    ? 'WORK'
    : (pomoState.breakType?.isLong ? 'LONG_BREAK' : 'BREAK');
  await savePomodoroState();
  await setPomoEndAlarm(Math.max(1, remaining));
}

async function resetPomo() {
  await chrome.alarms.clear(POMO_END_ALARM);
  const { settings = {} } = await chrome.storage.local.get('settings');
  const today = getTodayKey();
  const count = (pomoState.todayDate === today) ? (pomoState.pomodoroCount || 0) : 0;
  pomoState = {
    mode:            'IDLE',
    totalSeconds:    (settings.pomodoroWork || 25) * 60,
    accumulatedSecs: 0,
    startedAt:       null,
    pomodoroCount:   count,
    snoozeCount:     0,
    breakType:       null,
    todayDate:       today,
  };
  await savePomodoroState();
}

async function snoozeBreak() {
  if (!['BREAK', 'LONG_BREAK', 'PAUSED_BREAK'].includes(pomoState.mode)) return;
  if ((pomoState.snoozeCount || 0) >= 2) return;
  pomoState.totalSeconds += 120;
  pomoState.snoozeCount   = (pomoState.snoozeCount || 0) + 1;
  // Re-arm the end alarm if currently running
  if (!pomoState.mode.includes('PAUSED') && pomoState.startedAt) {
    const elapsed   = (pomoState.accumulatedSecs || 0) + Math.floor((Date.now() - pomoState.startedAt) / 1000);
    const remaining = Math.max(1, pomoState.totalSeconds - elapsed);
    await setPomoEndAlarm(remaining);
  }
  await savePomodoroState();
}

async function skipBreak() {
  await recordBreakHistory(pomoState.breakType?.type || 'unknown', false);
  await startWork();
}

async function handlePomoEnd() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const mode = pomoState.mode;

  if (mode === 'WORK') {
    const newCount = (pomoState.pomodoroCount || 0) + 1;
    pomoState.pomodoroCount = newCount;
    await savePomodoroState();

    const bt       = getBreakType(newCount);
    const breakMin = bt.isLong ? 15 : (settings.pomodoroBreak || 5);
    if (settings.notifications?.breaks !== false) notifyBreakStart(bt, breakMin, newCount);

    await checkGoalProgress(settings);
    await startBreak(newCount);

  } else if (mode === 'BREAK' || mode === 'LONG_BREAK') {
    await recordBreakHistory(pomoState.breakType?.type || 'unknown', true);
    if (settings.notifications?.breaks !== false) notifyBackToWork();

    const today = getTodayKey();
    const count = pomoState.pomodoroCount || 0;
    pomoState = {
      mode:            'IDLE',
      totalSeconds:    (settings.pomodoroWork || 25) * 60,
      accumulatedSecs: 0,
      startedAt:       null,
      pomodoroCount:   count,
      snoozeCount:     0,
      breakType:       null,
      todayDate:       today,
    };
    await savePomodoroState();
  }
}

// ── Daily alarm handlers ──────────────────────────────────────────────────────

async function handleNudgeAlarm() {
  const { sessions = [], settings = {}, goals = {} } =
    await chrome.storage.local.get(['sessions', 'settings', 'goals']);
  const nudgeHour = settings.notifications?.nudgeHour ?? 18;
  chrome.alarms.create(NUDGE_ALARM, { when: getNextOccurrence(nudgeHour) });
  if (settings.notifications?.nudge === false) return;
  const today     = getTodayKey();
  const studySecs = sessions
    .filter(s => s.date === today && STUDY_CATS.has(s.category))
    .reduce((a, s) => a + s.duration, 0);
  if (studySecs === 0) notifyInactivityNudge(goals.daily || 14400);
}

async function handleReportAlarm() {
  const { sessions = [], settings = {}, goals = {}, streaks = {}, pomodoroState: ps = {} } =
    await chrome.storage.local.get(['sessions', 'settings', 'goals', 'streaks', 'pomodoroState']);
  const dailyHour = settings.notifications?.dailyHour ?? 22;
  chrome.alarms.create(REPORT_ALARM, { when: getNextOccurrence(dailyHour) });
  if (settings.notifications?.daily === false) return;
  const today     = getTodayKey();
  const todaySess = sessions.filter(s => s.date === today);
  const studySecs = todaySess.filter(s => STUDY_CATS.has(s.category)).reduce((a, s) => a + s.duration, 0);
  const goalSecs  = goals.daily || 14400;

  // AI-powered summary if API key is set
  if (settings.geminiApiKey) {
    try {
      const context = buildStudyContext({ sessions, goals, streaks, pomodoroState: ps, today });
      const prompt  = buildPrompt('daily', context);
      const aiText  = await callGemini(prompt, settings.geminiApiKey);
      const isError = !aiText || aiText.startsWith('Please add') || aiText.startsWith('Invalid') ||
                      aiText.startsWith('Rate limit') || aiText.startsWith('Gemini API error') ||
                      aiText.startsWith('Network error') || aiText.startsWith('Unexpected');
      if (!isError) {
        notifyAiSummary(aiText.slice(0, 200));
        return;
      }
    } catch {}
  }
  // Fallback: stats-based notification
  notifyDailyReport(studySecs, todaySess.length, goalSecs, studySecs >= goalSecs);
}

async function handleSubjectBalanceAlarm() {
  chrome.alarms.create(SUBJECT_BALANCE_ALARM, { when: getNextSundayEightPM() });
  const { sessions = [], settings = {} } =
    await chrome.storage.local.get(['sessions', 'settings']);
  if (settings.notifications?.subjectBalance === false) return;
  const subjects = settings.subjects || ['Math', 'Physics', 'DSA', 'Chemistry', 'English'];
  const today    = getTodayKey();
  for (const subj of subjects) {
    const last = sessions
      .filter(s => s.subject === subj)
      .reduce((max, s) => s.date > max ? s.date : max, '');
    if (!last) continue;
    const daysSince = Math.round((new Date(today) - new Date(last)) / 86400000);
    if (daysSince >= 3) notifySubjectBalance(subj, daysSince);
  }
}

async function handleMidnightAlarm() {
  chrome.alarms.create(MIDNIGHT_ALARM, { when: getNextOccurrence(0) });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);

  const { sessions = [], goals = {}, streaks = {} } =
    await chrome.storage.local.get(['sessions', 'goals', 'streaks']);

  if (streaks.lastGoalDate === yKey) return;

  const goalSecs  = goals.daily || 14400;
  const studySecs = sessions
    .filter(s => s.date === yKey && STUDY_CATS.has(s.category))
    .reduce((a, s) => a + s.duration, 0);

  const hitGoal = studySecs >= goalSecs;
  const current = hitGoal ? (streaks.current || 0) + 1 : 0;
  const longest = Math.max(streaks.longest || 0, current);

  await chrome.storage.local.set({
    streaks: { current, longest, lastGoalDate: yKey }
  });
}

// ── Alarm dispatcher ──────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  await ensureState();
  switch (alarm.name) {
    case SAVE_ALARM:
      if (activeSession && !isIdle && isWindowFocused) {
        await flushSession(false);
        await checkDistractionAlert();
      }
      break;
    case POMO_END_ALARM:
      await handlePomoEnd();
      break;
    case NUDGE_ALARM:
      await handleNudgeAlarm();
      break;
    case REPORT_ALARM:
      await handleReportAlarm();
      break;
    case MIDNIGHT_ALARM:
      await handleMidnightAlarm();
      break;
    case SUBJECT_BALANCE_ALARM:
      await handleSubjectBalanceAlarm();
      break;
  }
});

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch(err => sendResponse({ error: err.message }));
  return true;
});

async function handleMessage(message) {
  await ensureState();

  switch (message.type) {

    case 'GET_STATUS':
      return { activeSession, isIdle, isWindowFocused, focusMode, pomodoroState: pomoState };

    case 'TOGGLE_FOCUS':
      focusMode = !focusMode;
      await chrome.storage.local.set({ focusMode });
      broadcastFocusUpdate();
      return { focusMode };

    case 'POMO_START':
      if (pomoState.mode === 'IDLE') await startWork();
      return { pomodoroState: pomoState };

    case 'POMO_PAUSE':
      await pausePomo();
      return { pomodoroState: pomoState };

    case 'POMO_RESUME':
      await resumePomo();
      return { pomodoroState: pomoState };

    case 'POMO_RESET':
      await resetPomo();
      return { pomodoroState: pomoState };

    case 'POMO_SNOOZE':
      await snoozeBreak();
      return { pomodoroState: pomoState };

    case 'POMO_SKIP':
      await skipBreak();
      return { pomodoroState: pomoState };

    case 'CONTENT_CHECK': {
      const url = message.url || '';
      if (!url.startsWith('http')) return { action: 'none' };
      let hostname;
      try { hostname = new URL(url).hostname.replace(/^www\./, ''); }
      catch { return { action: 'none' }; }
      const { settings: cs = {} } = await chrome.storage.local.get('settings');
      const wl = cs.whitelist?.length ? cs.whitelist : DEFAULT_WHITELIST;
      const isWL = wl.some(w => hostname === w || hostname.endsWith('.' + w));
      if (isWL) return { action: 'none' };
      if (!focusMode) return { action: 'none' };
      const category = getCategoryForURL(url);
      if (category !== 'Distraction' && category !== 'Entertainment') return { action: 'none' };
      const blockMode = cs.blockMode || 'gentle';
      if (blockMode === 'off') return { action: 'none' };
      return { action: blockMode, hostname };
    }

    case 'SET_SESSION_SUBJECT':
      if (activeSession) {
        activeSession.subject = message.subject || null;
        await chrome.storage.local.set({ activeSession });
      }
      return { ok: true };

    case 'RESCHEDULE_ALARMS': {
      const { settings: rs = {} } = await chrome.storage.local.get('settings');
      const nudgeHour = rs.notifications?.nudgeHour ?? 18;
      const dailyHour = rs.notifications?.dailyHour ?? 22;
      await chrome.alarms.clear(NUDGE_ALARM);
      await chrome.alarms.clear(REPORT_ALARM);
      chrome.alarms.create(NUDGE_ALARM,  { when: getNextOccurrence(nudgeHour) });
      chrome.alarms.create(REPORT_ALARM, { when: getNextOccurrence(dailyHour) });
      return { ok: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}
