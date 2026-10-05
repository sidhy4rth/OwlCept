plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

// The app shows the same OwlCept Check page as the website, bundled offline.
// Build it first with `npm run build -w @owlcept/web` from the repo root.
val webDist = rootProject.file("../web/dist")
val webAssets = layout.buildDirectory.dir("generated/webAssets")

val copyWebChecker by tasks.registering(Copy::class) {
    doFirst {
        check(webDist.resolve("index.html").exists()) {
            "web/dist is missing. Run `npm run build -w @owlcept/web` in the repo root first."
        }
    }
    from(webDist)
    into(webAssets.map { it.dir("web") })
}

android {
    namespace = "com.owlcept.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.owlcept.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "0.3.0"
    }

    sourceSets["main"].assets.srcDir(webAssets)

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

tasks.named("preBuild") { dependsOn(copyWebChecker) }

dependencies {
    implementation(libs.androidx.webkit)
}
