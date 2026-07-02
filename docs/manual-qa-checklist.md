# Manual QA Checklist

Use this checklist after release verification passes and the production deploy is live.
See `docs/release-readiness.md` for the automated/manual verification boundary.
Use `docs/manual-qa-evidence-template.md` to record the account, device, result,
and screenshot evidence for release sign-off.
Run `npm run qa:evidence` to generate a prefilled release evidence file under
`docs/qa-evidence/`. Generated evidence files are local-only and gitignored by
default because they may contain real accounts and screenshot notes.
After filling the file, run
`npm run qa:evidence:check -- docs/qa-evidence/<file>.md`. The check rejects
blank required fields, unresolved `Pass / Fail` placeholders, failed rows,
placeholder evidence text, unconfigured Android push rows, and missing
push/download/trilingual sign-off rows.

## Required Accounts And Devices

- One leader or manager account that can create team tasks and certificate challenges.
- One assigned sales learner account.
- One Android device with the latest APK installed, push permission enabled, and
  an FCM token registered for the learner account.
- One iOS TestFlight device, if iOS push or wrapper behavior changed.

## Web Learning Task Flow

1. As the leader, create a challenge task for the learner with multiple recordings across at least two categories.
2. As the learner, open Team Tasks and click `Go Learn`.
3. Confirm the app opens the challenge learning page, not the general `New CC Zone Only` tab.
4. Confirm recordings are grouped by category.
5. Confirm category order follows the configured category order from the learning hub.
6. Listen to part of one recording, type a reflection draft, then leave the page.
7. Reopen the same task and confirm progress plus reflection draft are still present.
8. Finish all required recordings and submit the reflection.
9. Confirm the task status becomes completed for the learner and visible to the leader.

## Notification Flow

1. Create a new challenge task for the learner.
2. Confirm the learner receives an in-system notification.
3. Click the notification and confirm it opens `/hub?campaignLearnId=...` for challenge tasks.
4. From the DingTalk task message, confirm the deep link resolves to `/hub?taskId=...`.
5. From the DingTalk challenge message, confirm the deep link resolves to `/hub?campaignLearnId=...`.
6. Push a premium recording to App notifications and confirm the learner receives it.
7. Tap the premium recording App push and confirm it opens `/hub?recordingId=...`.
8. Tap the task or challenge mobile push notification and confirm it opens the same learning page.
9. If FCM delivery fails, confirm the task still appears in the learner task list and in-system notifications.

## Mobile App Update And Download

1. On Web, open `/download` and confirm iOS TestFlight and Android APK options render.
2. Download the Android APK and confirm file size is above 10 MB and below 100 MB.
3. Install the APK on Android and log in as the learner.
4. Confirm task, challenge learning, reflection draft, and completion behavior match Web.
5. Confirm app update prompts show current/latest version text in the active language.

## Trilingual Smoke

Repeat the learner task page in Chinese, English, and Arabic:

- Navigation labels render.
- Challenge/task prompts render.
- Draft saved/saving messages render.
- Update/download prompts render.
- No untranslated key names are visible.

## Commands Before And After QA

```bash
npm run verify:release
npm run smoke:prod
npm run qa:evidence
npm run qa:evidence:check -- docs/qa-evidence/<file>.md
git status --short
```

Do not mark the release as fully verified until both automated checks pass and
the manual learner flow, including Android push receive/tap behavior, has been
tested with a real assigned account.
