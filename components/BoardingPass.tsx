"use client";

// The boarding pass (design system 5.2): the ticket that carries the round. BoardingPass is the shell
// (shadow box, carrier band, legs, field grid, a body, the perforation and a lower part); the game fills
// the body with PassStatement and the lower part with PassStub (question) or PassSlip (answered).
// The result screen reuses the shell with its own body and lower part (PassLower gives the notched paper).
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import type { CSSProperties, ReactNode, Ref } from "react";
import { EASE, EASE_IN, FALL } from "./easing";
import { Stamp } from "./Stamp";
import { BookIcon, CheckIcon, CloudIcon, CrossIcon } from "./icons";

export interface PassLeg {
  /** Three-letter code in the leg-code role, for example "CLF" or "SEC" ("ALL" for the whole deck). */
  code: string;
  /** The name under the code, for example "AWS Cloud Practitioner" or "Whole deck". */
  name: string;
}

export interface PassField {
  label: string;
  value: ReactNode;
}

export interface BoardingPassProps {
  from: PassLeg;
  to: PassLeg;
  /** The three cells of the field grid, for example Class / Card / Gate. */
  fields: readonly [PassField, PassField, PassField];
  /** The body of the main part: the statement (game) or the score (result). */
  children: ReactNode;
  /** The lower part under the perforation: a stub, a slip or a list, drawn with PassLower. */
  lower: ReactNode;
  /** True when the main part should give its small jolt (the stamp landing). Ignored with reduced motion. */
  jolt?: boolean;
  /** When the jolt starts, in seconds: as the stamp lands. 0.42 for the slip stamp (default), 0.12 and 0.24 in Timed. */
  joltDelay?: number;
  className?: string;
}

/** Notched paper: half circles of radius --size-notch cut into both sides at the given edge. */
function notchedPaper(colour: string, edge: "top" | "bottom"): string {
  const y = edge === "top" ? "0" : "100%";
  return [
    `radial-gradient(circle at 0 ${y}, transparent var(--size-notch), ${colour} calc(var(--size-notch) + 0.5px)) left / 51% 100% no-repeat`,
    `radial-gradient(circle at 100% ${y}, transparent var(--size-notch), ${colour} calc(var(--size-notch) + 0.5px)) right / 51% 100% no-repeat`,
  ].join(", ");
}

const MAIN_PAPER: CSSProperties = { background: notchedPaper("var(--color-surface-raised)", "bottom") };
const PERFORATION: CSSProperties = {
  left: "calc(var(--size-notch) + var(--space-6))",
  right: "calc(var(--size-notch) + var(--space-6))",
  background: "repeating-linear-gradient(90deg, var(--color-rule) 0 7px, transparent 7px 12px)",
};

const JOLT: Variants = {
  rest: { y: 0 },
  jolt: (delay: number | undefined) => ({ y: [0, 2, 0], transition: { duration: 0.26, delay: delay ?? 0.42, times: [0, 0.4, 1], ease: EASE } }),
};

const FIELD_LABEL =
  "font-(family-name:--type-field-label-family) text-(length:--type-field-label-size) font-(--type-field-label-weight) " +
  "leading-(--type-field-label-line-height) tracking-(--type-field-label-letter-spacing) text-(--color-ink-muted)";
const FIELD_VALUE =
  "m-0 mt-(--space-2) font-(family-name:--type-field-value-family) text-(length:--type-field-value-size) " +
  "font-(--type-field-value-weight) leading-(--type-field-value-line-height) tracking-(--type-field-value-letter-spacing)";
const LEG_CODE =
  "block font-(family-name:--type-leg-code-family) text-(length:--type-leg-code-size) font-(--type-leg-code-weight) " +
  "leading-(--type-leg-code-line-height) tracking-(--type-leg-code-letter-spacing)";
const LEG_NAME =
  "mt-(--space-6) block font-(family-name:--type-leg-name-family) text-(length:--type-leg-name-size) " +
  "font-(--type-leg-name-weight) leading-(--type-leg-name-line-height) tracking-(--type-leg-name-letter-spacing) text-(--color-ink-muted)";

