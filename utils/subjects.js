export const DEFAULT_SUBJECTS = ['Math', 'Physics', 'DSA', 'Chemistry', 'English'];

const SITE_MAP = [
  { keys: ['khanacademy', 'mathway', 'desmos', 'wolframalpha', 'brilliant'],
    subject: 'Math' },
  { keys: ['physicsclassroom', 'hyperphysics', 'feynmanlectures'],
    subject: 'Physics' },
  { keys: ['leetcode', 'codeforces', 'hackerrank', 'geeksforgeeks', 'visualgo',
            'cp-algorithms', 'atcoder', 'codechef'],
    subject: 'DSA' },
  { keys: ['github', 'stackoverflow', 'developer.mozilla', 'mdn', 'devdocs',
            'npmjs', 'w3schools', 'css-tricks'],
    subject: 'Coding' },
  { keys: ['coursera', 'udemy', 'edx', 'udacity', 'pluralsight', 'skillshare'],
    subject: 'Video Learning' },
];

const TITLE_MAP = [
  { words: ['math', 'calculus', 'algebra', 'geometry', 'trigonometry',
            'statistics', 'integral', 'derivative'],
    subject: 'Math' },
  { words: ['physics', 'mechanics', 'thermodynamics', 'quantum',
            'electromagnetism', 'kinematics', 'optics'],
    subject: 'Physics' },
  { words: ['algorithm', 'data structure', 'dynamic programming',
            'graph theory', 'binary tree', 'sorting', 'recursion'],
    subject: 'DSA' },
  { words: ['chemistry', 'organic', 'molecular', 'periodic table',
            'titration', 'electrochemistry', 'stoichiometry'],
    subject: 'Chemistry' },
  { words: ['english', 'grammar', 'vocabulary', 'essay',
            'comprehension', 'literature', 'reading'],
    subject: 'English' },
];

export function autoSuggestSubject(url, title = '') {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    for (const { keys, subject } of SITE_MAP) {
      if (keys.some(k => host.includes(k))) return subject;
    }
  } catch {}
  const t = (title || '').toLowerCase();
  for (const { words, subject } of TITLE_MAP) {
    if (words.some(w => t.includes(w))) return subject;
  }
  return null;
}

export async function getSubjectStats(dateRange = null) {
  const { sessions = [], settings = {} } =
    await chrome.storage.local.get(['sessions', 'settings']);
  const subjects = settings.subjects || DEFAULT_SUBJECTS;
  const stats    = Object.fromEntries(subjects.map(s => [s, 0]));
  const today    = new Date().toISOString().slice(0, 10);
  const list     = dateRange
    ? sessions.filter(s => s.date >= dateRange.start && s.date <= dateRange.end)
    : sessions.filter(s => s.date === today);
  for (const s of list) {
    if (s.subject) stats[s.subject] = (stats[s.subject] || 0) + s.duration;
  }
  return stats;
}
