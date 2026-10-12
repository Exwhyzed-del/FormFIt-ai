"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import {
  Activity, Camera, MessageSquare, Image as ImageIcon, CalendarDays, BookOpen,
  History, ShieldCheck, Play, Square, RotateCcw, Send, Check, X, Dumbbell,
  Flame, Target, Clock, Trophy, Upload, Sparkles, Crown, ChevronRight,
  Volume2, VolumeX, Search, TrendingUp, Zap, Heart, Footprints,
} from "lucide-react";
import { exercises, planTemplates, type Exercise, type PlanTemplate } from "../data/exercises";
import { FormAnalyzer, scoreColor, scoreLabel, type FormResult } from "../lib/formAnalysis";
import { coachReply, generateProgram, persona } from "../lib/coach";
import {
  loadProfile, saveProfile, loadSessions, saveSession, loadChat, saveChat,
  getStats, type UserProfile, type WorkoutSession, type ChatMessage,
} from "../lib/storage";

type Tab = "dashboard" | "live" | "chat" | "photo" | "plans" | "library" | "progress";

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function MotionPreview({ kind }: { kind: string }) {
  return (
    <div className={`motion-preview motion-${kind}`} aria-label={`${kind} animation`}>
      <span className="motion-label">MOVEMENT</span>
      <svg viewBox="0 0 220 118" role="img" aria-hidden="true">
        <line x1="18" y1="102" x2="202" y2="102" className="motion-floor" />
        <g className="motion-person">
          <circle cx="110" cy="20" r="8" />
          <path d="M110 29 L110 57 M110 38 L88 48 L78 39 M110 38 L132 48 L142 39 M110 57 L94 78 L88 100 M110 57 L126 78 L132 100" />
        </g>
      </svg>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 38, c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="score-ring">
      <svg width="90" height="90">
        <circle className="track" cx="45" cy="45" r={r} />
        <circle className="fill" cx="45" cy="45" r={r} strokeDasharray={c} strokeDashoffset={offset} stroke={scoreColor(score)} />
      </svg>
      <div className="score-val" style={{ color: scoreColor(score) }}>
        {score}<small>{scoreLabel(score)}</small>
      </div>
    </div>
  );
}

