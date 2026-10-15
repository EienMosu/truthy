package com.eienmosu.truthy.design

import java.io.File

/** Reads a file of the web app, relative to the repository root that the Gradle test task passes in. */
object WebSource {
    fun read(relative: String): String {
        val root = requireNotNull(System.getProperty("truthy.repo")) {
            "The system property truthy.repo is missing; it is set in app/build.gradle.kts"
        }
        return File(root, relative).readText()
    }
}
