package com.eienmosu.truthy.start

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.ui.RoundButton

/** ThemeSwitch.tsx: a moon offers the night theme while the day theme shows, a sun the day theme at night. */
@Composable
fun ThemeSwitch(theme: Theme, onSwitch: () -> Unit, modifier: Modifier = Modifier) {
    val day = theme == Theme.LIGHT
    RoundButton(label = if (day) StartCopy.SWITCH_TO_DARK else StartCopy.SWITCH_TO_LIGHT, onClick = onSwitch, modifier = modifier) {
        TruthyIcon(if (day) IconId.MOON else IconId.SUN)
    }
}
