### Task 7: The Xcode project, Info.plist, fonts, the app icon and the launch colour

This task creates `ios/Truthy`, the app project every later app task builds in: the targets `Truthy`, `TruthyTests` and `TruthyUITests` as synchronized folders (objectVersion 77, as The Slow Wire), the local package dependency on `ios/TruthyEngine`, the folder reference to `native-data/decks` (spec D3 and 4.1: referenced in place, never copied), a physical `Info.plist` (bundle id, display name, orientations, the launch screen colour, the four fonts, the 120 Hz key of spec 5.6), the four Overpass fonts with `OFL.txt`, the app icon (spec 5.6) and the `LaunchSurface` colour with its dark variant. The app itself is still one coloured screen; task 11 gives it its model and task 12 its first real screen.

It also adds the tests that keep the README's global constraints true for every later task: the bundled decks decode, every font loads by its PostScript name and covers the characters of reference 2.2, the app sources use no `NavigationStack`, `fullScreenCover`, `simultaneousGesture`, UIKit haptics, selectable text, literal colours or literal font sizes, and the app launches. From this task on every task ends with `xcodebuild test` of the `Truthy` scheme green on the iOS 26.5 simulator.

Builds on tasks 1 to 6 (the engine package, complete) and plan A (`native-data/decks`, `app/fonts/OFL.txt` in the web, the hygiene rules for native files).

**Files:**
- Create: `ios/Truthy/Truthy.xcodeproj/project.pbxproj`, `ios/Truthy/Truthy.xcodeproj/xcshareddata/xcschemes/Truthy.xcscheme`
- Create (app): `ios/Truthy/Truthy/Info.plist`, `ios/Truthy/Truthy/App/TruthyApp.swift`, `ios/Truthy/Truthy/EngineNames.swift`, `ios/Truthy/Truthy/Assets.xcassets/Contents.json`, `ios/Truthy/Truthy/Assets.xcassets/AppIcon.appiconset/Contents.json`, `ios/Truthy/Truthy/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`, `ios/Truthy/Truthy/Assets.xcassets/LaunchSurface.colorset/Contents.json`, `ios/Truthy/Truthy/Fonts/Overpass-SemiBold.ttf`, `ios/Truthy/Truthy/Fonts/Overpass-ExtraBold.ttf`, `ios/Truthy/Truthy/Fonts/OverpassMono-Regular.ttf`, `ios/Truthy/Truthy/Fonts/OverpassMono-SemiBold.ttf`, `ios/Truthy/Truthy/Fonts/OFL.txt`
- Create (tools): `ios/Tools/icon/make-icon.swift`, `ios/Tools/fonts/name-table.py`
- Test: create `ios/Truthy/TruthyTests/BundledDecksTests.swift`, `ios/Truthy/TruthyTests/FontCoverageTests.swift`, `ios/Truthy/TruthyTests/AppSourceRulesTests.swift`, `ios/Truthy/TruthyTests/EngineLinkTests.swift`, `ios/Truthy/TruthyUITests/LaunchTests.swift`

