"use client";

// The score block of the result screens (design system 5.14): "Your score" over the score and its unit on
// the left; on the right the comparison with the record for this route and mode. Beating an earlier record
// is the one celebration: the New best stamp (5.11, "New best on results") lands over "Previous best".
// "Equals your best" and the other lines are plain text, not stamps.
import { motion, useReducedMotion } from "motion/react";
import type { Comparison } from "@/src/progress/progress";
import { SPRING_EASE, STAMP_LANDING, STAMP_REST } from "./easing";
import { StarIcon } from "./icons";

export interface ScoreBlockProps {
  /** Correct answers. */
  score: number;
  /** Cards in the round: the score reads "7 of 10" and the best "Best 9 / 10". */
  total: number;
  comparison: Comparison;
  /** The label over the score. Defaults to "Your score". */
  label?: string;
  /** Let the New best stamp land (scale 1.9 to 1, -14 to -6 degrees). Without it the stamp is shown at rest. */
  animate?: boolean;
}

const LABEL =
  "font-(family-name:--type-field-label-family) text-(length:--type-field-label-size) font-(--type-field-label-weight) " +
  "leading-(--type-field-label-line-height) tracking-(--type-field-label-letter-spacing) text-(--color-ink-muted)";
const SCORE =
  "m-0 mt-(--space-4) flex items-baseline gap-(--space-8) font-(family-name:--type-score-family) text-(length:--type-score-size) " +
  "font-(--type-score-weight) leading-(--type-score-line-height) tracking-(--type-score-letter-spacing) text-(--color-ink)";
const EMPHASIS =
  "block font-(family-name:--type-emphasis-family) text-(length:--type-emphasis-size) font-(--type-emphasis-weight) " +
  "leading-(--type-emphasis-line-height) tracking-(--type-emphasis-letter-spacing) text-(--color-ink)";
const BEST =
  "block font-(family-name:--type-mono-data-family) text-(length:--type-mono-data-size) font-(--type-mono-data-weight) " +
  "leading-(--type-mono-data-line-height) tracking-(--type-mono-data-letter-spacing) text-(--color-ink-muted)";
// 22px is the documented "New best on results" variant of the stamp role (24); tokens.json has no role for it.
const NEW_BEST =
  "inline-flex items-center gap-(--space-8) px-(--space-14) pt-(--space-6) pb-(--space-4) rounded-(--radius-small) " +
  "border-(length:--stroke-stamp) border-double border-current text-(--color-correct) whitespace-nowrap " +
  "font-(family-name:--type-stamp-family) text-[22px] font-(--type-stamp-weight) leading-(--type-stamp-line-height) " +
  "tracking-(--type-stamp-letter-spacing)";

function NewBestStamp({ animate }: { animate: boolean }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.span
      data-new-best=""
      className={NEW_BEST}
      initial={animate && !reduced ? STAMP_LANDING : false}
      animate={STAMP_REST}
      transition={{ duration: 0.42, delay: 0.38, ease: SPRING_EASE }}
    >
      <StarIcon />
      New best
    </motion.span>
  );
}

function ComparisonLines({ comparison, total, animate }: { comparison: Comparison; total: number; animate: boolean }) {
  switch (comparison.kind) {
    case "first":
      return <b className={EMPHASIS}>First round on this route</b>;
    case "new-best":
      return (
        <>
          <NewBestStamp animate={animate} />
          <span className={`${BEST} mt-(--space-10)`}>
            Previous best {comparison.previousBest} / {total}
          </span>
        </>
      );
    case "equal":
      return (
        <>
          <b className={EMPHASIS}>Equals your best</b>
          <span className={`${BEST} mt-(--space-2)`}>
            Best {comparison.best} / {total}
          </span>
        </>
      );
    case "short":
      return (
        <>
          <b className={EMPHASIS}>{comparison.by} short of your best</b>
          <span className={`${BEST} mt-(--space-2)`}>
            Best {comparison.best} / {total}
          </span>
        </>
      );
  }
}

export function ScoreBlock({ score, total, comparison, label = "Your score", animate = false }: ScoreBlockProps) {
  return (
    <div
      data-score-block=""
      className="flex items-end justify-between gap-(--space-16) px-(--size-ticket-inset) pt-(--space-14) pb-(--space-18)"
    >
      <dl className="m-0">
        <dt className={LABEL}>{label}</dt>
        <dd data-score="" className={SCORE}>
          {score}{" "}
          <small className="text-[20px] tracking-normal whitespace-nowrap text-(--color-ink-muted)">of {total}</small>
        </dd>
      </dl>
      <p data-comparison={comparison.kind} className="m-0 flex flex-col items-end pb-(--space-2) text-right">
        <ComparisonLines comparison={comparison} total={total} animate={animate} />
      </p>
    </div>
  );
}
