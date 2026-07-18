import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const bad = [];
const sourceRoot = 'src';
const distRoot = 'dist';
const assetsRoot = join(distRoot, 'assets');
const textFilePattern = /\.(?:css|html|js|json|md|mjs|svg|txt)$/i;

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
  if (path.endsWith('.map')) bad.push(`source map: ${path}`);
  if (!textFilePattern.test(path)) return;

  const text = readFileSync(path, 'utf8');
  if (/https?:\/\/(?!(?:chameleonjp\.codeberg\.page|chameleonjp-lab\.codeberg\.page)(?:[\/'"]|$)|chameleonjp\.supabase\.co(?:[\/'"]|$))/.test(text)) {
    bad.push(`external CDN/url: ${path}`);
  }
  if (/service_role/i.test(text)) bad.push(`service_role string: ${path}`);
  if (/(?:ranking_scores|game_scores)/.test(text)) bad.push(`direct score table reference: ${path}`);
  if (/gl\s*=\s*cv\.getContext\(['"]webgl['"]/.test(text) && /ctx\s*=\s*cv\.getContext\(['"]2d['"]/.test(text)) {
    bad.push(`legacy shared-canvas renderer initialization: ${path}`);
  }
}

function checkForbiddenLocalPaths(path) {
  if (!textFilePattern.test(path)) return;
  const text = readFileSync(path, 'utf8');
  const forbidden = ['/root/.nvm/', '/home/', 'C:\\', 'Users\\', 'lib/node_modules/typescript'];
  for (const needle of forbidden) {
    if (text.includes(needle)) bad.push(`forbidden local path ${needle}: ${path}`);
  }
}

function addReachableReference(queue, fromPath, specifier) {
  if (!specifier || /^(?:data:|https?:|#)/.test(specifier)) return;
  const clean = specifier.split('#')[0].split('?')[0];
  const target = resolve(dirname(fromPath), clean);
  const rel = toPosix(relative(distRoot, target));
  if (rel.startsWith('../') || rel === '..') {
    bad.push(`published reference escapes dist: ${specifier} from ${fromPath}`);
    return;
  }
  if (!existsSync(target)) {
    bad.push(`missing published reference ${specifier}: ${fromPath}`);
    return;
  }
  queue.push(target);
}

function checkReachableDistAssets() {
  const entry = join(distRoot, 'index.html');
  if (!existsSync(entry)) return;

  const queue = [resolve(entry)];
  const visited = new Set();

  while (queue.length) {
    const path = queue.shift();
    if (visited.has(path)) continue;
    visited.add(path);
    if (!textFilePattern.test(path)) continue;

    const text = readFileSync(path, 'utf8');
    if (path.endsWith('.html')) {
      const reference = /\b(?:href|src)\s*=\s*['"]([^'"]+)['"]/g;
      let match;
      while ((match = reference.exec(text))) addReachableReference(queue, path, match[1]);
    } else if (path.endsWith('.js')) {
      for (const specifier of importSpecifiers(text)) addReachableReference(queue, path, specifier);
    } else if (path.endsWith('.css')) {
      const reference = /url\(\s*['"]?([^'"\)]+)['"]?\s*\)/g;
      let match;
      while ((match = reference.exec(text))) addReachableReference(queue, path, match[1]);
    }
  }

  for (const file of filesUnder(assetsRoot)) {
    const absolute = resolve(assetsRoot, file);
    if (!visited.has(absolute)) bad.push(`unreferenced published asset: ${file}`);
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
if (/\.tsx?\b|node_modules/.test(rootHtml)) bad.push('root index.html has a forbidden source reference');
if (!distHtml.includes('href="./assets/ui/styles.css"')) bad.push('dist/index.html does not load ./assets/ui/styles.css');
if (!distHtml.includes('src="./assets/main.js"')) bad.push('dist/index.html does not load ./assets/main.js');
if (/\.tsx?\b|node_modules|https?:\/\//.test(distHtml)) bad.push('dist/index.html has a forbidden reference');

const buildText = existsSync('scripts/build.mjs') ? readFileSync('scripts/build.mjs', 'utf8') : '';
for (const needle of ['transpileModule', 'vendor/typescript', 'previousDist']) {
  if (buildText.includes(needle)) bad.push(`pseudo transpilation remains in build: ${needle}`);
}

const forbiddenLegacyPaths = ['vendor', 'vite.config.js', 'tsconfig.json', 'scripts/check-size.mjs'];
for (const path of forbiddenLegacyPaths) {
  if (existsSync(path)) bad.push(`obsolete build path remains: ${path}`);
}
if (existsSync('package-lock.json')) bad.push('obsolete dependency lock remains: package-lock.json');
if (!existsSync('scripts/report-size.mjs')) bad.push('missing informational size report: scripts/report-size.mjs');

if (existsSync('package.json')) {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      if (pkg[field] && Object.keys(pkg[field]).length) bad.push(`package.json still has ${field}`);
    }
    const expectedScripts = {
      build: 'node scripts/build.mjs',
      verify: 'node scripts/verify-dist.mjs',
      size: 'node scripts/report-size.mjs'
    };
    for (const [name, command] of Object.entries(expectedScripts)) {
      if (pkg.scripts?.[name] !== command) bad.push(`package script mismatch ${name}: expected ${command}`);
    }
  } catch (error) {
    bad.push(`invalid package.json: ${error.message}`);
  }
}

if (existsSync('scripts/report-size.mjs')) {
  const sizeText = readFileSync('scripts/report-size.mjs', 'utf8');
  if (sizeText.includes('2900000') || /\btotal\s*>\s*(?:limit|\d+)/.test(sizeText)) {
    bad.push('fixed size failure threshold remains in scripts/report-size.mjs');
  }
}

if (existsSync('.gitignore')) {
  const ignore = readFileSync('.gitignore', 'utf8');
  for (const required of ['node_modules/', '.env']) {
    if (!ignore.includes(required)) bad.push(`.gitignore missing ${required}`);
  }
} else {
  bad.push('missing .gitignore');
}

for (const root of ['scripts']) {
  if (existsSync(root)) walk(root, checkForbiddenLocalPaths);
}
for (const file of ['package.json', '.gitignore']) {
  if (existsSync(file)) checkForbiddenLocalPaths(file);
}

checkReachableDistAssets();

if (bad.length) {
  console.error(bad.join('\n'));
  process.exit(1);
}

console.log('verify ok: dependency-free JavaScript build, resolved imports, valid module syntax, matching src/dist assets, reachable public files, safe HTML references, and no fixed size threshold or forbidden published secrets');
