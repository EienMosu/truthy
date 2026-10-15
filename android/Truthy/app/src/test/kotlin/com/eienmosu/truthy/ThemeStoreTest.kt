package com.eienmosu.truthy

import com.eienmosu.truthy.engine.THEME_KEY
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.support.MemoryPrefs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ThemeStoreTest {
    private val prefs = MemoryPrefs()

    @Test
    fun theKeyAndTheFileAreFixed() {
        assertEquals("truthy.theme", THEME_KEY)
        assertEquals("truthy", ThemeStore.PREFS_NAME)
    }

    @Test
    fun nothingStoredFollowsTheSystem() {
        assertNull(ThemeStore(prefs).stored)
    }

    @Test
    fun lightAndDarkAreRead() {
        prefs.values[THEME_KEY] = "light"
        assertEquals(Theme.LIGHT, ThemeStore(prefs).stored)
        prefs.values[THEME_KEY] = "dark"
        assertEquals(Theme.DARK, ThemeStore(prefs).stored)
    }

    @Test
    fun anyOtherStringFollowsTheSystem() {
        for (value in listOf("night", "", "Dark", " dark", "system")) {
            prefs.values[THEME_KEY] = value
            assertNull(ThemeStore(prefs).stored, value)
        }
    }

    @Test
    fun aValueOfAnotherTypeFollowsTheSystem() {
        prefs.values[THEME_KEY] = 1
        assertNull(ThemeStore(prefs).stored)
    }

    @Test
    fun storeKeepsTheWireValueUnderTheWebKey() {
        val store = ThemeStore(prefs)
        store.store(Theme.DARK)
        assertEquals("dark", prefs.values[THEME_KEY])
        assertEquals(Theme.DARK, ThemeStore(prefs).stored)
        store.store(Theme.LIGHT)
        assertEquals("light", prefs.values[THEME_KEY])
    }

    @Test
    fun aStorageThatRefusesIsNeverAnError() {
        prefs.refuseWrites = true
        ThemeStore(prefs).store(Theme.DARK)
        assertNull(ThemeStore(prefs).stored)
    }
}
