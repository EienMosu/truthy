package com.eienmosu.truthy.debug

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.Logo
import com.eienmosu.truthy.design.LogoMark
import com.eienmosu.truthy.design.LogoVariant
import com.eienmosu.truthy.design.RouteIcon
import com.eienmosu.truthy.design.SkyBackdrop
import com.eienmosu.truthy.design.TicketLowerShape
import com.eienmosu.truthy.design.TicketMainShape
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyText
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.drawTicketPerforation
import com.eienmosu.truthy.design.rememberPressTint
import com.eienmosu.truthy.design.truthyShadow
import com.eienmosu.truthy.ui.BackPill
import com.eienmosu.truthy.ui.CardStub
import com.eienmosu.truthy.ui.DestinationCard
import com.eienmosu.truthy.ui.DestinationVariant
import com.eienmosu.truthy.ui.IntentKind
import com.eienmosu.truthy.ui.IntentStamp
import com.eienmosu.truthy.ui.PillButton
import com.eienmosu.truthy.ui.PillTone
import com.eienmosu.truthy.ui.QuietButton
import com.eienmosu.truthy.ui.RoundButton
import com.eienmosu.truthy.ui.RoundVariant
import com.eienmosu.truthy.ui.Stamp
import com.eienmosu.truthy.ui.StampVerdict
import com.eienmosu.truthy.ui.StubStamp
import com.eienmosu.truthy.ui.StubStampKind

private fun String.shows(name: String) = this == "all" || this == name

@Composable
fun ComponentGallery(section: String, onToggleTheme: () -> Unit) {
    val dark = TruthyTheme.isDark
    Box(Modifier.fillMaxSize()) {
        SkyBackdrop()
        Box(Modifier.fillMaxSize().safeDrawingPadding(), contentAlignment = Alignment.TopCenter) {
            Column(
                modifier = Modifier
                    .widthIn(max = Tokens.Size.maxWidth)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Tokens.Size.gutter, vertical = Tokens.Space.s16),
                verticalArrangement = Arrangement.spacedBy(Tokens.Space.s16),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Logo(asHeading = true)
                    RoundButton(
                        label = if (dark) "Switch to light theme" else "Switch to dark theme",
                        onClick = onToggleTheme,
                    ) {
                        TruthyIcon(if (dark) IconId.SUN else IconId.MOON)
                    }
                }
                if (section.shows("icons")) IconsSection()
                if (section.shows("buttons")) ButtonsSection()
                if (section.shows("cards")) CardsSection()
                if (section.shows("stamps")) StampsSection()
                if (section.shows("shapes")) ShapesSection()
            }
        }
    }
}

@Composable
private fun Heading(text: String) {
    TruthyText(text, TruthyType.routeLabel, TruthyTheme.colors.ink)
}

@Composable
private fun IconsSection() {
    val colors = TruthyTheme.colors
    Heading("Icons (19 vectors and the route icon)")
    val cells: List<Pair<String, @Composable () -> Unit>> =
        IconId.entries.map { id -> id.name to @Composable { TruthyIcon(id) } } +
            ("ROUTE" to @Composable { RouteIcon() }) +
            ("CLOSE 3" to @Composable { TruthyIcon(IconId.CLOSE, strokeWidth = 3f) })
    cells.chunked(4).forEach { row ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8)) {
            row.forEach { (name, icon) ->
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(Tokens.Radius.small))
                        .background(colors.surfaceRaised)
                        .padding(Tokens.Space.s8),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(Tokens.Space.s6),
                ) {
                    Box(Modifier.height(48.dp), contentAlignment = Alignment.Center) { icon() }
                    TruthyText(name, TruthyType.monoCaption, colors.inkMuted)
                }
            }
        }
    }
}

@Composable
private fun ButtonsSection() {
    val colors = TruthyTheme.colors
    Heading("Buttons")
    BackPill("Back to areas", onClick = {})
    PillButton(
        "Start round",
        onClick = {},
        trailingIcon = { TruthyText("\u2192", TruthyType.button, colors.onDark) },
    )
    PillButton("True", onClick = {}, tone = PillTone.TRUE, leadingIcon = { TruthyIcon(IconId.CHECK, tint = colors.onDark) })
    PillButton("False", onClick = {}, tone = PillTone.FALSE, leadingIcon = { TruthyIcon(IconId.CROSS, tint = colors.onDark) })
    PillButton("Next card", onClick = {}, dimmed = true, trailingIcon = { TruthyText("\u2192", TruthyType.button, colors.onDark) })
    QuietButton("Choose another route", onClick = {}, leadingIcon = { RouteIcon() })
    Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12)) {
        RoundButton("Leave round", onClick = {}) { TruthyIcon(IconId.CLOSE) }
        RoundButton("Close results", onClick = {}, variant = RoundVariant.SUNK) { TruthyIcon(IconId.CLOSE) }
        RoundButton("Disabled", onClick = {}, enabled = false) { TruthyIcon(IconId.BACK_HEADER) }
    }
    Heading("Press tint (pass fields, continue line)")
    val source = remember { MutableInteractionSource() }
    val tint = rememberPressTint(Tokens.Space.s6)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp)
            .clip(RoundedCornerShape(Tokens.Space.s6))
            .background(colors.surfaceRaised)
            .clickable(interactionSource = source, indication = tint) {},
        contentAlignment = Alignment.Center,
    ) {
        TruthyText("Change deck, now CLF", TruthyType.fieldValuePass, colors.ink)
    }
}

