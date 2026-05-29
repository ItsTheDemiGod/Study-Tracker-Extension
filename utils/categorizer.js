const SITE_CATEGORIES = {
  // Study
  'khanacademy.org':        'Study',
  'coursera.org':           'Study',
  'udemy.com':              'Study',
  'edx.org':                'Study',
  'brilliant.org':          'Study',
  'duolingo.com':           'Study',
  'quizlet.com':            'Study',
  'chegg.com':              'Study',
  'wolframalpha.com':       'Study',
  'scholar.google.com':     'Study',
  'researchgate.net':       'Study',
  'academia.edu':           'Study',
  'jstor.org':              'Study',
  'mathway.com':            'Study',
  'symbolab.com':           'Study',
  'desmos.com':             'Study',
  'codecademy.com':         'Study',
  'freecodecamp.org':       'Study',
  'theodinproject.com':     'Study',
  'coursehero.com':         'Study',
  'sparknotes.com':         'Study',
  'cliffsnotes.com':        'Study',

  // Video Learning
  'youtube.com':            'Video Learning',
  'skillshare.com':         'Video Learning',
  'linkedin.com':           'Video Learning',
  'pluralsight.com':        'Video Learning',
  'masterclass.com':        'Video Learning',
  'udacity.com':            'Video Learning',
  'curiositystream.com':    'Video Learning',
  'nebula.tv':              'Video Learning',
  'brilliant.org/courses':  'Video Learning',

  // Coding
  'github.com':             'Coding',
  'stackoverflow.com':      'Coding',
  'leetcode.com':           'Coding',
  'codepen.io':             'Coding',
  'replit.com':             'Coding',
  'hackerrank.com':         'Coding',
  'codeforces.com':         'Coding',
  'codesandbox.io':         'Coding',
  'gitlab.com':             'Coding',
  'bitbucket.org':          'Coding',
  'developer.mozilla.org':  'Coding',
  'w3schools.com':          'Coding',
  'devdocs.io':             'Coding',
  'npmjs.com':              'Coding',
  'docs.python.org':        'Coding',
  'regex101.com':           'Coding',
  'codewars.com':           'Coding',
  'atcoder.jp':             'Coding',
  'geeksforgeeks.org':      'Coding',
  'jsfiddle.net':           'Coding',

  // Distraction
  'facebook.com':           'Distraction',
  'instagram.com':          'Distraction',
  'twitter.com':            'Distraction',
  'x.com':                  'Distraction',
  'tiktok.com':             'Distraction',
  '9gag.com':               'Distraction',
  'buzzfeed.com':           'Distraction',
  'tumblr.com':             'Distraction',
  'snapchat.com':           'Distraction',
  'reddit.com':             'Distraction',
  'pinterest.com':          'Distraction',
  'vk.com':                 'Distraction',

  // Research
  'wikipedia.org':          'Research',
  'google.com':             'Research',
  'bing.com':               'Research',
  'duckduckgo.com':         'Research',
  'arxiv.org':              'Research',
  'springer.com':           'Research',
  'ieee.org':               'Research',
  'sciencedirect.com':      'Research',
  'nature.com':             'Research',
  'semanticscholar.org':    'Research',
  'ncbi.nlm.nih.gov':       'Research',
  'britannica.com':         'Research',

  // Communication
  'mail.google.com':        'Communication',
  'gmail.com':              'Communication',
  'outlook.com':            'Communication',
  'slack.com':              'Communication',
  'discord.com':            'Communication',
  'telegram.org':           'Communication',
  'whatsapp.com':           'Communication',
  'zoom.us':                'Communication',
  'meet.google.com':        'Communication',
  'teams.microsoft.com':    'Communication',
  'notion.so':              'Communication',

  // Entertainment
  'netflix.com':            'Entertainment',
  'spotify.com':            'Entertainment',
  'twitch.tv':              'Entertainment',
  'hulu.com':               'Entertainment',
  'disneyplus.com':         'Entertainment',
  'primevideo.com':         'Entertainment',
  'soundcloud.com':         'Entertainment',
  'crunchyroll.com':        'Entertainment',
  'steamcommunity.com':     'Entertainment',
  'epicgames.com':          'Entertainment',
  'chess.com':              'Entertainment',
  'imdb.com':               'Entertainment',
};

// Fallback: classify unknown sites by URL keyword patterns
const PATTERN_RULES = [
  { keywords: ['learn', 'course', 'edu', 'tutorial', 'academy', 'school', 'study', 'lecture', 'lesson'], category: 'Study' },
  { keywords: ['code', 'coding', 'developer', 'docs', 'api', 'github', 'stackoverflow', 'programming'], category: 'Coding' },
  { keywords: ['mail', 'inbox', 'email', 'chat', 'message', 'meet', 'collab', 'slack', 'teams'], category: 'Communication' },
  { keywords: ['wiki', 'research', 'journal', 'paper', 'science', 'scholar', 'arxiv', 'pubmed'], category: 'Research' },
  { keywords: ['watch', 'stream', 'video', 'movie', 'music', 'game', 'play', 'tv', 'anime'], category: 'Entertainment' },
];

export function getCategoryForURL(url) {
  if (!url) return 'Uncategorized';

  let hostname = '';
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'Uncategorized';
  }

  // Exact hostname match
  if (SITE_CATEGORIES[hostname]) return SITE_CATEGORIES[hostname];

  // Subdomain match — walk up the domain parts
  // e.g. "ocw.mit.edu" → try "mit.edu", "edu" (skipping TLD-only)
  const parts = hostname.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (SITE_CATEGORIES[parent]) return SITE_CATEGORIES[parent];
  }

  // Keyword pattern fallback on the full URL
  const lower = url.toLowerCase();
  for (const rule of PATTERN_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) return rule.category;
  }

  return 'Uncategorized';
}
