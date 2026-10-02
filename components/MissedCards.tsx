"use client";

// The missed cards of a finished round (design system 5.15), on the sunk lower part of the result ticket:
// a header row, then a scrolling list. Each card shows its number in the round, what the player said, the
// statement and the right answer (ink, not red: the word carries it), and a "Why" disclosure that reveals
// the explanation and the source. With no missed cards there is one calm line instead of an empty list.
import { useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import type { Answered } from "@/src/engine/round";
import { PassLower } from "./BoardingPass";
import { pad2 } from "./format";
import { BookIcon, ChevronIcon } from "./icons";

/** One missed card, as the list shows it. */
export interface MissedCard {
  /** The card's place in the round, from 1. */
  number: number;
  /** What the player answered. */
  given: boolean;
  /** The right answer. */
  answer: boolean;
  statement: string;
  explanation: string;
  source: { title: string; url: string };
}

/** The wrong answers of a round, in order, with their card numbers. */
export function missedCards(answers: readonly Answered[]): MissedCard[] {
  return answers.flatMap((answered, i) =>
    answered.correct
      ? []
      : [
          {
            number: i + 1,
            given: answered.given,
            answer: answered.card.answer,
            statement: answered.card.text.en.statement,
            explanation: answered.card.text.en.explanation,
            source: answered.card.source,
          },
        ],
  );
}

export interface MissedCardsProps {
  missed: readonly MissedCard[];
  className?: string;
}

function word(value: boolean): string {
  return value ? "True" : "False";
}

const MONO_DATA =
  "font-(family-name:--type-mono-data-family) text-(length:--type-mono-data-size) font-(--type-mono-data-weight) " +
  "leading-(--type-mono-data-line-height) tracking-(--type-mono-data-letter-spacing) text-(--color-ink-muted)";
const MONO_STRONG =
  "font-(family-name:--type-mono-data-strong-family) text-(length:--type-mono-data-strong-size) " +
  "font-(--type-mono-data-strong-weight) leading-(--type-mono-data-strong-line-height) tracking-(--type-mono-data-strong-letter-spacing)";
const CAPTION =
  "flex justify-between font-(family-name:--type-mono-caption-family) text-(length:--type-mono-caption-size) " +
  "font-(--type-mono-caption-weight) leading-(--type-mono-caption-line-height) tracking-(--type-mono-caption-letter-spacing) text-(--color-ink-muted)";
const LIST_STATEMENT =
  "font-(family-name:--type-list-statement-family) text-(length:--type-list-statement-size) " +
  "font-(--type-list-statement-weight) leading-(--type-list-statement-line-height) tracking-(--type-list-statement-letter-spacing) text-(--color-ink)";
const STATEMENT = `m-0 mt-(--space-6) ${LIST_STATEMENT}`;
// The answer word is Sans 800 at 17 (the emphasis role is 16) and the explanation 15 / 1.45 (the body role
// is 15.5): the design system documents both sizes, tokens.json has no role for them.
const ANSWER_WORD =
  "font-(family-name:--type-emphasis-family) text-[17px] font-(--type-emphasis-weight) leading-(--type-emphasis-line-height) " +
  "tracking-(--type-emphasis-letter-spacing) text-(--color-ink)";
const EXPLANATION =
  "m-0 font-(family-name:--type-body-family) text-[15px] font-(--type-body-weight) leading-(--type-body-line-height) text-(--color-ink)";

function MissedItem({ item, listRef }: { item: MissedCard; listRef: RefObject<HTMLOListElement | null> }) {
  const reduced = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const itemRef = useRef<HTMLLIElement>(null);
  const whyRef = useRef<HTMLDivElement>(null);
  const buttonId = useId();
  const regionId = useId();
  const number = pad2(item.number);

  // Once the explanation has grown (380 ms; with reduced motion its 1 ms transition is over after a frame or
  // two), scroll it into the list: the whole item, 16 px clear of the foot of the list, as far as that leaves
  // the first line of the explanation in view. A card taller than the list (a long explanation on a short
  // phone) gives up its statement and its Why row, never the start of the explanation. The explanation is
  // measured at its own height, which does not depend on how far the row has grown.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(
      () => {
        const list = listRef.current;
        const element = itemRef.current;
        const why = whyRef.current;
        if (!list || !element || !why) return;
        const frame = list.getBoundingClientRect();
        const explanation = why.getBoundingClientRect();
        const below = parseFloat(getComputedStyle(why).marginBottom) + parseFloat(getComputedStyle(element).paddingBottom);
        const over = explanation.bottom + (below || 0) + 16 - frame.bottom;
        const toExplanation = explanation.top - frame.top;
        if (over > 0) list.scrollBy?.({ top: Math.min(over, toExplanation), behavior: reduced ? "auto" : "smooth" });
      },
      reduced ? 50 : 380,
    );
    return () => clearTimeout(timer);
  }, [open, reduced, listRef]);

  return (
    <li
      ref={itemRef}
      data-missed-card={item.number}
      className="list-none pt-(--space-12) pb-(--space-4) not-first:border-t-(length:--stroke-rule) not-first:border-(--color-rule)"
    >
      <div className={CAPTION}>
        <span>Card {number}</span>
        <span>You said {word(item.given)}</span>
      </div>
      <p className={STATEMENT}>{item.statement}</p>
      <div className="flex min-h-(--size-touch-min) items-center justify-between gap-(--space-12)">
        <span className={`flex items-center gap-(--space-8) ${MONO_DATA}`}>
          Answer <b className={ANSWER_WORD}>{word(item.answer)}</b>
        </span>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          aria-label={`Why, card ${number}`}
          onClick={() => setOpen((value) => !value)}
          className={`-mr-(--space-8) flex min-h-(--size-touch-min) cursor-pointer items-center gap-(--space-6) rounded-(--radius-small) px-(--space-8) text-(--color-true) ${MONO_STRONG}`}
        >
          <u className="decoration-[1.5px] underline-offset-[3px]">Why</u>
          <ChevronIcon
            direction="down"
            className={`transition-transform duration-(--duration-t2) ease-(--easing-ease) ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {/* The one height animation of the web build (design system 7): the row grows from 0fr to 1fr.
          Closed, the explanation is hidden from screen readers and its link is out of the tab order. */}
      <div
        id={regionId}
        role="region"
        aria-labelledby={buttonId}
        aria-hidden={!open}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-(--duration-t3) ease-(--easing-ease) ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div ref={whyRef} className="mb-(--space-12) border-l-(length:--stroke-quote) border-(--color-rule) pl-(--space-12)">
            <p className={EXPLANATION}>{item.explanation}</p>
            <a
              href={item.source.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${item.source.title} (opens in a new tab)`}
              className={`flex min-h-(--size-touch-min) items-center gap-(--space-8) text-(--color-true) no-underline ${MONO_STRONG}`}
            >
              <BookIcon className="flex-none" />
              <u className="decoration-[1.5px] underline-offset-[3px]">{item.source.title}</u>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </li>
  );
}