/* ============================ ONBOARDING ============================ */
function Onboarding({ onDone }: { onDone: (p: UserProfile) => void }) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<UserProfile["goal"]>("general");
  const [exp, setExp] = useState<UserProfile["experience"]>("beginner");
  const [days, setDays] = useState(3);

  const finish = () => {
    const p: UserProfile = { name: name || "Athlete", goal, experience: exp, daysPerWeek: days, setupCompleted: true };
    saveProfile(p);
    onDone(p);
  };

  return (
    <div className="onboard-overlay">
      <div className="onboard-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="brand-mark" style={{ width: 44, height: 44 }}><Dumbbell size={22} /></div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#b8ff68", fontWeight: 700 }}>KINETIC AI</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Meet Coach Nova</div>
          </div>
        </div>
        <h2>Let's build your plan</h2>
        <p>Your personal AI-powered fitness coach — real-time form correction, adaptive workout programs, and progress tracking. All free, all on your device.</p>

        <div className="onboard-step">
          <label>Your name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" />
        </div>

        <div className="onboard-step">
          <label>Main goal</label>
          <div className="goal-grid">
            {([["lose", "Lose weight", "Burn fat"], ["muscle", "Build muscle", "Get stronger"], ["general", "General fitness", "Stay fit"]] as const).map(([id, t, d]) => (
              <button key={id} className={`goal-chip ${goal === id ? "selected" : ""}`} onClick={() => setGoal(id)}>
                <b>{t}</b><span>{d}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="onboard-step">
          <label>Experience level</label>
          <select value={exp} onChange={(e) => setExp(e.target.value as UserProfile["experience"])}>
            <option value="beginner">Beginner (0–1 year)</option>
            <option value="intermediate">Intermediate (1–3 years)</option>
            <option value="advanced">Advanced (3+ years)</option>
          </select>
        </div>

        <div className="onboard-step">
          <label>Days per week: <b style={{ color: "#b8ff68" }}>{days}</b></label>
          <input type="range" min={1} max={7} value={days} onChange={(e) => setDays(+e.target.value)} style={{ width: "100%" }} />
        </div>

        <button className="primary-btn" style={{ width: "100%" }} onClick={finish}>
          <Sparkles size={15} /> Start training with Coach Nova
        </button>
        <p style={{ marginTop: 12, textAlign: "center", fontSize: 10 }}>All FormFit Pro features unlocked — unlimited AI classes, photo/video uploads, full analytics.</p>
      </div>
    </div>
  );
}

/* ============================ LIVE COACH ============================ */
function LiveCoach({ profile, onSave }: { profile: UserProfile; onSave: (s: WorkoutSession) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const analyzerRef = useRef(new FormAnalyzer());
  const startedAtRef = useRef<number | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<FormResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sets, setSets] = useState(1);
  const [saving, setSaving] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise>(exercises[0]);

  useEffect(() => {
    if (!cameraOn || startedAtRef.current === null) return;
    const id = window.setInterval(() => {
      if (startedAtRef.current !== null) setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [cameraOn]);

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    setCameraOn(false);
    setLoading(false);
  }, []);

  useEffect(() => () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); streamRef.current?.getTracks().forEach((t) => t.stop()); landmarkerRef.current?.close(); }, []);

  const startCamera = async () => {
    setError("");
    setLoading(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable. Use Chrome on localhost.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("Camera preview not ready.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm");
      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task", delegate: "GPU" },
        runningMode: "VIDEO", numPoses: 1,
      });
      analyzerRef.current.reset();
      setResult(null);
      setElapsed(0);
      setSets(1);
      startedAtRef.current = Date.now();
      setCameraOn(true);
      setLoading(false);

      const loop = () => {
        const video = videoRef.current, canvas = canvasRef.current, detector = landmarkerRef.current;
        if (!video || !canvas || !detector || video.readyState < 2) { frameRef.current = requestAnimationFrame(loop); return; }
        if (video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime;
          const res = detector.detectForVideo(video, performance.now());
          const ctx = canvas.getContext("2d");
          if (ctx) {
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const lm = res.landmarks[0] as any;
            if (lm) {
              const draw = new DrawingUtils(ctx);
              draw.drawLandmarks(lm, { radius: 3, color: "#b8ff68" });
              draw.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, { color: "#b8ff68", lineWidth: 3 });
            }
            const r = analyzerRef.current.analyze(lm || null);
            setResult(r);
          }
        }
        frameRef.current = requestAnimationFrame(loop);
      };
      frameRef.current = requestAnimationFrame(loop);
    } catch (e) {
      stopCamera();
      setError(e instanceof Error ? e.message : "Unable to start camera.");
      setLoading(false);
    }
  };

  const finishSet = () => {
    if (result && result.reps > 0) {
      const duration = startedAtRef.current ? Math.floor((Date.now() - startedAtRef.current) / 1000) : elapsed;
      const session: WorkoutSession = {
        id: Date.now().toString(), exercise: selectedExercise.name, reps: result.reps, sets,
        durationSeconds: duration, formScore: result.formScore, createdAt: new Date().toISOString(),
      };
      saveSession(session);
      onSave(session);
      setSets((s) => s + 1);
      analyzerRef.current.reset();
      setResult(null);
      startedAtRef.current = Date.now();
      setElapsed(0);
    }
  };

  const resetWorkout = () => { analyzerRef.current.reset(); setResult(null); setElapsed(0); setSets(1); startedAtRef.current = cameraOn ? Date.now() : null; };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={selectedExercise.id} onChange={(e) => setSelectedExercise(exercises.find((x) => x.id === e.target.value)!)} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #303a32", background: "#0f1410", color: "#e9f0e8", fontSize: 12 }}>
          {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      <div className="trainer-layout">
        <div>
          <div className="camera-frame">
            <video ref={videoRef} className={cameraOn ? "camera-video visible" : "camera-video"} playsInline muted />
            <canvas ref={canvasRef} className={cameraOn ? "pose-canvas visible" : "pose-canvas"} />
            {!cameraOn && (
              <div className="camera-placeholder">
                <div className="camera-icon"><Camera size={29} /></div>
                <h4>Live AI form coaching</h4>
                <p>Enable camera to track your body, count reps, score form 0–100, and get real-time cues from Coach Nova.</p>
              </div>
            )}
            {cameraOn && (
              <div className="camera-overlay">
                <span className="overlay-dot" /> LIVE POSE TRACKING
                <span className="overlay-phase">{result?.phase.toUpperCase() || "READY"}</span>
              </div>
            )}
          </div>

          {result && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", background: "#172216", border: "1px solid #2a3b25", borderRadius: 10, padding: "12px 14px", marginTop: 13 }}>
              <ScoreRing score={result.formScore} />
              <div style={{ flex: 1 }}>
                <div className="cue-label">COACH'S CUE</div>
                <p style={{ fontSize: 12, color: "#d6e0d4", margin: "4px 0 0", lineHeight: 1.5 }}>{result.critique}</p>
                <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 10, color: "#8b978e" }}>
                  <span>Reps: <b style={{ color: "#b8ff68" }}>{result.reps}</b></span>
                  <span>Knee: <b style={{ color: "#b8ff68" }}>{result.kneeAngle ?? "—"}°</b></span>
                  <span>Set: <b style={{ color: "#b8ff68" }}>{sets}</b></span>
                </div>
              </div>
            </div>
          )}

          {error && <div className="error-message"><X size={16} />{error}</div>}

          <div className="trainer-actions">
            {!cameraOn ? (
              <button className="primary-btn" onClick={startCamera} disabled={loading}><Play size={17} />{loading ? "Starting camera…" : "Start live form check"}</button>
            ) : (
              <button className="primary-btn" onClick={finishSet} disabled={saving}><Check size={16} />{saving ? "Saving…" : "Finish set & save"}</button>
            )}
            <button className="secondary-btn" onClick={resetWorkout}><RotateCcw size={16} /> Reset</button>
            {cameraOn && <button className="secondary-btn" onClick={stopCamera}><X size={16} /> Stop</button>}
          </div>
          <p className="privacy-note"><ShieldCheck size={15} /> Video processed locally in your browser — never uploaded.</p>
        </div>

        <aside className="coach-side">
          <div className="coach-priority">
            <div className="coach-icon"><Target size={22} /></div>
            <span className="section-kicker">HOW IT WORKS</span>
            <h4>Form first. Reps second.</h4>
            <p>MediaPipe tracks 33 body landmarks. We measure joint angles, detect rep phases, score your form 0–100, and deliver Coach Nova's cues in real time.</p>
          </div>
          <div className="coach-steps">
            <div><span>01</span><p><b>Stand sideways</b><small>Full body visible — hips, knees, ankles</small></p></div>
            <div><span>02</span><p><b>Perform reps</b><small>Controlled tempo, full range of motion</small></p></div>
            <div><span>03</span><p><b>Get scored</b><small>Form score 0–100 + actionable cues</small></p></div>
          </div>
          <div className="disclaimer"><ShieldCheck size={16} /><span>Experimental coaching only — not medical advice.</span></div>
        </aside>
      </div>
    </div>
  );
}

