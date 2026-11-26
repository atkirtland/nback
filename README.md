# N-Back for Android

A native Android N-back training game built with Kotlin and Jetpack Compose.

Features include position, audio, color, and shape modalities; adjustable difficulty;
automatic level progression; detailed scoring; progress charts; and JSON backup and restore.

Scores use Brain Workshop's default formula: `hits / (hits + misses + false alarms) × 100`,
pooling counts across enabled modalities. Correct rejections do not affect the score;
a zero denominator scores 0%. Default win/loss thresholds are 80%/50%. Existing custom
thresholds and consecutive-win/loss settings are preserved. Older records keep their
original accuracy and outcomes and are excluded from the new score averages and charts.

## Build

Open the repository in Android Studio, or run:

```sh
./gradlew assembleDebug
```

The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`.

The project requires JDK 17 and Android SDK 35.
