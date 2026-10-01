// The 48 px round button of the headers (design system 5.5): leave a round, close results, go back.
// It holds only an icon, so the accessible label is required.
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface RoundButtonProps extends Omit<ComponentPropsWithRef<"button">, "children" | "aria-label"> {
  /** Accessible name, for example "Leave round" or "Close results". */
  label: string;
  /** The icon, for example <CloseIcon /> or <BackArrowIcon />. */
  children: ReactNode;
  /** "raised" (default): paper with a small shadow, on the sky. "sunk": sunk paper with no shadow, on a paper surface. */
  variant?: "raised" | "sunk";
}

const BASE =
  "grid size-(--size-round-button) flex-none cursor-pointer place-items-center rounded-full text-(--color-ink) " +
  "transition-transform duration-(--duration-t1) ease-(--easing-ease) active:scale-[0.92] " +
  "disabled:cursor-default disabled:opacity-(--opacity-disabled)";

const VARIANTS = {
  raised: "bg-(--color-surface-raised) shadow-(--elevation-small)",
  sunk: "bg-(--color-surface-sunk)",
} as const;

export function RoundButton({ label, children, variant = "raised", className, type = "button", ...rest }: RoundButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      data-variant={variant}
      className={[BASE, VARIANTS[variant], className].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}