export function BoardingPass({ from, to, fields, children, lower, jolt = false, joltDelay = 0.42, className }: BoardingPassProps) {
  const reduced = useReducedMotion() ?? false;
  return (
    <div data-boarding-pass="" className={["relative text-(--color-ink)", className].filter(Boolean).join(" ")}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-(--radius-card) shadow-(--elevation-ticket)" />
      <motion.div
        className="relative overflow-hidden rounded-t-(--radius-card)"
        style={MAIN_PAPER}
        variants={JOLT}
        custom={joltDelay}
        initial={false}
        animate={jolt && !reduced ? "jolt" : "rest"}
      >
        <div
          aria-hidden="true"
          className="flex h-(--size-carrier) items-center gap-(--space-10) bg-(--color-accent) px-(--space-16) text-(--color-on-accent)"
        >
          <CloudIcon />
          <span className="font-(family-name:--type-carrier-title-family) text-(length:--type-carrier-title-size) leading-(--type-carrier-title-line-height) font-(--type-carrier-title-weight) tracking-(--type-carrier-title-letter-spacing)">
            Truthy
          </span>
          <span className="ml-auto font-(family-name:--type-carrier-label-family) text-(length:--type-carrier-label-size) leading-(--type-carrier-label-line-height) font-(--type-carrier-label-weight) tracking-(--type-carrier-label-letter-spacing)">
            BOARDING PASS
          </span>
        </div>
        {/* The approved screens show no arrow between the legs (the mockup's 40px arrow collapses to zero
            height), only its 40px column. Codes align at the top so a one-line name does not push its code down. */}
        <div className="grid grid-cols-[1fr_40px_1fr] items-start gap-(--space-8) px-(--size-ticket-inset) pt-(--space-14) pb-(--space-12)">
          <div data-leg="from">
            <span className={LEG_CODE}>{from.code}</span>
            <span className={LEG_NAME}>{from.name}</span>
          </div>
          <span aria-hidden="true" />
          <div data-leg="to" className="text-right">
            <span className={LEG_CODE}>{to.code}</span>
            <span className={LEG_NAME}>{to.name}</span>
          </div>
        </div>
        <dl className="mx-(--size-ticket-inset) my-0 grid grid-cols-[1.1fr_1fr_1fr] border-y-(length:--stroke-rule) border-(--color-rule)">
          {fields.map((field, i) => (
            <div
              key={field.label}
              className={[
                "pt-(--space-8) pb-[7px]",
                i > 0 ? "border-l-(length:--stroke-rule) border-(--color-rule) pl-(--space-12)" : "",
              ].join(" ")}
            >
              <dt className={FIELD_LABEL}>{field.label}</dt>
              <dd className={FIELD_VALUE}>{field.value}</dd>
            </div>
          ))}
        </dl>
        {children}
        <div aria-hidden="true" className="absolute bottom-0 h-(--stroke-perforation)" style={PERFORATION} />
      </motion.div>
      {lower}
    </div>
  );
}

/** The value of the Gate field: "F ← → T", read as "False left, True right"; "Closed" once the Timed clock is up. */
export function GateValue({ closed = false }: { closed?: boolean }) {
  if (closed) return <span className="text-(--color-ink-muted)">Closed</span>;
  return (
    <>
      <span aria-hidden="true" className="whitespace-nowrap">F ← → T</span>
      <span className="sr-only">False left, true right</span>
    </>
  );
}

export interface PassStatementProps {
  /** The statement of the card. */
  children: ReactNode;
  /** The card's appliesTo. Shown as one small line above the statement when it is not empty. */
  appliesTo?: string;
  /** The statement receives focus when a new card is shown (no visible ring, on purpose). */
  ref?: Ref<HTMLDivElement>;
  id?: string;
  /** The statement in the muted ink: a card that no longer counts (Timed, time up). */
  muted?: boolean;
  /** Announce the statement when it changes (aria-live="polite"): Timed, where focus stays on the pill. */
  live?: boolean;
}

/**
 * The statement area of the game: at least 188 tall, the text centred vertically. A word longer than the line
 * (an identifier such as "suppressHydrationWarning" at 320 px) breaks inside it rather than running past the
 * pass edge, where it would be cut off.
 */
