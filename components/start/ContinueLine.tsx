// The continue line of start step 1 (design system 5.4a): one tap back into the last route for a
// returning player. It fills the whole pass and goes straight to "Your pass is ready".
import type { Ref } from "react";
import { LogoMark } from "@/components/Logo";
import { ChevronIcon } from "@/components/icons";

export interface ContinueLineProps {
  /** "CLF". */
  deckCode: string;
  /** "Cloud Practitioner", for the accessible name. */
  deckTitle: string;
  /** "SEC", or "ALL" for the whole deck. */
  sectionCode: string;
  /** "Security and compliance", or "Whole deck". */
  sectionTitle: string;
  /** "Classic". */
  modeLabel: string;
  /** The score of the last round, when it is known. */
  lastScore?: { score: number; total: number };
  onContinue: () => void;
  ref?: Ref<HTMLButtonElement>;
}

/** "Continue: Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10." */
export function continueLabel({ deckTitle, sectionTitle, modeLabel, lastScore }: Omit<ContinueLineProps, "onContinue" | "ref" | "deckCode" | "sectionCode">): string {
  const score = lastScore ? ` Last score ${lastScore.score} of ${lastScore.total}.` : "";
  return `Continue: ${deckTitle}, ${sectionTitle}, ${modeLabel}.${score}`;
}

export function ContinueLine(props: ContinueLineProps) {
  const { deckCode, sectionCode, modeLabel, lastScore, onContinue, ref } = props;
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
        <span className="font-(family-name:--type-emphasis-family) text-(length:--type-emphasis-size) font-(--type-emphasis-weight) leading-[1.2] tracking-(--type-emphasis-letter-spacing)">
          Continue where you left off
        </span>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap font-(family-name:--type-mono-data-family) text-(length:--type-mono-data-size) font-(--type-mono-data-weight) leading-(--type-mono-data-line-height) text-(--color-ink-muted)">
          {deckCode} → {sectionCode} · {modeLabel}
          {lastScore ? (
            <>
              {" · last "}
              <em className="font-(--font-weight-mono-semibold) text-(--color-ink) not-italic">
                {lastScore.score} of {lastScore.total}
              </em>
            </>
          ) : null}
        </span>
      </span>
      <span aria-hidden="true" className="flex flex-none">
        <ChevronIcon />
      </span>
    </button>
  );
}
