// Build script: copies extension files to dist/ with version synced from version file.
// Usage: npm run build

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

const copyPaths = [
  'background.js',
  'content.js',
  'offscreen.html',
  'offscreen.js',
  'privacy.html',
  'popup',
  'onboarding',
  'lib',
  'icons',
  '_locales',
];

function syncManifestVersion() {
  const version = readFileSync(resolve(root, 'version'), 'utf-8').trim();
  const manifestPath = resolve(root, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  manifest.version = version;
  return manifest;
}

function main() {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  const manifest = syncManifestVersion();
  writeFileSync(resolve(dist, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  for (const path of copyPaths) {
    const source = resolve(root, path);
    const target = resolve(dist, path);
    cpSync(source, target, { recursive: true });
  }

  console.log(`Built extension v${manifest.version} → dist/`);
}

main();
