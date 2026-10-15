package com.eienmosu.truthy.design

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import com.eienmosu.truthy.R

// Overpass and Overpass Mono, the static cuts the design uses (SIL OFL 1.1, assets/licenses/OFL.txt).
// Each weight is requested explicitly: the body is 600, not the platform's regular.

val OverpassSans: FontFamily = FontFamily(
    Font(R.font.overpass_600, FontWeight.W600, FontStyle.Normal),
    Font(R.font.overpass_800, FontWeight.W800, FontStyle.Normal),
)

val OverpassMono: FontFamily = FontFamily(
    Font(R.font.overpass_mono_400, FontWeight.W400, FontStyle.Normal),
    Font(R.font.overpass_mono_600, FontWeight.W600, FontStyle.Normal),
)

fun FontKey.family(): FontFamily = when (this) {
    FontKey.SANS -> OverpassSans
    FontKey.MONO -> OverpassMono
}
