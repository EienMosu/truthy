package com.eienmosu.truthy

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import com.eienmosu.truthy.design.LocalReducedMotion
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.round.RoundLoading
import com.eienmosu.truthy.round.RoundRoute
import com.eienmosu.truthy.start.StartFlowRoute
import com.eienmosu.truthy.start.rememberReducedMotion

/** The test tag of the activity's root, for tests that only need to know the app drew. */
const val ROOT_TAG = "truthy.root"

/** The test tags of the two top-level screens; tasks 12 to 14 put the screens inside them. */
const val START_TAG = "truthy.start"
const val ROUND_TAG = "truthy.round"

/** The two top-level screens, swapped in place (spec 5.2). Empty roots until tasks 12 to 14 fill them. */
@Composable
fun TruthyRoot(app: AppViewModel) {
    val screen by app.screen.collectAsState()
    // Task 12, rule 4: reduced motion for every screen, provided once.
    CompositionLocalProvider(LocalReducedMotion provides rememberReducedMotion()) {
        Box(Modifier.fillMaxSize().background(TruthyTheme.colors.surface).testTag(ROOT_TAG)) {
            when (val current = screen) {
                TopScreen.Start -> Box(Modifier.fillMaxSize().testTag(START_TAG)) { StartFlowRoute(app) }
                is TopScreen.Round -> Box(Modifier.fillMaxSize().testTag(ROUND_TAG)) {
                    // Until task 14 adds the leave sheet and back on the round, the X leaves at once with the leave
                    // rules (task 11's leaveRound: the coordinator's leave, then start step 1).
                    when (val load = current.load) {
                        is RoundLoad.Ready -> RoundRoute(load.coordinator, onRequestLeave = { app.leaveRound() })
                        else -> RoundLoading(onRequestLeave = { app.leaveRound() })
                    }
                }
            }
        }
    }
}
