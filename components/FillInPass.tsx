"use client";

// The fill-in pass of the start flow (design system 5.4): what the player has chosen so far, written onto
// one pass that becomes the round's boarding pass. Three layouts, one per stage of the start flow:
//   "destination" (steps 2 and 3): compact band, then Area / Platform / Deck.
//   "route" (steps 4 and 5): area and platform fold into one quiet line over Deck / Section / Class.
//   "ready" (step 6): the full boarding pass without its lower part (legs, Class / Cards / Gate).
// Every filled field is a way back to its step. With `unroll`, the ready pass grows down to the height of
// the game ticket (the hand-off to /play, which shows its ticket in the same place).
// A change of layout is one paper changing shape (design system 7, "Pass changes layout"): the band and the
// body grow or shrink over 360 ms while the old block fades out and the new one fades in, and the values on
// both layouts travel to their new places. With reduced motion it is the start flow's cross-fade: the paper
// takes its new shape at once, the old block fades out (100) and the new one fades in (140, delay 90).
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FIELD_COLUMNS } from "./BoardingPass";
import { EASE, EASE_OUT } from "./easing";
import { LogoMark } from "./Logo";
import { travelPassValues } from "./passValueTravel";
import { CloudIcon } from "./icons";

export type PassStage = "destination" | "route" | "ready";
export type PassFieldName = "area" | "platform" | "deck" | "section" | "mode";

export interface FillInPassValues {
  /** Area title, "Cloud". */
  area?: string;
  /** Platform title, "AWS". */
  platform?: string;
  /** Deck code ("CLF") and the name the ready pass shows under it ("AWS Cloud Practitioner"). */
  deck?: { code: string; name: string };
  /** Section code and title; the whole deck is { code: "ALL", name: "Whole deck", whole: true }. */
  section?: { code: string; name: string; whole: boolean };
  /** Class label, "Classic". */
  mode?: string;
  /** The number of cards on the chosen route (the ready pass's "Cards"). */
  cards?: number;
}

export interface FillInPassProps {
  stage: PassStage;
  values: FillInPassValues;
  /** The field being chosen now: its dashes and label switch to ink. */
  now?: PassFieldName;
  /** False when the deck has no sections: the section then is not a way back (there is no section step). */
  sectionChoosable?: boolean;
  /** A filled field was pressed: go back to its step. */
  onJump: (field: PassFieldName) => void;
  /**
   * The field whose value is hidden while a copy of it travels in from its card. It is hidden with opacity,
   * not visibility: Safari does not repaint a value whose visibility comes back inside the moving pass, so
   * the landed value stayed blank on screen until the next step.
   */
  travelling?: PassFieldName;
  /** Ready stage only: grow down to the height of the game ticket, then call onUnrolled. */
  unroll?: boolean;
  onUnrolled?: () => void;
  className?: string;
}

const CHANGE_WORD: Record<PassFieldName, string> = {
  area: "area",
  platform: "platform",
  deck: "deck",
  section: "section",
  mode: "class",
};

/** "Change deck, now CLF": the accessible name of a field that returns to its step. */
export function changeLabel(field: PassFieldName, value: string): string {
  return `Change ${CHANGE_WORD[field]}, now ${value}`;
}

const FIELD_LABEL =
  "font-(family-name:--type-field-label-family) text-(length:--type-field-label-size) font-(--type-field-label-weight) " +
  "leading-(--type-field-label-line-height) tracking-(--type-field-label-letter-spacing)";
const PASS_VALUE =
  "inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap align-top font-(family-name:--type-field-value-pass-family) " +
  "text-(length:--type-field-value-pass-size) font-(--type-field-value-pass-weight) leading-(--type-field-value-pass-line-height) " +
  "tracking-(--type-field-value-pass-letter-spacing)";
const PASS_CODE =
  "inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap align-top font-(family-name:--font-mono) text-(length:--type-field-value-pass-size) " +
  "font-(--font-weight-mono-semibold) leading-(--type-field-value-pass-line-height) tracking-[0.02em]";
