# Manual QA Checklist

Use this checklist after release verification passes and the production deploy is live.

## Required Accounts And Devices

- One leader or manager account that can create team tasks and certificate challenges.
- One assigned sales learner account.
- One Android device with the latest APK installed.
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
4. If app push is configured for the learner, tap the mobile push notification and confirm it opens the same challenge learning page.
5. If FCM delivery fails, confirm the task still appears in the learner task list and in-system notifications.

## Mobile App Update And Download

1. On Web, open `/download` and confirm iOS TestFlight and Android APK options render.
2. Download the Android APK and confirm file size is around 73 MB.
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
git status --short
```

Do not mark the release as fully verified until both automated checks pass and the manual learner flow has been tested with a real assigned account.
