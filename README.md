# 🎰 Roulette Predictor User App — v2.0

**Self-contained user web app** for AI roulette predictions. Deploy independently from the Admin panel.

## 📁 Files

```
roulette-user/
├── index.html             ← Main UI
├── styles.css             ← Dark neon theme + animations
├── app.js                 ← All user-app logic
├── firebase-config.js     ← Firebase wiring
├── prediction-engine.js   ← 5-model AI ensemble
├── manifest.json          ← PWA manifest
└── README.md              ← This file
```

---

## 🚀 Quick Start

### 1. Make sure Firebase is configured

The Admin panel must be set up first (creates the database & auth provider).
See `roulette-admin/README.md`.

### 2. Host the folder

- **Firebase Hosting** (recommended): `firebase deploy`
- **Netlify / Vercel**: drag-drop
- **GitHub Pages**: push & enable Pages
- **Local test**: `python3 -m http.server 8000` in this folder

### 3. Use it

Users **create an account** (or continue as guest), then:
1. Tap roulette numbers (0–36) for the last 5–10 spins
2. Choose **Predict Even/Odd**, **Red/Black**, or **Both**
3. Hit **🔮 PREDICT**
4. After the actual spin, mark **Was Correct / Was Wrong**

---

## ✨ What's New in v2.0

### Easier to use
| Feature | Description |
|---|---|
| 🔢 **Tap real numbers (0–36)** | Auto-derives E/O & R/B — no more thinking! |
| 👋 **Welcome Tour** | First-time users get a 4-step intro (skippable) |
| 🎬 **Demo Mode** | One-click "Try with sample data" — works without admin upload |
| 💾 **Auto-save sequence** | Sequence persists across page refreshes |
| 📡 **Better Live Track** | Pick mode explicitly (E/O or R/B) — no more silent fails |
| ⌨ **Keyboard shortcuts** | `0-9`, `E O R B`, `Enter`, `⌫`, `Esc` |
| 📲 **PWA installable** | Add to home-screen on mobile |
| 💡 **Inline help everywhere** | Tooltips, info boxes, friendly error messages |
| 🛠 **Settings modal** | Confidence threshold, vibration, sound, auto-save toggles |

### Smarter predictions
| Feature | Description |
|---|---|
| ⚠ **Confidence warning** | Alerts you when the model isn't sure (configurable threshold) |
| 🔧 **Fixed "Both" mode** | Now correctly predicts E/O and R/B independently |
| 🛡 **Smarter validation** | Warns if you don't have enough of a specific type |
| 📊 **Cleaner data pill** | Shows training-data status at a glance (top-right) |

### Wellness & history
| Feature | Description |
|---|---|
| ☕ **Break reminder** | Gentle nudge every 30 min (configurable) |
| 🏆 **Achievement badges** | First win, 10 wins, 50 wins, 5-streak, "Sharp" (60%+ acc) |
| ⤓ **CSV export** | Download your full prediction history |
| 🔊 **Sound feedback** | Optional beep on prediction & feedback |

---

## 🎮 How It Works

The user enters **5+ recent spins**. The engine combines that with the **historical data the admin uploaded**, then runs **5 AI models in parallel**:

| Model | Idea |
|---|---|
| **Markov Chain** | "After this exact pattern, what historically came next?" |
| **Pattern Match** | "Has this exact sequence appeared before? What followed?" |
| **Streak Analysis** | "Long streaks tend to break — how likely is this one to?" |
| **Bayesian** | Recency-weighted base rates with regression-to-mean |
| **Cyclic Detector** | Looks for periodic patterns (cycle length 2–12) |

The five outputs are **weighted-averaged** into a final probability. Engine **adapts weights** based on past accuracy.

---

## ⌨ Keyboard Shortcuts

| Key | Action |
|---|---|
| `0` – `9` | Add a single-digit roulette number |
| `E` `O` | Manual: Even / Odd |
| `R` `B` | Manual: Red / Black |
| `Enter` | Run prediction |
| `Backspace` | Undo last entry |
| `Esc` | Close any modal |

---

## ⚙ Settings (gear icon)

| Setting | Default | Description |
|---|---|---|
| Confidence threshold | 55% | Show low-confidence warning below this |
| Vibration | ON | Haptic feedback on every tap |
| Sound | OFF | Audible beep on prediction |
| Break reminder | ON | Pause prompt every 30 min |
| Auto-save sequence | ON | Resume your sequence after page refresh |

---

## 📲 PWA — Install as App

On Android/iOS Safari, tap the browser menu → **"Add to Home Screen"**. The app then runs full-screen with no browser chrome.

---

## ⚠ Important Reality Check

European roulette has a built-in **~2.7% house edge**. No prediction system, no AI, no statistical model can overcome **true randomness**. This tool is for:

- ✅ Pattern study & curiosity
- ✅ Entertainment
- ✅ Learning about probability

It is **NOT**:
- ❌ A guaranteed profit system
- ❌ A reason to bet money you can't afford to lose

**Play responsibly.** If you feel gambling is becoming a problem, please contact your local responsible-gambling helpline.
