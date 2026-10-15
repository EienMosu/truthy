package com.eienmosu.truthy

/**
 * The names of what the app stores, shared by the stores of task 9 and the backup rules in res/xml
 * (spec 4.5, reference 6). A rename here must change res/xml/backup_rules.xml and data_extraction_rules.xml too;
 * BackupRulesTest fails otherwise.
 */
object StorageNames {
    /** The web's PROGRESS_KEY with ".json", in filesDir through AtomicFile. Backed up. */
    const val PROGRESS_FILE = "truthy.progress.v1.json"

    /** The web's UNREADABLE_KEY with ".json", in filesDir. Not backed up. */
    const val UNREADABLE_FILE = "truthy.progress.v1.unreadable.json"

    /** The round journal (spec 4.5), in filesDir. Never backed up. */
    const val JOURNAL_FILE = "truthy.round.v1.json"

    /** The SharedPreferences file (truthy.xml on disk) that holds "truthy.theme". Backed up. */
    const val PREFS_FILE = "truthy"
}
