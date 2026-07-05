import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const apkPath = 'public/downloads/mecc-latest.apk';
const distIndexPath = 'dist/index.html';

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!existsSync(apkPath)) fail(`Missing APK: ${apkPath}`);
if (!existsSync(distIndexPath)) fail(`Missing build output: ${distIndexPath}`);

const unzipIndex = spawnSync('unzip', ['-p', apkPath, 'assets/public/index.html'], {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024
});

if (unzipIndex.status !== 0) {
  fail(`Unable to read assets/public/index.html from APK: ${unzipIndex.stderr.trim()}`);
}

const distIndex = readFileSync(distIndexPath, 'utf8');

const getEntryAssets = (html) => new Set(
  [...html.matchAll(/\/assets\/(index-[^"']+\.(?:js|css))/g)].map((match) => match[1])
);
const distEntryAssets = getEntryAssets(distIndex);
const apkEntryAssets = getEntryAssets(unzipIndex.stdout);
const missingEntryAssets = [...distEntryAssets].filter((name) => !apkEntryAssets.has(name));
if (missingEntryAssets.length > 0) {
  fail(`APK web shell is stale. Missing current entry assets in APK index: ${missingEntryAssets.join(', ')}`);
}

const distAssetFiles = readdirSync('dist/assets').filter(name => /^index-.*\.(js|css)$/.test(name));
const apkListing = spawnSync('unzip', ['-Z1', apkPath], {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024
});

if (apkListing.status !== 0) {
  fail(`Unable to list APK assets: ${apkListing.stderr.trim()}`);
}

const apkEntries = new Set(apkListing.stdout.split('\n').filter(Boolean));
const missingAssets = distAssetFiles.filter(name => !apkEntries.has(`assets/public/assets/${name}`));
if (missingAssets.length > 0) {
  fail(`APK web assets are stale or incomplete. Missing from APK: ${missingAssets.join(', ')}`);
}

const changedAssets = distAssetFiles.filter((name) => {
  const unzipAsset = spawnSync('unzip', ['-p', apkPath, `assets/public/assets/${name}`], {
    maxBuffer: 20 * 1024 * 1024
  });
  if (unzipAsset.status !== 0) return true;
  return !unzipAsset.stdout.equals(readFileSync(`dist/assets/${name}`));
});
if (changedAssets.length > 0) {
  fail(`APK web assets do not match current build output: ${changedAssets.join(', ')}`);
}

console.log('APK web assets match current build output.');
