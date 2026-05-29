Project Status: COMPLETE ✅

Project Name: StudyTracker Pro — Chrome Extension
Description: A Chrome Extension (Manifest V3) that tracks study activity in the browser, categorizes time spent on websites, suggests breaks, blocks distractions, sets goals, and provides AI-powered study insights using the Gemini API. All data is stored 100% locally using chrome.storage.local — no backend, no login required.

Tech Stack:

Manifest V3 Chrome Extension
Vanilla JavaScript (no frameworks)
Chart.js for dashboard visualizations
chrome.storage.local for all data persistence
chrome.alarms API for Pomodoro/break timers
chrome.notifications API for alerts
chrome.idle API for inactivity detection
Gemini API (Phase 6) for AI suggestions — user provides their own key


Permissions (manifest.json):

tabs
storage
alarms
idle
notifications
activeTab
scripting
webNavigation


Project File Structure (current):
study-tracker/
├── CLAUDE.md
├── README.md                          ✅ Phase 7
├── manifest.json                      ✅ Phase 1
├── background/
│   └── background.js                  ✅ Phase 7 (badge, onboarding trigger, alarm rescheduling)
├── popup/
│   ├── popup.html                     ✅ Phase 6 (AI Insights panel)
│   ├── popup.js                       ✅ Phase 7 (accent color support, polish)
│   └── popup.css                      ✅ Phase 7 (pulse animation, final polish)
├── content/
│   └── content.js                     ✅ Phase 5 (gentle overlay, strict block redirect, FOCUS_UPDATE listener)
├── settings/
│   ├── settings.html                  ✅ Phase 7 (all 8 sections complete)
│   ├── settings.js                    ✅ Phase 7 (full settings logic)
│   └── settings.css                   ✅ Phase 7 (full styles)
├── onboarding/
│   ├── onboarding.html                ✅ Phase 7 (4-step wizard)
│   ├── onboarding.js                  ✅ Phase 7
│   └── onboarding.css                 ✅ Phase 7
├── blocked/
│   ├── blocked.html                   ✅ Phase 5 (strict block standalone page)
│   ├── blocked.js                     ✅ Phase 5
│   └── blocked.css                    ✅ Phase 5
├── utils/
│   ├── categorizer.js                 ✅ Phase 1
│   ├── storage.js                     ✅ Phase 7 (Phase 7 schema fields, export functions)
│   ├── notifications.js               ✅ Phase 6 (notifyAiSummary, notifySubjectBalance)
│   ├── subjects.js                    ✅ Phase 4 (DEFAULT_SUBJECTS, autoSuggestSubject, getSubjectStats)
│   └── gemini.js                      ✅ Phase 6 (callGemini, buildStudyContext, buildPrompt)
├── icons/
│   ├── icon16.png                     ✅ Phase 1
│   ├── icon48.png                     ✅ Phase 1
│   └── icon128.png                    ✅ Phase 1
└── libs/
    └── chart.min.js                   ✅ Phase 2 (196KB, local, no CDN)

All 11 Features:

Time Tracking — Tracks active time per website. Pauses on idle (2 min threshold), tab switch, or window minimize. Session-based with start/end timestamps.
Smart Site Categorization — Auto-tags sites into: Study, Video Learning, Coding, Distraction, Research, Communication, Entertainment. User can reassign any site manually. ~50 sites hardcoded, unknown sites auto-categorized by URL pattern.
Pomodoro & Break System — Customizable Pomodoro (default 25 min study / 5 min break). Break types: eye rest, walk, hydration, breathing. Uses chrome.alarms. Snooze/skip options. Tracks if breaks were taken.
Goals & Targets — Daily study goal (e.g., 4 hours). Subject-specific goals. Weekly goals. Progress bar. Streak counter (consecutive days goal was hit). Notifications at 50% and 100% of goal.
Dashboard & Analytics — Today view: total time, pie chart by category, bar chart top 5 sites. Weekly view: heatmap, best/worst day, averages. Session history list. Dark/Light mode toggle.
Distraction Alerts & Blocking — Alert after X mins on distraction site (configurable). Gentle mode: full-page reminder with countdown. Strict mode: hard block during focus sessions. Whitelist manager. Daily distraction score 0–100.
AI Suggestions (Gemini API) — Weekly pattern analysis. Best study time detection. Subject balance alerts. Smart schedule suggestions. End-of-day AI summary. User provides own Gemini API key in settings.
Subject Tagging — Manually tag sessions with a subject (Math, DSA, Physics, etc.). Auto-suggest from URL/page title. Time breakdown per subject across days/weeks.
Smart Notifications — Break reminders. Goal progress alerts. Daily report at user-set time. Inactivity nudge. All toggleable individually in settings.
Data & Privacy — 100% local via chrome.storage.local. Export as CSV or JSON. Clear history (per day / all time). No account, no server, no telemetry.
Settings & Customization — Dark/light mode. Accent color picker (5 presets). Custom Pomodoro durations. Notification toggles + time pickers. Daily/weekly goal setter. Subject list manager. Site category manager. Gemini API key input. Onboarding flow for first-time users.


