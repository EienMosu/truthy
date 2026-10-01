// The flight-path header of a Classic round (design system 5.10, "Count" and "Completed" variants): the route as a curve
// with one waypoint per card, the plane on the card on screen, and a label row with the progress and the
// tally. Waypoints differ by shape as well as colour: a circle with a tick (correct), a square with an x
// (wrong), the plane (current), a small open circle (still to come). The whole path is one image with a
// full-sentence label; the label row is hidden from screen readers because the image already says it.
// PathFrame, RouteLine, Plane and Mark are the pieces every mode's header is drawn with.
import type { ReactNode } from "react";
import { ICON_PATHS } from "./icons";

export type WaypointState = "correct" | "wrong" | "current" | "future";

/** During a round: the plane on the card on screen. */
export interface RoundFlightPathProps {
  variant?: "round";
  /** Number of cards in the round (10 in Classic, fewer when the route has fewer cards). */
  total: number;
  /** Whether each answered card was correct, in order. */
  results: readonly boolean[];
  /** Index (from 0) of the card on screen. */
  current: number;
  /** True once the card on screen has been answered: the plane fades out and the card shows its mark. */
  answered: boolean;
  className?: string;
}

/** On the result screen: the whole route flown, every card resolved, no plane ("Arrived · 10 of 10"). */
export interface CompletedFlightPathProps {
  variant: "completed";
  /** Marks on the route: the cards dealt (Classic) or the cards answered (the other modes). */
  total: number;
  results: readonly boolean[];
  /** Left of the label row. Default: Arrived · {results.length} of {total}. */
  progress?: ReactNode;
  /** The accessible name. Default: completedLabel(total, results). */
  label?: string;
  /** Index (from 0) of a card to ring (Streak: where the previous best was reached). */
  ring?: number;
  className?: string;
}

export type FlightPathProps = RoundFlightPathProps | CompletedFlightPathProps;

// The curve of the route, M6 24 Q138 -6 270 24, in the 276 by 34 viewBox.
const P0 = { x: 6, y: 24 };
const P1 = { x: 138, y: -6 };
const P2 = { x: 270, y: 24 };

export interface Point {
  x: number;
  y: number;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The point of the curve at t (0 to 1). */
export function pointAt(t: number): Point {
  const p = lerp(lerp(P0, P1, t), lerp(P1, P2, t), t);
  return { x: round2(p.x), y: round2(p.y) };
}

/** Where waypoint i of n sits on the curve: evenly spread in t, the first at the start, the last at the end. */
export function waypointT(i: number, n: number): number {
  return n <= 1 ? 0 : i / (n - 1);
}

/** The flown part of the curve, from the start to t, as an SVG path (the curve split at t). */
export function flownPath(t: number): string {
  const control = lerp(P0, P1, t);
  const end = pointAt(t);
  return `M${P0.x} ${P0.y} Q${round2(control.x)} ${round2(control.y)} ${end.x} ${end.y}`;
}

/** The plane's heading at t, in degrees (the direction of the curve). */
export function headingAt(t: number): number {
  const dx = 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x);
  const dy = 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y);
  return round2((Math.atan2(dy, dx) * 180) / Math.PI);
}

/** The state of every waypoint. */
export function waypointStates(total: number, results: readonly boolean[], current: number, answered: boolean): WaypointState[] {
  return Array.from({ length: total }, (_, i) => {
    const result = results[i];
    if (result !== undefined && (i < current || answered)) return result ? "correct" : "wrong";
    if (i === current) return "current";
    return "future";
  });
}

// "card 3", "cards 1 and 2", "cards 1, 2 and 5"
export function cardList(numbers: readonly number[]): string {
  if (numbers.length === 1) return `card ${numbers[0]}`;
  const head = numbers.slice(0, -1).join(", ");
  return `cards ${head} and ${numbers[numbers.length - 1]}`;
}

/** The accessible label: "Card 4 of 10. Cards 1 and 2 correct, card 3 wrong." */
export function flightPathLabel(total: number, results: readonly boolean[], current: number): string {
  const correct: number[] = [];
  const wrong: number[] = [];
  results.forEach((result, i) => (result ? correct : wrong).push(i + 1));
  const parts: string[] = [];
  if (correct.length > 0) parts.push(`${cardList(correct)} correct`);
  if (wrong.length > 0) parts.push(`${cardList(wrong)} wrong`);
  const head = `Card ${current + 1} of ${total}.`;
  if (parts.length === 0) return head;
  const tally = parts.join(", ");
  return `${head} ${tally.charAt(0).toUpperCase()}${tally.slice(1)}.`;
}

