package com.eienmosu.truthy

import android.view.KeyEvent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState

/**
 * Hardware keys reach the screen on top before any view: MainActivity.dispatchKeyEvent asks the handler registered
 * last. A handler that returns true has used the key, so Android neither hands it to a view nor turns an unused
 * Escape into back.
 */
object HardwareKeys {
    private val handlers = ArrayList<(KeyEvent) -> Boolean>()

    fun register(handler: (KeyEvent) -> Boolean): () -> Unit {
        handlers.add(handler)
        return { handlers.remove(handler) }
    }

    fun dispatch(event: KeyEvent): Boolean = handlers.lastOrNull()?.invoke(event) ?: false
}

/**
 * Whether the back key goes straight to the activity's OnBackPressedDispatcher instead of to the views. Below API 33
 * the system back key reaches the views as a key event first, and Compose turns a back that no node used into a focus
 * exit: with focus inside the round (the statement after a new card) every back only moved focus and never reached
 * the round's back handler (task 15's BackTest on API 26). From API 33 back arrives as an OnBackInvokedCallback and
 * never as a key, so nothing changes there.
 */
fun backSkipsViews(sdk: Int, keyCode: Int): Boolean = sdk < 33 && keyCode == KeyEvent.KEYCODE_BACK

/** Registers `onKey` with HardwareKeys while this composable is on screen. */
@Composable
fun HardwareKeyHandler(onKey: (KeyEvent) -> Boolean) {
    val current by rememberUpdatedState(onKey)
    DisposableEffect(Unit) {
        val unregister = HardwareKeys.register { event -> current(event) }
        onDispose { unregister() }
    }
}
