import { Form, Link, data, redirect } from "react-router";
import { safeFormData } from "~/lib/form.server";
import type { Route } from "./+types/step";
import { envFrom, runtimeFrom } from "~/lib/context";
import { getUser } from "~/lib/auth.server";
import {
  EXPERIENCE_LEVELS,
  INTENTIONS,
  MAX_INTENTIONS,
  PRACTICE_TIMES,
  type Step,
  firstInvitationSlug,
  isStep,
  nextStep,
  stepIndex,
  STEPS,
} from "~/lib/onboarding";
import {
  applyDraft,
  clearDraft,
  mergeDraft,
  readDraft,
  writeDraft,
} from "~/lib/onboarding.server";
import { EVENTS, track } from "~/lib/analytics.server";
import { getPractice } from "~/content/practices";
import { humanDuration } from "~/lib/time";
import { Button, CoreQuote, Wordmark } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env, ctx } = runtimeFrom(context);
  const step: Step = params.step && isStep(params.step) ? params.step : "welcome";

  const user = await getUser(request, env);
  const draft = readDraft(request);

  // A signed-in user who has already finished has nothing to do here.
  if (user?.onboarded_at && step !== "first-breath") {
    throw redirect("/home");
  }

  // "account" is where we hand off to the real signup form.
  if (step === "account" && !user) throw redirect("/signup");
  if (step === "account" && user) throw redirect("/welcome/first-breath");

  // The final step needs an account, and is where the draft becomes real.
  if (step === "first-breath") {
    if (!user) throw redirect("/signup");
    if (!user.onboarded_at) {
      // Reaching this screen is what "onboarded" means.
      await applyDraft(env, user.id, draft, { markOnboarded: true });
      ctx.waitUntil(
        track(env, {
          name: EVENTS.onboardingCompleted,
          orgId: user.org_id,
          userId: user.id,
          props: {
            intentions: draft.intentions ?? "",
            experience: draft.experience ?? "",
          },
        }),
      );
    }

    const slug = firstInvitationSlug(draft.experience ?? user.experience_level);
    const practice = getPractice(slug)!;

    return data(
      {
        step,
        draft,
        name: user.name,
        invitation: {
          slug: practice.slug,
          title: practice.title,
          outcome: practice.outcome,
          seconds: practice.seconds,
        },
      },
      // The draft has been applied to the account — stop carrying it around.
      { headers: { "Set-Cookie": clearDraft() } },
    );
  }

  if (step === "welcome") {
    ctx.waitUntil(
      track(env, { name: EVENTS.onboardingStarted, userId: user?.id ?? null }),
    );
  }

  return data({
    step,
    draft,
    name: user?.name ?? "",
    invitation: null as {
      slug: string;
      title: string;
      outcome: string;
      seconds: number;
    } | null,
  });
}

export function headers() {
  return privateNoStore();
}

export function meta() {
  return [
    { title: "Welcome home · BreathFLOW" },
    { name: "robots", content: "noindex" },
  ];
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const env = envFrom(context);
  const step: Step = params.step && isStep(params.step) ? params.step : "welcome";
  const form = await safeFormData(request);

  const draft = mergeDraft(readDraft(request), form);
  const target = nextStep(step) ?? "first-breath";

  // If they are already signed in (came back to change an answer), write
  // straight through rather than leaving it in a cookie.
  const user = await getUser(request, env);
  // Save answers straight through if they are already signed in (they came
  // back to change one), but do not mark them finished — only the final screen
  // does that.
  if (user) await applyDraft(env, user.id, draft);


  return redirect(`/welcome/${target}`, {
    headers: { "Set-Cookie": writeDraft(draft) },
  });
}

