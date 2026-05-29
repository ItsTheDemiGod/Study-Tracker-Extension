# 📚 StudyTracker Pro

> A powerful Chrome Extension that tracks your study habits, blocks distractions, and delivers AI-powered insights — all without ever leaving your browser.

![Version](https://img.shields.io/badge/version-1.0.0-indigo?style=flat-square)
![Manifest](https://img.shields.io/badge/Manifest-V3-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Privacy](https://img.shields.io/badge/data-100%25%20local-orange?style=flat-square)

---

## ✨ Features

### ⏱️ Smart Time Tracking
- Tracks **active time** per website — pauses automatically when you go idle, switch windows, or step away
- Idle detection with a 2-minute threshold using the `chrome.idle` API
- Session-based tracking with start/end timestamps saved locally

### 🏷️ Automatic Site Categorization
- 80+ websites pre-mapped into 7 categories: **Study, Video Learning, Coding, Research, Communication, Distraction, Entertainment**
- Keyword-pattern fallback for unknown URLs (e.g. URLs containing "learn", "course", "edu")
- Fully customizable — reassign any site to any category from Settings

### 🍅 Pomodoro & Break System
- Customizable Pomodoro timer (default: 25 min work / 5 min break)
- Rotating break types: 👀 Eye Rest → 💧 Hydration → 🧘 Breathing → 🚶 Walk
- After 4 Pomodoros, automatically suggests a 15-min long break
- Snooze (+2 min) and Skip options per break
- All timing powered by `chrome.alarms` — survives service worker restarts

### 🎯 Goals & Streaks
- Set a **daily study goal** and **subject-specific goals**
- Weekly goal tracking with progress bars
- 🔥 Streak counter — tracks consecutive days your goal was hit
- Notifications at 50% and 100% goal completion

### 📊 Dashboard & Analytics
- **Today view:** total study time, distraction time, productive percentage
- **Pie chart** — time breakdown by category
- **Bar chart** — top 5 most-visited sites today
- **Weekly heatmap** — 7-day study intensity grid
- **Session history** — last 5 sessions with domain, category, and duration
- Dark / Light mode toggle with persistent preference

### 🚨 Distraction Blocking
- **Gentle mode** — full-page overlay with a 10-second countdown before access
- **Strict mode** — hard block with no bypass during active Focus Sessions
- Customizable alert threshold (default: 10 min on distraction site)
- Whitelist manager — sites that are never blocked (Google Meet, Zoom, etc.)
- Daily **Distraction Score** (0–100) shown as a color-coded badge

### 🤖 AI-Powered Insights (Gemini API)
- **Weekly Analysis** — identifies productive days, trends, and patterns
- **Subject Balance** — flags neglected subjects and suggests redistribution
- **Smart Schedule** — generates an optimal study timetable for tomorrow
- **Daily Summary** — end-of-day recap with encouragement
- Responses cached for 1 hour to avoid unnecessary API calls
- Requires your own Gemini API key (free at [aistudio.google.com](https://aistudio.google.com/app/apikey))

### 📋 Subject Tagging
- Auto-suggests subject based on the site you're on (LeetCode → DSA, etc.)
- Manual override via dropdown in the popup
- Time breakdown per subject — today, this week, all-time

### 🔔 Smart Notifications
- Break reminders, goal progress alerts, inactivity nudges
- Daily report at a configurable time (default: 10 PM)
- Subject balance alerts if a subject is neglected for 3+ days
- All notifications individually toggleable in Settings

### 🗂️ Data & Privacy
- **100% local storage** via `chrome.storage.local` — no servers, no accounts, no telemetry
- Export your data as **JSON** or **CSV**
- Clear history by day, week, or all-time
- Storage usage indicator in Settings

### ⚙️ Full Settings Panel
- Pomodoro durations, goal targets, notification preferences
- Block mode & whitelist management
- Custom site category overrides
- Accent color themes (Indigo, Teal, Rose, Amber, Emerald)
- Gemini API key manager with live test button

---

## 🚀 Installation

Since this extension is not yet on the Chrome Web Store, install it manually via Developer Mode:

1. Download or clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/study-tracker-pro.git
   ```

2. Open Chrome and go to:
   ```
   chrome://extensions
   ```

3. Enable **Developer Mode** (toggle in the top-right corner)

4. Click **"Load Unpacked"**

5. Select the `study-tracker` folder from the cloned repository

6. The extension icon will appear in your Chrome toolbar — pin it for easy access

---

## 🤖 Setting Up AI Insights (Optional)

StudyTracker Pro uses the **Gemini API** for AI-powered study insights. This is completely optional — all other features work without it.

1. Get a free API key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click the extension icon → open **Settings**
3. Scroll to the **AI Insights** section
4. Paste your API key and click **Save**
5. Use the **Test** button to verify it works
6. Go to the popup → **AI Insights tab** → click **Get Insights**

> Your API key is stored only in `chrome.storage.local` on your device. It is never sent anywhere except directly to the Gemini API.

---

## 🗂️ File Structure

```
study-tracker/
├── manifest.json               # MV3 config, permissions, entry points
├── README.md
├                  │
├── background/
│   └── background.js           # Service worker: tracking, alarms, Pomodoro state machine
│
├── popup/
│   ├── popup.html              # Main extension UI
│   ├── popup.js                # Dashboard logic, charts, AI panel
│   └── popup.css               # Styles, dark/light themes, animations
│
├── content/
│   └── content.js              # Injected into pages for distraction blocking
│
├── settings/
│   ├── settings.html           # Full settings page (8 sections)
│   ├── settings.js             # Settings logic and storage sync
│   └── settings.css            # Settings page styles
│
├── blocked/
│   ├── blocked.html            # Standalone strict-block page
│   ├── blocked.js
│   └── blocked.css
│
├── onboarding/
│   ├── onboarding.html         # First-install 4-step wizard
│   ├── onboarding.js
│   └── onboarding.css
│
├── utils/
│   ├── storage.js              # Storage schema, helpers, export functions
│   ├── categorizer.js          # 80+ site category map + URL pattern fallback
│   ├── subjects.js             # Subject list, auto-suggest, subject stats
│   ├── notifications.js        # All chrome.notifications helpers
│   └── gemini.js               # Gemini API integration + prompt builder
│
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
└── libs/
    └── chart.min.js            # Chart.js 4.4.1 (local, no CDN)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Extension Standard | Chrome Manifest V3 |
| Language | Vanilla JavaScript (ES Modules) |
| Charts | Chart.js 4.4.1 (local) |
| Storage | chrome.storage.local |
| Timers | chrome.alarms API |
| Notifications | chrome.notifications API |
| Idle Detection | chrome.idle API |
| AI | Google Gemini API (gemini-2.0-flash) |
| Styling | Custom CSS with CSS variables |

---

## 🔒 Privacy

- **No account required.** No sign-in, no registration.
- **No external servers.** All data stays on your device in `chrome.storage.local`.
- **No telemetry.** Nothing is tracked, logged, or reported anywhere.
- **No third-party scripts.** Chart.js is bundled locally — no CDN calls.
- The only outbound network request is to the **Gemini API**, only when you explicitly click "Get Insights", and only if you have added your own API key.

---

## 📸 Screenshots

> Coming soon — load the extension and explore!

---

## 🗺️ Roadmap

- [ ] Chrome Web Store publication
- [ ] Firefox / Edge support
- [ ] Google Calendar integration for scheduled study blocks
- [ ] Export to PDF study reports
- [ ] Cloud sync (optional, opt-in)
- [ ] Mobile companion app

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙌 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

<p align="center">Built with ☕ and a desire to actually focus for once.</p>
