"use client";

// The one confirmation before leaving a round (spec section 6, "Leaving a round"): a modal sheet at the
// bottom of the frame, over a scrim. "Keep playing" is the primary action and has focus when it opens;
// Escape and a tap on the scrim also keep playing. Focus stays inside while it is open. The screen behind
// should be made inert by the caller (PlayScreen sets inert on its <main>).
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  /** A clock in ms that never goes back, for the scrim's settle time. In the browser: performance.now. */
  now?: () => number;
}

const browserNow = () => performance.now();

export function LeaveDialog({ open, onStay, onLeave, now = browserNow }: LeaveDialogProps) {
  return (
    <AnimatePresence>
      {open ? <Sheet key="leave" onStay={onStay} onLeave={onLeave} now={now} /> : null}
    </AnimatePresence>
  );
}

interface SheetProps {
  onStay: () => void;
  onLeave: () => void;
  now: () => number;
}

function Sheet({ onStay, onLeave, now }: SheetProps) {
  const reduced = useReducedMotion() ?? false;
  const titleId = useId();
  const bodyId = useId();
  const stayRef = useRef<HTMLButtonElement>(null);
  const leaveRef = useRef<HTMLButtonElement>(null);
  // When the sheet opened. The scrim fades in over the close button, so the second tap of a double tap on
  // that button lands on it: for the settle time (spec section 8) a tap on the scrim does not keep playing.
  const [shownAt] = useState(now);

  useEffect(() => {
    stayRef.current?.focus();
  }, []);

  // The keys are heard on the document, not on the sheet: a tap on the sheet's text moves focus to the
  // body, and Escape must still keep playing from there (the screen behind is inert and ignores it).
  const stay = useRef(onStay);
  useEffect(() => {
    stay.current = onStay;
  });
  useEffect(() => {
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
  }, []);

  return (
    <div className="fixed inset-0 z-50">
      <motion.div
        aria-hidden="true"
        data-scrim=""
        className="absolute inset-0 bg-(--color-scrim)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.36, ease: EASE }}
        onClick={() => {
          if (now() - shownAt >= SWIPE.settleMs) onStay();
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto w-full max-w-(--app-max-width) px-(--size-gutter) pb-(--size-safe-bottom)">
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
            Your answers so far stay in your history. This round won&apos;t set a record.
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
