package com.eienmosu.truthy

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.eienmosu.truthy.design.ResolvedTheme
import com.eienmosu.truthy.engine.Theme
import kotlinx.coroutines.flow.StateFlow

/**
 * The activity's state holder: survives configuration changes, never process death (no SavedStateHandle, so a new
 * process opens at start step 1, spec 5.6). All of the logic is in [controller].
 */
class AppViewModel(
    services: AppServices,
    writer: SerialWriter,
    systemDark: Boolean,
    debug: DebugLaunch?,
) : ViewModel() {
    val controller = AppController(viewModelScope, services, writer, systemDark, debug)

    val screen: StateFlow<TopScreen> get() = controller.screen
    val theme: StateFlow<ResolvedTheme> get() = controller.theme
    val startFlow: StartFlowModel get() = controller.startFlow
    val storedTheme: Theme? get() = controller.storedTheme

    fun openRound(request: RoundRequest) = controller.openRound(request)

    fun retryRound() = controller.retryRound()

    fun requestLeave() = controller.requestLeave()

    fun roundBack() = controller.roundBack()

    fun leaveRound() = controller.leaveRound()

    fun closeResult(): Boolean = controller.closeResult()

    fun playAgain(): Boolean = controller.playAgain()

    fun switchTheme(): Theme = controller.switchTheme()

    fun onSystemDarkChanged(dark: Boolean) = controller.onSystemDarkChanged(dark)

    fun onStart() = controller.onStart()

    fun onStop() = controller.onStop()

    fun retryCatalog() = controller.retryCatalog()

    companion object {
        fun factory(graph: AppGraph, systemDark: Boolean, debug: DebugLaunch?): ViewModelProvider.Factory =
            viewModelFactory {
                initializer { AppViewModel(graph.services(debug), graph.writer, systemDark, debug) }
            }
    }
}
