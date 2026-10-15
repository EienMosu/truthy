package com.eienmosu.truthy

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag

/** The test tag of the activity's root, for tests that only need to know the app drew. */
const val ROOT_TAG = "truthy.root"

/**
 * The activity's only content. Empty for now: the window background (truthy_surface) shows through. Task 8 wraps it
 * in the theme; task 11 swaps the start flow and the round inside it.
 */
@Composable
fun TruthyRoot() {
    Box(Modifier.fillMaxSize().testTag(ROOT_TAG))
}
