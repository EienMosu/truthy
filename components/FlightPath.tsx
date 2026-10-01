// The flight-path header of a Classic round (design system 5.10, "Count" and "Completed" variants): the route as a curve
// with one waypoint per card, the plane on the card on screen, and a label row with the progress and the
// tally. Waypoints differ by shape as well as colour: a circle with a tick (correct), a square with an x
// (wrong), the plane (current), a small open circle (still to come). The whole path is one image with a
// full-sentence label; the label row is hidden from screen readers because the image already says it.
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
  total: number;
  results: readonly boolean[];
  className?: string;
}

export type FlightPathProps = RoundFlightPathProps | CompletedFlightPathProps;

// The curve of the route, M6 24 Q138 -6 270 24, in the 276 by 34 viewBox.
const P0 = { x: 6, y: 24 };
const P1 = { x: 138, y: -6 };
const P2 = { x: 270, y: 24 };

interface Point {
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
function cardList(numbers: readonly number[]): string {
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

function Waypoint({ state, at, isLast, isCurrent }: { state: WaypointState; at: Point; isLast: boolean; isCurrent: boolean }) {
  if (state === "correct") {
    // The card just answered shows its tick on the correct colour; earlier ones are ink.
    return (
      <g data-waypoint="correct" transform={`translate(${at.x} ${at.y})`}>
        <circle r="7" className={isCurrent ? "fill-(--color-correct)" : "fill-(--color-ink)"} />
        <path d="M-3 0l2 2 4-4" fill="none" className="stroke-(--color-surface-raised)" strokeWidth={MARK_STROKE} />
      </g>
    );
  }
  if (state === "wrong") {
    return (
      <g data-waypoint="wrong" transform={`translate(${at.x} ${at.y})`}>
        <rect x="-6.5" y="-6.5" width="13" height="13" rx="2" className="fill-(--color-wrong)" />
        <path d="M-3-3l6 6m0-6l-6 6" className="stroke-(--color-surface-raised)" strokeWidth={MARK_STROKE} />
      </g>
    );
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

export function FlightPath(props: FlightPathProps) {
  const { total, results, className } = props;
  const completed = props.variant === "completed";
  const current = completed ? total - 1 : props.current;
  const answered = completed ? true : props.answered;
  const states = waypointStates(total, results, completed ? total : current, answered);
  const t = completed ? 1 : waypointT(current, total);
  const plane = pointAt(t);
  const correct = results.filter(Boolean).length;
  const wrong = results.length - correct;

  return (
    <div
      role="img"
      aria-label={completed ? completedLabel(total, results) : flightPathLabel(total, results, current)}
      data-flight-path=""
      className={["min-w-0 flex-1", className].filter(Boolean).join(" ")}
    >
      <svg viewBox="0 0 276 34" aria-hidden="true" focusable="false" className="block h-(--size-flight-path-height) w-full overflow-visible">
        <path
          d={`M${P0.x} ${P0.y} Q${P1.x} ${P1.y} ${P2.x} ${P2.y}`}
          fill="none"
          className="stroke-(--color-ink)"
          strokeWidth="1.6"
          strokeDasharray="2 5"
          strokeLinecap="round"
        />
        {t > 0 ? <path d={flownPath(t)} fill="none" className="stroke-(--color-ink)" strokeWidth="2.4" strokeLinecap="round" /> : null}
        {states.map((state, i) => (
          <Waypoint
            key={i}
            state={state}
            at={pointAt(waypointT(i, total))}
            isLast={i === total - 1}
            isCurrent={!completed && i === current}
          />
        ))}
        {completed ? null : (
          <g
            data-plane=""
            transform={`translate(${plane.x} ${plane.y}) rotate(${headingAt(t)})`}
            className={[
              "transition-opacity duration-(--duration-t2) ease-(--easing-ease)",
              answered ? "opacity-0" : "opacity-100",
            ].join(" ")}
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
        )}
      </svg>
      <div
        aria-hidden="true"
        className="mt-(--space-2) flex justify-between font-(family-name:--type-route-label-family) text-(length:--type-route-label-size) leading-(--type-route-label-line-height) font-(--type-route-label-weight) tracking-(--type-route-label-letter-spacing) text-(--color-ink)"
      >
        {completed ? (
          <span data-progress="">
            <b className="font-(--font-weight-mono-semibold)">Arrived</b> · {results.length} of {total}
          </span>
        ) : (
          <span data-progress="">
            Card <b className="font-(--font-weight-mono-semibold)">{current + 1}</b> of {total}
          </span>
        )}
        <span data-tally="">
          {correct} correct · {wrong} wrong
        </span>
      </div>
    </div>
  );
}
