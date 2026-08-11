import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  createReflectionPath,
  reflectionPathReaches,
  traceReflectionPath
} from '../src/game/reflection-path.js';
import {
  fillReflectionArcPoints,
  isReflectionPointVisible,
  REFLECTION_ARC_SEGMENTS
} from '../src/render/reflection-arcs.js';

function reflectedWave(radius){
  return{
    originX:120,
    originY:100,
    radius,
    reflectionDepth:1,
    reflectionPath:createReflectionPath({
      surfaceKey:'glass:test',
      surfaceKind:'glass',
      x1:100,
      y1:0,
      x2:100,
      y2:200,
      parentOriginX:80,
      parentOriginY:100,
      childOriginX:120,
      childOriginY:100
    })
  };
}

test('reflected waves expose only sampled points that cross the finite surface',()=>{
  const wave=reflectedWave(80);
  const points=new Float32Array(REFLECTION_ARC_SEGMENTS*4);
  const pointCount=fillReflectionArcPoints(wave,points);

  assert.ok(pointCount>0);
  assert.ok(pointCount<REFLECTION_ARC_SEGMENTS*4);
  assert.equal(isReflectionPointVisible(wave,wave.originX+wave.radius,wave.originY),false);

  for(let index=0;index<pointCount;index+=4){
    const midpointX=(points[index]+points[index+2])*.5;
    const midpointY=(points[index+1]+points[index+3])*.5;
    assert.equal(isReflectionPointVisible(wave,midpointX,midpointY),true);
  }
});

test('a reflected wave before its first finite contact has no visible arc',()=>{
  const wave=reflectedWave(10);
  const points=new Float32Array(REFLECTION_ARC_SEGMENTS*4);

  assert.equal(fillReflectionArcPoints(wave,points),0);
  assert.equal(isReflectionPointVisible(wave,110,100),false);
});

test('the allocation-free reach check matches the finite-path trace',()=>{
  const wave=reflectedWave(80);
  const scratch={x:0,y:0};

  for(let index=0;index<REFLECTION_ARC_SEGMENTS;index++){
    const angle=(index+.5)/REFLECTION_ARC_SEGMENTS*Math.PI*2;
    const x=wave.originX+Math.cos(angle)*wave.radius;
    const y=wave.originY+Math.sin(angle)*wave.radius;
    const traced=traceReflectionPath(wave.originX,wave.originY,x,y,wave.reflectionPath);
    assert.equal(
      reflectionPathReaches(wave.originX,wave.originY,x,y,wave.reflectionPath,scratch),
      traced.valid
    );
  }
});

test('direct waves keep the full-circle rendering path outside the arc helper',()=>{
  const direct={originX:120,originY:100,radius:80,reflectionDepth:0};
  const points=new Float32Array(REFLECTION_ARC_SEGMENTS*4);

  assert.equal(fillReflectionArcPoints(direct,points),0);
  assert.equal(isReflectionPointVisible(direct,200,100),true);
});

test('WebGL loss recovery pauses safely and falls back through a replacement canvas',()=>{
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const webgl=readFileSync(new URL('../src/render/webgl.js',import.meta.url),'utf8');

  assert.match(main,/webglcontextlost/);
  assert.match(main,/event\.preventDefault\(\)/);
  assert.match(main,/suspendForRendererLoss\(monotonicNow\(\)\)/);
  assert.match(main,/webglcontextrestored/);
  assert.match(main,/view\.restore\(\)/);
  assert.match(main,/previous\.replaceWith\(next\)/);
  assert.match(main,/new CanvasView\(canvas\)/);
  assert.match(main,/if\(rendererSuspended\)\{/);
  assert.match(main,/rendererKind='webgl'/);

  assert.match(webgl,/initializeContext\(\)/);
  assert.match(webgl,/restore\(\)\{\s*this\.initializeContext\(\);\s*\}/);
  assert.match(webgl,/canvas\.getContext\('webgl'/);
  assert.doesNotMatch(webgl,/canvas\.getContext\('2d'/);
});

test('both renderers use finite reflection arcs instead of a reflected full circle',()=>{
  const webgl=readFileSync(new URL('../src/render/webgl.js',import.meta.url),'utf8');
  const canvas=readFileSync(new URL('../src/render/canvas.js',import.meta.url),'utf8');

  assert.match(webgl,/fillReflectionArcPoints\(wave,this\.arcPoints,REFLECTION_ARC_SEGMENTS\)/);
  assert.match(webgl,/gl\.LINES/);
  assert.match(canvas,/fillReflectionArcPoints\(wave,this\.arcPoints,REFLECTION_ARC_SEGMENTS\)/);
  assert.match(canvas,/context\.moveTo\(this\.arcPoints\[point\]/);
});
