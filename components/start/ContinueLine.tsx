// The continue line of start step 1 (design system 5.4a): one tap back into the last route for a
// returning player. It fills the whole pass and goes straight to "Your pass is ready". Offline, when the
// route's deck has no copy on the device, it says "Needs a connection" and is not a button.
import type { Ref } from "react";
import { LogoMark } from "@/components/Logo";
import { ChevronIcon } from "@/components/icons";

export interface ContinueLineProps {
  /** "CLF". */
  deckCode: string;
  /**
   * The deck's name on the pass ("AWS Cloud Practitioner", "React Fundamentals"; deckPassName), on the line and
   * in the accessible name. The bare deck title would not do: six decks are titled "Fundamentals".
   */
  deckName: string;
  /** "SEC", or "ALL" for the whole deck. */
  sectionCode: string;
  /** "Security and compliance", or "Whole deck". */
  sectionTitle: string;
  /** "Classic". */
  modeLabel: string;
  /** The score of the last round, already worded ("7 of 10", "13 in a row"), when it is known. */
  lastScore?: string;
  /**
   * The route's deck cannot be played now (offline, no copy on the device): the line says "Needs a connection"
   * in place of the last score, has no chevron and is a labelled, disabled group instead of a button.
   */
  needsConnection?: boolean;
  onContinue: () => void;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * "Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10.", or, when the deck
 * cannot be played now, "Continue: AWS Cloud Practitioner, Security and compliance, Classic, needs a connection."
 */
export function continueLabel({ deckName, sectionTitle, modeLabel, lastScore, needsConnection }: Omit<ContinueLineProps, "onContinue" | "ref" | "deckCode" | "sectionCode">): string {
  if (needsConnection) return `Continue: ${deckName}, ${sectionTitle}, ${modeLabel}, needs a connection.`;
  const score = lastScore ? ` Last score ${lastScore}.` : "";
  return `Continue: ${deckName}, ${sectionTitle}, ${modeLabel}.${score}`;
}

/** " · " in a 3ch box, the width the mono line pulls itself to the left by. */
function Separator() {
  return (
    <span data-continue="sep" className="w-[3ch] flex-none whitespace-pre">
      {" · "}
    </span>
  );
}

const ROW = "flex h-(--size-pill) w-full items-center gap-(--space-14) rounded-(--radius-card) pr-(--space-12) pl-(--space-4) text-left";

export function ContinueLine(props: ContinueLineProps) {
  const { deckCode, deckName, sectionCode, modeLabel, lastScore, needsConnection = false, onContinue, ref } = props;
  const content = (
    <>
      <span aria-hidden="true" className="grid size-(--size-continue-icon) flex-none place-items-center rounded-full bg-(--color-surface-raised)">
        <LogoMark width={26} />
      </span>
      <span aria-hidden="true" className="flex min-w-0 flex-1 flex-col gap-[3px]">
        {/*
          The deck's name on the pass, on one line: a name longer than the column ends in an ellipsis (the
          accessible name has all of it). One line leaves room in the 60 px row for two lines below it, so the
          last score always has a line to go to, on a 320 px phone too (review finding U61).
        */}
        <span
          data-continue="deck"
          className="truncate font-(family-name:--type-emphasis-family) text-(length:--type-emphasis-size) font-(--type-emphasis-weight) leading-[1.2] tracking-(--type-emphasis-letter-spacing)"
        >
          {deckName}
        </span>
        {/*
          The mono line is three parts that are never cut: the route, the class and the last score (offline,
          for a deck with no copy on the device, "Needs a connection" in its place). A part
          that does not fit after the others moves to the next line, and the line box shows at most two lines.
          Each separator sits in the 3ch before its part; the row is pulled 3ch to the left and clipped, so
          the separator of a part that starts a line is outside the box and never shows as a stray "·".
        */}
        <span
          data-continue="line"
          className="block max-h-[2lh] overflow-hidden font-(family-name:--type-mono-data-family) text-(length:--type-mono-data-size) font-(--type-mono-data-weight) leading-(--type-mono-data-line-height) text-(--color-ink-muted)"
        >
          <span className="-ml-[3ch] flex flex-wrap whitespace-nowrap">
            <span data-continue="route" className="ml-[3ch] min-w-0 overflow-hidden text-ellipsis">
              {deckCode} → {sectionCode}
            </span>
            <span className="flex min-w-0">
              <Separator />
              <span data-continue="class" className="min-w-0 overflow-hidden text-ellipsis">
                {modeLabel}
              </span>
            </span>
            {needsConnection ? (
              <span className="flex min-w-0">
                <Separator />
                <span data-continue="reason" className="min-w-0 overflow-hidden text-ellipsis font-(--font-weight-mono-semibold) text-(--color-ink)">
                  Needs a connection
                </span>
              </span>
            ) : lastScore ? (
              <span className="flex min-w-0">
                <Separator />
                <span data-continue="score" className="min-w-0 overflow-hidden text-ellipsis">
                  {"last "}
                  <em className="font-(--font-weight-mono-semibold) text-(--color-ink) not-italic">{lastScore}</em>
                </span>
              </span>
            ) : null}
          </span>
        </span>
      </span>
    </>
  );

  if (needsConnection) {
    return (
      <div role="group" aria-label={continueLabel(props)} aria-disabled="true" data-unavailable="" className={`${ROW} text-(--color-ink-muted)`}>
        {content}
      </div>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      aria-label={continueLabel(props)}
      onClick={onContinue}
      className={[
        ROW,
        "cursor-pointer text-(--color-ink)",
        "transition-[scale,background-color] duration-(--duration-t1) ease-(--easing-ease) active:scale-[0.98] active:bg-(--color-press)",
      ].join(" ")}
    >
      {content}
      <span aria-hidden="true" className="flex flex-none">
        <ChevronIcon />
      </span>
    </button>
  );
}
