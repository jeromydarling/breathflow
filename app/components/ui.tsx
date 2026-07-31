import { Link } from "react-router";
import type { ReactNode } from "react";

/** Shared primitives. Small on purpose — this app has few kinds of surface. */

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-sans font-light tracking-[0.18em] ${className}`}>
      BREATH<span className="font-semibold">FLOW</span>
    </span>
  );
}

type ButtonProps = {
  children: ReactNode;
  to?: string;
  type?: "button" | "submit";
  name?: string;
  value?: string;
  variant?: "primary" | "ghost" | "quiet";
  size?: "lg" | "md" | "sm";
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  prefetch?: "intent" | "render" | "none";
  "aria-label"?: string;
};

const VARIANTS = {
  primary:
    "bg-[var(--color-bone)] text-[var(--color-charcoal)] hover:bg-white shadow-lg shadow-black/20",
  ghost:
    "border border-[color-mix(in_oklab,var(--color-bone)_28%,transparent)] text-[var(--color-bone)] hover:bg-[color-mix(in_oklab,var(--color-bone)_10%,transparent)]",
  quiet:
    "text-[var(--color-bone-muted)] hover:text-[var(--color-bone)] underline underline-offset-4 decoration-[color-mix(in_oklab,var(--color-bone)_35%,transparent)]",
} as const;

const SIZES = {
  lg: "px-8 py-4 text-lg rounded-full",
  md: "px-6 py-3 text-base rounded-full",
  sm: "px-4 py-2 text-sm rounded-full",
} as const;

export function Button({
  children,
  to,
  type = "button",
  name,
  value,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  onClick,
  prefetch = "intent",
  ...rest
}: ButtonProps) {
  const classes = `inline-flex items-center justify-center gap-2 font-medium transition disabled:opacity-50 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  if (to) {
    return (
      <Link to={to} prefetch={prefetch} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      name={name}
      value={value}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return <Tag className={`bf-card p-5 ${className}`}>{children}</Tag>;
}

export function SectionHeading({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-bone-faint)] ${className}`}
    >
      {children}
    </h2>
  );
}

/** The core quote. Presented as BreathFLOW philosophy, never as a law. */
export function CoreQuote({ className = "" }: { className?: string }) {
  return (
    <figure className={className}>
      <blockquote className="font-serif text-[1.35rem] leading-[1.75] text-[var(--color-bone)] sm:text-2xl">
        <p>The way you breathe creates the way you think.</p>
        <p>The way you think creates the way you feel.</p>
        <p>The way you feel creates your vibration.</p>
        <p>Your vibration creates your reality.</p>
        <p className="mt-3">
          So your breath is the start of creating your reality.
        </p>
      </blockquote>
      <figcaption className="mt-5 text-xs uppercase tracking-[0.2em] text-[var(--color-bone-faint)]">
        BreathFLOW philosophy
      </figcaption>
    </figure>
  );
}

/**
 * The health disclaimer. One component, used on every surface that needs it,
 * so the wording can never drift between screens — and so a legal review only
 * has to happen in one place.
 */
export function HealthDisclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-[var(--color-bone-faint)] ${className}`}>
      BreathFLOW is a wellbeing practice, not healthcare. Conscious breathing
      may support relaxation, attention and emotional awareness. It does not
      diagnose, treat, cure or prevent any medical or psychiatric condition. If
      you are pregnant, or live with a cardiovascular condition, epilepsy,
      glaucoma, or a history of psychosis or severe panic, please speak with a
      qualified healthcare professional before practising activating breath or
      breath retention. If you are in crisis, contact your local emergency
      services.
    </p>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gentle" | "activating" | "deep" | "locked";
}) {
  const tones = {
    neutral:
      "bg-[color-mix(in_oklab,var(--color-bone)_12%,transparent)] text-[var(--color-bone-muted)]",
    gentle: "bg-[color-mix(in_oklab,#7fb3a0_22%,transparent)] text-[#bfe0d3]",
    activating:
      "bg-[color-mix(in_oklab,var(--color-amber)_25%,transparent)] text-[var(--color-amber-bright)]",
    deep: "bg-[color-mix(in_oklab,var(--color-copper)_28%,transparent)] text-[var(--color-copper-bright)]",
    locked:
      "bg-[color-mix(in_oklab,var(--color-bone)_8%,transparent)] text-[var(--color-bone-faint)]",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-medium tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** A kind, specific error message. Never blaming. */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-[color-mix(in_oklab,var(--color-copper)_45%,transparent)] bg-[color-mix(in_oklab,var(--color-copper)_16%,transparent)] px-4 py-3 text-sm text-[var(--color-bone)]"
    >
      {children}
    </p>
  );
}

export function FormNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="status"
      className="rounded-xl border border-[color-mix(in_oklab,#7fb3a0_40%,transparent)] bg-[color-mix(in_oklab,#7fb3a0_14%,transparent)] px-4 py-3 text-sm text-[var(--color-bone)]"
    >
      {children}
    </p>
  );
}

export function Field({
  label,
  name,
  type = "text",
  required,
  autoComplete,
  defaultValue,
  placeholder,
  hint,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  inputMode?: "text" | "email" | "numeric";
}) {
  const id = `field-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm text-[var(--color-bone-muted)]">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-describedby={hintId}
        className="w-full rounded-xl border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)] px-4 py-3 text-[var(--color-bone)] placeholder:text-[var(--color-bone-faint)]"
      />
      {hint ? (
        <p id={hintId} className="text-xs text-[var(--color-bone-faint)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
