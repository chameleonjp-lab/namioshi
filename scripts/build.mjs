import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sourceRoot = 'src';
const distRoot = 'dist';
const assetsRoot = join(distRoot, 'assets');
const forbiddenSources = [];

function walk(directory, visit) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, visit);
    else visit(path);
  }
}

walk(sourceRoot, path => {
  if (/\.tsx?$/i.test(path)) forbiddenSources.push(path);
});

if (forbiddenSources.length) {
  console.error('build failed: TypeScript source files remain');
  console.error(forbiddenSources.join('\n'));
  process.exit(1);
}

rmSync(distRoot, { recursive: true, force: true });
mkdirSync(distRoot, { recursive: true });
cpSync(sourceRoot, assetsRoot, { recursive: true });

writeFileSync(
  join(distRoot, 'index.html'),
  '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><meta name="theme-color" content="#020813"><title>namioshi</title><link rel="stylesheet" href="./assets/ui/styles.css"></head><body><div id="app"></div><script type="module" src="./assets/main.js"></script></body></html>'
);

console.log('building dist from plain JavaScript sources...');
console.log('✓ copied src to dist/assets and generated dist/index.html');