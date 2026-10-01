"use client";

// The /play screen (spec sections 6, 8, 9 and 10): loads the pending round, shows the boarding pass with
// the statement and the stub, takes answers from the swipe, the buttons and the keyboard through one
// function, reveals the answer slip, and leaves with one confirmation. A finished round shows its result
// (ResultView), which records it and offers Play again and another route.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { AnswerButtons } from "@/components/AnswerButtons";
import {
  BoardingPass,
  BoardingPassPlaceholder,
  GateValue,
  PassSlip,
  PassStatement,
  PassStub,
  type TearSide,
} from "@/components/BoardingPass";
import { FlightPath } from "@/components/FlightPath";
import { PillButton } from "@/components/PillButton";
import { RoundButton } from "@/components/RoundButton";
import { SkyBackdrop } from "@/components/SkyBackdrop";
import { EASE } from "@/components/easing";
import { pad2 } from "@/components/format";
import { CloseIcon } from "@/components/icons";
import { SWIPE } from "@/src/input/swipe";
import { currentCard, isDecided, lastAnswer, type RoundEvent, type RoundState } from "@/src/engine/round";
import { LeaveDialog } from "./LeaveDialog";
import { saveLeftRound } from "./leave";
import { ResultView } from "./ResultView";
import { browserPlayServices, useRound, type PlayServices, type TicketInfo } from "./useRound";
import { useSwipe } from "./useSwipe";

export interface PlayScreenProps {
  /** The outside world. Defaults to the browser (fetch, localStorage, sessionStorage, Date.now, crypto). Pass a stable object. */
  services?: PlayServices;
}


/**
 * How long after an answer the action ("Next card", or "See results" after a deciding answer) counts as
 * arrived and starts to accept presses. Before that it is coming in where True and False were, so a double tap on an answer must not reach it. The time guards
 * against the second tap, not the animation, so it is the same with reduced motion.
 */
export const NEXT_ARRIVES_MS = 420;

// The card follows --drag-x (set by useSwipe): translateX(dx) and a rotation of dx / 18 degrees.
const CARD_TRANSFORM: CSSProperties = {
  transform:
    "translateX(calc(var(--drag-x, 0) * 1px)) rotate(calc(var(--drag-x, 0) / var(--gesture-rotation-divisor) * 1deg))",
};

// The ticket scrolls inside the stage when it is taller than the space (long texts, short phones). The
// scroller runs on under the action row, so at 390 by 844 nothing scrolls and the ticket's shadow shows
// in the gap above the buttons, as in the mockup; its side padding lets a dragged card reach the frame edge.
const SCROLLER: CSSProperties = {
  bottom: "calc(-1 * (var(--space-12) + var(--size-actions)))",
  paddingBottom: "calc(var(--space-12) + var(--size-actions))",
  scrollbarWidth: "none",
};

/** What the live region says after an answer: "Correct. The answer is False." */
export function verdictText(correct: boolean, answer: boolean): string {
  return `${correct ? "Correct" : "Not quite"}. The answer is ${answer ? "True" : "False"}.`;
}

export function PlayScreen({ services = browserPlayServices }: PlayScreenProps) {
  const router = useRouter();
  // Home is the start at step 1. When the start flow's first entry is right behind /play, going back to it
  // keeps the history clean; otherwise / replaces /play.
  const goHome = useCallback(() => {
    if (!services.backToStart?.()) router.replace("/");
  }, [router, services]);
  const { status, dispatch, retry, restart, progressStore } = useRound(services, goHome);

  // A round in progress with answers that are not in the card history yet. Leaving any other way than the
  // close control (the phone's back gesture, the browser's back button) unmounts this screen; the cleanup
  // below then leaves the round the same way, so those answers are not lost.
  const unsaved = useRef<RoundState | null>(null);
  useEffect(() => {
    const round = status.kind === "ready" ? status.round : null;
    unsaved.current = round && round.phase !== "finished" && !round.abandoned && round.answers.length > 0 ? round : null;
  });
  useEffect(
    () => () => {
      const round = unsaved.current;
      unsaved.current = null;
      if (round) {
        saveLeftRound(round, progressStore());
      }
    },
    [progressStore],
  );

  // Leaving: the round is abandoned, the answers given so far go into the card history (no record),
  // and the player goes back to the start. Without answers nothing is recorded.
  const leave = useCallback(
    (round: RoundState) => {
      unsaved.current = null;
      dispatch({ type: "abandon" });
      if (round.answers.length > 0) {
        saveLeftRound(round, progressStore());
      }
      goHome();
    },
    [dispatch, progressStore, goHome],
  );

  if (status.kind === "error") return <LoadFailed onRetry={retry} onLeave={goHome} />;
  if (status.kind !== "ready" || status.round.abandoned) return <Loading onLeave={goHome} />;

  const { round, ticket } = status;
  if (round.phase === "finished") {
    return <ResultView round={round} ticket={ticket} progressStore={progressStore} onPlayAgain={restart} onHome={goHome} />;
  }

  return <RoundView round={round} ticket={ticket} now={services.now} dispatch={dispatch} onLeave={() => leave(round)} />;
}

