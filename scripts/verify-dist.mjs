import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const bad = [];
const stale = [
  ['legacy app lookup', /const\s+app\s*=\s*document\.getElementById\(['"]app['"]\)/],
  ['legacy draw function', /function\s+draw\s*\(\s*t\s*\)/],
  ['legacy shared-canvas WebGL context', /gl\s*=\s*cv\.getContext\(['"]webgl['"]\)/],
  ['legacy shared-canvas 2D context', /ctx\s*=\s*cv\.getContext\(['"]2d['"]\)/],
  ['legacy hand-written build script reference', /scripts\/build\.mjs/],
  ['CSS direct import', /import\s*['"]\.\/ui\/styles\.css['"]/],
  ['three bare import single quote', /from\s*'three'/],
  ['three bare import double quote', /from\s*"three"/],
  ['three namespace bare import single quote', /import\s*\*\s*as\s*THREE\s*from\s*'three'/],
  ['three namespace bare import double quote', /import\s*\*\s*as\s*THREE\s*from\s*"three"/],
  ['fake Three renderer clear-only', /render\(\)\{const gl=this\.gl;gl\.viewport/],
  ['fake Three Scene', /export class Scene \{ constructor\(\)\{this\.children=\[\]\}/],
  ['fake Three RingGeometry', /export class RingGeometry \{ constructor\(a,b,c\)/],
  ['fake Three MeshBasicMaterial', /export class MeshBasicMaterial extends Material/]
];
const forbiddenVendorTypeScript = [
  ['npm', 'root', '-g'],
  ['global', 'Root'],
  ['execFileSync', "('npm"],
  ['child', '_process'],
  ['pathToFileURL'],
  ['createRequire'],
  ['node_', 'modules/typescript'],
  ['lib', '/typescript.js']
];
const forbiddenPaths = [
  ['/root/', '.nvm/'].join(''),
  ['/ho', 'me/'].join(''),
  ['C:', '\\'].join(''),
  ['Users', '\\'].join(''),
  ['lib/node_', 'modules/typescript'].join('')
];
const distRoots = ['dist'];
const pathScanRoots = ['dist', 'scripts', 'vendor'];
const pathScanFiles = ['package.json', 'package-lock.json'];

function scanDistFile(p) {
  if (p.endsWith('.map')) bad.push('source map: ' + p);
  const txt = readFileSync(p, 'utf8');
  if (/https?:\/\/(?!(?:chameleonjp\.codeberg\.page|chameleonjp-lab\.codeberg\.page)(?:[\/'"]|$)|chameleonjp\.supabase\.co(?:[\/'"]|$))/.test(txt)) bad.push('external CDN/url: ' + p);
  if (/service_role/i.test(txt)) bad.push('service_role string: ' + p);
  if (/ranking_scores/.test(txt)) bad.push('direct ranking_scores reference: ' + p);
  for (const [label, re] of stale) if (re.test(txt)) bad.push(label + ': ' + p);
}

function scanForbiddenPathFile(p) {
  const txt = readFileSync(p, 'utf8');
  for (const needle of forbiddenPaths) if (txt.includes(needle)) bad.push(`forbidden path ${needle}: ${p}`);
}

function scanVendorTypeScriptFile(p) {
  const txt = readFileSync(p, 'utf8');
  for (const parts of forbiddenVendorTypeScript) {
    const needle = parts.join('');
    if (txt.includes(needle)) bad.push(`forbidden vendored TypeScript lookup ${needle}: ${p}`);
  }
}

function walk(d, cb) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, cb);
    else cb(p);
  }
}

for (const root of distRoots) walk(root, scanDistFile);
for (const root of pathScanRoots) if (existsSync(root)) walk(root, scanForbiddenPathFile);
if (existsSync('vendor/typescript/lib/typescript.js')) scanVendorTypeScriptFile('vendor/typescript/lib/typescript.js');
for (const file of pathScanFiles) if (existsSync(file)) scanForbiddenPathFile(file);

if (bad.length) {
  console.error(bad.join('\n'));
  process.exit(1);
}
console.log('verify ok: no source maps, external CDN, service_role, direct ranking_scores POST, CSS direct import, three bare import, fake Three substitute, legacy hand-written dist markers, or forbidden absolute/local TypeScript paths or vendored TypeScript external lookups in dist/scripts/vendor/package metadata');
