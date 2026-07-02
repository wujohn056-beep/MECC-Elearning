import { rmSync } from 'node:fs';

const nativeDownloadAssets = [
  'android/app/src/main/assets/public/downloads/mecc-latest.apk',
  'ios/App/App/public/downloads/mecc-latest.apk'
];

for (const assetPath of nativeDownloadAssets) {
  rmSync(assetPath, { force: true });
  console.log(`Removed native-only bundled download asset: ${assetPath}`);
}
