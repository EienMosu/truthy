// The curves of design/system/tokens.json "motion.easing", as Motion wants them (arrays, not CSS strings),
// and the two states of a stamp, so no component keeps its own copy.

/** --ease: the default decelerating curve. */
export const EASE = [0.2, 0.7, 0.2, 1] as const;
/** CSS ease-out: start-flow outgoing items. */
export const EASE_OUT = [0, 0, 0.58, 1] as const;
/** CSS ease-in: the opacity of the tearing stub. */
export const EASE_IN = [0.42, 0, 1, 1] as const;
/** The accelerating curve of the stub tear. */
export const FALL = [0.5, 0, 0.9, 0.4] as const;
/** --spring: overshoots about 10%. */
export const SPRING_EASE = [0.34, 1.56, 0.64, 1] as const;

/** A stamp at rest and where it lands from (design system 7, "Stamp lands"). */
export const STAMP_REST = { opacity: 1, scale: 1, rotate: -6 };
export const STAMP_LANDING = { opacity: 0, scale: 1.9, rotate: -14 };
