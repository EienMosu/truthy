import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SkyBackdrop } from "@/components/SkyBackdrop";
import { APP_NAME } from "@/src/meta";

// Any unknown address (a typo, /Play, a stale link). It renders inside the root layout, so the theme script, the
// fonts and the app frame apply, and it replaces Next's stock page, whose inline body style painted the page white
// or black by the system setting whatever theme the player had chosen, and which had no way back to the game.
export const metadata: Metadata = {
  title: `Page not found · ${APP_NAME}`,
};

// The primary pill of the design system (5.7) as a link: the same tokens as components/PillButton.tsx.
const PILL =
  "flex h-(--size-pill) w-full items-center justify-center gap-(--space-10) rounded-(--radius-pill) " +
  "bg-(--color-ink) text-(--color-on-dark) no-underline shadow-(--elevation-button) " +
  "font-(family-name:--type-button-family) text-(length:--type-button-size) font-(--type-button-weight) " +
  "leading-(--type-button-line-height) tracking-(--type-button-letter-spacing) " +
  "transition-[translate,scale,box-shadow] duration-(--duration-t1) ease-(--easing-ease) " +
  "active:translate-y-(--space-2) active:scale-[0.98] active:shadow-(--elevation-press)";

export default function NotFound() {
  return (
    <div data-not-found="" className="flex min-h-0 flex-1 flex-col">
      <SkyBackdrop lowerCloud="start" />
      <header className="pt-9">
        <Logo />
      </header>
      <main className="mt-(--space-24) flex flex-1 flex-col gap-(--space-14)">
        <h1
          className={
            "m-0 font-(family-name:--type-step-title-family) text-(length:--type-step-title-size) " +
            "font-(--type-step-title-weight) tracking-(--type-step-title-letter-spacing) text-(--color-ink)"
          }
        >
          Page not found
        </h1>
        <p
          className={
            "m-0 max-w-[300px] font-(family-name:--type-tagline-family) text-(length:--type-tagline-size) " +
            "font-(--type-tagline-weight) leading-(--type-tagline-line-height) text-(--color-ink)"
          }
        >
          There is no card at this address. Your progress is safe on this device.
        </p>
        {/* The page's one action, inside main so a screen reader that moves by landmarks reaches it, as the
            action row of /play is; mt-auto keeps it at the foot of the page. */}
        <Link href="/" className={`mt-auto ${PILL}`}>
          Back to start
          <span aria-hidden="true" className="flex flex-none">
            →
          </span>
        </Link>
      </main>
    </div>
  );
}
