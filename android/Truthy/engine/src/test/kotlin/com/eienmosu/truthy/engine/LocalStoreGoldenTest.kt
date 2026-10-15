package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.GoldenDecode.field
import com.eienmosu.truthy.engine.GoldenDecode.isNull
import com.eienmosu.truthy.engine.GoldenDecode.string
import com.eienmosu.truthy.engine.GoldenDecode.strings
import com.eienmosu.truthy.engine.ProgressGolden.exactly
import com.eienmosu.truthy.engine.ProgressGolden.progress
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject

// native-data/golden/src.progress.local.*.json. The createLocalStore cases are scripts over a storage held as
// plain data: steps run in order, and the output is what each load returned and the storage at the end.
//   load: store.load() into loads; save: store.save(progress); resave: store.save(store.load());
//   put: the script writes a key straight into the storage; breakGet: every getItem throws from here on;
//   breakSet: setItem throws from here on for the listed keys, or for every key when keys is "all".
// "storage": null is createLocalStore(null).
private class StorageBroken : Exception("storage broken")

private class ScriptStorage(initial: Map<String, String>) : KeyValueStorage {
  val items = LinkedHashMap(initial)
  var getBroken = false
  var setBroken: Set<String> = emptySet()
  var setBrokenForAll = false

  override fun getItem(key: String): String? {
    if (getBroken) throw StorageBroken()
    return items[key]
  }

  override fun setItem(key: String, value: String) {
    if (setBrokenForAll || key in setBroken) throw StorageBroken()
    items[key] = value
  }
}

class LocalStoreGoldenTest {
  // The stored progress is compared as a JSON value (Kotlin may write a rare number differently); any other
  // value exactly.
  private fun sameStoredValue(got: String, expected: String): Boolean {
    if (got == expected) return true
    val a = parseJson(got)
    return a is JsonValue.Obj && a == parseJson(expected)
  }

  @Test fun keys() {
    assertEquals(string(Golden.load("src/progress/local", "PROGRESS_KEY").cases.single().output), PROGRESS_KEY)
    assertEquals(string(Golden.load("src/progress/local", "UNREADABLE_KEY").cases.single().output), UNREADABLE_KEY)
  }

  @Test fun createLocalStoreScripts() {
    val file = Golden.load("src/progress/local", "createLocalStore")
    assertTrue(file.cases.isNotEmpty())
    val failures = mutableListOf<String>()
    for (c in file.cases) {
      val spec = field(c.input, "storage")
      val storage = if (isNull(spec)) null else ScriptStorage(field(spec, "items").jsonObject.mapValues { (_, v) -> string(v) })
      val store = createLocalStore(storage)
      val loads = mutableListOf<Progress>()
      for (step in field(c.input, "steps").jsonArray) {
        when (val op = string(field(step, "op"))) {
          "load" -> {
            loads.add(store.load())
          }
          "save" -> {
            store.save(progress(field(step, "progress")))
          }
          "resave" -> {
            store.save(store.load())
          }
          "put" -> {
            storage?.items?.put(string(field(step, "key")), string(field(step, "value")))
          }
          "breakGet" -> {
            storage?.getBroken = true
          }
          "breakSet" -> {
            val keys = field(step, "keys")
            if (keys is JsonPrimitive && keys.isString && keys.content == "all") {
              storage?.setBrokenForAll = true
            } else {
              storage?.setBroken = strings(keys).toSet()
            }
          }
          else -> error("${c.name}: unknown op $op")
        }
      }
      val expectedLoads = field(c.output, "loads").jsonArray.map { progress(it) }
      if (loads.size != expectedLoads.size) failures.add("${c.name}: ${loads.size} loads, want ${expectedLoads.size}")
      loads.zip(expectedLoads).forEachIndexed { i, (got, want) ->
        if (!exactly(got, want)) failures.add("${c.name}: load $i is $got")
      }
      val expectedItems = field(c.output, "items")
      if (isNull(expectedItems)) {
        if (storage != null) failures.add("${c.name}: a storage where none was expected")
        continue
      }
      if (storage == null) {
        failures.add("${c.name}: no storage")
        continue
      }
      val want = expectedItems.jsonObject.mapValues { (_, v) -> string(v) }
      if (storage.items.keys != want.keys) failures.add("${c.name}: keys ${storage.items.keys}")
      for ((key, value) in want) {
        val got = storage.items[key] ?: ""
        if (!sameStoredValue(got, value)) failures.add("${c.name}: $key is $got")
      }
    }
    assertEquals(emptyList<String>(), failures)
  }
}
