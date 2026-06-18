// Script to generate PNG extension icons from icon.svg
// Usage: node scripts/generate-icons.mjs
// Requires: npm install sharp

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, '../icons/icon.svg');
const outputDir = resolve(__dirname, '../icons');

const sizes = [16, 48, 128];
const svg = readFileSync(svgPath, 'utf-8');

async function main() {
  for (const size of sizes) {
    const outputPath = `${outputDir}/icon-${size}.png`;
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated ${outputPath} (${size}x${size})`);
  }
}

main().catch(console.error);
