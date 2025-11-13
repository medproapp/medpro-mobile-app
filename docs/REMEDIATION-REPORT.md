# Remediation Report

## Scope
- Make the Expo mobile app configurable for the single backend environment instead of using a hard-coded LAN IP.
- Resolve the TypeScript compilation blockers uncovered during `npm run type-check`.
- Fix navigation/intents so patient deep links and Android attachment viewing stop crashing.
- Ensure attachment uploads and messaging caches respect authentication + privacy requirements.

## Changes
1. **Environment configuration**
   - Added `src/config/environment.ts` with a single source of truth for `API_BASE_URL`, reading from `EXPO_PUBLIC_API_BASE_URL`, `app.json` extra, or a fallback.
   - Updated `app.json` and `tsconfig.json` (new `@config/*` alias) so any module can import the resolved value; `api.ts`, `authStore`, and dependent screens now consume the shared constant.

2. **TypeScript hygiene**
   - Removed the `@types/*` alias to avoid clashing with DefinitelyTyped packages and switched all notification imports to `@/types/...`.
   - Added the missing `FormStatus` import so the pre-appointment detail screen compiles.

3. **Navigation & intents**
   - `AppointmentDetailsScreen` now escalates patient navigation through the tab navigator (with a `PatientDetails` fallback) instead of pushing an unknown `Patients` route.
   - Android attachment handling uses `IntentLauncher.startActivityAsync('android.intent.action.VIEW', …)` with the documented read flag, eliminating the invalid `IntentFlags/ActivityAction.VIEW` references.

4. **Secure uploads & logout hygiene**
   - All multipart upload helpers (`uploadAttachment`, `uploadImage`, `uploadAudioRecording`) now forward the bearer token and avoid forcing an invalid `Content-Type` header.
   - `authStore.logout` asynchronously clears the messaging cache via the new `messagingService.resetCache()` helper to prevent leaking prior session data to the next user.

5. **Notification store fixes**
   - Tightened the notification store’s state updates to keep `NotificationStatus` types intact, satisfying Zustand’s strict typing during `markAsRead`/`markAllAsRead`.

## Validation
- `npm run type-check` now succeeds without errors.
- Attachment helpers log the new Authorization header in debug builds, and Android attachment viewing opens files again after the intent fix.

## Next Steps
- Set `EXPO_PUBLIC_API_BASE_URL` (or update `app.json > extra.apiBaseUrl`) to the production backend before building for TestFlight/Play.
- Consider adding similar env plumbing for the assistant service (`assistantApi.ts`) if it uses a different host.
