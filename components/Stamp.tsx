"use client";

// The verdict stamp on the answer slip (design system 5.11, "Slip verdict"): the only tilted element and
// the only celebration. Icon plus word plus colour, so the verdict never depends on colour alone:
// a check and "Correct" in the correct colour, an X and "Not quite" in the wrong colour.
// When it lands it scales from 1.9 and turns from -14 to -6 degrees (420 ms spring, 380 ms delay);
// with reduced motion it is simply shown at rest.
import { motion, useReducedMotion } from "motion/react";
import { SPRING_EASE, STAMP_LANDING, STAMP_REST } from "./easing";
import { CheckIcon, CrossIcon } from "./icons";

export type Verdict = "correct" | "wrong";

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
      className={[BASE, verdict === "correct" ? "text-(--color-correct)" : "text-(--color-wrong)", className]
        .filter(Boolean)
        .join(" ")}
      initial={land ? STAMP_LANDING : false}
      animate={STAMP_REST}
      transition={{ duration: 0.42, delay: 0.38, ease: SPRING_EASE }}
    >
      {verdict === "correct" ? <CheckIcon size={22} /> : <CrossIcon size={18} />}
      {verdict === "correct" ? "Correct" : "Not quite"}
    </motion.div>
  );
}