/** The accessible label of a finished round: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9." */
export function completedLabel(total: number, results: readonly boolean[]): string {
  const wrong: number[] = [];
  results.forEach((result, i) => {
    if (!result) wrong.push(i + 1);
  });
  const correct = results.length - wrong.length;
  const head = `Round complete. ${results.length} of ${total} cards. ${correct} correct, ${wrong.length} wrong`;
  return wrong.length === 0 ? `${head}.` : `${head}: ${cardList(wrong)}.`;
}

const MARK_STROKE = 1.8;

/**
 * The scale of the marks on a completed route (1 is a circle of radius 7 and a square of 13): full size up
 * to 10 cards, 6/7 up to 17, then as large as keeps neighbours apart (35% of the 264 wide route per gap).
 */
export function completedScale(cards: number): number {
  if (cards <= 10) return 1;
  if (cards <= 17) return 6 / 7;
  return Math.min(6, (0.35 * 264) / (cards - 1)) / 7;
}

export interface MarkProps {
  verdict: "correct" | "wrong";
  at: Point;
  /** 1 (default) is a circle of radius 7 or a square of 13 by 13; the whole mark scales. */
  scale?: number;
  /** The card just answered: a correct mark is drawn in the correct colour instead of ink; the g carries data-fresh. */
  fresh?: boolean;
  /** No tick and no x (marks too small to carry them). */
  plain?: boolean;
}

/** The mark of an answered card: a circle with a tick (correct) or a square with an x (wrong). */
export function Mark({ verdict, at, scale = 1, fresh = false, plain = false }: MarkProps) {
  const transform = `translate(${at.x} ${at.y})${scale === 1 ? "" : ` scale(${scale})`}`;
  const freshProps = fresh ? { "data-fresh": "" } : {};
  if (verdict === "correct") {
    return (
      <g data-waypoint="correct" transform={transform} {...freshProps}>
        <circle r="7" className={fresh ? "fill-(--color-correct)" : "fill-(--color-ink)"} />
        {plain ? null : <path d="M-3 0l2 2 4-4" fill="none" className="stroke-(--color-surface-raised)" strokeWidth={MARK_STROKE} />}
      </g>
    );
  }
  return (
    <g data-waypoint="wrong" transform={transform} {...freshProps}>
      <rect x="-6.5" y="-6.5" width="13" height="13" rx="2" className="fill-(--color-wrong)" />
      {plain ? null : <path d="M-3-3l6 6m0-6l-6 6" className="stroke-(--color-surface-raised)" strokeWidth={MARK_STROKE} />}
    </g>
  );
}

function Waypoint({ state, at, isLast, isCurrent }: { state: WaypointState; at: Point; isLast: boolean; isCurrent: boolean }) {
  if (state === "correct" || state === "wrong") {
    // The card just answered shows its tick on the correct colour; earlier ones are ink.
    return <Mark verdict={state} at={at} fresh={state === "correct" && isCurrent} />;
  }
  if (state === "current") {
    // The plane is drawn on top of everything by the caller; this keeps the waypoint's place in the list.
    return <g data-waypoint="current" transform={`translate(${at.x} ${at.y})`} />;
  }
  return (
    <g data-waypoint="future" transform={`translate(${at.x} ${at.y})`}>
      <circle r={isLast ? 5 : 4} className="fill-(--color-surface-raised) stroke-(--color-ink)" strokeWidth="1.6" />
    </g>
  );
}

export interface PathFrameProps {
  /** The accessible name of the whole header (role="img"). */
  label: string;
  /** Left of the label row. */
  progress: ReactNode;
  /** Right of the label row; left out: nothing. */
  tally?: ReactNode;
  /** The SVG content, in the 276 by 34 viewBox. */
  children: ReactNode;
  className?: string;
}

