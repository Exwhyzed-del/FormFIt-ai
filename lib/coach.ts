import { exercises, planTemplates, type PlanTemplate } from "../data/exercises";
import type { UserProfile } from "./storage";

const persona = "Coach Iron";

type ChatContext = { profile: UserProfile; lastExercise?: string };

const greetings = [
  "What's up, athlete? Ready to put in the work today?",
  "Hey there! Coach Iron here. What are we training today?",
  "Let's get after it. What's on your mind — form, programming, or motivation?",
];

const motivation = [
  "Discipline beats motivation every single day. Show up, even when you don't feel like it.",
  "The rep you're afraid of is the one that builds you. Push through it.",
  "Small improvements compound. Trust the process and stay consistent.",
  "Your body can do almost anything. It's your mind you have to convince.",
  "Sweat today, strength tomorrow. No shortcuts — just work.",
];

const formTips: Record<string, string[]> = {
  squat: [
    "Keep your chest up and weight in your heels as you descend.",
    "Knees should track over your toes, not cave inward.",
    "Go at least to parallel — thighs parallel to the floor for full range.",
    "Brace your core like someone's about to punch your stomach.",
  ],
  pushup: [
    "Keep a straight line from head to heels — no sagging hips.",
    "Elbows at about 45 degrees, not flared straight out.",
    "Lower your chest to about an inch from the floor.",
    "Squeeze your glutes and quads to stay rigid throughout.",
  ],
  plank: [
    "Elbows directly under your shoulders, forearms flat.",
    "Squeeze your glutes hard to keep hips level.",
    "Don't let your lower back sag or pike up.",
    "Breathe steadily — holding your breath will fail you faster.",
  ],
  deadlift: [
    "Keep the bar close to your body the entire movement.",
    "Drive through your heels and squeeze your glutes at the top.",
    "Maintain a neutral spine — never round your lower back.",
    "Hinge at the hips, not the waist, on the way down.",
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function coachReply(input: string, ctx: ChatContext): string {
  const text = input.toLowerCase().trim();
  const name = ctx.profile.name || "athlete";

  if (!text) return pick(greetings);

  // Greetings
  if (/\b(hi|hello|hey|yo|sup|hola)\b/.test(text)) {
    return `Hey ${name}! ${pick(greetings)}`;
  }

  // Motivation
  if (/\b(motivat|tired|lazy|don't want|no energy|giving up|quit)\b/.test(text)) {
    return pick(motivation);
  }

  // Form questions
  const formMatch = text.match(/\b(squat|push.?up|plank|deadlift|lunge|bench|row|press|curl|bridge)\b/);
  if (formMatch && /\b(form|tip|how|technique|correct|proper|mistake)\b/.test(text)) {
    const ex = formMatch[1].replace(/\s/g, "");
    const tips = formTips[ex] || formTips.squat;
    return `Great question on ${formMatch[1]} form. Here are ${tips.length} key cues:\n\n${tips.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nWant me to watch your form with the live camera? Open the Live Coach tab.`;
  }

  // Workout program
  if (/\b(program|routine|plan|schedule|workout.*plan|what should|what exercise)\b/.test(text)) {
    const goal = ctx.profile.goal;
    const goalName = goal === "lose" ? "fat loss" : goal === "muscle" ? "muscle building" : "general fitness";
    const plan = planTemplates.find((p) => p.goal === goal) || planTemplates[0];
    return `Based on your goal (${goalName}) and ${ctx.profile.daysPerWeek} days/week, here's a solid program:\n\n**${plan.name}** — ${plan.description}\n\n` +
      plan.schedule.slice(0, 5).map((d) => `• ${d.day.toUpperCase()} — ${d.title}: ${d.items.slice(0, 4).map((i) => i[0]).join(", ")}`).join("\n") +
      `\n\nGo to the Workout Plans tab for the full week. Want me to adjust it?`;
  }

  // How many reps / sets
  if (/\b(reps|sets|how many|rest)\b/.test(text)) {
    return `For most exercises, aim for 3 sets of 8–12 reps with 60–90 seconds rest between sets. If your goal is strength, go heavier with 4–6 reps and 2–3 min rest. For endurance, lighter weight with 12–15 reps and 30–45 sec rest.`;
  }

  // Diet / nutrition
  if (/\b(diet|food|eat|nutrition|protein|meal|calorie|macro)\b/.test(text)) {
    return `Nutrition is half the battle. Prioritize:\n• Protein — 1.6–2.2g per kg of bodyweight daily\n• Whole foods — lean meats, eggs, fish, legumes, veggies, whole grains\n• Hydration — 2–3L water per day\n• Sleep — 7–9 hours, it's when your muscles grow\n\nWant a more specific plan? Tell me your weight and goal.`;
  }

  // Recovery / rest
  if (/\b(recovery|rest day|sore|recovery|injured|pain)\b/.test(text)) {
    if (/\b(injur|pain|hurt)\b/.test(text)) {
      return "If you're feeling sharp pain (not muscle burn), stop immediately. Ice the area, rest it, and consult a healthcare professional if it persists. Never train through injury.";
    }
    return `Recovery is where the gains happen. Take 1–2 full rest days per week, sleep 7–9 hours, stay hydrated, and consider light mobility work on off days. Soreness is normal — sharp pain is not.`;
  }

  // Weight loss
  if (/\b(lose weight|fat loss|burn fat|weight)\b/.test(text)) {
    return `Fat loss comes down to a consistent calorie deficit. Combine strength training (preserves muscle) with some cardio and a slight calorie deficit (~300–500 cal/day). Prioritize protein and whole foods. The Fat Loss Circuit plan in the Workout tab is perfect for this.`;
  }

  // Build muscle
  if (/\b(build muscle|gain|bulk|hypertrophy|get bigger)\b/.test(text)) {
    return `To build muscle, train in the 8–12 rep range with progressive overload (add weight or reps over time). Eat in a slight calorie surplus with plenty of protein (1.8–2.2g/kg bodyweight). The Upper/Lower or PPL split works great for hypertrophy.`;
  }

  // Thanks
  if (/\b(thanks|thank you|ty|appreciate)\b/.test(text)) {
    return `Anytime, ${name}! That's what I'm here for. Now go crush your workout. 💪`;
  }

  // Default — encouraging
  const defaults = [
    `I hear you, ${name}. Let's break this down — what specifically do you want to work on: form, programming, or motivation?`,
    `Good question. For the best results, combine consistent training with proper nutrition and recovery. What's your main goal right now?`,
    `Let's focus on progress, not perfection. Tell me more about what you're trying to achieve and I'll tailor advice for you.`,
  ];
  return pick(defaults);
}

export function generateProgram(profile: UserProfile): PlanTemplate {
  const goal = profile.goal;
  const days = profile.daysPerWeek;
  let candidates = planTemplates.filter((p) => p.goal === goal);
  if (candidates.length === 0) candidates = planTemplates;
  // Pick by days per week closest match
  candidates.sort((a, b) => Math.abs(a.days.length - days) - Math.abs(b.days.length - days));
  return candidates[0];
}

export { persona, formTips };
