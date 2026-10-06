// The header of a Timed round (design system 5.10, "Timed" and "Timed, time up"): the route stands for the
// minute. The plane flies it as the time runs, the line behind it is solid, and the three quarter marks fill
// as they are passed. There are no per-card marks. Left of the label row: the clock, "0:41 left"; right:
// "9 correct · 2 wrong". The clock reads the seconds rounded up, so it says "1:00" at the start and "0:00"
// only when the time is up.
import type { ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { PathFrame, Plane, RouteLine, headingAt, pointAt } from "./FlightPath";
import { TIMED } from "@/src/engine/round";

const QUARTERS = [0.25, 0.5, 0.75] as const;

function wholeSeconds(remainingMs: number): number {
  return Math.ceil(Math.max(0, remainingMs) / 1000);
}

/** The clock: "1:00", "0:41", "0:00". */
export function clockText(remainingMs: number): string {
  const seconds = wholeSeconds(remainingMs);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The accessible name of the header. Built from the whole seconds, so it changes at most once a second. */
export function timedLabel(remainingMs: number, correct: number, wrong: number): string {
  const seconds = wholeSeconds(remainingMs);
  if (seconds === 0) {
    const n = correct + wrong;
    return `Time is up. ${n} ${n === 1 ? "card" : "cards"} answered: ${correct} correct, ${wrong} wrong.`;
  }
  const total = TIMED.roundMs / 1000;
  return `${seconds} ${seconds === 1 ? "second" : "seconds"} left of ${total}. ${correct} correct, ${wrong} wrong.`;
}

export interface TimedPathProps {
  /** What is left of the minute, in ms. */
  remainingMs: number;
  correct: number;
  wrong: number;
  className?: string;
}

export function TimedPath({ remainingMs, correct, wrong, className }: TimedPathProps): ReactNode {
  // With reduced motion the plane does not glide: it and the flown line move once a second, as the clock does,
  // the way the other planes move once a card. Time up still puts it on the destination.
  const reduced = useReducedMotion() ?? false;
  const shownMs = reduced ? wholeSeconds(remainingMs) * 1000 : remainingMs;
  const t = Math.min(1, Math.max(0, 1 - shownMs / TIMED.roundMs));
  const end = pointAt(1);

  return (
    <PathFrame
      label={timedLabel(remainingMs, correct, wrong)}
      className={className}
      progress={
        <>
          <b className="font-(--font-weight-mono-semibold) text-[13px] tabular-nums">{clockText(remainingMs)}</b> left
        </>
      }
      tally={
        <>
          {correct} correct · {wrong} wrong
        </>
      }
    >
      <RouteLine flownTo={t} />
      <circle cx="6" cy="24" r="5" className="fill-(--color-ink)" />
      {QUARTERS.map((quarter) => {
        const at = pointAt(quarter);
        const passed = t >= quarter;
        return (
          <circle
            key={quarter}
            data-quarter={passed ? "passed" : "ahead"}
            cx={at.x}
            cy={at.y}
            r="3.5"
            className={`${passed ? "fill-(--color-ink)" : "fill-(--color-surface-raised)"} stroke-(--color-ink)`}
            strokeWidth="1.6"
          />
        );
      })}
      <circle cx={end.x} cy={end.y} r="5" className="fill-(--color-surface-raised) stroke-(--color-ink)" strokeWidth="1.6" />
      <Plane at={pointAt(t)} heading={headingAt(t)} />
    </PathFrame>
  );
}
