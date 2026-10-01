// Inline line icons of the approved screens. Path data is copied from design/flow/screens (do not redraw).
// Every icon draws with currentColor, so the control around it sets its colour. Icons are hidden from
// screen readers unless a label is given: the control's own label carries the meaning.
import type { ReactNode } from "react";

// Raw path data, for components that draw these shapes inside their own SVG (flight path, ticket, sky).
export const ICON_PATHS = {
  cross: "M3 3l10 10M13 3L3 13",
  check: "M3 9.5l4 4 8-9",
  backHeader: "M16 8H3M8 2.5L2.5 8 8 13.5",
  backPill: "M15 9H4M8.5 4L3.5 9l5 5",
  forward: "M1 8h36M30 2l7 6-7 6",
  chevronRight: "M6 3l5 5-5 5",
  chevronDown: "M2 4l4 4 4-4",
  planeArrow: "M-7 0h14M1-6l4 6-4 6M-6-3l2 3-2 3",
  carrierCloud: "M5 15h13a4 4 0 0 0 .6-8A6 6 0 0 0 7.2 5.5 4.8 4.8 0 0 0 5 15z",
  skyCloud:
    "M0 46h150c0-12-10-20-22-20-2-14-14-24-29-24-12 0-22 6-26 16-4-3-9-5-15-5-12 0-21 8-23 19C24 28 20 26 15 26 6 26 0 34 0 46z",
  book: "M3 3h5l1 1 1-1h5v12h-5l-1 1-1-1H3zM9 4v11",
  replay: "M3.5 9a5.5 5.5 0 1 0 1.8-4.1M3.5 2.5v3h3",
  routeCurve: "M5 10.5C10 10 10 4 15 3.5",
  clockHands: "M11 7.5V12l3 2M8.5 2h5",
  star: "M9 1.8l2.1 4.5 4.9.6-3.6 3.4.9 4.9L9 12.8l-4.3 2.4.9-4.9L2 6.9l4.9-.6z",
  heart:
    "M0 6.2C-1.5 4.3-3 3.2-5.1 3.2c-3.7 0-5.9 3.9-4.5 7.3C-7.5 15.1 0 19.7 0 19.7s7.5-4.6 9.6-9.2c1.4-3.4-.8-7.3-4.5-7.3C3 3.2 1.5 4.3 0 6.2z",
  heartSlash: "M-8 18L8 3",
} as const;

export interface IconProps {
  /** Width in px. The height follows the icon's own proportions. */
  size?: number;
  /** Stroke width in viewBox units. Each icon defaults to the value of the approved screens. */
  strokeWidth?: number;
  className?: string;
  /** Gives the icon an accessible name (role img). Without it the icon is aria-hidden. */
  label?: string;
}

interface SvgProps {
  width: number;
  height: number;
  viewBox: string;
  className: string | undefined;
  label: string | undefined;
  children: ReactNode;
}

