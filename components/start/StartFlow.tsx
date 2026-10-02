"use client";

// The start flow, "filling in the pass" (spec section 9, screen 1; design/flow/screens/start.html).
// One screen that steps through six states: 1 area, 2 platform, 3 deck, 4 section, 5 class, 6 ready.
// Each choice is written onto the fill-in pass; Back, a filled field of the pass and the browser's back
// button all step back and clear the later choices. "Start round" hands the route and class to /play.
//
// Where things live:
//   - the step and the choices: `view` state, mirrored into the browser history (one entry per step on
//     the path, the URL never changes), so the browser's back and forward buttons move through the steps;
//     "Start round" takes those entries out again before it opens /play (back from /play is step 1);
//   - the index and the progress: useCatalog;
//   - the settle time: for 250 ms after a step becomes current, presses on its options, the continue
//     line and Start round are ignored (the next step's cards appear where the chosen card was);
//   - the motion: AnimatePresence per zone (top, main, foot), plus one "ghost" copy of the chosen name
//     that travels into its field of the pass. Reduced motion swaps all of it for a cross-fade.
import { AnimatePresence, motion, useIsPresent, useReducedMotion, type Transition, type Variants } from "motion/react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DestinationCard } from "@/components/DestinationCard";
import { FillInPass, type FillInPassValues, type PassFieldName, type PassStage } from "@/components/FillInPass";
import { Logo } from "@/components/Logo";
import { PillButton } from "@/components/PillButton";
import { SkyBackdrop } from "@/components/SkyBackdrop";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { EASE, EASE_OUT } from "@/components/easing";
import { BackArrowIcon } from "@/components/icons";
import { MODE_TABLE, lastScoreText, modeInfo, type ModeInfo } from "@/src/app-state/modes";
import { savePending } from "@/src/app-state/pending";
import {
  browserAppServices,
  browserStepHistory,
  markStartEntryBehind,
  takeReturnFromPlay,
  type AppServices,
  type StepHistory,
} from "@/src/app-state/services";
import type { Mode } from "@/src/content/play";
import { WHOLE_DECK, deckPassName, type DeckIndex, type IndexArea, type IndexDeck, type IndexPlatform } from "@/src/content/schema";
import { SWIPE } from "@/src/input/swipe";
import { bestFor } from "@/src/progress/progress";
import { ContinueLine } from "./ContinueLine";
import { useListCue } from "./listCue";
import { continueTarget, deckCount, decksLabel, seenPercent, useCatalog } from "./useCatalog";

// ---------- services ----------

export interface StartServices extends AppServices {
  /** The browser history the flow keeps its steps in. Undefined: steps are not remembered (server, tests). */
  history: () => StepHistory | undefined;
  /** A clock in ms for the settle time. In the browser: performance.now. */
  now: () => number;
  /** Whether the player has just come back from /play by one of its controls (read once). Left out: never. */
  returnedFromPlay?: () => boolean;
}

export const browserStartServices: StartServices = {
  ...browserAppServices,
  history: browserStepHistory,
  now: () => performance.now(),
  returnedFromPlay: takeReturnFromPlay,
};

// ---------- the steps and the choices (pure) ----------

export type Step = 1 | 2 | 3 | 4 | 5 | 6;

/** What the player has chosen so far, as ids. sectionId is a section id or WHOLE_DECK. */
export interface Choice {
  areaId?: string;
  platformId?: string;
  deckId?: string;
  sectionId?: string;
  mode?: Mode;
}

type ChoiceKey = keyof Choice;
const CHOICE_KEYS: readonly ChoiceKey[] = ["areaId", "platformId", "deckId", "sectionId", "mode"];

/** The step on which each choice is made. */
export const STEP_OF: Record<ChoiceKey, Step> = { areaId: 1, platformId: 2, deckId: 3, sectionId: 4, mode: 5 };

const STEP_OF_FIELD: Record<PassFieldName, Step> = { area: 1, platform: 2, deck: 3, section: 4, mode: 5 };

/** Keeps only the choices made before `step`: going back to a step clears it and everything after it. */
export function clearFrom(choice: Choice, step: Step): Choice {
  const kept: Choice = {};
  for (const key of CHOICE_KEYS) {
    if (STEP_OF[key] < step && choice[key] !== undefined) Object.assign(kept, { [key]: choice[key] });
  }
  return kept;
}

/** The steps a player passes through up to `step`. A deck without sections has no step 4. */
export function pathTo(step: Step, hasSections: boolean): Step[] {
  const all: Step[] = hasSections ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 5, 6];
  return all.filter((s) => s <= step);
}

/** Where Back goes from `step`: one step back, and from the class step of a deck without sections to the deck step. */
export function previousStep(step: Step, hasSections: boolean): Step {
  const path = pathTo(step, hasSections);
  return path[path.length - 2] ?? 1;
}

function sameChoice(a: Choice, b: Choice): boolean {
  return CHOICE_KEYS.every((key) => a[key] === b[key]);
}

