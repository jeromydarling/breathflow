/**
 * The onboarding script.
 *
 * Sixty to ninety seconds, and it must feel like an invitation rather than an
 * interrogation. Everything except the safety acknowledgment is skippable, and
 * the core quote is reproduced exactly — no paraphrasing, ever.
 */

export const STEPS = [
  "welcome",
  "roots",
  "quote",
  "intention",
  "experience",
  "rhythm",
  "safety",
  "account",
  "first-breath",
] as const;

export type Step = (typeof STEPS)[number];

export function isStep(value: string): value is Step {
  return (STEPS as readonly string[]).includes(value);
}

export function stepIndex(step: Step): number {
  return STEPS.indexOf(step);
}

export function nextStep(step: Step): Step | null {
  return STEPS[stepIndex(step) + 1] ?? null;
}

export function previousStep(step: Step): Step | null {
  const index = stepIndex(step);
  return index > 0 ? STEPS[index - 1]! : null;
}

/** Steps a signed-out visitor can see before creating an account. */
export const PRE_ACCOUNT_STEPS: readonly Step[] = STEPS.slice(0, 8);

export const INTENTIONS = [
  {
    value: "calm",
    label: "Calm my nervous system",
    sub: "Less wired. More settled.",
  },
  {
    value: "energy",
    label: "Feel more energy",
    sub: "Wake up what has gone flat.",
  },
  { value: "flow", label: "Return to flow", sub: "Focus that feels effortless." },
  {
    value: "feel",
    label: "Feel and release",
    sub: "Make room for what is held.",
  },
  {
    value: "ritual",
    label: "Build a daily ritual",
    sub: "Consistency over intensity.",
  },
] as const;

export const MAX_INTENTIONS = 2;

export const EXPERIENCE_LEVELS = [
  {
    value: "new",
    label: "New to conscious breathing",
    sub: "We will start gently, and explain as we go.",
  },
  {
    value: "some",
    label: "Some experience",
    sub: "You know the feeling. Let's deepen it.",
  },
  {
    value: "experienced",
    label: "Experienced",
    sub: "The longer journeys are waiting for you.",
  },
] as const;

export const PRACTICE_TIMES = [
  { value: "morning", label: "Morning", hour: 7 },
  { value: "midday", label: "Midday", hour: 12 },
  { value: "evening", label: "Evening", hour: 20 },
  { value: "flexible", label: "Flexible", hour: null },
] as const;

export function reminderHourFor(preferredTime: string): number | null {
  return (
    PRACTICE_TIMES.find((t) => t.value === preferredTime)?.hour ?? null
  );
}

export function isValidIntention(value: string): boolean {
  return INTENTIONS.some((i) => i.value === value);
}

export function isValidExperience(value: string): boolean {
  return EXPERIENCE_LEVELS.some((e) => e.value === value);
}

export function isValidPracticeTime(value: string): boolean {
  return PRACTICE_TIMES.some((t) => t.value === value);
}

/** Clamp and validate an intentions list before it reaches the database. */
export function sanitizeIntentions(values: string[]): string {
  return [...new Set(values.filter(isValidIntention))]
    .slice(0, MAX_INTENTIONS)
    .join(",");
}

/**
 * Which practice to offer at the end of onboarding.
 * Beginners get the three-minute door; everyone else gets the ritual.
 */
export function firstInvitationSlug(experience: string | null): string {
  return experience === "new" ? "three-minute-return" : "grand-rising-method";
}
