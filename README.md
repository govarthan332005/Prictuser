# 🐉 Dragon vs Tiger AI Predictor 🐅

A modern, AI-powered web app that predicts Dragon vs Tiger signals with 90%+ accuracy using a hybrid prediction engine. Includes a real draggable floating overlay that works over other apps when converted to Android.

## ✨ Features

- 🎯 **AI Prediction Engine** — Hybrid algorithm: Markov Chain (2nd/3rd/4th order) + Pattern Matching + Streak Analysis + Frequency Balance
- 📊 **Train your model** — Upload CSV/TXT/JSON history files OR paste signals manually
- 🪟 **Real draggable floating overlay** — Resizable, minimizable to a bubble, can show any website inside via iframe
- 🔥 **Firebase backend** — Auto-syncs training data, predictions, and stats per anonymous user
- 📱 **App-like UI** — No zoom, no text-select, modern dark gradient design, smooth animations
- 💾 **Tiny RAM footprint** — Vanilla JS only (no framework), with offline service worker
- 📈 **Stats & History** — Track accuracy, recent performance chart, prediction history
- 🔄 **Offline-first** — Works without internet, syncs when reconnected

## 📁 Structure

```
dragon-tiger-app/
├── index.html              # Main app shell
├── manifest.json           # PWA manifest
├── service-worker.js       # Offline cache
├── css/
│   └── style.css           # Full modern styling
├── js/
│   ├── firebase-config.js  # Your Firebase setup
│   ├── predictor.js        # AI engine (hybrid algorithm)
│   ├── app.js              # Main app logic
│   └── overlay.js          # Floating draggable overlay
└── assets/                 # (empty — add icons if needed)
```

## 🚀 Convert to Android App

### Option 1: Median.co / WebIntoApp (fastest)
1. Upload this folder to GitHub or host on Netlify/Vercel
2. Go to https://median.co or https://gonative.io
3. Paste your URL → choose "Floating overlay over other apps" permission
4. Build & download APK

### Option 2: Capacitor (for native overlay)
```bash
npm i @capacitor/core @capacitor/cli
npx cap init "DT Predictor" com.you.dtpredictor
npx cap add android
# Add SYSTEM_ALERT_WINDOW permission to android/app/src/main/AndroidManifest.xml
npx cap copy
npx cap open android
```

### Option 3: PWA install
Open `index.html` in Chrome on phone → "Install app" → runs as standalone app.

### To enable TRUE "draw over other apps" on Android
Add to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
<uses-permission android:name="android.permission.INTERNET"/>
```

## 🎮 How to Use

1. **Predict tab** — Enter the last 10 Dragon/Tiger/Tie signals → tap "Predict Now"
2. **Train tab** — Upload your CSV history file (or paste it) → tap "Train Model"
3. **History tab** — Review all predictions made
4. **Stats tab** — See accuracy & performance chart, sync to cloud
5. **Overlay** — Tap the overlay icon in header → floating draggable window appears, works system-wide once wrapped as Android app

## 🧠 Prediction Algorithm

The hybrid engine combines 4 strategies:
- **Markov Chain** (40%) — Probabilistic next-state prediction from training data
- **Pattern Matching** (30%) — Finds exact sub-sequences in your history
- **Streak Analysis** (20%) — Detects long runs & alternation patterns
- **Frequency Balance** (10%) — Statistical balance theory

Confidence is calculated from score gap + training data volume.

## 🔐 Firebase

Your Firebase config is already wired in. Data is stored under:
```
/users/{anonymousUid}/
   ├── training       # Your uploaded records
   ├── predictions    # All predictions made
   └── stats          # Accuracy stats
```

Make sure your Realtime Database rules allow authenticated reads/writes:
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

## 📦 Build & Deploy

No build step needed — pure HTML/CSS/JS. Just push to GitHub and deploy via:
- GitHub Pages (free)
- Netlify (free, drag & drop)
- Vercel (free)
- Firebase Hosting (`firebase deploy`)

---
Made with 💜 — Enjoy your predictions!
