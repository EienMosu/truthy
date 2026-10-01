"use client";

// The result of a finished Classic round (spec sections 6, 7 and 9; mockup result-classic): the completed
// flight path, the ticket with the score block and the comparison with the record for this route and
// mode, the missed cards with their explanations, and two actions: play the same route and mode again,
// or choose another route. Showing it records the round in the progress on the device, exactly once.
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { BoardingPass } from "@/components/BoardingPass";
import { FlightPath } from "@/components/FlightPath";
import { MissedCards, missedCards } from "@/components/MissedCards";
import { PillButton } from "@/components/PillButton";
import { QuietButton } from "@/components/QuietButton";
import { RoundButton } from "@/components/RoundButton";
import { ScoreBlock } from "@/components/ScoreBlock";
import { SkyBackdrop } from "@/components/SkyBackdrop";
import { pad2 } from "@/components/format";
import { CloseIcon, ReplayIcon, RouteIcon } from "@/components/icons";
import { summarise, type RoundState } from "@/src/engine/round";
import { applyResult, compareWithBest, type ApplyOutcome } from "@/src/progress/progress";
import type { ProgressStore } from "@/src/progress/local";
import type { TicketInfo } from "./useRound";

export interface ResultViewProps {
  /** The finished round (phase "finished", not abandoned). */
  round: RoundState;
  ticket: TicketInfo;
  /** The progress store on the device (useRound's progressStore). Pass a stable function. */
  progressStore: () => ProgressStore;
  /** "Play again": a new round on the same route and mode (useRound's restart). */
  onPlayAgain: () => void;
  /** "Choose another route" and the close button: back to the start. */
  onHome: () => void;
}

// Rounds already written to the progress store, with what applyResult said. A round is recorded once,
// however often its result is rendered, its effect runs (React strict mode runs it twice) or it remounts.
const recorded = new WeakMap<RoundState, ApplyOutcome>();

/**
 * Records a finished round in the store: card history, the record for its route and mode, the last route
 * played (the start screen's "Continue"). The first call for a round writes; later calls return the same
 * outcome without writing again. A store that cannot save does not throw (createLocalStore).
 */
export function recordRound(round: RoundState, store: ProgressStore): ApplyOutcome {
  const done = recorded.get(round);
  if (done) return done;
  const outcome = applyResult(store.load(), summarise(round));
  store.save(outcome.progress);
  recorded.set(round, outcome);
  return outcome;
}

/**
 * The outcome of recording the round. The render computes it from the stored progress without writing
 * (so the comparison is on screen in the first frame); the effect then writes it, once.
 */
export function useRecordedRound(round: RoundState, progressStore: () => ProgressStore): ApplyOutcome {
  const outcome = useMemo(
    () => recorded.get(round) ?? applyResult(progressStore().load(), summarise(round)),
    [round, progressStore],
  );
  useEffect(() => {
    recordRound(round, progressStore());
  }, [round, progressStore]);
  return outcome;
}

// The ticket fills the stage and its missed-card list scrolls inside, as in the mockup. On a short phone,
// where the score part and a 228 px list do not both fit, the stage scrolls instead. The scroller runs on
// under "Play again" (opaque, like the play screen's pills), so the ticket's shadow still shows in the gap
// above it; it stops above the quiet button, which has no background to hide the ticket.
const UNDER_PILL = "(var(--space-12) + var(--size-pill))";
const SCROLLER: CSSProperties = {
  bottom: `calc(-1 * ${UNDER_PILL})`,
  paddingBottom: `calc${UNDER_PILL}`,
  scrollbarWidth: "none",
};

export function ResultView({ round, ticket, progressStore, onPlayAgain, onHome }: ResultViewProps) {
  const outcome = useRecordedRound(round, progressStore);
  const result = summarise(round);
  const comparison = compareWithBest(result.score, outcome.previousBest);
  const total = round.cards.length;
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The ticket jolts as the New best stamp lands, so the jolt starts after the first frame.
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    setLanded(true);
  }, []);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <SkyBackdrop />
      <header className="relative z-10 flex h-(--size-header) flex-none items-center gap-(--space-12)">
        <RoundButton label="Close results" onClick={onHome}>
          <CloseIcon />
        </RoundButton>
        <FlightPath variant="completed" total={total} results={round.answers.map((answer) => answer.correct)} />
      </header>
      <section aria-labelledby={headingId} className="relative mt-(--space-12) min-h-0 flex-1">
        <h1 id={headingId} ref={headingRef} tabIndex={-1} className="sr-only">
          Round complete
        </h1>
        <div className="absolute inset-x-0 top-0 overflow-y-auto overscroll-contain" style={SCROLLER}>
          <BoardingPass
            className="grid min-h-full grid-rows-[max-content_minmax(var(--size-lower),1fr)]"
            from={{ code: ticket.deckCode, name: ticket.deckName }}
            to={{ code: ticket.sectionCode, name: ticket.sectionName }}
            fields={[
              { label: "Class", value: ticket.modeLabel },
              { label: "Cards", value: `${pad2(result.total)} / ${pad2(total)}` },
              { label: "Missed", value: pad2(result.missed.length) },
            ]}
            jolt={landed && comparison.kind === "new-best"}
            lower={<MissedCards missed={missedCards(round.answers)} className="contain-size" />}
          >
            <ScoreBlock score={result.score} total={total} comparison={comparison} animate />
          </BoardingPass>
        </div>
      </section>
      <div className="relative z-10 mt-(--space-12) flex flex-none flex-col gap-(--space-4)">
        <PillButton leadingIcon={<ReplayIcon />} onClick={onPlayAgain}>
          Play again
        </PillButton>
        <QuietButton leadingIcon={<RouteIcon />} onClick={onHome}>
          Choose another route
        </QuietButton>
      </div>
    </main>
  );
}
