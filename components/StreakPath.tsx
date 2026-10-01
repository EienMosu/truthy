// The flight-path header of a Streak round (design system 5.10, "Streak" and "Streak at or past the best"):
// one dot per correct answer along the route, the plane on the card on screen, and a ring where the best
// is. Left of the label row: "Streak 8"; right: "Best 12" (or "Previous best 12" once the best is passed).
// Without a best to fly towards (a first round, or a stored 0) there is no ring and no right label.
import { Mark, Num, PathFrame, Plane, RouteLine, headingAt, pointAt } from "./FlightPath";

export interface StreakLayout {
  /** Where slot i sits on the curve, 0 to 1. */
  t: (slot: number) => number;
  /** Radius of a done dot. */
  dot: number;
  /** Done dots carry a tick (dot >= 5). */
  ticks: boolean;
  /** The slot of the best (best - 1), or null without a best (null or 0). */
  ring: number | null;
  /** The ring is at or ahead of the card on screen: the route ends on it. */
  target: boolean;
  /** The open slots between the card on screen and the ring. */
  future: readonly number[];
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** The layout for `done` dots (the card on screen is slot `done`) and the best on the route. */
export function streakLayout(done: number, best: number | null): StreakLayout {
  const ring = best === null || best < 1 ? null : best - 1;
  const target = ring !== null && done <= ring;
  // Best still ahead: the slots spread over the whole curve and the ring ends it.
  // At or past the best, or without one: the route runs on into open sky, a little short of the end.
  const step = target ? 1 / Math.max(ring, 1) : 1 / (done + 1.6);
  const dot = Math.min(6, round1(264 * step * 0.31));
  const future = target ? Array.from({ length: Math.max(0, ring - done - 1) }, (_, i) => done + 1 + i) : [];
  return { t: (slot) => Math.min(1, slot * step), dot, ticks: dot >= 5, ring, target, future };
}

/** The accessible name of the header. A best of 0 counts as no best. */
export function streakLabel(streak: number, best: number | null, ended: boolean): string {
  const start = ended ? `Streak ended at ${streak}` : `Streak of ${streak} correct ${streak === 1 ? "answer" : "answers"}`;
  if (best === null || best < 1) return `${start}.`;
  if (streak < best) return `${start}. Your best on this route is ${best}.`;
  if (streak === best) return `${start}, equal to your best on this route.`;
  return `${start}. New best on this route, previous best ${best}.`;
}

export interface StreakPathProps {
  /** Correct answers so far, the one just given included. */
  streak: number;
  /** The record on this route when the round started; null and 0 both mean "no best to show". */
  best: number | null;
  /** The verdict of the card on screen; null while it is a question. */
  answered: "correct" | "wrong" | null;
  className?: string;
}

export function StreakPath({ streak, best, answered, className }: StreakPathProps) {
  const hasBest = best !== null && best >= 1;
  const ended = answered === "wrong";
  const done = answered === "correct" ? streak - 1 : streak;
  const { t, dot, ticks, ring, target, future } = streakLayout(done, best);
  const futureRadius = Math.min(4, round1((dot * 2) / 3));
  const here = pointAt(t(done));
  const ringAt = ring === null ? null : pointAt(t(ring));

  return (
    <PathFrame
      label={streakLabel(streak, best, ended)}
      className={className}
      progress={
        ended ? (
          <>
            Streak ended at <Num>{streak}</Num>
          </>
        ) : (
          <>
            Streak <Num>{streak}</Num>
          </>
        )
      }
      tally={
        hasBest ? (
          <>
            {streak > best ? "Previous best" : "Best"} <Num>{best}</Num>
          </>
        ) : undefined
      }
    >
      <RouteLine flownTo={t(done)} />
      {Array.from({ length: done }, (_, slot) => (
        <g key={slot} data-streak-dot="">
          <Mark verdict="correct" at={pointAt(t(slot))} scale={dot / 7} plain={!ticks} />
        </g>
      ))}
      {ring !== null && ringAt !== null && ring < done ? (
        <circle data-ring="reached" cx={ringAt.x} cy={ringAt.y} r={dot + 3.5} fill="none" className="stroke-(--color-ink)" strokeWidth="1.4" />
      ) : null}
      {future.map((slot) => {
        const at = pointAt(t(slot));
        return (
          <circle key={slot} cx={at.x} cy={at.y} r={futureRadius} className="fill-(--color-surface-raised) stroke-(--color-ink)" strokeWidth="1.6" />
        );
      })}
      {target && ring !== null && ringAt !== null && ring > done ? (
        <g data-ring="target">
          <circle cx={ringAt.x} cy={ringAt.y} r={dot + 1} className="fill-(--color-surface-raised) stroke-(--color-ink)" strokeWidth="1.6" />
          <circle cx={ringAt.x} cy={ringAt.y} r={dot / 2} className="fill-(--color-ink)" />
        </g>
      ) : null}
      <Plane at={here} heading={headingAt(t(done))} hidden={answered !== null} />
      {answered === null ? null : <Mark verdict={answered} at={here} fresh />}
      {ring !== null && ringAt !== null && answered === "correct" && ring === done ? (
        <circle data-ring="reached" cx={here.x} cy={here.y} r="10.5" fill="none" className="stroke-(--color-ink)" strokeWidth="1.4" />
      ) : null}
    </PathFrame>
  );
}
