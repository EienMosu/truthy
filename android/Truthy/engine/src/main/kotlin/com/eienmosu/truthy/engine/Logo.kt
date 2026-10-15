// components/Logo.tsx: LogoMark keeps the 44 by 30 proportion of its view box.
package com.eienmosu.truthy.engine

/**
 * The height of the logo mark drawn `width` wide: `Math.round(((width * 30) / 44) * 100) / 100`, in that
 * order of operations. 44 gives 30 (next to the wordmark), 26 gives 17.73 (the continue line), 20 gives 13.64
 * (the compact pass band).
 */
fun logoMarkHeight(width: Double = 44.0): Double = jsRound(width * 30 / 44 * 100) / 100
