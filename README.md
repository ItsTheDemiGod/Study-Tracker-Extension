# StudyTracker Pro

A feature-rich Chrome Extension for tracking study time, blocking distractions, and getting AI-powered study insights — all 100% locally, no account required.

## Features

1. **Time Tracking** — Automatically tracks active time per website. Pauses on idle (2 min), tab switch, or window minimize.
2. **Smart Site Categorization** — Auto-tags sites into Study, Video Learning, Coding, Distraction, Research, Communication, and Entertainment. Fully customizable.
3. **Pomodoro Timer** — Customizable work/break durations with break type suggestions (eye rest, hydration, breathing, walk). Snooze and skip controls.
4. **Goals & Streaks** — Daily and weekly study goals with progress bars. Subject-specific goals. Streak counter for consecutive goal days.
5. **Dashboard & Analytics** — Today view with pie chart and bar chart. Weekly heatmap. Session history list. Dark/Light mode.
6. **Distraction Blocking** — Three modes: Off, Gentle (10s overlay), Strict (hard block). Configurable alert threshold. Whitelist manager.
7. **AI Insights (Gemini)** — Weekly pattern analysis, subject balance alerts, smart schedule suggestions, and end-of-day summaries. Bring your own free Gemini API key.
8. **Subject Tagging** — Tag sessions with subjects (Math, DSA, Physics, etc.). Auto-suggest from URL/page title. Time breakdown per subject.
9. **Smart Notifications** — Break reminders, goal progress alerts, daily report, inactivity nudge, subject balance alerts. All individually toggleable.
10. **Data Export** — Export all data as JSON or sessions as CSV. Clear today's data or all history.
11. **Settings & Onboarding** — Guided 4-step onboarding. Full settings panel with Pomodoro, goals, notifications, blocking, categories, AI, and appearance.

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the `study-tracker` folder
5. The 📚 extension icon appears in your Chrome toolbar
6. Click it to open the popup — a short onboarding wizard will guide you through setup

## Getting a Gemini API Key (for AI features)

1. Visit [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API Key**
4. Copy the key and paste it in **Settings → AI Insights**
5. Your key is stored locally and never sent anywhere except the Gemini API

## File Structure

```
study-tracker/
├── manifest.json              MV3 manifest with all permissions
├── background/
│   └── background.js          Service worker: tracking, alarms, Pomodoro, notifications
├── popup/
│   ├── popup.html             Main dashboard
│   ├── popup.js               Dashboard logic, charts, AI panel
│   └── popup.css              Dark/light theme, all UI styles
├── content/
│   └── content.js             Distraction overlay + strict block redirect
├── settings/
│   ├── settings.html          Full settings page (8 sections)
│   ├── settings.js            Settings logic
│   └── settings.css           Settings styles
├── onboarding/
│   ├── onboarding.html        4-step first-run wizard
│   ├── onboarding.js          Wizard logic
│   └── onboarding.css         Wizard styles
├── blocked/
│   ├── blocked.html           Strict block page
│   ├── blocked.js
│   └── blocked.css
├── utils/
│   ├── categorizer.js         Site category lookup (~50 sites + pattern matching)
│   ├── storage.js             Storage schema, helpers, export functions
│   ├── notifications.js       chrome.notifications helpers
│   ├── subjects.js            Subject auto-suggest + stats
│   └── gemini.js              Gemini API client + prompt builders
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── libs/
    └── chart.min.js           Chart.js (local, no CDN)
```

## Tech Stack

- **Manifest V3** Chrome Extension
- **Vanilla JavaScript** (no frameworks)
- **Chart.js** for dashboard visualizations
- **chrome.storage.local** for all data persistence
- **chrome.alarms** for Pomodoro/break/daily report timers
- **chrome.notifications** for alerts
- **chrome.idle** for inactivity detection
- **Gemini API** for AI insights (user provides their own key)

## Privacy

All data is stored **100% locally** using `chrome.storage.local`. No data is ever sent to any server. The only external network call is to Google's Gemini API when you click "Get Insights" — and only if you have provided your own API key. No analytics, no telemetry, no account required.