/* ============================ COACH CHAT ============================ */
function CoachChat({ profile }: { profile: UserProfile }) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadChat());
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", text, timestamp: new Date().toISOString() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply = coachReply(text, { profile });
      const coachMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: "coach", text: reply, timestamp: new Date().toISOString() };
      const updated = [...next, coachMsg];
      setMessages(updated);
      saveChat(updated);
      setTyping(false);
    }, 600);
  };

  const suggestions = ["How's my squat form?", "Give me a workout program", "How many reps should I do?", "Motivate me", "Nutrition tips"];

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-msg coach">
            <div className="who">COACH IRON</div>
            Hey {profile.name}! I'm Coach Nova, your elite AI fitness trainer. Ask me about form, programming, nutrition, or just say hi. What are we working on today? 💪
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            {m.role === "coach" && <div className="who">COACH IRON</div>}
            {m.text}
          </div>
        ))}
        {typing && <div className="chat-msg coach"><div className="who">COACH IRON</div>Thinking…</div>}
        <div ref={endRef} />
      </div>
      <div className="chat-suggestions">
        {suggestions.map((s) => <button key={s} className="chat-suggestion" onClick={() => send(s)}>{s}</button>)}
      </div>
      <div className="chat-input">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} placeholder="Ask Coach Nova anything…" />
        <button className="primary-btn" style={{ flex: "0 0 auto", padding: "10px 16px" }} onClick={() => send(input)} disabled={!input.trim()}><Send size={15} /></button>
      </div>
    </div>
  );
}

