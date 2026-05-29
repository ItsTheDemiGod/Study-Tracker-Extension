// All chrome.notifications helpers for StudyTracker Pro
// Called only from background/background.js — never from popup

const ICON = chrome.runtime.getURL('icons/icon128.png');

export function notifyBreakStart(breakType, durationMin, pomoCount) {
  chrome.notifications.create('break-' + Date.now(), {
    type: 'basic',
    iconUrl: ICON,
    title: `${breakType.emoji} ${breakType.label} — Pomodoro #${pomoCount} done!`,
    message: `Take a ${durationMin}-min break. ${breakType.desc}`,
    priority: 1,
  });
}

export function notifyBackToWork() {
  chrome.notifications.create('back-' + Date.now(), {
    type: 'basic',
    iconUrl: ICON,
    title: '⏰ Break time is over!',
    message: 'Ready to focus? Start your next Pomodoro session.',
    priority: 1,
  });
}

export function notifyGoalProgress(pct, currentSecs, goalSecs) {
  const ch = Math.floor(currentSecs / 3600);
  const cm = Math.floor((currentSecs % 3600) / 60);
  const gh = Math.floor(goalSecs / 3600);
  chrome.notifications.create('goal-' + pct + '-' + Date.now(), {
    type: 'basic',
    iconUrl: ICON,
    title: pct >= 100 ? '🏆 Daily goal reached!' : '🎯 Halfway there!',
    message: `You've studied ${ch}h ${cm}m of your ${gh}h daily goal.`,
    priority: 1,
  });
}

export function notifyInactivityNudge(goalSecs) {
  const gh = (goalSecs / 3600).toFixed(1);
  chrome.notifications.create('nudge-' + Date.now(), {
    type: 'basic',
    iconUrl: ICON,
    title: "📚 You haven't studied yet today!",
    message: `Your daily goal is ${gh}h. Start a Pomodoro session now!`,
    priority: 2,
  });
}

export function notifyAiSummary(text) {
  chrome.notifications.create('ai-summary-' + Date.now(), {
    type:    'basic',
    iconUrl: ICON,
    title:   '✨ Your AI Study Summary',
    message: text,
    priority: 1,
  });
}

export function notifySubjectBalance(subject, daysSince) {
  chrome.notifications.create('subj-balance-' + Date.now(), {
    type:    'basic',
    iconUrl: ICON,
    title:   '⚠️ Subject Neglected',
    message: `You haven't studied ${subject} in ${daysSince} day${daysSince !== 1 ? 's' : ''}. Your weekly goal needs attention!`,
    priority: 1,
  });
}

export function notifyDistractionAlert(hostname, mins) {
  chrome.notifications.create('distract-' + Date.now(), {
    type: 'basic',
    iconUrl: ICON,
    title: '⚠️ Distraction Alert',
    message: `You've been on ${hostname} for ${mins} minute${mins !== 1 ? 's' : ''}. Stay focused!`,
    priority: 2,
  });
}

export function notifyDailyReport(studySecs, sessionCount, goalSecs, goalHit) {
  const h  = Math.floor(studySecs / 3600);
  const m  = Math.floor((studySecs % 3600) / 60);
  const gh = Math.floor(goalSecs / 3600);
  const status = goalHit ? '✅ Goal achieved!' : `❌ Goal missed (${gh}h target)`;
  chrome.notifications.create('report-' + Date.now(), {
    type: 'basic',
    iconUrl: ICON,
    title: "📊 Today's Study Summary",
    message: `Studied ${h}h ${m}m · ${sessionCount} sessions · ${status}`,
    priority: 1,
  });
}
