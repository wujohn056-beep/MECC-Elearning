# ME Cloud Academy

MECC learning platform built with React, Vite, Firebase, Netlify Functions, and Capacitor for Android/iOS wrappers.

## Common Commands

```bash
npm run dev
npm run build
npm run verify:release
npm run smoke:prod
```

Use `npm run verify:release` before every production deploy. It runs the production build and checks the release-critical paths: trilingual locale parity, APK size, native APK nesting, DingTalk function syntax, task/challenge routing markers, task draft persistence markers, effective UID handling, and targeted lint for recently touched release files.

## Mobile Packaging

Use the safe scripts below instead of running raw `cap sync` for release work:

```bash
npm run cap:sync
npm run android:debug
```

`npm run cap:sync` builds the Web app, syncs Capacitor projects, then removes `mecc-latest.apk` from the Android/iOS bundled Web assets. This prevents the downloadable APK from being embedded inside the native app package.

`npm run android:debug` also builds the Android debug APK and copies it to:

```text
public/downloads/mecc-latest.apk
```

The public APK must stay below GitHub's 100MB hard file limit. The release verifier checks this automatically.

## Deployment Notes

The site is configured by `netlify.toml`:

```text
build command: npm run build
publish dir: dist
functions: netlify/functions
```

Before pushing to `main`, run:

```bash
npm run verify:release
git status --short
```

After deployment, run:

```bash
npm run smoke:prod
```

This checks that the production home page and Android APK download URL are externally reachable.

If an Android APK was rebuilt, confirm `public/downloads/mecc-latest.apk` is the intended file and that native assets do not contain nested APK copies:

```bash
find android/app/src/main/assets/public/downloads ios/App/App/public/downloads -maxdepth 1 -type f -name '*.apk' -print
```

That command should print nothing.
