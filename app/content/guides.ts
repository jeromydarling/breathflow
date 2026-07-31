/**
 * The guide library.
 *
 * The brief is clear that the existing PDFs must become native reading
 * experiences — card-based chapters, large type, generous spacing, an
 * auto-saved position, and links that drop you straight into the practice
 * being described. A printable PDF stays available as an account resource,
 * but it is never the main path.
 *
 * These are typed content, not markdown files, so tests can check that every
 * practice cross-link resolves and every guide has real depth.
 */

export type Block =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "quote"; text: string; attribution?: string }
  | { type: "list"; items: readonly string[] }
  | { type: "callout"; tone: "warm" | "caution"; title: string; text: string }
  | { type: "practice"; slug: string; note: string };

export type Chapter = {
  title: string;
  blocks: readonly Block[];
};

export type Guide = {
  slug: string;
  title: string;
  /** Used as the <h1> on the public web version. */
  h1: string;
  description: string;
  category: "foundations" | "practice" | "safety" | "integration";
  premium: boolean;
  /** Published publicly for SEO as well as in-app. */
  public: boolean;
  chapters: readonly Chapter[];
  faq?: readonly { q: string; a: string }[];
  order: number;
};

const SAFETY_CALLOUT = {
  type: "callout",
  tone: "caution",
  title: "Before you hold your breath",
  text: "Practise seated or lying down, somewhere safe. Never practise breath retention in water, while driving, or anywhere a loss of consciousness could hurt you. Stop immediately if you feel pain, sharp dizziness, panic or distress. If you are pregnant, or live with a cardiovascular condition, epilepsy, glaucoma, or a history of psychosis or severe panic, speak with a qualified healthcare professional before practising retention at all.",
} as const satisfies Block;

