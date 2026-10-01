// The quiet 48 px text button under the primary pill (design system 5.9): "Choose another route".
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface QuietButtonProps extends Omit<ComponentPropsWithRef<"button">, "children"> {
  /** The label. It is the button's accessible name. */
  children: ReactNode;
  /** Shown before the label, hidden from screen readers (for example <RouteIcon />). */
  leadingIcon?: ReactNode;
}

const BASE =
  "flex h-(--size-pill-small) w-full cursor-pointer items-center justify-center gap-(--space-8) rounded-(--radius-pill-small) " +
  "text-(--color-ink) font-(family-name:--type-button-quiet-family) text-(length:--type-button-quiet-size) " +
  "font-(--type-button-quiet-weight) leading-(--type-button-quiet-line-height) tracking-(--type-button-quiet-letter-spacing) " +
  "transition-transform duration-(--duration-t1) ease-(--easing-ease) active:scale-[0.98] " +
  "disabled:cursor-default disabled:opacity-(--opacity-disabled)";

export function QuietButton({ children, leadingIcon, className, type = "button", ...rest }: QuietButtonProps) {
  return (
    <button {...rest} type={type} className={[BASE, className].filter(Boolean).join(" ")}>
      {leadingIcon === undefined ? null : (
        <span aria-hidden="true" className="flex flex-none">
          {leadingIcon}
        </span>
      )}
      {children}
    </button>
  );
}
