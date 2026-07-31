/**
 * The launch library.
 *
 * Seven experiences, not thirty. The brief is emphatic that this must not feel
 * like a content warehouse — every addition here should have to earn its place.
 *
 * This typed registry is the source of truth and the fallback. Rows in
 * `practice_overrides` patch individual fields at runtime, which is how new
 * journeys and copy fixes ship without a deploy.
 */

export type Intensity = "gentle" | "activating" | "deep";

export type BreathPattern = {
  /** Seconds per phase. 0 means the phase is skipped. */
  inhale: number;
  holdIn: number;
  exhale: number;
  holdOut: number;
  /** Shown under the orb. Kept short — this is read with eyes half-closed. */
  label: string;
};

export type Practice = {
  slug: string;
  title: string;
  /** One sentence, phrased as an outcome the user can feel. */
  outcome: string;
  /** Longer description on the detail screen. */
  description: string;
  seconds: number;
  intensity: Intensity;
  /** At most two, per the brief's practice-card spec. */
  bestFor: readonly [string, string] | readonly [string];
  premium: boolean;
  gradient: "bf-dawn" | "bf-night" | "bf-ember" | "bf-still";
  /** R2 object key for the narrated audio. Absent until Bezz records it. */
  audioKey?: string;
  /** Shown before a deep or activating practice begins. */
  preparation?: readonly string[];
  /** Extra caution shown on the preparation screen for deep journeys. */
  contraindication?: string;
  /** Guides that pair with this practice. */
  relatedGuides: readonly string[];
  /** The breath cadence the orb animates. */
  pattern: BreathPattern;
  /** Order in the library. Lower is higher. */
  order: number;
};

const GENTLE_PREP = [
  "Sit or lie down somewhere you can stay for the whole practice.",
  "Let the body be supported — a wall, a cushion, the floor.",
  "Silence what you can. Leave what you can't.",
] as const;

const DEEP_PREP = [
  "Create space. Silence distractions. Let the body be supported.",
  "Lie down if you can. You may not want to be upright by the end.",
  "Have water nearby, and somewhere soft to land afterwards.",
  "Leave twenty minutes free after the session for integration.",
] as const;

const DEEP_CONTRAINDICATION =
  "This is a deeper activating practice. It is not suitable during pregnancy, or if you live with epilepsy, cardiovascular conditions, glaucoma, or a history of psychosis or severe panic. If any of that is you — or if you simply aren't sure — choose a gentle practice today and talk to a qualified healthcare professional before trying this one.";

