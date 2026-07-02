const baseUrl = (process.env.PROD_BASE_URL || 'https://learning.mecloudhub.com').replace(/\/$/, '');
const minApkBytes = 50 * 1024 * 1024;
const maxApkBytes = 100 * 1024 * 1024;

const checks = [];
const addCheck = (name, pass, detail = '') => checks.push({ name, pass, detail });

const head = async (path) => {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    method: 'HEAD',
    headers: { 'Accept-Encoding': 'identity' },
    redirect: 'follow'
  });
  return { url, response };
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

try {
  const htmlRoutes = [
    ['home', '/'],
    ['download page', '/download'],
    ['campaign learning route', '/hub?campaignLearnId=smoke-test'],
    ['task learning route', '/hub?taskId=smoke-test'],
    ['recording detail route', '/hub?recordingId=smoke-test']
  ];

  for (const [name, path] of htmlRoutes) {
    const page = await head(path);
    const pageType = page.response.headers.get('content-type') || '';
    addCheck(`production ${name} returns 200`, page.response.ok, `${page.response.status} ${page.url}`);
    addCheck(`production ${name} is html`, pageType.includes('text/html'), pageType);
  }

  const apk = await head('/downloads/mecc-latest.apk');
  const apkBytes = await getRemoteFileSize('/downloads/mecc-latest.apk', apk.response);
  const apkType = apk.response.headers.get('content-type') || '';
  addCheck('production APK returns 200', apk.response.ok, `${apk.response.status} ${apk.url}`);
  addCheck('production APK size looks valid', apkBytes >= minApkBytes && apkBytes < maxApkBytes, `${apkBytes} bytes`);
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
