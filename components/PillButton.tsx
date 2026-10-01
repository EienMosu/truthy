// The 60 px pill (design system 5.7 and 5.8): "Next card →", "See results →", "Start round →",
// "Play again", and in the "true" and "false" tones the answer buttons.
import type { ComponentPropsWithRef, ReactNode } from "react";

export type PillTone = "ink" | "true" | "false";

export interface PillButtonProps extends Omit<ComponentPropsWithRef<"button">, "children"> {
  /** The label. It is the button's accessible name. */
  children: ReactNode;
  /** Shown before the label, hidden from screen readers (for example <ReplayIcon />). */
  leadingIcon?: ReactNode;
  /** Shown after the label, hidden from screen readers (for example "→"). */
  trailingIcon?: ReactNode;
  /** Fill colour: "ink" (default, the primary pill), "true" or "false" (the answer buttons). */
  tone?: PillTone;
}

const BASE =
  "flex h-(--size-pill) w-full cursor-pointer items-center justify-center gap-(--space-10) rounded-(--radius-pill) " +
  "text-(--color-on-dark) shadow-(--elevation-button) " +
  "font-(family-name:--type-button-family) text-(length:--type-button-size) font-(--type-button-weight) " +
  "leading-(--type-button-line-height) tracking-(--type-button-letter-spacing) " +
  "transition-[translate,scale,box-shadow] duration-(--duration-t1) ease-(--easing-ease) " +
  "active:translate-y-(--space-2) active:scale-[0.98] active:shadow-(--elevation-press) " +
  "disabled:cursor-default disabled:opacity-(--opacity-disabled) disabled:shadow-none " +
  "aria-disabled:pointer-events-none aria-disabled:opacity-(--opacity-disabled) aria-disabled:shadow-none";

const TONES: Record<PillTone, string> = {
  ink: "bg-(--color-ink)",
  true: "bg-(--color-true)",
  false: "bg-(--color-false)",
};

export function PillButton({
  children,
  leadingIcon,
  trailingIcon,
  tone = "ink",
  className,
  type = "button",
  onClick,
  ...rest
}: PillButtonProps) {
  // aria-disabled keeps the pill focusable (it does not lose focus mid-round) but it takes no presses: the
  // pointer cannot reach it (pointer-events) and Enter or Space do nothing either.
  const disabled = rest["aria-disabled"] === true || rest["aria-disabled"] === "true";
  return (
    <button
      {...rest}
      onClick={(event) => {
        if (disabled) return;
        onClick?.(event);
      }}
      type={type}
      data-tone={tone}
      className={[BASE, TONES[tone], className].filter(Boolean).join(" ")}
    >
      {leadingIcon === undefined ? null : (
        <span aria-hidden="true" className="flex flex-none">
          {leadingIcon}
        </span>
      )}
      {children}
      {trailingIcon === undefined ? null : (
        <span aria-hidden="true" className="flex flex-none">
          {trailingIcon}
        </span>
      )}
    </button>
  );
}
