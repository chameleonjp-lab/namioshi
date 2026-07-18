import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const bad = [];
const sourceRoot = 'src';
const distRoot = 'dist';
const assetsRoot = join(distRoot, 'assets');

function toPosix(path) {
  return path.split('\\').join('/');
}

function walk(directory, visit) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, visit);
    else visit(path);
  }
}

function filesUnder(root) {
  const files = [];
  if (!existsSync(root)) return files;
  walk(root, path => files.push(toPosix(relative(root, path))));
  return files.sort();
}

function checkModuleSyntax(path, text) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: text,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    bad.push(`JavaScript syntax error: ${path}\n${result.stderr || result.stdout}`);
  }
}

function importSpecifiers(text) {
  const values = [];
  const staticImport = /(?:^|[;\n])\s*(?:import|export)(?:[^'";]*?\bfrom)?\s*['"]([^'"]+)['"]/g;
  const dynamicImport = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const expression of [staticImport, dynamicImport]) {
    let match;
    while ((match = expression.exec(text))) values.push(match[1]);
  }
  return values;
}

function checkImports(path, text) {
  for (const specifier of importSpecifiers(text)) {
    if (!specifier.startsWith('.')) {
      bad.push(`bare or absolute import ${specifier}: ${path}`);
      continue;
    }
    if (!specifier.endsWith('.js')) {
      bad.push(`relative import without .js extension ${specifier}: ${path}`);
      continue;
    }
    const target = resolve(dirname(path), specifier);
    if (!existsSync(target)) bad.push(`missing relative import ${specifier}: ${path}`);
  }
}

function checkJavaScript(path) {
  const text = readFileSync(path, 'utf8');
  checkModuleSyntax(path, text);
  checkImports(path, text);

  if (/\bimport\s+type\b/.test(text)) bad.push(`import type remains: ${path}`);
  if (/\bexport\s+type\b/.test(text)) bad.push(`export type remains: ${path}`);
  if (/:\s*(?:number|string|boolean|AudioContext|OscillatorType)(?:\b|\|)/.test(text)) {
    bad.push(`TypeScript type annotation remains: ${path}`);
  }
  if (/\|\s*null\b/.test(text)) bad.push(`TypeScript null union remains: ${path}`);
  if (/\bfrom\s*['"](?:three|vite|typescript)['"]/.test(text)) bad.push(`forbidden bare dependency import: ${path}`);
}

function checkPublishedFile(path) {
  const text = readFileSync(path, 'utf8');
  if (path.endsWith('.map')) bad.push(`source map: ${path}`);
  if (/https?:\/\/(?!(?:chameleonjp\.codeberg\.page|chameleonjp-lab\.codeberg\.page)(?:[\/'"]|$)|chameleonjp\.supabase\.co(?:[\/'"]|$))/.test(text)) {
    bad.push(`external CDN/url: ${path}`);
  }
  if (/service_role/i.test(text)) bad.push(`service_role string: ${path}`);
  if (/ranking_scores/.test(text)) bad.push(`direct ranking_scores reference: ${path}`);
  if (/gl\s*=\s*cv\.getContext\(['"]webgl['"]/.test(text) && /ctx\s*=\s*cv\.getContext\(['"]2d['"]/.test(text)) {
    bad.push(`legacy shared-canvas renderer initialization: ${path}`);
  }
}

function checkForbiddenLocalPaths(path) {
  const text = readFileSync(path, 'utf8');
  const forbidden = ['/root/.nvm/', '/home/', 'C:\\', 'Users\\', 'lib/node_modules/typescript'];
  for (const needle of forbidden) {
    if (text.includes(needle)) bad.push(`forbidden local path ${needle}: ${path}`);
  }
}

if (!existsSync(sourceRoot)) bad.push('missing src directory');
if (!existsSync(assetsRoot)) bad.push('missing dist/assets directory');

for (const root of [sourceRoot, distRoot]) {
  if (!existsSync(root)) continue;
  walk(root, path => {
    if (/\.tsx?$/i.test(path)) bad.push(`TypeScript file remains: ${path}`);
    if (path.endsWith('.js')) checkJavaScript(path);
    if (root === distRoot) checkPublishedFile(path);
  });
}

const sourceFiles = filesUnder(sourceRoot);
const distFiles = filesUnder(assetsRoot);
const sourceSet = new Set(sourceFiles);
const distSet = new Set(distFiles);

for (const file of sourceFiles) {
  if (!distSet.has(file)) {
    bad.push(`dist file missing for source: ${file}`);
    continue;
  }
  const source = readFileSync(join(sourceRoot, file));
  const built = readFileSync(join(assetsRoot, file));
  if (!source.equals(built)) bad.push(`src/dist content mismatch: ${file}`);
}
for (const file of distFiles) {
  if (!sourceSet.has(file)) bad.push(`stale or extra dist asset: ${file}`);
}

const rootHtml = existsSync('index.html') ? readFileSync('index.html', 'utf8') : '';
const distHtml = existsSync(join(distRoot, 'index.html')) ? readFileSync(join(distRoot, 'index.html'), 'utf8') : '';

if (!rootHtml.includes('href="./src/ui/styles.css"')) bad.push('root index.html does not load ./src/ui/styles.css');
if (!rootHtml.includes('src="./src/main.js"')) bad.push('root index.html does not load ./src/main.js');
if (/\.tsx?\b|node_modules|https?:\/\//.test(rootHtml.replace('https://', ''))) {
  if (/\.tsx?\b|node_modules/.test(rootHtml)) bad.push('root index.html has a forbidden source reference');
}
if (!distHtml.includes('href="./assets/ui/styles.css"')) bad.push('dist/index.html does not load ./assets/ui/styles.css');
if (!distHtml.includes('src="./assets/main.js"')) bad.push('dist/index.html does not load ./assets/main.js');
if (/\.tsx?\b|node_modules|https?:\/\//.test(distHtml)) bad.push('dist/index.html has a forbidden reference');

const buildText = existsSync('scripts/build.mjs') ? readFileSync('scripts/build.mjs', 'utf8') : '';
for (const needle of ['transpileModule', 'vendor/typescript', 'previousDist']) {
  if (buildText.includes(needle)) bad.push(`pseudo transpilation remains in build: ${needle}`);
}

for (const root of ['scripts', 'vendor']) {
  if (existsSync(root)) walk(root, checkForbiddenLocalPaths);
}
for (const file of ['package.json', 'package-lock.json']) {
  if (existsSync(file)) checkForbiddenLocalPaths(file);
}

if (bad.length) {
  console.error(bad.join('\n'));
  process.exit(1);
}

console.log('verify ok: plain JavaScript sources, resolved imports, valid module syntax, matching src/dist assets, safe HTML references, and no forbidden published secrets or legacy artifacts');