/** A section as the flow shows it; the whole deck is one too. */
interface SectionView {
  id: string;
  title: string;
  cardCount: number;
  whole: boolean;
}

function wholeDeck(deck: IndexDeck): SectionView {
  return { id: WHOLE_DECK, title: "Whole deck", cardCount: deck.cardCount, whole: true };
}

/** The choices looked up in the index. A missing entry means it was not chosen or no longer exists. */
interface Resolved {
  area?: IndexArea;
  platform?: IndexPlatform;
  deck?: IndexDeck;
  section?: SectionView;
  mode?: ModeInfo;
}

function resolve(index: DeckIndex, choice: Choice): Resolved {
  const area = index.areas.find((a) => a.id === choice.areaId);
  const platform = area?.platforms.find((p) => p.id === choice.platformId);
  const deck = platform?.decks.find((d) => d.id === choice.deckId);
  let section: SectionView | undefined;
  if (deck && choice.sectionId === WHOLE_DECK) section = wholeDeck(deck);
  else if (deck) {
    const found = deck.sections.find((s) => s.id === choice.sectionId);
    if (found) section = { id: found.id, title: found.title, cardCount: found.cardCount, whole: false };
  }
  const mode = MODE_TABLE.find((m) => m.id === choice.mode && m.offered);
  return { area, platform, deck, section, mode };
}

/** True when every choice needed to show `step` exists in the index (a stale history entry may not). */
export function canShow(index: DeckIndex, step: Step, choice: Choice): boolean {
  const r = resolve(index, choice);
  if (step >= 2 && !r.area) return false;
  if (step >= 3 && !r.platform) return false;
  if (step >= 4 && !r.deck) return false;
  if (step === 4 && r.deck && r.deck.sections.length === 0) return false;
  if (step >= 5 && !r.section) return false;
  if (step >= 6 && !r.mode) return false;
  return true;
}

// ---------- history entries ----------

interface Entry {
  step: Step;
  choice: Choice;
}

const HISTORY_KEY = "truthyStart";

function entryState(entry: Entry): Record<string, unknown> {
  return { [HISTORY_KEY]: entry };
}

function readEntry(state: unknown): Entry | null {
  if (typeof state !== "object" || state === null || !(HISTORY_KEY in state)) return null;
  const value = (state as Record<string, unknown>)[HISTORY_KEY];
  if (typeof value !== "object" || value === null) return null;
  const { step, choice } = value as { step?: unknown; choice?: unknown };
  if (typeof step !== "number" || ![1, 2, 3, 4, 5, 6].includes(step) || typeof choice !== "object" || choice === null) return null;
  const picked: Choice = {};
  for (const key of CHOICE_KEYS) {
    const v = (choice as Record<string, unknown>)[key];
    if (typeof v === "string") Object.assign(picked, { [key]: v });
  }
  return { step: step as Step, choice: picked };
}

// ---------- motion ----------

type Direction = 1 | -1;

/** A step's panel: on its way out it rises (forward) or sinks (back) 10px and fades. */
const PANEL: Variants = {
  hidden: { opacity: 1 },
  shown: { opacity: 1, y: 0, transition: { delayChildren: 0.11, staggerChildren: 0.025 } },
  gone: (dir: Direction) => ({ opacity: 0, y: -10 * dir, transition: { duration: 0.14, ease: EASE_OUT } }),
};
/** The items of a step (title, cards): they rise from 24px below (forward) or drop from 24px above (back). */
const ITEM: Variants = {
  hidden: (dir: Direction) => ({ opacity: 0, y: 24 * dir }),
  shown: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE } },
};
/** Reduced motion: the old step fades out, then the new one fades in. Text never overlaps. */
const PANEL_REDUCED: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.14, delay: 0.09 } },
  gone: { opacity: 0, transition: { duration: 0.1 } },
};

/** A zone that swaps its content (the top and the foot): out 110ms, in 240ms after 120ms, 12px of travel. */
function swapMotion(reduced: boolean, rise: number) {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.14, delay: 0.09 } },
      exit: { opacity: 0, transition: { duration: 0.1 } },
    };
  }
  return {
    initial: { opacity: 0, y: rise },
    animate: { opacity: 1, y: 0, transition: { duration: 0.24, delay: 0.12, ease: EASE } },
    exit: { opacity: 0, y: rise, transition: { duration: 0.11, ease: EASE } },
  };
}

const TRAVEL: Transition = { duration: 0.3, delay: 0.06, ease: EASE };

// The theme switch sits at the top right of the header, centred on the row beside it: the Back pill row
// (48 tall, at the top) from step 2 on, and on step 1 the logo row, 36 down (pt-9) and 40 tall, so the
// 48 px button's top is 36 + 20 - 24 = 32 down. e2e/theme.spec.ts checks both centres line up.
const SWITCH_OFFSET_LOGO_ROW = 32;

/** Where a name is and how it looks, relative to the app frame. */
interface Look {
  text: string;
  left: number;
  top: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  style: CSSProperties;
}