Build Phases:

Phase 1 — Foundation & Core Tracking [x]

manifest.json with all permissions
background.js: active tab tracking, idle detection, tab switch handling
chrome.storage data schema
Basic site categorization (~50 sites)
Minimal popup showing current site + time tracked
Status: COMPLETE


Phase 2 — Dashboard & Analytics UI [x]

Full popup dashboard UI
Pie chart (category breakdown) via Chart.js
Bar chart (top 5 sites)
Session history list
Weekly heatmap
Dark/Light mode toggle
Status: COMPLETE


Phase 3 — Pomodoro, Breaks & Notifications [x]

Pomodoro timer with chrome.alarms
Break type suggestions
chrome.notifications for alerts
Snooze/skip logic
Inactivity nudge
Status: COMPLETE


Phase 4 — Goals, Streaks & Subject Tagging [x]

Daily + subject-specific goals
Progress bar + streak counter
Subject tagging UI
Auto-suggest subject from URL
Status: COMPLETE


Phase 5 — Distraction Blocking & Alerts [x]

Distraction threshold alerts
Gentle + strict block modes
content.js blocker page injection
Whitelist manager
Distraction score
Status: COMPLETE


Phase 6 — AI Suggestions (Gemini API) [x]

Gemini API integration
Pattern analysis + personalized tips
Subject balance alerts
Schedule builder
End-of-day AI summary
Status: COMPLETE


Phase 7 — Settings, Export & Polish [x]

Full settings panel (8 sections)
CSV + JSON export
Clear history options
Onboarding flow (4-step wizard)
Extension badge (today's hours + goal color)
Accent color picker (5 presets)
Configurable notification times
Site category manager
Final UI polish (pulse animation, accent colors)
README.md
Status: COMPLETE




Data Schema (chrome.storage.local):
json{
  "sessions": [],
  "dailyStats": {},
  "goals": { "daily": 14400, "weekly": 72000, "subjects": {} },
  "streaks": { "current": 0, "longest": 0, "lastGoalDate": "" },
  "settings": {
    "pomodoroWork": 25,
    "pomodoroBreak": 5,
    "pomodoroLongBreak": 15,
    "pomodoroLongBreakInterval": 4,
    "distractionThreshold": 10,
    "darkMode": false,
    "accentColor": "indigo",
    "geminiApiKey": "",
    "onboardingComplete": false,
    "notifications": {
      "breaks": true, "goals": true, "daily": true, "nudge": true,
      "subjectBalance": true, "dailyHour": 22, "nudgeHour": 18
    },
    "blockMode": "gentle",
    "whitelist": ["google.com", "gmail.com", "meet.google.com", "zoom.us", "classroom.google.com"],
    "subjects": ["Math", "Physics", "DSA", "Chemistry", "English"]
  },
  "customCategories": {},
  "pomodoroState": {
    "mode": "IDLE",
    "totalSeconds": 1500,
    "accumulatedSecs": 0,
    "startedAt": null,
    "pomodoroCount": 0,
    "snoozeCount": 0,
    "breakType": null,
    "todayDate": ""
  },
  "breakHistory": [],
  "dailyGoalNotified": {},
  "aiInsights": {
    "weekly":   { "text": "...", "ts": 1234567890000 },
    "subject":  { "text": "...", "ts": 1234567890000 },
    "schedule": { "text": "...", "ts": 1234567890000 },
    "daily":    { "text": "...", "ts": 1234567890000 }
  },
  "sessions": [{ "...", "subject": "Math|null" }]
}

Known Limitations:

pomodoroLongBreakInterval setting is stored but does not change the break rotation cycle (breaks still follow eye-rest → hydration → breathing → walk pattern every 4 pomodoros).
The popup max-height is 580px; on very short screens some sections may require scrolling.
Badge text is capped at 4 characters — very long hour values (e.g. "10.5h") are truncated to "10.5".
Accent color does not apply to the settings page live (requires reopening after saving).
chrome.storage.local has a 10MB quota; the sessions cap of 1000 entries prevents overflow.

Important Rules for Claude Code:

After EVERY phase completion, update the corresponding phase status in CLAUDE.md from NOT STARTED → IN PROGRESS → COMPLETE
After adding any new file, update the File Structure section in CLAUDE.md
After any change to the data schema, update the Data Schema section in CLAUDE.md
Never delete CLAUDE.md
Keep CLAUDE.md as the single source of truth at all times
