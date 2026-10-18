const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

// The app needs only READ_SMS, but Expo and library manifests declare these. Removing them only from the release
// variant keeps debug builds able to reach Metro while the shipped APK cannot send data anywhere.
const RELEASE_STRIPPED_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.VIBRATE',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

const manifest = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
${RELEASE_STRIPPED_PERMISSIONS.map((p) => `  <uses-permission android:name="${p}" tools:node="remove"/>`).join('\n')}
</manifest>
`;

module.exports = (config) =>
  withDangerousMod(config, [
    'android',
    (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'release');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'AndroidManifest.xml'), manifest);
      return cfg;
    },
  ]);
