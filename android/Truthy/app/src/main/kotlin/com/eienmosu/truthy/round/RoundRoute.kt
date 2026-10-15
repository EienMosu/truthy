package com.eienmosu.truthy.round

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.eienmosu.truthy.RoundCoordinator

/** The round screen on the coordinator of task 11: its state, its ticket, its guarded answer and next. */
@Composable
fun RoundRoute(coordinator: RoundCoordinator, onRequestLeave: () -> Unit, modifier: Modifier = Modifier, sheetOpen: Boolean = false) {
    val round by coordinator.state.collectAsStateWithLifecycle()
    RoundScreen(
        round = round,
        ticket = coordinator.ticket,
        cardShownAt = { coordinator.cardShownAt },
        onAnswer = { coordinator.answer(it) },
        onNext = { coordinator.next() },
        onRequestLeave = onRequestLeave,
        modifier = modifier,
        sheetOpen = sheetOpen,
    )
}
