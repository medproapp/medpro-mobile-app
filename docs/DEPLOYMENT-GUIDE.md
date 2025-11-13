# MedPro Mobile Deployment Guide

A practical playbook for building, testing, and shipping the MedPro mobile app across Expo internal builds, Apple TestFlight/App Store, and Google Play internal/production tracks.

---
## 1. Prerequisites
- **Expo CLI / EAS CLI**: `npm install -g eas-cli` (or use `npx eas-cli`).
- **Node.js**: version from `.nvmrc` if present; otherwise >= 18.
- **Apple Developer Account** with access to App Store Connect and an App ID `com.medproapp.prof.app` already created.
- **Google Play Console** access with the app package `com.medproapp.prof.app` registered.
- **Credentials**: Apple app-specific password (for `eas submit`), Apple team ID, and Google Play service account JSON for uploads.
- **Expo account**: log in with `npx expo whoami` / `npx expo login`.
- **Dependencies** installed with `npm install` (SDK 54 stack).

Optional but recommended:
- Xcode (for local simulator, log capture).
- Android Studio / `adb` for Android device debugging.
- Fast internet for binary uploads.

---
## 2. Configuration overview
- `app.json`: production bundle IDs (`com.medproapp.prof.app`), version `0.8.1`, Android `versionCode` 81.
- `app.json.extra.apiBaseUrl`: default backend (`https://medproapp.ngrok.dev`). Override via `EXPO_PUBLIC_API_BASE_URL` when building.
- `eas.json` profiles:
  - `development`: dev client, internal distribution.
  - `preview`: internal distribution (QA builds).
  - `production`: store-ready builds with auto-incremented versions.
- Credentials managed by EAS (Expo handles signing unless you’ve uploaded custom certs/keystore).

---
## 3. Local verification checkpoint
Before any cloud build, ensure the workspace is clean:
```bash
npm install
npm run type-check
npm run start        # optional to sanity-check Metro
```
Stop Metro (`Ctrl+C`) before running `eas build` commands.

---
## 4. Expo / Dev Client workflows
### 4.1 Create/update a custom dev client (iOS)
```bash
npx eas-cli build --platform ios --profile development
# Once finished, install the .ipa from the build dashboard onto your device/simulator
```
### 4.2 Create/update a custom dev client (Android)
```bash
npx eas-cli build --platform android --profile development
# Install the downloaded .apk/.aab on your test device
```
Use these dev clients for testing features locally with `npm run start` (they embed the correct SDK 54 runtime).

---
## 5. Internal QA builds (Expo distribution)
These builds are not submitted to stores; they’re delivered via Expo and can be installed with `expo dev client` or the Expo Go-compatible binaries.

### iOS Preview build
```bash
npx eas-cli build --platform ios --profile preview
```
### Android Preview build
```bash
npx eas-cli build --platform android --profile preview
```
Share the Expo build URLs with QA; they can install via QR code or download the artifacts directly.

---
## 6. Apple TestFlight submission
### 6.1 Build a production-ready `.ipa`
```bash
npx eas-cli build --platform ios --profile production
```
Output: signed `.ipa` ready for App Store Connect.

### 6.2 Submit to TestFlight
```bash
npx eas-cli submit --platform ios --profile production --latest
```
You’ll be prompted for:
- Apple app-specific password
- App Store Connect Apple ID (if not already stored)
- Team selection, if multiple.

**After submission**
- Apple processes the build (~15–30 min).
- In App Store Connect → TestFlight, mark the build for **Internal Testing** to invite team members.
- For external testers, request review (TestFlight requires Apple to approve the build before external distribution).

**Going live**
- Once QA signs off, create a new App Store version entry, attach the processed build, fill in release notes, and submit for App Review.
- After approval, choose a release option (manual/automatic/phased).

---
## 7. Google Play submission
### 7.1 Build a production `.aab`
```bash
npx eas-cli build --platform android --profile production
```
### 7.2 Submit to the Play Console internal track
```bash
npx eas-cli submit --platform android --profile production --latest --track internal
```
Inputs needed:
- Google Play service account JSON (provide path or paste when prompted).
- Track selection (internal/closed/open/production). Use `--track internal` for QA builds.

**After submission**
- Google processes the `.aab` (usually <10 min).
- Activate the release in the chosen track and share the tester opt-in link.
- Promote to production from the Play Console once QA is satisfied.

---
## 8. Environment overrides / secrets
### API base URL
Use environment variables per profile (e.g., `EXPO_PUBLIC_API_BASE_URL=https://prod.medproapp.com`) by editing `eas.json`:
```json
"production": {
  "autoIncrement": true,
  "env": {
    "EXPO_PUBLIC_API_BASE_URL": "https://prod.medproapp.com"
  }
}
```
### Apple credentials
- Set `EAS_APPLE_APP_SPECIFIC_PASSWORD` or input manually during `eas submit`.
- For CI, configure EAS secrets (`eas secret:create`) to store passwords/team IDs.

### Google credentials
- Store `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` in EAS secrets or pass `--key` pointing to the JSON file.

---
## 9. Common troubleshooting
| Problem | Fix |
| --- | --- |
| `React Native version mismatch` on device | Rebuild/install a dev client aligned with SDK 54 (section 4). Ensure Expo Go version still supports SDK 54. |
| `npm install` fails asking for SDK 55 packages | Ignore `expo install --check` prompts until Expo officially releases SDK 55. Keep `package.json` on the SDK 54 deps. |
| iOS build fails with `RCTReleaseLevel` errors | Ensure `expo@54.0.22` (not 54.0.23). Do not patch node modules; the earlier patch release avoids the new initializer. Clean install before building. |
| `git` commands blocked during build (status 69) | Accept Xcode license locally: `sudo xcodebuild -license accept`. |
| `expo start` prompts to install Command Line Tools | Install or update via `xcode-select --install` and `softwareupdate --install 'Command Line Tools for Xcode …'`. |
| EAS CLI complains about duplicate modules | Safe to ignore while on SDK 54; warnings point to upcoming SDK 55 modules. |

---
## 10. Final checklist before submission
1. `npm run type-check` passes.
2. Local smoke-test in Expo dev client (iOS and Android).
3. Update screenshots/metadata if UI changed.
4. Increment `expo.version`, `expo.ios.buildNumber`, `expo.android.versionCode` if necessary.
5. Run production builds (section 6/7) and store submissions.
6. Record build IDs and tester instructions in your tracking tool (Jira/Trello/etc.).

---
## 11. References
- Expo EAS docs: https://docs.expo.dev/build/introduction/
- Expo Submit: https://docs.expo.dev/submit/introduction/
- Apple TestFlight: https://developer.apple.com/testflight/
- Google Play Internal testing: https://support.google.com/googleplay/android-developer/answer/9844544

Keep this guide in `docs/DEPLOYMENT-GUIDE.md` and update it whenever profiles, credentials, or store procedures change.
