package com.eienmosu.truthy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.w3c.dom.Element

/** Backups keep the progress file and the theme and never the round journal (spec 4.5, reference 6 "Backups"). */
class BackupRulesTest {
    private val expected = setOf(
        "file:${StorageNames.PROGRESS_FILE}",
        "sharedpref:${StorageNames.PREFS_FILE}.xml",
    )

    private fun includes(parent: Element): Set<String> =
        parent.childElements("include").map { "${it.getAttribute("domain")}:${it.getAttribute("path")}" }.toSet()

    @Test
    fun fullBackupIncludesOnlyProgressAndTheme() {
        val root = RepoFiles.resource("xml/backup_rules.xml").documentElement
        assertEquals("full-backup-content", root.tagName)
        assertEquals(expected, includes(root))
        assertEquals(listOf("include", "include"), root.childElements().map { it.tagName })
    }

    @Test
    fun cloudBackupAndDeviceTransferIncludeOnlyProgressAndTheme() {
        val root = RepoFiles.resource("xml/data_extraction_rules.xml").documentElement
        assertEquals("data-extraction-rules", root.tagName)
        assertEquals(listOf("cloud-backup", "device-transfer"), root.childElements().map { it.tagName })
        for (section in root.childElements()) {
            assertEquals(section.tagName, expected, includes(section))
            assertEquals(section.tagName, listOf("include", "include"), section.childElements().map { it.tagName })
        }
    }

    @Test
    fun journalAndSideCopyAreNeverIncluded() {
        val paths = (
            RepoFiles.resource("xml/backup_rules.xml").elements("include") +
                RepoFiles.resource("xml/data_extraction_rules.xml").elements("include")
            ).map { it.getAttribute("path") }
        assertFalse(StorageNames.JOURNAL_FILE in paths)
        assertFalse(StorageNames.UNREADABLE_FILE in paths)
        assertTrue(paths.none { it == "." || it.isEmpty() || it.endsWith("/") })
    }

    @Test
    fun storageNamesFollowTheWebKeys() {
        // src/progress/local.ts PROGRESS_KEY and UNREADABLE_KEY with ".json"; spec 4.5 names the journal.
        assertEquals("truthy.progress.v1.json", StorageNames.PROGRESS_FILE)
        assertEquals("truthy.progress.v1.unreadable.json", StorageNames.UNREADABLE_FILE)
        assertEquals("truthy.round.v1.json", StorageNames.JOURNAL_FILE)
        assertEquals("truthy", StorageNames.PREFS_FILE)
    }
}
