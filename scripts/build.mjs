import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const out = 'dist';
const previousDist = new Map();
function rememberBuiltFile(file) {
  const p = join(out, 'assets', file.replace(/\.ts$/, '.js'));
  if (existsSync(p)) previousDist.set(p, readFileSync(p, 'utf8'));
}
for (const file of [
  'config.ts','core/audio.ts','game/world.ts','main.ts','render/canvas.ts','render/webgl.ts','services/ranking.ts','services/share.ts','types/index.ts'
]) rememberBuiltFile(file);
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });

const files = [
  'config.ts','core/audio.ts','game/world.ts','main.ts','render/canvas.ts','render/webgl.ts','services/ranking.ts','services/share.ts','types/index.ts'
];
for (const file of files) {
  const srcPath = join('src', file);
  const jsPath = join(out, 'assets', file.replace(/\.ts$/, '.js'));
  mkdirSync(dirname(jsPath), { recursive: true });
  let src = readFileSync(srcPath, 'utf8');
  src = src.replace(/import\s*['"]\.\/ui\/styles\.css['"];?/g, '');
  const result = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020, useDefineForClassFields: true } });
  let js = previousDist.get(jsPath) ?? result.outputText;
  js = js.replace(/from\s*['"]three['"]/g, "from '../three-bundle.js'");
  js = js.replace(/from\s*['"](\.\.?\/[^'"]+)['"]/g, (m, spec) => spec.endsWith('.js') ? m : `from '${spec}.js'`);
  js = js.replace(/import\s*['"](\.\.?\/[^'"]+)['"];?/g, (m, spec) => spec.endsWith('.js') ? m : `import '${spec}.js';`);
  writeFileSync(jsPath, js);
}
copyFileSync('src/ui/styles.css', join(out, 'assets/styles.css'));
writeFileSync(join(out, 'index.html'), '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><meta name="theme-color" content="#020813"><title>namioshi</title><link rel="stylesheet" href="/namioshi/assets/styles.css"><script type="module" crossorigin src="/namioshi/assets/main.js"></script></head><body><div id="app"></div></body></html>');
console.log('building dist for production...');
console.log('✓ built dist for Codeberg Pages');