export default function OnboardingStep({ loaderData }: Route.ComponentProps) {
  const { step, draft, name, invitation } = loaderData as {
    step: Step;
    draft: {
      intentions?: string;
      experience?: string;
      practiceTime?: string;
      safetyAck?: boolean;
    };
    name: string;
    invitation: {
      slug: string;
      title: string;
      outcome: string;
      seconds: number;
    } | null;
  };

  return (
    <div className="flex min-h-dvh flex-col px-6 py-10">
      <Progress step={step} />

      <div className="flex flex-1 flex-col items-center justify-center py-8">
        <div className="w-full max-w-md">
          {step === "welcome" ? <Welcome /> : null}
          {step === "roots" ? <Roots /> : null}
          {step === "quote" ? <Quote /> : null}
          {step === "intention" ? <Intention draft={draft} /> : null}
          {step === "experience" ? <Experience draft={draft} /> : null}
          {step === "rhythm" ? <Rhythm draft={draft} /> : null}
          {step === "safety" ? <Safety /> : null}
          {step === "first-breath" ? (
            <FirstBreath name={name} invitation={invitation!} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A quiet row of dots. Progress, not pressure. */
function Progress({ step }: { step: Step }) {
  const index = stepIndex(step);
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="progressbar"
      aria-valuenow={index + 1}
      aria-valuemin={1}
      aria-valuemax={STEPS.length}
      aria-label={`Step ${index + 1} of ${STEPS.length}`}
    >
      {STEPS.map((s, i) => (
        <span
          key={s}
          className={`h-1 rounded-full transition-all duration-700 ${
            i <= index
              ? "w-6 bg-[var(--color-amber-bright)]"
              : "w-2 bg-[color-mix(in_oklab,var(--color-bone)_18%,transparent)]"
          }`}
        />
      ))}
    </div>
  );
}

function Orb({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`bf-orb-motion mx-auto h-28 w-28 rounded-full bg-[radial-gradient(circle_at_38%_32%,rgba(244,239,229,0.95)_0%,var(--color-amber)_45%,transparent_72%)] ${className}`}
      style={{ animation: "bf-breathe 11s var(--ease-breath) infinite" }}
    />
  );
}

function Welcome() {
  return (
    <div className="text-center">
      <Wordmark className="text-xs text-[var(--color-bone-faint)]" />
      <Orb className="my-12" />
      <h1 className="font-serif text-3xl leading-snug text-[var(--color-bone)]">
        Welcome home.
        <br />
        Your breath has been waiting for you.
      </h1>
      <Form method="post" className="mt-12">
        <Button type="submit" size="lg" className="w-full">
          Come in
        </Button>
      </Form>
      <p className="mt-6 text-sm text-[var(--color-bone-faint)]">
        Already practising?{" "}
        <Link to="/login" className="underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Roots() {
  return (
    <div className="text-center">
      <Orb className="mb-12 opacity-80" />
      <h1 className="font-serif text-2xl leading-relaxed text-[var(--color-bone)]">
        Rooted in pranayama, BreathFLOW helps you cultivate and direct your
        life force through conscious breathing.
      </h1>
      <p className="mt-6 text-sm leading-relaxed text-[var(--color-bone-muted)]">
        An ancient practice, translated into rituals that fit inside an
        ordinary day.
      </p>
      <Form method="post" className="mt-12">
        <Button type="submit" size="lg" className="w-full">
          Continue
        </Button>
      </Form>
    </div>
  );
}

function Quote() {
  return (
    <div className="text-center">
      {/* Reproduced exactly. This one is never paraphrased. */}
      <CoreQuote />
      <Form method="post" className="mt-12">
        <Button type="submit" size="lg" className="w-full">
          Continue
        </Button>
      </Form>
    </div>
  );
}

function Intention({ draft }: { draft: { intentions?: string } }) {
  const selected = new Set((draft.intentions ?? "").split(",").filter(Boolean));

  return (
    <div>
      <h1 className="text-center font-serif text-3xl text-[var(--color-bone)]">
        What brings you here?
      </h1>
      <p className="mt-3 text-center text-sm text-[var(--color-bone-muted)]">
        Choose one or two. You can change this any time.
      </p>

      <Form method="post" className="mt-8 space-y-3">
        <fieldset>
          <legend className="sr-only">
            Your intention — choose up to {MAX_INTENTIONS}
          </legend>
          {INTENTIONS.map((intention) => (
            <label
              key={intention.value}
              className="mb-3 flex cursor-pointer items-start gap-4 rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_5%,transparent)] p-4 transition has-[:checked]:border-[var(--color-amber-bright)] has-[:checked]:bg-[color-mix(in_oklab,var(--color-amber)_14%,transparent)]"
            >
              <input
                type="checkbox"
                name="intention"
                value={intention.value}
                defaultChecked={selected.has(intention.value)}
                className="mt-1 h-5 w-5 accent-[var(--color-amber-bright)]"
              />
              <span>
                <span className="block text-[var(--color-bone)]">
                  {intention.label}
                </span>
                <span className="mt-0.5 block text-sm text-[var(--color-bone-faint)]">
                  {intention.sub}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <Button type="submit" size="lg" className="w-full">
          Continue
        </Button>
        <SkipLink />
      </Form>
    </div>
  );
}

function Experience({ draft }: { draft: { experience?: string } }) {
  return (
    <div>
      <h1 className="text-center font-serif text-3xl text-[var(--color-bone)]">
        Where are you starting from?
      </h1>
      <p className="mt-3 text-center text-sm text-[var(--color-bone-muted)]">
        There is no wrong answer, and no wrong place to begin.
      </p>

      <Form method="post" className="mt-8 space-y-3">
        <fieldset>
          <legend className="sr-only">Your experience level</legend>
          {EXPERIENCE_LEVELS.map((level) => (
            <label
              key={level.value}
              className="mb-3 flex cursor-pointer items-start gap-4 rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_5%,transparent)] p-4 transition has-[:checked]:border-[var(--color-amber-bright)] has-[:checked]:bg-[color-mix(in_oklab,var(--color-amber)_14%,transparent)]"
            >
              <input
                type="radio"
                name="experience"
                value={level.value}
                defaultChecked={draft.experience === level.value}
                className="mt-1 h-5 w-5 accent-[var(--color-amber-bright)]"
              />
              <span>
                <span className="block text-[var(--color-bone)]">
                  {level.label}
                </span>
                <span className="mt-0.5 block text-sm text-[var(--color-bone-faint)]">
                  {level.sub}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <Button type="submit" size="lg" className="w-full">
          Continue
        </Button>
        <SkipLink />
      </Form>
    </div>
  );
}

function Rhythm({ draft }: { draft: { practiceTime?: string } }) {
  return (
    <div>
      <h1 className="text-center font-serif text-3xl text-[var(--color-bone)]">
        When will you practise?
      </h1>
      <p className="mt-3 text-center text-sm text-[var(--color-bone-muted)]">
        We&rsquo;ll send at most one gentle reminder a day. You can turn it off
        whenever you like.
      </p>

      <Form method="post" className="mt-8">
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="sr-only">Your preferred time of day</legend>
          {PRACTICE_TIMES.map((time) => (
            <label
              key={time.value}
              className="flex cursor-pointer items-center justify-center rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_5%,transparent)] p-5 text-center transition has-[:checked]:border-[var(--color-amber-bright)] has-[:checked]:bg-[color-mix(in_oklab,var(--color-amber)_14%,transparent)]"
            >
              <input
                type="radio"
                name="practiceTime"
                value={time.value}
                defaultChecked={draft.practiceTime === time.value}
                className="sr-only"
              />
              <span className="text-[var(--color-bone)]">{time.label}</span>
            </label>
          ))}
        </fieldset>

        <Button type="submit" size="lg" className="mt-6 w-full">
          Continue
        </Button>
        <SkipLink />
      </Form>
    </div>
  );
}

function Safety() {
  return (
    <div>
      <h1 className="text-center font-serif text-3xl text-[var(--color-bone)]">
        One agreement before we begin
      </h1>

      <div className="mt-8 space-y-4 rounded-2xl border border-[color-mix(in_oklab,var(--color-copper)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-copper)_12%,transparent)] p-5 text-sm leading-relaxed text-[var(--color-bone-muted)]">
        <p>
          Practise seated or lying down, somewhere you are safe to stay for the
          whole session.
        </p>
        <p>
          Never practise breath retention in or near water, while driving, or
          anywhere a loss of consciousness could hurt you.
        </p>
        <p>
          Stop immediately if you feel pain, sharp dizziness, panic or
          distress. Progress should be comfortable and controlled, never
          forced.
        </p>
        <p>
          BreathFLOW is a wellbeing practice, not healthcare. If you are
          pregnant, or live with a cardiovascular condition, epilepsy,
          glaucoma, or a history of psychosis or severe panic — or if you are
          simply unsure — please talk to a qualified healthcare professional
          before practising activating breath or retention.
        </p>
      </div>

      <Form method="post" className="mt-6">
        {/* This is the one step that cannot be skipped. */}
        <input type="hidden" name="safetyAck" value="yes" />
        <Button type="submit" size="lg" className="w-full">
          I understand, and I&rsquo;ll practise safely
        </Button>
      </Form>

      <p className="mt-4 text-center text-xs text-[var(--color-bone-faint)]">
        You can read the full{" "}
        <Link to="/safety" className="underline underline-offset-4">
          safety guidance
        </Link>{" "}
        any time.
      </p>
    </div>
  );
}

function FirstBreath({
  name,
  invitation,
}: {
  name: string;
  invitation: { slug: string; title: string; outcome: string; seconds: number };
}) {
  const first = name.trim().split(/\s+/)[0];

  return (
    <div className="text-center">
      <Orb className="mb-10" />
      <h1 className="font-serif text-3xl leading-snug text-[var(--color-bone)]">
        {first ? `You're here, ${first}.` : "You're here."}
      </h1>
      <p className="mt-4 text-[var(--color-bone-muted)]">
        Everything is set up. There is only one thing left to do.
      </p>

      <div className="mt-10 rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-bone-faint)]">
          Begin with
        </p>
        <h2 className="mt-3 font-serif text-2xl text-[var(--color-bone)]">
          {invitation.title}
        </h2>
        <p className="mt-2 text-sm text-[var(--color-bone-muted)]">
          {invitation.outcome}
        </p>
        <p className="mt-3 text-sm text-[var(--color-bone-faint)]">
          {humanDuration(invitation.seconds)}
        </p>
      </div>

      <Button to={`/play/${invitation.slug}`} size="lg" className="mt-8 w-full">
        Begin your first breath
      </Button>
      <p className="mt-5 text-sm text-[var(--color-bone-faint)]">
        <Link to="/home" className="underline underline-offset-4">
          Or look around first
        </Link>
      </p>
    </div>
  );
}

/** Nonessential personalisation is always skippable, per the brief. */
function SkipLink() {
  return (
    <button
      type="submit"
      name="skip"
      value="yes"
      className="mx-auto block pt-2 text-sm text-[var(--color-bone-faint)] underline underline-offset-4 transition hover:text-[var(--color-bone-muted)]"
    >
      Skip this
    </button>
  );
}
