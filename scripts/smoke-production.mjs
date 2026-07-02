import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const baseUrl = (process.env.PROD_BASE_URL || 'https://learning.mecloudhub.com').replace(/\/$/, '');
const minApkBytes = 10 * 1024 * 1024;
const maxApkBytes = 100 * 1024 * 1024;
const retryAttempts = Number(process.env.PROD_SMOKE_RETRIES || 5);
const retryDelayMs = Number(process.env.PROD_SMOKE_RETRY_DELAY_MS || 15000);
const localApkPath = 'public/downloads/mecc-latest.apk';
const localApkBytes = existsSync(localApkPath) ? statSync(localApkPath).size : 0;
const localApkHash = existsSync(localApkPath)
  ? createHash('sha256').update(await readFile(localApkPath)).digest('hex')
  : '';

const checks = [];
const addCheck = (name, pass, detail = '') => checks.push({ name, pass, detail });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (label, run, isReady) => {
  let lastResult;
  let lastError;

  for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
    try {
      const result = await run();
      lastResult = result;
      if (isReady(result)) return result;
    } catch (error) {
      lastError = error;
    }

    if (attempt < retryAttempts) {
      console.log(`[wait] ${label} not ready yet, retrying in ${Math.round(retryDelayMs / 1000)}s (${attempt}/${retryAttempts})`);
      await sleep(retryDelayMs);
    }
  }

  if (lastError) throw lastError;
  return lastResult;
};

const head = async (path) => {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    method: 'HEAD',
    headers: { 'Accept-Encoding': 'identity' },
    redirect: 'follow'
  });
  return { url, response };
};

const getHtml = async (path) => {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    headers: { 'Accept-Encoding': 'identity' },
    redirect: 'follow'
  });
  const body = await response.text();
  return { url, response, body };
};

const getAppAssetPaths = (html) => {
  const assetPaths = new Set();
  const assetPattern = /(?:src|href)="([^"]*\/assets\/index-[^"]+\.(?:js|css))"/g;
  let match = assetPattern.exec(html);
  while (match) {
    const assetUrl = new URL(match[1], baseUrl);
    assetPaths.add(`${assetUrl.pathname}${assetUrl.search}`);
    match = assetPattern.exec(html);
  }
  return [...assetPaths];
};

const getRemoteFileSize = async (path, headResponse) => {
  const headLength = Number(headResponse.headers.get('content-length') || 0);
  if (headLength > 0) return headLength;

  const url = `${baseUrl}${path}`;
  const rangeResponse = await fetch(url, {
    headers: {
      'Accept-Encoding': 'identity',
      Range: 'bytes=0-0'
    },
    redirect: 'follow'
  });
  const contentRange = rangeResponse.headers.get('content-range') || '';
  const match = contentRange.match(/\/(\d+)$/);
  return match ? Number(match[1]) : 0;
};

const getRemoteFileHash = async (path) => {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    headers: { 'Accept-Encoding': 'identity' },
    redirect: 'follow'
  });
  if (!response.ok) return '';
  const buffer = Buffer.from(await response.arrayBuffer());
  return createHash('sha256').update(buffer).digest('hex');
};

try {
  let homePage = null;
  const htmlRoutes = [
    ['home', '/'],
    ['download page', '/download'],
    ['campaign learning route', '/hub?campaignLearnId=smoke-test'],
    ['task learning route', '/hub?taskId=smoke-test'],
    ['recording detail route', '/hub?recordingId=smoke-test'],
    ['admin app release route', '/admin/app-release']
  ];

  for (const [name, path] of htmlRoutes) {
    const page = await withRetry(
      `production ${name}`,
      () => getHtml(path),
      (result) => {
        const pageType = result.response.headers.get('content-type') || '';
        const hasAppShell = result.body.includes('id="root"') && result.body.includes('type="module"');
        return result.response.ok && pageType.includes('text/html') && hasAppShell;
      }
    );
    const pageType = page.response.headers.get('content-type') || '';
    const hasAppShell = page.body.includes('id="root"') && page.body.includes('type="module"');
    addCheck(`production ${name} returns 200`, page.response.ok, `${page.response.status} ${page.url}`);
    addCheck(`production ${name} is html`, pageType.includes('text/html'), pageType);
    addCheck(`production ${name} serves app shell`, hasAppShell, `${page.body.length} bytes`);
    if (path === '/') homePage = page;
  }

  const assetPaths = homePage ? getAppAssetPaths(homePage.body) : [];
  addCheck('production app shell references build assets', assetPaths.length > 0, assetPaths.join(', '));
  for (const assetPath of assetPaths) {
    const asset = await withRetry(
      `production asset ${assetPath}`,
      () => head(assetPath),
      (result) => result.response.ok
    );
    const assetType = asset.response.headers.get('content-type') || '';
    const expectedType = assetPath.endsWith('.css') ? 'text/css' : 'javascript';
    addCheck(`production asset ${assetPath} returns 200`, asset.response.ok, `${asset.response.status} ${asset.url}`);
    addCheck(`production asset ${assetPath} content type`, assetType.includes(expectedType), assetType);
  }

  const apk = await withRetry(
    'production APK',
    async () => {
      const response = await head('/downloads/mecc-latest.apk');
      const bytes = await getRemoteFileSize('/downloads/mecc-latest.apk', response.response);
      const type = response.response.headers.get('content-type') || '';
      return { ...response, bytes, type };
    },
    (result) => result.response.ok
      && result.bytes >= minApkBytes
      && result.bytes < maxApkBytes
      && (
        result.type.includes('application/vnd.android.package-archive')
        || result.type.includes('application/octet-stream')
      )
  );
  const apkBytes = await getRemoteFileSize('/downloads/mecc-latest.apk', apk.response);
  const apkType = apk.type || apk.response.headers.get('content-type') || '';
  addCheck('production APK returns 200', apk.response.ok, `${apk.response.status} ${apk.url}`);
  addCheck('production APK size looks valid', apkBytes >= minApkBytes && apkBytes < maxApkBytes, `${apkBytes} bytes`);
  if (localApkBytes > 0) {
    addCheck('production APK matches repository APK size', apkBytes === localApkBytes, `production=${apkBytes}, local=${localApkBytes}`);
  }
  if (localApkHash) {
    const remoteApkHash = await getRemoteFileHash('/downloads/mecc-latest.apk');
    addCheck('production APK matches repository APK hash', remoteApkHash === localApkHash, `production=${remoteApkHash}, local=${localApkHash}`);
  }
  addCheck(
    'production APK content type looks valid',
    apkType.includes('application/vnd.android.package-archive') || apkType.includes('application/octet-stream'),
    apkType
  );
} catch (error) {
  addCheck('production smoke request completed', false, error instanceof Error ? error.message : String(error));
}

let failed = 0;
for (const check of checks) {
  const status = check.pass ? 'ok' : 'fail';
  console.log(`[${status}] ${check.name}${check.detail ? ` (${check.detail})` : ''}`);
  if (!check.pass) failed += 1;
}

if (failed > 0) {
  console.error(`Production smoke failed: ${failed} check(s) failed.`);
  process.exit(1);
}

console.log(`Production smoke passed for ${baseUrl}.`);
