// The destination card of the start flow (design system 5.3): one large, calm choice per row. A ticket
// with a stub on the right, notches of radius 7 on the stub line and a dashed perforation between them.
// Variants: "place" (an area or a platform), "deck", "section" and "class". A card whose option has no
// content is "not available": a sunk, labelled group without a stub, which is not a button. A deck that
// exists but cannot be played now (offline, no copy on the device) is "dimmed": the same ticket in sunk
// paper and muted ink, the reason in its stub, also a labelled group and not a button.
import type { CSSProperties, Ref } from "react";
import { ChevronIcon } from "./icons";

export type DestinationVariant = "place" | "deck" | "section" | "class";

/** What the stub of a deck, section or class card shows: "Cards / 214" or "Best / 9 / of 10". */
export interface CardStub {
  label: string;
  value: string;
  /** A third line in the label style, for example "of 10" or "not played". */
  unit?: string;
  /** Draws the value in ink-muted (the "–" of a class that has not been played). */
  muted?: boolean;
}

export interface DestinationCardProps {
  variant: DestinationVariant;
  /** The big name: an area or platform title, a deck or section code, "Whole deck", a class name. */
  name: string;
  /** Draws the name as a code (Mono 600 30) instead of the card-name role. */
  code?: boolean;
  /** Place cards: the mono line under the name ("3 decks"). Unavailable cards: the reason ("No decks yet"). */
  sub?: string;
  /** Deck, section and class cards: the line under the name ("Cloud Practitioner", "Correct answers out of 10 cards."). */
  detail?: string;
  /** Deck cards: the share of the deck seen, in whole percent. 0 reads "Not started". */
  seenPercent?: number;
  /** Deck, section and class cards: the stub values. Place cards show only the chevron. */
  stub?: CardStub;
  /** The accessible name, a full sentence of what the card holds ("CLF, Cloud Practitioner, 214 cards, not started"). */
  label: string;
  /** When true the option cannot be chosen: no button, no stub, sunk paper, and `sub` says why. */
  unavailable?: boolean;
  /**
   * When set the option cannot be chosen now, and this says why ("Needs a connection"). The card keeps its
   * shape, height and main column, in sunk paper and muted ink without a shadow; the stub shows this text in
   * place of its values and chevron. Not a button: a labelled, disabled group. Used by the deck card offline.
   */
  dimmedReason?: string;
  onSelect?: () => void;
  ref?: Ref<HTMLButtonElement>;
  /** Hides the name while a copy of it travels into the pass. */
  nameHidden?: boolean;
}

const STUB_WIDTH: Record<DestinationVariant, string> = {
  place: "var(--size-card-stub)",
  deck: "var(--size-card-stub-deck)",
  section: "var(--size-card-stub-deck)",
  class: "var(--size-card-stub-deck)",
};

const MIN_HEIGHT: Record<DestinationVariant, string> = {
  place: "min-h-(--size-card-min)",
  deck: "min-h-(--size-card-min-deck)",
  section: "min-h-(--size-card-min-section)",
  class: "min-h-(--size-card-min-class)",
};

const MAIN_PADDING: Record<DestinationVariant, string> = {
  place: "gap-(--space-4) py-(--space-18)",
  deck: "gap-(--space-2) py-(--space-18)",
  section: "gap-(--space-2) py-(--space-14)",
  class: "gap-(--space-4) py-(--space-16)",
};

/** Paper with a half circle of radius 7 cut into the top and bottom edges on the stub line. */
function notchedCard(stubWidth: string, paper = "var(--color-surface-raised)"): CSSProperties {
  const cut = (edge: "0" | "100%") =>
    `radial-gradient(circle at calc(100% - ${stubWidth}) ${edge}, transparent var(--size-card-notch), ` +
    `${paper} calc(var(--size-card-notch) + 0.5px))`;
  return { background: `${cut("0")} top / 100% 51% no-repeat, ${cut("100%")} bottom / 100% 51% no-repeat` };
}

const PERFORATION: CSSProperties = {
  background: "repeating-linear-gradient(180deg, var(--color-rule) 0 5px, transparent 5px 10px)",
};

const NAME =
  "self-start whitespace-nowrap font-(family-name:--type-card-name-family) text-(length:--type-card-name-size) " +
  "font-(--type-card-name-weight) leading-(--type-card-name-line-height) tracking-(--type-card-name-letter-spacing)";
const CODE =
  "self-start whitespace-nowrap font-(family-name:--type-deck-code-family) text-(length:--type-deck-code-size) " +
  "font-(--type-deck-code-weight) leading-(--type-deck-code-line-height) tracking-(--type-deck-code-letter-spacing)";
const SUB =
  "font-(family-name:--type-mono-data-family) text-(length:--type-mono-data-size) font-(--type-mono-data-weight) " +
  "leading-(--type-mono-data-line-height) text-(--color-ink-muted)";
const DETAIL =
  "font-(family-name:--type-list-title-family) text-(length:--type-list-title-size) font-(--type-list-title-weight) " +
  "leading-[1.25] tracking-(--type-list-title-letter-spacing)";
const STUB_LABEL =
  "font-(family-name:--type-field-label-family) text-(length:--type-field-label-size) font-(--type-field-label-weight) " +
  "leading-(--type-field-label-line-height) tracking-(--type-field-label-letter-spacing) text-(--color-ink-muted)";
const STUB_VALUE = "font-(family-name:--font-mono) text-[16px] font-(--font-weight-mono-semibold) leading-[1.27]";