/* ============================ PHOTO ANALYSIS ============================ */
function PhotoAnalysis() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [result, setResult] = useState<FormResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const analyze = async (file: File) => {
    const img = new Image();
    img.onload = async () => {
      setImage(img);
      setAnalyzing(true);
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm");
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task", delegate: "GPU" },
          runningMode: "IMAGE", numPoses: 1,
        });
        const res = landmarker.detect(img);
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          const lm = res.landmarks[0] as any;
          if (lm) {
            const draw = new DrawingUtils(ctx);
            draw.drawLandmarks(lm, { radius: 4, color: "#b8ff68" });
            draw.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, { color: "#b8ff68", lineWidth: 4 });
          }
          const analyzer = new FormAnalyzer();
          setResult(analyzer.analyze(lm || null));
        }
        landmarker.close();
      } catch { setResult(null); }
      setAnalyzing(false);
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 18 }}>
      <div>
        {!image ? (
          <div className={`photo-upload ${dragOver ? "dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) analyze(f); }}>
            <Upload size={36} style={{ color: "#b8ff68", marginBottom: 12 }} />
            <h4 style={{ fontSize: 14, margin: "0 0 6px" }}>Drop a workout photo here</h4>
            <p style={{ fontSize: 11, color: "#8b978e", margin: 0 }}>Or click to upload. Coach Nova will analyze your form.</p>
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && analyze(e.target.files[0])} ref={(el) => { (el as any)?.click?.(); }} id="photo-input" />
            <button className="secondary-btn" style={{ marginTop: 14 }} onClick={() => document.getElementById("photo-input")?.click()}><Upload size={14} /> Choose photo</button>
          </div>
        ) : (
          <div>
            <div className="photo-preview"><canvas ref={canvasRef} /></div>
            <button className="secondary-btn" onClick={() => { setImage(null); setResult(null); }}><RotateCcw size={14} /> Analyze another</button>
          </div>
        )}
      </div>
      <div>
        <div className="panel">
          <div className="panel-heading"><div><span className="section-kicker">PHOTO ANALYSIS</span><h3>Coach Nova's feedback</h3></div></div>
          {analyzing && <p style={{ fontSize: 12, color: "#8b978e" }}>Analyzing pose landmarks…</p>}
          {result && (
            <div>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
                <ScoreRing score={result.formScore} />
                <div>
                  <div style={{ fontSize: 11, color: "#8b978e" }}>Person detected</div>
                  <b style={{ fontSize: 18 }}>{result.personDetected ? "Yes" : "No"}</b>
                </div>
              </div>
              <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                {result.kneeAngle != null && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}><span style={{ color: "#8b978e" }}>Knee angle</span><b>{result.kneeAngle}°</b></div>}
                {result.hipAngle != null && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}><span style={{ color: "#8b978e" }}>Hip angle</span><b>{result.hipAngle}°</b></div>}
                {result.torsoAngle != null && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}><span style={{ color: "#8b978e" }}>Torso lean</span><b>{result.torsoAngle}°</b></div>}
              </div>
              <div style={{ background: "#172216", border: "1px solid #2a3b25", borderRadius: 10, padding: 12 }}>
                <div className="cue-label">COACH'S CUE</div>
                <p style={{ fontSize: 12, color: "#d6e0d4", margin: "6px 0 0", lineHeight: 1.6 }}>{result.critique}</p>
                {result.cues.length > 1 && (
                  <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#aab4ac", fontSize: 11, lineHeight: 1.7 }}>
                    {result.cues.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                )}
              </div>
            </div>
          )}
          {!result && !analyzing && <p style={{ fontSize: 11, color: "#6f7b71" }}>Upload a photo to get AI form feedback.</p>}
        </div>
      </div>
    </div>
  );
}

/* ============================ WORKOUT PLANS ============================ */
function WorkoutPlans({ profile }: { profile: UserProfile }) {
  const [plan, setPlan] = useState<PlanTemplate>(() => generateProgram(profile));
  const [day, setDay] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);

  const toggle = (k: string) => setCompleted((o) => o.includes(k) ? o.filter((x) => x !== k) : [...o, k]);
  const active = plan.schedule[day];

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {planTemplates.map((p) => (
          <button key={p.id} className={`tab-btn ${plan.id === p.id ? "active" : ""}`} onClick={() => { setPlan(p); setDay(0); }}>{p.name}</button>
        ))}
      </div>

      <div className="panel plan-panel" style={{ marginTop: 0 }}>
        <div className="section-headline">
          <div>
            <span className="section-kicker">YOUR PROGRAM</span>
            <h3>{plan.name}</h3>
            <p>{plan.description}</p>
          </div>
          <span className="plan-badge"><Flame size={15} /> {plan.days.length} days/week</span>
        </div>

        <div className="plan-summary-grid">
          <div><span><CalendarDays size={17} /> Schedule</span><b>{plan.days.join(" · ")}</b><small>Training days</small></div>
          <div><span><Target size={17} /> Goal</span><b>{profile.goal === "lose" ? "Fat loss" : profile.goal === "muscle" ? "Muscle" : "General"}</b><small>Your focus</small></div>
          <div><span><Clock size={17} /> Duration</span><b>30–45 min</b><small>Per session</small></div>
        </div>

        <div className="day-tabs">
          {plan.schedule.map((d, i) => (
            <button key={d.day} className={`day-tab ${day === i ? "selected" : ""}`} onClick={() => setDay(i)}>
              <span>{d.day}</span><b>{i + 1}</b>
            </button>
          ))}
        </div>

        <div className="day-plan-heading">
          <div><span className="section-kicker">DAY {day + 1} · {active.focus.toUpperCase()}</span><h4>{active.title}</h4></div>
          <span className="day-count">{active.items.length} activities</span>
        </div>

        <div className="plan-exercise-list">
          {active.items.map(([name, dose], i) => {
            const key = `${plan.id}-${day}-${name}`;
            const ex = exercises.find((e) => e.name === name);
            return (
              <div className="plan-exercise" key={key}>
                <div className="plan-index">{String(i + 1).padStart(2, "0")}</div>
                <div className="plan-exercise-main"><b>{name}</b><span>{ex?.muscles ?? "Recovery"}</span></div>
                <div className="plan-dose">{dose}</div>
                {ex && <button className="icon-action" aria-label="Open guide" onClick={() => document.getElementById("library-tab")?.click()}><Play size={18} /></button>}
                <button className={`complete-toggle ${completed.includes(key) ? "checked" : ""}`} onClick={() => toggle(key)}>{completed.includes(key) ? <Check size={15} /> : null}</button>
              </div>
            );
          })}
        </div>

        <div className="plan-footnote"><ShieldCheck size={17} /><span>Warm up 5–8 minutes. Choose a weight you can control. Stop if you feel pain. Not medical advice.</span></div>
      </div>
    </div>
  );
}

/* ============================ EXERCISE LIBRARY ============================ */
function ExerciseLibrary() {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Exercise>(exercises[0]);
  const [speaking, setSpeaking] = useState(false);
  const [cueStep, setCueStep] = useState(-1);

  const cats = ["All", "Legs", "Chest", "Back", "Shoulders", "Arms", "Core", "Cardio"];
  const filtered = exercises.filter((e) => (filter === "All" || e.category === filter) && `${e.name} ${e.category} ${e.equipment}`.toLowerCase().includes(query.toLowerCase()));

  const stopNarration = () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); setSpeaking(false); setCueStep(-1); };
  const narrate = (ex: Exercise) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const lines = [`Here is how to do the ${ex.name}.`, ...ex.cues, `Common mistakes to avoid. ${ex.mistakes.join(", ")}.`];
    let i = 0;
    const next = () => {
      if (i >= lines.length) { setSpeaking(false); setCueStep(-1); return; }
      setCueStep(i < ex.cues.length ? i : -1);
      const u = new SpeechSynthesisUtterance(lines[i]); u.rate = 0.95;
      u.onend = () => { i++; next(); };
      window.speechSynthesis.speak(u);
    };
    setSpeaking(true); next();
  };
  useEffect(() => () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);
  useEffect(() => { stopNarration(); }, [selected]);

  return (
    <div className="panel library-panel">
      <div className="section-headline">
        <div><span className="section-kicker">EXERCISE LIBRARY</span><h3>{exercises.length} exercises with AI guides</h3><p>Technique cues, common mistakes, motion previews, and voiceover demos.</p></div>
      </div>
      <div className="library-controls">
        <div className="search-box"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercises or equipment…" /></div>
        <div className="filter-pills">{cats.map((c) => <button key={c} className={`filter-pill ${filter === c ? "selected" : ""}`} onClick={() => setFilter(c)}>{c}</button>)}</div>
      </div>
      <div className="library-layout">
        <div className="exercise-grid">
          {filtered.map((e) => (
            <button key={e.id} className={`exercise-card ${selected.id === e.id ? "chosen" : ""}`} onClick={() => setSelected(e)}>
              <MotionPreview kind={e.animation} />
              <div className="exercise-card-copy">
                <div className="exercise-card-tags"><span>{e.category}</span><span>{e.level}</span></div>
                <b>{e.name}</b><small>{e.equipment}</small>
                <span className="exercise-card-bottom">{e.sets} · {e.reps}<ChevronRight size={15} /></span>
              </div>
            </button>
          ))}
        </div>
        <aside className="exercise-detail">
          <div className="detail-topline"><span className="section-kicker">EXERCISE GUIDE</span><span className="level-tag">{selected.level}</span></div>
          <h4>{selected.name}</h4>
          <p className="detail-muscles">{selected.muscles}</p>
          <div className="detail-dose">
            <div><small>SETS</small><b>{selected.sets}</b></div>
            <div><small>REPS</small><b>{selected.reps}</b></div>
            <div><small>REST</small><b>{selected.rest}</b></div>
          </div>
          <MotionPreview kind={selected.animation} />
          <h5>How to do it</h5>
          <ol className="cue-list">{selected.cues.map((s, i) => <li key={s}><span>{i + 1}</span>{s}</li>)}</ol>
          <h5>AI voiceover demo</h5>
          <div className="ai-demo-panel">
            <div className="ai-demo-script">
              {selected.cues.map((c, i) => <div key={c} className={`ai-demo-cue ${cueStep === i ? "active" : ""}`}><span>{i + 1}</span>{c}</div>)}
            </div>
            <div className="ai-demo-controls">
              {speaking ? <button className="secondary-btn" onClick={stopNarration}><VolumeX size={15} /> Stop</button> : <button className="primary-btn" onClick={() => narrate(selected)}><Volume2 size={15} /> Play voiceover</button>}
              <span className="ai-demo-note">On-device voice</span>
            </div>
          </div>
          <h5>Common mistakes</h5>
          <ul className="mistake-list">{selected.mistakes.map((m) => <li key={m}>{m}</li>)}</ul>
          <button className="primary-btn detail-ai-button" onClick={() => document.getElementById("live-tab")?.click()}><Camera size={16} /> Try live form check</button>
        </aside>
      </div>
    </div>
  );
}

/* ============================ PROGRESS ============================ */
function Progress() {
  const [sessions] = useState<WorkoutSession[]>(loadSessions());
  const stats = getStats();

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card"><div className="icon"><Flame size={18} /></div><b>{stats.streak}</b><span>DAY STREAK</span></div>
        <div className="stat-card"><div className="icon"><Dumbbell size={18} /></div><b>{stats.totalWorkouts}</b><span>WORKOUTS</span></div>
        <div className="stat-card"><div className="icon"><TrendingUp size={18} /></div><b>{stats.totalReps}</b><span>TOTAL REPS</span></div>
        <div className="stat-card"><div className="icon"><Target size={18} /></div><b>{stats.avgForm}</b><span>AVG FORM SCORE</span></div>
      </div>

      <div className="panel">
        <div className="panel-heading"><div><span className="section-kicker">WORKOUT HISTORY</span><h3>Recent sessions</h3></div><History size={18} /></div>
        {sessions.length === 0 ? (
          <div className="empty-history">Complete a live workout to see your history here.</div>
        ) : (
          <div className="history-list">
            {sessions.slice(0, 20).map((s) => (
              <div className="history-item" key={s.id}>
                <div className="history-symbol"><Dumbbell size={17} /></div>
                <div className="history-copy">
                  <b>{s.exercise}</b>
                  <span>{new Date(s.createdAt).toLocaleString()} · {formatTime(s.durationSeconds)}</span>
                </div>
                <div style={{ textAlign: "right", marginRight: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><b>{s.reps}</b><span style={{ fontSize: 9, color: "#8b978e" }}>reps</span></div>
                  <div style={{ fontSize: 9, color: "#8b978e" }}>Set {s.sets}</div>
                </div>
                <div className="history-stats"><b style={{ color: scoreColor(s.formScore) }}>{s.formScore}</b><span>form score</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ MAIN APP ============================ */
export default function Home() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [, forceUpdate] = useState(0);

  useEffect(() => { const p = loadProfile(); if (p.setupCompleted) setProfile(p); }, []);

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "dashboard", label: "Dashboard", icon: Activity },
    { id: "live", label: "Live Coach", icon: Camera },
    { id: "chat", label: "Coach Chat", icon: MessageSquare },
    { id: "photo", label: "Photo Analysis", icon: ImageIcon },
    { id: "plans", label: "Workout Plans", icon: CalendarDays },
    { id: "library", label: "Library", icon: BookOpen },
    { id: "progress", label: "Progress", icon: History },
  ];

  if (!profile) return <Onboarding onDone={setProfile} />;

  const stats = getStats();

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Dumbbell size={23} /></div><span>formfit<span className="brand-ai">.ai</span></span></div>
        <div className="side-label">WORKSPACE</div>
        {tabs.map((t) => (
          <button key={t.id} className={`nav-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)} style={{ border: 0, background: "transparent", width: "100%", textAlign: "left" }}>
            <t.icon size={18} /> {t.label}
            {t.id === "live" && <span className="new-tag">CORE</span>}
          </button>
        ))}
        <div className="sidebar-bottom"><Crown size={17} /><span><b style={{ color: "#b8ff68" }}>FormFit Pro</b> — all features unlocked free.</span></div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR AI COACH</p>
            <h1>Hey {profile.name}, let's train.</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="pro-badge"><Crown size={11} /> PRO UNLOCKED</span>
            <div className="status-pill"><span className="status-dot" /> Coach Nova online</div>
          </div>
        </header>

        <div className="tab-bar">
          {tabs.map((t) => (
            <button key={t.id} id={`${t.id}-tab`} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && (
          <div>
            <div className="stats-grid">
              <div className="stat-card"><div className="icon"><Flame size={18} /></div><b>{stats.streak}</b><span>DAY STREAK</span></div>
              <div className="stat-card"><div className="icon"><Dumbbell size={18} /></div><b>{stats.totalWorkouts}</b><span>WORKOUTS</span></div>
              <div className="stat-card"><div className="icon"><TrendingUp size={18} /></div><b>{stats.totalReps}</b><span>TOTAL REPS</span></div>
              <div className="stat-card"><div className="icon"><Target size={18} /></div><b>{stats.avgForm}</b><span>AVG FORM</span></div>
            </div>

            <div className="hero-banner">
              <div className="hero-copy">
                <span className="date-label">KINETIC AI FITNESS</span>
                <h2>Train smarter with Coach Nova</h2>
                <p>Real-time AI form correction, custom workout programs, photo analysis, and progress tracking — all free and on your device. Your personal elite fitness coach.</p>
                <div className="hero-actions">
                  <button className="primary-btn" onClick={() => setTab("live")}><Camera size={17} /> Open live coach</button>
                  <button className="secondary-btn" onClick={() => setTab("chat")}><MessageSquare size={17} /> Chat with Coach Nova</button>
                </div>
                <div className="hero-pills">
                  <span><Check size={14} /> Live form scoring 0–100</span>
                  <span><Zap size={14} /> Real-time cues</span>
                  <span><Heart size={14} /> All Pro features free</span>
                </div>
              </div>
              <div className="hero-visual">
                <div className="hero-orbit orbit-one" />
                <div className="hero-orbit orbit-two" />
                <div className="hero-figure"><Dumbbell size={72} /></div>
                <div className="floating-stat stat-top"><span>COACH</span><b>Coach Nova</b></div>
                <div className="floating-stat stat-bottom"><span>FORM AI</span><b><span className="pulse-dot" /> Live tracking</b></div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div className="panel">
                <div className="panel-heading"><div><span className="section-kicker">QUICK START</span><h3>Jump into training</h3></div></div>
                <div style={{ display: "grid", gap: 10 }}>
                  <button className="secondary-btn" onClick={() => setTab("live")} style={{ justifyContent: "flex-start", padding: 14 }}><Camera size={18} /> <div style={{ textAlign: "left", marginLeft: 10 }}><b>Live form check</b><div style={{ fontSize: 10, color: "#8b978e", fontWeight: 400 }}>Camera + real-time scoring</div></div></button>
                  <button className="secondary-btn" onClick={() => setTab("chat")} style={{ justifyContent: "flex-start", padding: 14 }}><MessageSquare size={18} /> <div style={{ textAlign: "left", marginLeft: 10 }}><b>Ask Coach Nova</b><div style={{ fontSize: 10, color: "#8b978e", fontWeight: 400 }}>Form, programs, nutrition</div></div></button>
                  <button className="secondary-btn" onClick={() => setTab("photo")} style={{ justifyContent: "flex-start", padding: 14 }}><ImageIcon size={18} /> <div style={{ textAlign: "left", marginLeft: 10 }}><b>Photo analysis</b><div style={{ fontSize: 10, color: "#8b978e", fontWeight: 400 }}>Upload a photo for feedback</div></div></button>
                </div>
              </div>
              <div className="panel">
                <div className="panel-heading"><div><span className="section-kicker">TODAY</span><h3>Coach Nova says</h3></div><Sparkles size={18} /></div>
                <p style={{ fontSize: 12, color: "#b6c0b7", lineHeight: 1.7, margin: 0 }}>
                  {stats.totalWorkouts === 0
                    ? "Welcome to Kinetic AI! Start with the live coach to get your first form score. Consistency beats intensity — show up today."
                    : `You've completed ${stats.totalWorkouts} workout${stats.totalWorkouts > 1 ? "s" : ""} with an average form score of ${stats.avgForm}. Keep that streak alive — ${stats.streak} day${stats.streak !== 1 ? "s" : ""} and counting!`}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                  <span className="pro-badge"><Crown size={11} /> Unlimited AI classes</span>
                  <span className="pro-badge"><Footprints size={11} /> Free photo/video uploads</span>
                  <span className="pro-badge"><Trophy size={11} /> Full analytics</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "live" && <LiveCoach profile={profile} onSave={() => forceUpdate((n) => n + 1)} />}
        {tab === "chat" && <CoachChat profile={profile} />}
        {tab === "photo" && <PhotoAnalysis />}
        {tab === "plans" && <WorkoutPlans profile={profile} />}
        {tab === "library" && <ExerciseLibrary />}
        {tab === "progress" && <Progress />}

        <footer>KINETIC AI <span>•</span> Real-time form correction, adaptive programs, progress tracking. <span>•</span> All features free.</footer>
      </section>
    </main>
  );
}
