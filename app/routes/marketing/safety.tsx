import type { Route } from "./+types/safety";
import { envFrom } from "~/lib/context";
import { faqSchema, jsonLd, marketingMeta, originFrom } from "~/lib/seo";
import { HealthDisclaimer } from "~/components/ui";
import { publicPageHeaders } from "~/lib/cache.server";

/**
 * Safety guidance.
 *
 * FLAGGED FOR REVIEW: this page states our actual safety position and needs a
 * qualified legal and clinical read before launch, per the brief. The
 * contraindication list, the emergency language and the jurisdictional
 * questions all sit here.
 */
const FAQS = [
  {
    q: "Is breathwork safe?",
    a: "Gentle, slow breathing is safe for almost everyone. Activating breathwork and breath retention are different, and carry real risks in specific circumstances — in or near water, while driving, or for people with certain medical conditions. Follow the rules on this page and the practice stays ordinary.",
  },
  {
    q: "Who should not practise activating breathwork?",
    a: "People who are pregnant, and people living with cardiovascular conditions, epilepsy, glaucoma, or a history of psychosis or severe panic, should speak with a qualified healthcare professional before practising activating breath or breath retention. If you are unsure, choose a gentle practice and ask a professional.",
  },
  {
    q: "Can BreathFLOW treat anxiety or trauma?",
    a: "No. Conscious breathing may support regulation during anxious moments and can create space to feel what has been held. It does not diagnose, treat, cure or prevent any condition, and it is not a substitute for therapy or medical care.",
  },
  {
    q: "What should I do if a practice brings up something difficult?",
    a: "Stop, come back to ordinary breathing, and get your feet on the ground. Emotion arriving is normal and usually passes. If something surfaces that feels too big to hold on your own, please talk to a qualified therapist rather than breathing harder. If you are in immediate danger, contact your local emergency services.",
  },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  return { origin: originFrom(request, envFrom(context)) };
}

export function headers({ parentHeaders }: Route.HeadersArgs) {
  return publicPageHeaders(parentHeaders, 600);
}

export function meta({ loaderData }: Route.MetaArgs) {
  const origin = loaderData?.origin ?? "";
  return [
    ...marketingMeta({
      title: "Safety",
      description:
        "How to practise BreathFLOW safely: the rules for breath retention, who should check with a professional first, and what conscious breathing can and cannot do.",
      path: "/safety",
      origin,
    }),
    jsonLd(faqSchema(FAQS)),
  ];
}

export default function Safety({ loaderData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-20">
      <h1 className="font-serif text-4xl text-[var(--color-bone)]">
        Practising safely
      </h1>
      <p className="mt-5 text-[1.05rem] leading-[1.8] text-[var(--color-bone-muted)]">
        Most of this is short, and none of it is boilerplate. Breath practice
        is safe when a few specific rules are followed, and genuinely risky
        when they are not.
      </p>

      <section className="mt-12 rounded-2xl border border-[color-mix(in_oklab,var(--color-copper)_50%,transparent)] bg-[color-mix(in_oklab,var(--color-copper)_12%,transparent)] p-6">
        <h2 className="font-serif text-2xl text-[var(--color-bone)]">
          Breath retention: the rules that are not negotiable
        </h2>
        <ul className="mt-5 space-y-3 leading-relaxed text-[var(--color-bone-muted)]">
          {[
            "Practise seated or lying down, in a safe place.",
            "Never in or near water. Shallow water blackout happens without warning, and it kills experienced breath-hold divers every year.",
            "Never while driving, or standing anywhere you could fall.",
            "Never anywhere a loss of consciousness could cause harm.",
            "Do not hyperventilate first to inflate the number. That is precisely the practice that causes blackouts.",
            "Stop immediately if you feel pain, severe dizziness, panic or distress.",
          ].map((rule) => (
            <li key={rule} className="flex gap-3">
              <span aria-hidden="true" className="text-[var(--color-copper-bright)]">
                ·
              </span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-[var(--color-bone)]">
          Check with a professional first if
        </h2>
        <ul className="mt-5 space-y-2.5 leading-relaxed text-[var(--color-bone-muted)]">
          {[
            "You are pregnant.",
            "You live with a cardiovascular condition, including high blood pressure.",
            "You have epilepsy or a seizure disorder.",
            "You have glaucoma or retinal detachment.",
            "You have a history of psychosis, dissociation or severe panic.",
            "You are recovering from surgery.",
            "You simply aren't sure.",
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden="true" className="text-[var(--color-amber-bright)]">
                ·
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 leading-relaxed text-[var(--color-bone-muted)]">
          None of that means you cannot practise. Gentle, slow breathing — the
          Three-Minute Return, Anxiety Relief, Evening Release — is appropriate
          for almost everyone. It is the activating practices and the retention
          work that warrant a conversation first.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-[var(--color-bone)]">
          What we do and don&rsquo;t claim
        </h2>
        <div className="mt-5 space-y-4 leading-[1.8] text-[var(--color-bone-muted)]">
          <p>
            Conscious breathing may support relaxation, attention, emotional
            awareness and a sense of wellbeing. There is real research on slow
            breathing and its effects on heart rate variability and
            self-reported anxiety, and that research is genuinely limited —
            modest samples, short horizons, subjective outcomes.
          </p>
          <p>
            BreathFLOW does not diagnose, treat, cure or prevent any medical or
            psychiatric condition. It is not therapy. It is not a replacement
            for medication, and nobody here will ever suggest you stop taking
            something because you started breathing differently.
          </p>
          <p>
            We use spiritual language, because that is honest about where this
            practice comes from. We keep it clearly separate from physiological
            claims, because collapsing the two does a disservice to both.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-[var(--color-bone)]">
          If you are in crisis
        </h2>
        <p className="mt-4 leading-relaxed text-[var(--color-bone-muted)]">
          BreathFLOW is not emergency support and we cannot respond quickly to
          messages. If you are in immediate danger, or thinking about harming
          yourself, please contact your local emergency services or a crisis
          line in your country right now.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-[var(--color-bone)]">
          Questions
        </h2>
        <dl className="mt-6 space-y-6">
          {FAQS.map((faq) => (
            <div key={faq.q}>
              <dt className="text-[var(--color-bone)]">{faq.q}</dt>
              <dd className="mt-2 leading-relaxed text-[var(--color-bone-muted)]">
                {faq.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <HealthDisclaimer className="mt-16" />
    </div>
  );
}
