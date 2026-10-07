"use client";

// The /play screen (spec sections 6, 8, 9 and 10): loads the pending round, shows the boarding pass with
// the statement and the stub, takes answers from the swipe, the buttons and the keyboard through one
// function, reveals the answer slip, and leaves with one confirmation. Timed shows no slip: the verdict is
// stamped on the stub, the next card is dealt 700 ms later, and at time up only "See results" is left.
// A finished round shows its result (ResultView), which records it and offers Play again and another route.
import { AnimatePresence, motion, useIsPresent, useReducedMotion, type Variants } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { AnswerButtons } from "@/components/AnswerButtons";
import { CardText } from "@/components/CardText";
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
import { LivesPath } from "@/components/LivesPath";
import { StreakPath } from "@/components/StreakPath";
import { StubStamp } from "@/components/Stamp";
import { TimedPath } from "@/components/TimedPath";
import { PillButton } from "@/components/PillButton";
import { RoundButton } from "@/components/RoundButton";
import { SkyBackdrop } from "@/components/SkyBackdrop";
import { EASE, EASE_IN, FALL } from "@/components/easing";
import { pad2 } from "@/components/format";
import { CloseIcon } from "@/components/icons";
import { RETURN_MAX_AGE_MS } from "@/src/app-state/services";
import { goToStart } from "@/src/app-state/to-start";
import { plainText } from "@/src/content/text";
import { SWIPE } from "@/src/input/swipe";
import { TIMED, currentCard, isDecided, lastAnswer, livesLeft, scoreOf, type RoundEvent, type RoundState } from "@/src/engine/round";
import { LeaveDialog } from "./LeaveDialog";
import { leavesSomething, saveLeftRound } from "./leave";
import { ResultView } from "./ResultView";
import { gapAboveRow, keyScroll, slipScroll, spanInTicket, statementScroll, visibleHeight } from "./ticketScroll";
import { useClock } from "./useClock";
import { browserPlayServices, useRound, type PlayServices, type TicketInfo } from "./useRound";
import { useSwipe } from "./useSwipe";

export interface PlayScreenProps {
  /** The outside world. Defaults to the browser (fetch, localStorage, sessionStorage, Date.now, performance.now, crypto). Pass a stable object. */
  services?: PlayServices;
}


/**
 * How long after an answer the action ("Next card", or "See results" after a deciding answer) counts as
 * arrived and starts to accept presses. Before that it is coming in where True and False were, so a double tap on an answer must not reach it. The time guards
 * against the second tap, not the animation, so it is the same with reduced motion.
 */
export const NEXT_ARRIVES_MS = 420;

/**
 * How long after the leave sheet has closed the play screen's live regions keep what they said when it
 * opened (see `said` in RoundView). Long enough for a few rendered frames to pass after <main> stops being
 * inert, so the regions are in the accessibility tree before their text changes, and short enough that the
 * news is heard at once.
 */
export const SPOKEN_RELEASE_MS = 150;

/**
 * How long a way back that started a full page load keeps the screen's controls still. A load that has not
 * replaced the page by then is taken as lost: the screen stops it, and the controls work again. It is the life
 * of the return mark (RETURN_MAX_AGE_MS): a load that lands later would not focus the start's step title
 * either, so the two agree on when a way back is over.
 */
export const FULL_LOAD_WAIT_MS = RETURN_MAX_AGE_MS;

/** The keys the round acts on. Held down, only the first keydown counts (see the repeat guard in RoundView). */
const HELD_KEYS: ReadonlySet<string> = new Set(["ArrowLeft", "ArrowRight", "Enter", "Escape"]);

// The card follows --drag-x (set by useSwipe): translateX(dx) and a rotation of dx / 18 degrees.
const CARD_TRANSFORM: CSSProperties = {
  transform:
    "translateX(calc(var(--drag-x, 0) * 1px)) rotate(calc(var(--drag-x, 0) / var(--gesture-rotation-divisor) * 1deg))",
};

