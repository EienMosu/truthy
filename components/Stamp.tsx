"use client";

// The verdict stamp on the answer slip (design system 5.11, "Slip verdict"): the only tilted element and
// the only celebration. Icon plus word plus colour, so the verdict never depends on colour alone:
// a check and "Correct" in the correct colour, an X and "Not quite" in the wrong colour. The New best stamp
// (an answer that passes the record) is the correct colour with a star; screen readers hear "Correct. New best".
// When it lands it scales from 1.9 and turns from -14 to -6 degrees (420 ms spring, 380 ms delay);
// with reduced motion it is simply shown at rest.
// StubStamp is the Timed variant (design system 5.11, "Stub stamp"): the same stamp at 28 px on raised paper,
// stamped onto the stub of the card; it also says Time is up when the clock reaches zero.
import { motion, useReducedMotion } from "motion/react";
import { SPRING_EASE, STAMP_LANDING, STAMP_REST } from "./easing";
import { CheckIcon, ClockIcon, CrossIcon, StarIcon } from "./icons";

export type Verdict = "correct" | "wrong" | "new-best";

export interface StampProps {
  verdict: Verdict;
  /** Play the landing animation when the stamp appears. Without it the stamp is shown at rest. */
  animate?: boolean;
  className?: string;
}

const BASE =
  "inline-flex flex-none items-center gap-(--space-8) px-(--space-14) pt-(--space-6) pb-(--space-4) " +
  "rounded-(--radius-small) border-(length:--stroke-stamp) border-double border-current " +
  "font-(family-name:--type-stamp-family) text-(length:--type-stamp-size) font-(--type-stamp-weight) " +
  "leading-(--type-stamp-line-height) tracking-(--type-stamp-letter-spacing) whitespace-nowrap";

export function Stamp({ verdict, animate = false, className }: StampProps) {
  const reduced = useReducedMotion() ?? false;
  const land = animate && !reduced;
  return (
    <motion.div
      data-verdict={verdict}
      className={[BASE, verdict === "wrong" ? "text-(--color-wrong)" : "text-(--color-correct)", className]
        .filter(Boolean)
        .join(" ")}
      initial={land ? STAMP_LANDING : false}
      animate={STAMP_REST}
      transition={{ duration: 0.42, delay: 0.38, ease: SPRING_EASE }}
    >
      {verdict === "correct" ? <CheckIcon size={22} /> : verdict === "wrong" ? <CrossIcon size={18} /> : <StarIcon size={20} />}
      {verdict === "new-best" ? (
        <>
          <span className="sr-only">Correct. </span>New best
        </>
      ) : verdict === "correct" ? (
        "Correct"
      ) : (
        "Not quite"
      )}
    </motion.div>
  );
}

export type StubStampKind = "correct" | "wrong" | "time-up";

// The stamp role at the documented stub size, 28 px, on raised paper so the barcode under it does not show through.
const STUB_BASE =
  "inline-flex flex-none items-center gap-(--space-8) px-(--space-18) pt-(--space-8) pb-(--space-6) " +
  "rounded-(--radius-small) border-(length:--stroke-stamp) border-double border-current bg-(--color-surface-raised) " +
  "font-(family-name:--type-stamp-family) text-[28px] font-(--type-stamp-weight) " +
  "leading-(--type-stamp-line-height) tracking-(--type-stamp-letter-spacing) whitespace-nowrap";

const STUB_KINDS: Record<StubStampKind, { colour: string; word: string }> = {
  correct: { colour: "text-(--color-correct)", word: "Correct" },
  wrong: { colour: "text-(--color-wrong)", word: "Not quite" },
  "time-up": { colour: "text-(--color-ink)", word: "Time is up" },
};

/**
 * The stamp on the stub of a Timed card. It lands as it appears (300 ms spring from 1.9 and -14 degrees, at
 * once for a verdict, 120 ms late for Time is up); with reduced motion it is shown at rest.
 */
export function StubStamp({ kind }: { kind: StubStampKind }) {
  const reduced = useReducedMotion() ?? false;
  const { colour, word } = STUB_KINDS[kind];
  return (
    <motion.div
      data-stub-stamp={kind}
      className={`${STUB_BASE} ${colour}`}
      initial={reduced ? false : STAMP_LANDING}
      animate={STAMP_REST}
      transition={{ duration: 0.3, delay: kind === "time-up" ? 0.12 : 0, ease: SPRING_EASE }}
    >
      {kind === "correct" ? <CheckIcon size={24} /> : kind === "wrong" ? <CrossIcon size={20} /> : <ClockIcon />}
      {word}
    </motion.div>
  );
}
