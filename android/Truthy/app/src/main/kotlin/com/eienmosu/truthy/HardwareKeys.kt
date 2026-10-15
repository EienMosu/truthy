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

/** Registers `onKey` with HardwareKeys while this composable is on screen. */
@Composable
fun HardwareKeyHandler(onKey: (KeyEvent) -> Boolean) {
    val current by rememberUpdatedState(onKey)
    DisposableEffect(Unit) {
        val unregister = HardwareKeys.register { event -> current(event) }
        onDispose { unregister() }
    }
}