export function PassStatement({ children, appliesTo, ref, id, muted = false, live = false }: PassStatementProps) {
  return (
    <div
      ref={ref}
      id={id}
      tabIndex={-1}
      data-statement=""
      data-muted={muted ? "" : undefined}
      aria-live={live ? "polite" : undefined}
      className="flex min-h-(--size-statement-min) flex-col justify-center px-(--size-ticket-inset) pt-(--space-18) pb-(--space-24) outline-none"
    >
      {appliesTo ? (
        <p className="m-0 mb-(--space-6) font-(family-name:--type-mono-data-family) text-(length:--type-mono-data-size) leading-(--type-mono-data-line-height) font-(--type-mono-data-weight) text-(--color-ink-muted)">
          Applies to {appliesTo}
        </p>
      ) : null}
      <p className={`m-0 wrap-break-word font-(family-name:--type-card-statement-family) text-(length:--type-card-statement-size) leading-(--type-card-statement-line-height) font-(--type-card-statement-weight) tracking-(--type-card-statement-letter-spacing) ${muted ? "text-(--color-ink-muted)" : "text-(--color-ink)"}`}>
        {children}
      </p>
    </div>
  );
}

export interface PassLowerProps {
  /** "raised": the paper of the stub. "sunk": the paper of the answer slip and the result list. */
  tone: "raised" | "sunk";
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** The lower part's paper: notches at the top, square top corners, radius 16 at the bottom. */
export function PassLower({ tone, children, className, style }: PassLowerProps) {
  const colour = tone === "raised" ? "var(--color-surface-raised)" : "var(--color-surface-sunk)";
  return (
    <div
      data-tone={tone}
      className={["rounded-b-(--radius-card)", className].filter(Boolean).join(" ")}
      style={{ background: notchedPaper(colour, "top"), ...style }}
    >
      {children}
    </div>
  );
}

/** One bar of a barcode: x and width in barcode units (the bars are 56 tall). */
export interface BarcodeBar {
  x: number;
  width: number;
}

/**
 * The barcode algorithm of the design system (Portability notes), the same on every platform:
 * start bars 2/1/1/2 (on, off, on, off); for each character 7 bits, least significant first, bit 1 gives
 * width 2 and bit 0 width 1, bars alternating on and off starting with on, then a 1-wide gap;
 * end bars 1/1/2 (on, off, on).
 */
export function barcodeBars(data: string): { bars: BarcodeBar[]; width: number } {
  const bars: BarcodeBar[] = [];
  let x = 0;
  const bar = (width: number, on: boolean) => {
    if (on) bars.push({ x, width });
    x += width;
  };
  bar(2, true);
  bar(1, false);
  bar(1, true);
  bar(2, false);
  for (const ch of data) {
    const code = ch.charCodeAt(0);
    for (let bit = 0; bit < 7; bit++) bar((code >> bit) & 1 ? 2 : 1, bit % 2 === 0);
    bar(1, false);
  }
  bar(1, true);
  bar(1, false);
  bar(2, true);
  return { bars, width: x };
}

function Barcode({ data }: { data: string }) {
  const { bars, width } = barcodeBars(data);
  return (
    <svg
      data-barcode={data}
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${width} 56`}
      preserveAspectRatio="none"
      className="block h-(--size-barcode) w-full text-(--color-ink)"
    >
      <g fill="currentColor">
        {bars.map((b) => (
          <rect key={b.x} x={b.x} y="0" width={b.width} height="56" />
        ))}
      </g>
    </svg>
  );
}

/** Which way the stub falls when it tears off: left after a correct answer, right after a wrong one. */
export type TearSide = "left" | "right";

const STUB_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, x: 0, y: 0, rotate: 0, transition: { duration: 0.22, ease: EASE } },
  tear: (side: TearSide | undefined) => ({
    x: side === "right" ? 40 : -40,
    y: 360,
    rotate: side === "right" ? 18 : -18,
    opacity: 0,
    transition: {
      default: { duration: 0.46, ease: FALL },
      opacity: { duration: 0.46, ease: EASE_IN },
    },
  }),
};

const STUB_VARIANTS_REDUCED: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.14 } },
  tear: { opacity: 0, transition: { duration: 0.1 } },
};

// While the card is dragged, the stub drops |intent| x 7px and turns intent x 2deg around (20%, 0).
// --intent and --pull are set on the swipe card by useSwipe.
const STUB_PULL: CSSProperties = {
  transformOrigin: "20% 0",
  transform: "translateY(calc(var(--pull, 0) * var(--gesture-stub-pull))) rotate(calc(var(--intent, 0) * 2deg))",
};

const INTENT_STAMP =
  "pointer-events-none absolute top-[64px] flex items-center gap-(--space-8) rounded-(--radius-small) " +
  "border-(length:--stroke-stamp) border-solid border-current bg-(--color-surface-raised) px-(--space-12) py-(--space-6) " +
  "font-(family-name:--type-intent-stamp-family) text-(length:--type-intent-stamp-size) font-(--type-intent-stamp-weight) " +
  "leading-(--type-intent-stamp-line-height) tracking-(--type-intent-stamp-letter-spacing)";

const MONO_DATA =
  "font-(family-name:--type-mono-data-family) text-(length:--type-mono-data-size) font-(--type-mono-data-weight) " +
  "leading-(--type-mono-data-line-height) tracking-(--type-mono-data-letter-spacing)";
const MONO_STRONG =
  "font-(family-name:--type-mono-data-strong-family) text-(length:--type-mono-data-strong-size) font-(--type-mono-data-strong-weight) " +
  "leading-(--type-mono-data-strong-line-height) tracking-(--type-mono-data-strong-letter-spacing)";

export interface PassStubProps {
  /** The route line on the left, for example "CLF → SEC · Classic". */
  routeLine: string;
  /** On the right, for example "Card 04". */
  cardLabel: string;
  /** The data the barcode is drawn from (the card id). */
  barcode: string;
  /**
   * A stamp drawn on the stub, centred 96 px from its top (Timed: the verdict, Time is up). It sits in a presence
   * of its own, so the stub's AnimatePresence initial={false} (a Timed card is dealt whole) does not stop it landing.
   */
  stamp?: ReactNode;
  /** One centred line in place of "← False / swipe to board / True →"; the intent stamps are left out with it. */
  hint?: string;
  className?: string;
}

/**
 * The stub of the question phase: route line, barcode, swipe hint, and the two intent stamps that fade in
 * while the card is dragged. Decorative (the buttons say the same), so it is hidden from screen readers.
 * Render it as a direct child of AnimatePresence with custom={TearSide}: it tears off when it leaves.
 */
export function PassStub({ routeLine, cardLabel, barcode, stamp, hint, className }: PassStubProps) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.div
      aria-hidden="true"
      data-stub=""
      className={["relative z-10", className].filter(Boolean).join(" ")}
      variants={reduced ? STUB_VARIANTS_REDUCED : STUB_VARIANTS}
      initial="hidden"
      animate="shown"
      exit="tear"
    >
      <div
        className="h-full transition-transform duration-(--duration-t3) ease-(--easing-spring) group-data-dragging:transition-none"
        style={STUB_PULL}
      >
        <PassLower
          tone="raised"
          className="flex h-full flex-col justify-between px-(--size-ticket-inset) pt-[22px] pb-(--space-14)"
        >
          <div className={`flex items-baseline justify-between text-(--color-ink-muted) ${MONO_DATA}`}>
            <span>{routeLine}</span>
            <b className={`text-(--color-ink) ${MONO_STRONG}`}>{cardLabel}</b>
          </div>
          <Barcode data={barcode} />
          {hint === undefined ? (
            <div className={`flex min-h-8 items-center justify-between gap-(--space-8) ${MONO_STRONG}`}>
              <span className="flex items-center gap-(--space-4) text-(--color-false)">← False</span>
              <span className="font-(--font-weight-mono-regular) text-(--color-ink-muted)">swipe to board</span>
              <span className="flex items-center gap-(--space-4) text-(--color-true)">True →</span>
            </div>
          ) : (
            <div data-hint="" className={`flex min-h-8 items-center justify-center text-center ${MONO_STRONG}`}>
              <span className="font-(--font-weight-mono-regular) text-(--color-ink-muted)">{hint}</span>
            </div>
          )}
        </PassLower>
        {stamp === undefined ? null : (
          <div className="pointer-events-none absolute top-[96px] left-1/2 -translate-x-1/2 -translate-y-1/2">
            <AnimatePresence>{stamp}</AnimatePresence>
          </div>
        )}
        {hint === undefined ? <IntentStamps /> : null}
      </div>
    </motion.div>
  );
}

/** The True and False stamps that fade in while the card is dragged, driven by --intent. */
function IntentStamps() {
  return (
    <>
      <div
        data-intent="true"
        className={`${INTENT_STAMP} left-(--space-16) rotate-[-7deg] text-(--color-true)`}
        style={{ opacity: "calc(var(--intent, 0) * var(--gesture-intent-opacity-gain))" }}
      >
        <CheckIcon size={18} />
        True
      </div>
      <div
        data-intent="false"
        className={`${INTENT_STAMP} right-(--space-16) rotate-[7deg] text-(--color-false)`}
        style={{ opacity: "calc(var(--intent, 0) * -1 * var(--gesture-intent-opacity-gain))" }}
      >
        <CrossIcon size={16} />
        False
      </div>
    </>
  );
}

export interface PassSlipProps {
  /** The right answer of the card. */
  answer: boolean;
  /** Whether the player's answer was right. */
  correct: boolean;
  explanation: string;
  source: { title: string; url: string };
  /** Let the stamp land (the answer has just been given). */
  animateStamp?: boolean;
  /** The right answer passed the record: the stamp says New best instead of Correct. Ignored after a wrong answer. */
  newBest?: boolean;
  className?: string;
}

/**
 * The answer slip revealed under the stub: the right answer, the verdict stamp, the explanation and the source.
 * It mounts with the answer, inside a card that may have been mounted by an AnimatePresence with
 * initial={false} (the Timed swap). Motion blocks the first animation of everything under such a presence for
 * as long as it stays, so the slip opens a presence of its own: its fade (reduced motion) and its stamp's
 * landing always play. PassStub does the same for its stamp.
 */
export function PassSlip({ answer, correct, explanation, source, animateStamp = false, newBest = false, className }: PassSlipProps) {
  const reduced = useReducedMotion() ?? false;
  return (
    <AnimatePresence>
      <motion.div
        data-slip=""
        className={className}
        initial={reduced ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.14 }}
      >
        <PassLower tone="sunk" className="flex h-full flex-col px-(--size-ticket-inset) pt-(--space-18) pb-(--space-12)">
          <div className="flex min-h-[60px] items-center justify-between gap-(--space-12)">
            <p className="m-0 font-(family-name:--type-answer-label-family) text-(length:--type-answer-label-size) leading-(--type-answer-label-line-height) font-(--type-answer-label-weight) text-(--color-ink-muted)">
              The answer is
              <b className="mt-(--space-2) block font-(family-name:--type-answer-value-family) text-(length:--type-answer-value-size) leading-(--type-answer-value-line-height) font-(--type-answer-value-weight) tracking-(--type-answer-value-letter-spacing) text-(--color-ink)">
                {answer ? "True" : "False"}
              </b>
            </p>
            <Stamp verdict={!correct ? "wrong" : newBest ? "new-best" : "correct"} animate={animateStamp} />
          </div>
          <p className="m-0 mt-(--space-10) font-(family-name:--type-body-family) text-(length:--type-body-size) leading-(--type-body-line-height) font-(--type-body-weight) text-(--color-ink)">
            {explanation}
          </p>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${source.title} (opens in a new tab)`}
            className="mt-auto flex min-h-(--size-touch-min) items-center gap-(--space-8) font-(family-name:--type-mono-data-strong-family) text-[13.5px] leading-(--type-mono-data-strong-line-height) font-(--type-mono-data-strong-weight) text-(--color-true) no-underline"
          >
            <BookIcon className="flex-none" />
            <u className="decoration-[1.5px] underline-offset-[3px]">{source.title}</u>
            <span aria-hidden="true">→</span>
          </a>
        </PassLower>
      </motion.div>
    </AnimatePresence>
  );
}

/** The calm stand-in while the round loads: the ticket's shape with the carrier band and nothing else. */
export function BoardingPassPlaceholder() {
  return (
    <div aria-hidden="true" data-pass-placeholder="" className="relative">
      <div className="pointer-events-none absolute inset-0 rounded-(--radius-card) shadow-(--elevation-ticket)" />
      <div className="relative overflow-hidden rounded-t-(--radius-card)" style={MAIN_PAPER}>
        <div className="flex h-(--size-carrier) items-center gap-(--space-10) bg-(--color-accent) px-(--space-16) text-(--color-on-accent)">
          <CloudIcon />
        </div>
        <div className="h-[336px]" />
        <div className="absolute bottom-0 h-(--stroke-perforation)" style={PERFORATION} />
      </div>
      <PassLower tone="raised" className="h-(--size-lower)" />
    </div>
  );
}