export function MissedCards({ missed, className }: MissedCardsProps) {
  const headingId = useId();
  const listRef = useRef<HTMLOListElement>(null);

  if (missed.length === 0) {
    return (
      <PassLower tone="sunk" className={["relative", className].filter(Boolean).join(" ")}>
        <section aria-label="Missed cards" className="px-(--size-ticket-inset) pt-(--space-16) pb-(--space-20)">
          <p data-no-missed="" className={`m-0 ${LIST_STATEMENT}`}>
            No missed cards
          </p>
        </section>
      </PassLower>
    );
  }

  return (
    <PassLower tone="sunk" className={["relative flex min-h-0 flex-col", className].filter(Boolean).join(" ")}>
      <section aria-labelledby={headingId} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-none items-baseline justify-between px-(--size-ticket-inset) pt-(--space-16) pb-(--space-4)">
          <h2 id={headingId} className={`m-0 ${MONO_DATA}`}>
            Missed cards
          </h2>
          <span className={`${MONO_STRONG} text-(--color-ink)`}>{missed.length} to review</span>
        </div>
        <ol
          ref={listRef}
          className="m-0 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-b-(--radius-card) px-(--size-ticket-inset) pt-0 pb-(--space-20) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {missed.map((item) => (
            <MissedItem key={item.number} item={item} listRef={listRef} />
          ))}
        </ol>
      </section>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[28px] rounded-b-(--radius-card) bg-linear-to-b from-(--color-surface-sunk-clear) to-(--color-surface-sunk)"
      />
    </PassLower>
  );
}
