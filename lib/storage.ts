export type UserProfile = {
  name: string;
  goal: "lose" | "muscle" | "general";
  experience: "beginner" | "intermediate" | "advanced";
  daysPerWeek: number;
  weight?: number;
  height?: number;
  age?: number;
  setupCompleted: boolean;
};

export type WorkoutSession = {
  id: string;
  exercise: string;
  reps: number;
  sets: number;
  durationSeconds: number;
  formScore: number;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "coach";
  text: string;
  timestamp: string;
};

const PROFILE_KEY = "kinetic_profile";
const SESSIONS_KEY = "kinetic_sessions";
const CHAT_KEY = "kinetic_chat";
const STREAK_KEY = "kinetic_streak";

export function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { name: "", goal: "general", experience: "beginner", daysPerWeek: 3, setupCompleted: false };
}

export function saveProfile(p: UserProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function loadSessions(): WorkoutSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveSession(s: WorkoutSession) {
  const all = loadSessions();
  all.unshift(s);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
  updateStreak();
}

export function loadChat(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveChat(messages: ChatMessage[]) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-100)));
}

function updateStreak() {
  const today = new Date().toDateString();
  const raw = localStorage.getItem(STREAK_KEY);
  let data = { lastDate: "", count: 0 };
  if (raw) {
    try { data = JSON.parse(raw); } catch {}
  }
  if (data.lastDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (data.lastDate === yesterday) {
    data.count += 1;
  } else {
    data.count = 1;
  }
  data.lastDate = today;
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

export function getStreak(): number {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw).count;
  } catch {}
  return 0;
}

export function getStats() {
  const sessions = loadSessions();
  const totalReps = sessions.reduce((a, s) => a + s.reps, 0);
  const totalTime = sessions.reduce((a, s) => a + s.durationSeconds, 0);
  const avgForm = sessions.length ? Math.round(sessions.reduce((a, s) => a + s.formScore, 0) / sessions.length) : 0;
  return { totalWorkouts: sessions.length, totalReps, totalTime, avgForm, streak: getStreak() };
}
