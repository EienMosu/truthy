package com.eienmosu.truthy

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Before super.onCreate, as the splash screen library requires: it switches to postSplashScreenTheme.
        installSplashScreen()
        super.onCreate(savedInstanceState)
        // The system's night mode for now; task 8 passes the resolved app theme.
        applySystemBars(dark = resources.configuration.isNightMode())
        setContent { TruthyRoot() }
    }
}
