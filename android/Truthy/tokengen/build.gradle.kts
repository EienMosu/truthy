import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlin.jvm)
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(libs.kotlinx.serialization.json)
    testImplementation(libs.junit)
}

// Where the generator reads and writes, computed from the project directory. Nothing here is a
// path written into a committed file.
val repoRoot = rootProject.projectDir.resolve("../..").canonicalFile
val resolvedTokens = repoRoot.resolve("native-data/tokens/resolved.json")
val committedTokens = rootProject.projectDir.resolve("app/src/main/kotlin/com/eienmosu/truthy/design/Tokens.kt")

tasks.test {
    systemProperty("truthy.tokens.resolved", resolvedTokens.path)
    systemProperty("truthy.tokens.committed", committedTokens.path)
    // files(...) and not file(...): the committed file does not exist before the first generation.
    inputs.files(resolvedTokens)
    inputs.files(committedTokens)
}

tasks.register<JavaExec>("generateTokens") {
    group = "truthy"
    description = "Writes Tokens.kt from native-data/tokens/resolved.json."
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass.set("com.eienmosu.truthy.tokengen.MainKt")
    args(resolvedTokens.path, committedTokens.path)
    inputs.files(resolvedTokens)
    outputs.files(committedTokens)
}
