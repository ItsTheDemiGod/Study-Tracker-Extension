// Gemini API helper — imported by background/background.js (ES module service worker)

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ── Core API call ─────────────────────────────────────────────────────────────

export async function callGemini(prompt, apiKey) {
  if (!apiKey || !apiKey.trim()) {
    return 'Please add your Gemini API key in Settings to unlock AI insights.';
  }
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey.trim()}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try { const e = await res.json(); errMsg = e?.error?.message || errMsg; } catch {}
      if (res.status === 401 || res.status === 403)
        return 'Invalid API key. Please check your key in Settings.';
      if (res.status === 429)
        return 'Rate limit reached. Please wait a moment and try again.';
      return `Gemini API error: ${errMsg}`;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || 'No content in Gemini response. Please try again.';
  } catch (err) {
    if (err instanceof TypeError)
      return 'Network error: Could not reach Gemini. Check your internet connection.';
    return `Unexpected error: ${err.message}`;
  }
}

// ── Context builder (takes raw storage data) ──────────────────────────────────

export function buildStudyContext({ sessions = [], goals = {}, streaks = {}, pomodoroState = {}, today }) {
  const todayKey = today || new Date().toISOString().slice(0, 10);

  const STUDY_CATS    = new Set(['Study', 'Video Learning', 'Coding', 'Research']);
  const DISTRACT_CATS = new Set(['Distraction', 'Entertainment']);
  const fmt = s => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h > 0 ? `${h}h ${m}m` : `${m}m`; };

  // Today
  const todaySess  = sessions.filter(s => s.date === todayKey);
  const studyToday = todaySess.filter(s => STUDY_CATS.has(s.category)).reduce((a,s) => a+s.duration, 0);
  const distToday  = todaySess.filter(s => DISTRACT_CATS.has(s.category)).reduce((a,s) => a+s.duration, 0);

  // Week (Mon–Sun)
  const now = new Date();
  const daysSinceMon = (now.getDay() + 6) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysSinceMon);
  const weekStartKey = weekStart.toISOString().slice(0, 10);

  const weekLines = [];
  let goalDaysHit = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key   = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const secs  = sessions.filter(s => s.date === key && STUDY_CATS.has(s.category)).reduce((a,s)=>a+s.duration,0);
    const hit   = secs >= (goals.daily || 14400);
    if (hit) goalDaysHit++;
    weekLines.push(`  ${label}: ${fmt(secs)} ${hit ? '✓' : '✗'}`);
  }

  // Subjects this week
  const subjMap = {};
  sessions.filter(s => s.date >= weekStartKey && s.subject).forEach(s => {
    subjMap[s.subject] = (subjMap[s.subject] || 0) + s.duration;
  });
  const subjLines = Object.entries(subjMap).sort((a,b)=>b[1]-a[1]).map(([s,t])=>`${s}: ${fmt(t)}`);

  // Top sites
  const studySites = {}, distrSites = {};
  sessions.filter(s => s.date >= weekStartKey).forEach(s => {
    if (STUDY_CATS.has(s.category))    studySites[s.hostname] = (studySites[s.hostname] || 0) + s.duration;
    if (DISTRACT_CATS.has(s.category)) distrSites[s.hostname] = (distrSites[s.hostname] || 0) + s.duration;
  });
  const topStudy = Object.entries(studySites).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([h,t])=>`${h} (${fmt(t)})`);
  const topDistr = Object.entries(distrSites).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([h,t])=>`${h} (${fmt(t)})`);

  return [
    `=== Today (${todayKey}) ===`,
    `Study: ${fmt(studyToday)} | Distraction: ${fmt(distToday)}`,
    `Daily goal: ${fmt(goals.daily || 14400)} | Hit today: ${studyToday >= (goals.daily||14400) ? 'Yes' : 'No'}`,
    `Pomodoros today: ${pomodoroState.pomodoroCount || 0}`,
    `Streak: ${streaks.current || 0} days (best: ${streaks.longest || 0})`,
    ``,
    `=== This Week (Mon–Sun) ===`,
    ...weekLines,
    `Goal achieved: ${goalDaysHit}/7 days`,
    ``,
    `=== Subject Breakdown (this week) ===`,
    subjLines.length ? subjLines.join(', ') : 'No subject data yet',
    ``,
    `=== Top Sites (this week) ===`,
    `Study: ${topStudy.join(', ') || 'none'}`,
    `Distraction: ${topDistr.join(', ') || 'none'}`,
  ].join('\n');
}

// ── Prompt templates ──────────────────────────────────────────────────────────

export function buildPrompt(type, context) {
  switch (type) {
    case 'weekly':
      return `You are a study coach. Based on this student's study data for the past week:\n\n${context}\n\nAnalyze their study patterns. Identify their most productive days and times. Point out any concerning trends. Be specific, encouraging, and actionable. Keep it under 150 words.`;
    case 'subject':
      return `You are a study coach. Based on this student's subject time distribution:\n\n${context}\n\nTell them if their subject balance looks healthy or if they are neglecting any subjects. Suggest how to redistribute their time if needed. Be specific and keep it under 100 words.`;
    case 'schedule':
      return `You are a study coach. Based on this student's study patterns:\n\n${context}\n\nSuggest an optimal daily study schedule for tomorrow. Include specific time blocks for each subject. Consider their historical productive hours. Format as a simple schedule list. Keep it under 150 words.`;
    case 'daily':
    default:
      return `You are a study coach. Summarize today's study session for this student:\n\n${context}\n\nInclude what went well, what needs improvement, and one motivational message. Keep it under 100 words and end with an encouraging note.`;
  }
}
