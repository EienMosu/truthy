package com.eienmosu.truthy.round

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.espresso.intent.Intents
import androidx.test.espresso.intent.matcher.IntentMatchers.anyIntent
import androidx.test.espresso.intent.matcher.IntentMatchers.hasAction
import androidx.test.espresso.intent.matcher.IntentMatchers.hasData
import androidx.test.espresso.intent.matcher.IntentMatchers.hasExtra
import androidx.test.espresso.intent.matcher.IntentMatchers.hasExtraWithKey
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.resolvedTheme
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.reduce
import org.hamcrest.CoreMatchers.allOf
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SourceLinkIntentTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Before
    fun stubTheBrowser() {
        Intents.init()
        Intents.intending(anyIntent()).respondWith(Instrumentation.ActivityResult(Activity.RESULT_OK, null))
    }

    @After
    fun releaseIntents() {
        Intents.release()
    }

    @Test
    fun aSourceOpensAsACustomTabInTheAppsNightColours() {
        val night = resolvedTheme(Theme.DARK)
        rule.runOnUiThread { openSource(rule.activity, URL, night.colors, night.isDark) }
        Intents.intended(
            allOf(
                hasAction(Intent.ACTION_VIEW),
                hasData(Uri.parse(URL)),
                hasExtraWithKey(CustomTabsIntent.EXTRA_SESSION),
                hasExtra(CustomTabsIntent.EXTRA_COLOR_SCHEME, CustomTabsIntent.COLOR_SCHEME_DARK),
                hasExtra(CustomTabsIntent.EXTRA_TOOLBAR_COLOR, night.colors.surface.toArgb()),
            ),
        )
    }

    @Test
    fun theSlipsSourceLinkOpensTheInAppBrowser() {
        val start = RoundTestData.start(Mode.CLASSIC)
        val card = currentCard(start)!!
        val answered = reduce(start, RoundEvent.Answer(card.answer, 10_000.0))
        rule.setContent {
            TruthyTheme(resolvedTheme(Theme.LIGHT)) {
                RoundScreen(
                    round = answered,
                    ticket = RoundTestData.ticket(Mode.CLASSIC),
                    cardShownAt = { RoundTestState.SETTLED },
                    onAnswer = {},
                    onNext = {},
                    onRequestLeave = {},
                    reducedMotion = false,
                    haptics = {},
                )
            }
        }
        rule.onNodeWithContentDescription("${card.source.title} (opens in browser)").performScrollTo().performClick()
        Intents.intended(allOf(hasAction(Intent.ACTION_VIEW), hasData(Uri.parse(card.source.url)), hasExtraWithKey(CustomTabsIntent.EXTRA_SESSION)))
    }

    private companion object {
        const val URL = "https://example.com/docs/1"
    }
}
