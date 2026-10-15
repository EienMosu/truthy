package com.eienmosu.truthy.support

import android.app.Instrumentation
import android.app.UiModeManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.toArgb
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import com.eienmosu.truthy.DebugLaunch
import com.eienmosu.truthy.FileProgressStore
import com.eienmosu.truthy.MainActivity
import com.eienmosu.truthy.ThemeStore
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyColors
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.readProgress
import java.io.File
import kotlin.math.abs

/** The web's key of the stored theme (reference 6), read to check what the switch stored. */
const val THEME_PREF_KEY = "truthy.theme"

/** The emulator and the app's files: what a test arranges before a launch and reads after it. */
object Device {
    val instrumentation: Instrumentation get() = InstrumentationRegistry.getInstrumentation()
    val app: Context get() = instrumentation.targetContext
    val density: Float get() = app.resources.displayMetrics.density
    val sdk: Int get() = Build.VERSION.SDK_INT

    /** A first launch: no progress, no side copy, no journal, no stored theme. The review folder "visual" stays. */
    fun reset() {
        app.filesDir.listFiles()?.filter { it.name.startsWith("truthy.") }?.forEach { it.deleteRecursively() }
        prefs().edit().clear().commit()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Task 8 hands a stored theme to the system (setApplicationNightMode), which keeps it after the
            // preferences are cleared. MODE_NIGHT_AUTO gives the app the system's own setting back.
            app.getSystemService(UiModeManager::class.java).setApplicationNightMode(UiModeManager.MODE_NIGHT_AUTO)
        }
    }

    private fun prefs() = app.getSharedPreferences(ThemeStore.PREFS_NAME, Context.MODE_PRIVATE)

    /** Writes the progress file as a previous run of the app (or the web, same JSON) would have left it. */
    fun storeProgress(json: String) {
        File(app.filesDir, FileProgressStore.FILE_NAME).writeText(json)
    }

    /** The stored progress, read with the engine's own reader. Empty progress when nothing is stored. */
    fun progress(): Progress {
        val file = File(app.filesDir, FileProgressStore.FILE_NAME)
        return readProgress(if (file.exists()) file.readText() else null).progress
    }

    fun storedTheme(): String? = prefs().getString(THEME_PREF_KEY, null)

    fun launch(seed: Long? = null): ActivityScenario<MainActivity> {
        val intent = Intent(app, MainActivity::class.java)
        if (seed != null) intent.putExtra(DebugLaunch.SEED, seed.toString())
        return ActivityScenario.launch(intent)
    }

    /** Runs a shell command as the shell user and returns its output once it has finished. */
    fun shell(command: String): String {
        val output = instrumentation.uiAutomation.executeShellCommand(command)
        return ParcelFileDescriptor.AutoCloseInputStream(output).bufferedReader().use { it.readText() }
    }

    /** The system's dark theme on or off. Android has a system dark theme from API 29; below it this does nothing. */
    fun systemNight(on: Boolean) {
        if (sdk >= 29) shell("cmd uimode night ${if (on) "yes" else "no"}")
    }

    /** The whole screen, system bars included, as a software bitmap whose pixels can be read. */
    fun screenshot(): Bitmap {
        val shot = instrumentation.uiAutomation.takeScreenshot() ?: error("UiAutomation gave no screenshot")
        return shot.copy(Bitmap.Config.ARGB_8888, false)
    }
}

/** A finger on the touch screen: real MotionEvents with real uptime stamps, at screen coordinates in px. */
object Finger {
    fun tap(at: Offset) {
        val down = press(at)
        SystemClock.sleep(40)
        release(down, at)
    }

    /** Puts the finger down and returns the down time the later events of this gesture carry. */
    fun press(at: Offset): Long {
        val now = SystemClock.uptimeMillis()
        send(now, now, MotionEvent.ACTION_DOWN, at)
        return now
    }

    fun moveTo(downTime: Long, at: Offset) = send(downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_MOVE, at)

    fun release(downTime: Long, at: Offset) = send(downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, at)

    fun drag(from: Offset, to: Offset, steps: Int = 12, stepMs: Long = 16) {
        val down = press(from)
        for (step in 1..steps) {
            SystemClock.sleep(stepMs)
            moveTo(down, from + (to - from) * (step / steps.toFloat()))
        }
        release(down, to)
    }

    private fun send(downTime: Long, eventTime: Long, action: Int, at: Offset) {
        val event = MotionEvent.obtain(downTime, eventTime, action, at.x, at.y, 0)
        event.source = InputDevice.SOURCE_TOUCHSCREEN
        try {
            Device.instrumentation.sendPointerSync(event)
        } finally {
            event.recycle()
        }
    }
}

/** A hardware keyboard: key events to the focused window, as an attached keyboard sends them. */
object Keys {
    fun press(code: Int) = Device.instrumentation.sendKeyDownUpSync(code)

    /** A held key: one down, `repeats` auto-repeat downs 50 ms apart, then the up. */
    fun hold(code: Int, repeats: Int) {
        val keyboard = Device.instrumentation
        val down = SystemClock.uptimeMillis()
        keyboard.sendKeySync(KeyEvent(down, down, KeyEvent.ACTION_DOWN, code, 0))
        for (repeat in 1..repeats) {
            SystemClock.sleep(50)
            keyboard.sendKeySync(KeyEvent(down, SystemClock.uptimeMillis(), KeyEvent.ACTION_DOWN, code, repeat))
        }
        keyboard.sendKeySync(KeyEvent(down, SystemClock.uptimeMillis(), KeyEvent.ACTION_UP, code, 0))
    }
}

/** Expected screen colours, from the generated tokens (task 8). */
object Colours {
    // The sky's smooth gradient over the window height (reference 5.0 and 5.1), stops from plan A's native group.
    private val STOPS = Tokens.Native.skyStops

    /** The sky at a fraction of the window height, mixed per channel in sRGB as the gradient draws it. */
    fun skyAt(colors: TruthyColors, fraction: Float): Int {
        val sky = intArrayOf(colors.sky1.toArgb(), colors.sky2.toArgb(), colors.sky3.toArgb(), colors.sky4.toArgb())
        val at = fraction.coerceIn(0f, 1f)
        var i = 0
        while (i < STOPS.size - 2 && at > STOPS[i + 1]) i += 1
        val t = (at - STOPS[i]) / (STOPS[i + 1] - STOPS[i])
        fun mix(shift: Int): Int {
            val from = (sky[i] shr shift) and 0xFF
            val to = (sky[i + 1] shr shift) and 0xFF
            return Math.round(from + (to - from) * t)
        }
        return (0xFF shl 24) or (mix(16) shl 16) or (mix(8) shl 8) or mix(0)
    }

    fun close(a: Int, b: Int, tolerance: Int = 3): Boolean =
        listOf(16, 8, 0).all { shift -> abs(((a shr shift) and 0xFF) - ((b shr shift) and 0xFF)) <= tolerance }

    fun hex(colour: Int): String = "#%06x".format(colour and 0xFFFFFF)
}