const WAY_BACK =
  "absolute inset-0 cursor-pointer rounded-[6px] active:bg-(--color-press) focus-visible:outline-offset-[-2px]";
const LEG_CODE =
  "block font-(family-name:--type-leg-code-family) text-(length:--type-leg-code-size) font-(--type-leg-code-weight) " +
  "leading-(--type-leg-code-line-height) tracking-(--type-leg-code-letter-spacing)";
const LEG_NAME =
  "mt-(--space-6) block font-(family-name:--type-leg-name-family) text-(length:--type-leg-name-size) font-(--type-leg-name-weight) " +
  "leading-(--type-leg-name-line-height) tracking-(--type-leg-name-letter-spacing) text-(--color-ink-muted)";
const TICKET_VALUE =
  "m-0 mt-(--space-2) whitespace-nowrap font-(family-name:--type-field-value-family) text-(length:--type-field-value-size) " +
  "font-(--type-field-value-weight) leading-(--type-field-value-line-height) tracking-(--type-field-value-letter-spacing)";

function CompactBand() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full items-center gap-(--space-8) bg-(--color-accent) px-(--space-14) text-(--color-on-accent)"
    >
      <span className="grid h-[16px] w-[22px] flex-none place-items-center">
        <LogoMark width={20} variant="compact" />
      </span>
      <span className="font-(family-name:--type-carrier-title-family) text-[14px] font-(--type-carrier-title-weight) leading-(--type-carrier-title-line-height) tracking-(--type-carrier-title-letter-spacing)">
        Truthy
      </span>
      <span className="ml-auto font-(family-name:--type-carrier-label-family) text-[11px] font-(--type-carrier-label-weight) leading-(--type-carrier-label-line-height) tracking-[0.06em]">
        YOUR PASS
      </span>
    </div>
  );
}

function TicketBand() {
  return (
    <div aria-hidden="true" className="flex h-full items-center gap-(--space-10) bg-(--color-accent) px-(--space-16) text-(--color-on-accent)">
      <CloudIcon />
      <span className="font-(family-name:--type-carrier-title-family) text-(length:--type-carrier-title-size) font-(--type-carrier-title-weight) leading-(--type-carrier-title-line-height) tracking-(--type-carrier-title-letter-spacing)">
        Truthy
      </span>
      <span className="ml-auto font-(family-name:--type-carrier-label-family) text-(length:--type-carrier-label-size) font-(--type-carrier-label-weight) leading-(--type-carrier-label-line-height) tracking-(--type-carrier-label-letter-spacing)">
        BOARDING PASS
      </span>
    </div>
  );
}

/** Dashes leave as a name heads for their field (100, delay 120) and come back on the way back (140, delay 220). */
const DASHES_OUT = { opacity: 0, transition: { duration: 0.1, delay: 0.12, ease: EASE_OUT } };
const DASHES_IN = { opacity: 1, transition: { duration: 0.14, delay: 0.22, ease: EASE } };

/** Three dashes in a 20 tall box: a field not chosen yet. */
function Blank({ now, reduced }: { now: boolean; reduced: boolean }) {
  // Leaving dashes are only a picture: the field already says its value, so they no longer say "not chosen".
  const present = useIsPresent();
  return (
    <motion.span
      data-pass-blank=""
      className="flex h-(--space-20) items-center gap-[5px] [grid-area:1/1]"
      initial={reduced ? false : { opacity: 0 }}
      animate={DASHES_IN}
      exit={reduced ? undefined : DASHES_OUT}
    >
      {present ? <span className="sr-only">not chosen</span> : null}
      {[0, 1, 2].map((i) => (
        <i
          key={i}
          aria-hidden="true"
          className={`block h-[3px] w-[14px] rounded-(--radius-tick) ${now ? "bg-(--color-ink)" : "bg-(--color-rule)"}`}
        />
      ))}
    </motion.span>
  );
}

interface FieldProps {
  field: PassFieldName;
  label: string;
  /** The value as shown, or undefined when the field is blank. */
  value: string | undefined;
  code?: boolean;
  now: boolean;
  first?: boolean;
  /** Whether a filled value returns to its step. */
  choosable?: boolean;
  hidden?: boolean;
  onJump: (field: PassFieldName) => void;
}