interface Travel {
  field: PassFieldName;
  from: Look;
  to?: { left: number; top: number; height: number; fontSize: number };
}

/** The layout box of `el` relative to `frame`, ignoring transforms (the pass may still be sliding in). */
function layoutBox(el: HTMLElement, frame: Element): { left: number; top: number; width: number; height: number } | null {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== frame) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return node === frame ? { left, top, width: el.offsetWidth, height: el.offsetHeight } : null;
}

/** Room left around a card brought into view, for its focus ring (the list's own padding is 8). */
const FOCUS_ROOM = 8;

/**
 * On a short screen, where the start column scrolls (globals.css, "short"), scrolls `main` just enough to show
 * `card` whole with its focus ring. The card is measured where it comes to rest, without its rise-in transform.
 * Elsewhere `main` does not scroll and this does nothing.
 */
function showInColumn(main: HTMLElement, card: HTMLElement) {
  const overflow = getComputedStyle(main).overflowY;
  if (overflow !== "auto" && overflow !== "scroll") return;
  const option = card.closest<HTMLElement>("[data-option]");
  const transform = option ? getComputedStyle(option).transform : "none";
  const shift = transform && transform !== "none" ? new DOMMatrixReadOnly(transform).m42 : 0;
  const area = main.getBoundingClientRect();
  const box = card.getBoundingClientRect();
  const top = box.top - shift - area.top - FOCUS_ROOM;
  const bottom = box.bottom - shift - area.top + FOCUS_ROOM;
  if (bottom > main.clientHeight) main.scrollTop += Math.min(bottom - main.clientHeight, top);
  else if (top < 0) main.scrollTop += top;
}

function lookOf(el: HTMLElement, frame: Element): Look {
  const box = el.getBoundingClientRect();
  const origin = frame.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    text: el.textContent ?? "",
    left: box.left - origin.left,
    top: box.top - origin.top,
    height: box.height,
    fontSize: parseFloat(cs.fontSize) || 1,
    fontFamily: cs.fontFamily,
    style: { fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, letterSpacing: cs.letterSpacing, color: cs.color },
  };
}

// ---------- copy ----------

const STEP_TITLE: Record<Step, string> = {
  1: "Choose an area",
  2: "Choose a platform",
  3: "Choose a deck",
  4: "Choose a section",
  5: "Choose how to play",
  6: "Your pass is ready",
};
const BACK_TO: Record<Step, string> = { 1: "areas", 2: "platforms", 3: "decks", 4: "sections", 5: "classes", 6: "classes" };
const NOW_FIELD: Partial<Record<Step, PassFieldName>> = { 2: "platform", 3: "deck", 4: "section", 5: "mode" };

function stageOf(step: Step): PassStage {
  if (step <= 3) return "destination";
  return step <= 5 ? "route" : "ready";
}

const TEXT_ROLE = {
  title:
    "m-0 flex h-[36px] flex-none items-center font-(family-name:--type-step-title-family) text-(length:--type-step-title-size) " +
    "font-(--type-step-title-weight) tracking-(--type-step-title-letter-spacing) text-(--color-ink) outline-none",
  tagline:
    "m-0 font-(family-name:--type-tagline-family) text-(length:--type-tagline-size) font-(--type-tagline-weight) " +
    "leading-(--type-tagline-line-height) text-(--color-ink)",
};

// ---------- the component ----------

export interface StartFlowProps {
  /** The outside world. Defaults to the browser. Pass a stable object. */
  services?: StartServices;
}

interface View extends Entry {
  dir: Direction;
  /** Going back: the option to focus (the one chosen before). Otherwise the step title takes focus. */
  focusId?: string;
  /** Counts step changes; 0 is the first render, which moves no focus. */
  seq: number;
}

