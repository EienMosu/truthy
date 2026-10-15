package com.eienmosu.truthy.round

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.ModalBottomSheetProperties
import androidx.compose.material3.SheetValue
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.design.LocalReducedMotion
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.rememberFrameInsets
import com.eienmosu.truthy.design.truthyShadow
import com.eienmosu.truthy.start.FullSpeed
import com.eienmosu.truthy.ui.PillButton
import com.eienmosu.truthy.ui.QuietButton
import com.eienmosu.truthy.ui.TestTags
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

const val SHEET_CARD_TAG = TestTags.SHEET_CARD
const val SCRIM_TAG = "leave.scrim"

/** The sheet card's current opacity, for tests (the fade is the web's, rule 5). */
val SheetCardAlpha = SemanticsPropertyKey<Float>("SheetCardAlpha")

/** The scrim's current opacity, for tests (rule 5). */
val ScrimAlpha = SemanticsPropertyKey<Float>("ScrimAlpha")

/**
 * "Leave round?" in the platform sheet (spec 5.4), composed while the coordinator's sheetOpen is true: swipe down and
 * the scrim keep playing through Material's onDismissRequest, back through the sheet's own BackHandler. A scrim tap
 * or a swipe-down settle asks scrimTapAccepted first; the host answers true unless task 15 finds the guard needed
 * (rule 4). Material's scrim is transparent: the host draws LeaveScrim (rule 5).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaveSheet(decided: Boolean, scrimTapAccepted: () -> Boolean, onKeepPlaying: () -> Unit, onLeave: () -> Unit) {
    val theme = TruthyTheme.resolved
    val currentAccepted by rememberUpdatedState(scrimTapAccepted)
    // Material3 1.4.0's SheetState.hide() asks confirmValueChange(Hidden) too (SheetDefaults.kt:222): a close the card
    // asked for (Keep playing, Escape) is let through without asking the scrim guard.
    var closing by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(
        skipPartiallyExpanded = true,
        confirmValueChange = { value -> value != SheetValue.Hidden || closing || currentAccepted() },
    )
    val scope = rememberCoroutineScope()
    val keepPlaying: () -> Unit = {
        if (!closing) {
            closing = true
            scope.launch { sheetState.hide() }.invokeOnCompletion { onKeepPlaying() }
        }
    }
    ModalBottomSheet(
        onDismissRequest = onKeepPlaying,
        sheetState = sheetState,
        sheetMaxWidth = Tokens.Size.maxWidth,
        shape = RectangleShape,
        containerColor = Color.Transparent,
        contentColor = theme.colors.ink,
        tonalElevation = 0.dp,
        scrimColor = Color.Transparent,
        dragHandle = null,
        contentWindowInsets = { WindowInsets(0, 0, 0, 0) },
        properties = ModalBottomSheetProperties(
            isAppearanceLightStatusBars = !theme.isDark,
            isAppearanceLightNavigationBars = !theme.isDark,
            // Back on the sheet is the BackHandler below: it keeps playing at once and never asks the guard.
            shouldDismissOnBackPress = false,
        ),
    ) {
        BackHandler { keepPlaying() }
        LeaveSheetCard(
            decided = decided,
            hiding = sheetState.targetValue == SheetValue.Hidden,
            onKeepPlaying = keepPlaying,
            onLeave = onLeave,
        )
    }
}

/** The web's floating card (LeaveDialog.tsx), drawn inside the transparent sheet. */
@Composable
fun LeaveSheetCard(decided: Boolean, hiding: Boolean, onKeepPlaying: () -> Unit, onLeave: () -> Unit, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    val reduced = LocalReducedMotion.current
    val fade = remember { Animatable(0f) }
    LaunchedEffect(hiding, reduced) {
        val motion = if (hiding) Tokens.Transitions.sheetClose else Tokens.Transitions.sheetOpen
        val duration = if (reduced) Tokens.Native.sheetReducedMs else motion.durationMs
        withContext(FullSpeed) {
            fade.animateTo(if (hiding) 0f else 1f, tween(durationMillis = duration, easing = motion.easing))
        }
    }
    val keepPlayingFocus = remember { FocusRequester() }
    val sheetFocus = remember { FocusRequester() }
    // In touch mode Keep playing (a clickable) cannot take focus; the sheet's root takes it then, so Escape still
    // arrives (with predictive back on, a dialog no longer turns Escape into back).
    LaunchedEffect(Unit) { if (!keepPlayingFocus.requestFocus()) sheetFocus.requestFocus() }
    val frame = rememberFrameInsets()
    val shape = RoundedCornerShape(Tokens.Radius.card)
    val cardAlpha = fade.value
    Column(
        modifier
            .fillMaxWidth()
            .onPreviewKeyEvent { event ->
                val escape = event.key == Key.Escape
                if (escape && event.type == KeyEventType.KeyDown && event.nativeKeyEvent.repeatCount == 0) onKeepPlaying()
                escape
            }
            .focusRequester(sheetFocus)
            .focusable()
            .verticalScroll(rememberScrollState())
            .padding(start = frame.start, end = frame.end, top = Tokens.Space.s12, bottom = frame.bottom),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .testTag(SHEET_CARD_TAG)
                .semantics { this[SheetCardAlpha] = cardAlpha }
                .graphicsLayer { alpha = cardAlpha }
                .truthyShadow(TruthyTheme.shadows.sheet, cornerRadius = Tokens.Radius.card)
                .background(colors.surfaceRaised, shape)
                .padding(Tokens.Space.s20),
        ) {
            BasicText(
                text = LeaveText.TITLE,
                style = TruthyType.stepTitle.copy(color = colors.ink),
                modifier = Modifier.semantics { heading() },
            )
            BasicText(
                text = LeaveText.body(decided),
                style = TruthyType.body.copy(color = colors.ink),
                modifier = Modifier.padding(top = Tokens.Space.s8).semantics { liveRegion = LiveRegionMode.Polite },
            )
            Column(Modifier.padding(top = Tokens.Space.s20), verticalArrangement = Arrangement.spacedBy(Tokens.Space.s4)) {
                PillButton(
                    label = LeaveText.KEEP_PLAYING,
                    onClick = onKeepPlaying,
                    modifier = Modifier.fillMaxWidth().focusRequester(keepPlayingFocus),
                )
                QuietButton(label = LeaveText.LEAVE_ROUND, onClick = onLeave, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

/**
 * The web's scrim (reference 5.0 and 5.8): the theme's scrim colour fading in over Transitions.sheetOpen (360 ms
 * ease) and out over sheetClose, at full length under reduced motion too (task 12's FullSpeed). The host draws it in
 * the activity's window, under the sheet's own window; it takes no touches (the sheet's window takes them).
 */
@Composable
fun LeaveScrim(visible: Boolean, modifier: Modifier = Modifier) {
    val scrim = remember { Animatable(0f) }
    LaunchedEffect(visible) {
        val motion = if (visible) Tokens.Transitions.sheetOpen else Tokens.Transitions.sheetClose
        withContext(FullSpeed) {
            scrim.animateTo(if (visible) 1f else 0f, tween(durationMillis = motion.durationMs, easing = motion.easing))
        }
    }
    val alpha = scrim.value
    Box(
        modifier
            .fillMaxSize()
            .testTag(SCRIM_TAG)
            .semantics { this[ScrimAlpha] = alpha }
            .graphicsLayer { this.alpha = alpha }
            .background(TruthyTheme.colors.scrim),
    )
}
