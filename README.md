# Expense Tracker

A personal Android app that turns bank and UPI SMS into Transactions and shows where your money goes. Everything
stays on the phone: no server, no account and no network access in release builds (see
[`docs/adr/0001-on-device-sms-ingestion.md`](docs/adr/0001-on-device-sms-ingestion.md)).

## Install

Download `expense-tracker-<version>.apk` from the
[latest release](https://github.com/sadiq1402/expense-tracker/releases/latest). The app reads SMS, so it can't be on
the Play Store and Android guards it twice. Pick one of these paths.

### Option A: over USB with adb (fewest prompts)

1. On the phone: **Settings → About phone →** tap **Build number** 7 times, then **Settings → System → Developer
   options → USB debugging**.
2. Plug the phone in, accept the debugging prompt, and run:

   ```bash
   adb install -r expense-tracker-<version>.apk
   ```

3. Open the app and allow SMS access.

### Option B: from the phone's browser

1. **Play Protect** may block the install ("App blocked to protect your device"). If the dialog offers **More details →
   Install anyway**, use it. If it only offers **OK**, open **Play Store → profile → Play Protect → ⚙ → Scan apps with
   Play Protect**, turn it off, install the APK, then turn it back on.
2. Android then denies SMS access as a **restricted setting**. Open **Settings → Apps → expense-tracker**, try
   **Permissions → SMS → Allow** once (it's greyed out), then use **⋮ → Allow restricted settings** and confirm.
   **Allow** now works.
3. Return to the app; it scans the last 6 months of SMS.

Installing a newer release over an existing one keeps your data and permissions.

## Develop

```bash
npm install
npx expo run:android   # development build on a connected phone or emulator
npm test               # Jest
npx tsc --noEmit       # typecheck
npx expo lint
```

Domain logic is pure TypeScript in `src/domain/`, persistence in `src/db/`, screens in `src/app/` (Expo Router), and
the native SMS reader is a local Expo module in `modules/sms-reader/`. Domain terms follow
[`GLOSSARY.md`](GLOSSARY.md).

## Release

Push a `v*` tag (or run the **Release APK** workflow with a tag) and GitHub Actions builds an `arm64-v8a` APK and
attaches it to a GitHub Release. Locally: `npm run build:apk`.

Release builds strip every permission except `READ_SMS` (`plugins/withReleasePermissions.js`), including network
access. Only `arm64-v8a` is built, which nearly every phone in use runs. They're signed with Expo's template debug
keystore, which is fine for sideloading onto your own phone.
