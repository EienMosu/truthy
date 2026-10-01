// The Truthy logo (design system 5.17): an amber ticket with a tear line and a check, next to the wordmark.
import type { CSSProperties } from "react";
import { APP_NAME } from "@/src/meta";

const TICKET =
  "M6 0H38A6 6 0 0 1 44 6V10.5A4.5 4.5 0 0 0 44 19.5V24A6 6 0 0 1 38 30H6A6 6 0 0 1 0 24V19.5A4.5 4.5 0 0 0 0 10.5V6A6 6 0 0 1 6 0Z";
const TEAR = "M33 5v20";
const CHECK = "M9 15.5l4.5 4.5 9-10";

export interface LogoMarkProps {
  /** Width in px; the height keeps the 44 by 30 proportion. 44 next to the wordmark, 26 on the continue line, 20 on the compact pass band. */
  width?: number;
  /** "full": amber ticket, tear line and check in on-accent. "compact": on-accent ticket with an amber check and no tear line. */
  variant?: "full" | "compact";
  className?: string;
}

/** The ticket mark on its own. Always decorative (aria-hidden). */
export function LogoMark({ width = 44, variant = "full", className }: LogoMarkProps) {
  const height = Math.round(((width * 30) / 44) * 100) / 100;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 44 30"
      className={className}
      aria-hidden="true"
      focusable="false"
      data-variant={variant}
    >
      {variant === "full" ? (
        <>
          <path d={TICKET} className="fill-(--color-accent)" />
          <path d={TEAR} className="stroke-(--color-on-accent)" strokeWidth="1.6" strokeDasharray="2.5 3" strokeLinecap="round" />
          <path d={CHECK} fill="none" className="stroke-(--color-on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d={TICKET} className="fill-(--color-on-accent)" />
          <path d={CHECK} fill="none" className="stroke-(--color-accent)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

export interface LogoProps {
  /** The element to render. Start step 1 uses "h1": the page heading is then "Truthy". Defaults to "div". */
  as?: "h1" | "div";
  /** Font size of the wordmark in px. Defaults to the logo type role (36). The mark and the gap scale with it. */
  size?: number;
  className?: string;
}

/** The mark (44 by 30 at the default size), a 12 gap and "Truthy" in the logo type role. */
export function Logo({ as: Tag = "div", size, className }: LogoProps) {
  const style = size === undefined ? undefined : ({ fontSize: `${size}px` } satisfies CSSProperties);
  return (
    <Tag
      className={[
        "m-0 flex items-center gap-[0.3333em] text-(length:--type-logo-size) text-(--color-ink)",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <LogoMark className="h-[0.8333em] w-[1.2222em] flex-none" />
      <span className="pt-[0.1111em] font-(family-name:--type-logo-family) leading-(--type-logo-line-height) font-(--type-logo-weight) tracking-(--type-logo-letter-spacing)">
        {APP_NAME}
      </span>
    </Tag>
  );
}
