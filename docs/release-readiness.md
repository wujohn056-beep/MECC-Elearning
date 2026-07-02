# Release Readiness Notes

Current automated release gates are designed to protect the learning task,
challenge, notification, trilingual, and mobile download flows before a release
is treated as deployable.

## Automated Gates

Run these before and after deployment:

```bash
npm run verify:release
npm run smoke:prod
```

`verify:release` covers:

- Web build success.
- Locale key parity across Chinese, English, and Arabic.
- Critical task, challenge, notification, update, and download translation keys.
- Latest Android APK exists in `public/downloads/mecc-latest.apk`.
- APK size stays below the GitHub hard limit.
- Native app assets do not embed the APK.
- Android native `versionName` matches the client Android version.
- APK web assets match the current build output.
- DingTalk function syntax.
- Targeted lint on critical release files.
- Challenge `Go Learn` routing through `campaignLearnId`.
- Task recordings grouped by configured category order.
- In-system and native notification routes for recordings, tasks, and campaigns.
- Task draft autosave and in-progress task visibility.
- Download page and app update fallback links.
- FCM failure fallback copy.

`smoke:prod` covers the live production host:

- Home page serves the app shell.
- Download page serves the app shell.
- Campaign learning route serves the app shell.
- Task learning route serves the app shell.
- Recording detail route serves the app shell.
- Admin App release route serves the app shell.
- Latest APK URL returns a valid Android package with a plausible file size.
- Latest APK URL matches the repository APK file size.
- Latest APK URL matches the repository APK SHA-256 hash.

## Manual Gates

The release is not fully verified until a real assigned learner account and real
mobile device confirm:

- Leader-created challenge tasks appear for the assigned learner.
- `Go Learn` opens the challenge learning page instead of the general hub tab.
- Recordings are grouped by category and follow the configured category order.
- Partial progress and reflection drafts survive leaving and reopening the task.
- Completion updates are visible to the learner and leader.
- In-system notifications open the correct learning page.
- Native mobile push taps open the correct recording, task, or campaign page.
- Web `/download` installs the current Android APK successfully.
- The same learner flow works in Chinese, English, and Arabic without raw locale keys.

Record sign-off evidence in `docs/manual-qa-evidence-template.md`.

## External Release Configuration

After publishing a new Android APK, open `/admin/app-release` with a super admin account and set
`Android Latest Version` to the released Android `versionName` or higher. Existing installed
clients use Firestore `system_config/app_versions.android_latest` to decide whether to show the
update prompt.

Use direct Firestore edits only as an emergency fallback.

## Release Status Language

Use "automated release gates passed" only after both commands pass.

Use "fully verified" only after the manual gates above are tested with real
accounts and devices.