export const PRACTICES: readonly Practice[] = [
  {
    slug: "grand-rising-method",
    title: "The Grand Rising Method",
    outcome:
      "Wake the body, clear the mind, and set your state before the day sets it for you.",
    description:
      "The foundational BreathFLOW ritual. Sixteen minutes of activating, rhythmic breath that moves you from sleep into presence — body first, then mind, then intention. This is the practice to return to daily. Everything else in the library orbits it.",
    seconds: 16 * 60,
    intensity: "activating",
    bestFor: ["Mornings", "Low energy"],
    premium: false,
    gradient: "bf-dawn",
    audioKey: "audio/grand-rising-method.m4a",
    preparation: GENTLE_PREP,
    relatedGuides: ["grand-rising-method", "activation-vs-regulation"],
    pattern: { inhale: 4, holdIn: 0, exhale: 4, holdOut: 0, label: "Circular" },
    order: 1,
  },
  {
    slug: "three-minute-return",
    title: "The Three-Minute Return",
    outcome: "Come back to yourself in the time it takes to boil a kettle.",
    description:
      "Three minutes, no preparation, no perfect conditions. This is the practice for the day you have no time for a practice — and it counts. A qualifying session keeps your streak alive, because consistency matters more than length.",
    seconds: 3 * 60,
    intensity: "gentle",
    bestFor: ["Any moment", "Busy days"],
    premium: false,
    gradient: "bf-still",
    audioKey: "audio/three-minute-return.m4a",
    relatedGuides: ["daily-ritual"],
    pattern: { inhale: 4, holdIn: 2, exhale: 6, holdOut: 0, label: "Return" },
    order: 2,
  },
  {
    slug: "anxiety-relief",
    title: "Anxiety Relief",
    outcome:
      "Soften a spiking nervous system and get your feet back under you.",
    description:
      "A gentle, regulating visualization for the moments that arrive uninvited. There is no forceful breathing here and no retention — just a lengthening exhale, contact with the ground, and something steady to hold onto. Use this whenever you need to come back to the present.",
    seconds: 8 * 60,
    intensity: "gentle",
    bestFor: ["Overwhelm", "Racing thoughts"],
    premium: true,
    gradient: "bf-still",
    audioKey: "audio/anxiety-relief.m4a",
    preparation: GENTLE_PREP,
    relatedGuides: ["activation-vs-regulation"],
    pattern: { inhale: 4, holdIn: 0, exhale: 8, holdOut: 0, label: "Long exhale" },
    order: 3,
  },
  {
    slug: "flow-state-reset",
    title: "Flow State Reset",
    outcome: "Move from scattered attention into focused, embodied work.",
    description:
      "For makers, performers, founders and anyone staring at something they cannot start. Rhythmic and clarifying rather than sedating — this practice is designed to be done at your desk, then followed immediately by the work. Breathe. Focus. Create.",
    seconds: 9 * 60,
    intensity: "activating",
    bestFor: ["Creative block", "Before deep work"],
    premium: true,
    gradient: "bf-ember",
    audioKey: "audio/flow-state-reset.m4a",
    relatedGuides: ["journal-prompts"],
    pattern: { inhale: 4, holdIn: 4, exhale: 4, holdOut: 4, label: "Square" },
    order: 4,
  },
  {
    slug: "inner-child",
    title: "Inner Child",
    outcome:
      "Meet the part of you that learned to go quiet, and let it be heard.",
    description:
      "A guided reconnection with younger, more tender experience — safety, play, and the needs that went unmet. This practice does not attempt to recover memories or resolve the past. It makes room to feel what is ready to be felt, and it ends by bringing you all the way back.",
    seconds: 16 * 60,
    intensity: "deep",
    bestFor: ["Emotional reflection", "Feeling numb"],
    premium: true,
    gradient: "bf-night",
    audioKey: "audio/inner-child.m4a",
    preparation: [
      ...GENTLE_PREP,
      "Emotion may arrive. That is allowed, and it is not a problem to solve.",
    ],
    contraindication:
      "This practice can surface difficult material. It is not therapy and it is not a substitute for care. If you are in a fragile period, please practise this alongside a qualified therapist or counsellor rather than alone.",
    relatedGuides: ["integration", "journal-prompts"],
    pattern: { inhale: 5, holdIn: 0, exhale: 7, holdOut: 0, label: "Soften" },
    order: 5,
  },
  {
    slug: "evening-release",
    title: "Evening Release",
    outcome: "Put the day down, and let the body get heavy.",
    description:
      "Slow pacing, extended exhales, and almost no activation. This practice releases held tension through the jaw, shoulders and belly, and hands you to sleep rather than to another task. Best done already in bed.",
    seconds: 12 * 60,
    intensity: "gentle",
    bestFor: ["Winding down", "Before sleep"],
    premium: true,
    gradient: "bf-night",
    audioKey: "audio/evening-release.m4a",
    relatedGuides: ["daily-ritual"],
    pattern: { inhale: 4, holdIn: 0, exhale: 10, holdOut: 0, label: "Release" },
    order: 6,
  },
  {
    slug: "breath-of-rapture",
    title: "Breath of Rapture",
    outcome:
      "A long somatic journey into energy, feeling, and the aliveness underneath.",
    description:
      "The signature BreathFLOW journey. Forty minutes of sustained, building breath designed to move energy through the whole body and open a door to feeling that everyday practice does not reach. Expect intensity. Expect emotion. Expect to need time afterwards. This is not a beginner's practice, and it is not one to squeeze into a lunch break.",
    seconds: 40 * 60,
    intensity: "deep",
    bestFor: ["Transformation", "Emotional release"],
    premium: true,
    gradient: "bf-ember",
    audioKey: "audio/breath-of-rapture.m4a",
    preparation: DEEP_PREP,
    contraindication: DEEP_CONTRAINDICATION,
    relatedGuides: ["integration", "prana-life-force"],
    pattern: { inhale: 3, holdIn: 0, exhale: 3, holdOut: 0, label: "Connected" },
    order: 7,
  },
] as const;

export const PRACTICE_BY_SLUG = new Map(PRACTICES.map((p) => [p.slug, p]));

export function getPractice(slug: string): Practice | undefined {
  return PRACTICE_BY_SLUG.get(slug);
}

export function orderedPractices(): Practice[] {
  return [...PRACTICES].sort((a, b) => a.order - b.order);
}

/** One breath cycle, in seconds. Used to pace the orb. */
export function cycleSeconds(pattern: BreathPattern): number {
  return pattern.inhale + pattern.holdIn + pattern.exhale + pattern.holdOut;
}

export const INTENSITY_LABEL: Record<Intensity, string> = {
  gentle: "Gentle",
  activating: "Activating",
  deep: "Deep",
};

/**
 * Which practice to offer on Home right now.
 *
 * Deliberately simple and explainable — no personalisation model, no adaptive
 * AI (both are explicitly out of V1). Just the time of day and whether they
 * have already practised.
 */
export function todaysPractice(opts: {
  hour: number;
  practicedToday: boolean;
  preferredTime?: string | null;
}): Practice {
  const { hour, practicedToday } = opts;

  // Already practised? Offer something short and additive, never a second
  // forty-minute journey.
  if (practicedToday) return getPractice("three-minute-return")!;

  if (hour >= 20 || hour < 4) return getPractice("evening-release")!;
  if (hour >= 16) return getPractice("evening-release")!;
  if (hour >= 11) return getPractice("flow-state-reset")!;
  return getPractice("grand-rising-method")!;
}
