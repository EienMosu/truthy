package com.eienmosu.truthy.round

import android.os.SystemClock
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.eienmosu.truthy.AppViewModel
import com.eienmosu.truthy.MonotonicClock
import com.eienmosu.truthy.RoundCoordinator
import com.eienmosu.truthy.RoundLoad
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.isDecided

/**
 * What the host asks of the round's owner (rule 1): task 11's AppViewModel and RoundCoordinator in the app
 * (RoundHostRoute), a fake in RoundHostTest. The owner decides; the host only routes.
 */
interface RoundHostActions {
    /** The X and Escape: AppViewModel.requestLeave (leave at once, or open the sheet). */
    fun requestLeave()

    /** Back on the round surface: AppViewModel.roundBack. */
    fun roundBack()

    /** Every dismissal of the sheet: the coordinator's keepPlaying. */
    fun keepPlaying()

    /** The scrim and swipe-down guard (rule 4): true in the app unless spec 5.4's double-tap story fails; then the coordinator's. */
    fun scrimTapAccepted(): Boolean

    /** "Leave round": AppViewModel.leaveRound. */
    fun leaveRound()

    /** "Close results" and "Choose another route": AppViewModel.closeResult. */
    fun closeResult()

    /** "Play again": AppViewModel.playAgain. */
    fun playAgain()
}

/**
 * The round's top-level screen (spec 5.2): the round or its result inside the back surface, the web's scrim and the
 * leave sheet. `round` null is loading; `sheetOpen` is the coordinator's. The X and Escape (in `content`, through
 * requestClose), back, the sheet and the result's actions all go to `actions` (rule 1).
 */
@Composable
fun RoundHost(
    round: RoundState?,
    ticket: TicketInfo?,
    sheetOpen: Boolean,
    clock: MonotonicClock,
    actions: RoundHostActions,
    modifier: Modifier = Modifier,
    openSource: (String) -> Unit = rememberSourceOpener(),
    content: @Composable (requestClose: () -> Unit) -> Unit,
) {
    val showsResult = round != null && ticket != null && round.phase == Phase.FINISHED && !round.abandoned
    // Rule 7: the result's own 1000 ms counts from its first frame.
    val resultShownAt = remember(showsResult) { if (showsResult) clock.nowMs() else null }
    Box(modifier.fillMaxSize()) {
        RoundBackSurface(enabled = !sheetOpen, onBack = actions::roundBack) {
            val shownAt = resultShownAt
            if (showsResult && shownAt != null) {
                ResultScreen(
                    round = round,
                    ticket = ticket,
                    shownAt = shownAt,
                    clock = clock,
                    onClose = actions::closeResult,
                    onPlayAgain = actions::playAgain,
                    onHome = actions::closeResult,
                    openSource = openSource,
                )
            } else {
                content(actions::requestLeave)
            }
        }
        // Rule 5: the web's scrim in the activity's window, under the sheet's window; it fades out when the sheet closes.
        LeaveScrim(visible = sheetOpen)
    }
    val open = round
    if (sheetOpen && open != null) {
        LeaveSheet(
            decided = isDecided(open),
            scrimTapAccepted = actions::scrimTapAccepted,
            onKeepPlaying = actions::keepPlaying,
            onLeave = actions::leaveRound,
        )
    }
}

/** SystemClock.uptimeMillis, the clock of the coordinator's guards (README, MonotonicClock). */
private val UPTIME = MonotonicClock { SystemClock.uptimeMillis().toDouble() }

/** The host on task 11's objects: the round of `load`, its sheet flag and the app's actions (for TruthyRoot). */
@Composable
fun RoundHostRoute(app: AppViewModel, load: RoundLoad, modifier: Modifier = Modifier) {
    when (load) {
        is RoundLoad.Ready -> ReadyRound(app, load.coordinator, modifier)
        else -> {
            val actions = remember(app) { appActions(app, null) }
            RoundHost(round = null, ticket = null, sheetOpen = false, clock = UPTIME, actions = actions, modifier = modifier) { requestClose ->
                RoundLoading(onRequestLeave = requestClose)
            }
        }
    }
}

@Composable
private fun ReadyRound(app: AppViewModel, coordinator: RoundCoordinator, modifier: Modifier) {
    val round by coordinator.state.collectAsStateWithLifecycle()
    val sheetOpen by coordinator.sheetOpen.collectAsStateWithLifecycle()
    val actions = remember(app, coordinator) { appActions(app, coordinator) }
    RoundHost(round = round, ticket = coordinator.ticket, sheetOpen = sheetOpen, clock = UPTIME, actions = actions, modifier = modifier) { requestClose ->
        RoundRoute(coordinator, onRequestLeave = requestClose, sheetOpen = sheetOpen)
    }
}

private fun appActions(app: AppViewModel, coordinator: RoundCoordinator?): RoundHostActions = object : RoundHostActions {
    override fun requestLeave() = app.requestLeave()
    override fun roundBack() = app.roundBack()
    override fun keepPlaying() {
        coordinator?.keepPlaying()
    }
    override fun scrimTapAccepted(): Boolean = true // spec 5.4: wired to coordinator?.scrimTapAccepted() only if task 15's double-tap story fails
    override fun leaveRound() = app.leaveRound()
    override fun closeResult() {
        app.closeResult()
    }
    override fun playAgain() {
        app.playAgain()
    }
}
