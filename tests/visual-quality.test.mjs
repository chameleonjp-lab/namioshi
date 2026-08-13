import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function source(path){
  return readFileSync(new URL('../'+path,import.meta.url),'utf8');
}

test('WebGL renders wave thickness as reusable triangle bands',()=>{
  const webgl=source('src/render/webgl.js');
  const drawWave=webgl.slice(webgl.indexOf('  drawWave(wave,fade){'),webgl.indexOf('\n  render('));
  assert.match(webgl,/fillRingBandPoints/);
  assert.match(webgl,/fillArcBandPoints/);
  assert.match(webgl,/ringBand=new Float32Array/);
  assert.match(webgl,/arcBand=new Float32Array/);
  assert.match(drawWave,/TRIANGLE_STRIP/);
  assert.match(drawWave,/TRIANGLES/);
  assert.doesNotMatch(drawWave,/lineWidth/);
});

test('water and beacon rendering keep two-layer surface cues and hit expansion',()=>{
  const webgl=source('src/render/webgl.js');
  const canvas=source('src/render/canvas.js');
  assert.match(webgl,/rippleA/);
  assert.match(webgl,/rippleB/);
  assert.match(webgl,/centerLight/);
  assert.match(webgl,/smoothstep\(\.12,1\.22/);
  assert.match(webgl,/const pulse=\.5\+\.5\*Math\.sin/);
  assert.match(canvas,/createRadialGradient/);
  assert.match(canvas,/strokeWaveBand/);
  assert.match(canvas,/const pulse=\.5\+\.5\*Math\.sin/);
  assert.match(canvas,/fillReflectionArcPoints/);
});

test('hit feedback distinguishes new, improved, and known routes without sound',()=>{
  const main=source('src/main.js');
  const styles=source('src/ui/styles.css');
  assert.match(main,/id="hitFeedback"/);
  assert.match(main,/const HIT_FEEDBACK_LABELS=Object\.freeze/);
  assert.match(main,/function showRouteFeedback\(summary\)/);
  assert.match(main,/summary\.newRoutes/);
  assert.match(main,/summary\.improvedRoutes/);
  assert.match(main,/summary\.knownRoutes/);
  assert.match(main,/代表 \$\{detail\}/);
  assert.match(main,/別の経路を探そう/);
  assert.match(main,/duration:1400/);
  assert.match(main,/showHitFeedback\(hit\)/);
  assert.match(main,/world\.onRoute=showRouteFeedback/);
  assert.match(main,/namioshi\.guide\.completed\.\$\{OFFICIAL_RULE_VERSION\}/);
  assert.match(styles,/\.hitFeedback\{/);
  assert.match(styles,/\.hitFeedback\.show\{/);
  assert.match(styles,/data-route-status="known"/);
  assert.match(styles,/z-index:5/);
});