function Header({ onLeave, closeRef, children }: { onLeave: () => void; closeRef?: Ref<HTMLButtonElement>; children?: ReactNode }) {
  return (
    <header className="relative z-10 flex h-(--size-header) flex-none items-center gap-(--space-12)">
      <RoundButton ref={closeRef} label="Leave round" onClick={onLeave}>
        <CloseIcon />
      </RoundButton>
      {children}
    </header>
  );
}

function Loading({ onLeave }: { onLeave: () => void }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col" aria-busy="true">
      <SkyBackdrop />
      <Header onLeave={onLeave} />
      <section className="relative mt-(--space-12) min-h-0 flex-1">
        <BoardingPassPlaceholder />
      </section>
      <div className="mt-(--space-12) h-(--size-actions) flex-none" />
      <p role="status" className="sr-only">
        Loading your round
      </p>
    </main>
  );
}

function LoadFailed({ onRetry, onLeave }: { onRetry: () => void; onLeave: () => void }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <SkyBackdrop />
      <Header onLeave={onLeave} />
      <section className="relative mt-(--space-12) min-h-0 flex-1">
        <div role="alert" className="rounded-(--radius-card) bg-(--color-surface-raised) p-(--space-20) text-(--color-ink) shadow-(--elevation-ticket)">
          <h1 className="m-0 font-(family-name:--type-step-title-family) text-(length:--type-step-title-size) leading-(--type-step-title-line-height) font-(--type-step-title-weight) tracking-(--type-step-title-letter-spacing)">
            This deck didn&apos;t load
          </h1>
          <p className="m-0 mt-(--space-8) font-(family-name:--type-body-family) text-(length:--type-body-size) leading-(--type-body-line-height) font-(--type-body-weight)">
            Check your connection and try again.
          </p>
        </div>
      </section>
      <div className="mt-(--space-12) h-(--size-actions) flex-none">
        <PillButton onClick={onRetry}>Try again</PillButton>
      </div>
    </main>
  );
}

interface RoundViewProps {
  round: RoundState;
  ticket: TicketInfo;
  now: () => number;
  dispatch: (event: RoundEvent) => void;
  onLeave: () => void;
}

