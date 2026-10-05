// The continue line of start step 1 (design system 5.4a): one tap back into the last route for a
// returning player. It fills the whole pass and goes straight to "Your pass is ready".
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
  onContinue: () => void;
  ref?: Ref<HTMLButtonElement>;
}

/** "Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10." */
export function continueLabel({ deckName, sectionTitle, modeLabel, lastScore }: Omit<ContinueLineProps, "onContinue" | "ref" | "deckCode" | "sectionCode">): string {
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

export function ContinueLine(props: ContinueLineProps) {
  const { deckCode, deckName, sectionCode, modeLabel, lastScore, onContinue, ref } = props;
  return (
    <button
      ref={ref}
      type="button"
      aria-label={continueLabel(props)}
      onClick={onContinue}
      className={[
        "flex h-(--size-pill) w-full cursor-pointer items-center gap-(--space-14) rounded-(--radius-card) pr-(--space-12) pl-(--space-4) text-left text-(--color-ink)",
        "transition-[scale,background-color] duration-(--duration-t1) ease-(--easing-ease) active:scale-[0.98] active:bg-(--color-press)",
      ].join(" ")}
    >
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
          The mono line is three parts that are never cut: the route, the class and the last score. A part
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
            {lastScore ? (
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
      <span aria-hidden="true" className="flex flex-none">
        <ChevronIcon />
      </span>
    </button>
  );
}