// The ticket scrolls inside the stage when it is taller than the space (long texts, short phones). The
// scroller runs on under the action row, so at 390 by 844 most tickets fit and the ticket's shadow shows
// in the gap above the buttons, as in the mockup; its side padding lets a dragged card reach the frame edge.
// What lies in its bottom padding is hidden under the row, so the screen scrolls what the player needs
// above it (see ticketScroll). On a short screen (a phone held sideways, a zoomed page) a statement can be taller
// than the stage, and its end would lie under True and False: there the scroller runs on over the gap only and
// stops at the top of the row, so nothing of the ticket ever lies under the row and what does not fit is
// scrolled to.
const SCROLLER: CSSProperties = { scrollbarWidth: "none" };
const SCROLLER_ENDS = [
  "bottom-[calc(-1*(var(--space-12)+var(--size-actions)))] pb-[calc(var(--space-12)+var(--size-actions))]",
  "short:bottom-[calc(-1*var(--space-12))] short:pb-(--space-12)",
].join(" ");

/** What the live region says after an answer: "Correct. The answer is False." and, past the record, " New best." */
export function verdictText(correct: boolean, answer: boolean, newBest = false): string {
  return `${correct ? "Correct" : "Not quite"}. The answer is ${answer ? "True" : "False"}.${newBest ? " New best." : ""}`;
}

/**
 * What the live region says after the verdict when a wrong answer changes the round (review finding U50): in
 * Three lives "Life lost, 2 left.", "Last life." or "Out of lives.", in Streak "Streak ended at 3.". A sighted
 * player sees the heart struck through or the streak end as the stamp lands, but the header that says so is an
 * image whose label is not live, so a screen reader would only hear it by going back to the header. Empty after
 * a right answer, in Classic and in Timed, which says its own end.
 */
export function roundStatus(round: RoundState): string {
  if (lastAnswer(round)?.correct !== false) return "";
  if (round.mode === "streak") return `Streak ended at ${scoreOf("streak", round.answers)}.`;
  if (round.mode !== "lives") return "";
  const left = livesLeft(round);
  if (left === 0) return "Out of lives.";
  return left === 1 ? "Last life." : `Life lost, ${left} left.`;
}

/**
 * What the live region says in Timed: "Correct." or "Not quite." during the stamp (Timed gives the answer
 * away nowhere during play), "Time is up. This card doesn't count." at time up, nothing on a question.
 */
export function timedStatus(round: RoundState): string {
  if (isDecided(round)) return "Time is up. This card doesn't count.";
  if (round.phase !== "stamped") return "";
  return lastAnswer(round)?.correct ? "Correct." : "Not quite.";
}

/**
 * What the Timed card announcer says: "Card 2. <statement>" from the second card on, until time is up,
 * with "Applies to <appliesTo>." before the statement when the card has one, as the card shows it above.
 * The first card is read through focus (the statement takes it); at time up the status speaks. The text
 * stays the same through the stamp, so a card is announced once.
 */
export function timedCardText(round: RoundState): string {
  const card = currentCard(round);
  if (round.index === 0 || isDecided(round) || !card) return "";
  const appliesTo = card.appliesTo ? `Applies to ${card.appliesTo}. ` : "";
  return `Card ${round.index + 1}. ${appliesTo}${plainText(card.text.en.statement)}`;
}

// Timed: when the stamp has held, the answered card leaves towards the side that was answered while the next
// is dealt under it (design system 7, "Timed beat").
type CardSide = "left" | "right";
const CARD_SWAP: Variants = {
  dealt: { y: 14, opacity: 0 },
  rest: { x: 0, y: 0, rotate: 0, opacity: 1, transition: { duration: 0.28, ease: EASE } },
  leave: (side: CardSide | undefined) => ({
    x: side === "right" ? "120%" : "-120%",
    rotate: side === "right" ? 8 : -8,
    opacity: 0,
    transition: { default: { duration: 0.22, ease: FALL }, opacity: { duration: 0.22, ease: EASE_IN } },
  }),
};

/**
 * One card of the Timed swap. A card that is leaving lies on top of the one being dealt. Not animated (the
 * other modes, and reduced motion) it is a plain wrapper and the card changes at once.
 */
function CardSlot({ animated, children }: { animated: boolean; children: ReactNode }) {
  const present = useIsPresent();
  return (
    <motion.div
      className="min-w-0 [grid-area:1/1]"
      style={animated ? { zIndex: present ? 0 : 1 } : undefined}
      variants={animated ? CARD_SWAP : undefined}
      initial={animated ? "dealt" : false}
      animate={animated ? "rest" : undefined}
      exit={animated ? "leave" : undefined}
    >
      {children}
    </motion.div>
  );
}