export const GUIDES: readonly Guide[] = [
  {
    slug: "the-breathflow-guide",
    title: "The BreathFLOW Guide",
    h1: "The BreathFLOW Guide: rituals to regulate, activate, and rise",
    description:
      "The founding guide. What BreathFLOW is, where it comes from, and how to begin a practice you will actually keep.",
    category: "foundations",
    premium: false,
    public: true,
    order: 1,
    chapters: [
      {
        title: "You already have it",
        blocks: [
          {
            type: "p",
            text: "You have taken somewhere around two hundred million breaths without being asked to think about a single one. The body handles it. That is a mercy — and it is also how something enormous became invisible.",
          },
          {
            type: "p",
            text: "BreathFLOW starts from a simple observation: the breath is the one part of the autonomic nervous system you can take hold of at will. You cannot decide to lower your heart rate. You can decide to lengthen an exhale, and your heart rate follows. That is not mysticism. That is anatomy, and it is available to you right now, for free, without preparation.",
          },
          {
            type: "quote",
            text: "The breath is the pathway back to feeling.",
          },
          {
            type: "p",
            text: "What we do with that access is where the practice begins.",
          },
        ],
      },
      {
        title: "Rooted in pranayama",
        blocks: [
          {
            type: "p",
            text: "BreathFLOW is inspired by pranayama — the yogic practice of consciously cultivating, regulating and directing prana, or life force, through the breath. That lineage is thousands of years old and belongs to a tradition none of us invented.",
          },
          {
            type: "p",
            text: "We want to be precise about two different kinds of language, because collapsing them does a disservice to both.",
          },
          {
            type: "list",
            items: [
              "Prana is a traditional philosophical concept. It describes a felt reality that practitioners have worked with for millennia. We use it because it is the honest name for what the practice is about.",
              "Nervous-system regulation, respiratory mechanics and stress physiology are modern science. They describe measurable things and they have limits.",
              "Both can be true in the same session. Neither needs to be dressed up as the other.",
            ],
          },
          {
            type: "p",
            text: "So when this app says life force, it means life force. When it says your exhale lengthens and your parasympathetic system responds, it means that. We will not hand you a physiology paper wearing spiritual clothes, or the reverse.",
          },
        ],
      },
      {
        title: "Two directions",
        blocks: [
          {
            type: "p",
            text: "Almost everything in the library moves in one of two directions. Learning to tell them apart is most of the skill.",
          },
          {
            type: "h",
            text: "Regulating",
          },
          {
            type: "p",
            text: "Slower. Longer exhale than inhale. Nothing forced. This settles an activated system — the racing chest, the shallow top-of-the-lungs breathing, the 3am spiral. Anxiety Relief and Evening Release live here.",
          },
          {
            type: "h",
            text: "Activating",
          },
          {
            type: "p",
            text: "Fuller, faster, more continuous. This wakes a flat system and moves energy that has been sitting still. The Grand Rising Method and Breath of Rapture live here. Activation is not better than regulation. It is a different tool, and using it on a system that is already overwhelmed will make things worse, not better.",
          },
          {
            type: "practice",
            slug: "three-minute-return",
            note: "If you are not sure which one you need, start here. Three minutes will usually tell you.",
          },
        ],
      },
      {
        title: "How to actually keep it",
        blocks: [
          {
            type: "p",
            text: "Most breath practices die the same way: someone has a profound forty-minute session, decides this is who they are now, and does not sit down again for five weeks.",
          },
          {
            type: "p",
            text: "Consistency beats intensity, and it is not close. A three-minute practice done daily will change more about how you meet your life than a monthly peak experience. This is why BreathFLOW counts days and Life Force Minutes rather than sessions completed.",
          },
          {
            type: "callout",
            tone: "warm",
            title: "If you miss a day",
            text: "Nothing is lost. The streak number is a mirror, not a judge — it exists to show you a relationship deepening, and relationships survive gaps. Begin again.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Is BreathFLOW a meditation app?",
        a: "No. Meditation generally asks you to observe what is happening. BreathFLOW asks you to change it — to use the breath deliberately to shift your state, and then to notice what shifted. Some sessions are quiet and some are physically demanding.",
      },
      {
        q: "Do I need experience to start?",
        a: "No. Start with the Three-Minute Return or the Grand Rising Method. The deeper journeys will still be there in a month, and they land differently once your body knows the basics.",
      },
      {
        q: "Can breathwork replace therapy or medical treatment?",
        a: "No, and we will never suggest otherwise. Conscious breathing can support relaxation, attention and emotional awareness. It does not diagnose, treat, cure or prevent any condition. If you are working with something serious, please work with a qualified professional — and bring the breath along as a companion to that care.",
      },
    ],
  },

  {
    slug: "grand-rising-method",
    title: "The Grand Rising Method",
    h1: "The Grand Rising Method: how the morning ritual works",
    description:
      "A walkthrough of the sixteen-minute morning activation — what each phase is doing, and why it goes in that order.",
    category: "practice",
    premium: false,
    public: true,
    order: 2,
    chapters: [
      {
        title: "Why mornings",
        blocks: [
          {
            type: "p",
            text: "There is a window between waking and the first demand on your attention. For most people it lasts about ninety seconds, and then a screen takes it.",
          },
          {
            type: "p",
            text: "The Grand Rising Method is designed to occupy that window on purpose. Not to optimise your morning — to decide what state you enter the day in, before the day decides for you.",
          },
        ],
      },
      {
        title: "The three movements",
        blocks: [
          {
            type: "h",
            text: "One — the body wakes",
          },
          {
            type: "p",
            text: "The first stretch is fuller and more rhythmic than your sleeping breath. Circulation moves, the ribcage opens, and the residual heaviness of sleep starts to lift. Some tingling in the hands or face is normal here.",
          },
          {
            type: "h",
            text: "Two — the mind clears",
          },
          {
            type: "p",
            text: "The pace steadies. This is where the mental noise of waking — the list, the dread, the replay of yesterday — has room to settle rather than being suppressed. You are not trying to empty your mind. You are giving it less to grip.",
          },
          {
            type: "h",
            text: "Three — intention",
          },
          {
            type: "p",
            text: "The breath slows and a single intention is set. Not a goal or a task. A quality — how you want to meet whatever arrives today.",
          },
          {
            type: "practice",
            slug: "grand-rising-method",
            note: "Sixteen minutes. Best done before your phone.",
          },
        ],
      },
      {
        title: "The first seven days",
        blocks: [
          {
            type: "p",
            text: "Give it a week before you judge it. The first two mornings often feel like effort — you are learning mechanics while half asleep, and part of your attention is busy feeling faintly ridiculous. That is not a sign it isn't working. It is a sign you are new.",
          },
          {
            type: "list",
            items: [
              "Days 1–2: getting the mechanics. Expect to feel slightly self-conscious, and expect the sixteen minutes to feel long.",
              "Days 3–4: the body starts anticipating it, and this is the genuinely hard bit — the novelty has gone and the benefit has not fully arrived. Most people who quit, quit here.",
              "Days 5–7: something turns over. The practice starts pulling you rather than the other way round, and the time stops registering as time.",
            ],
          },
          {
            type: "p",
            text: "If you miss a morning in that first week, do it later in the day rather than writing the week off. The anchor matters more once the habit exists; while you are building it, the only thing that counts is that the practice happened at all.",
          },
        ],
      },
      {
        title: "What people usually notice, and when",
        blocks: [
          {
            type: "p",
            text: "This is not a promise, and it is not a study — it is a pattern reported often enough by people practising daily that it is worth naming, so you know roughly what you are looking for.",
          },
          {
            type: "h",
            text: "In the session itself",
          },
          {
            type: "p",
            text: "Tingling in the hands, lips or face during the first movement is extremely common and entirely benign. It is a carbon-dioxide effect, not a sign of danger and not a sign of anything mystical. It settles as the pace steadies. If it becomes uncomfortable, slow down — the practice does not require you to push through sensation.",
          },
          {
            type: "h",
            text: "In the hour afterwards",
          },
          {
            type: "p",
            text: "Most people report feeling more awake than caffeine makes them, and less jittery with it. Some feel unexpectedly emotional, which is ordinary and usually passes within the hour.",
          },
          {
            type: "h",
            text: "After a few weeks",
          },
          {
            type: "p",
            text: "The change people most often describe is not in the sixteen minutes at all. It is a slightly longer gap between something happening and reacting to it — the moment where you notice you are about to snap, and don't. That gap is the whole point, and it is why consistency matters more than any single session.",
          },
          {
            type: "callout",
            tone: "caution",
            title: "When to stop and choose something gentler",
            text: "If you finish the Grand Rising feeling more wired and anxious rather than clearer, your system did not need activating today. That is useful information, not a failure. Switch to Anxiety Relief or the Three-Minute Return and come back to this tomorrow.",
          },
        ],
      },
      {
        title: "Common mistakes",
        blocks: [
          {
            type: "list",
            items: [
              "Doing it after your phone. The window this practice is designed to occupy has already been taken by then, and it is much harder to get back.",
              "Forcing the breath rather than fully allowing it. Full is not the same as forced — if your shoulders are climbing toward your ears, you are working too hard.",
              "Treating a missed morning as a verdict on your character. It is a missed morning.",
              "Doing it in bed and falling back asleep. That is a lovely outcome and a different practice; sit up if you actually want the activation.",
              "Skipping the intention at the end because it feels soft. It is the part that carries into the day.",
            ],
          },
          {
            type: "practice",
            slug: "three-minute-return",
            note: "On the mornings sixteen minutes genuinely is not available.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "What if I don't have sixteen minutes in the morning?",
        a: "Do the Three-Minute Return instead. It counts, it keeps your streak, and a three-minute practice you actually do beats a sixteen-minute one you keep postponing. Save the full method for the mornings that have room.",
      },
      {
        q: "Should I do it before or after coffee?",
        a: "Before, if you can. Caffeine raises the baseline activation the practice is trying to build deliberately, and the contrast is much clearer without it. But a version that fits your actual morning beats an ideal one you abandon.",
      },
      {
        q: "Why do my hands tingle?",
        a: "Fuller, faster breathing lowers carbon dioxide in the blood, which changes nerve excitability and produces tingling in the extremities and face. It is common, harmless in a seated practice, and it fades as the pace settles. Slow down if it is unpleasant.",
      },
    ],
  },

  {
    slug: "prana-life-force",
    title: "Breath, Prana, and Life Force",
    h1: "Breath, prana, and life force: what we mean by the words",
    description:
      "The traditional concept of prana, what modern physiology can and cannot say about it, and why we keep both.",
    category: "foundations",
    premium: false,
    public: true,
    order: 3,
    chapters: [
      {
        title: "An old word",
        blocks: [
          {
            type: "p",
            text: "Prana is usually translated as life force or vital energy. In the yogic tradition it is not a metaphor for oxygen — it is understood as the animating current that moves through a living body, and the breath is its most direct handle.",
          },
          {
            type: "p",
            text: "Ayama, the second half of pranayama, is more interesting than the usual translation of control. It carries a sense of extension and expansion. Pranayama is less about restraining the breath than about lengthening your relationship with it.",
          },
        ],
      },
      {
        title: "What science can say",
        blocks: [
          {
            type: "p",
            text: "There is real, replicated research on slow breathing — particularly on extending the exhale — and its effect on heart rate variability, vagal tone and self-reported anxiety. That research is genuinely encouraging and genuinely limited: modest sample sizes, short time horizons, and outcomes that lean on how people say they feel.",
          },
          {
            type: "p",
            text: "There is no measurement of prana. There is no instrument for it, and claiming one exists would be dishonest.",
          },
          {
            type: "callout",
            tone: "warm",
            title: "Both, held separately",
            text: "You do not have to choose. You can find the traditional framing meaningful and still be precise about what has been measured. That is what we are trying to model here — and it is why the app calls the number Life Force Minutes rather than something that sounds clinical.",
          },
        ],
      },
      {
        title: "What actually changes when you breathe differently",
        blocks: [
          {
            type: "p",
            text: "It is worth knowing the mechanism, partly because it is interesting and partly because knowing it removes the fear the first time something odd happens in your body.",
          },
          {
            type: "h",
            text: "Slowing down",
          },
          {
            type: "p",
            text: "When you lengthen the exhale relative to the inhale, you lean on the vagus nerve — the main parasympathetic pathway. Heart rate drops slightly on each exhale and rises on each inhale; making the exhale longer means more time in the calming half of that cycle. This is why almost every regulating practice in the world, from pranayama to military tactical breathing, ends up at some version of the same shape.",
          },
          {
            type: "h",
            text: "Speeding up",
          },
          {
            type: "p",
            text: "Faster, fuller breathing does not add meaningful oxygen — at rest you are already around 97% saturated, and you cannot push much past that. What it does is blow off carbon dioxide. Lower CO2 makes the blood more alkaline, which changes how nerves fire and how much oxygen your haemoglobin is willing to release into tissue.",
          },
          {
            type: "p",
            text: "That is the whole explanation for the tingling hands, the buzzing lips, the lightheadedness and much of the altered quality of an activating session. It is real, it is physiological, and it is reversible the moment you slow down.",
          },
          {
            type: "callout",
            tone: "caution",
            title: "Which is exactly why the rules exist",
            text: "The same CO2 drop that makes an activating practice feel extraordinary is what makes deliberate hyperventilation before a breath hold dangerous — it removes the urge to breathe without adding oxygen, so you can lose consciousness with no warning. Seated on land, that is a bad moment. In water, it is fatal.",
          },
        ],
      },
      {
        title: "Where the traditional and the physiological meet",
        blocks: [
          {
            type: "p",
            text: "Here is the honest position. The physiological account above explains a great deal of what happens in a breath session. It does not obviously explain everything people report — the sense of something moving, the emotion that arrives with no accompanying thought, the specific quality of aliveness after a long journey.",
          },
          {
            type: "p",
            text: "Two responses are available. One is to insist those experiences are nothing but CO2 and expectation. The other is to insist they prove an energy science has failed to detect. Both are overconfident.",
          },
          {
            type: "p",
            text: "The practitioner's position — and ours — is more modest: something reliably happens, the traditional vocabulary describes it better than the clinical one does, and neither of those facts requires the other to be false.",
          },
          {
            type: "quote",
            text: "Practise the breath. Harness your life force.",
          },
          {
            type: "practice",
            slug: "grand-rising-method",
            note: "The clearest place to feel the difference between the two directions.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Is prana the same as oxygen?",
        a: "No. Oxygen is a molecule with a measurable partial pressure in your blood. Prana is a concept from a philosophical tradition describing an animating vitality. They are related in the sense that both travel with the breath, but they are not the same claim and we do not present them as one.",
      },
      {
        q: "Does breathwork increase oxygen in the body?",
        a: "Not usefully — at rest your blood is already about 97% oxygen-saturated, and you cannot meaningfully raise that by breathing harder. What fast breathing actually changes is carbon dioxide, which drops. That shift in CO2 is what produces the tingling, the lightheadedness and much of the altered feeling in activating practices. It is a real physiological effect, and it is worth understanding rather than mystifying.",
      },
    ],
  },

  {
    slug: "activation-vs-regulation",
    title: "Activation versus regulation",
    h1: "Activation versus regulation: choosing the right practice today",
    description:
      "How to tell whether you need to settle your system or wake it up — and why choosing wrong makes things worse.",
    category: "practice",
    premium: false,
    public: true,
    order: 4,
    chapters: [
      {
        title: "The most common mistake",
        blocks: [
          {
            type: "p",
            text: "Someone feels awful, opens a breathwork app, and picks the most intense thing in it. Twenty minutes later they feel worse and conclude breathwork is not for them.",
          },
          {
            type: "p",
            text: "Almost always, they needed the opposite. An already-activated nervous system — the tight chest, the shallow fast breath, the sense of being wired — does not need more activation. It needs somewhere to land.",
          },
        ],
      },
      {
        title: "A quick read on your own state",
        blocks: [
          {
            type: "h",
            text: "Signs you want regulating",
          },
          {
            type: "list",
            items: [
              "Your breath is already high and fast in the chest.",
              "Thoughts are racing or looping.",
              "You feel jumpy, irritable, or braced.",
              "Sleep has been poor.",
            ],
          },
          {
            type: "practice",
            slug: "anxiety-relief",
            note: "Gentle, no retention, longer exhale than inhale.",
          },
          {
            type: "h",
            text: "Signs you want activating",
          },
          {
            type: "list",
            items: [
              "Flat, foggy, heavy.",
              "Emotionally numb rather than emotionally flooded.",
              "Procrastinating on something you actually want to do.",
              "You have been sitting still for a long time.",
            ],
          },
          {
            type: "practice",
            slug: "flow-state-reset",
            note: "Rhythmic and clarifying. Follow it immediately with the work.",
          },
        ],
      },
      {
        title: "When you genuinely cannot tell",
        blocks: [
          {
            type: "p",
            text: "Take the Three-Minute Return. It is neutral enough to be safe in either state, and three minutes of paying attention usually answers the question better than analysis does.",
          },
          {
            type: "p",
            text: "There is also a confusing middle state worth naming: exhausted and wired at the same time. Flat, unable to focus, and yet unable to settle. It feels like it needs activation because of the flatness, but activating it usually makes the wired part worse.",
          },
          {
            type: "p",
            text: "Regulate first. Get the system down, and then decide whether it wants waking. Almost nobody regrets that order; plenty of people regret the other one.",
          },
        ],
      },
      {
        title: "Why choosing wrong makes things worse",
        blocks: [
          {
            type: "p",
            text: "This is not a matter of taste. Activating breathwork deliberately lowers carbon dioxide, which produces tingling, lightheadedness and a heightened, buzzy quality.",
          },
          {
            type: "p",
            text: "In a settled system that reads as energy and aliveness. In a system already running on adrenaline, the same sensations get interpreted by a frightened brain as evidence that something is wrong — and a panicky mind reading its own racing body as danger is close to the definition of a panic attack.",
          },
          {
            type: "p",
            text: "So the person who most needs help is the one most likely to be harmed by the wrong choice, and least equipped in the moment to make the right one. That is precisely why the app puts Anxiety Relief one tap from the home screen and does not make you browse a library to find it.",
          },
          {
            type: "callout",
            tone: "caution",
            title: "If it is already happening",
            text: "If you have started an activating practice and it is tipping toward panic, stop. Do not push through. Breathe normally through the nose, make the exhale longer than the inhale, and put your attention on something physical — the floor under you, the temperature of the air. It passes. It always passes.",
          },
        ],
      },
      {
        title: "A rough map",
        blocks: [
          {
            type: "list",
            items: [
              "Panicking or spiralling → Anxiety Relief. Gentle, no retention, long exhale.",
              "Wired and tired → regulate first, then reassess. Do not activate.",
              "Flat, foggy, procrastinating → Flow State Reset.",
              "Just woken up → the Grand Rising Method.",
              "Wound up at the end of the day → Evening Release.",
              "Numb, closed, nothing much moving for weeks → Inner Child or Breath of Rapture, with time cleared afterwards.",
              "No idea → the Three-Minute Return.",
            ],
          },
          {
            type: "p",
            text: "None of this is fixed. The map is a starting point, and your own read on your state will get better with practice — which is itself one of the more useful things the practice trains.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Can breathwork make anxiety worse?",
        a: "Yes, if you pick an activating practice while already anxious. Fast breathing lowers carbon dioxide and produces tingling and lightheadedness, and an anxious brain often reads those sensations as danger. Gentle, slow practices with a lengthened exhale do the opposite and are appropriate for almost everyone.",
      },
      {
        q: "How do I know if I'm over-activated or under-activated?",
        a: "Look at your breath before you change anything. High, fast and shallow in the chest usually means over-activated — you want regulating. Slow, shallow and heavy, with a general sense of fog, usually means under-activated. If you are both wired and exhausted, regulate first.",
      },
    ],
  },

  {
    slug: "retention-basics",
    title: "Breath retention: basics and safety",
    h1: "Breath retention: how to practise it safely",
    description:
      "What retention is for, how to log it without turning it into a competition, and the rules that are not negotiable.",
    category: "safety",
    premium: false,
    public: true,
    order: 5,
    chapters: [
      {
        title: "Read this part first",
        blocks: [
          SAFETY_CALLOUT,
          {
            type: "p",
            text: "That is not boilerplate. Shallow water blackout kills experienced breath-hold divers every year, and it happens without warning. The rule is simple: never in or near water, never in a moving vehicle, never anywhere a sudden loss of consciousness would cause harm.",
          },
        ],
      },
      {
        title: "What retention is actually training",
        blocks: [
          {
            type: "p",
            text: "The urge to breathe is not caused by running out of oxygen. It is triggered by rising carbon dioxide, and it arrives long before you are in any danger.",
          },
          {
            type: "p",
            text: "Retention practice is mostly training your relationship with that urge — noticing it arrive, staying calm inside it, and choosing when to respond. That is a transferable skill, and it is the real reason the number tends to grow.",
          },
        ],
      },
      {
        title: "How to practise it",
        blocks: [
          {
            type: "list",
            items: [
              "Sit or lie down. Always.",
              "Breathe normally first. Do not hyperventilate to inflate the number — that is exactly the practice that causes blackouts.",
              "Hold after a comfortable exhale to begin with. It is gentler and more honest than holding after a full inhale.",
              "Release when the urge becomes strong, not when it becomes unbearable.",
              "Log how it felt, not just how long it was.",
            ],
          },
          {
            type: "callout",
            tone: "warm",
            title: "The number is a side effect",
            text: "BreathFLOW shows you a trend line because progress is motivating. It deliberately does not show you anyone else's. There is no leaderboard, and comparing your hold to a stranger's is the fastest way to make a safe practice unsafe.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "How long should I be able to hold my breath?",
        a: "There is no should. Comfortable, controlled progress in your own numbers is the entire goal. A hold that felt calm at forty seconds is a better session than a strained one at ninety.",
      },
      {
        q: "Is it dangerous to practise breath retention?",
        a: "It can be, in specific and avoidable circumstances — in water, while driving, standing somewhere you could fall, or after deliberate hyperventilation. Practised seated or lying down on land, with a normal breath beforehand, it is a mild and ordinary practice. Follow the rules and they stay boring, which is the point.",
      },
    ],
  },

  {
    slug: "daily-ritual",
    title: "How to build a daily ritual",
    h1: "How to build a daily breath ritual that survives a real life",
    description:
      "Anchoring, sizing and protecting a daily practice — including what to do on the days it falls apart.",
    category: "practice",
    premium: false,
    public: true,
    order: 6,
    chapters: [
      {
        title: "Anchor it to something that already happens",
        blocks: [
          {
            type: "p",
            text: "Intentions fail. Anchors hold. Attach the practice to something already immovable in your day — the kettle going on, sitting down in the car before you drive, the moment the last child is finally asleep.",
          },
          {
            type: "p",
            text: "The anchor matters more than the time of day. A practice at an unreliable 7am loses to one that reliably follows your first coffee.",
          },
        ],
      },
      {
        title: "Size it for your worst day, not your best",
        blocks: [
          {
            type: "p",
            text: "If you design your ritual around sixteen unhurried minutes, it will not survive the week you get ill, travel, and lose a night's sleep. Design it around three minutes, and let the good days be longer than planned.",
          },
          {
            type: "practice",
            slug: "three-minute-return",
            note: "This is the floor. Anything above it is a bonus.",
          },
        ],
      },
      {
        title: "The day it falls apart",
        blocks: [
          {
            type: "p",
            text: "You will miss days. Everyone does. The only thing that reliably ends a practice is not the missed day — it is the story that follows it, the one about not being the kind of person who keeps things up.",
          },
          {
            type: "p",
            text: "That story is why streak counters can be actively harmful. A number that only ever goes up creates something to lose, and the day you lose it, quitting feels cleaner than starting from one. So BreathFLOW keeps the number, because seeing a rhythm is genuinely motivating, and deliberately removes the loss framing around it. There is no broken-heart icon, no red, no scolding.",
          },
          {
            type: "quote",
            text: "Your practice is still here. Begin again.",
          },
          {
            type: "p",
            text: "If you have missed a week, do not attempt to make it up. Do three minutes today. The debt is imaginary; the practice is not.",
          },
        ],
      },
      {
        title: "Make the first thirty seconds effortless",
        blocks: [
          {
            type: "p",
            text: "Nearly all the resistance in a daily practice lives in the transition into it, not in the practice itself. Nobody is thirteen minutes into the Grand Rising thinking about quitting. They quit on the sofa, deciding whether to start.",
          },
          {
            type: "p",
            text: "So spend your effort on the thirty seconds before, not the sixteen minutes after.",
          },
          {
            type: "list",
            items: [
              "Decide the night before which practice you are doing. A decision made at 6am by a tired person is a decision made badly.",
              "Have the place ready. A cushion that lives where you practise removes an entire step.",
              "Put the phone on the other side of the room, screen down, before you sit.",
              "Lower the bar out loud: 'I am doing three minutes.' You can always do more once you have started, and you almost always will.",
            ],
          },
        ],
      },
      {
        title: "Let it change shape",
        blocks: [
          {
            type: "p",
            text: "A practice that cannot change is a practice that breaks the first time your life does. New baby, new job, illness, travel, grief — all of these will make your current arrangement impossible, and none of them mean you have to stop.",
          },
          {
            type: "p",
            text: "The thing to protect is the daily contact, not the format. Sixteen minutes becomes three. Morning becomes whenever. Sitting becomes lying down. The practice survives all of that; what it does not survive is being paused until conditions improve.",
          },
          {
            type: "practice",
            slug: "evening-release",
            note: "For the seasons when mornings genuinely belong to someone else.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "How long does it take to build a daily breathing habit?",
        a: "Most people report the practice starting to pull them rather than requiring effort somewhere between two and four weeks of near-daily contact. The commonly repeated 21-day figure has no strong evidence behind it — real habit research suggests it varies enormously between people and behaviours.",
      },
      {
        q: "Is it better to practise at the same time every day?",
        a: "It helps, but the anchor matters more than the clock. A practice reliably attached to something that already happens — the kettle, the car, the last child asleep — beats a practice scheduled for a time your life does not reliably contain.",
      },
      {
        q: "What if I miss several days in a row?",
        a: "Do three minutes today and do not try to make up the missed time. The gap costs you nothing that a single session does not restore, and treating it as a debt is the fastest way to stop entirely.",
      },
    ],
  },

  {
    slug: "integration",
    title: "Integration after a deep journey",
    h1: "Integration: what to do after a deep breath journey",
    description:
      "The hours after Breath of Rapture matter as much as the session. How to land well.",
    category: "integration",
    premium: false,
    public: true,
    order: 7,
    chapters: [
      {
        title: "The session is not the whole practice",
        blocks: [
          {
            type: "p",
            text: "A long activating journey can move a great deal in forty minutes. What you do in the two hours afterwards decides how much of it stays with you — and whether you land softly or spend the evening slightly raw and wondering why.",
          },
        ],
      },
      {
        title: "The first twenty minutes",
        blocks: [
          {
            type: "list",
            items: [
              "Stay lying down longer than you think you need to.",
              "Drink water. Eat something if you are shaky.",
              "Do not immediately pick up your phone. The contrast is jarring and it wastes the state you just built.",
              "Do not drive straight away.",
            ],
          },
        ],
      },
      {
        title: "The rest of the day",
        blocks: [
          {
            type: "p",
            text: "Write something down, even badly. A single honest line in the session note is worth more than a perfect reflection you never make.",
          },
          {
            type: "p",
            text: "Expect the emotional weather to be a little unusual for a day or so — more tender, more easily moved, occasionally tired. That is ordinary. If it lasts, or if something surfaced that feels too big to hold on your own, that is a signal to talk to a qualified therapist, not to breathe harder.",
          },
          {
            type: "callout",
            tone: "caution",
            title: "When to reach for support instead",
            text: "If a practice leaves you feeling unsafe, persistently dissociated, or in crisis, stop practising the deep journeys and speak to a qualified mental-health professional. BreathFLOW is not emergency support. If you are in immediate danger, contact your local emergency services.",
          },
        ],
      },
      {
        title: "Plan the landing before you take off",
        blocks: [
          {
            type: "p",
            text: "The single most common integration mistake is scheduling. People book forty minutes for a forty-minute journey, and then wonder why the rest of the evening feels strange.",
          },
          {
            type: "p",
            text: "Before you press play on a deep practice, decide three things.",
          },
          {
            type: "list",
            items: [
              "What happens in the twenty minutes afterwards. Not a task — a soft, undemanding thing. Tea. A shower. Lying on the floor.",
              "Whether anyone needs you in the next two hours. If they do, this is not the day.",
              "Who you would text if something surfaced that felt like too much. You will almost certainly not need to. Knowing the answer changes how safely you can let go.",
            ],
          },
          {
            type: "p",
            text: "That is the whole plan, and it takes a minute to make. It is the difference between a practice that lands and one that leaves you rattled.",
          },
        ],
      },
      {
        title: "The week after",
        blocks: [
          {
            type: "p",
            text: "Deep sessions have a tail. Expect the following few days to be slightly more permeable than usual — more easily moved by music, more patient in some places and less in others, occasionally very tired.",
          },
          {
            type: "p",
            text: "This is not a warning. It is one of the more useful parts of the whole thing: what surfaces in the days after a journey often says more than anything that happened during it.",
          },
          {
            type: "h",
            text: "Do less, not more",
          },
          {
            type: "p",
            text: "The instinct after a powerful session is to go again. Resist it. Doing Breath of Rapture twice in a week does not double anything — it mostly guarantees that neither one gets integrated, and the practice becomes a series of experiences rather than a process.",
          },
          {
            type: "p",
            text: "Once every week or two is plenty for most people. The daily practice is the Grand Rising Method; the deep journeys are punctuation, not the sentence.",
          },
          {
            type: "practice",
            slug: "three-minute-return",
            note: "The right thing to do the morning after, when a long session would be too much.",
          },
        ],
      },
      {
        title: "Writing it down",
        blocks: [
          {
            type: "p",
            text: "Whatever happened will feel unforgettable for about four hours, and then it will start to compress into a summary. The summary is not the same thing, and it loses the parts that turn out to matter.",
          },
          {
            type: "p",
            text: "So write while it is still awkward and unresolved. Not what it meant — what it was. Where it sat in the body. What arrived without being invited. What you noticed yourself avoiding.",
          },
          {
            type: "p",
            text: "Meaning can come later, and usually does, once you can read three of these next to each other and see the thing you kept circling.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "How often should I do a deep breath journey?",
        a: "For most people, once every week or two at most. The daily practice does the work; the long journeys are punctuation. Doing them back to back tends to mean neither one gets integrated.",
      },
      {
        q: "Is it normal to feel emotional for days afterwards?",
        a: "Feeling more tender or easily moved for a day or two is common and usually settles on its own. If it lasts longer, or if something surfaced that feels too big to hold alone, that is a signal to speak with a qualified therapist rather than to practise harder.",
      },
    ],
  },

  {
    slug: "journal-prompts",
    title: "Journal prompts",
    h1: "Journal prompts for feeling, flow, and the stories that limit you",
    description:
      "Prompts to use after a practice, when the state is still open and the answers are more honest.",
    category: "integration",
    premium: false,
    public: true,
    order: 8,
    chapters: [
      {
        title: "Use these while the state is still open",
        blocks: [
          {
            type: "p",
            text: "The most useful answers arrive in the ten minutes after a practice, before the ordinary mind has finished reassembling. Write fast and badly.",
          },
        ],
      },
      {
        title: "Feeling",
        blocks: [
          {
            type: "list",
            items: [
              "Where in my body did I meet resistance today?",
              "What did I notice that I would normally move past?",
              "What am I not letting myself feel about this week?",
              "If the tension in my chest could speak, what is it actually saying?",
            ],
          },
        ],
      },
      {
        title: "Flow",
        blocks: [
          {
            type: "list",
            items: [
              "When did I last lose track of time, and what was I doing?",
              "What am I avoiding starting, and what is the real reason?",
              "What would I make this week if no one was going to see it?",
            ],
          },
        ],
      },
      {
        title: "The stories that limit",
        blocks: [
          {
            type: "list",
            items: [
              "What do I believe about myself that I have never actually tested?",
              "Whose voice is that belief in?",
              "What becomes possible if it turns out not to be true?",
              "What is one small thing I could do this week as if it were already untrue?",
              "What am I protecting by keeping this belief?",
            ],
          },
          {
            type: "p",
            text: "That last one is the useful one, and the one people skip. Limiting beliefs are rarely irrational — they are usually load-bearing. Something got protected by deciding you were not the kind of person who does that. Finding out what tends to matter more than arguing with the belief itself.",
          },
        ],
      },
      {
        title: "How to use these without turning it into homework",
        blocks: [
          {
            type: "p",
            text: "Take one prompt, not the list. The list is there so you have something to choose from on a morning when nothing occurs to you, not so you can work through it.",
          },
          {
            type: "list",
            items: [
              "Set a limit before you start — three lines, or four minutes. A blank page with no edge invites performance.",
              "Write the first answer, not the best one. The best one is usually the one you have said before.",
              "If you notice yourself writing for a reader, stop and write the sentence you would not want read.",
              "Do not reread it the same day. It will look either profound or embarrassing, and neither reading is accurate yet.",
            ],
          },
          {
            type: "callout",
            tone: "warm",
            title: "Your notes stay yours",
            text: "Anything you write in a session reflection is private to your account. It is never shown on a share card, never included in analytics, and never sent anywhere. When you export your data it comes with you; when you delete your account it is deleted.",
          },
        ],
      },
      {
        title: "Reading them back",
        blocks: [
          {
            type: "p",
            text: "Once a month, read the last few weeks in one sitting. This is where journalling stops being a nice ritual and starts being useful.",
          },
          {
            type: "p",
            text: "You are not looking for insight. You are looking for repetition — the same body part, the same person, the same avoided sentence appearing in three entries you wrote without remembering the others. That repetition is the actual signal, and it is invisible from inside any single day.",
          },
          {
            type: "practice",
            slug: "inner-child",
            note: "When the same thing keeps appearing and you are ready to sit with it properly.",
          },
        ],
      },
    ],
  },
] as const;

export const GUIDE_BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));

export function getGuide(slug: string): Guide | undefined {
  return GUIDE_BY_SLUG.get(slug);
}

export function orderedGuides(): Guide[] {
  return [...GUIDES].sort((a, b) => a.order - b.order);
}

export function publicGuides(): Guide[] {
  return orderedGuides().filter((g) => g.public);
}

const WORDS_PER_MINUTE = 190;

/** Estimated reading time in minutes, minimum one. */
export function readingMinutes(guide: Guide): number {
  let words = 0;
  for (const chapter of guide.chapters) {
    words += chapter.title.split(/\s+/).length;
    for (const block of chapter.blocks) {
      if (block.type === "list") {
        words += block.items.join(" ").split(/\s+/).length;
      } else if (block.type === "callout") {
        words += `${block.title} ${block.text}`.split(/\s+/).length;
      } else if (block.type === "practice") {
        words += block.note.split(/\s+/).length;
      } else {
        words += block.text.split(/\s+/).length;
      }
    }
  }
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Every practice slug referenced from inside a guide. Pinned by tests. */
export function referencedPracticeSlugs(): string[] {
  const slugs = new Set<string>();
  for (const guide of GUIDES) {
    for (const chapter of guide.chapters) {
      for (const block of chapter.blocks) {
        if (block.type === "practice") slugs.add(block.slug);
      }
    }
  }
  return [...slugs];
}
