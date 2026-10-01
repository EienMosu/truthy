// The calm ground of every screen: the four sky colours blended from top to bottom, and two clouds
// (design system 5.1). A fixed layer behind everything, as wide and as tall as the viewport; the clouds
// stay inside the app frame. It ignores touches and is hidden from screen readers.
import { ICON_PATHS } from "./icons";

/** Top of the lower cloud in px: 620 on the game and result screens, 660 in the start flow (under its foot zone). */
export const LOWER_CLOUD_TOP = { game: 620, start: 660 } as const;
export type LowerCloud = keyof typeof LOWER_CLOUD_TOP;

export interface SkyBackdropProps {
  /** Where the lower cloud sits. Defaults to "game". */
  lowerCloud?: LowerCloud;
}

// Smooth on purpose: hard stops cut through text and cards and read as a rendering fault.
const SKY =
  "linear-gradient(180deg, var(--color-sky-1) 0%, var(--color-sky-2) 35%, var(--color-sky-3) 62%, var(--color-sky-4) 100%)";

export function SkyBackdrop({ lowerCloud = "game" }: SkyBackdropProps) {
  return (
    <div
      aria-hidden="true"
      data-sky-backdrop=""
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundImage: SKY }}
    >
      <div data-sky-frame="" className="relative mx-auto h-full w-full max-w-(--app-max-width)">
      <svg
        data-cloud="upper"
        className="absolute fill-(--color-cloud) opacity-(--opacity-cloud)"
        style={{ left: -30, top: 196 }}
        width="150"
        height="46"
        viewBox="0 0 150 46"
        focusable="false"
      >
        <path d={ICON_PATHS.skyCloud} />
      </svg>
      <svg
        data-cloud="lower"
        className="absolute fill-(--color-cloud) opacity-(--opacity-cloud)"
        style={{ right: -40, top: LOWER_CLOUD_TOP[lowerCloud] }}
        width="170"
        height="50"
        viewBox="0 0 150 46"
        focusable="false"
      >
        <path d={ICON_PATHS.skyCloud} />
      </svg>
      </div>
    </div>
  );
}
