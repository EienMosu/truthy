package com.eienmosu.truthy.tokengen

import java.math.BigDecimal
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// Turns native-data/tokens/resolved.json (the design tokens in the DTCG shape of design/system/tokens.json,
// with the code's overrides applied) into the text of Tokens.kt. Pure: no file access, no clock.

class TokenException(message: String) : Exception(message)

private const val DESIGN_PACKAGE = "com.eienmosu.truthy.design"
private const val TYPE_KEY = "\$type"
private const val VALUE_KEY = "\$value"

private val REFERENCE = Regex("^\\{([^{}]+)\\}$")
private val NUMBER = Regex("^-?\\d+(\\.\\d+)?$")
private val INTEGER = Regex("^\\d{3,4}$")
private val HEX = Regex("^#([0-9a-fA-F]{6})$")
private val NAME = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")

private val KEYWORDS = setOf(
    "as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if", "in", "interface", "is",
    "null", "object", "package", "return", "super", "this", "throw", "true", "try", "typealias", "typeof",
    "val", "var", "when", "while",
)

private fun fail(path: String, problem: String): Nothing = throw TokenException("Token $path $problem")

private fun stringOrNull(element: JsonElement?): String? =
    (element as? JsonPrimitive)?.takeIf { it.isString }?.content

private class Token(val path: String, val type: String?, val value: JsonElement)

// Every token by dotted path, in file order, and the dotted paths of the groups.
private class Registry(root: JsonObject) {
    val tokens = LinkedHashMap<String, Token>()
    val groups = HashSet<String>()

    init {
        collect(root, "", null)
    }

    private fun collect(node: JsonObject, path: String, inherited: String?) {
        val type = stringOrNull(node[TYPE_KEY]) ?: inherited
        val value = node[VALUE_KEY]
        if (value != null) {
            tokens[path] = Token(path, type, value)
            return
        }
        groups.add(path)
        for ((key, child) in node) {
            if (key.startsWith('$') || child !is JsonObject) continue
            collect(child, if (path.isEmpty()) key else "$path.$key", type)
        }
    }

    fun token(path: String): Token = tokens[path] ?: throw TokenException("Required token $path is missing")

    // The tokens directly below a group, as (name, token), in file order.
    fun members(group: String): List<Pair<String, Token>> {
        if (group !in groups) throw TokenException("Required token group $group is missing")
        val prefix = "$group."
        val found = tokens.values.filter { it.path.startsWith(prefix) }.map { it.path.removePrefix(prefix) to it }
        if (found.isEmpty()) throw TokenException("Required token group $group has no tokens")
        return found
    }

    // Follows "{a.b.c}" references until a literal value.
    fun deref(raw: JsonElement, holder: String, chain: List<String> = listOf(holder)): JsonElement {
        val text = stringOrNull(raw) ?: return raw
        val match = REFERENCE.matchEntire(text)
        if (match == null) {
            if (text.contains('{') || text.contains('}')) fail(holder, "has a malformed reference: $text")
            return raw
        }
        val target = match.groupValues[1]
        val token = tokens[target]
        if (token == null) {
            if (target in groups) fail(holder, "refers to {$target}, which is a group, not a token")
            fail(holder, "refers to {$target}, which does not exist")
        }
        if (target in chain) fail(chain[0], "has a circular reference: ${(chain + target).joinToString(" -> ")}")
        return deref(token.value, holder, chain + target)
    }
}

private fun expectType(token: Token, expected: String) {
    if (token.type != expected) fail(token.path, "has type ${token.type}, expected $expected")
}

private fun JsonElement.asObject(holder: String, what: String): JsonObject =
    this as? JsonObject ?: fail(holder, "has $what that is not an object")

private fun numberText(element: JsonElement?, holder: String): String {
    val primitive = element as? JsonPrimitive
    if (primitive == null || primitive.isString || !NUMBER.matches(primitive.content)) {
        fail(holder, "has a value that is not a plain decimal number")
    }
    return primitive.content
}

private fun floatText(number: String): String = "${number}f"

// A px dimension as "<n>.dp".
private fun dp(registry: Registry, raw: JsonElement, holder: String): String {
    val measure = registry.deref(raw, holder).asObject(holder, "a dimension")
    val unit = stringOrNull(measure["unit"])
    if (unit != "px") fail(holder, "has a dimension unit $unit, expected px")
    return "${numberText(measure["value"], holder)}.dp"
}

