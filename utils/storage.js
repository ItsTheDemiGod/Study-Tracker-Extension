const DEFAULT_SCHEMA = {
  sessions: [],
  dailyStats: {},
  goals: { daily: 14400, weekly: 72000, subjects: {} },
  streaks: { current: 0, longest: 0, lastGoalDate: '' },
  settings: {
    pomodoroWork:              25,
    pomodoroBreak:             5,
    pomodoroLongBreak:         15,
    pomodoroLongBreakInterval: 4,
    distractionThreshold:      10,
    darkMode:                  false,
    accentColor:               'indigo',
    geminiApiKey:              '',
    onboardingComplete:        false,
    notifications: {
      breaks:          true,
      goals:           true,
      daily:           true,
      nudge:           true,
      subjectBalance:  true,
      dailyHour:       22,
      nudgeHour:       18,
    },
    blockMode: 'gentle',
    whitelist: ['google.com', 'gmail.com', 'meet.google.com', 'zoom.us', 'classroom.google.com'],
    subjects:  ['Math', 'Physics', 'DSA', 'Chemistry', 'English'],
  },
  customCategories: {},
  pomodoroState: {
    mode:            'IDLE',
    totalSeconds:    1500,
    accumulatedSecs: 0,
    startedAt:       null,
    pomodoroCount:   0,
    snoozeCount:     0,
    breakType:       null,
    todayDate:       '',
  },
  breakHistory:      [],
  dailyGoalNotified: {},
  aiInsights:        {},
};

export async function initStorage() {
  const existing = await chrome.storage.local.get(null);
  const updates  = {};

  for (const [key, val] of Object.entries(DEFAULT_SCHEMA)) {
    if (!(key in existing)) updates[key] = val;
  }

  // Migrate goals.weekly for users upgrading from Phase 3
  if (existing.goals && existing.goals.weekly === undefined) {
    updates.goals = { ...existing.goals, weekly: 72000 };
  }

  // Deep-merge settings — fill in any missing Phase 7 fields for existing users
  if (existing.settings) {
    const def    = DEFAULT_SCHEMA.settings;
    const cur    = existing.settings;
    const merged = { ...def, ...cur };
    // Deep-merge notifications sub-object
    merged.notifications = { ...def.notifications, ...(cur.notifications || {}) };
    if (JSON.stringify(merged) !== JSON.stringify(cur)) {
      updates.settings = merged;
    }
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
}

export function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function getTodayStats() {
  const today = getTodayKey();
  const data  = await chrome.storage.local.get(['dailyStats', 'sessions']);
  const sites    = (data.dailyStats || {})[today] || {};
  const sessions = (data.sessions  || []).filter(s => s.date === today);
  return { sites, sessions, date: today };
}

export async function saveSession(session) {
  const data     = await chrome.storage.local.get('sessions');
  const sessions = data.sessions || [];
  sessions.push(session);
  if (sessions.length > 1000) sessions.splice(0, sessions.length - 1000);
  await chrome.storage.local.set({ sessions });
}

export async function updateDailyTime(hostname, seconds, date) {
  const key        = date || getTodayKey();
  const data       = await chrome.storage.local.get('dailyStats');
  const dailyStats = data.dailyStats || {};
  if (!dailyStats[key]) dailyStats[key] = {};
  dailyStats[key][hostname] = (dailyStats[key][hostname] || 0) + seconds;
  await chrome.storage.local.set({ dailyStats });
}

export async function getWeeklyStats() {
  const data       = await chrome.storage.local.get('dailyStats');
  const dailyStats = data.dailyStats || {};
  const result     = [];
  for (let i = 6; i >= 0; i--) {
    const d   = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, sites: dailyStats[key] || {} });
  }
  return result;
}

export async function exportAsJSON() {
  const data = await chrome.storage.local.get(null);
  return JSON.stringify(data, null, 2);
}

export async function exportAsCSV() {
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
  return [headers.join(','), ...rows].join('\n');
}
