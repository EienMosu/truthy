package com.eienmosu.truthy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Predictive back, backups, the launch theme and the single launcher activity (spec 5.1, 4.5, 5.6). */
class ManifestTest {
    private val manifest = RepoFiles.xml(RepoFiles.main.resolve("AndroidManifest.xml")).documentElement
    private val application = manifest.childElements("application").single()

    @Test
    fun applicationOptsIntoPredictiveBackAndBackups() {
        assertEquals("true", application.android("enableOnBackInvokedCallback"))
        assertEquals("true", application.android("allowBackup"))
        assertEquals("@xml/backup_rules", application.android("fullBackupContent"))
        assertEquals("@xml/data_extraction_rules", application.android("dataExtractionRules"))
    }

    @Test
    fun applicationUsesTheStartingThemeIconAndName() {
        assertEquals("@style/Theme.Truthy.Starting", application.android("theme"))
        assertEquals("@mipmap/ic_launcher", application.android("icon"))
        assertEquals("@string/app_name", application.android("label"))
    }

    @Test
    fun launcherActivityIsMainActivity() {
        val activity = application.childElements("activity").single()
        assertEquals(".MainActivity", activity.android("name"))
        assertEquals("true", activity.android("exported"))
        // A theme switch (UiModeManager.setApplicationNightMode, tasks 8 and 11) must not recreate the activity.
        assertEquals("uiMode", activity.android("configChanges"))
        assertEquals("", activity.android("theme"))
        val filter = activity.childElements("intent-filter").single()
        assertEquals(listOf("android.intent.action.MAIN"), filter.childElements("action").map { it.android("name") })
        assertEquals(
            listOf("android.intent.category.LAUNCHER"),
            filter.childElements("category").map { it.android("name") },
        )
    }

    @Test
    fun asksForNoPermissionAndLocksNoOrientation() {
        assertTrue(manifest.childElements("uses-permission").isEmpty())
        val activity = application.childElements("activity").single()
        assertEquals("", activity.android("screenOrientation"))
    }
}