// A px dimension as a Float literal, for sp values.
private fun pxFloat(registry: Registry, raw: JsonElement, holder: String): String {
    val measure = registry.deref(raw, holder).asObject(holder, "a dimension")
    val unit = stringOrNull(measure["unit"])
    if (unit != "px") fail(holder, "has a dimension unit $unit, expected px")
    return floatText(numberText(measure["value"], holder))
}

private fun milliseconds(registry: Registry, raw: JsonElement, holder: String): String {
    val measure = registry.deref(raw, holder).asObject(holder, "a duration")
    val value = BigDecimal(numberText(measure["value"], holder))
    val millis = when (val unit = stringOrNull(measure["unit"])) {
        "ms" -> value
        "s" -> value.multiply(BigDecimal(1000))
        else -> fail(holder, "has a duration unit $unit, expected ms or s")
    }
    val whole = millis.stripTrailingZeros()
    if (whole.scale() > 0 || whole.signum() < 0) fail(holder, "has a duration that is not a whole number of milliseconds")
    return whole.toPlainString()
}

private fun colorExpression(registry: Registry, raw: JsonElement, holder: String): String {
    val color = registry.deref(raw, holder).asObject(holder, "a color")
    val space = stringOrNull(color["colorSpace"])
    if (space != null && space != "srgb") fail(holder, "uses color space $space, only srgb is supported")
    val hex = stringOrNull(color["hex"]) ?: fail(holder, "has a color without a hex value")
    val match = HEX.matchEntire(hex) ?: fail(holder, "has a hex color that is not #rrggbb: $hex")
    val opaque = "Color(0xFF${match.groupValues[1].uppercase()})"
    val alphaElement = color["alpha"] ?: return opaque
    val alpha = numberText(alphaElement, holder)
    val value = BigDecimal(alpha)
    if (value < BigDecimal.ZERO || value > BigDecimal.ONE) fail(holder, "has an alpha outside 0 to 1")
    return if (value.compareTo(BigDecimal.ONE) == 0) opaque else "$opaque.copy(alpha = ${floatText(alpha)})"
}

private fun cubicBezier(registry: Registry, raw: JsonElement, holder: String): String {
    val array = registry.deref(raw, holder) as? JsonArray ?: fail(holder, "has a cubic bezier that is not a list")
    if (array.size != 4) fail(holder, "has a cubic bezier that is not four numbers")
    val numbers = array.map { numberText(it, holder) }
    if (numbers[0].toDouble() !in 0.0..1.0 || numbers[2].toDouble() !in 0.0..1.0) {
        fail(holder, "has a cubic bezier with an x value outside 0 to 1")
    }
    return "CubicBezierEasing(${numbers.joinToString(", ") { floatText(it) }})"
}

// A reference to motion.easing.<name> stays a reference (Curves.<name>); anything else is written out.
private fun easingExpression(registry: Registry, raw: JsonElement, holder: String): String {
    val target = stringOrNull(raw)?.let { REFERENCE.matchEntire(it) }?.groupValues?.get(1)
    if (target != null && target.startsWith("motion.easing.")) {
        registry.token(target)
        return "Curves.${identifier(target.removePrefix("motion.easing."), "motion.easing", null)}"
    }
    return cubicBezier(registry, raw, holder)
}

private fun transition(registry: Registry, token: Token): String {
    expectType(token, "transition")
    val value = token.value.asObject(token.path, "a transition value")
    fun field(name: String): JsonElement = value[name] ?: fail(token.path, "is missing $name")
    val duration = milliseconds(registry, field("duration"), token.path)
    val delay = milliseconds(registry, field("delay"), token.path)
    val easing = easingExpression(registry, field("timingFunction"), token.path)
    return "TransitionSpec(durationMs = $duration, delayMs = $delay, easing = $easing)"
}

