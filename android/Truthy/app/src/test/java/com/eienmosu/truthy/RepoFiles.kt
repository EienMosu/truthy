package com.eienmosu.truthy

import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.w3c.dom.Document
import org.w3c.dom.Element

const val ANDROID_NS = "http://schemas.android.com/apk/res/android"

/** Files of the repository, found through the truthy.repo system property that app/build.gradle.kts sets. */
object RepoFiles {
    val root: File = File(
        System.getProperty("truthy.repo") ?: error("truthy.repo is not set: run the tests through Gradle"),
    )
    val main: File = root.resolve("android/Truthy/app/src/main")
    val resDir: File = main.resolve("res")

    fun xml(file: File): Document {
        require(file.isFile) { "missing ${file.relativeTo(root)}" }
        val factory = DocumentBuilderFactory.newInstance()
        factory.isNamespaceAware = true
        return factory.newDocumentBuilder().parse(file)
    }

    /** A resource file by its path under res, for example "values/colors.xml". */
    fun resource(path: String): Document = xml(resDir.resolve(path))

    private val tokens: JsonObject by lazy {
        Json.parseToJsonElement(root.resolve("native-data/tokens/resolved.json").readText()).jsonObject
    }

    /** The hex value of a colour token, following aliases: tokenColor("color.day.surface") is "#c4e3f5". */
    fun tokenColor(path: String): String {
        var current = path
        repeat(8) {
            val value = node(current).jsonObject.getValue("\$value")
            if (value is JsonPrimitive && value.isString) {
                current = value.content.removePrefix("{").removeSuffix("}")
            } else {
                return value.jsonObject.getValue("hex").jsonPrimitive.content.lowercase()
            }
        }
        error("alias chain too long at $path")
    }

    private fun node(path: String): JsonElement =
        path.split('.').fold<String, JsonElement>(tokens) { element, key ->
            element.jsonObject[key] ?: error("no token at $path")
        }
}

fun Document.elements(tag: String): List<Element> {
    val nodes = getElementsByTagName(tag)
    return (0 until nodes.length).map { nodes.item(it) as Element }
}

fun Element.childElements(tag: String? = null): List<Element> {
    val nodes = childNodes
    return (0 until nodes.length)
        .map { nodes.item(it) }
        .filterIsInstance<Element>()
        .filter { tag == null || it.tagName == tag }
}

/** An android: attribute, or "" when it is absent. */
fun Element.android(name: String): String = getAttributeNS(ANDROID_NS, name)

/** The text of the resource of this kind and name in a values file, for example value("color", "truthy_surface"). */
fun Document.value(tag: String, name: String): String =
    elements(tag).single { it.getAttribute("name") == name }.textContent.trim()

data class Style(val parent: String, val items: Map<String, String>)

fun Document.style(name: String): Style {
    val element = elements("style").single { it.getAttribute("name") == name }
    return Style(
        parent = element.getAttribute("parent"),
        items = element.childElements("item").associate { it.getAttribute("name") to it.textContent.trim() },
    )
}
