package com.eienmosu.truthy.start

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import com.eienmosu.truthy.AppViewModel
import com.eienmosu.truthy.BackTransition
import com.eienmosu.truthy.CatalogState
import com.eienmosu.truthy.Direction
import com.eienmosu.truthy.RoundRequest
import com.eienmosu.truthy.StartFlowModel
import com.eienmosu.truthy.engine.PassFieldName
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.Step

/** The start flow on screen, bound to task 11's models. */
@Composable
fun StartFlowRoute(app: AppViewModel) {
    val model = app.startFlow
    val view by model.view.collectAsState()
    val catalog by model.catalog.collectAsState()
    val boarding by model.boarding.collectAsState()
    val theme by app.theme.collectAsState()
    val ready = (catalog as? CatalogState.Ready)?.catalog
    val ui = StartFlowUi(
        data = ready?.let { StartData(index = it.index, progress = it.progress, cardIds = it.cardIds, recent = it.recent) },
        failed = catalog == CatalogState.Failed,
        current = PanelSnapshot(view.step, view.choice),
        forward = view.dir == Direction.FORWARD,
        focusId = view.focusId,
        travel = view.travel,
        seq = view.seq,
        fromRound = view.fromRound,
        boarding = boarding,
        theme = theme.theme,
    )
    val actions = remember(model, app) { RouteActions(model, app) }
    StartFlowScreen(ui = ui, actions = actions)
}

private class RouteActions(private val model: StartFlowModel, private val app: AppViewModel) : StartFlowActions {
    /** The round Start round asked for, opened once the paper has unrolled (task 11: startRound, then openRound). */
    private var request: RoundRequest? = null

    override fun choose(forward: Forward): Boolean = model.choose(forward.step, forward.choice, forward.field)

    override fun tapBack() {
        model.tapBack()
    }

    override fun jump(field: PassFieldName) {
        model.jump(field)
    }

    override fun backOne() {
        model.back()
    }

    override fun backTo(step: Step) {
        model.back(step)
    }

    override fun backTransition(itemCount: Int): BackTransition? = model.backTransition(itemCount)

    override fun columnJumped() {
        model.columnJumped()
    }

    override fun continueLast(): Boolean = model.continueLast()

    override fun startRound(): Boolean {
        val next = model.startRound() ?: return false
        request = next
        return true
    }

    override fun onUnrolled() {
        val next = request ?: recovered() ?: return
        request = null
        app.openRound(next)
    }

    /** After an activity recreation mid-unroll the remembered request is gone, but the model is still boarding on a full pass: rebuild the same request startRound returned from that pass. */
    private fun recovered(): RoundRequest? {
        if (!model.boarding.value) return null
        val choice = model.view.value.choice
        val deckId = choice.deckId ?: return null
        val sectionId = choice.sectionId ?: return null
        val mode = choice.mode ?: return null
        return RoundRequest(Route(deckId, sectionId), mode)
    }

    override fun switchTheme() {
        app.switchTheme()
    }

    override fun arrivalFocusTaken() {
        model.arrivalFocusTaken()
    }

    override fun retryCatalog() {
        app.retryCatalog()
    }
}
