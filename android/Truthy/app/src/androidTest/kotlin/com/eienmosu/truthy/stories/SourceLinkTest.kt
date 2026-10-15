package com.eienmosu.truthy.stories

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.espresso.intent.Intents
import androidx.test.espresso.intent.Intents.intended
import androidx.test.espresso.intent.Intents.intending
import androidx.test.espresso.intent.matcher.IntentMatchers.hasAction
import androidx.test.espresso.intent.matcher.IntentMatchers.hasData
import androidx.test.espresso.intent.matcher.IntentMatchers.hasExtraWithKey
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.SETTLE_MS
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.button
import org.hamcrest.Matchers.allOf
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SourceLinkTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun setUp() {
        Device.reset()
        Intents.init()
        intending(hasAction(Intent.ACTION_VIEW)).respondWith(Instrumentation.ActivityResult(Activity.RESULT_OK, null))
    }

    @After fun tearDown() = Intents.release()

    @Test fun theSourceLinkOfTheSlipOpensACustomTab() {
        Device.launch().use {
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            val card = ui.cardOnScreen(DeckAnswers(CLF_ID))
            SystemClock.sleep(SETTLE_MS)
            ui.answer(card, right = true)
            ui.waitFor(button("Next card"))

            ui.tapScrolled(button("${card.source.title} (opens in browser)"))
            intended(
                allOf(
                    hasAction(Intent.ACTION_VIEW),
                    hasData(Uri.parse(card.source.url)),
                    hasExtraWithKey(CustomTabsIntent.EXTRA_SESSION),
                ),
            )
        }
    }
}
