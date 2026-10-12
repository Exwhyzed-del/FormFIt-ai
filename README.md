# FormFit AI — Kinetic AI Fitness Coach (Web Rebuild)

A free, fully client-side AI fitness coach rebuilt from the **Kinetic AI Fitness Coach** mobile app. Real-time pose tracking, form scoring, custom workout programs, photo analysis, and an AI coach chat — all running in your browser with **no backend, no API keys, no paywall**.

![FormFit AI](https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=modern%20dark%20fitness%20app%20dashboard%20with%20AI%20pose%20tracking%20green%20accent%20minimal&image_size=landscape_16_9)

## ✨ Features

| Feature | Description |
|---|---|
| 🎥 **Live Form Coach** | Camera-based real-time pose tracking using MediaPipe. Counts reps, scores form **0–100**, and delivers Coach Nova's cues instantly. |
| 💬 **Coach Chat** | Chat with Coach Nova — ask about form, programming, nutrition, or motivation. |
| 🖼️ **Photo Analysis** | Upload a workout photo to get AI form feedback with overlaid pose landmarks. |
| 📅 **Workout Plans** | Adaptive programs generated from your goals, experience, and days per week. |
| 📚 **Exercise Library** | 20+ exercises with technique cues, common mistakes, motion previews, and on-device voiceover demos. |
| 📊 **Progress Tracking** | Workout history, streaks, total reps, and average form scores persisted in `localStorage`. |

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (React 19, TypeScript)
- **Pose Detection**: MediaPipe Tasks Vision (`@mediapipe/tasks-vision`)
- **Styling**: Tailwind CSS
- **Icons**: lucide-react
- **Storage**: `localStorage` (100% client-side)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A webcam (for live coaching)
- Chrome/Edge recommended for best MediaPipe performance

### Installation

```bash
npm install
```

### Run in Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
app/
  page.tsx        # Main app (dashboard, live coach, chat, photo, plans, library, progress)
  layout.tsx      # Root layout
  globals.css     # Global styles
lib/
  coach.ts        # Coach Nova persona & rule-based AI replies
  formAnalysis.ts # Rep counting, joint-angle measurement, form scoring 0–100
  storage.ts      # localStorage persistence (profile, sessions, chat, stats)
data/
  exercises.ts    # Exercise library, plan templates & metadata
```

## 🧠 How It Works

1. **Pose Detection** — MediaPipe `PoseLandmarker` tracks 33 body landmarks in real time (video) or from a single image.
2. **Form Analysis** — `lib/formAnalysis.ts` computes joint angles (knee, hip, torso), detects rep phases, and scores your form 0–100 with actionable cues.
3. **Coach Logic** — `lib/coach.ts` uses rule-based logic to simulate Coach Nova's personality, replacing the original Firebase/Gemini backend.
4. **Persistence** — All user data (profile, workout history, chat) is stored locally in `localStorage`. Nothing is uploaded.

## 🔒 Privacy

- All video processing happens **locally in your browser**.
- No camera frames, photos, or workout data ever leave your device.
- No accounts, no tracking, no telemetry.

## 📝 License

For educational purposes. Built as a local rebuild of the Kinetic AI Fitness Coach app.
