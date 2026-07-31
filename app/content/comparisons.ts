/**
 * Honest comparison pages.
 *
 * The house rule: where a competitor is genuinely better, say so. The honesty
 * is the conversion — anyone comparing breathwork apps has already read three
 * pages claiming total superiority, and the fourth one that admits a real
 * weakness is the one they believe.
 *
 * comparisons.test.ts pins that every page carries at least one honest
 * "they're better at this" point, and that our own pricing claims match
 * pricing.ts exactly.
 */

export type Comparison = {
  slug: string;
  competitor: string;
  title: string;
  description: string;
  /** The honest summary, up top. */
  verdict: string;
  /** Where the competitor genuinely wins. At least one is required. */
  theyreBetter: readonly { point: string; detail: string }[];
  /** Where we think we win. */
  wereBetter: readonly { point: string; detail: string }[];
  /** Who should pick which. */
  chooseThem: string;
  chooseUs: string;
  order: number;
};

export const COMPARISONS: readonly Comparison[] = [
  {
    slug: "breathflow-vs-meditation-apps",
    competitor: "general meditation apps",
    title: "BreathFLOW vs. general meditation apps",
    description:
      "An honest comparison with the big meditation libraries — what they do better, what we do better, and who should pick which.",
    verdict:
      "If you want a vast library of sleep stories, courses and celebrity narrators, a big meditation app will serve you better than we will. If you want one breath practice you actually do daily, that is the thing BreathFLOW is built for.",
    theyreBetter: [
      {
        point: "Library size, by an enormous margin",
        detail:
          "Thousands of sessions across sleep, focus, kids' content and courses. We have seven practices and intend to keep it small. If breadth is what you want, we are the wrong choice and we would rather say so now.",
      },
      {
        point: "Production budget",
        detail:
          "Celebrity narrators, original scores, and years of polish. Our audio is one facilitator's voice.",
      },
      {
        point: "Offline downloads and platform integrations",
        detail:
          "Mature native apps with Apple Health, wearables, watch apps and download management. We are a web app that installs to your home screen, and those integrations are deliberately not in our first version.",
      },
    ],
    wereBetter: [
      {
        point: "You know what to do when you open it",
        detail:
          "One question answered on the home screen: what should I do today. No browsing, no category tree, no choosing between forty things while already overwhelmed.",
      },
      {
        point: "Breath, not just observation",
        detail:
          "Most meditation apps ask you to notice your breath. BreathFLOW asks you to change it, and to notice what changed. Activating practice, retention work and somatic journeys are the point here, not a side category.",
      },
      {
        point: "Progress that isn't a chore chart",
        detail:
          "Life Force Minutes, a streak a three-minute session can preserve, and compassionate copy when it breaks. No shame mechanics, no leaderboard, no loss framing.",
      },
    ],
    chooseThem:
      "You want variety, sleep content, courses on many topics, or a mature native app with wearable integration.",
    chooseUs:
      "You want a breath practice specifically, you want to actually do it most days, and you would rather have seven things you trust than seven hundred you scroll past.",
    order: 1,
  },
  {
    slug: "breathflow-vs-free-breathing-timers",
    competitor: "free box-breathing timers",
    title: "BreathFLOW vs. free breathing timers",
    description:
      "A free box-breathing timer does one thing well and costs nothing. Here is when that is genuinely the better choice.",
    verdict:
      "A free breathing timer is a perfectly good tool, and if a paced circle is all you need, use one and keep your money. BreathFLOW is for when the timer stopped being enough.",
    theyreBetter: [
      {
        point: "They're free, and they open instantly",
        detail:
          "No account, no onboarding, no subscription decision. For a two-minute box breath before a meeting, that is genuinely a better experience than ours.",
      },
      {
        point: "Nothing to commit to",
        detail:
          "No streak looking at you, no history, no relationship. Some people want a tool, not a practice — and that is a legitimate preference, not a failure of ambition.",
      },
    ],
    wereBetter: [
      {
        point: "Guidance, not just pacing",
        detail:
          "A timer cannot tell you that you have picked an activating practice while already overstimulated. Our guides and the practice descriptions do exactly that.",
      },
      {
        point: "It remembers, so you can see it working",
        detail:
          "Streaks, Life Force Minutes and a retention trend turn 'I think this is helping' into something you can actually look at.",
      },
      {
        point: "Depth when you want it",
        detail:
          "A forty-minute somatic journey with real preparation, real contraindication guidance and real integration support is not something a timer can offer.",
      },
    ],
    chooseThem:
      "You want a paced breathing circle, occasionally, for free, with nothing to sign up for.",
    chooseUs:
      "You want the habit to stick, you want to know which practice fits which state, and you want the deeper work available when you are ready for it.",
    order: 2,
  },
] as const;

export const COMPARISON_BY_SLUG = new Map(COMPARISONS.map((c) => [c.slug, c]));

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISON_BY_SLUG.get(slug);
}

export function orderedComparisons(): Comparison[] {
  return [...COMPARISONS].sort((a, b) => a.order - b.order);
}
