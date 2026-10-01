// The calm ground of every screen: four hard-stop sky bands and two clouds (design system 5.1).
// A fixed layer behind the app frame, as wide as the frame and as tall as the viewport. It ignores touches
// and is hidden from screen readers.
import { ICON_PATHS } from "./icons";

/** Top of the lower cloud in px: 620 on the game and result screens, 660 in the start flow (under its foot zone). */
export const LOWER_CLOUD_TOP = { game: 620, start: 660 } as const;
export type LowerCloud = keyof typeof LOWER_CLOUD_TOP;

export interface SkyBackdropProps {
  /** Where the lower cloud sits. Defaults to "game". */
  lowerCloud?: LowerCloud;
}

const SKY_BANDS =
  "linear-gradient(180deg, var(--color-sky-1) 0 22%, var(--color-sky-2) 22% 48%, var(--color-sky-3) 48% 76%, var(--color-sky-4) 76% 100%)";

export function SkyBackdrop({ lowerCloud = "game" }: SkyBackdropProps) {
  return (
    <div
      aria-hidden="true"
      data-sky-backdrop=""
      className="pointer-events-none fixed inset-0 -z-10 mx-auto w-full max-w-(--app-max-width) overflow-hidden"
      style={{ backgroundImage: SKY_BANDS }}
    >
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
  );
}
