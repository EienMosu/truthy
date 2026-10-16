package com.eienmosu.truthy.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.PressFeedback
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyText
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.keyboardFocusRing
import com.eienmosu.truthy.design.pressFeedback
import com.eienmosu.truthy.design.rememberPressProgress
import com.eienmosu.truthy.design.truthyShadow

enum class PillTone { INK, TRUE, FALSE }

enum class RoundVariant { RAISED, SUNK }

/**
 * The 60 pill (PillButton.tsx): "Next card →", "See results →", "Start round →", "Play again", and in the TRUE and FALSE
 * tones the answer buttons. [dimmed] is the web's aria-disabled: drawn at 0.45 with no shadow, takes no press, ignores
 * clicks, and stays in the accessibility tree as disabled so focus is not lost mid-round. The icons are decorative.
 */
@Composable
fun PillButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    tone: PillTone = PillTone.INK,
    dimmed: Boolean = false,
    leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null,
) {
    val colors = TruthyTheme.colors
    val shadows = TruthyTheme.shadows
    val source = remember { MutableInteractionSource() }
    val press = rememberPressProgress(source, active = !dimmed)
    val fill = when (tone) {
        PillTone.INK -> colors.ink
        PillTone.TRUE -> colors.trueColor
        PillTone.FALSE -> colors.falseColor
    }
    val shape = RoundedCornerShape(Tokens.Radius.pill)
    val shadow = if (dimmed) {
        Modifier
    } else {
        Modifier
            .truthyShadow(shadows.button, Tokens.Radius.pill, alpha = { 1f - press.value })
            .truthyShadow(shadows.press, Tokens.Radius.pill, alpha = { press.value })
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = Tokens.Size.pill)
            .pressFeedback(press, PressFeedback.PILL_SCALE, Tokens.Space.s2)
            .then(shadow)
            .alpha(if (dimmed) Tokens.Opacity.disabled else 1f)
            .keyboardFocusRing(shape)
            .clip(shape)
            .background(fill)
            .clickable(interactionSource = source, indication = null, role = Role.Button) {
                if (!dimmed) onClick()
            }
            .semantics { if (dimmed) disabled() }
            .padding(horizontal = Tokens.Space.s16),
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s10, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leadingIcon?.invoke()
        // A label that wraps at a large font scale centres each line, as the browser does in a button.
        TruthyText(label, TruthyType.button, colors.onDark, textAlign = TextAlign.Center)
        trailingIcon?.invoke()
    }
}

/**
 * The 48 round button of the headers (RoundButton.tsx): leave a round, close results, switch the theme. It holds only an
 * icon, so [label] is its accessible name. RAISED is paper with the small shadow on the sky; SUNK is sunk paper with no
 * shadow on a paper surface. [enabled] false is the web's disabled: drawn at 0.45, takes no press.
 */
@Composable
fun RoundButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: RoundVariant = RoundVariant.RAISED,
    enabled: Boolean = true,
    content: @Composable () -> Unit,
) {
    val colors = TruthyTheme.colors
    val shadows = TruthyTheme.shadows
    val source = remember { MutableInteractionSource() }
    val press = rememberPressProgress(source, active = enabled)
    val shadow = if (variant == RoundVariant.RAISED) {
        Modifier.truthyShadow(shadows.small, Tokens.Size.roundButton / 2)
    } else {
        Modifier
    }
    Box(
        modifier = modifier
            .size(Tokens.Size.roundButton)
            .pressFeedback(press, PressFeedback.ROUND_SCALE)
            .then(shadow)
            .alpha(if (enabled) 1f else Tokens.Opacity.disabled)
            .keyboardFocusRing(CircleShape)
            .clip(CircleShape)
            .background(if (variant == RoundVariant.RAISED) colors.surfaceRaised else colors.surfaceSunk)
            .clickable(interactionSource = source, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        content()
    }
}

/** The quiet 48 text button under the primary pill (QuietButton.tsx): "Choose another route". */
@Composable
fun QuietButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    leadingIcon: (@Composable () -> Unit)? = null,
) {
    val colors = TruthyTheme.colors
    val source = remember { MutableInteractionSource() }
    val press = rememberPressProgress(source)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = Tokens.Size.pillSmall)
            .pressFeedback(press, PressFeedback.QUIET_SCALE)
            .keyboardFocusRing(RoundedCornerShape(Tokens.Radius.pillSmall))
            .clip(RoundedCornerShape(Tokens.Radius.pillSmall))
            .clickable(interactionSource = source, indication = null, role = Role.Button, onClick = onClick),
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leadingIcon?.invoke()
        TruthyText(label, TruthyType.buttonQuiet, colors.ink, textAlign = TextAlign.Center)
    }
}

/**
 * The Back pill of the start flow (StartFlow.tsx): raised paper, the small shadow, the pill arrow and "Back". Its name for
 * screen readers is [description] ("Back to areas").
 */
@Composable
fun BackPill(
    description: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    text: String = "Back",
) {
    val colors = TruthyTheme.colors
    val shadows = TruthyTheme.shadows
    val source = remember { MutableInteractionSource() }
    val press = rememberPressProgress(source)
    Row(
        modifier = modifier
            .heightIn(min = Tokens.Size.pillSmall)
            .pressFeedback(press, PressFeedback.BACK_PILL_SCALE)
            .truthyShadow(shadows.small, Tokens.Radius.pillSmall)
            .keyboardFocusRing(RoundedCornerShape(Tokens.Radius.pillSmall))
            .clip(RoundedCornerShape(Tokens.Radius.pillSmall))
            .background(colors.surfaceRaised)
            .clickable(interactionSource = source, indication = null, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = description }
            .padding(start = Tokens.Space.s14, end = Tokens.Space.s20),
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TruthyIcon(IconId.BACK_PILL, tint = colors.ink)
        TruthyText(text, TruthyType.buttonBack, colors.ink)
    }
}
