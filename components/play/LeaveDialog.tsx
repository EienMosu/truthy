"use client";

// The one confirmation before leaving a round (spec section 6, "Leaving a round"): a modal sheet at the
// bottom of the frame, over a scrim. "Keep playing" is the primary action and has focus when it opens;
// Escape and a tap on the scrim also keep playing. Focus stays inside while it is open. The screen behind
// should be made inert by the caller (PlayScreen sets inert on its <main>).
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { PillButton } from "@/components/PillButton";
import { QuietButton } from "@/components/QuietButton";
import { EASE } from "@/components/easing";
import { SWIPE } from "@/src/input/swipe";

export interface LeaveDialogProps {
  open: boolean;
  /** "Keep playing", Escape or a tap on the scrim. */
  onStay: () => void;
  /** "Leave round". */
  onLeave: () => void;
  /** The round is decided: leaving records it with its score, so the sheet says that instead. */
  decided?: boolean;
  /** A clock in ms that never goes back, for the scrim's settle time. In the browser: performance.now. */
  now?: () => number;
}

const browserNow = () => performance.now();

const OPEN_TEXT = "Your answers so far stay in your history. This round won't count toward your best.";
const DECIDED_TEXT = "This round is over and its score is kept. Leaving skips its result.";

export function LeaveDialog({ open, onStay, onLeave, decided = false, now = browserNow }: LeaveDialogProps) {
  return (
    <AnimatePresence>
      {open ? <Sheet key="leave" onStay={onStay} onLeave={onLeave} decided={decided} now={now} /> : null}
    </AnimatePresence>
  );
}

interface SheetProps {
  onStay: () => void;
  onLeave: () => void;
  decided: boolean;
  now: () => number;
}

function Sheet({ onStay, onLeave, decided, now }: SheetProps) {
  const reduced = useReducedMotion() ?? false;
  const titleId = useId();
  const bodyId = useId();
  const stayRef = useRef<HTMLButtonElement>(null);
  const leaveRef = useRef<HTMLButtonElement>(null);
  // When the sheet opened. The scrim fades in over the close button, so the second tap of a double tap on
  // that button lands on it: for the settle time (spec section 8) a tap on the scrim does not keep playing.
  const [shownAt] = useState(now);
  // The Timed clock keeps running under the sheet, so the round can be decided while it is open and the text
  // changes to say its score is kept. A screen reader read the text (aria-describedby) when the sheet opened,
  // so the status says the new text; it is empty until then, since a live region added with its text is not
  // announced. A sheet that opens on a decided round already says it.
  const [decidedAtOpen] = useState(decided);
  const body = decided ? DECIDED_TEXT : OPEN_TEXT;

  useEffect(() => {
    stayRef.current?.focus();
  }, []);

  // The keys are heard on the document, not on the sheet: a tap on the sheet's text moves focus to the
  // body, and Escape must still keep playing from there (the screen behind is inert and ignores it). Only
  // while the sheet is open: once it has closed it stays in the page for its exit animation, and the keys
  // are the round screen's again (Tab from the close button, Escape to ask again).
  const present = useIsPresent();
  const stay = useRef(onStay);
  useEffect(() => {
    stay.current = onStay;
  });
  useEffect(() => {
    if (!present) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        stay.current();
        return;
      }
      if (event.key !== "Tab") return;
      // Two buttons: Tab and Shift+Tab move between them and never leave the dialog. From anywhere else
      // (the body, after a tap on the text) Tab comes back to the first and Shift+Tab to the last.
      const first = stayRef.current;
      const last = leaveRef.current;
      if (!first || !last) return;
      const active = document.activeElement;
      if (active !== first && active !== last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [present]);

  return (
    // The sheet sits at the foot of the screen. Where it does not fit (a page zoomed to 300 percent) the layer
    // scrolls, both ways, so its title and both actions can be reached: the sheet keeps the 320 px of the
    // smallest phone, as the page under it does, and grows the layer upwards instead of running off the top.
    <div className="fixed inset-0 z-50 overflow-auto overscroll-contain">
      <motion.div
        aria-hidden="true"
        data-scrim=""
        className="fixed inset-0 bg-(--color-scrim)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.36, ease: EASE }}
        onClick={() => {
          if (now() - shownAt >= SWIPE.settleMs) onStay();
        }}
      />
      <div className="pointer-events-none relative mx-auto flex min-h-full w-full max-w-(--app-max-width) min-w-[320px] flex-col justify-end px-(--size-gutter) pt-(--space-12) pb-(--size-safe-bottom)">
        <motion.section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          className="pointer-events-auto rounded-(--radius-card) bg-(--color-surface-raised) p-(--space-20) text-(--color-ink) shadow-(--elevation-sheet)"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: reduced ? 0.14 : 0.36, ease: EASE }}
        >
          <h2
            id={titleId}
            className="m-0 font-(family-name:--type-step-title-family) text-(length:--type-step-title-size) leading-(--type-step-title-line-height) font-(--type-step-title-weight) tracking-(--type-step-title-letter-spacing)"
          >
            Leave round?
          </h2>
          <p
            id={bodyId}
            className="m-0 mt-(--space-8) font-(family-name:--type-body-family) text-(length:--type-body-size) leading-(--type-body-line-height) font-(--type-body-weight)"
          >
            {body}
          </p>
          <p role="status" className="sr-only">
            {decided && !decidedAtOpen ? body : ""}
          </p>
          <div className="mt-(--space-20) flex flex-col gap-(--space-4)">
            <PillButton ref={stayRef} onClick={onStay}>
              Keep playing
            </PillButton>
            <QuietButton ref={leaveRef} onClick={onLeave}>
              Leave round
            </QuietButton>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