private fun typeRole(registry: Registry, token: Token): String {
    expectType(token, "typography")
    val role = token.value.asObject(token.path, "a typography value")
    fun field(name: String): JsonElement = role[name] ?: fail(token.path, "is missing $name")
    val family = when (stringOrNull(field("fontFamily"))) {
        "{font.family.sans}" -> "SANS"
        "{font.family.mono}" -> "MONO"
        else -> fail(token.path, "has a font family that is not {font.family.sans} or {font.family.mono}")
    }
    val weight = numberText(registry.deref(field("fontWeight"), token.path), token.path)
    if (!INTEGER.matches(weight)) fail(token.path, "has a font weight that is not a whole number from 100 to 1000")
    val size = pxFloat(registry, field("fontSize"), token.path)
    val lineHeight = floatText(numberText(registry.deref(field("lineHeight"), token.path), token.path))
    val spacing = pxFloat(registry, field("letterSpacing"), token.path)
    return "TypeRole(family = FontKey.$family, weight = $weight, sizeSp = $size, lineHeight = $lineHeight, letterSpacingSp = $spacing)"
}

private fun shadowLayers(registry: Registry, token: Token): List<String> {
    expectType(token, "shadow")
    val raw = registry.deref(token.value, token.path)
    val layers = if (raw is JsonArray) raw.toList() else listOf(raw)
    if (layers.isEmpty()) fail(token.path, "has a shadow with no layers")
    return layers.map { element ->
        val layer = element.asObject(token.path, "a shadow layer")
        fun field(name: String): JsonElement = layer[name] ?: fail(token.path, "is missing $name")
        if ((layer["inset"] as? JsonPrimitive)?.content == "true") {
            fail(token.path, "has an inset shadow, which the app does not draw")
        }
        "ShadowLayer(" +
            "offsetX = ${dp(registry, field("offsetX"), token.path)}, " +
            "offsetY = ${dp(registry, field("offsetY"), token.path)}, " +
            "blur = ${dp(registry, field("blur"), token.path)}, " +
            "spread = ${dp(registry, field("spread"), token.path)}, " +
            "color = ${colorExpression(registry, field("color"), token.path)})"
    }
}

// "sky-1" is sky1, "on-accent" is onAccent, "2" is s2. A Kotlin keyword gets the suffix, or fails without one.
private fun identifier(name: String, group: String, keywordSuffix: String?): String {
    if (!NAME.matches(name)) fail("$group.$name", "has a name that is not lowercase letters, digits and hyphens")
    val parts = name.split('-')
    var id = parts.first() + parts.drop(1).joinToString("") { part -> part.replaceFirstChar { it.uppercaseChar() } }
    if (id.first().isDigit()) id = "s$id"
    if (id in KEYWORDS) {
        if (keywordSuffix == null) fail("$group.$name", "would be the Kotlin keyword $id")
        id += keywordSuffix
    }
    return id
}

private fun checkUnique(ids: List<String>, group: String) {
    val seen = HashSet<String>()
    for (id in ids) if (!seen.add(id)) fail(group, "would produce $id a second time")
}

private class Writer {
    private val lines = ArrayList<String>()

    fun line(text: String = "", depth: Int = 0) {
        lines.add(if (text.isEmpty()) "" else "    ".repeat(depth) + text)
    }

    fun text(): String = lines.joinToString("\n") + "\n"
}

private class Member(val declaration: String, val expression: String)

// One flat object of the Tokens object: one member per token of the group.
private fun Writer.flatObject(registry: Registry, name: String, group: String, member: (Token) -> Member) {
    val members = registry.members(group)
    val ids = members.map { identifier(it.first, group, null) }
    checkUnique(ids, group)
    line("object $name {", 1)
    members.forEachIndexed { index, (_, token) ->
        val built = member(token)
        line("${built.declaration} ${ids[index]} = ${built.expression}", 2)
    }
    line("}", 1)
}

// The names of a day group, after checking that the night group has exactly the same ones.
private fun themedNames(registry: Registry, day: String, night: String): List<String> {
    val dayNames = registry.members(day).map { it.first }
    val nightNames = registry.members(night).map { it.first }
    val missing = dayNames.filter { it !in nightNames }
    val extra = nightNames.filter { it !in dayNames }
    if (missing.isNotEmpty()) throw TokenException("Token group $night is missing ${missing.joinToString(", ")}")
    if (extra.isNotEmpty()) throw TokenException("Token group $night has ${extra.joinToString(", ")} with no day value")
    return dayNames
}

