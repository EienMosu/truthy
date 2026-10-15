package com.eienmosu.truthy.support

import android.content.SharedPreferences

// SharedPreferences in memory, with the platform's behaviour where ThemeStore depends on it: a value of
// another type under a key makes getString throw ClassCastException, and an edit lands on apply or commit.
// With refuseWrites, apply and commit throw, as a broken storage might.
class MemoryPrefs : SharedPreferences {
    val values = mutableMapOf<String, Any?>()
    var refuseWrites = false

    override fun getAll(): MutableMap<String, *> = values.toMutableMap()

    override fun getString(key: String?, defValue: String?): String? =
        if (key != null && key in values) values[key] as String? else defValue

    @Suppress("UNCHECKED_CAST")
    override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? =
        if (key != null && key in values) values[key] as MutableSet<String>? else defValues

    override fun getInt(key: String?, defValue: Int): Int = if (key != null && key in values) values[key] as Int else defValue

    override fun getLong(key: String?, defValue: Long): Long = if (key != null && key in values) values[key] as Long else defValue

    override fun getFloat(key: String?, defValue: Float): Float = if (key != null && key in values) values[key] as Float else defValue

    override fun getBoolean(key: String?, defValue: Boolean): Boolean = if (key != null && key in values) values[key] as Boolean else defValue

    override fun contains(key: String?): Boolean = key != null && key in values

    override fun edit(): SharedPreferences.Editor = MemoryEditor()

    override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}

    override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}

    private inner class MemoryEditor : SharedPreferences.Editor {
        private val changes = mutableMapOf<String, Any?>()
        private val removals = mutableSetOf<String>()
        private var clearAll = false

        private fun put(key: String?, value: Any?): SharedPreferences.Editor {
            changes[requireNotNull(key)] = value
            return this
        }

        override fun putString(key: String?, value: String?): SharedPreferences.Editor = put(key, value)

        override fun putStringSet(key: String?, set: MutableSet<String>?): SharedPreferences.Editor = put(key, set)

        override fun putInt(key: String?, value: Int): SharedPreferences.Editor = put(key, value)

        override fun putLong(key: String?, value: Long): SharedPreferences.Editor = put(key, value)

        override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = put(key, value)

        override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = put(key, value)

        override fun remove(key: String?): SharedPreferences.Editor {
            removals += requireNotNull(key)
            return this
        }

        override fun clear(): SharedPreferences.Editor {
            clearAll = true
            return this
        }

        override fun commit(): Boolean {
            write()
            return true
        }

        override fun apply() {
            write()
        }

        private fun write() {
            check(!refuseWrites) { "the storage refuses writes" }
            if (clearAll) values.clear()
            removals.forEach { values.remove(it) }
            values.putAll(changes)
        }
    }
}
