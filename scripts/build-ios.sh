#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
xcode_path="/Applications/Xcode.app/Contents/Developer"

if [[ ! -x "$xcode_path/usr/bin/xcodebuild" ]]; then
  echo "Full Xcode 26 or newer is required. Install Xcode from the Mac App Store first." >&2
  exit 1
fi

export DEVELOPER_DIR="$xcode_path"
cd "$project_root"
npm run ios:sync

xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -derivedDataPath ios/DerivedData \
  CODE_SIGNING_ALLOWED=NO \
  build

mkdir -p releases
ditto ios/DerivedData/Build/Products/Debug-iphonesimulator/App.app \
  releases/Vijetha-Institute-iOS-Simulator.app

echo "iOS Simulator app: $project_root/releases/Vijetha-Institute-iOS-Simulator.app"
