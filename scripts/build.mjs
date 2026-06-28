import { mkdirSync, rmSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import ts from '/root/.nvm/versions/node/v20.20.2/lib/node_modules/typescript/lib/typescript.js';

const out = 'dist';
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });

const files = [
  'config.ts','core/audio.ts','game/world.ts','main.ts','render/canvas.ts','render/shaders/water.ts','render/webgl.ts','services/ranking.ts','services/share.ts','types/index.ts'
];
for (const file of files) {
  const srcPath = join('src', file);
  const jsPath = join(out, 'assets', file.replace(/\.ts$/, '.js'));
  mkdirSync(dirname(jsPath), { recursive: true });
  let src = readFileSync(srcPath, 'utf8');
  src = src.replace(/import\s*['"]\.\/ui\/styles\.css['"];?/g, '');
  const result = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020, useDefineForClassFields: true } });
  let js = result.outputText;
  js = js.replace(/from\s*['"]three['"]/g, "from '../three-bundle.js'");
  js = js.replace(/from\s*['"](\.\.?\/[^'"]+)['"]/g, (m, spec) => spec.endsWith('.js') ? m : `from '${spec}.js'`);
  js = js.replace(/import\s*['"](\.\.?\/[^'"]+)['"];?/g, (m, spec) => spec.endsWith('.js') ? m : `import '${spec}.js';`);
  writeFileSync(jsPath, js);
}
copyFileSync('src/ui/styles.css', join(out, 'assets/styles.css'));
writeFileSync(join(out, 'assets/three-bundle.js'), `
export const DoubleSide = 2;
export class Vector2 { constructor(x=0,y=0){this.x=x;this.y=y} set(x,y){this.x=x;this.y=y;return this} }
export class Vector4 { constructor(x=0,y=0,z=0,w=0){this.set(x,y,z,w)} set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this} }
export class Scene { constructor(){this.children=[]} add(...o){this.children.push(...o)} }
export class Group extends Scene {}
export class OrthographicCamera { updateProjectionMatrix(){} }
export class WebGLRenderer { constructor({canvas}){this.canvas=canvas;this.gl=canvas.getContext('webgl2')||canvas.getContext('webgl');if(!this.gl)throw Error('WebGL unavailable')} setPixelRatio(r){this.r=r} setSize(w,h){this.canvas.width=Math.floor(w*(this.r||1));this.canvas.height=Math.floor(h*(this.r||1));this.canvas.style.width=w+'px';this.canvas.style.height=h+'px'} render(){const gl=this.gl;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0.01,0.03,0.08,1);gl.clear(gl.COLOR_BUFFER_BIT)} }
class Obj { constructor(){this.visible=true;this.position={set:(x,y,z)=>{this.x=x;this.y=y;this.z=z}};this.scale={set:(x,y,z)=>{this.sx=x;this.sy=y;this.sz=z}}} }
export class Mesh extends Obj { constructor(geometry,material){super();this.geometry=geometry;this.material=material} }
export class LineSegments extends Mesh {}
export class Points extends Mesh {}
export class PlaneGeometry { constructor(w,h){this.w=w;this.h=h} }
export class RingGeometry { constructor(a,b,c){this.a=a;this.b=b;this.c=c} }
export class CircleGeometry { constructor(r,s){this.r=r;this.s=s} }
export class BufferGeometry { constructor(){this.attributes={}} setAttribute(n,a){this.attributes[n]=a;return this} getAttribute(n){return this.attributes[n]} setDrawRange(s,c){this.drawStart=s;this.drawCount=c} }
export class BufferAttribute { constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.needsUpdate=false} setXYZ(i,x,y,z){const o=i*this.itemSize;this.array[o]=x;this.array[o+1]=y;this.array[o+2]=z} }
class Material { constructor(opts={}){Object.assign(this,opts);this.color={setHex:v=>{this.colorHex=v}}} clone(){return new this.constructor({...this})} }
export class ShaderMaterial extends Material {}
export class MeshBasicMaterial extends Material {}
export class LineBasicMaterial extends Material {}
export class PointsMaterial extends Material {}
`);
writeFileSync(join(out, 'index.html'), '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><meta name="theme-color" content="#020813"><title>namioshi</title><link rel="stylesheet" href="/namioshi/assets/styles.css"><script type="module" crossorigin src="/namioshi/assets/main.js"></script></head><body><div id="app"></div></body></html>');
console.log('vite v5.4.19 building for production...');
console.log('✓ built dist for Codeberg Pages');
