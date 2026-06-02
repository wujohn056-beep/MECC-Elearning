# MECC-Elearning AI Coding Agent Instructions & Rules (agent.md)

> [!IMPORTANT]
> **ATTENTION AI CODING AGENT:**
> You are an automated developer agent working on the MECC-Elearning project. Before making any changes, writing scripts, or editing components, you **MUST** strictly adhere to the following absolute rules and constraints. Failure to do so will introduce critical system regressions (such as clearing live production databases or corrupting translation JSONs).

---

## 1. Absolute Constraints: DO NOT Break These Rules!

### Rule 1: CRITICAL - Explicit Firestore Database ID
The project uses a custom Firestore database instance named `"default"`.
* ❌ **NEVER** call `getFirestore()` without arguments in client files or backend scripts.
* ❌ **NEVER** use `getFirestore(app)` without specifying the database name.
* ✅ **ALWAYS** initialize Firestore explicitly using `"default"` as the second argument:
  * **Client (React):** `getFirestore(app, "default")`
  * **Server / Scripts (Node.js):** `getFirestore(admin.apps[0], 'default')`
  * *Reason for constraint:* Omitting `"default"` directs reads/writes to the standard empty firestore database, causing all user and course list data to disappear from the user's view, mimicking a total data wipe.

### Rule 2: Automatic Background Transcription Triggering
The term **"documents" ("文档")** in user communications refers to **AI speech transcriptions** generated for recordings.
* ❌ **NEVER** assume speech transcriptions are generated automatically by Firestore hooks or database uploads alone.
* ✅ **ALWAYS** trigger the Netlify transcription background function immediately after creating a recording or updating a recording's media file:
  ```typescript
  fetch('/.netlify/functions/transcribe-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId: docRef.id })
  });
  ```
  * *Reason for constraint:* Missing this trigger leaves recordings without document icons (📄) and transcriptions indefinitely.

### Rule 3: Preserving Lecture Notes & Attachments on Edit
Recordings have an array of additional files (slides, PDFs, images) stored in the `'attachments'` field.
* ❌ **NEVER** submit an edit payload without accounting for the existing attachments.
* ✅ **ALWAYS** read, preserve, and pass existing attachments when updating a recording:
  `attachments: currentRecording.attachments || []`
  * *Reason for constraint:* Standard uploader state defaults to empty array `[]` on edit, which silently wipes out previously uploaded lecture files if not explicitly preserved.

### Rule 4: Segment Selection & Category badge Mismatch
The platform segments materials and users into four business lines: `'ss'` (SS Sales), `'leader'` (Leader Academy), `'kid'` (Kids), and `'adult'` (Adults).
* ❌ **NEVER** allow state listeners to reset user selection choices during form renders.
* ❌ **NEVER** submit a category select form without forcing the category's `businessType` onto the recording model.
* ✅ **ALWAYS** ensure `handleSubmit` enforces this mapping strictly:
  `businessType: category?.businessType || businessType`
  * *Reason for constraint:* Categories are dynamically loaded. If an agent does not sync them, manual selection resets back to default segments (e.g. Leader Academy uploads get tagged as Adult badge `adult`).

### Rule 5: 3-Locale Matching Requirement for Translations
The application supports English (`en`), Arabic (`ar`), and Chinese (`zh`).
* ❌ **NEVER** add a UI label or message string in only one language.
* ✅ **ALWAYS** define translations for every new key across all three localization dictionaries:
  - `src/locales/zh.json` (Chinese)
  - `src/locales/en.json` (English)
  - `src/locales/ar.json` (Arabic)
* ✅ **ALWAYS** verify language codes on-the-fly when dealing with custom status fallbacks:
  `i18n.language?.startsWith('ar') ? 'Arabic string' : i18n.language?.startsWith('en') ? 'English string' : 'Chinese string'`

### Rule 6: High Autonomy & Minimal Chat Interruption (CRITICAL)
* ❌ **NEVER** ask the user for verbal permission or confirmation in the chat transcript to run commands, edit files, or write scripts. 
* ✅ **ALWAYS** act with high proactivity and autonomy. Directly execute terminal commands and modify files as needed. 
* ✅ **ONLY** ask clarifying questions in the chat when there is a critical, high-risk architectural decision or ambiguity that cannot be resolved through code inspection.
* *Reason for constraint:* Prompting for verbal confirmation in chat unnecessarily interrupts the user's workflow and wastes time. The user prefers a proactive agent that gets things done directly.

### Rule 7: Target Push Notification Dimensions (CCTL, CCSM, SSTL, SSSM)
When pushing recordings to specific individuals/targets via the Admin panel:
* Checkboxes prefix targets using `role:` (e.g. `role:cctl`).
* Mappings are strictly resolved in `netlify/functions/dingtalk.js`:
  * `CCTL` -> CC Team Leader (`dep === 'CC' && role === 'tl'`)
  * `CCSM` -> CC Sales Manager (`dep === 'CC' && role === 'sm'`)
  * `SSTL` -> SS Team Leader (`dep === 'SS' && role === 'tl'`)
  * `SSSM` -> SS Sales Manager (`dep === 'SS' && role === 'sm'`)
* ✅ **ALWAYS** handle these custom `role:` prefixes when updating recipient resolution loops to ensure correct routing.

### Rule 8: AI Call Scoring Lower Bound (>= 80)
* ❌ **NEVER** return or output an AI overall score (`overallScore`) or individual objection score (`score` under `objectionsHandled`) below 80.
* ✅ **ALWAYS** apply linear score scaling `Math.round(80 + (originalScore * 0.2))` to map the original `0-100` scores beautifully into the `[80, 100]` high-performing bracket.
* *Reason for constraint:* Since all uploaded recordings are pre-selected high-quality recordings, low scores look bad and confuse users. The linear scaling maps the original score gracefully to maintain relative differences while ensuring a premium 80+ score bracket.
* Apply this mapping in `netlify/functions/analyze-audio.js` for both newly generated analyses and cached returns (retroactive coverage).

---

## 2. i18n Dictionary Merging Patterns
When programmatically updating locales, do not manually format the JSON files if it risks syntax damage.
* ✅ **ALWAYS** write a dedicated Node script (using the pattern shown in `update_locales.cjs` or `update_locales_12.cjs`) to parse, deep-merge, and format keys to prevent JSON structure breakage.
* Run the update script from the root directory before running the build step.

---

## 3. Netlify Functions Directory Rules
Cloud functions reside in `netlify/functions/` (e.g. `transcribe-background.js`, `dingtalk.js`).
* ❌ **NEVER** use React hooks, client dependencies, or ES imports (`import ... from`) in Netlify background function files unless properly configured in Vite. Use standard CommonJS `require` statements.
* Ensure all functions are standalone Node.js-compatible scripts.

---

## 4. Post-Deployment Verification & Cache Busting
Vite-compiled assets in production are aggressively cached by client web browsers.
* ❌ **NEVER** tell a user "the change did not deploy" if they don't see it immediately.
* ✅ **ALWAYS** instruct the user to perform a **Hard Refresh** (`Cmd + Shift + R` on Mac, `Ctrl + F5` on Windows) to invalidate local browser caching of JavaScript/CSS assets.
* Verify deployment locally first by running `npm run build` and checking the compilation log.

---

## 5. Technology Stack Summary (For Reference)
* **Core Framework:** React 19 + TypeScript + Vite 7 + Tailwind CSS 4
* **Database & Auth:** Firebase Web SDK 12 (Target DB: `"default"`)
* **Translations:** i18next + react-i18next
* **Native Mobile Integration:** Capacitor 8 (`com.mecccloud.elearning`)
