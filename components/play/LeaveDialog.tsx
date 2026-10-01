"use client";

// The one confirmation before leaving a round (spec section 6, "Leaving a round"): a modal sheet at the
// bottom of the frame, over a scrim. "Keep playing" is the primary action and has focus when it opens;
// Escape and a tap on the scrim also keep playing. Focus stays inside while it is open. The screen behind
// should be made inert by the caller (PlayScreen sets inert on its <main>).
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { PillButton } from "@/components/PillButton";
import { QuietButton } from "@/components/QuietButton";

export interface LeaveDialogProps {
  open: boolean;
  /** "Keep playing", Escape or a tap on the scrim. */
  onStay: () => void;
  /** "Leave round". */
  onLeave: () => void;
}

export function LeaveDialog({ open, onStay, onLeave }: LeaveDialogProps) {
  return <AnimatePresence>{open ? <Sheet key="leave" onStay={onStay} onLeave={onLeave} /> : null}</AnimatePresence>;
}

const EASE = [0.2, 0.7, 0.2, 1] as const;

function Sheet({ onStay, onLeave }: Omit<LeaveDialogProps, "open">) {
  const reduced = useReducedMotion() ?? false;
  const titleId = useId();
  const bodyId = useId();
  const stayRef = useRef<HTMLButtonElement>(null);
  const leaveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    stayRef.current?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onStay();
      return;
    }
    if (event.key !== "Tab") return;
    // Two buttons: Tab and Shift+Tab move between them and never leave the dialog.
    const first = stayRef.current;
    const last = leaveRef.current;
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

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
        onClick={onStay}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto w-full max-w-(--app-max-width) px-(--size-gutter) pb-(--size-safe-bottom)">
        <motion.section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          onKeyDown={onKeyDown}
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
