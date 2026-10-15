package com.eienmosu.truthy.design

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.IndicationNodeFactory
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.node.DelegatableNode
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.unit.Dp
import kotlin.math.hypot
import kotlin.math.max
import kotlinx.coroutines.launch

/**
 * The `press` colour as a bounded circle that grows from the touch point to cover the element and fades out on release
 * (spec 5.6: pass fields and the continue line only). Material's ripple multiplies the colour's alpha by its own pressed
 * alpha, which would make the token's 0.05 invisible; this draws the colour as it is. Use with
 * `Modifier.clickable(interactionSource, rememberPressTint(radius)) { }`.
 */
class PressTint(
    private val color: Color,
    private val cornerRadius: Dp,
    private val reducedMotion: Boolean,
) : IndicationNodeFactory {
    override fun create(interactionSource: InteractionSource): DelegatableNode =
        PressTintNode(interactionSource, color, cornerRadius, reducedMotion)

    override fun equals(other: Any?): Boolean =
        other is PressTint && other.color == color && other.cornerRadius == cornerRadius && other.reducedMotion == reducedMotion

    override fun hashCode(): Int = 31 * (31 * color.hashCode() + cornerRadius.hashCode()) + reducedMotion.hashCode()
}

private class PressTintNode(
    private val interactionSource: InteractionSource,
    private val color: Color,
    private val cornerRadius: Dp,
    private val reducedMotion: Boolean,
) : Modifier.Node(), DrawModifierNode {
    private val reveal = Animatable(0f)
    private val shown = Animatable(0f)
    private var origin = Offset.Zero

    override fun onAttach() {
        coroutineScope.launch {
            interactionSource.interactions.collect { interaction ->
                when (interaction) {
                    is PressInteraction.Press -> {
                        origin = interaction.pressPosition
                        launch {
                            reveal.snapTo(0f)
                            reveal.animateTo(1f, pressSpec(reducedMotion))
                        }
                        launch { shown.snapTo(1f) }
                    }
                    is PressInteraction.Release, is PressInteraction.Cancel -> {
                        launch { shown.animateTo(0f, pressSpec(reducedMotion)) }
                    }
                    else -> Unit
                }
            }
        }
    }

    override fun ContentDrawScope.draw() {
        drawContent()
        val visible = shown.value
        if (visible <= 0f) return
        val shape = Path().apply {
            addRoundRect(RoundRect(0f, 0f, size.width, size.height, CornerRadius(cornerRadius.toPx())))
        }
        val farthest = hypot(max(origin.x, size.width - origin.x), max(origin.y, size.height - origin.y))
        clipPath(shape) {
            drawCircle(
                color = color.copy(alpha = color.alpha * visible),
                radius = farthest * reveal.value,
                center = origin,
            )
        }
    }
}

/** The press tint in the current theme's `press` colour. [cornerRadius] is the element's own (6 on the pass fields). */
@Composable
fun rememberPressTint(cornerRadius: Dp): PressTint {
    val color = TruthyTheme.colors.press
    val reduced = LocalReducedMotion.current
    return remember(color, cornerRadius, reduced) { PressTint(color, cornerRadius, reduced) }
}
