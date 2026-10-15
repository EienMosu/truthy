package com.eienmosu.truthy.start

import org.junit.Assert.assertEquals

const val EPS = 1e-4f

fun assertLayer(expected: Layer, actual: Layer, what: String = "") {
    assertEquals("$what alpha", expected.alpha, actual.alpha, EPS)
    assertEquals("$what offsetY", expected.offsetY, actual.offsetY, EPS)
}

/**
 * The arriving step at rest: everything that leaves is invisible (where it went does not matter; the old title is
 * drawn inside the old panel, so the panel's alpha covers it), everything that arrives is fully shown in its place.
 */
fun assertAtRest(itemCount: Int, layers: StepLayers, what: String = "") {
    assertEquals("$what old panel", 0f, layers.oldPanel.alpha, EPS)
    assertEquals("$what new panel", 1f, layers.newPanelAlpha, EPS)
    for (i in 0 until itemCount) assertLayer(Layer.Shown, layers.item(i), "$what item $i")
    assertEquals("$what leaving dashes", 0f, layers.dashOutAlpha, EPS)
    assertEquals("$what arriving dashes", 1f, layers.dashInAlpha, EPS)
    assertEquals("$what old block", 0f, layers.oldBlockAlpha, EPS)
    assertEquals("$what new block", 1f, layers.newBlockAlpha, EPS)
    assertEquals("$what morph", 1f, layers.passMorph, EPS)
    assertEquals("$what top out", 0f, layers.topOut.alpha, EPS)
    assertLayer(Layer.Shown, layers.topIn, "$what top in")
    assertEquals("$what foot out", 0f, layers.footOut.alpha, EPS)
    assertLayer(Layer.Shown, layers.footIn, "$what foot in")
    assertEquals("$what switch", 1f, layers.switchMove, EPS)
}