private fun Writer.colorsClass(names: List<String>) {
    val ids = names.map { identifier(it, "color.day", "Color") }
    checkUnique(ids, "color.day")
    line("@Immutable")
    line("class TruthyColors(")
    for (id in ids) line("val $id: Color,", 1)
    line(")")
}

private fun Writer.colorsObject(registry: Registry, names: List<String>) {
    val ids = names.map { identifier(it, "color.day", "Color") }
    line("object Colors {", 1)
    for ((label, group) in listOf("day" to "color.day", "night" to "color.night")) {
        line("val $label = TruthyColors(", 2)
        names.forEachIndexed { index, name ->
            val token = registry.token("$group.$name")
            expectType(token, "color")
            line("${ids[index]} = ${colorExpression(registry, token.value, token.path)},", 3)
        }
        line(")", 2)
    }
    line("}", 1)
}

private fun Writer.shadowsClass(names: List<String>) {
    val ids = names.map { identifier(it, "elevation.day", null) }
    checkUnique(ids, "elevation.day")
    line("@Immutable")
    line("class TruthyShadows(")
    for (id in ids) line("val $id: ShadowSpec,", 1)
    line(")")
}

private fun Writer.shadowsObject(registry: Registry, names: List<String>) {
    val ids = names.map { identifier(it, "elevation.day", null) }
    line("object Shadows {", 1)
    for ((label, group) in listOf("day" to "elevation.day", "night" to "elevation.night")) {
        line("val $label = TruthyShadows(", 2)
        names.forEachIndexed { index, name ->
            line("${ids[index]} = ShadowSpec(", 3)
            line("listOf(", 4)
            for (layer in shadowLayers(registry, registry.token("$group.$name"))) line("$layer,", 5)
            line("),", 4)
            line("),", 3)
        }
        line(")", 2)
    }
    line("}", 1)
}

// The additive top-level group "native" of plan A: plain numbers by path (not DTCG, no $value), the values the web
// keeps in component code (reference 5.0 and 5.3). Emitted once as Tokens.Native, so no composable types them again.
private val WHOLE = Regex("^\\d+$")

private val NATIVE_TYPE = listOf(
    "stubStampSize" to listOf("type", "stub-stamp-size"),
    "newBestSize" to listOf("type", "new-best-size"),
    "missedExplanationSize" to listOf("type", "missed-explanation-size"),
    "missedAnswerSize" to listOf("type", "missed-answer-size"),
    "carrierCompactTitle" to listOf("type", "carrier-compact", "title"),
    "carrierCompactLabel" to listOf("type", "carrier-compact", "label"),
    "sourceLinkSize" to listOf("type", "source-link-size"),
    "scoreUnitSize" to listOf("type", "score-unit-size"),
    "timedClockSize" to listOf("type", "timed-clock-size"),
    "stubValueSize" to listOf("type", "stub-value", "size"),
    "stubValueLineHeight" to listOf("type", "stub-value", "lineHeight"),
    "continueDeckLineHeight" to listOf("type", "continue-deck-line-height"),
)

private fun nativeNumber(native: JsonObject, path: List<String>): String {
    val name = "native.${path.joinToString(".")}"
    var node: JsonElement = native
    for (key in path) node = (node as? JsonObject)?.get(key) ?: throw TokenException("Required value $name is missing")
    return numberText(node, name)
}

private fun Writer.nativeObject(root: JsonObject) {
    val native = root["native"] as? JsonObject ?: throw TokenException("Required token group native is missing")
    fun number(vararg path: String): String = nativeNumber(native, path.toList())
    val stops = native["sky-stops"] as? JsonArray ?: throw TokenException("Required value native.sky-stops is missing")
    if (stops.isEmpty()) fail("native.sky-stops", "has no stops")
    val reducedMs = number("sheet", "duration-reduced-ms")
    if (!WHOLE.matches(reducedMs)) fail("native.sheet.duration-reduced-ms", "is not a whole number of milliseconds")
    line("object Native {", 1)
    line("val skyStops: List<Float> = listOf(${stops.joinToString(", ") { floatText(numberText(it, "native.sky-stops")) }})", 2)
    line("val sheetOffsetY = ${number("sheet", "offset-y")}.dp", 2)
    line("const val sheetReducedMs: Int = $reducedMs", 2)
    line("val sheetMinWidth = ${number("sheet", "min-width")}.dp", 2)
    line("val shortScreenBelow = ${number("safe-area-short", "below-height")}.dp", 2)
    line("val shortSafeTop = ${number("safe-area-short", "top")}.dp", 2)
    line("val shortSafeBottom = ${number("safe-area-short", "bottom")}.dp", 2)
    line("val stepTitleRow = ${number("step-title-row")}.dp", 2)
    line("object Type {", 2)
    for ((name, path) in NATIVE_TYPE) line("const val $name: Float = ${floatText(nativeNumber(native, path))}", 3)
    line("}", 2)
    line("}", 1)
}