/** The wrapper every header shares: one image with a full-sentence label, the drawing and the label row (hidden from screen readers). */
export function PathFrame({ label, progress, tally, children, className }: PathFrameProps) {
  return (
    <div role="img" aria-label={label} data-flight-path="" className={["min-w-0 flex-1", className].filter(Boolean).join(" ")}>
      <svg viewBox="0 0 276 34" aria-hidden="true" focusable="false" className="block h-(--size-flight-path-height) w-full overflow-visible">
        {children}
      </svg>
      <div
        aria-hidden="true"
        className="mt-(--space-2) flex justify-between font-(family-name:--type-route-label-family) text-(length:--type-route-label-size) leading-(--type-route-label-line-height) font-(--type-route-label-weight) tracking-(--type-route-label-letter-spacing) text-(--color-ink)"
      >
        <span data-progress="">{progress}</span>
        {tally === undefined ? null : <span data-tally="">{tally}</span>}
      </div>
    </div>
  );
}

/** The dotted curve of the route and, once the plane has left, the solid part up to t. */
export function RouteLine({ flownTo }: { flownTo: number }) {
  return (
    <>
      <path
        d={`M${P0.x} ${P0.y} Q${P1.x} ${P1.y} ${P2.x} ${P2.y}`}
        fill="none"
        className="stroke-(--color-ink)"
        strokeWidth="1.6"
        strokeDasharray="2 5"
        strokeLinecap="round"
      />
      {flownTo > 0 ? <path d={flownPath(flownTo)} fill="none" className="stroke-(--color-ink)" strokeWidth="2.4" strokeLinecap="round" /> : null}
    </>
  );
}

/** The plane on the card on screen; faded out (opacity, never visibility) once the card has its mark. */
export function Plane({ at, heading, hidden = false }: { at: Point; heading: number; hidden?: boolean }) {
  return (
    <g
      data-plane=""
      transform={`translate(${at.x} ${at.y}) rotate(${heading})`}
      className={["transition-opacity duration-(--duration-t2) ease-(--easing-ease)", hidden ? "opacity-0" : "opacity-100"].join(" ")}
    >
      <circle r="12" className="fill-(--color-accent)" />
      <path
        d={ICON_PATHS.planeArrow}
        fill="none"
        className="stroke-(--color-on-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** A bold number of the label row. */
export function Num({ children }: { children: ReactNode }) {
  return <b className="font-(--font-weight-mono-semibold)">{children}</b>;
}

function CompletedMarks({ results, total, ring }: { results: readonly boolean[]; total: number; ring: number | undefined }) {
  const scale = completedScale(total);
  // A mark too small to carry its tick or its x is drawn plain.
  const plainCorrect = 7 * scale < 5;
  const plainWrong = 13 * scale < 6;
  const ringAt = ring === undefined || ring < 0 || ring >= total ? null : pointAt(waypointT(ring, total));
  return (
    <>
      {results.slice(0, total).map((correct, i) => (
        <Mark
          key={i}
          verdict={correct ? "correct" : "wrong"}
          at={pointAt(waypointT(i, total))}
          scale={scale}
          plain={correct ? plainCorrect : plainWrong}
        />
      ))}
      {ringAt === null ? null : (
        <circle
          data-ring="reached"
          cx={ringAt.x}
          cy={ringAt.y}
          r={round2(7 * scale + 3.5)}
          fill="none"
          className="stroke-(--color-ink)"
          strokeWidth="1.4"
        />
      )}
    </>
  );
}

export function FlightPath(props: FlightPathProps) {
  const { total, results, className } = props;
  const correct = results.filter(Boolean).length;
  const wrong = results.length - correct;
  const tally = (
    <>
      {correct} correct · {wrong} wrong
    </>
  );

  if (props.variant === "completed") {
    return (
      <PathFrame
        label={props.label ?? completedLabel(total, results)}
        className={className}
        progress={
          props.progress ?? (
            <>
              <Num>Arrived</Num> · {results.length} of {total}
            </>
          )
        }
        tally={tally}
      >
        <RouteLine flownTo={1} />
        <CompletedMarks results={results} total={total} ring={props.ring} />
      </PathFrame>
    );
  }

  const { current, answered } = props;
  const states = waypointStates(total, results, current, answered);
  const t = waypointT(current, total);

  return (
    <PathFrame
      label={flightPathLabel(total, results, current)}
      className={className}
      progress={
        <>
          Card <Num>{current + 1}</Num> of {total}
        </>
      }
      tally={tally}
    >
      <RouteLine flownTo={t} />
      {states.map((state, i) => (
        <Waypoint key={i} state={state} at={pointAt(waypointT(i, total))} isLast={i === total - 1} isCurrent={i === current} />
      ))}
      <Plane at={pointAt(t)} heading={headingAt(t)} hidden={answered} />
    </PathFrame>
  );
}
