package com.eienmosu.truthy.start

import com.eienmosu.truthy.BackFrame
import com.eienmosu.truthy.BackLayer

private fun BackLayer.toLayer(): Layer = Layer(alpha, offsetY)

/**
 * One frame of task 11's back motion as the layers the start screen draws. The arriving panel itself never fades
 * (its items do, also under reduced motion); a zone, the pass's blocks or the theme switch only move when `swaps`
 * says this step change moves them.
 */
fun backLayers(frame: BackFrame, itemCount: Int, swaps: Swaps): StepLayers = StepLayers(
    oldPanel = frame.oldPanel.toLayer(),
    oldTitleAlpha = frame.oldTitleAlpha,
    newPanelAlpha = 1f,
    items = List(itemCount) { i -> frame.newItem(i).toLayer() },
    dashOutAlpha = 0f,
    dashInAlpha = frame.dashAlpha,
    oldBlockAlpha = if (swaps.block) frame.oldBlockAlpha else 0f,
    newBlockAlpha = if (swaps.block) frame.newBlockAlpha else 1f,
    passMorph = if (swaps.block) frame.morph else 1f,
    topOut = if (swaps.top != null) frame.tripOut.toLayer() else Layer.Gone,
    topIn = if (swaps.top != null) frame.brandIn.toLayer() else Layer.Shown,
    footOut = if (swaps.foot != null) frame.footOut.toLayer() else Layer.Gone,
    footIn = if (swaps.foot != null) frame.footIn.toLayer() else Layer.Shown,
    switchMove = if (swaps.switchMoves) frame.switchShift else 1f,
)