export function StartFlow({ services = browserStartServices }: StartFlowProps) {
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;
  const { status, retry } = useCatalog(services);
  const [view, setView] = useState<View>({ step: 1, choice: {}, dir: 1, seq: 0 });
  const [travel, setTravel] = useState<Travel | null>(null);
  const [boarding, setBoarding] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const index = status.kind === "ready" ? status.index : null;
  const progress = status.kind === "ready" ? status.progress : null;
  const r = index ? resolve(index, view.choice) : {};
  const hasSections = (r.deck?.sections.length ?? 1) > 0;

  // The latest values for the history listener, which is subscribed once.
  const latest = useRef({ index, view, boarding });
  useLayoutEffect(() => {
    latest.current = { index, view, boarding };
  });

  // History: a reload starts at step 1 (the current entry is overwritten); back and forward restore an entry.
  useEffect(() => {
    const history = services.history();
    if (!history) return;
    history.replace(entryState({ step: 1, choice: {} }));
    return history.listen((state) => {
      const entry = readEntry(state);
      const { index: currentIndex, view: current, boarding: leaving } = latest.current;
      if (!entry || !currentIndex || leaving) return;
      if (entry.step === current.step && sameChoice(entry.choice, current.choice)) return; // our own go()
      if (!canShow(currentIndex, entry.step, entry.choice)) {
        history.replace(entryState({ step: 1, choice: {} }));
        setView((v) => ({ step: 1, choice: {}, dir: -1, seq: v.seq + 1 }));
        return;
      }
      const dir: Direction = entry.step > current.step ? 1 : -1;
      const focusKey = CHOICE_KEYS.find((key) => STEP_OF[key] === entry.step);
      setTravel(null);
      setView((v) => ({ ...entry, dir, focusId: dir < 0 && focusKey ? current.choice[focusKey] : undefined, seq: v.seq + 1 }));
    });
  }, [services]);

  // The settle time, as on the play screen (spec section 8): a step change starts it, and so do step 1's
  // options when they first appear (the index is loaded). Arriving from /play, the continue line appears
  // where the button just pressed was, so the second tap of a double tap must not take it.
  const shownAt = useRef(Number.NEGATIVE_INFINITY);
  const optionsShown = status.kind === "ready";
  useLayoutEffect(() => {
    if (view.seq > 0 || optionsShown) shownAt.current = services.now();
  }, [view.seq, optionsShown, services]);

  // On a short screen the start screen scrolls as one column (globals.css, "short"): a step that arrives starts
  // at its top, with the pass and the new title in view. Elsewhere the screen does not scroll and this does nothing.
  // When the column did move, the Back pill and the pass now lie where the finger just was, so for the settle
  // time a press on them is held back (a double tap must not take a way back the player has not seen).
  const headerHeldUntil = useRef(Number.NEGATIVE_INFINITY);
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (view.seq === 0 || !main) return;
    if (main.scrollTop > 0) headerHeldUntil.current = services.now() + SWIPE.settleMs;
    main.scrollTop = 0;
  }, [view.seq, services]);
  const settled = () => services.now() - shownAt.current >= SWIPE.settleMs;
  const headerHeld = () => services.now() < headerHeldUntil.current;

  // The last kind of input: a key, or a press (finger, pen or mouse). It decides below whether going back may
  // scroll the column.
  const lastInput = useRef<"key" | "press">("press");
  useEffect(() => {
    const onKey = () => {
      lastInput.current = "key";
    };
    const onPress = () => {
      lastInput.current = "press";
    };
    const presses = ["pointerdown", "mousedown", "touchstart"] as const;
    document.addEventListener("keydown", onKey, true);
    for (const type of presses) document.addEventListener(type, onPress, { capture: true, passive: true });
    return () => {
      document.removeEventListener("keydown", onKey, true);
      for (const type of presses) document.removeEventListener(type, onPress, { capture: true });
    };
  }, []);

  // Focus: the new step's title, or (going back) the card chosen before. On a short screen, a way back from the
  // keyboard also brings that card into view, where its focus ring is. A way back by a press does not: the column
  // stays at its top, so the Back pill and the pass stay under the finger and a second tap cannot land on a card.
  // The first render moves no focus on a fresh page load; coming back from /play, the step 1 title takes it, so
  // the control the player pressed there does not leave the focus on the body.
  useEffect(() => {
    if (view.seq === 0) {
      if (services.returnedFromPlay?.()) mainRef.current?.querySelector<HTMLElement>('[data-step="1"] h2')?.focus({ preventScroll: true });
      return;
    }
    const panel = mainRef.current?.querySelector(`[data-step="${view.step}"]`);
    const card = view.focusId ? panel?.querySelector<HTMLElement>(`[data-option="${CSS.escape(view.focusId)}"] button`) : null;
    (card ?? panel?.querySelector<HTMLElement>("h2"))?.focus({ preventScroll: true });
    if (card && mainRef.current && lastInput.current === "key") showInColumn(mainRef.current, card);
  }, [view, services]);

  /** Moves forward to `step` with `choice`; `source` is the card whose name travels into the pass. */
  function forward(step: Step, choice: Choice, field: PassFieldName, source?: HTMLElement | null) {
    if (!settled()) return;
    const name = source?.querySelector<HTMLElement>("[data-card-name]");
    const frame = layerRef.current?.offsetParent;
    if (!reduced && name && frame) {
      setTravel({ field, from: lookOf(name, frame) });
      name.style.visibility = "hidden"; // the card is leaving; its name is now the travelling copy
    } else {
      setTravel(null);
    }
    setView((v) => ({ step, choice, dir: 1, seq: v.seq + 1 }));
    services.history()?.push(entryState({ step, choice }));
  }

  /** A press on the Back pill or a field of the pass: held back only right after the column jumped (see above). */
  function tapBackTo(target: Step) {
    if (!headerHeld()) backTo(target);
  }

  /** Goes back to an earlier step, clearing it and every later choice. Never held back by the settle time. */
  function backTo(target: Step) {
    const from = view.step;
    if (target >= from || boarding) return;
    const focusKey = CHOICE_KEYS.find((key) => STEP_OF[key] === target);
    setTravel(null);
    setView((v) => ({
      step: target,
      choice: clearFrom(v.choice, target),
      dir: -1,
      focusId: focusKey ? v.choice[focusKey] : undefined,
      seq: v.seq + 1,
    }));
    // Keep the browser history in step: drop the entries of the steps left behind.
    const distance = pathTo(from, hasSections).length - pathTo(target, hasSections).length;
    if (distance > 0) services.history()?.go(-distance);
  }

  const back = () => backTo(previousStep(view.step, hasSections));
  const backRef = useRef(back);
  useLayoutEffect(() => {
    backRef.current = back;
  });

  // Escape goes back a step, like the Back pill.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") backRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function continueLast() {
    if (!index || !progress || !settled()) return;
    const target = continueTarget(index, progress);
    if (!target) return;
    const choice: Choice = {
      areaId: target.found.area.id,
      platformId: target.found.platform.id,
      deckId: target.found.deck.id,
      sectionId: target.route.sectionId,
      mode: target.mode,
    };
    setTravel(null);
    setView((v) => ({ step: 6, choice, dir: 1, seq: v.seq + 1 }));
    // One history entry per step on the way, so Back and the browser's back button retrace them.
    const history = services.history();
    for (const step of pathTo(6, target.found.deck.sections.length > 0).slice(1)) {
      history?.push(entryState({ step, choice: clearFrom(choice, step) }));
    }
  }

  // Boarding: /play opens once the pass has unrolled (at once with reduced motion) and the browser is back
  // on the flow's first entry. The step entries are spent once a round starts, so /play replaces them:
  // back from /play is the start at step 1, and one more back leaves the site.
  const boardingRef = useRef({ rewound: false, unrolled: false, opened: false, onFirstEntry: false });
  const openPlay = useCallback(() => {
    const state = boardingRef.current;
    if (!state.rewound || !state.unrolled || state.opened) return;
    state.opened = true;
    markStartEntryBehind(state.onFirstEntry);
    router.push("/play");
  }, [router]);

  function startRound() {
    const { deckId, sectionId, mode } = view.choice;
    if (boarding || !deckId || !sectionId || !mode || !settled()) return;
    savePending({ route: { deckId, sectionId }, mode }, services.sessionStorage());
    latest.current = { ...latest.current, boarding: true }; // the move back below is ours, not the player's
    setBoarding(true);
    // On a short screen Start round sits at the foot of the scrolled column: back to its top, so the pass unrolls in view.
    const main = mainRef.current;
    if (main && main.scrollTop > 0) main.scrollTo?.({ top: 0, behavior: reduced ? "auto" : "smooth" });
    const history = services.history();
    const distance = pathTo(view.step, hasSections).length - 1;
    const state = { rewound: !history || distance <= 0, unrolled: reduced, opened: false, onFirstEntry: Boolean(history) && distance <= 0 };
    boardingRef.current = state;
    if (history && !state.rewound) {
      const arrived = (moved: boolean) => {
        stop();
        clearTimeout(timer);
        state.rewound = true;
        state.onFirstEntry = moved;
        openPlay();
      };
      const stop = history.listen(() => arrived(true));
      // A browser that never reports the move must not keep the player on the pass.
      const timer = setTimeout(() => arrived(false), 1000);
      history.go(-distance);
    }
    openPlay();
  }

  const onUnrolled = useCallback(() => {
    boardingRef.current.unrolled = true;
    openPlay();
  }, [openPlay]);

  // The travelling name: once the pass shows its field, measure where the copy has to land.
  useLayoutEffect(() => {
    if (!travel || travel.to) return;
    const frame = layerRef.current?.offsetParent;
    const target = mainRef.current?.querySelector<HTMLElement>(`[data-trip] [data-pass-value="${travel.field}"]`);
    const box = target && frame ? layoutBox(target, frame) : null;
    // Only a name that keeps its typeface travels; the class becomes Mono on the ready pass and fades in with it.
    if (!target || !box || getComputedStyle(target).fontFamily !== travel.from.fontFamily) {
      setTravel(null);
      return;
    }
    setTravel({ ...travel, to: { left: box.left, top: box.top, height: box.height, fontSize: parseFloat(getComputedStyle(target).fontSize) || 1 } });
  }, [travel]);

  const step = view.step;
  const returning = step === 1 && index && progress ? continueTarget(index, progress) : null;
  const passValues: FillInPassValues = {
    area: r.area?.title,
    platform: r.platform?.title,
    deck: r.deck && r.platform ? { code: r.deck.code, name: deckPassName(r.platform, r.deck) } : undefined,
    section: r.section ? { code: r.section.id, name: r.section.title, whole: r.section.whole } : undefined,
    mode: r.mode?.name,
    cards: r.section?.cardCount,
  };

  return (
    <main
      ref={mainRef}
      className={[
        "flex min-h-0 flex-1 flex-col",
        // Short screens: the column scrolls, over the whole frame (its padding moves inside, so the top 52 and
        // bottom 34 scroll with the content and every position stays the same at the top of the column).
        "short:-mx-(--size-gutter) short:-mt-(--size-safe-top) short:-mb-(--size-safe-bottom) short:overflow-y-auto",
        "short:px-(--size-gutter) short:pt-(--size-safe-top) short:pb-(--size-safe-bottom)",
      ].join(" ")}
      inert={boarding}
    >
      <SkyBackdrop lowerCloud="start" />

      {/* Top zone, 176 tall: the logo on step 1, the Back pill and the pass from step 2 on (same place),
          and the theme switch at the top right on every step. On a short screen it is as tall as what it holds. */}
      <header className="relative z-[7] grid h-(--size-start-top-zone) flex-none short:h-auto">
        <AnimatePresence initial={false}>
          {step === 1 ? (
            <motion.div key="brand" className="[grid-area:1/1] pt-9" {...swapMotion(reduced, -12)}>
              <Logo as="h1" />
              <p className={`${TEXT_ROLE.tagline} mt-(--space-14) max-w-[300px]`}>True or false cards that teach you IT, one swipe at a time.</p>
            </motion.div>
          ) : (
            <motion.div key="trip" data-trip="" className="flex flex-col gap-(--space-12) self-start [grid-area:1/1]" {...swapMotion(reduced, 12)}>
              {/* Boarding: the Back pill fades out; on /play the Leave round button takes its place. */}
              <motion.button
                type="button"
                aria-label={`Back to ${BACK_TO[previousStep(step, hasSections)]}`}
                onClick={() => tapBackTo(previousStep(step, hasSections))}
                animate={{ opacity: boarding ? 0 : 1 }}
                transition={{ duration: 0.11 }}
                className={[
                  "flex h-(--size-pill-small) cursor-pointer items-center gap-(--space-8) self-start rounded-(--radius-pill-small) bg-(--color-surface-raised) pr-(--space-20) pl-(--space-14)",
                  "text-(--color-ink) shadow-(--elevation-small) transition-transform duration-(--duration-t1) ease-(--easing-ease) active:scale-[0.96]",
                  "font-(family-name:--type-button-back-family) text-(length:--type-button-back-size) font-(--type-button-back-weight) leading-(--type-button-back-line-height) tracking-(--type-button-back-letter-spacing)",
                ].join(" ")}
              >
                <BackArrowIcon variant="pill" />
                Back
              </motion.button>
              <FillInPass
                stage={stageOf(step)}
                values={passValues}
                now={NOW_FIELD[step]}
                sectionChoosable={hasSections}
                onJump={(field) => tapBackTo(STEP_OF_FIELD[field])}
                travelling={travel?.field}
                unroll={boarding && !reduced}
                onUnrolled={onUnrolled}
                className={step === 6 ? "mt-(--space-8)" : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {/* The theme switch, on every step. It moves (a transform) between the logo row and the Back pill
            row, and fades out with the Back pill when the round starts. */}
        <motion.div
          className="absolute top-0 right-0"
          initial={false}
          animate={{ y: step === 1 ? SWITCH_OFFSET_LOGO_ROW : 0, opacity: boarding ? 0 : 1 }}
          transition={reduced ? { duration: 0 } : { y: { duration: 0.24, ease: EASE }, opacity: { duration: 0.11 } }}
        >
          <ThemeSwitch storage={services.localStorage} />
        </motion.div>
      </header>

      {/* Main area: the title of the step and its options, one step at a time in the same place. */}
      <section className={`mt-(--space-20) grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] short:flex-none ${returning ? "mb-(--size-foot-gap) short:mb-0" : ""}`}>
        <AnimatePresence initial={false} custom={view.dir}>
          <StepPanel key={step} step={step} dir={view.dir} reduced={reduced}>
            {renderOptions()}
          </StepPanel>
        </AnimatePresence>
      </section>

      {/* Foot zone: where a game's action row sits. The continue line on step 1, Start round on step 6. It lies
          over the bottom of the step's list and is empty on most steps, so only what it holds takes a tap. On a
          short screen it follows the list in the column, and takes no room while it is empty. */}
      <div className="pointer-events-none absolute right-(--size-gutter) bottom-[calc(var(--size-safe-bottom)+var(--space-4))] left-(--size-gutter) z-[6] grid h-(--size-pill) grid-cols-[minmax(0,1fr)] short:static short:mb-(--space-4) short:empty:hidden">
        <AnimatePresence initial={false}>
          {returning ? (
            <motion.div key="continue" className="pointer-events-auto [grid-area:1/1]" {...swapMotion(reduced, 12)}>
              <ContinueLine
                deckCode={returning.found.deck.code}
                deckTitle={returning.found.deck.title}
                sectionCode={returning.found.section?.id ?? WHOLE_DECK}
                sectionTitle={returning.found.section?.title ?? "Whole deck"}
                modeLabel={modeInfo(returning.mode).name}
                lastScore={returning.lastScore ? lastScoreText(returning.mode, returning.lastScore.score, returning.lastScore.total) : undefined}
                onContinue={continueLast}
              />
            </motion.div>
          ) : null}
          {step === 6 && !boarding ? (
            <motion.div key="start" className="pointer-events-auto [grid-area:1/1]" {...swapMotion(reduced, 12)}>
              <PillButton trailingIcon="→" onClick={startRound}>
                Start round
              </PillButton>
            </motion.div>
          ) : null}
          {status.kind === "error" && step === 1 ? (
            <motion.div key="retry" className="pointer-events-auto [grid-area:1/1]" {...swapMotion(reduced, 12)}>
              <PillButton onClick={retry}>Try again</PillButton>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* The travelling copy of the chosen name, above everything. */}
      <div ref={layerRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[9]">
        {travel?.to ? <Ghost travel={travel} to={travel.to} onLanded={() => setTravel(null)} /> : null}
      </div>
    </main>
  );

  function renderOptions(): ReactNode {
    if (step === 1) {
      if (status.kind === "loading") return <LoadingAreas />;
      if (status.kind === "error") return <LoadFailed />;
    }
    if (!index || !progress) return null;
    switch (step) {
      case 1:
        return index.areas.map((area) => {
          const n = deckCount(area);
          return (
            <Option key={area.id} id={area.id}>
              <DestinationCard
                variant="place"
                name={area.title}
                sub={decksLabel(n)}
                label={n === 0 ? `${area.title}, no decks yet` : `${area.title}, ${decksLabel(n)}`}
                unavailable={n === 0}
                onSelect={() => forward(2, { areaId: area.id }, "area", optionEl(area.id))}
              />
            </Option>
          );
        });
      case 2:
        return (r.area?.platforms ?? []).map((platform) => {
          const n = deckCount(platform);
          return (
            <Option key={platform.id} id={platform.id}>
              <DestinationCard
                variant="place"
                name={platform.title}
                sub={decksLabel(n)}
                label={n === 0 ? `${platform.title}, no decks yet` : `${platform.title}, ${decksLabel(n)}`}
                unavailable={n === 0}
                onSelect={() => forward(3, { ...view.choice, platformId: platform.id }, "platform", optionEl(platform.id))}
              />
            </Option>
          );
        });
      case 3:
        return (r.platform?.decks ?? []).map((deck) => {
          const seen = seenPercent(progress, deck);
          const choose = () =>
            deck.sections.length > 0
              ? forward(4, { ...view.choice, deckId: deck.id }, "deck", optionEl(deck.id))
              : forward(5, { ...view.choice, deckId: deck.id, sectionId: WHOLE_DECK }, "deck", optionEl(deck.id));
          return (
            <Option key={deck.id} id={deck.id}>
              <DestinationCard
                variant="deck"
                name={deck.code}
                code
                detail={deck.title}
                seenPercent={seen}
                stub={{ label: "Cards", value: String(deck.cardCount) }}
                label={`${deck.code}, ${deck.title}, ${deck.cardCount} cards, ${seen > 0 ? `${seen} percent seen` : "not started"}`}
                onSelect={choose}
              />
            </Option>
          );
        });
      case 4: {
        const deck = r.deck;
        if (!deck) return null;
        const sections: SectionView[] = [wholeDeck(deck), ...deck.sections.map((s) => ({ ...s, whole: false }))];
        return sections.map((section) => (
          <Option key={section.id} id={section.id}>
            <DestinationCard
              variant="section"
              name={section.whole ? "Whole deck" : section.id}
              code={!section.whole}
              detail={section.whole ? `All ${deck.sections.length} sections` : section.title}
              stub={{ label: "Cards", value: String(section.cardCount) }}
              label={
                section.whole
                  ? `Whole deck, all ${deck.sections.length} sections, ${section.cardCount} cards`
                  : `${section.id}, ${section.title}, ${section.cardCount} cards`
              }
              onSelect={() => forward(5, { ...view.choice, sectionId: section.id }, "section", optionEl(section.id))}
            />
          </Option>
        ));
      }
      case 5:
        return MODE_TABLE.map((mode) => {
          const available = mode.offered;
          const { deckId, sectionId } = view.choice;
          const best = available && deckId && sectionId ? bestFor(progress, { deckId, sectionId }, mode.id) : null;
          return (
            <Option key={mode.id} id={mode.id}>
              <DestinationCard
                variant="class"
                name={mode.name}
                detail={mode.description}
                sub={available ? undefined : "Not available yet"}
                unavailable={!available}
                stub={best === null ? { label: "Best", value: "–", unit: "not played", muted: true } : { label: "Best", value: String(best), unit: mode.unit }}
                label={
                  !available
                    ? `${mode.name}, not available yet`
                    : `${mode.name}. ${mode.description} ${best === null ? "Not played yet." : `Your best: ${best} ${mode.unit}.`}`
                }
                onSelect={() => forward(6, { ...view.choice, mode: mode.id }, "mode", optionEl(mode.id))}
              />
            </Option>
          );
        });
      case 6:
        return (
          <p className={`${TEXT_ROLE.tagline} max-w-[320px]`}>
            {r.mode?.description} Swipe right for true, left for false.
          </p>
        );
    }
  }

  function optionEl(id: string): HTMLElement | null {
    return mainRef.current?.querySelector<HTMLElement>(`[data-step="${step}"] [data-option="${CSS.escape(id)}"]`) ?? null;
  }
}

// ---------- parts ----------

interface StepPanelProps {
  step: Step;
  dir: Direction;
  reduced: boolean;
  children: ReactNode;
}

/** How the items of the step being rendered move in: the variants (none under reduced motion) and the direction. */
const ItemMotion = createContext<{ variants: Variants | undefined; dir: Direction }>({ variants: undefined, dir: 1 });

/** One step: its title over its options. Leaving, it is inert, so a quick second tap cannot reach it. */
function StepPanel({ step, dir, reduced, children }: StepPanelProps) {
  const present = useIsPresent();
  const item = reduced ? undefined : ITEM;
  const listRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const more = useListCue(listRef, contentRef);
  return (
    <ItemMotion.Provider value={{ variants: item, dir }}>
      <motion.div
        data-step={step}
        inert={!present}
        className={`flex min-h-0 flex-col [grid-area:1/1] ${step === 6 ? "pt-(--size-ready-offset) tight:pt-[calc(var(--size-ready-offset)-var(--space-24))] short:pt-0" : ""}`}
        variants={reduced ? PANEL_REDUCED : PANEL}
        initial="hidden"
        animate="shown"
        exit="gone"
        custom={dir}
      >
        <motion.h2 tabIndex={-1} className={TEXT_ROLE.title} variants={item} custom={dir}>
          {STEP_TITLE[step]}
        </motion.h2>
        {/* The list scrolls when it is taller than the screen; its margin and padding leave room for the focus ring.
            While more lies below what it shows, it fades out over 28 px at its bottom, or a little higher so that
            the fade lies over a card (./listCue.ts). A mask: right on any sky, in both themes. */}
        <div
          ref={listRef}
          data-list=""
          data-more={more ? "" : undefined}
          className={[
            "-mx-(--space-8) mt-(--space-8) min-h-0 flex-1 overflow-y-auto px-(--space-8) pt-(--space-6) pb-(--space-24) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            // Short screens: the list takes its own height and the whole column scrolls instead.
            "short:flex-none short:overflow-visible",
            "data-more:[mask-image:linear-gradient(to_bottom,var(--color-ink)_calc(100%_-_28px_-_var(--list-fade-lift,0px)),transparent_calc(100%_-_var(--list-fade-lift,0px)))]",
          ].join(" ")}
        >
          <div ref={contentRef} className="flex flex-col gap-(--space-12)">
            {children}
          </div>
        </div>
      </motion.div>
    </ItemMotion.Provider>
  );
}

/** One option in a step's list, rising in after the one before it; `id` lets focus come back to it. */
function Option({ id, children }: { id: string; children: ReactNode }) {
  const { variants, dir } = useContext(ItemMotion);
  return (
    <motion.div data-option={id} className="flex-none" variants={variants} custom={dir}>
      {children}
    </motion.div>
  );
}

/** Step 1 while the index loads: three quiet placeholder cards. */
function LoadingAreas() {
  return (
    <>
      <p role="status" className="sr-only">
        Loading the decks
      </p>
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden="true" data-placeholder="" className="min-h-(--size-card-min) rounded-(--radius-card) bg-(--color-surface-sunk)" />
      ))}
    </>
  );
}

/** Step 1 when the index cannot be loaded and nothing is cached. "Try again" sits in the foot zone. */
function LoadFailed() {
  return (
    <div role="alert" className="rounded-(--radius-card) bg-(--color-surface-raised) p-(--space-20) text-(--color-ink) shadow-(--elevation-small)">
      <p className="m-0 font-(family-name:--type-emphasis-family) text-(length:--type-emphasis-size) font-(--type-emphasis-weight) tracking-(--type-emphasis-letter-spacing)">
        The decks didn&apos;t load
      </p>
      <p className="m-0 mt-(--space-8) font-(family-name:--type-body-family) text-(length:--type-body-size) leading-(--type-body-line-height) font-(--type-body-weight)">
        Check your connection and try again.
      </p>
    </div>
  );
}

/** The copy of a chosen name, flying from its card into its field: left edges and vertical centres meet. */
function Ghost({ travel, to, onLanded }: { travel: Travel; to: NonNullable<Travel["to"]>; onLanded: () => void }) {
  const { from } = travel;
  const scale = to.fontSize / from.fontSize;
  return (
    <motion.span
      className="absolute origin-top-left whitespace-nowrap"
      style={{ ...from.style, left: from.left, top: from.top, lineHeight: `${from.height}px` }}
      initial={{ x: 0, y: 0, scale: 1 }}
      animate={{ x: to.left - from.left, y: to.top + to.height / 2 - from.top - (from.height * scale) / 2, scale }}
      transition={TRAVEL}
      onAnimationComplete={onLanded}
    >
      {from.text}
    </motion.span>
  );
}