/**
 * The 56 by 8 progress track: dashed for the part not seen, a solid ink line with an amber dot for the part seen.
 * Dimmed, the whole track is drawn at the disabled opacity like any other inactive part of the design; it is
 * decorative, so the lower contrast takes nothing from the text beside it.
 */
export function ProgressTrack({ percent, dimmed = false }: { percent: number; dimmed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-track=""
      data-dimmed={dimmed ? "" : undefined}
      className={`relative block h-(--space-8) w-(--size-progress-track) flex-none${dimmed ? " opacity-(--opacity-disabled)" : ""}`}
    >
      <span
        className="absolute inset-x-0 top-[3px] h-(--stroke-perforation)"
        style={{ background: "repeating-linear-gradient(90deg, var(--color-rule) 0 4px, transparent 4px 8px)" }}
      />
      {percent > 0 ? (
        <span
          data-seen=""
          className="absolute top-[3px] left-0 h-(--stroke-perforation) rounded-[1px] bg-(--color-ink)"
          style={{ width: `${percent}%` }}
        >
          <span className="absolute -top-[3px] -right-[4px] size-(--space-8) rounded-full bg-(--color-accent) shadow-[0_0_0_1.5px_var(--color-ink)]" />
        </span>
      ) : null}
    </span>
  );
}

export function DestinationCard(props: DestinationCardProps) {
  const { variant, name, code = false, sub, detail, seenPercent, stub, label, unavailable = false, dimmedReason, onSelect, ref, nameHidden = false } = props;
  const nameClass = code ? CODE : NAME;
  const dimmed = dimmedReason !== undefined;

  if (unavailable) {
    return (
      <div
        role="group"
        aria-label={label}
        aria-disabled="true"
        data-unavailable=""
        className="flex min-h-(--size-card-min-off) w-full flex-col justify-center gap-(--space-4) rounded-(--radius-card) bg-(--color-surface-sunk) py-(--space-18) pr-(--space-12) pl-(--space-20) text-(--color-ink-muted)"
      >
        <span aria-hidden="true" className={nameClass}>
          {name}
        </span>
        {detail ? (
          <span aria-hidden="true" className={DETAIL}>
            {detail}
          </span>
        ) : null}
        {sub ? (
          <span aria-hidden="true" className={SUB}>
            {sub}
          </span>
        ) : null}
      </div>
    );
  }

  const stubWidth = STUB_WIDTH[variant];
  const main = (
    <span aria-hidden="true" className={`flex min-w-0 flex-col justify-center pr-(--space-12) pl-(--space-20) ${MAIN_PADDING[variant]}`}>
      <span data-card-name="" className={nameClass} style={nameHidden ? { visibility: "hidden" } : undefined}>
        {name}
      </span>
      {sub ? <span className={SUB}>{sub}</span> : null}
      {detail ? (
        <span className={variant === "class" ? `${DETAIL} text-(--color-ink-muted)` : DETAIL}>{detail}</span>
      ) : null}
      {seenPercent === undefined ? null : (
        <span data-status="" className={`mt-(--space-10) flex items-center gap-(--space-10) ${SUB}`}>
          <ProgressTrack percent={seenPercent} dimmed={dimmed} />
          {seenPercent > 0 ? (
            <span>
              <b className={dimmed ? "font-(--font-weight-mono-semibold)" : "font-(--font-weight-mono-semibold) text-(--color-ink)"}>{seenPercent}%</b> seen
            </span>
          ) : (
            <span>Not started</span>
          )}
        </span>
      )}
    </span>
  );
  const perforation = <span className="absolute top-(--space-12) bottom-(--space-12) left-[-0.75px] w-(--stroke-rule)" style={PERFORATION} />;

  if (dimmed) {
    return (
      <div
        role="group"
        aria-label={label}
        aria-disabled="true"
        data-variant={variant}
        data-dimmed=""
        className={`relative grid w-full rounded-(--radius-card) text-left text-(--color-ink-muted) ${MIN_HEIGHT[variant]}`}
        style={{ ...notchedCard(stubWidth, "var(--color-surface-sunk)"), gridTemplateColumns: `minmax(0, 1fr) ${stubWidth}` }}
      >
        {main}
        <span aria-hidden="true" className="relative flex flex-col items-center justify-center px-(--space-4)">
          {perforation}
          <span data-stub-reason="" className={`${STUB_LABEL} text-center`}>
            {dimmedReason}
          </span>
        </span>
      </div>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      onClick={onSelect}
      data-variant={variant}
      className={[
        "relative grid w-full cursor-pointer text-left text-(--color-ink) rounded-(--radius-card) shadow-(--elevation-small)",
        "transition-transform duration-(--duration-t1) ease-(--easing-ease) active:scale-[0.98]",
        MIN_HEIGHT[variant],
      ].join(" ")}
      style={{ ...notchedCard(stubWidth), gridTemplateColumns: `minmax(0, 1fr) ${stubWidth}` }}
    >
      {main}
      <span aria-hidden="true" className="relative flex flex-col items-center justify-center gap-(--space-2)">
        {perforation}
        {stub ? (
          <>
            <span className={STUB_LABEL}>{stub.label}</span>
            <span className={stub.muted ? `${STUB_VALUE} text-(--color-ink-muted)` : STUB_VALUE}>{stub.value}</span>
            {stub.unit ? <span className={STUB_LABEL}>{stub.unit}</span> : null}
          </>
        ) : null}
        {variant === "class" ? null : (
          <span className={stub ? "mt-(--space-8) flex" : "flex"}>
            <ChevronIcon />
          </span>
        )}
      </span>
    </button>
  );
}
