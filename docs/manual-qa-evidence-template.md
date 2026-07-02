# Manual QA Evidence Template

Use this file as the release sign-off record after `npm run verify:release` and
`npm run smoke:prod` pass. Fill one copy per production release.
After filling the copy, run `npm run qa:evidence:check -- <path-to-copy>` before
calling the release fully verified.

## Release Under Test

- Release commit:
- Production URL:
- QA date:
- QA owner:
- Leader account:
- Learner account:
- Android device and OS:
- Android APK SHA-256:
- iOS TestFlight device and OS, if tested:

## Automated Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run verify:release` | Pass / Fail | Paste command timestamp or CI run URL |
| `npm run smoke:prod` | Pass / Fail | Paste command timestamp or CI run URL |
| GitHub Actions latest main run | Pass / Fail | Paste run URL |
| Production APK hash matches repository APK | Pass / Fail | Paste SHA-256 |

## Manual Web Flow Evidence

| Requirement | Result | Evidence |
| --- | --- | --- |
| Leader creates a challenge task for the learner | Pass / Fail | Task title, task ID, screenshot |
| Learner sees the assigned challenge task | Pass / Fail | Screenshot |
| `Go Learn` opens the challenge learning page | Pass / Fail | URL/screenshot showing `campaignLearnId` |
| Challenge does not fall back to the general hub tab | Pass / Fail | Screenshot |
| Task recordings are grouped by category | Pass / Fail | Screenshot |
| Category order follows the configured Learning Hub order | Pass / Fail | Screenshot or category list |
| Partial listening progress survives leaving and reopening | Pass / Fail | Before/after screenshots |
| Reflection draft survives leaving and reopening | Pass / Fail | Before/after screenshots |
| Task completion is visible to learner and leader | Pass / Fail | Learner and leader screenshots |

## Manual Notification Evidence

| Requirement | Result | Evidence |
| --- | --- | --- |
| Learner receives in-system notification | Pass / Fail | Screenshot |
| In-system notification opens the challenge learning page | Pass / Fail | URL/screenshot |
| DingTalk task message opens the task learning page | Pass / Fail | URL/screenshot showing `taskId` |
| DingTalk challenge message opens the challenge learning page | Pass / Fail | URL/screenshot showing `campaignLearnId` |
| Arabic DingTalk task/challenge messages render in Arabic | Pass / Fail | Screenshot showing Arabic notification text |
| Android push notification is received | Pass / Fail | Device screenshot |
| Android push tap opens the correct recording/task/campaign page | Pass / Fail | Device screenshot |
| Arabic Android push notification renders in Arabic | Pass / Fail | Device screenshot showing Arabic push text |
| FCM failure fallback still leaves task accessible | Pass / Fail / Not applicable | Task list screenshot |

## Manual Mobile App Evidence

| Requirement | Result | Evidence |
| --- | --- | --- |
| `/download` renders iOS and Android options | Pass / Fail | Screenshot |
| Android APK installs successfully | Pass / Fail | Device screenshot |
| Android learner login works | Pass / Fail | Screenshot |
| Android challenge task flow matches Web | Pass / Fail | Screenshot |
| Android reflection draft and completion behavior match Web | Pass / Fail | Screenshot |
| App update prompt shows current/latest versions in active language | Pass / Fail | Screenshot |

## Trilingual Evidence

| Language | Result | Evidence |
| --- | --- | --- |
| Chinese | Pass / Fail | Screenshot showing task/challenge/update text |
| English | Pass / Fail | Screenshot showing task/challenge/update text |
| Arabic | Pass / Fail | Screenshot showing task/challenge/update text |

## Sign-off

- Fully verified: Yes / No
- Known issues:
- Follow-up owner:
- Sign-off name and time:

Do not mark a release as fully verified when any required row is `Fail`, when
Android push is not configured, or when real assigned account/device evidence is
missing.