fun generateTokens(resolvedJson: String): String {
    val parsed = try {
        Json.parseToJsonElement(resolvedJson)
    } catch (error: Exception) {
        throw TokenException("The token file is not valid JSON: ${error.message}")
    }
    val root = parsed as? JsonObject ?: throw TokenException("The design tokens must be a JSON object")
    val registry = Registry(root)

    val colorNames = themedNames(registry, "color.day", "color.night")
    val shadowNames = themedNames(registry, "elevation.day", "elevation.night")

    val out = Writer()
    out.line("// Generated by :tokengen from native-data/tokens/resolved.json. Do not edit by hand.")
    out.line("// Regenerate with: cd android/Truthy && ./gradlew :tokengen:generateTokens")
    out.line()
    out.line("package $DESIGN_PACKAGE")
    out.line()
    out.line("import androidx.compose.animation.core.CubicBezierEasing")
    out.line("import androidx.compose.runtime.Immutable")
    out.line("import androidx.compose.ui.graphics.Color")
    out.line("import androidx.compose.ui.unit.dp")
    out.line()
    out.colorsClass(colorNames)
    out.line()
    out.shadowsClass(shadowNames)
    out.line()
    out.line("object Tokens {")
    out.colorsObject(registry, colorNames)
    out.line()
    out.shadowsObject(registry, shadowNames)
    out.line()
    out.flatObject(registry, "Space", "space") { token ->
        expectType(token, "dimension")
        Member("val", dp(registry, token.value, token.path))
    }
    out.line()
    out.flatObject(registry, "Size", "size") { token ->
        expectType(token, "dimension")
        Member("val", dp(registry, token.value, token.path))
    }
    out.line()
    out.flatObject(registry, "Radius", "radius") { token ->
        expectType(token, "dimension")
        Member("val", dp(registry, token.value, token.path))
    }
    out.line()
    out.flatObject(registry, "Stroke", "stroke") { token ->
        expectType(token, "dimension")
        Member("val", dp(registry, token.value, token.path))
    }
    out.line()
    out.flatObject(registry, "Opacity", "opacity") { token ->
        expectType(token, "number")
        Member("const val", floatText(numberText(registry.deref(token.value, token.path), token.path)))
    }
    out.line()
    out.flatObject(registry, "Duration", "motion.duration") { token ->
        expectType(token, "duration")
        Member("const val", milliseconds(registry, token.value, token.path))
    }
    out.line()
    out.flatObject(registry, "Curves", "motion.easing") { token ->
        expectType(token, "cubicBezier")
        Member("val", cubicBezier(registry, token.value, token.path))
    }
    out.line()
    out.flatObject(registry, "SpringTransitions", "motion.spring") { token -> Member("val", transition(registry, token)) }
    out.line()
    out.flatObject(registry, "Transitions", "motion.transition") { token -> Member("val", transition(registry, token)) }
    out.line()
    out.flatObject(registry, "Gesture", "motion.gesture") { token ->
        when (token.type) {
            "dimension" -> Member("val", dp(registry, token.value, token.path))
            "number" -> Member("const val", floatText(numberText(registry.deref(token.value, token.path), token.path)))
            else -> fail(token.path, "has type ${token.type}, expected dimension or number")
        }
    }
    out.line()
    out.flatObject(registry, "Type", "typography") { token -> Member("val", typeRole(registry, token)) }
    out.line()
    out.nativeObject(root)
    out.line("}")
    return out.text()
}
