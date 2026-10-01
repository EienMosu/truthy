"use client";

// The fill-in pass of the start flow (design system 5.4): what the player has chosen so far, written onto
// one pass that becomes the round's boarding pass. Three layouts in step 1 of the game:
//   "destination" (steps 2 and 3): compact band, then Area / Platform / Deck.
//   "route" (steps 4 and 5): area and platform fold into one quiet line over Deck / Section / Class.
//   "ready" (step 6): the full boarding pass without its lower part (legs, Class / Cards / Gate).
// Every filled field is a way back to its step. With `unroll`, the ready pass grows down to the height of
// the game ticket (the hand-off to /play, which shows its ticket in the same place).
import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { LogoMark } from "./Logo";
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

const EASE = [0.2, 0.7, 0.2, 1] as const;

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
      className="flex h-(--size-carrier-compact) items-center gap-(--space-8) bg-(--color-accent) px-(--space-14) text-(--color-on-accent)"
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
    <div aria-hidden="true" className="flex h-(--size-carrier) items-center gap-(--space-10) bg-(--color-accent) px-(--space-16) text-(--color-on-accent)">
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

/** Three dashes in a 20 tall box: a field not chosen yet. */
function Blank({ now }: { now: boolean }) {
  return (
    <span className="absolute top-0 left-0 flex h-(--space-20) items-center gap-[5px]">
      <span className="sr-only">not chosen</span>
      {[0, 1, 2].map((i) => (
        <i
          key={i}
          aria-hidden="true"
          className={`block h-[3px] w-[14px] rounded-(--radius-tick) ${now ? "bg-(--color-ink)" : "bg-(--color-rule)"}`}
        />
      ))}
    </span>
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
      <dd className="relative m-0 mt-[3px] h-(--space-20)">
        {filled ? (
          <span data-pass-value={field} className={code ? PASS_CODE : PASS_VALUE} style={hidden ? { opacity: 0 } : undefined}>
            {value}
          </span>
        ) : (
          <Blank now={now} />
        )}
      </dd>
      {filled && !now && choosable ? (
        <button type="button" aria-label={changeLabel(field, value)} className={WAY_BACK} onClick={() => onJump(field)} />
      ) : null}
    </div>
  );
}

/** A word on the quiet line of the route pass ("Cloud", "AWS"): 22 tall, its hit area 48. */
function LineWord({ field, value, hidden, onJump }: { field: PassFieldName; value: string; hidden: boolean; onJump: (field: PassFieldName) => void }) {
  return (
    <button
      type="button"
      aria-label={changeLabel(field, value)}
      onClick={() => onJump(field)}
      className={[
        "relative h-[22px] cursor-pointer rounded-[6px] px-(--space-6) whitespace-nowrap text-(--color-ink-muted)",
        "font-(family-name:--type-pass-line-family) text-(length:--type-pass-line-size) font-(--type-pass-line-weight)",
        "after:absolute after:inset-x-[-2px] after:inset-y-[-13px] after:content-['']",
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
      <dl className="mx-(--size-ticket-inset) my-0 grid grid-cols-[1.1fr_1fr_1fr] border-y-(length:--stroke-rule) border-(--color-rule)">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={["relative pt-(--space-8) pb-[7px]", i > 0 ? "border-l-(length:--stroke-rule) border-(--color-rule) pl-(--space-12)" : ""].join(" ")}
          >
            <dt className={`${FIELD_LABEL} text-(--color-ink-muted)`}>{cell.label}</dt>
            <dd className={TICKET_VALUE}>{cell.value}</dd>
            {cell.field && cell.text ? (
              <button type="button" aria-label={changeLabel(cell.field, cell.text)} className={WAY_BACK} onClick={() => onJump("mode")} />
            ) : null}
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
  const hide = (field: PassFieldName) => travelling === field;
  const sectionText = values.section ? (values.section.whole ? values.section.name : values.section.code) : undefined;

  return (
    <div data-fill-in-pass={stage} className={["relative isolate", className].filter(Boolean).join(" ")}>
      <div
        className={[
          "relative overflow-hidden rounded-(--radius-card) bg-(--color-surface-raised) text-(--color-ink)",
          // While unrolling, the paper below carries the shadow, so none falls across the join.
          ready ? (unroll ? "" : "shadow-(--elevation-ticket)") : "shadow-(--elevation-small)",
        ].join(" ")}
      >
        {ready ? <TicketBand /> : <CompactBand />}
        <div aria-live="polite">
          {stage === "destination" ? (
            <dl className="m-0 grid grid-cols-[1fr_1.35fr_0.8fr] px-(--space-16)">
              <Field field="area" label="Area" value={values.area} now={now === "area"} first hidden={hide("area")} onJump={onJump} />
              <Field field="platform" label="Platform" value={values.platform} now={now === "platform"} hidden={hide("platform")} onJump={onJump} />
              <Field field="deck" label="Deck" value={values.deck?.code} code now={now === "deck"} hidden={hide("deck")} onJump={onJump} />
            </dl>
          ) : null}
          {stage === "route" ? (
            <>
              <div className="flex h-(--size-pass-line) items-center gap-(--space-2) px-(--space-10) pt-(--space-8)">
                {values.area ? <LineWord field="area" value={values.area} hidden={hide("area")} onJump={onJump} /> : null}
                <span aria-hidden="true" className="font-(family-name:--type-pass-line-family) text-(length:--type-pass-line-size) font-(--type-pass-line-weight) text-(--color-rule)">
                  ·
                </span>
                {values.platform ? <LineWord field="platform" value={values.platform} hidden={hide("platform")} onJump={onJump} /> : null}
              </div>
              <dl className="m-0 grid grid-cols-[0.75fr_1.1fr_1.15fr] px-(--space-16)">
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
          ) : null}
          {ready ? <ReadyBody values={values} sectionChoosable={sectionChoosable} onJump={onJump} /> : null}
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
