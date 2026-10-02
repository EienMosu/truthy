// The header of a Three lives round (design system 5.10, "Lives" and "Lives, last life lost"): three hearts, a
// straight mini path with one small mark per answered card and the plane on the card on screen, and a label row
// with the lives left and the cards answered. A life is lost by shape as well as colour: a filled heart becomes an
// outlined heart with a slash. The slash of the life just lost is drawn as the Not quite stamp lands (the one
// documented use of stroke length besides the Why disclosure's height); everywhere else it is at rest.
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Mark, Num, PathFrame, Plane, cardList } from "./FlightPath";
import { EASE } from "./easing";
import { ICON_PATHS } from "./icons";
import { LIVES } from "@/src/engine/round";

const round1 = (value: number) => Math.round(value * 10) / 10;

export interface TrailLayout {
  /** x of mark i (0 is the oldest). */
  x: (i: number) => number;
  /** Radius of a correct dot. */
  r: number;
  /** Side of a wrong square. */
  side: number;
  /** Wrong squares carry their x (always: the side never drops below 6). */
  cross: boolean;
}

/** Where the marks of the answered cards sit on the line y 17. */
export function trailLayout(marks: number): TrailLayout {
  // Up to 14 marks: 9 apart, the newest at x 219 next to the plane (14 marks start at x 102).
  if (marks <= 14) return { x: (i) => 219 - 9 * (marks - 1 - i), r: 2.6, side: 9, cross: true };
  // More: squeezed between x 100 and x 219. A wrong square keeps a side of at least 6 with its x however long
  // the round (spec section 9: correct and wrong are never told apart by colour alone); there are at most two in
  // the trail, so they may overlap the dots of their neighbours.
  const step = 119 / (marks - 1);
  const side = Math.max(6, Math.min(8, round1(step * 1.3)));
  return { x: (i) => round1(100 + i * step), r: Math.min(2.2, round1(step * 0.45)), side, cross: true };
}

/** The accessible name of the header. */
export function livesLabel(results: readonly boolean[]): string {
  const wrong: number[] = [];
  results.forEach((correct, i) => {
    if (!correct) wrong.push(i + 1);
  });
  const left = Math.max(0, LIVES - wrong.length);
  const n = results.length;
  if (left === 0) return `No lives left. The round is over after ${n} cards: ${cardList(wrong)} ${wrong.length === 1 ? "was" : "were"} wrong.`;
  const head = `${left} of ${LIVES} lives left.`;
  if (n === 0) return `${head} No cards answered yet.`;
  const answered = `${n} ${n === 1 ? "card" : "cards"} answered`;
  if (wrong.length === 0) return `${head} ${answered}.`;
  return `${head} ${answered}, ${cardList(wrong)} ${wrong.length === 1 ? "was" : "were"} wrong.`;
}

const HEART_X = [11, 39, 67] as const;
const STRIKE_TRANSITION = { duration: 0.3, delay: 0.38, ease: EASE };

/** The slash of a lost heart: drawn (the life just lost) or at rest. */
function Slash({ draw }: { draw: boolean }) {
  const common = {
    d: ICON_PATHS.heartSlash,
    fill: "none",
    className: "stroke-(--color-ink-muted)",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
  };
  if (!draw) return <path data-strike="rest" {...common} />;
  // Opacity switches on with the stroke so the round cap of an empty stroke is not drawn during the delay.
  return (
    <motion.path
      data-strike="draw"
      {...common}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ pathLength: STRIKE_TRANSITION, opacity: { duration: 0.01, delay: STRIKE_TRANSITION.delay } }}
    />
  );
}

function Heart({ index, lost, draw }: { index: number; lost: boolean; draw: boolean }) {
  return (
    <g data-heart={lost ? "lost" : "full"} transform={`translate(${HEART_X[index]} 6)`}>
      {lost ? (
        <>
          <path d={ICON_PATHS.heart} fill="none" className="stroke-(--color-ink-muted)" strokeWidth={1.6} strokeLinejoin="round" />
          <Slash draw={draw} />
        </>
      ) : (
        <path d={ICON_PATHS.heart} className="fill-(--color-ink)" />
      )}
    </g>
  );
}

export interface LivesPathProps {
  /** Whether each answer of the round was correct, in order. */
  results: readonly boolean[];
  /** The card on screen has been answered (it is the last of results). */
  answered: boolean;
  className?: string;
}

export function LivesPath({ results, answered, className }: LivesPathProps): ReactNode {
  const reduced = useReducedMotion() ?? false;
  const wrongCount = results.filter((correct) => !correct).length;
  const left = Math.max(0, LIVES - wrongCount);
  const last = results.at(-1);
  // The heart lost by the answer on screen: its slash is drawn as the stamp lands.
  const striking = answered && last === false ? left : -1;
  const marks = answered ? results.slice(0, -1) : results;
  const layout = trailLayout(marks.length);
  const crossReach = round1(layout.side * 0.22);
  const crossStroke = marks.length <= 14 ? 1.4 : 1.3;
  const here = { x: 238, y: 17 };

  return (
    <PathFrame
      label={livesLabel(results)}
      className={className}
      progress={
        left === 0 ? (
          <>
            <Num>No</Num> lives left
          </>
        ) : (
          <>
            <Num>{left}</Num> of {LIVES} lives left
          </>
        )
      }
      tally={
        <>
          <Num>{results.length}</Num> answered
        </>
      }
    >
      {HEART_X.map((_, j) => (
        <Heart key={j} index={j} lost={j >= left} draw={!reduced && j === striking} />
      ))}
      {marks.length > 0 ? (
        <path d={`M${layout.x(0)} 17H238`} fill="none" className="stroke-(--color-ink)" strokeWidth="1.2" strokeLinecap="round" />
      ) : null}
      <path d="M238 17H274" fill="none" className="stroke-(--color-ink)" strokeWidth="1.6" strokeDasharray="2 5" strokeLinecap="round" />
      {marks.map((correct, i) =>
        correct ? <circle key={i} data-trail="correct" cx={layout.x(i)} cy={17} r={layout.r} className="fill-(--color-ink)" /> : null,
      )}
      {/* The wrong squares after every dot, so the dots of the cards around them never cover their x. */}
      {marks.map((correct, i) => {
        if (correct) return null;
        const x = layout.x(i);
        return (
          <g key={i} data-trail="wrong">
            <rect x={round1(x - layout.side / 2)} y={round1(17 - layout.side / 2)} width={layout.side} height={layout.side} rx="1.5" className="fill-(--color-wrong)" />
            {layout.cross ? (
              <path
                d={`M${round1(x - crossReach)} ${17 - crossReach}l${round1(crossReach * 2)} ${round1(crossReach * 2)}m0-${round1(crossReach * 2)}l-${round1(crossReach * 2)} ${round1(crossReach * 2)}`}
                fill="none"
                className="stroke-(--color-surface-raised)"
                strokeWidth={crossStroke}
              />
            ) : null}
          </g>
        );
      })}
      <Plane at={here} heading={0} hidden={answered} />
      {answered && last !== undefined ? <Mark verdict={last ? "correct" : "wrong"} at={here} fresh /> : null}
    </PathFrame>
  );
}
