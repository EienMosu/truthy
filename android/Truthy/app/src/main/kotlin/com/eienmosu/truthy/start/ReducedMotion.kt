package com.eienmosu.truthy.start

import android.content.Context
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.MotionDurationScale
import androidx.compose.ui.platform.LocalContext
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.EmptyCoroutineContext

/** Reference 5.8: on Android, reduced motion is "Remove animations", an animator duration scale of 0. */
fun isReducedMotion(animatorDurationScale: Float): Boolean = animatorDurationScale == 0f

fun readAnimatorDurationScale(context: Context): Float =
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f)

/** A MotionDurationScale of 1: the fades the web keeps under reduced motion run in real time although the system scale is 0. */
object FullSpeed : MotionDurationScale {
    override val scaleFactor: Float get() = 1f
}

/** The coroutine context a start-flow animation runs in: full speed under reduced motion, the system's own scale otherwise. */
fun motionContext(reduced: Boolean): CoroutineContext = if (reduced) FullSpeed else EmptyCoroutineContext

/** Whether reduced motion is on, read now and again whenever the setting changes. */
@Composable
fun rememberReducedMotion(): Boolean {
    val context = LocalContext.current
    var reduced by remember(context) { mutableStateOf(isReducedMotion(readAnimatorDurationScale(context))) }
    DisposableEffect(context) {
        val resolver = context.contentResolver
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                reduced = isReducedMotion(readAnimatorDurationScale(context))
            }
        }
        resolver.registerContentObserver(Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE), false, observer)
        onDispose { resolver.unregisterContentObserver(observer) }
    }
    return reduced
}