/** One cell of the destination or route grid: label, then the value or the blank. */
function Field({ field, label, value, code = false, now, first = false, choosable = true, hidden = false, onJump }: FieldProps) {
  const filled = value !== undefined;
  const reduced = useReducedMotion() ?? false;
  return (
    <div
      data-field={field}
      data-now={now ? "" : undefined}
      className={[
        "relative min-w-0 pt-[9px] pb-[11px]",
        first ? "" : "border-l-(length:--stroke-rule) border-(--color-rule) pl-(--space-12)",
      ].join(" ")}
    >
      <dt className={`${FIELD_LABEL} ${now ? "font-(--font-weight-mono-semibold) text-(--color-ink)" : "text-(--color-ink-muted)"}`}>
        {label}
      </dt>
      {/* A div in a list of terms holds only its term and value, so the way back is inside the value. The value
          is not positioned, so the way back covers the whole field (review U69). The value and the dashes share
          one grid cell: leaving dashes fade out under the value that replaces them. Dashes already there when
          the field first shows do not fade in; the block they are on does. */}
      <dd className="m-0 mt-[3px] grid h-(--space-20) grid-cols-[minmax(0,1fr)]">
        <AnimatePresence initial={false}>{filled ? null : <Blank key="blank" now={now} reduced={reduced} />}</AnimatePresence>
        {filled ? (
          <span
            data-pass-value={field}
            className={`${code ? PASS_CODE : PASS_VALUE} justify-self-start [grid-area:1/1]`}
            style={hidden ? { opacity: 0 } : undefined}
          >
            {value}
          </span>
        ) : null}
        {filled && !now && choosable ? (
          <button type="button" aria-label={changeLabel(field, value)} className={WAY_BACK} onClick={() => onJump(field)} />
        ) : null}
      </dd>
    </div>
  );
}

/**
 * A word on the quiet line of the route pass ("Cloud", "AWS"): 22 tall, its hit area 48 by 48 at least. The
 * line is 30 tall and the Deck / Section / Class row starts right under the word, so the hit area reaches 13
 * up and 13 down, over the top of the 56 tall fields, and it paints above them: a tap just under a word is the
 * word's, and under the words a field keeps 43 of its 56. It grows to the right to be 48 wide: on the left
 * lies the other word.
 */
function LineWord({ field, value, hidden, onJump }: { field: PassFieldName; value: string; hidden: boolean; onJump: (field: PassFieldName) => void }) {
  return (
    <button
      type="button"
      aria-label={changeLabel(field, value)}
      onClick={() => onJump(field)}
      className={[
        "relative z-[1] h-[22px] cursor-pointer rounded-[6px] px-(--space-6) whitespace-nowrap text-(--color-ink-muted)",
        "font-(family-name:--type-pass-line-family) text-(length:--type-pass-line-size) font-(--type-pass-line-weight)",
        "after:absolute after:inset-y-[-13px] after:left-[-2px] after:w-[max(100%+4px,48px)] after:content-['']",
        "active:bg-(--color-press) focus-visible:outline-offset-[-2px]",
      ].join(" ")}
    >
      <span data-pass-value={field} className="inline-block pt-px leading-[22px]" style={hidden ? { opacity: 0 } : undefined}>
        {value}
      </span>
    </button>
  );
}