function RoundView({ round, ticket, now, dispatch, onLeave }: RoundViewProps) {
  const reduced = useReducedMotion() ?? false;
  const [confirming, setConfirming] = useState(false);
  // The card index whose "Next card" has arrived (see NEXT_ARRIVES_MS); until then the row takes no taps.
  const [arrivedAt, setArrivedAt] = useState(-1);
  const shownAt = useRef(0);
  const statementRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  const card = currentCard(round);
  const answered = round.phase === "answered";
  const last = answered ? lastAnswer(round) : undefined;
  const total = round.cards.length;
  // The action after an answer: "See results" once the mode's end rule has been met, otherwise "Next card".
  const actionLabel = isDecided(round) ? "See results" : "Next card";

  // A new card: start its settle time, scroll the ticket to the top, put focus on the statement.
  useEffect(() => {
    if (round.phase !== "question") return;
    shownAt.current = now();
    scrollerRef.current?.scrollTo?.({ top: 0 });
    statementRef.current?.focus({ preventScroll: true });
  }, [round.cards, round.index, round.phase, now]);

  // After an answer, the action row arrives after 420 ms and starts to take taps. Focus moves to it then, or
  // at once with reduced motion (Enter on it still waits for the arrival, see next below).
  useEffect(() => {
    if (!answered) return;
    const index = round.index;
    const timer = setTimeout(() => setArrivedAt(index), NEXT_ARRIVES_MS);
    return () => clearTimeout(timer);
  }, [answered, round.index]);
  const nextArrived = answered && arrivedAt === round.index;
  const focusNext = answered && (reduced || nextArrived);
  useEffect(() => {
    if (focusNext) nextRef.current?.focus({ preventScroll: true });
  }, [focusNext, round.index]);

  // Closing the dialog with "Keep playing" returns focus to the close button (once <main> is not inert).
  useEffect(() => {
    if (!confirming && restoreFocus.current) {
      restoreFocus.current = false;
      closeRef.current?.focus();
    }
  }, [confirming]);

  // The one answer path: swipe, buttons and keys all come here. Ignored outside the question phase,
  // while the dialog is open, and for 250 ms after a card appears (so a double tap on "Next card"
  // cannot answer the next card).
  const answer = useCallback(
    (value: boolean) => {
      if (round.phase !== "question" || confirming) return;
      const at = now();
      if (at - shownAt.current < SWIPE.settleMs) return;
      dispatch({ type: "answer", value, at });
    },
    [round.phase, confirming, now, dispatch],
  );

  // The action (the button and Enter) is ignored until it has arrived, timed on the same clock as the answer.
  const answeredAt = last?.at;
  const next = useCallback(() => {
    if (answeredAt === undefined || now() - answeredAt < NEXT_ARRIVES_MS) return;
    dispatch({ type: "next" });
  }, [answeredAt, now, dispatch]);

  // Keyboard: left arrow answers False, right arrow True; Enter is the action after an answer
  // (unless focus is on a link or a button, which handle Enter themselves).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || confirming || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (round.phase === "question" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        answer(event.key === "ArrowRight");
      } else if (round.phase === "answered" && event.key === "Enter") {
        const target = event.target;
        if (target instanceof Element && target.closest("a, button, input, select, textarea")) return;
        event.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [round.phase, confirming, answer, next]);

  const swipe = useSwipe<HTMLDivElement>({
    enabled: round.phase === "question" && !confirming,
    cardShownAt: () => shownAt.current,
    now,
    onSwipe: answer,
  });

  const requestLeave = () => {
    if (round.answers.length === 0) onLeave();
    else setConfirming(true);
  };

  if (!card) return null;

  const tear: TearSide = last?.correct === false ? "right" : "left";
  const cardNumber = pad2(round.index + 1);
  // Only Classic has a fixed length; the other modes show the card number alone.
  const cardField = round.mode === "classic" ? `${cardNumber} / ${pad2(total)}` : cardNumber;
  // The card can be dragged (and is being stamped) in these phases; in the answered phase the explanation can be selected.
  const dragging = round.phase === "question" || round.phase === "stamped";

  return (
    <>
      <main className="flex min-h-0 flex-1 flex-col" inert={confirming}>
        <SkyBackdrop />
        <Header onLeave={requestLeave} closeRef={closeRef}>
          <FlightPath
            total={total}
            results={round.answers.map((a) => a.correct)}
            current={round.index}
            answered={answered}
          />
        </Header>
        <section aria-label="Card" className="relative mt-(--space-12) -mx-(--size-gutter) min-h-0 flex-1">
          <div
            ref={scrollerRef}
            className="absolute inset-x-0 top-0 overflow-x-hidden overflow-y-auto overscroll-contain px-(--size-gutter)"
            style={SCROLLER}
          >
            <div
              ref={swipe.ref}
              data-swipe-card=""
              onPointerDown={swipe.onPointerDown}
              onPointerMove={swipe.onPointerMove}
              onPointerUp={swipe.onPointerUp}
              onPointerCancel={swipe.onPointerCancel}
              className={[
                `group relative touch-pan-y ${dragging ? "select-none" : "select-text"}`,
                "transition-transform duration-(--duration-t3) ease-(--easing-spring) data-dragging:transition-none",
                answered ? "cursor-default" : "cursor-grab data-dragging:cursor-grabbing",
              ].join(" ")}
              style={CARD_TRANSFORM}
            >
              <BoardingPass
                from={{ code: ticket.deckCode, name: ticket.deckName }}
                to={{ code: ticket.sectionCode, name: ticket.sectionName }}
                fields={[
                  { label: "Class", value: ticket.modeLabel },
                  { label: "Card", value: cardField },
                  { label: "Gate", value: <GateValue /> },
                ]}
                jolt={answered}
                lower={
                  <div className="grid min-h-(--size-lower)">
                    {last ? (
                      <PassSlip
                        key={`slip-${round.index}`}
                        className="[grid-area:1/1]"
                        answer={last.card.answer}
                        correct={last.correct}
                        explanation={last.card.text.en.explanation}
                        source={last.card.source}
                        animateStamp
                      />
                    ) : null}
                    <AnimatePresence initial={false} custom={tear}>
                      {round.phase === "question" ? (
                        <PassStub
                          key={`stub-${round.index}`}
                          className="[grid-area:1/1]"
                          routeLine={`${ticket.deckCode} → ${ticket.sectionCode} · ${ticket.modeLabel}`}
                          cardLabel={`Card ${cardNumber}`}
                          barcode={card.id}
                        />
                      ) : null}
                    </AnimatePresence>
                  </div>
                }
              >
                <PassStatement ref={statementRef} appliesTo={card.appliesTo}>
                  {card.text.en.statement}
                </PassStatement>
              </BoardingPass>
            </div>
          </div>
        </section>
        <div className="relative z-10 mt-(--space-12) h-(--size-actions) flex-none">
          <AnimatePresence initial={false}>
            {round.phase === "question" ? (
              <motion.div
                key="answer"
                className="absolute inset-0"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                <AnswerButtons onAnswer={answer} />
              </motion.div>
            ) : (
              <motion.div
                key="next"
                className={`absolute inset-0${nextArrived ? "" : " pointer-events-none"}`}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.22, delay: reduced ? 0 : 0.36, ease: EASE } }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                <PillButton ref={nextRef} trailingIcon="→" onClick={next}>
                  {actionLabel}
                </PillButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p role="status" className="sr-only">
          {last ? verdictText(last.correct, last.card.answer) : ""}
        </p>
      </main>
      <LeaveDialog
        open={confirming}
        onStay={() => {
          restoreFocus.current = true;
          setConfirming(false);
        }}
        onLeave={onLeave}
      />
    </>
  );
}
