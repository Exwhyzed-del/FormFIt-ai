export type Point = { x: number; y: number; z: number; visibility?: number };

// MediaPipe Pose landmark indices
export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
};

export function angle(a: Point, b: Point, c: Point): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const denom = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!denom) return 180;
  return Math.acos(Math.max(-1, Math.min(1, dot / denom))) * 180 / Math.PI;
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export type FormResult = {
  personDetected: boolean;
  reps: number;
  phase: "up" | "down" | "ready" | "moving";
  formScore: number;
  critique: string;
  cues: string[];
  kneeAngle: number | null;
  hipAngle: number | null;
  torsoAngle: number | null;
};

export class FormAnalyzer {
  private phase: "up" | "down" = "up";
  private reps = 0;
  private setComplete = false;
  private repBuffer: number[] = []; // store form scores per rep
  private currentRepScore = 100;
  private lastCueTime = 0;

  reset() {
    this.phase = "up";
    this.reps = 0;
    this.setComplete = false;
    this.repBuffer = [];
    this.currentRepScore = 100;
  }

  getReps() { return this.reps; }

  analyze(lm: Point[] | null): FormResult {
    if (!lm || lm.length < 33) {
      return { personDetected: false, reps: this.reps, phase: "ready", formScore: 0, critique: "No person detected — step into frame.", cues: [], kneeAngle: null, hipAngle: null, torsoAngle: null };
    }

    // Check visibility of key joints
    const vis = (i: number) => (lm[i]?.visibility ?? 0) > 0.4;
    const keyVisible = [23, 24, 25, 26, 27, 28].every(vis);
    if (!keyVisible) {
      return { personDetected: true, reps: this.reps, phase: "ready", formScore: Math.max(0, this.currentRepScore - 20), critique: "Move back — show full body (hips, knees, ankles).", cues: ["Full body in frame", "Side view preferred"], kneeAngle: null, hipAngle: null, torsoAngle: null };
    }

    const lKnee = angle(lm[23], lm[25], lm[27]);
    const rKnee = angle(lm[24], lm[26], lm[28]);
    const kneeAngle = Math.min(lKnee, rKnee);

    const lHip = angle(lm[11], lm[23], lm[25]);
    const rHip = angle(lm[12], lm[24], lm[26]);
    const hipAngle = Math.min(lHip, rHip);

    // Torso angle relative to vertical (shoulder to hip)
    const shoulderMid = { x: (lm[11].x + lm[12].x) / 2, y: (lm[11].y + lm[12].y) / 2 };
    const hipMid = { x: (lm[23].x + lm[24].x) / 2, y: (lm[23].y + lm[24].y) / 2 };
    const torsoAngle = Math.abs(Math.atan2(shoulderMid.x - hipMid.x, shoulderMid.y - hipMid.y) * 180 / Math.PI);

    const cues: string[] = [];
    let scorePenalty = 0;

    // Depth check: knee should reach ~90-100 at bottom
    if (this.phase === "down") {
      if (kneeAngle > 110) {
        cues.push("Go deeper — thighs parallel to floor");
        scorePenalty += 15;
      } else if (kneeAngle < 70) {
        cues.push("Great depth — don't bounce at the bottom");
        scorePenalty -= 5; // bonus
      }
    }

    // Knee tracking: check knee vs ankle alignment (x distance)
    const kneeAnkleDist = Math.abs(lm[25].x - lm[27].x) + Math.abs(lm[26].x - lm[28].x);
    if (kneeAnkleDist > 0.08) {
      cues.push("Knees tracking over toes");
      scorePenalty += 10;
    }

    // Heel lift: ankle angle / foot position proxy
    // Use foot index vs ankle
    const footLift = Math.abs(lm[31].y - lm[27].y);
    if (footLift < 0.01 && this.phase === "down") {
      cues.push("Keep heels grounded");
      scorePenalty += 10;
    }

    // Torso lean
    if (torsoAngle > 35) {
      cues.push("Keep chest up — reduce forward lean");
      scorePenalty += 12;
    }

    // Hip hinge check
    if (hipAngle < 70) {
      cues.push("Sit back into the hips");
    }

    // Rep counting
    let phase: FormResult["phase"] = "moving";
    if (kneeAngle < 105 && this.phase === "up") {
      this.phase = "down";
      phase = "down";
      this.currentRepScore = 100;
    } else if (kneeAngle > 160 && this.phase === "down") {
      this.phase = "up";
      this.reps += 1;
      const repScore = Math.max(0, Math.min(100, 100 - scorePenalty));
      this.repBuffer.push(repScore);
      this.currentRepScore = 100;
      phase = "up";
    } else if (kneeAngle > 160) {
      phase = "up";
    } else if (kneeAngle < 105) {
      phase = "down";
    }

    // Running form score (average of recent reps or current)
    const avgScore = this.repBuffer.length
      ? this.repBuffer.slice(-5).reduce((a, b) => a + b, 0) / this.repBuffer.slice(-5).length
      : Math.max(0, 100 - scorePenalty);
    const formScore = Math.round(avgScore);

    // Critique
    let critique = "Good form — keep it controlled.";
    if (cues.length > 0) {
      critique = cues[0];
    }
    if (scorePenalty >= 30) {
      critique = cues[0] || "Focus on control through the full range.";
    }

    return {
      personDetected: true,
      reps: this.reps,
      phase,
      formScore,
      critique,
      cues,
      kneeAngle: Math.round(kneeAngle),
      hipAngle: Math.round(hipAngle),
      torsoAngle: Math.round(torsoAngle),
    };
  }
}

export function scoreColor(score: number): string {
  if (score >= 85) return "#22c55e";
  if (score >= 65) return "#eab308";
  return "#ef4444";
}

export function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  return "Needs work";
}