/** A leg of the ready pass (deck or section): code over name, a way back to its step. */
function Leg({ field, code, name, align, choosable, onJump }: { field: PassFieldName; code: string; name: string; align: "left" | "right"; choosable: boolean; onJump: (field: PassFieldName) => void }) {
  const content = (
    <>
      <span data-pass-value={field} className={LEG_CODE}>
        {code}
      </span>
      <span className={LEG_NAME}>{name}</span>
    </>
  );
  const className = `block min-w-0 rounded-(--radius-small) ${align === "right" ? "text-right" : "text-left"}`;
  if (!choosable) {
    return (
      <div data-leg={field} className={className}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      data-leg={field}
      aria-label={changeLabel(field, code === "ALL" ? name : code)}
      onClick={() => onJump(field)}
      className={`${className} cursor-pointer active:bg-(--color-press)`}
    >
      {content}
    </button>
  );
}

function ReadyBody({ values, sectionChoosable, onJump }: { values: FillInPassValues; sectionChoosable: boolean; onJump: (field: PassFieldName) => void }) {
  const cells: { label: string; value: ReactNode; field?: PassFieldName; text?: string }[] = [
    { label: "Class", value: <span data-pass-value="mode">{values.mode}</span>, field: "mode", text: values.mode },
    { label: "Cards", value: values.cards },
    {
      label: "Gate",
      value: (
        <>
          <span aria-hidden="true">F ← → T</span>
          <span className="sr-only">False left, true right</span>
        </>
      ),
    },
  ];
  return (
    <>
      <div className="grid grid-cols-[1fr_40px_1fr] items-start gap-(--space-8) px-(--size-ticket-inset) pt-(--space-14) pb-(--space-12)">
        <Leg field="deck" code={values.deck?.code ?? ""} name={values.deck?.name ?? ""} align="left" choosable onJump={onJump} />
        <span aria-hidden="true" />
        <Leg
          field="section"
          code={values.section?.code ?? ""}
          name={values.section?.name ?? ""}
          align="right"
          choosable={sectionChoosable}
          onJump={onJump}
        />
      </div>
      <dl className={`mx-(--size-ticket-inset) my-0 grid ${FIELD_COLUMNS} border-y-(length:--stroke-rule) border-(--color-rule)`}>
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={["relative pt-(--space-8) pb-[7px]", i > 0 ? "border-l-(length:--stroke-rule) border-(--color-rule) pl-(--space-12)" : ""].join(" ")}
          >
            <dt className={`${FIELD_LABEL} text-(--color-ink-muted)`}>{cell.label}</dt>
            <dd className={TICKET_VALUE}>
              {cell.value}
              {cell.field && cell.text ? (
                <button type="button" aria-label={changeLabel(cell.field, cell.text)} className={WAY_BACK} onClick={() => onJump("mode")} />
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      <div className="h-(--space-18)" />
    </>
  );
}

/** The paper the ready pass unrolls into: as tall as the rest of a game ticket (statement and stub, minus the 18 pad). */
const UNROLL: CSSProperties = {
  top: "calc(100% - var(--radius-card))",
  height: "calc(var(--size-statement-min) + var(--size-lower) - var(--space-18) + var(--radius-card))",
};

interface BlockProps {
  stage: PassStage;
  values: FillInPassValues;
  now?: PassFieldName;
  sectionChoosable: boolean;
  onJump: (field: PassFieldName) => void;
  travelling?: PassFieldName;
}

/** What the paper holds under its band in one layout. */
function PassBlock({ stage, values, now, sectionChoosable, onJump, travelling }: BlockProps) {
  const hide = (field: PassFieldName) => travelling === field;
  const sectionText = values.section ? (values.section.whole ? values.section.name : values.section.code) : undefined;
  if (stage === "ready") return <ReadyBody values={values} sectionChoosable={sectionChoosable} onJump={onJump} />;
  if (stage === "destination") {
    // The platform column takes a tenth of the area column's share (the browse-c mockup has 1 / 1.35 / 0.8):
    // at 320 px "Web platform" and "Google Cloud" then fit whole, and "Frontend" still fits its column.
    return (
      <dl className="m-0 grid grid-cols-[0.9fr_1.45fr_0.8fr] px-(--space-16)">
        <Field field="area" label="Area" value={values.area} now={now === "area"} first hidden={hide("area")} onJump={onJump} />
        <Field field="platform" label="Platform" value={values.platform} now={now === "platform"} hidden={hide("platform")} onJump={onJump} />
        <Field field="deck" label="Deck" value={values.deck?.code} code now={now === "deck"} hidden={hide("deck")} onJump={onJump} />
      </dl>
    );
  }
  return (
    <>
      <div className="flex h-(--size-pass-line) items-center gap-(--space-2) px-(--space-10) pt-(--space-8)">
        {values.area ? <LineWord field="area" value={values.area} hidden={hide("area")} onJump={onJump} /> : null}
        <span aria-hidden="true" className="font-(family-name:--type-pass-line-family) text-(length:--type-pass-line-size) font-(--type-pass-line-weight) text-(--color-rule)">
          ·
        </span>
        {values.platform ? <LineWord field="platform" value={values.platform} hidden={hide("platform")} onJump={onJump} /> : null}
      </div>
      {/* Deck, Section and Class are short (a code, "Whole deck", "Three lives"): each column is at least as
          wide as its value, so none is cut, as "Whole deck" was at 320 px (review finding U33). */}
      <dl className="m-0 grid grid-cols-[minmax(max-content,0.75fr)_minmax(max-content,1.1fr)_minmax(max-content,1.15fr)] px-(--space-16)">
        <Field field="deck" label="Deck" value={values.deck?.code} code now={now === "deck"} first hidden={hide("deck")} onJump={onJump} />
        <Field
          field="section"
          label="Section"
          value={sectionText}
          code={values.section ? !values.section.whole : false}
          now={now === "section"}
          choosable={sectionChoosable}
          hidden={hide("section")}
          onJump={onJump}
        />
        <Field field="mode" label="Class" value={values.mode} now={now === "mode"} hidden={hide("mode")} onJump={onJump} />
      </dl>
    </>
  );
}

/** The new block fades in after a short wait (220, delay 90); the old one fades out (120, ease-out). */
const BLOCK_IN = { opacity: 1, transition: { duration: 0.22, delay: 0.09, ease: EASE } };
const BLOCK_OUT = { opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } };
/** Reduced motion: the start flow's cross-fade, the old block out in 100, the new one in over 140 after 90. */
const BLOCK_IN_REDUCED = { opacity: 1, transition: { duration: 0.14, delay: 0.09 } };
const BLOCK_OUT_REDUCED = { opacity: 0, transition: { duration: 0.1 } };
/** How long the paper takes to change shape (--duration-t3). */
const MORPH_MS = 360;

export function FillInPass({
  stage,
  values,
  now,
  sectionChoosable = true,
  onJump,
  travelling,
  unroll = false,
  onUnrolled,
  className,
}: FillInPassProps) {
  const ready = stage === "ready";
  const reduced = useReducedMotion() ?? false;
  const bodyRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const leavingRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Read when a layout change starts, so a name still travelling in from its card is left to its own copy.
  const travellingRef = useRef(travelling);
  travellingRef.current = travelling;
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const bandRef = useRef<HTMLDivElement>(null);

  // The block a change of layout leaves: a copy of it, as it was, fades out over the new one. It is out of the
  // reading order and takes no presses (inert), and lies after the new block, so the new values come first.
  const [leaving, setLeaving] = useState<(BlockProps & { id: number }) | null>(null);
  const shown = useRef<BlockProps>({ stage, values, now, sectionChoosable, onJump });
  const changes = useRef(0);
  useLayoutEffect(() => {
    const before = shown.current;
    shown.current = { stage, values, now, sectionChoosable, onJump };
    if (before.stage === stage) return;
    changes.current += 1;
    setLeaving({ ...before, travelling: undefined, onJump: () => {}, id: changes.current });
  }, [stage, values, now, sectionChoosable, onJump]);

  // The first block is there at once (the pass itself arrives with the top zone); a block that replaces
  // another fades in.
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
  }, []);

  // The body goes from the old block's height to the new one's, then back to its own height, so a later change
  // inside a layout (a name that wraps after a turn of the phone) is never cut. It clips only while it moves:
  // at rest the quiet line's words reach a little above it. The move outlasts the fading copy it is measured
  // from, so its end is a timer of its own. With reduced motion nothing moves: the body takes the new block's
  // height at once (the old block lies over it, clipped by the paper) and no value travels.
  const morphEnd = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const endTravel = useRef<() => void>(() => {});
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const leavingId = leaving?.id;
  useLayoutEffect(() => {
    if (reducedRef.current) return;
    const body = bodyRef.current;
    const root = rootRef.current;
    const leavingBlock = leavingRef.current;
    const block = blockRef.current;
    // The values on both layouts travel to their new places (./passValueTravel.ts). The travel outlasts the
    // fading copy of the old block, so only a new change of layout ends it early.
    if (leavingId !== undefined && root && leavingBlock && block) {
      endTravel.current();
      const band = bandRef.current;
      const bandTo = band ? parseFloat(getComputedStyle(band).getPropertyValue(stageRef.current === "ready" ? "--size-carrier" : "--size-carrier-compact")) : NaN;
      const shift = band && Number.isFinite(bandTo) ? bandTo - band.getBoundingClientRect().height : 0;
      endTravel.current = travelPassValues(root, leavingBlock, block, shift, travellingRef.current);
    }
    const from = leavingBlock?.getBoundingClientRect().height;
    const to = block?.getBoundingClientRect().height;
    if (leavingId === undefined || !body || from === undefined || to === undefined || from === to) return;
    clearTimeout(morphEnd.current);
    body.style.overflow = "hidden";
    body.style.height = `${from}px`;
    void body.offsetHeight; // the old height is where the transition starts
    body.style.height = `${to}px`;
    morphEnd.current = setTimeout(() => {
      body.style.removeProperty("height");
      body.style.removeProperty("overflow");
    }, MORPH_MS + 60);
  }, [leavingId]);
  useLayoutEffect(
    () => () => {
      clearTimeout(morphEnd.current);
      endTravel.current();
    },
    [],
  );

  return (
    <div ref={rootRef} data-fill-in-pass={stage} className={["relative isolate", className].filter(Boolean).join(" ")}>
      <div
        className={[
          "relative overflow-hidden rounded-(--radius-card) bg-(--color-surface-raised) text-(--color-ink)",
          // While unrolling, the paper below carries the shadow, so none falls across the join.
          ready ? (unroll ? "" : "shadow-(--elevation-ticket)") : "shadow-(--elevation-small)",
        ].join(" ")}
      >
        {/* The band grows from 30 to 44 with the paper (no CSS transition runs under reduced motion). */}
        <div
          ref={bandRef}
          data-pass-band=""
          className={`overflow-hidden transition-[height] duration-(--duration-t3) ease-(--easing-ease) ${ready ? "h-(--size-carrier)" : "h-(--size-carrier-compact)"}`}
        >
          {ready ? <TicketBand /> : <CompactBand />}
        </div>
        <div ref={bodyRef} data-pass-body="" aria-live="polite" className="relative transition-[height] duration-(--duration-t3) ease-(--easing-ease)">
          <motion.div
            key={stage}
            ref={blockRef}
            data-pass-block={stage}
            initial={mounted.current ? { opacity: 0 } : false}
            animate={reduced ? BLOCK_IN_REDUCED : BLOCK_IN}
          >
            <PassBlock stage={stage} values={values} now={now} sectionChoosable={sectionChoosable} onJump={onJump} travelling={travelling} />
          </motion.div>
          {leaving ? (
            <motion.div
              key={`leaving-${leaving.id}`}
              ref={leavingRef}
              data-pass-block={leaving.stage}
              data-leaving=""
              aria-hidden="true"
              inert
              className="pointer-events-none absolute inset-x-0 top-0"
              initial={{ opacity: 1 }}
              animate={reduced ? BLOCK_OUT_REDUCED : BLOCK_OUT}
              onAnimationComplete={() => setLeaving((current) => (current?.id === leaving.id ? null : current))}
            >
              <PassBlock {...leaving} />
            </motion.div>
          ) : null}
        </div>
      </div>
      {ready && unroll ? (
        <motion.div
          aria-hidden="true"
          data-unroll=""
          className="absolute inset-x-0 -z-10 origin-top rounded-b-(--radius-card) bg-(--color-surface-raised) shadow-(--elevation-ticket)"
          style={UNROLL}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.36, ease: EASE }}
          onAnimationComplete={onUnrolled}
        />
      ) : null}
    </div>
  );
}
