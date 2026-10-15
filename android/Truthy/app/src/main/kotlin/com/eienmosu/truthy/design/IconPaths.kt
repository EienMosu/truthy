package com.eienmosu.truthy.design

/**
 * ICON_PATHS of components/icons.tsx, unchanged (the design system says: copy them, do not redraw them).
 * The moon and the sun came later and are drawn in the same style. IconPathsTest compares every string with the web file.
 */
object IconPaths {
    const val CROSS = "M3 3l10 10M13 3L3 13"
    const val CHECK = "M3 9.5l4 4 8-9"
    const val BACK_HEADER = "M16 8H3M8 2.5L2.5 8 8 13.5"
    const val BACK_PILL = "M15 9H4M8.5 4L3.5 9l5 5"
    const val FORWARD = "M1 8h36M30 2l7 6-7 6"
    const val CHEVRON_RIGHT = "M6 3l5 5-5 5"
    const val CHEVRON_DOWN = "M2 4l4 4 4-4"
    const val PLANE_ARROW = "M-7 0h14M1-6l4 6-4 6M-6-3l2 3-2 3"
    const val CARRIER_CLOUD = "M5 15h13a4 4 0 0 0 .6-8A6 6 0 0 0 7.2 5.5 4.8 4.8 0 0 0 5 15z"
    const val SKY_CLOUD =
        "M0 46h150c0-12-10-20-22-20-2-14-14-24-29-24-12 0-22 6-26 16-4-3-9-5-15-5-12 0-21 8-23 19C24 28 20 26 15 26 6 26 0 34 0 46z"
    const val BOOK = "M3 3h5l1 1 1-1h5v12h-5l-1 1-1-1H3zM9 4v11"
    const val REPLAY = "M3.5 9a5.5 5.5 0 1 0 1.8-4.1M3.5 2.5v3h3"
    const val ROUTE_CURVE = "M5 10.5C10 10 10 4 15 3.5"
    const val CLOCK_HANDS = "M11 7.5V12l3 2M8.5 2h5"
    const val STAR = "M9 1.8l2.1 4.5 4.9.6-3.6 3.4.9 4.9L9 12.8l-4.3 2.4.9-4.9L2 6.9l4.9-.6z"
    const val HEART =
        "M0 6.2C-1.5 4.3-3 3.2-5.1 3.2c-3.7 0-5.9 3.9-4.5 7.3C-7.5 15.1 0 19.7 0 19.7s7.5-4.6 9.6-9.2c1.4-3.4-.8-7.3-4.5-7.3C3 3.2 1.5 4.3 0 6.2z"
    const val HEART_SLASH = "M-8 18L8 3"
    const val MOON = "M15.8 9.6A6.8 6.8 0 1 1 8.4 2.2a5.3 5.3 0 0 0 7.4 7.4z"
    const val SUN_RAYS =
        "M9 1.5v1.6M9 14.9v1.6M1.5 9h1.6M14.9 9h1.6M3.7 3.7l1.1 1.1M13.2 13.2l1.1 1.1M3.7 14.3l1.1-1.1M13.2 4.8l1.1-1.1"

    /** The same strings under the web's key names, in the web's order. */
    val BY_WEB_NAME: Map<String, String> = linkedMapOf(
        "cross" to CROSS,
        "check" to CHECK,
        "backHeader" to BACK_HEADER,
        "backPill" to BACK_PILL,
        "forward" to FORWARD,
        "chevronRight" to CHEVRON_RIGHT,
        "chevronDown" to CHEVRON_DOWN,
        "planeArrow" to PLANE_ARROW,
        "carrierCloud" to CARRIER_CLOUD,
        "skyCloud" to SKY_CLOUD,
        "book" to BOOK,
        "replay" to REPLAY,
        "routeCurve" to ROUTE_CURVE,
        "clockHands" to CLOCK_HANDS,
        "star" to STAR,
        "heart" to HEART,
        "heartSlash" to HEART_SLASH,
        "moon" to MOON,
        "sunRays" to SUN_RAYS,
    )
}

/**
 * A number for path data: rounded to 3 decimals, no trailing ".0", always a dot (Float.toString does not depend on
 * the locale, String.format would).
 */
internal fun pathNumber(value: Float): String {
    val rounded = Math.round(value * 1000f) / 1000f
    return if (rounded == Math.floor(rounded.toDouble()).toFloat()) rounded.toLong().toString() else rounded.toString()
}