export function PlayScreen({ services = browserPlayServices }: PlayScreenProps) {
  const router = useRouter();
  // Home is the start at step 1. When the start flow's first entry is right behind /play, going back to it
  // keeps the history clean; otherwise / replaces /play.
  const goHome = useCallback(() => {
    if (!services.backToStart?.()) router.replace("/");
  }, [router, services]);
  const { status, dispatch, retry, restart, progressStore } = useRound(services, goHome);
  // Once, as /play opens: its history entry is told whether the start's entry is behind it (review finding
  // U26: a reload of /play forgot it, and leaving then added a second start entry).
  useEffect(() => {
    services.markPlayEntry?.();
  }, [services]);
  // The player's own ways home (Leave round, Choose another route, Close results): the start then focuses its
  // step 1 title. A page load of /play without a round goes home too, but that is not a way back. They are
  // also the safe moment for a waiting update (spec section 7): goToStart applies it and opens the start with
  // a full page load. Until the way back it started has settled, another press of a way back, Play again and
  // Try again do nothing; once the page load has started the guard stays, as the old page stays open until
  // the load replaces it, for FULL_LOAD_WAIT_MS at most. A way back that throws lifts the guard, so the
  // screen's controls work again, and takes back the return mark, so a later start keeps its focus.
  const goingToStart = useRef(false);
  // When the full page load started, on services.monotonic, or null while none has. A load that has not
  // replaced the page after FULL_LOAD_WAIT_MS lifts the guard at the next press. Waiting for pageshow would
  // not do: location.replace took /play's history entry, so this page never comes back from the back-forward
  // cache, and a load that is cut off or never answers fires nothing at all. When the guard lifts, the load
  // is stopped first: a stalled load that landed later would unload /play in the middle of the round that
  // Play again or Try again had just dealt, which spec section 7 forbids. The return mark is taken back with it:
  // no start takes it now, and the mark in memory has no age, so a start that the back gesture opened later,
  // with no control used, would focus its step 1 title.
  const loadingSince = useRef<number | null>(null);
  // Set when the guard lifted after a lost load. The next way back then takes the in-app way, as when no update
  // was applied: once a new version has taken over, every way back is a full page load, which would most likely
  // stall again, and in a home screen app, which has no back gesture, the player could never reach the start.
  const loadLost = useRef(false);
  const wayBackPending = useCallback(() => {
    if (!goingToStart.current) return false;
    const since = loadingSince.current;
    if (since === null || services.monotonic() - since < FULL_LOAD_WAIT_MS) return true;
    services.stopLoading?.();
    services.clearReturnToStart?.();
    loadLost.current = true;
    goingToStart.current = false;
    loadingSince.current = null;
    return false;
  }, [services]);
  const leaveToStart = useCallback(() => {
    if (wayBackPending()) return;
    goingToStart.current = true;
    services.markReturnToStart?.();
    void goToStart(services, router, { inApp: loadLost.current })
      .then((loading) => {
        if (loading) loadingSince.current = services.monotonic();
        else goingToStart.current = false;
      })
      .catch(() => {
        goingToStart.current = false;
        // The mark was set before the way back, which then failed before it moved: no start takes it.
        services.clearReturnToStart?.();
      });
  }, [router, services, wayBackPending]);
  const playAgain = useCallback(() => {
    if (!wayBackPending()) restart();
  }, [restart, wayBackPending]);
  const tryAgain = useCallback(() => {
    if (!wayBackPending()) retry();
  }, [retry, wayBackPending]);

  // A round in progress with answers that are not in the card history yet, or a decided round whose result
  // has not been opened. Leaving any other way than the close control (the phone's back gesture, the
  // browser's back button) unmounts this screen; the cleanup below then leaves the round the same way, so
  // nothing is lost.
  const unsaved = useRef<RoundState | null>(null);
  // Set once pagehide has saved the round: from then on it is never saved again.
  const savedOnHide = useRef(false);
  useEffect(() => {
    const round = status.kind === "ready" ? status.round : null;
    unsaved.current =
      round && round.phase !== "finished" && !round.abandoned && leavesSomething(round) && !savedOnHide.current ? round : null;
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
  // When leaving unloads the page (a back step to another document, another site, a reload, a closed tab),
  // no cleanup runs: pagehide leaves the round the same way. A page kept in the back-forward cache can come
  // back (pageshow, persisted) with that round on screen; its answers are saved, so it is not played on and
  // the player goes to the start.
  useEffect(() => {
    const onPageHide = () => {
      const round = unsaved.current;
      if (!round) return;
      unsaved.current = null;
      savedOnHide.current = true;
      saveLeftRound(round, progressStore());
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || !savedOnHide.current) return;
      dispatch({ type: "abandon" });
      goHome();
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [progressStore, dispatch, goHome]);

  // Leaving: the round is abandoned, the answers given so far go into the card history (no record, unless the
  // round was decided, see saveLeftRound), and the player goes back to the start. A round with no answers that
  // was not decided records nothing.
  const leave = useCallback(
    (round: RoundState) => {
      unsaved.current = null;
      dispatch({ type: "abandon" });
      if (leavesSomething(round)) {
        saveLeftRound(round, progressStore());
      }
      leaveToStart();
    },
    [dispatch, progressStore, leaveToStart],
  );

  if (status.kind === "error") return <LoadFailed onRetry={tryAgain} onLeave={leaveToStart} />;
  if (status.kind !== "ready" || status.round.abandoned) return <Loading onLeave={leaveToStart} />;

  const { round, ticket } = status;
  if (round.phase === "finished") {
    return (
      <ResultView round={round} ticket={ticket} progressStore={progressStore} onPlayAgain={playAgain} onHome={leaveToStart} now={services.monotonic} />
    );
  }

  return <RoundView round={round} ticket={ticket} services={services} dispatch={dispatch} onLeave={() => leave(round)} />;
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
      <h1 className="sr-only">Your round</h1>
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

// On a short screen (at 300 percent zoom) the card is taller than the room between the header and the action row:
// the card's section and the screen keep their content's height then, so the frame scrolls (globals.css) and the
// card never runs on into the gap above "Try again".
function LoadFailed({ onRetry, onLeave }: { onRetry: () => void; onLeave: () => void }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col short:min-h-fit">
      <SkyBackdrop />
      <Header onLeave={onLeave} />
      <section className="relative mt-(--space-12) min-h-0 flex-1 short:min-h-fit">
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
  services: PlayServices;
  dispatch: (event: RoundEvent) => void;
  onLeave: () => void;
}

function RoundView({ round, ticket, services, dispatch, onLeave }: RoundViewProps) {
  const { now, monotonic } = services;
  const reduced = useReducedMotion() ?? false;
  const [confirming, setConfirming] = useState(false);
  // The card index whose "Next card" has arrived (see NEXT_ARRIVES_MS); until then the row takes no taps.
  const [arrivedAt, setArrivedAt] = useState(-1);
  const shownAt = useRef(0);
  const statementRef = useRef<HTMLDivElement>(null);
  // In Timed the answered card unmounts after the next card has mounted: only clear the ref when the
  // statement that leaves is still the one it holds.
  const attachStatement = useCallback((element: HTMLDivElement | null) => {
    statementRef.current = element;
    return () => {
      if (statementRef.current === element) statementRef.current = null;
    };
  }, []);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  // Which card was answered when, on the monotonic clock (the answer's own `at` is on the wall clock, for the
  // card history). Only the first answer to a card sets it: the answer row keeps its last props while it
  // leaves, so a second tap on it calls answer() again, and the reducer ignores that answer.
  const answeredAt = useRef<{ index: number; at: number } | null>(null);
  // Timed: when RoundView saw the time run out, whether True or False has focus, and whether they had it then.
  const timeUpAt = useRef<number | null>(null);
  const answerRowFocused = useRef(false);
  const focusedAtTimeUp = useRef(false);

  const card = currentCard(round);
  const answered = round.phase === "answered";
  const last = answered ? lastAnswer(round) : undefined;
  const total = round.cards.length;
  const timed = round.mode === "timed";
  const decided = isDecided(round);
  // Timed: time is up (the card on screen does not count), or the stamp beat after an answer.
  const timeUp = timed && decided;
  const beat = timed && round.phase === "stamped" && !decided;
  const stamped = beat ? lastAnswer(round) : undefined;
  // The action row is the Next row ("Next card" or "See results"): after an answer in the modes that show
  // a verdict, and at time up in Timed. During the Timed stamp beat it is still the answer row.
  const awaitsNext = answered || timeUp;
  // The action after an answer: "See results" once the mode's end rule has been met, otherwise "Next card".
  const actionLabel = decided ? "See results" : "Next card";
  // Streak: the answer that takes the streak one past a stored best of at least 1 gets the New best stamp, once.
  const streak = round.mode === "streak" ? scoreOf("streak", round.answers) : 0;
  const newBest = last?.correct === true && ticket.best !== null && ticket.best >= 1 && streak === ticket.best + 1;

  // What the live regions say (the status, and in Timed the card announcer). While the leave sheet is open
  // <main> is inert and its live regions are not exposed, so a change under the sheet (time running out, the
  // next Timed card) would never be heard: they keep what they said when the sheet opened, and take what
  // they say now SPOKEN_RELEASE_MS after it has closed. A browser builds its accessibility tree once per
  // rendered frame, so a change made in the same frame as the end of inert reaches it as a region that
  // already holds the new text, which is never announced; the wait puts several frames between the two.
  const spoken = {
    status: timed
      ? timedStatus(round)
      : last
        ? [verdictText(last.correct, last.card.answer, newBest), roundStatus(round)].filter(Boolean).join(" ")
        : "",
    card: timed ? timedCardText(round) : "",
  };
  const [heldSpoken, setHeldSpoken] = useState<typeof spoken | null>(null);
  useEffect(() => {
    if (confirming) return;
    const timer = setTimeout(() => setHeldSpoken(null), SPOKEN_RELEASE_MS);
    return () => clearTimeout(timer);
  }, [confirming]);
  const said = heldSpoken ?? spoken;

  // The Timed clock: ticks and page visibility reach the round until time is up, the round is left or the
  // screen goes away. It keeps running while the "Leave round?" sheet is open.
  useClock(timed && !decided, dispatch, services);

  // The motion preference for the scroll calls below, read without making it a reason to run them again.
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  // A new card: start its settle time, scroll the ticket so the statement shows, put focus on the statement.
  // The ticket goes back to its top, or, where the stage is short (320 by 568, a phone held sideways, a zoomed
  // page), only as far up as lets the statement's text end above True and False, which hide what lies under
  // them; a text taller than the stage starts at its top. In Timed only the first card takes focus; later
  // ones are announced by the card announcer (a live region that stays mounted, see timedCardText), so focus
  // stays on the pill the player used. A player who answers by key or by swipe has focus on the first card's
  // statement, which leaves with that card: focus goes to the ticket (it stays mounted and is a stop in the
  // Tab order) rather than falling to the page for the rest of the minute. Timed glides back up from the
  // stamped stub (below) while the new card is dealt.
  useEffect(() => {
    if (round.phase !== "question") return;
    shownAt.current = monotonic();
    const scroller = scrollerRef.current;
    const statement = statementRef.current;
    if (scroller) {
      const first = statement?.firstElementChild;
      const last = statement?.lastElementChild;
      const top =
        first instanceof HTMLElement && last instanceof HTMLElement
          ? statementScroll(
              { top: spanInTicket(first, scroller).top, bottom: spanInTicket(last, scroller).bottom },
              visibleHeight(scroller),
            )
          : 0;
      scroller.scrollTo?.({ top, behavior: timed && !reducedRef.current ? "smooth" : "instant" });
    }
    if (!timed || round.index === 0) {
      statement?.focus({ preventScroll: true });
    } else {
      const focused = document.activeElement;
      if (!focused || focused === document.body || focused.closest("[data-statement]")) scroller?.focus({ preventScroll: true });
    }
  }, [round.cards, round.index, round.phase, monotonic, timed]);

  // Timed: when the stub is stamped (an answer, or time up), the ticket scrolls to its end, which is the stub.
  // On a short phone (320 by 568) the stub lies under the action row while the card is a question; this shows
  // the stamp and its hint above the row and leaves nothing of the ticket under the dimmed pills. Where the
  // ticket fits the stage there is nothing to scroll.
  const stubStamped = beat || timeUp;
  useEffect(() => {
    if (!stubStamped) return;
    const scroller = scrollerRef.current;
    scroller?.scrollTo?.({ top: scroller.scrollHeight, behavior: reducedRef.current ? "instant" : "smooth" });
  }, [stubStamped, round.index]);

  // The other modes: after an answer, when part of the slip lies under the action row (or above the stage),
  // the ticket scrolls to its end, which is the slip, so the answer, its stamp (New best, the deciding wrong
  // answer), the explanation and the source show above the row, which hides what lies under it. A slip taller
  // than the stage stops at its top, keeping the verdict row in view. A slip that already ends above the row,
  // in the gap over it at worst, leaves the ticket where it is: that is most cards at 390 by 844, even where
  // the ticket is a few pixels taller than the stage (see slipScroll).
  useEffect(() => {
    if (!answered || timed) return;
    const scroller = scrollerRef.current;
    const slip = scroller?.querySelector<HTMLElement>("[data-slip]");
    if (!scroller || !slip) return;
    const top = slipScroll(spanInTicket(slip, scroller), {
      top: scroller.scrollTop,
      visible: visibleHeight(scroller),
      gap: gapAboveRow(scroller),
      max: scroller.scrollHeight - scroller.clientHeight,
    });
    if (top === null) return;
    scroller.scrollTo?.({ top, behavior: reducedRef.current ? "instant" : "smooth" });
  }, [answered, timed, round.index]);

  // Time is up: note the moment (See results counts its arrival from it) and whether True or False had focus.
  useEffect(() => {
    if (!timeUp) return;
    timeUpAt.current = monotonic();
    focusedAtTimeUp.current = answerRowFocused.current;
  }, [timeUp, monotonic]);

  // The action row arrives 420 ms after the answer (or after time ran out) and starts to take taps. Focus
  // moves to it then, or at once with reduced motion (Enter on it still waits for the arrival, see next
  // below). At time up focus only moves if True or False had it.
  useEffect(() => {
    if (!awaitsNext) return;
    const index = round.index;
    const timer = setTimeout(() => setArrivedAt(index), NEXT_ARRIVES_MS);
    return () => clearTimeout(timer);
  }, [awaitsNext, round.index]);
  const nextArrived = awaitsNext && arrivedAt === round.index;
  const focusNext = awaitsNext && (reduced || nextArrived);
  useEffect(() => {
    if (!focusNext) return;
    if (timeUp && !focusedAtTimeUp.current) return;
    nextRef.current?.focus({ preventScroll: true });
  }, [focusNext, round.index, timeUp]);

  // Closing the dialog with "Keep playing" returns focus to the close button (once <main> is not inert).
  useEffect(() => {
    if (!confirming && restoreFocus.current) {
      restoreFocus.current = false;
      closeRef.current?.focus();
    }
  }, [confirming]);

  // The one answer path: swipe, buttons and keys all come here. Ignored outside the question phase,
  // while the dialog is open, and for 250 ms after a card appears (so a double tap on "Next card"
  // cannot answer the next card). The guards run on the monotonic clock; the answer keeps the wall clock's
  // time, which the card history stores.
  const answer = useCallback(
    (value: boolean) => {
      if (round.phase !== "question" || confirming) return;
      const at = monotonic();
      if (at - shownAt.current < SWIPE.settleMs) return;
      if (answeredAt.current?.index !== round.index) answeredAt.current = { index: round.index, at };
      dispatch({ type: "answer", value, at: now() });
    },
    [round.phase, round.index, confirming, now, monotonic, dispatch],
  );

  // The action (the button and Enter) is ignored until it has arrived, timed on the same clock as the answer
  // (or as the moment time ran out).
  const next = useCallback(() => {
    const since = answered ? (answeredAt.current?.at ?? null) : timeUp ? timeUpAt.current : null;
    if (since === null || monotonic() - since < NEXT_ARRIVES_MS) return;
    dispatch({ type: "next" });
  }, [answered, timeUp, monotonic, dispatch]);

  // A held key: the system repeats its keydown, and a repeat is not a new press. It is cancelled before
  // anything sees it (capture on window), so it neither answers a card nor presses the focused True, False or
  // Next card (the browser presses a focused button on Enter unless the keydown is cancelled), nor closes the
  // leave sheet that its first Escape opened. One press, one answer or one action.
  useEffect(() => {
    const onRepeat = (event: KeyboardEvent) => {
      if (!event.repeat || !HELD_KEYS.has(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onRepeat, { capture: true });
    return () => window.removeEventListener("keydown", onRepeat, { capture: true });
  }, []);

  // The close control (and Escape): before the first answer it leaves at once, after it it asks once.
  const requestLeave = () => {
    if (round.answers.length === 0) onLeave();
    else {
      // A sheet opened again before the regions were released keeps what they last said, not what is new.
      setHeldSpoken(said);
      setConfirming(true);
    }
  };
  const requestLeaveRef = useRef(requestLeave);
  useLayoutEffect(() => {
    requestLeaveRef.current = requestLeave;
  });

  // Keyboard: left arrow answers False, right arrow True; Enter is the action after an answer
  // (unless focus is on a link or a button, which handle Enter themselves); Escape is the close control
  // (design system 8). While the sheet is open it handles Escape itself.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || confirming || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        requestLeaveRef.current();
      } else if (round.phase === "question" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        answer(event.key === "ArrowRight");
      } else if (awaitsNext && event.key === "Enter") {
        const target = event.target;
        if (target instanceof Element && target.closest("a, button, input, select, textarea")) return;
        event.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [round.phase, awaitsNext, confirming, answer, next]);

  // The ticket by keyboard, in every mode: wherever focus is on the screen (the ticket itself, a stop in the
  // Tab order; the statement; the page itself, as in Timed from the second card on; a pill or the close
  // button) the keys that scroll a page scroll the ticket: the arrows, Page Up and Down, Home and End, and
  // Space unless a focused control takes it. Done here rather than left to the browser, which scrolls a
  // focused scroller in Chromium and Firefox but not in Safari, and scrolls nothing from the page or a pill.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || confirming || event.altKey || event.ctrlKey || event.metaKey) return;
      const scroller = scrollerRef.current;
      const target = event.target;
      if (!scroller) return;
      if (event.key === " " && target instanceof Element && target.closest("a, button, input, select, textarea")) return;
      const top = keyScroll(event.key, event.shiftKey, {
        top: scroller.scrollTop,
        visible: visibleHeight(scroller),
        max: scroller.scrollHeight - scroller.clientHeight,
      });
      if (top === null) return;
      event.preventDefault();
      scroller.scrollTo?.({ top, behavior: "instant" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirming]);

  const swipe = useSwipe<HTMLDivElement>({
    enabled: round.phase === "question" && !confirming,
    cardShownAt: () => shownAt.current,
    now: monotonic,
    onSwipe: answer,
  });

  if (!card) return null;

  const tear: TearSide = last?.correct === false ? "right" : "left";
  // Timed: the answered card leaves towards the side that was answered.
  const side: CardSide = lastAnswer(round)?.given ? "right" : "left";
  const correctCount = round.answers.filter((a) => a.correct).length;
  const cardNumber = pad2(round.index + 1);
  // Only Classic has a fixed length; the other modes show the card number alone.
  const cardField = round.mode === "classic" ? `${cardNumber} / ${pad2(total)}` : cardNumber;
  // The card can be dragged (and is being stamped) in these phases; in the answered phase the explanation can be selected.
  const dragging = round.phase === "question" || round.phase === "stamped";
  const routeLine = `${ticket.deckCode} → ${ticket.sectionCode} · ${ticket.modeLabel}`;
  // Timed keeps the stub of the card under its stamp; the other modes tear it off for the slip.
  const showStub = round.phase === "question" || timed;
  const stubStamp = timeUp ? (
    <StubStamp kind="time-up" />
  ) : stamped ? (
    <StubStamp kind={stamped.correct ? "correct" : "wrong"} />
  ) : undefined;
  const stubHint = timeUp
    ? `This card doesn't count · ${round.answers.length} answered`
    : stamped
      ? stamped.correct
        ? "Next card coming up"
        : "Wrong, saved for review at the end"
      : undefined;

  return (
    <>
      <main className="flex min-h-0 flex-1 flex-col" inert={confirming}>
        <SkyBackdrop />
        {/* The page's heading, for those who move by headings: the route and the class, as on the ticket. */}
        <h1 className="sr-only">{`${ticket.deckName}, ${ticket.sectionName}: ${ticket.modeLabel} round`}</h1>
        <Header onLeave={requestLeave} closeRef={closeRef}>
          {round.mode === "streak" ? (
            <StreakPath streak={streak} best={ticket.best} answered={last ? (last.correct ? "correct" : "wrong") : null} />
          ) : round.mode === "lives" ? (
            <LivesPath results={round.answers.map((a) => a.correct)} answered={answered} />
          ) : timed ? (
            <TimedPath
              remainingMs={round.clock?.remainingMs ?? TIMED.roundMs}
              correct={correctCount}
              wrong={round.answers.length - correctCount}
            />
          ) : (
            <FlightPath
              total={total}
              results={round.answers.map((a) => a.correct)}
              current={round.index}
              answered={answered}
            />
          )}
        </Header>
        <section aria-label="Card" className="relative mt-(--space-12) -mx-(--size-gutter) min-h-0 flex-1">
          <div
            ref={scrollerRef}
            role="group"
            aria-label="Ticket"
            tabIndex={0}
            className={`absolute inset-x-0 top-0 ${SCROLLER_ENDS} overflow-x-hidden overflow-y-auto overscroll-contain px-(--size-gutter) focus-visible:outline-offset-[-2px]`}
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
                `group relative touch-pan-y touch-pinch-zoom ${dragging ? "select-none" : "select-text"}`,
                "transition-transform duration-(--duration-t3) ease-(--easing-spring) data-dragging:transition-none",
                round.phase === "question" ? "cursor-grab data-dragging:cursor-grabbing" : "cursor-default",
              ].join(" ")}
              style={CARD_TRANSFORM}
            >
              {/* One column that may shrink below its content: a long word in the statement wraps inside its
                  paragraph instead of widening the pass beyond the card. */}
              <div className="grid grid-cols-[minmax(0,1fr)]">
                <AnimatePresence initial={false} custom={side}>
                  <CardSlot key={timed ? `card-${round.index}` : "card"} animated={timed && !reduced}>
                    <BoardingPass
                      from={{ code: ticket.deckCode, name: ticket.deckName }}
                      to={{ code: ticket.sectionCode, name: ticket.sectionName }}
                      fields={[
                        { label: "Class", value: ticket.modeLabel },
                        { label: "Card", value: cardField },
                        { label: "Gate", value: <GateValue closed={timeUp} /> },
                      ]}
                      jolt={answered || beat || timeUp}
                      joltDelay={timeUp ? 0.24 : beat ? 0.12 : undefined}
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
                              newBest={newBest}
                            />
                          ) : null}
                          <AnimatePresence initial={false} custom={tear}>
                            {showStub ? (
                              <PassStub
                                key={`stub-${round.index}`}
                                className="[grid-area:1/1]"
                                routeLine={routeLine}
                                cardLabel={`Card ${cardNumber}`}
                                barcode={card.id}
                                stamp={stubStamp}
                                hint={stubHint}
                              />
                            ) : null}
                          </AnimatePresence>
                        </div>
                      }
                    >
                      <PassStatement ref={attachStatement} appliesTo={card.appliesTo} muted={timeUp}>
                        <CardText text={card.text.en.statement} />
                      </PassStatement>
                    </BoardingPass>
                  </CardSlot>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>
        <div className="relative z-10 mt-(--space-12) h-(--size-actions) flex-none">
          <AnimatePresence initial={false}>
            {!awaitsNext ? (
              <motion.div
                key="answer"
                className="absolute inset-0"
                onFocus={() => {
                  answerRowFocused.current = true;
                }}
                onBlur={() => {
                  answerRowFocused.current = false;
                }}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                <AnswerButtons onAnswer={answer} disabled={beat} />
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
          {said.status}
        </p>
        {/* Timed: each card is a new element (the swap keys it), and a live region that arrives with its text
            is not reliably read, so new cards are announced from here, outside the card. */}
        {timed ? (
          <p data-card-announcer="" aria-live="polite" aria-atomic="true" className="sr-only">
            {said.card}
          </p>
        ) : null}
      </main>
      <LeaveDialog
        open={confirming}
        decided={decided}
        now={monotonic}
        onStay={() => {
          restoreFocus.current = true;
          setConfirming(false);
        }}
        onLeave={onLeave}
      />
    </>
  );
}
