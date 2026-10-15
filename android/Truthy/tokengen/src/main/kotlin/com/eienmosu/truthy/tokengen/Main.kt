package com.eienmosu.truthy.tokengen

import java.io.File
import kotlin.system.exitProcess

// Usage: MainKt <resolved.json> <Tokens.kt>. Run by ./gradlew :tokengen:generateTokens.
fun main(args: Array<String>) {
    if (args.size != 2) {
        System.err.println("Usage: MainKt <resolved.json> <Tokens.kt>")
        exitProcess(2)
    }
    val source = File(args[0])
    val target = File(args[1])
    val text = try {
        generateTokens(source.readText())
    } catch (error: TokenException) {
        System.err.println("tokengen failed: ${error.message}")
        exitProcess(1)
    }
    target.parentFile.mkdirs()
    target.writeText(text)
    println("Wrote ${target.name} (${text.lines().size - 1} lines)")
}
