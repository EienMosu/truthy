package com.eienmosu.truthy

import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.applyStoredNightMode
import com.eienmosu.truthy.design.applyWindowTheme
import com.eienmosu.truthy.design.bootTheme
import com.eienmosu.truthy.design.isNightUiMode

class MainActivity : ComponentActivity() {
    private var debugLaunch: DebugLaunch? = null
    private var systemDarkAtLaunch = false

    private val app: AppViewModel by viewModels {
        AppViewModel.factory(AppGraph.get(applicationContext), systemDarkAtLaunch, debugLaunch)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Before super.onCreate, as the splash screen library requires.
        installSplashScreen()
        super.onCreate(savedInstanceState)
        val activity = this
        val graph = AppGraph.get(applicationContext)
        // Debug extras only on a debug build and only on a fresh start: an activity recreated after process
        // death gets its old intent back, and must open at step 1 (spec 5.6), not replay the debug launch.
        // BuildConfig.DEBUG is a compile-time constant, so R8 removes the parser from the release build (task 16).
        val launch = if (BuildConfig.DEBUG && savedInstanceState == null) {
            @Suppress("DEPRECATION")
            parseDebugLaunch { key -> extraText(intent.extras?.get(key)) }
        } else {
            null
        }
        launch?.theme?.let { theme -> graph.themeStore.store(theme) }
        debugLaunch = launch
        // The stored theme before the first frame (Review Focus 3): night mode, window background and bar icons.
        bootTheme(activity, graph.themeStore.stored)
        systemDarkAtLaunch = isNightUiMode(resources.configuration.uiMode)
        app.onSystemDarkChanged(systemDarkAtLaunch)
        lifecycle.addObserver(
            LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_START -> app.onStart()
                    Lifecycle.Event.ON_STOP -> onActivityStop()
                    else -> Unit
                }
            },
        )
        setContent {
            val theme by app.theme.collectAsState()
            LaunchedEffect(theme) {
                applyWindowTheme(activity, theme)
                applyStoredNightMode(activity, app.storedTheme)
            }
            TruthyTheme(theme) { TruthyRoot(app) }
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (backSkipsViews(Build.VERSION.SDK_INT, event.keyCode)) {
            if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) onBackPressedDispatcher.onBackPressed()
            return true
        }
        return HardwareKeys.dispatch(event) || super.dispatchKeyEvent(event)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        app.onSystemDarkChanged(isNightUiMode(newConfig.uiMode))
    }

    // ON_STOP pauses the Timed clock, except while the activity is only being recreated for a configuration change.
    private fun onActivityStop() {
        if (!isChangingConfigurations) app.onStop()
    }
}