**Interfaces:**
- Consumes: the `TruthyEngine` library product (tasks 1 to 6); `native-data/decks` (plan A); `app/fonts/OFL.txt` (the web's licence text, "Copyright 2021 The Overpass Project Authors"); the Google Fonts Overpass and Overpass Mono variable files at the pinned commit of rule 5.
- Produces:
  - The project `ios/Truthy/Truthy.xcodeproj`, the shared scheme `Truthy` (build: `Truthy`; test: `TruthyTests` and `TruthyUITests`), targets `Truthy` (app, `com.eienmosu.Truthy`), `TruthyTests` (unit, Swift Testing, test host the app), `TruthyUITests` (XCTest UI tests). A new file in `ios/Truthy/Truthy`, `ios/Truthy/TruthyTests` or `ios/Truthy/TruthyUITests` joins its target with no project change.
  - Build settings later tasks rely on: `IPHONEOS_DEPLOYMENT_TARGET = 18.0`, `SWIFT_VERSION = 6.0`, `PRODUCT_BUNDLE_IDENTIFIER = com.eienmosu.Truthy`, `DEVELOPMENT_TEAM = 2MN3N47796`, `CODE_SIGN_STYLE = Automatic`, `INFOPLIST_FILE = Truthy/Info.plist`, `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon`.
  - The bundle holds `decks/index.json` and the 54 deck files (folder reference), and the four fonts registered by `UIAppFonts` under the PostScript names `OverpassRoman-SemiBold`, `OverpassRoman-ExtraBold`, `OverpassMono-Regular`, `OverpassMono-SemiBold` (the files are `Overpass-SemiBold.ttf`, `Overpass-ExtraBold.ttf`, `OverpassMono-Regular.ttf`, `OverpassMono-SemiBold.ttf`).
  - The colour asset `LaunchSurface`: `#c4e3f5` by day, `#101c33` at night (`color-surface`, reference 5.1).
  - `ios/Truthy/Truthy/EngineNames.swift`, the app's names for engine types, used by every app file:

```swift
import TruthyEngine

typealias Progress = TruthyEngine.Progress        // Foundation has a Progress class too (task 4, rule 4)
typealias StoredTheme = TruthyEngine.Theme        // what ThemeStore keeps (task 9)
typealias ResolvedTheme = TruthyEngine.Theme      // what the app shows (task 8)
typealias StartChoice = TruthyEngine.Choice       // the start flow's choices (task 5)
```

  - `ios/Tools/icon/make-icon.swift <out.png> [size]`: draws the icon and writes a PNG with only `IHDR`, `sRGB`, `IDAT` and `IEND` chunks. `ios/Tools/fonts/name-table.py <font.ttf>`: prints every name record of a font, decoded.

**Rules:**

1. **Synchronized folders.** The three targets are `PBXFileSystemSynchronizedRootGroup`s. `Info.plist` sits inside the app's folder, so the app's group carries a membership exception for it (otherwise Xcode would also copy it as a resource and fail with two commands producing `Info.plist`).
2. **The decks are a folder reference**, `../../native-data/decks` relative to the project, copied as the folder `decks` into the bundle. Nothing of `native-data` is copied into `ios/`.
3. **No absolute path** in `project.pbxproj` or the scheme (`grep` in step 3); the package reference is `../TruthyEngine`.
4. **Info.plist is written by hand** (`GENERATE_INFOPLIST_FILE = NO`), so every key the spec asks for is visible in one file: `CFBundleDisplayName` Truthy; `UISupportedInterfaceOrientations` portrait, landscape left and right (spec 2: not locked; iPad all four); `UILaunchScreen` with `UIColorName` `LaunchSurface` (spec 5.6); `UIAppFonts` with the four files; `CADisableMinimumFrameDurationOnPhone` true (spec 5.6); no `UIDesignRequiresCompatibility` (spec 5.4: the app does not opt out of Liquid Glass).
5. **Fonts.** The four static cuts are instanced from the Google Fonts variable files (Overpass v4, the web's own source) at commit `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5` with fontTools 4.67.0, name record 19 removed (its sample text holds an em dash), exactly as plan C task 7 step 12 does: the same bytes on both platforms, checked by their SHA-256 (README, "Cross-platform agreements"); reference 5.2 allows this source (SIL OFL 1.1). The upstream Red Hat release v3.0.5 is not used: its 2016 cuts have other vertical metrics (CoreText line height 153.2 at size 100 against 126.6 for v4), so every role would be about 21 percent taller than on the web and on Android. Before they are committed, each name table is decoded with `name-table.py` and checked against the hygiene rules (no e-mail-shaped string, no local path); plan A's UTF-16 run reading then scans them in `pnpm test` too.
6. **The icon** is the `app/icon.svg` mark at 60 percent of the width, centred on an opaque `#a9d6f0` square, as `public/icon-512.png` is (measured there: the ticket spans 307 of 512 pixels). One 1024 image with a scale-free name (`AppIcon-1024.png`: a name with the at-sign scale suffix would trip the e-mail rule, reference 8.4).
7. **Engine symbols in the unit tests.** The unit tests `import TruthyEngine` and run inside the app (test host), resolving engine symbols against the app binary. `DEAD_CODE_STRIPPING = NO` in the app's Debug configuration keeps engine functions the app does not call yet; `EngineLinkTests` proves it.
8. **The source rules test** (`AppSourceRulesTests`) scans every `.swift` file under `ios/Truthy/Truthy`, comments removed, except the generated `Design/Tokens.swift` (task 8) and files under a `Debug/` folder, for the README's global constraints. It reads the files through `#filePath`, which works because the simulator runs the tests as a Mac process.

**Review focus.** README line 2 starts here: the launch colour has a dark variant, so the launch screen follows the system appearance (task 16 checks both values); the stored theme is task 8's.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git status --short
swift test --package-path ios/TruthyEngine 2>&1 | tail -1
xcodebuild -version | head -1
xcrun simctl list devices available | grep -E 'iPhone 17 Pro \(|iPhone 16 Pro \(' | head -4
ls native-data/decks | wc -l
test -f app/fonts/OFL.txt && head -1 app/fonts/OFL.txt
test -e ios/Truthy && echo "ios/Truthy exists" || echo "no app project yet"
```

Expected: nothing from `git status --short`; `Test run with 355 tests in 50 suites passed after ... with 1 known issue`; `Xcode 26.6`; an iPhone 17 Pro on iOS 26.5 and an iPhone 16 Pro on iOS 18.4 among the simulators; `55`; `Copyright 2021 The Overpass Project Authors (https://github.com/RedHatOfficial/Overpass)` or the same first line the web ships; `no app project yet`. If a simulator is missing, create it with `xcrun simctl create` for that runtime before going on.

- [ ] **Step 2: Write the project file and the scheme.**

`ios/Truthy/Truthy.xcodeproj/project.pbxproj`:

```text
// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 77;
	objects = {

/* Begin PBXBuildFile section */
		5C0000000000000000000040 /* TruthyEngine in Frameworks */ = {isa = PBXBuildFile; productRef = 5C0000000000000000000061 /* TruthyEngine */; };
		5C0000000000000000000041 /* decks in Resources */ = {isa = PBXBuildFile; fileRef = 5C0000000000000000000007 /* decks */; };
/* End PBXBuildFile section */

/* Begin PBXContainerItemProxy section */
		5C0000000000000000000050 /* PBXContainerItemProxy */ = {
			isa = PBXContainerItemProxy;
			containerPortal = 5C0000000000000000000001 /* Project object */;
			proxyType = 1;
			remoteGlobalIDString = 5C0000000000000000000010;
			remoteInfo = Truthy;
		};
		5C0000000000000000000052 /* PBXContainerItemProxy */ = {
			isa = PBXContainerItemProxy;
			containerPortal = 5C0000000000000000000001 /* Project object */;
			proxyType = 1;
			remoteGlobalIDString = 5C0000000000000000000010;
			remoteInfo = Truthy;
		};
/* End PBXContainerItemProxy section */

/* Begin PBXFileReference section */
		5C0000000000000000000004 /* Truthy.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Truthy.app; sourceTree = BUILT_PRODUCTS_DIR; };
		5C0000000000000000000005 /* TruthyTests.xctest */ = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = TruthyTests.xctest; sourceTree = BUILT_PRODUCTS_DIR; };
		5C0000000000000000000006 /* TruthyUITests.xctest */ = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = TruthyUITests.xctest; sourceTree = BUILT_PRODUCTS_DIR; };
		5C0000000000000000000007 /* decks */ = {isa = PBXFileReference; lastKnownFileType = folder; name = decks; path = ../../native-data/decks; sourceTree = "<group>"; };
/* End PBXFileReference section */

/* Begin PBXFileSystemSynchronizedBuildFileExceptionSet section */
		5C000000000000000000000B /* Exceptions for "Truthy" folder in "Truthy" target */ = {
			isa = PBXFileSystemSynchronizedBuildFileExceptionSet;
			membershipExceptions = (
				Info.plist,
			);
			target = 5C0000000000000000000010 /* Truthy */;
		};
/* End PBXFileSystemSynchronizedBuildFileExceptionSet section */

/* Begin PBXFileSystemSynchronizedRootGroup section */
		5C0000000000000000000008 /* Truthy */ = {
			isa = PBXFileSystemSynchronizedRootGroup;
			exceptions = (
				5C000000000000000000000B /* Exceptions for "Truthy" folder in "Truthy" target */,
			);
			path = Truthy;
			sourceTree = "<group>";
		};
		5C0000000000000000000009 /* TruthyTests */ = {
			isa = PBXFileSystemSynchronizedRootGroup;
			path = TruthyTests;
			sourceTree = "<group>";
		};
		5C000000000000000000000A /* TruthyUITests */ = {
			isa = PBXFileSystemSynchronizedRootGroup;
			path = TruthyUITests;
			sourceTree = "<group>";
		};
/* End PBXFileSystemSynchronizedRootGroup section */

/* Begin PBXFrameworksBuildPhase section */
		5C0000000000000000000012 /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
				5C0000000000000000000040 /* TruthyEngine in Frameworks */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		5C0000000000000000000022 /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		5C0000000000000000000032 /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
		5C0000000000000000000002 = {
			isa = PBXGroup;
			children = (
				5C0000000000000000000008 /* Truthy */,
				5C0000000000000000000009 /* TruthyTests */,
				5C000000000000000000000A /* TruthyUITests */,
				5C0000000000000000000007 /* decks */,
				5C0000000000000000000003 /* Products */,
			);
			sourceTree = "<group>";
		};
		5C0000000000000000000003 /* Products */ = {
			isa = PBXGroup;
			children = (
				5C0000000000000000000004 /* Truthy.app */,
				5C0000000000000000000005 /* TruthyTests.xctest */,
				5C0000000000000000000006 /* TruthyUITests.xctest */,
			);
			name = Products;
			sourceTree = "<group>";
		};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		5C0000000000000000000010 /* Truthy */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = 5C0000000000000000000073 /* Build configuration list for PBXNativeTarget "Truthy" */;
			buildPhases = (
				5C0000000000000000000011 /* Sources */,
				5C0000000000000000000012 /* Frameworks */,
				5C0000000000000000000013 /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
			);
			fileSystemSynchronizedGroups = (
				5C0000000000000000000008 /* Truthy */,
			);
			name = Truthy;
			packageProductDependencies = (
				5C0000000000000000000061 /* TruthyEngine */,
			);
			productName = Truthy;
			productReference = 5C0000000000000000000004 /* Truthy.app */;
			productType = "com.apple.product-type.application";
		};
		5C0000000000000000000020 /* TruthyTests */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = 5C0000000000000000000076 /* Build configuration list for PBXNativeTarget "TruthyTests" */;
			buildPhases = (
				5C0000000000000000000021 /* Sources */,
				5C0000000000000000000022 /* Frameworks */,
				5C0000000000000000000023 /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
				5C0000000000000000000051 /* PBXTargetDependency */,
			);
			fileSystemSynchronizedGroups = (
				5C0000000000000000000009 /* TruthyTests */,
			);
			name = TruthyTests;
			packageProductDependencies = (
			);
			productName = TruthyTests;
			productReference = 5C0000000000000000000005 /* TruthyTests.xctest */;
			productType = "com.apple.product-type.bundle.unit-test";
		};
		5C0000000000000000000030 /* TruthyUITests */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = 5C0000000000000000000079 /* Build configuration list for PBXNativeTarget "TruthyUITests" */;
			buildPhases = (
				5C0000000000000000000031 /* Sources */,
				5C0000000000000000000032 /* Frameworks */,
				5C0000000000000000000033 /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
				5C0000000000000000000053 /* PBXTargetDependency */,
			);
			fileSystemSynchronizedGroups = (
				5C000000000000000000000A /* TruthyUITests */,
			);
			name = TruthyUITests;
			packageProductDependencies = (
			);
			productName = TruthyUITests;
			productReference = 5C0000000000000000000006 /* TruthyUITests.xctest */;
			productType = "com.apple.product-type.bundle.ui-testing";
		};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		5C0000000000000000000001 /* Project object */ = {
			isa = PBXProject;
			attributes = {
				BuildIndependentTargetsInParallel = 1;
				LastSwiftUpdateCheck = 2660;
				LastUpgradeCheck = 2660;
				TargetAttributes = {
					5C0000000000000000000010 = {
						CreatedOnToolsVersion = 26.6;
					};
					5C0000000000000000000020 = {
						CreatedOnToolsVersion = 26.6;
						TestTargetID = 5C0000000000000000000010;
					};
					5C0000000000000000000030 = {
						CreatedOnToolsVersion = 26.6;
						TestTargetID = 5C0000000000000000000010;
					};
				};
			};
			buildConfigurationList = 5C0000000000000000000070 /* Build configuration list for PBXProject "Truthy" */;
			developmentRegion = en;
			hasScannedForEncodings = 0;
			knownRegions = (
				en,
				Base,
			);
			mainGroup = 5C0000000000000000000002;
			minimizedProjectReferenceProxies = 1;
			packageReferences = (
				5C0000000000000000000060 /* XCLocalSwiftPackageReference "../TruthyEngine" */,
			);
			preferredProjectObjectVersion = 77;
			productRefGroup = 5C0000000000000000000003 /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				5C0000000000000000000010 /* Truthy */,
				5C0000000000000000000020 /* TruthyTests */,
				5C0000000000000000000030 /* TruthyUITests */,
			);
		};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
		5C0000000000000000000013 /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				5C0000000000000000000041 /* decks in Resources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		5C0000000000000000000023 /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		5C0000000000000000000033 /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
		5C0000000000000000000011 /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		5C0000000000000000000021 /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		5C0000000000000000000031 /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXSourcesBuildPhase section */

/* Begin PBXTargetDependency section */
		5C0000000000000000000051 /* PBXTargetDependency */ = {
			isa = PBXTargetDependency;
			target = 5C0000000000000000000010 /* Truthy */;
			targetProxy = 5C0000000000000000000050 /* PBXContainerItemProxy */;
		};
		5C0000000000000000000053 /* PBXTargetDependency */ = {
			isa = PBXTargetDependency;
			target = 5C0000000000000000000010 /* Truthy */;
			targetProxy = 5C0000000000000000000052 /* PBXContainerItemProxy */;
		};
/* End PBXTargetDependency section */

/* Begin XCBuildConfiguration section */
		5C0000000000000000000071 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				COPY_PHASE_STRIP = NO;
				DEBUG_INFORMATION_FORMAT = dwarf;
				DEVELOPMENT_TEAM = 2MN3N47796;
				ENABLE_STRICT_OBJC_MSGSEND = YES;
				ENABLE_TESTABILITY = YES;
				ENABLE_USER_SCRIPT_SANDBOXING = YES;
				GCC_OPTIMIZATION_LEVEL = 0;
				GCC_PREPROCESSOR_DEFINITIONS = (
					"DEBUG=1",
					"$(inherited)",
				);
				IPHONEOS_DEPLOYMENT_TARGET = 18.0;
				MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
				ONLY_ACTIVE_ARCH = YES;
				SDKROOT = iphoneos;
				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG $(inherited)";
				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
				SWIFT_VERSION = 6.0;
			};
			name = Debug;
		};
		5C0000000000000000000072 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				COPY_PHASE_STRIP = NO;
				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
				DEVELOPMENT_TEAM = 2MN3N47796;
				ENABLE_NS_ASSERTIONS = NO;
				ENABLE_STRICT_OBJC_MSGSEND = YES;
				ENABLE_USER_SCRIPT_SANDBOXING = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 18.0;
				MTL_ENABLE_DEBUG_INFO = NO;
				SDKROOT = iphoneos;
				SWIFT_COMPILATION_MODE = wholemodule;
				SWIFT_VERSION = 6.0;
				VALIDATE_PRODUCT = YES;
			};
			name = Release;
		};
		5C0000000000000000000074 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEAD_CODE_STRIPPING = NO;
				DEVELOPMENT_TEAM = 2MN3N47796;
				GENERATE_INFOPLIST_FILE = NO;
				INFOPLIST_FILE = Truthy/Info.plist;
				IPHONEOS_DEPLOYMENT_TARGET = 18.0;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = com.eienmosu.Truthy;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_VERSION = 6.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Debug;
		};
		5C0000000000000000000075 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = 2MN3N47796;
				GENERATE_INFOPLIST_FILE = NO;
				INFOPLIST_FILE = Truthy/Info.plist;
				IPHONEOS_DEPLOYMENT_TARGET = 18.0;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = com.eienmosu.Truthy;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_VERSION = 6.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Release;
		};
		5C0000000000000000000077 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				BUNDLE_LOADER = "$(TEST_HOST)";
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = 2MN3N47796;
				GENERATE_INFOPLIST_FILE = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 18.0;
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = com.eienmosu.TruthyTests;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_VERSION = 6.0;
				TARGETED_DEVICE_FAMILY = "1,2";
				TEST_HOST = "$(BUILT_PRODUCTS_DIR)/Truthy.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/Truthy";
			};
			name = Debug;
		};
		5C0000000000000000000078 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				BUNDLE_LOADER = "$(TEST_HOST)";
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = 2MN3N47796;
				GENERATE_INFOPLIST_FILE = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 18.0;
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = com.eienmosu.TruthyTests;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_VERSION = 6.0;
				TARGETED_DEVICE_FAMILY = "1,2";
				TEST_HOST = "$(BUILT_PRODUCTS_DIR)/Truthy.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/Truthy";
			};
			name = Release;
		};
		5C000000000000000000007A /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = 2MN3N47796;
				GENERATE_INFOPLIST_FILE = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 18.0;
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = com.eienmosu.TruthyUITests;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_VERSION = 6.0;
				TARGETED_DEVICE_FAMILY = "1,2";
				TEST_TARGET_NAME = Truthy;
			};
			name = Debug;
		};
		5C000000000000000000007B /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = 2MN3N47796;
				GENERATE_INFOPLIST_FILE = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 18.0;
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = com.eienmosu.TruthyUITests;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_VERSION = 6.0;
				TARGETED_DEVICE_FAMILY = "1,2";
				TEST_TARGET_NAME = Truthy;
			};
			name = Release;
		};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		5C0000000000000000000070 /* Build configuration list for PBXProject "Truthy" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				5C0000000000000000000071 /* Debug */,
				5C0000000000000000000072 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		5C0000000000000000000073 /* Build configuration list for PBXNativeTarget "Truthy" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				5C0000000000000000000074 /* Debug */,
				5C0000000000000000000075 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		5C0000000000000000000076 /* Build configuration list for PBXNativeTarget "TruthyTests" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				5C0000000000000000000077 /* Debug */,
				5C0000000000000000000078 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		5C0000000000000000000079 /* Build configuration list for PBXNativeTarget "TruthyUITests" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				5C000000000000000000007A /* Debug */,
				5C000000000000000000007B /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
/* End XCConfigurationList section */

/* Begin XCLocalSwiftPackageReference section */
		5C0000000000000000000060 /* XCLocalSwiftPackageReference "../TruthyEngine" */ = {
			isa = XCLocalSwiftPackageReference;
			relativePath = ../TruthyEngine;
		};
/* End XCLocalSwiftPackageReference section */

/* Begin XCSwiftPackageProductDependency section */
		5C0000000000000000000061 /* TruthyEngine */ = {
			isa = XCSwiftPackageProductDependency;
			productName = TruthyEngine;
		};
/* End XCSwiftPackageProductDependency section */
	};
	rootObject = 5C0000000000000000000001 /* Project object */;
}
```

`ios/Truthy/Truthy.xcodeproj/xcshareddata/xcschemes/Truthy.xcscheme`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "2660"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "5C0000000000000000000010"
               BuildableName = "Truthy.app"
               BlueprintName = "Truthy"
               ReferencedContainer = "container:Truthy.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
      <Testables>
         <TestableReference
            skipped = "NO"
            parallelizable = "NO">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "5C0000000000000000000020"
               BuildableName = "TruthyTests.xctest"
               BlueprintName = "TruthyTests"
               ReferencedContainer = "container:Truthy.xcodeproj">
            </BuildableReference>
         </TestableReference>
         <TestableReference
            skipped = "NO"
            parallelizable = "NO">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "5C0000000000000000000030"
               BuildableName = "TruthyUITests.xctest"
               BlueprintName = "TruthyUITests"
               ReferencedContainer = "container:Truthy.xcodeproj">
            </BuildableReference>
         </TestableReference>
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "5C0000000000000000000010"
            BuildableName = "Truthy.app"
            BlueprintName = "Truthy"
            ReferencedContainer = "container:Truthy.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "5C0000000000000000000010"
            BuildableName = "Truthy.app"
            BlueprintName = "Truthy"
            ReferencedContainer = "container:Truthy.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
```

- [ ] **Step 3: Check the project files.**

```bash
plutil -lint ios/Truthy/Truthy.xcodeproj/project.pbxproj
xmllint --noout ios/Truthy/Truthy.xcodeproj/xcshareddata/xcschemes/Truthy.xcscheme && echo scheme-ok
grep -nE '/(Users|home|private|Volumes)/' ios/Truthy/Truthy.xcodeproj/project.pbxproj ios/Truthy/Truthy.xcodeproj/xcshareddata/xcschemes/Truthy.xcscheme || echo "no absolute path"
xcodebuild -list -project ios/Truthy/Truthy.xcodeproj
```

Expected: `ios/Truthy/Truthy.xcodeproj/project.pbxproj: OK`; `scheme-ok`; `no absolute path`; the targets `Truthy`, `TruthyTests`, `TruthyUITests` and the scheme `Truthy`. If `xcodebuild -list` reports a damaged project, the object it names has a typo: compare it with the text above.

- [ ] **Step 4: Write the app's first files: Info.plist, the engine names, the app entry and the asset catalog.**

`ios/Truthy/Truthy/Info.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CADisableMinimumFrameDurationOnPhone</key>
	<true/>
	<key>CFBundleDevelopmentRegion</key>
	<string>$(DEVELOPMENT_LANGUAGE)</string>
	<key>CFBundleDisplayName</key>
	<string>Truthy</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
	<key>CFBundleShortVersionString</key>
	<string>$(MARKETING_VERSION)</string>
	<key>CFBundleVersion</key>
	<string>$(CURRENT_PROJECT_VERSION)</string>
	<key>ITSAppUsesNonExemptEncryption</key>
	<false/>
	<key>LSRequiresIPhoneOS</key>
	<true/>
	<key>UIAppFonts</key>
	<array>
		<string>Overpass-SemiBold.ttf</string>
		<string>Overpass-ExtraBold.ttf</string>
		<string>OverpassMono-Regular.ttf</string>
		<string>OverpassMono-SemiBold.ttf</string>
	</array>
	<key>UIApplicationSceneManifest</key>
	<dict>
		<key>UIApplicationSupportsMultipleScenes</key>
		<false/>
	</dict>
	<key>UIApplicationSupportsIndirectInputEvents</key>
	<true/>
	<key>UILaunchScreen</key>
	<dict>
		<key>UIColorName</key>
		<string>LaunchSurface</string>
	</dict>
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
		<string>UIInterfaceOrientationLandscapeRight</string>
	</array>
	<key>UISupportedInterfaceOrientations~ipad</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationPortraitUpsideDown</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
		<string>UIInterfaceOrientationLandscapeRight</string>
	</array>
</dict>
</plist>
```

`ios/Truthy/Truthy/EngineNames.swift`:

```swift
import TruthyEngine

// The app's names for engine types. Foundation has a Progress class of its own: a file that imports SwiftUI or
// Foundation and TruthyEngine cannot write a bare Progress (task 4, rule 4), but a declaration of this module
// shadows both imports, so app files write Progress. The theme and choice names say what the app does with them.

typealias Progress = TruthyEngine.Progress
typealias StoredTheme = TruthyEngine.Theme
typealias ResolvedTheme = TruthyEngine.Theme
typealias StartChoice = TruthyEngine.Choice
```

`ios/Truthy/Truthy/App/TruthyApp.swift` (task 11 replaces the body with the root view):

```swift
import SwiftUI

@main
struct TruthyApp: App {
    var body: some Scene {
        WindowGroup {
            Color("LaunchSurface")
                .ignoresSafeArea()
                .accessibilityLabel("Truthy")
        }
    }
}
```

`ios/Truthy/Truthy/Assets.xcassets/Contents.json`:

```json
{
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
```

`ios/Truthy/Truthy/Assets.xcassets/LaunchSurface.colorset/Contents.json`:

```json
{
  "colors" : [
    {
      "color" : {
        "color-space" : "srgb",
        "components" : {
          "alpha" : "1.000",
          "blue" : "0xF5",
          "green" : "0xE3",
          "red" : "0xC4"
        }
      },
      "idiom" : "universal"
    },
    {
      "appearances" : [
        {
          "appearance" : "luminosity",
          "value" : "dark"
        }
      ],
      "color" : {
        "color-space" : "srgb",
        "components" : {
          "alpha" : "1.000",
          "blue" : "0x33",
          "green" : "0x1C",
          "red" : "0x10"
        }
      },
      "idiom" : "universal"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
```

`ios/Truthy/Truthy/Assets.xcassets/AppIcon.appiconset/Contents.json`:

```json
{
  "images" : [
    {
      "filename" : "AppIcon-1024.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
```

- [ ] **Step 5: Write the icon tool and draw the icon.**

`ios/Tools/icon/make-icon.swift`:

```swift
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// Draws the app icon: the app/icon.svg mark (44 by 30 ticket, tear line, check) at 60 percent of the width,
// centred on an opaque square in day sky-1 (#a9d6f0), as public/icon-512.png is composed (spec 5.6).
//   swift ios/Tools/icon/make-icon.swift <output.png> [size]
let arguments = CommandLine.arguments
guard arguments.count >= 2 else { fatalError("usage: make-icon.swift <output.png> [size]") }
let size = arguments.count > 2 ? Int(arguments[2]) ?? 1024 : 1024

func colour(_ hex: UInt32) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: 1)
}

let space = CGColorSpace(name: CGColorSpace.sRGB)!
let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: space,
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
let side = CGFloat(size)
context.setFillColor(colour(0xa9d6f0))
context.fill(CGRect(x: 0, y: 0, width: side, height: side))

// SVG user space: y down, the ticket 44 wide, its width 60 percent of the icon, centred.
let scale = side * 0.6 / 44
context.translateBy(x: 0, y: side)
context.scaleBy(x: 1, y: -1)
context.translateBy(x: (side - 44 * scale) / 2, y: (side - 30 * scale) / 2)
context.scaleBy(x: scale, y: scale)

// M6 0H38A6 6 0 0 1 44 6V10.5A4.5 4.5 0 0 0 44 19.5V24A6 6 0 0 1 38 30H6A6 6 0 0 1 0 24V19.5A4.5 4.5 0 0 0 0 10.5V6A6 6 0 0 1 6 0Z
let ticket = CGMutablePath()
ticket.move(to: CGPoint(x: 6, y: 0))
ticket.addLine(to: CGPoint(x: 38, y: 0))
ticket.addArc(tangent1End: CGPoint(x: 44, y: 0), tangent2End: CGPoint(x: 44, y: 6), radius: 6)
ticket.addLine(to: CGPoint(x: 44, y: 10.5))
ticket.addArc(center: CGPoint(x: 44, y: 15), radius: 4.5, startAngle: -.pi / 2, endAngle: .pi / 2, clockwise: true)
ticket.addLine(to: CGPoint(x: 44, y: 24))
ticket.addArc(tangent1End: CGPoint(x: 44, y: 30), tangent2End: CGPoint(x: 38, y: 30), radius: 6)
ticket.addLine(to: CGPoint(x: 6, y: 30))
ticket.addArc(tangent1End: CGPoint(x: 0, y: 30), tangent2End: CGPoint(x: 0, y: 24), radius: 6)
ticket.addLine(to: CGPoint(x: 0, y: 19.5))
ticket.addArc(center: CGPoint(x: 0, y: 15), radius: 4.5, startAngle: .pi / 2, endAngle: -.pi / 2, clockwise: true)
ticket.addLine(to: CGPoint(x: 0, y: 6))
ticket.addArc(tangent1End: CGPoint(x: 0, y: 0), tangent2End: CGPoint(x: 6, y: 0), radius: 6)
ticket.closeSubpath()
context.addPath(ticket)
context.setFillColor(colour(0xf5b400))
context.fillPath()

// M33 5v20, stroke 1.6, dashes 2.5 and 3, round caps; M9 15.5l4.5 4.5 9-10, stroke 3, round caps and joins.
context.setStrokeColor(colour(0x10233f))
context.setLineCap(.round)
context.setLineWidth(1.6)
context.setLineDash(phase: 0, lengths: [2.5, 3])
context.move(to: CGPoint(x: 33, y: 5))
context.addLine(to: CGPoint(x: 33, y: 25))
context.strokePath()
context.setLineDash(phase: 0, lengths: [])
context.setLineWidth(3)
context.setLineJoin(.round)
context.move(to: CGPoint(x: 9, y: 15.5))
context.addLine(to: CGPoint(x: 13.5, y: 20))
context.addLine(to: CGPoint(x: 22.5, y: 10))
context.strokePath()

let image = context.makeImage()!
let encoded = NSMutableData()
let destination = CGImageDestinationCreateWithData(encoded as CFMutableData, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else { fatalError("could not encode the icon") }

// ImageIO adds an eXIf chunk; the repository rejects PNG files with text or EXIF chunks (spec section 8). Keep the
// image data and the colour space only: IHDR, sRGB, IDAT and IEND, each with its own CRC unchanged.
let bytes = [UInt8](encoded as Data)
var kept = Array(bytes[0..<8])
var at = 8
while at + 8 <= bytes.count {
    let length = Int(bytes[at]) << 24 | Int(bytes[at + 1]) << 16 | Int(bytes[at + 2]) << 8 | Int(bytes[at + 3])
    let type = String(decoding: bytes[(at + 4)..<(at + 8)], as: UTF8.self)
    let end = at + 12 + length
    if ["IHDR", "sRGB", "IDAT", "IEND"].contains(type) { kept += bytes[at..<end] }
    at = end
}
let url = URL(fileURLWithPath: arguments[1])
try Data(kept).write(to: url)
print("wrote \(url.lastPathComponent), \(size) by \(size)")
```

```bash
swift ios/Tools/icon/make-icon.swift ios/Truthy/Truthy/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png 1024
python3 -c "import struct,sys; d=open(sys.argv[1],'rb').read(); i=8; t=[]
while i<len(d): n=struct.unpack('>I',d[i:i+4])[0]; t.append(d[i+4:i+8].decode()); i+=12+n
print(t)" ios/Truthy/Truthy/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png
sips -g pixelWidth -g pixelHeight ios/Truthy/Truthy/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png | tail -2
```

Expected: `wrote AppIcon-1024.png, 1024 by 1024`; `['IHDR', 'sRGB', 'IDAT', 'IDAT', 'IEND']` (the number of `IDAT` chunks may differ; no `tEXt`, `iTXt`, `zTXt` or `eXIf`); `pixelWidth: 1024` and `pixelHeight: 1024`. Open the PNG once (`open ios/Truthy/Truthy/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`): an amber ticket with its two notches cut inward, the dashed tear line right of centre and a navy check, centred on light blue, as `public/icon-512.png`. The drawing was checked this way while this plan was written.

- [ ] **Step 6: Get the fonts and check their name tables.**

`ios/Tools/fonts/name-table.py`:

```python
#!/usr/bin/env python3
"""Prints every record of a TrueType name table, decoded: platform 3 (Windows) and 0 (Unicode) as UTF-16BE, platform 1
(Mac) as Mac Roman. The repository's hygiene scan reads only ASCII runs and, with plan A, UTF-16 runs; this shows a
person what the file says before it is committed (reference 8.4)."""
import struct
import sys

def records(path):
    data = open(path, "rb").read()
    count = struct.unpack(">H", data[4:6])[0]
    tables = {}
    for i in range(count):
        tag, _, offset, length = struct.unpack(">4sIII", data[12 + 16 * i:28 + 16 * i])
        tables[tag.decode("latin-1")] = (offset, length)
    offset, _ = tables["name"]
    _, n, strings = struct.unpack(">HHH", data[offset:offset + 6])
    for i in range(n):
        platform, encoding, language, name_id, length, at = struct.unpack(">HHHHHH", data[offset + 6 + 12 * i:offset + 18 + 12 * i])
        raw = data[offset + strings + at:offset + strings + at + length]
        text = raw.decode("utf-16-be", "replace") if platform in (0, 3) else raw.decode("mac_roman", "replace")
        yield platform, encoding, language, name_id, text

if __name__ == "__main__":
    for path in sys.argv[1:]:
        print(f"== {path}")
        for platform, encoding, language, name_id, text in records(path):
            print(f"{platform}/{encoding}/{language} id {name_id}: {text}")
```

Build the four static cuts from the Google Fonts variable files, the web's own v4 source (`app/fonts/*.woff2`, "Copyright 2021 The Overpass Project Authors"), pinned exactly as plan C task 7 step 12 pins them, so that both platforms ship the same bytes. Keep the whole step in one shell block: a later block does not see `FONTWORK`.

```bash
FONTWORK="$(mktemp -d)"
python3 -m venv "$FONTWORK/venv"
"$FONTWORK/venv/bin/pip" install --quiet fonttools==4.67.0
GF=8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5
curl -fsSL -o "$FONTWORK/Overpass[wght].ttf" "https://raw.githubusercontent.com/google/fonts/$GF/ofl/overpass/Overpass%5Bwght%5D.ttf"
curl -fsSL -o "$FONTWORK/OverpassMono[wght].ttf" "https://raw.githubusercontent.com/google/fonts/$GF/ofl/overpassmono/OverpassMono%5Bwght%5D.ttf"
curl -fsSL -o "$FONTWORK/OFL.txt" "https://raw.githubusercontent.com/google/fonts/$GF/ofl/overpass/OFL.txt"
cmp "$FONTWORK/OFL.txt" app/fonts/OFL.txt && echo "OFL identical"
cat > "$FONTWORK/make_fonts.py" <<'EOF'
import re
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

src, out = Path(sys.argv[1]), Path(sys.argv[2])
CUTS = [
    ("Overpass[wght].ttf", 600, "Overpass-SemiBold.ttf"),
    ("Overpass[wght].ttf", 800, "Overpass-ExtraBold.ttf"),
    ("OverpassMono[wght].ttf", 400, "OverpassMono-Regular.ttf"),
    ("OverpassMono[wght].ttf", 600, "OverpassMono-SemiBold.ttf"),
]
NEEDED = [0x2022, 0x00A7, 0x2013, 0x2018, 0x2019, 0x201A, 0x201B, 0x201C, 0x201D,
          0x00E9, 0x00C9, 0x2190, 0x2191, 0x2192, 0x2193, 0x00B7]
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")

for source, weight, name in CUTS:
    # recalcTimestamp=False keeps head.modified from the source, so the output is the same on every run.
    font = TTFont(src / source, recalcTimestamp=False)
    static = instancer.instantiateVariableFont(font, {"wght": weight}, static=True, updateFontNames=True)
    # Name 19 is a sample text with an em dash; nothing reads it.
    static["name"].names = [record for record in static["name"].names if record.nameID != 19]
    for record in static["name"].names:
        text = record.toUnicode()
        if EMAIL.search(text) or any(ord(c) > 0x7E or ord(c) < 0x20 for c in text):
            sys.exit(f"{name}: name record {record.nameID} needs a look: {text!r}")
    cmap = static.getBestCmap()
    missing = [f"U+{c:04X}" for c in NEEDED if c not in cmap]
    if missing:
        sys.exit(f"{name}: missing {missing}")
    if static["OS/2"].usWeightClass != weight or "fvar" in static:
        sys.exit(f"{name}: not a static {weight} cut")
    static.save(out / name)
    print(f"{name}: weight {weight}, {len(cmap)} characters, ok")
EOF
mkdir -p ios/Truthy/Truthy/Fonts
"$FONTWORK/venv/bin/python" "$FONTWORK/make_fonts.py" "$FONTWORK" ios/Truthy/Truthy/Fonts
cp app/fonts/OFL.txt ios/Truthy/Truthy/Fonts/OFL.txt
(cd ios/Truthy/Truthy/Fonts && shasum -a 256 *.ttf)
python3 ios/Tools/fonts/name-table.py ios/Truthy/Truthy/Fonts/*.ttf | grep -E ' id 6: ' | sort -u
python3 ios/Tools/fonts/name-table.py ios/Truthy/Truthy/Fonts/*.ttf | grep -nE '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.|/(Users|home)/' || echo "no e-mail or local path in the name tables"
rm -rf "$FONTWORK"
```

Expected: `OFL identical`; the four `... ok` lines of the script (1182 characters for the two Overpass cuts, 1642 for the two mono cuts); these hashes, the ones plan C task 7 step 12 states (the same bytes under other file names):

```text
69662f8197e1c89a038946f09cd45ae1501e57535da6d064eeb30a5bd4d5af91  Overpass-ExtraBold.ttf
cbb64707c7c100db86215ed151764e5ff3abdd97d1402c14cddad1d340d5dbf6  Overpass-SemiBold.ttf
281d7b976131719912653240f3fe8e7ae3be51589ec5b6d0e7ff63dd8c704c7f  OverpassMono-Regular.ttf
409ae74070db65740d840675662da17ae3863e30fec647cdb15b7629c6351bc6  OverpassMono-SemiBold.ttf
```

then the PostScript names (name id 6) `OverpassMono-Regular`, `OverpassMono-SemiBold`, `OverpassRoman-ExtraBold` and `OverpassRoman-SemiBold` (each line prefixed `3/1/1033 id 6: `), and `no e-mail or local path in the name tables`. Read the whole output of one `name-table.py` call by eye as well (copyright, vendor, URLs): a URL to the project or the licence is fine, anything personal is a stop. A different hash or PostScript name means another source or another fontTools: stop and report, because plan C ships these bytes and both plans address the fonts by these names.

- [ ] **Step 7: Write the tests of the bundle, the fonts, the source rules, the engine link and the launch.**

`ios/Truthy/TruthyTests/BundledDecksTests.swift`:

```swift
import Foundation
import Testing
import TruthyEngine

// Spec D3 and 4.1: the 54 decks are embedded, from native-data/decks in place, as the folder "decks". The test host
// is the app, so Bundle.main is the app bundle.
@Suite struct BundledDecksTests {
    private let decks = Bundle.main.url(forResource: "decks", withExtension: nil)

    @Test func theBundleHoldsTheIndexAndEveryDeck() throws {
        let folder = try #require(decks, "the app bundle has no decks folder")
        let files = try FileManager.default.contentsOfDirectory(atPath: folder.path(percentEncoded: false)).filter { $0.hasSuffix(".json") }
        #expect(files.count == 55)
        #expect(files.contains("index.json"))
    }

    @Test func theIndexDecodesAndEveryDeckItNamesIsThere() throws {
        let folder = try #require(decks)
        let index = try JSONDecoder().decode(DeckIndex.self, from: Data(contentsOf: folder.appending(path: "index.json")))
        let ids = index.areas.flatMap(\.platforms).flatMap(\.decks).map(\.id)
        #expect(ids.count == 54)
        for id in ids {
            #expect(FileManager.default.fileExists(atPath: folder.appending(path: "\(id).json").path(percentEncoded: false)), "\(id)")
        }
    }
}
```

`ios/Truthy/TruthyTests/FontCoverageTests.swift`:

```swift
import CoreText
import Foundation
import Testing
import UIKit

// Spec 6 and reference 2.2: the four fonts load by their PostScript names and draw every character the content and
// the copy use: the bullet and section signs, the en dash, typographic quotes, e acute (both cases), the arrows and
// the middle dot.
@Suite struct FontCoverageTests {
    static let postScriptNames = ["OverpassRoman-SemiBold", "OverpassRoman-ExtraBold", "OverpassMono-Regular", "OverpassMono-SemiBold"]
    static let needed: [UniChar] = [0x2022, 0x00A7, 0x2013, 0x2018, 0x2019, 0x201A, 0x201B, 0x201C, 0x201D, 0x00E9, 0x00C9,
                                     0x2190, 0x2191, 0x2192, 0x2193, 0x00B7]

    @Test(arguments: postScriptNames)
    func eachFontLoadsAndCoversTheCharacters(name: String) throws {
        let font = try #require(UIFont(name: name, size: 17), "\(name) is not registered")
        #expect(font.fontName == name)
        var glyphs = [CGGlyph](repeating: 0, count: Self.needed.count)
        var characters = Self.needed
        let covered = CTFontGetGlyphsForCharacters(font as CTFont, &characters, &glyphs, characters.count)
        let missing = zip(Self.needed, glyphs).filter { $0.1 == 0 }.map { String(format: "U+%04X", $0.0) }
        #expect(covered && missing.isEmpty, "\(name) has no glyph for \(missing)")
    }

    @Test func theLicenceShipsWithTheFonts() throws {
        let licence = try #require(Bundle.main.url(forResource: "OFL", withExtension: "txt"))
        #expect(try String(contentsOf: licence, encoding: .utf8).contains("SIL OPEN FONT LICENSE"))
    }
}
```

`ios/Truthy/TruthyTests/AppSourceRulesTests.swift`:

```swift
import Foundation
import Testing

// README Global Constraints that no screen test sees: no system navigation or full-screen cover for the top-level
// screens, no simultaneousGesture (it blocks scrolling on iOS 26.5), haptics only through sensoryFeedback, no
// selectable text, no literal or system colours or font sizes in views (they come from Tokens.swift), and none of
// spec 5.7's web smells: no browser-like dialog (item 8), no link that leaves the app (item 9), no hover or
// long-press menu (items 1 and N8).
@Suite struct AppSourceRulesTests {
    static let appSources = URL(filePath: #filePath).deletingLastPathComponent().deletingLastPathComponent().appending(path: "Truthy")
    static let rules: [(String, String)] = [
        ("NavigationStack", #"\bNavigation(?:Stack|View|SplitView)\b"#),
        ("fullScreenCover", #"\.fullScreenCover\("#),
        ("simultaneousGesture", #"\.simultaneousGesture\("#),
        ("UIKit haptics", #"\bUI(?:Impact|Notification|Selection)FeedbackGenerator\b"#),
        ("selectable text", #"\.textSelection\(\.enabled\)"#),
        ("a literal colour", #"\bColor\((?:red|white|hue):|\bUIColor\((?:red|white|hue):|\bColor\(\.sRGB"#),
        ("a literal font size", #"\.system\(size:|\.custom\([^)]*size:\s*\d|UIFont\([^)]*size:\s*\d"#),
        ("a system colour", #"\bColor\.(?:white|black|red|green|blue|gray|yellow|orange|primary|secondary|accentColor)\b|\.(?:foregroundStyle|foregroundColor|tint)\(\.(?:white|black|primary|secondary|blue|accentColor)\)"#),
        ("a browser-like dialog", #"\.(?:alert|confirmationDialog|popover)\("#),
        ("a link out of the app", #"\bLink\(|\bopenURL\b|UIApplication\.shared\.open\("#),
        ("a hover or long-press menu", #"\.(?:onHover|hoverEffect|contextMenu)\b"#),
    ]

    static func findings(in name: String, _ source: String) throws -> [String] {
        let code = source.replacing(try Regex(#"//[^\n]*"#), with: "")
        // Simple word boundaries, as in task 1's purity test: with the default Unicode ones "Color.red" is one word.
        return try rules.compactMap { rule in
            try code.contains(Regex(rule.1).wordBoundaryKind(.simple)) ? "\(name) uses \(rule.0)" : nil
        }
    }

    @Test func theScannerFindsEachRule() throws {
        let planted = """
            NavigationStack { }
            .fullScreenCover(isPresented: $x) { }
            .simultaneousGesture(drag)
            UIImpactFeedbackGenerator(style: .light)
            .textSelection(.enabled)
            Color(red: 1, green: 0, blue: 0)
            .font(.system(size: 17))
            .foregroundStyle(Color.white)
            .alert("Leave round?", isPresented: $x) { }
            Link("Docs", destination: url)
            .contextMenu { }
            """
        // An icon or a frame of a literal size is not a font size; the tokens give fonts their sizes.
        #expect(try Self.findings(in: "icon.swift", "IconView(icon: .cross, size: 16)").isEmpty)
        #expect(try Self.findings(in: "planted.swift", planted).count == 11)
        #expect(try Self.findings(in: "ok.swift", "// NavigationStack in a comment\nColor(\"LaunchSurface\")\nColor.clear\nSafariView(url: url)").isEmpty)
    }

    @Test func appSourcesKeepTheGlobalConstraints() throws {
        let files = FileManager.default.enumerator(at: Self.appSources, includingPropertiesForKeys: nil)
        var found: [String] = []
        var scanned = 0
        while let url = files?.nextObject() as? URL {
            guard url.pathExtension == "swift", url.lastPathComponent != "Tokens.swift", !url.path.contains("/Debug/") else { continue }
            scanned += 1
            found += try Self.findings(in: url.lastPathComponent, String(contentsOf: url, encoding: .utf8))
        }
        #expect(scanned > 0)
        #expect(found == [])
    }
}
```

`ios/Truthy/TruthyTests/EngineLinkTests.swift`:

```swift
import Testing
import TruthyEngine

// The unit tests resolve engine symbols against the app (rule 7). createRng is not called by the app yet, so this
// links only if the app keeps every engine function.
@Suite struct EngineLinkTests {
    @Test func engineFunctionsAreReachableFromTheTests() {
        let rng = createRng(1)
        #expect(rng() * 4_294_967_296 == 2_693_262_067)
        #expect(MODE_TABLE.count == 4)
    }
}
```

`ios/Truthy/TruthyUITests/LaunchTests.swift`:

```swift
import XCTest

/// The app launches and stays in front. Later tasks' UI tests build on this target.
final class LaunchTests: XCTestCase {
    @MainActor
    func testTheAppLaunches() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
    }
}
```

- [ ] **Step 8: Build and run the tests.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild build-for-testing -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E 'error:|warning:|BUILD (SUCCEEDED|FAILED)' | tail -20
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E 'Test run with|Executed [0-9]+ tests?,|TEST (SUCCEEDED|FAILED)|error:' | tail -6
```

Expected: `** TEST BUILD SUCCEEDED **` with no warning of the app's own files; then `Test run with 7 tests in 4 suites passed` (Swift Testing: 2 bundle, 2 font, 2 source rule and 1 engine link tests; the font test is parameterised over the four fonts and counts once), `Executed 1 test, with 0 failures` (the launch test) and `** TEST SUCCEEDED **`. If `EngineLinkTests` fails to link with `Undefined symbols ... createRng`, check that `DEAD_CODE_STRIPPING = NO` is in the app's Debug settings; if it is and the link still fails, add `TruthyEngine` to the `TruthyTests` target's frameworks, note it in the drafting record and go on.

- [ ] **Step 9: Run the hygiene test and commit.**

```bash
git add ios/Truthy ios/Tools/icon/make-icon.swift ios/Tools/fonts/name-table.py
git status --short
pnpm test
git commit -m "feat: add the Truthy app project with the embedded decks, the fonts, the icon and the launch colour"
```

Expected: `git status --short` lists the files of this task as added (`A `) and no `xcuserdata`, `build` or `DerivedData` path (task 1's `ios/.gitignore` keeps them out); `pnpm test` passes, its hygiene test scanning the project files, the PNG (no text or EXIF chunk) and the fonts (UTF-16 runs); the commit is created. If the hygiene test reports a font, stop: rule 5.

- [ ] **Step 10: Run the gates.**

```bash
swift test --package-path ios/TruthyEngine 2>&1 | tail -1
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' 2>&1 | grep -E 'TEST (SUCCEEDED|FAILED)'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.4' 2>&1 | grep -E 'TEST (SUCCEEDED|FAILED)'
git status --short
```

Expected: `Test run with 355 tests in 50 suites passed after ... with 1 known issue`; `** TEST SUCCEEDED **` twice (the app also runs on iOS 18.4, its deployment floor); nothing from `git status --short`.
