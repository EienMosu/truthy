package com.eienmosu.truthy.round

/**
 * The numbers of the leave sheet, the round's back gesture and the result that live in the web's code or in the
 * spec rather than in tokens.json. Composables read them from here; LeaveResultTextTest pins each to its source.
 */
object LeaveResultConstants {
    /** Spec 5.2: back on the round shrinks the surface from scale 1 to 0.94 with the gesture's progress. */
    const val ROUND_BACK_MIN_SCALE = 0.94f

    /** components/easing.ts STAMP_LANDING and STAMP_REST: the New best stamp lands from scale 1.9 at -14 degrees to 1 at -6. */
    const val STAMP_LANDING_SCALE = 1.9f
    const val STAMP_LANDING_ROTATION = -14f
    const val STAMP_REST_ROTATION = -6f

    /** components/BoardingPass.tsx JOLT: the ticket moves y 0, 2, 0 at the times 0, 0.4 and 1 of its duration. */
    const val JOLT_DISTANCE_DP = 2f
    const val JOLT_PEAK_AT = 0.4f

    /** components/MissedCards.tsx: an opened Why scrolls into view after 380 ms (50 with reduced motion), 16 clear of the foot. */
    const val WHY_SCROLL_DELAY_MS = 380L
    const val WHY_SCROLL_DELAY_REDUCED_MS = 50L
    const val WHY_SCROLL_CLEARANCE_DP = 16f

    /** components/BoardingPass.tsx shortLegs: the leg names hide at a window height of 600 or less. */
    const val SHORT_LEGS_MAX_HEIGHT_DP = 600f

    /** components/FlightPath.tsx CompletedMarks: the stroke of the Streak ring, in the 276 by 34 drawing's units. */
    const val RING_STROKE = 1.4f
}
