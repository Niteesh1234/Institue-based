#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${JAVA_HOME:-}" ]]; then
  if [[ -d "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" ]]; then
    export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  elif [[ -d "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" ]]; then
    export JAVA_HOME="/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  else
    echo "Java 21 was not found. Install it with: brew install openjdk@21" >&2
    exit 1
  fi
fi

if [[ -z "${ANDROID_HOME:-}" ]]; then
  if [[ -d "/opt/homebrew/share/android-commandlinetools" ]]; then
    export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
  elif [[ -d "$HOME/Library/Android/sdk" ]]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  else
    echo "Android SDK was not found. Install Android Studio or android-commandlinetools." >&2
    exit 1
  fi
fi

cd "$project_root"
npm run android:sync

cd android
./gradlew assembleDebug

cd "$project_root"
mkdir -p releases
cp android/app/build/outputs/apk/debug/app-debug.apk releases/Vijetha-Institute-Android-debug.apk
echo "Android APK: $project_root/releases/Vijetha-Institute-Android-debug.apk"
