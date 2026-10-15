// The modules apply their own plugins; the versions come from gradle/libs.versions.toml.
plugins {
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}
