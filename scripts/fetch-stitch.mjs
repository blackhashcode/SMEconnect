// Exports HTML code and screenshots for every screen in a Stitch project.
// Reads the Stitch API key from the workspace opencode.json MCP configuration.
// Usage: node scripts/fetch-stitch.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'opencode.json');
const OUT_DIR = path.join(ROOT, 'stitch-export');
const PROJECT_ID = '15933515139709463765';

const SCREEN_IDS = [
  '057fe082627d4c4e924e998b1813bbca',
  '22aaceb5493249868dd2e14a3c05626f',
  '32b9150895754776b1b35476665769db',
  '4b8267f6eb4e43f9af57d42253305f87',
  '4ef5081ba09441cf8d0d231c0e515684',
  '51c041e7a47a433785f6c4d231a7bad2',
  '5aa33683ef2c4eb9a979cb3f9e456eef',
  '7f44925bdf674a95af25ea9e4b04123f',
  '9182ad6b5d7f4df09ceb2f30cdf094ab',
  '9fa66ed0f3dd49cbb59c7444a8be1cff',
  'ab069df13d5a4cecb5330e00bf18555b',
  'ce947fa7d3de4706a26ddf16e9741494',
  'db198d5768d14cfd97a85beb3d2584f0',
  'e3b426ebe69d4bda95c26722e319fe18',
  'f37256cd8ef44e7a9377cf3f920a53c2',
];

function slugify(value, index) {
  const slug = value
    .replace(/^SME Connect\s*[—-]\s*/i, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${String(index + 1).padStart(2, '0')}-${slug}`;
}

async function mcpCall(name, args) {
  const response = await fetch('https://stitch.googleapis.com/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'X-Goog-Api-Key': API_KEY,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  if (!response.ok) {
    throw new Error(`MCP ${name} failed: ${response.status} ${await response.text()}`);
  }
  const payload = await response.json();
  if (payload.error) throw new Error(`MCP ${name} error: ${JSON.stringify(payload.error)}`);
  const textContent = payload.result?.content?.find((item) => item.type === 'text');
  if (!textContent) throw new Error(`MCP ${name} returned no content`);
  return JSON.parse(textContent.text);
}

async function fetchArtifact(url, kind) {
  const response = await fetch(url, {
    headers: { 'X-Goog-Api-Key': API_KEY },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`${kind} download failed: ${response.status} ${await response.text()}`);
  }
  const contentType = response.headers.get('content-type') || '';
  const raw = Buffer.from(await response.arrayBuffer());

  if (contentType.includes('application/json')) {
    const wrapper = JSON.parse(raw.toString('utf8'));
    if (typeof wrapper.dataString !== 'string') {
      throw new Error(`${kind} response had no dataString: ${Object.keys(wrapper).join(', ')}`);
    }
    if (kind === 'image') return Buffer.from(wrapper.dataString, 'base64');
    return Buffer.from(wrapper.dataString, 'utf8');
  }
  return raw;
}

const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
const API_KEY = config.mcp?.stitch?.headers?.['X-Goog-Api-Key'];
if (!API_KEY) throw new Error('Missing X-Goog-Api-Key in opencode.json');

await fs.mkdir(OUT_DIR, { recursive: true });
const { screens } = await mcpCall('list_screens', { projectId: PROJECT_ID });
const byId = new Map(screens.map((screen) => [screen.name.split('/').pop(), screen]));

const manifest = {
  projectId: PROJECT_ID,
  exportedAt: new Date().toISOString(),
  screens: [],
};

for (const [index, screenId] of SCREEN_IDS.entries()) {
  const screen = byId.get(screenId);
  if (!screen) throw new Error(`Screen not found in project: ${screenId}`);

  const folder = path.join(OUT_DIR, slugify(screen.title, index));
  await fs.mkdir(folder, { recursive: true });

  const htmlPath = path.join(folder, 'screen.html');
  const imagePath = path.join(folder, 'screenshot.png');
  await Promise.all([
    fetchArtifact(screen.htmlCode.downloadUrl, 'html').then((data) =>
      fs.writeFile(htmlPath, data),
    ),
    fetchArtifact(screen.screenshot.downloadUrl, 'image').then((data) =>
      fs.writeFile(imagePath, data),
    ),
  ]);

  const entry = {
    order: index + 1,
    title: screen.title,
    screenId,
    width: Number(screen.width),
    height: Number(screen.height),
    deviceType: screen.deviceType,
    html: path.relative(ROOT, htmlPath).replaceAll('\\', '/'),
    screenshot: path.relative(ROOT, imagePath).replaceAll('\\', '/'),
    sourceHtmlUrl: screen.htmlCode.downloadUrl,
    sourceScreenshotUrl: screen.screenshot.downloadUrl,
  };
  manifest.screens.push(entry);
  console.log(`${entry.order}/${SCREEN_IDS.length} ${entry.title}`);
}

await fs.writeFile(path.join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Exported ${manifest.screens.length} screens to ${OUT_DIR}`);