function Svg({ width, height, viewBox, className, label, children }: SvgProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg width={width} height={height} viewBox={viewBox} className={className} focusable="false" {...a11y}>
      {children}
    </svg>
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

const strokeProps = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** X for leaving or closing (header round button). 16, stroke 2.4. */
export function CloseIcon({ size = 16, strokeWidth = 2.4, className, label }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" className={className} label={label}>
      <path d={ICON_PATHS.cross} {...strokeProps} strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** X for False and Not quite (heavier stroke). 16, stroke 3. */
export function CrossIcon({ size = 16, strokeWidth = 3, className, label }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" className={className} label={label}>
      <path d={ICON_PATHS.cross} {...strokeProps} strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** Check for True and Correct. 18, stroke 3. */
export function CheckIcon({ size = 18, strokeWidth = 3, className, label }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" className={className} label={label}>
      <path d={ICON_PATHS.check} {...strokeProps} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export interface BackArrowIconProps extends IconProps {
  /** "header": in a round button (18 by 16, stroke 2.4). "pill": in the Back pill (18 by 18, stroke 2.2). */
  variant?: "header" | "pill";
}

/** Left arrow meaning back. */
export function BackArrowIcon({ size = 18, strokeWidth, variant = "header", className, label }: BackArrowIconProps) {
  if (variant === "pill") {
    return (
      <Svg width={size} height={size} viewBox="0 0 18 18" className={className} label={label}>
        <path d={ICON_PATHS.backPill} {...strokeProps} strokeWidth={strokeWidth ?? 2.2} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={round((size * 16) / 18)} viewBox="0 0 18 16" className={className} label={label}>
      <path d={ICON_PATHS.backHeader} {...strokeProps} strokeWidth={strokeWidth ?? 2.4} />
    </Svg>
  );
}

/** The long arrow between the legs of a pass ("CLF → SEC"). 40 by 16, stroke 2. */
export function ForwardArrowIcon({ size = 40, strokeWidth = 2, className, label }: IconProps) {
  return (
    <Svg width={size} height={round((size * 16) / 40)} viewBox="0 0 40 16" className={className} label={label}>
      <path d={ICON_PATHS.forward} {...strokeProps} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export interface ChevronIconProps extends IconProps {
  /** "right": cards and the continue line (16, stroke 2.2). "down": the Why disclosure (12, stroke 1.8). */
  direction?: "right" | "down";
}

export function ChevronIcon({ size, strokeWidth, direction = "right", className, label }: ChevronIconProps) {
  if (direction === "down") {
    const width = size ?? 12;
    return (
      <Svg width={width} height={width} viewBox="0 0 12 12" className={className} label={label}>
        <path d={ICON_PATHS.chevronDown} {...strokeProps} strokeWidth={strokeWidth ?? 1.8} />
      </Svg>
    );
  }
  const width = size ?? 16;
  return (
    <Svg width={width} height={width} viewBox="0 0 16 16" className={className} label={label}>
      <path d={ICON_PATHS.chevronRight} {...strokeProps} strokeWidth={strokeWidth ?? 2.2} />
    </Svg>
  );
}

/** The plane of the flight path: an amber disc with an arrow in on-accent. 24 (r12), stroke 2. */
export function PlaneIcon({ size = 24, strokeWidth = 2, className, label }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="-12 -12 24 24" className={className} label={label}>
      <circle r="12" className="fill-(--color-accent)" />
      <path
        d={ICON_PATHS.planeArrow}
        fill="none"
        className="stroke-(--color-on-accent)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The filled cloud glyph of the carrier band. 22 by 16. */
export function CloudIcon({ size = 22, className, label }: IconProps) {
  return (
    <Svg width={size} height={round((size * 16) / 22)} viewBox="0 0 22 16" className={className} label={label}>
      <path d={ICON_PATHS.carrierCloud} fill="currentColor" />
    </Svg>
  );
}

/** Book, in front of the source link. 18, stroke 1.6. */
export function BookIcon({ size = 18, strokeWidth = 1.6, className, label }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" className={className} label={label}>
      <path d={ICON_PATHS.book} fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** Replay, in front of "Play again". 18, stroke 2.2. */
export function ReplayIcon({ size = 18, strokeWidth = 2.2, className, label }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" className={className} label={label}>
      <path d={ICON_PATHS.replay} {...strokeProps} strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** Two stops joined by a dashed curve, in front of "Choose another route". 20 by 14, stroke 1.8. */
export function RouteIcon({ size = 20, strokeWidth = 1.8, className, label }: IconProps) {
  return (
    <Svg width={size} height={round((size * 14) / 20)} viewBox="0 0 20 14" className={className} label={label}>
      <circle cx="3" cy="11" r="2" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="17" cy="3" r="2" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
      <path d={ICON_PATHS.routeCurve} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray="2 3" />
    </Svg>
  );
}

/** Clock, on the Time is up stamp. 22, stroke 2.4. */
export function ClockIcon({ size = 22, strokeWidth = 2.4, className, label }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" className={className} label={label}>
      <circle cx="11" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
      <path d={ICON_PATHS.clockHands} {...strokeProps} strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** Filled five-point star, on the New best stamp. 18. */
export function StarIcon({ size = 18, className, label }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" className={className} label={label}>
      <path d={ICON_PATHS.star} fill="currentColor" />
    </Svg>
  );
}

export interface HeartIconProps extends IconProps {
  /** A lost life: the outline (stroke 1.6) with a slash instead of the filled heart. */
  lost?: boolean;
}

/** A life in Three lives. 20. The lost heart is drawn in currentColor too; the caller makes it ink-muted. */
export function HeartIcon({ size = 20, strokeWidth = 1.6, lost = false, className, label }: HeartIconProps) {
  return (
    <Svg width={size} height={size} viewBox="-11 0 22 22" className={className} label={label}>
      {lost ? (
        <>
          <path d={ICON_PATHS.heart} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
          <path d={ICON_PATHS.heartSlash} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
        </>
      ) : (
        <path d={ICON_PATHS.heart} fill="currentColor" />
      )}
    </Svg>
  );
}
