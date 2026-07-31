/**
 * Bezz — bio, teachings and conversion surfaces.
 *
 * IMPORTANT, and flagged for the founder before launch: every credential,
 * teacher name and event below comes from the brief and is marked
 * `needsVerification`. The brief itself says these must be confirmed before
 * publication, and the acceptance criteria require it. `bezz.test.ts` fails
 * the build if an unverified claim is marked as published, so this cannot be
 * forgotten — flip `VERIFIED` to true only once the founder has confirmed the
 * wording.
 */

export const CREDENTIALS_VERIFIED = false;

export const BIO_SHORT =
  "Bezz is a filmmaker, artist and breath facilitator, and the founder of BreathFLOW Practice. His work explores the breath as a bridge between body, mind, spirit, creativity and transformation.";

export const BIO_FULL = [
  "Bezz is a filmmaker, artist, breath facilitator, and founder of BreathFLOW Practice. His work explores the breath as a bridge between body, mind, spirit, creativity and transformation. Inspired by the ancient practice of pranayama, he creates cinematic breath journeys that help people regulate, awaken, feel, and return to flow.",
  "His mission is to help people remember that the breath is not merely something happening in the background of life. It is a direct pathway into presence, vitality, emotional truth, and the life force already within them.",
] as const;

/**
 * Held back from the published bio until confirmed. Rendering these while
 * CREDENTIALS_VERIFIED is false would put unverified claims in production,
 * which the acceptance criteria forbid.
 */
export const CREDENTIALS_PENDING_VERIFICATION = {
  certification: "IBF-certified breathwork facilitator",
  teachers: ["Audra Bear (Tulum)", "Andrew Genovese"],
  venues: [
    "UMO",
    "AMARI Wellness",
    "Unbound Festival, Zihuatanejo",
    "Confluence Festival",
    "Rythmia Life Advancement Center, Costa Rica",
  ],
} as const;

export type Teaching = {
  slug: string;
  title: string;
  blurb: string;
  /** Minutes. */
  length: number;
  /** R2 key or external URL. Absent until Bezz records it. */
  media?: string;
};

/** Short teachings. Placeholders until the real recordings land. */
export const TEACHINGS: readonly Teaching[] = [
  {
    slug: "why-i-created-breathflow",
    title: "Why I created BreathFLOW",
    blurb:
      "What disconnection felt like before the breath became a practice, and the moment it changed.",
    length: 4,
  },
  {
    slug: "why-flow-not-breathwork",
    title: "Why flow, and not just breathwork",
    blurb:
      "The word breathwork can feel clinical. Flow is closer to what people actually want.",
    length: 3,
  },
  {
    slug: "consistency-over-peaks",
    title: "Consistency beats peak experiences",
    blurb:
      "Why a daily three minutes will change more than a monthly ceremony.",
    length: 3,
  },
] as const;

export type ConversionPath = {
  key: string;
  title: string;
  description: string;
  cta: string;
  /** Which env var holds the destination, when one is configured. */
  urlVar?: "BOOKING_URL";
  /** Falls back to the Ask form with this category preselected. */
  askCategory?: string;
};

export const CONVERSION_PATHS: readonly ConversionPath[] = [
  {
    key: "one-to-one",
    title: "A private 1:1 session",
    description:
      "Ninety minutes with Bezz, built around what is actually happening for you. Held online or in person.",
    cta: "Book a session",
    urlVar: "BOOKING_URL",
    askCategory: "1:1 Session",
  },
  {
    key: "retreats",
    title: "Retreats and gatherings",
    description:
      "Longer immersions, a few times a year. Small groups, real integration time.",
    cta: "Ask about retreats",
    askCategory: "Retreat",
  },
  {
    key: "facilitation",
    title: "Bring Bezz to your group",
    description:
      "Private groups, festivals, offsites and events. Tell us who is in the room and what you want them to leave with.",
    cta: "Start a conversation",
    askCategory: "Collaboration",
  },
] as const;

export const ASK_CATEGORIES = [
  "Practice Question",
  "1:1 Session",
  "Retreat",
  "Collaboration",
  "Technical Support",
] as const;

export const ASK_EXPECTATION =
  "Bezz or the BreathFLOW team will respond as availability allows. This is not emergency or medical support — if something urgent is happening, please contact your local emergency services or a qualified professional.";
