// components/format.ts
package com.eienmosu.truthy.engine

/** A number as two digits: "07", "14". Longer numbers stay as they are (`String(n).padStart(2, "0")`). */
fun pad2(n: Int): String = n.toString().padStart(2, '0')