@Composable
private fun CardsSection() {
    Heading("Destination cards")
    DestinationCard(DestinationVariant.PLACE, name = "Cloud", sub = "3 decks", label = "Cloud, 3 decks")
    DestinationCard(
        DestinationVariant.DECK,
        name = "CLF",
        code = true,
        detail = "Cloud Practitioner",
        seenPercent = 38,
        stub = CardStub("Cards", "214"),
        label = "CLF, Cloud Practitioner, 214 cards, 38 percent seen",
    )
    DestinationCard(
        DestinationVariant.DECK,
        name = "SAA",
        code = true,
        detail = "Solutions Architect Associate",
        seenPercent = 0,
        stub = CardStub("Cards", "1,024"),
        label = "SAA, Solutions Architect Associate, 1,024 cards, not started",
    )
    DestinationCard(
        DestinationVariant.SECTION,
        name = "SEC",
        code = true,
        detail = "Security and Compliance",
        stub = CardStub("Cards", "48"),
        label = "SEC, Security and Compliance, 48 cards",
    )
    DestinationCard(
        DestinationVariant.CLASS,
        name = "Classic",
        detail = "Correct answers out of 10 cards.",
        stub = CardStub("Best", "9", "of 10"),
        label = "Classic. Correct answers out of 10 cards. Your best: 9 of 10.",
    )
    DestinationCard(
        DestinationVariant.CLASS,
        name = "Streak",
        detail = "Correct answers in a row, until the first wrong one.",
        stub = CardStub("Best", "\u2013", "not played", muted = true),
        label = "Streak. Correct answers in a row, until the first wrong one. Not played yet.",
    )
    DestinationCard(
        DestinationVariant.PLACE,
        name = "Security",
        sub = "No decks yet",
        label = "Security, no decks yet",
        unavailable = true,
    )
}

@Composable
private fun StampsSection() {
    var replay by remember { mutableIntStateOf(0) }
    Heading("Stamps")
    QuietButton("Play the landings again", onClick = { replay++ })
    Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12)) {
        Stamp(StampVerdict.CORRECT, animate = true, replayKey = replay)
        Stamp(StampVerdict.WRONG, animate = true, replayKey = replay)
    }
    Stamp(StampVerdict.NEW_BEST, animate = true, replayKey = replay)
    Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12)) {
        StubStamp(StubStampKind.CORRECT, replayKey = replay)
        StubStamp(StubStampKind.WRONG, replayKey = replay)
    }
    StubStamp(StubStampKind.TIME_UP, replayKey = replay)
    Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12)) {
        IntentStamp(IntentKind.TRUE)
        IntentStamp(IntentKind.FALSE)
    }
}

@Composable
private fun ShapesSection() {
    Heading("Ticket papers, perforation and shadow")
    GalleryTicket()
    Heading("Logo marks (44, 26, compact 20)")
    Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s16), verticalAlignment = Alignment.CenterVertically) {
        LogoMark()
        LogoMark(width = 26.dp)
        LogoMark(width = 20.dp, variant = LogoVariant.COMPACT)
    }
}

/** Height of the main paper of [GalleryTicket]; its bottom corners hold the notches. */
internal val GalleryTicketMainHeight = 160.dp

/** The ticket of the shapes section: a main paper over a lower paper, both notched, with the ticket shadow behind. */
@Composable
internal fun GalleryTicket(modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    Box(modifier.fillMaxWidth().truthyShadow(TruthyTheme.shadows.ticket, Tokens.Radius.card)) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(GalleryTicketMainHeight)
                    .background(colors.surfaceRaised, TicketMainShape())
                    .drawBehind { drawTicketPerforation(colors.rule) },
                contentAlignment = Alignment.Center,
            ) {
                Logo()
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(Tokens.Size.lower)
                    .background(colors.surfaceSunk, TicketLowerShape()),
            )
        }
    }
}
