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
  assert.match(webgl,/drawReflectionTapHint/);
  assert.match(webgl,/world\.isReflectionTapAvailable\(wave\)/);
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
  assert.match(canvas,/reflectionTapHint/);
  assert.match(canvas,/world\.isReflectionTapAvailable\(wave\)/);
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
  assert.match(main,/function formatRouteCategoryCounts\(counts\)/);
  assert.match(main,/summary\.awardedCategoryCounts/);
  assert.match(main,/summary\.candidateCategoryCounts/);
  assert.match(main,/｜経路 \$\{categoryCounts\}/);
  assert.match(main,/代表 \$\{detail\}/);
  assert.match(main,/命中確認：\$\{hit\.judgement/);
  assert.match(main,/得点確定：\+\$\{summary\.points\}/);
  assert.match(main,/発見済み（得点なし）/);
  assert.match(main,/別の経路を探そう/);
  assert.match(main,/duration:1400/);
  assert.match(main,/showHitFeedback\(hit\)/);
  assert.match(main,/world\.onRoute=summary=>\{[\s\S]*?showRouteFeedback\(summary\)/);
  assert.match(main,/namioshi\.guide\.completed\.\$\{OFFICIAL_RULE_VERSION\}/);
  assert.match(styles,/\.hitFeedback\{/);
  assert.match(styles,/\.hitFeedback\.show\{/);
  assert.match(styles,/\.hitFeedback\[data-route-status="impact"\]/);
  assert.match(styles,/\.hitFeedback\{[\s\S]*?overflow-wrap:anywhere/);
  assert.match(styles,/data-route-status="known"/);
  assert.match(styles,/z-index:5/);
});

test('result screen explains the best route and one next goal',()=>{
  const main=source('src/main.js');
  const styles=source('src/ui/styles.css');
  assert.match(main,/id="resultBestRoute"/);
  assert.match(main,/id="resultNextGoal"/);
  assert.match(main,/function formatRoutePath\(route\)/);
  assert.match(main,/function formatBestRoute\(route\)/);
  assert.match(main,/world\.getBestRoute\(\)/);
  assert.match(main,/最高経路：/);
  assert.match(main,/次の目標：/);
  assert.match(main,/judgementFromPrecision\(route\.precision\)/);
  assert.match(styles,/\.resultHighlight\{/);
  assert.match(styles,/\.resultGoal\{/);
});

test('play legend makes waves, reflection boards, and beacons distinct',()=>{
  const main=source('src/main.js');
  const styles=source('src/ui/styles.css');
  assert.match(main,/id="playLegend" class="playLegend" role="note"/);
  assert.match(main,/id="playStatus" class="playStatus" role="status"/);
  assert.match(main,/id="reflectionTapPrompt" class="reflectionTapPrompt" role="status"[^>]*hidden/);
  assert.match(main,/黄色い反射弧に重ねてタップ：技能ボーナス \+10〜40点/);
  assert.match(main,/目的：波をビーコンに重ねる/);
  assert.match(main,/反射板経由は高得点/);
  assert.match(main,/class="legendMark legendWave"/);
  assert.match(main,/class="legendMark legendBoard"/);
  assert.match(main,/class="legendMark legendBeacon"/);
  assert.match(main,/class="legendMark legendTap"/);
  assert.match(main,/<b>波<\/b>：/);
  assert.match(main,/<b>反射板<\/b>：光る線/);
  assert.match(main,/<b>ビーコン<\/b>：白く光る点。波が重なると命中し、精算時に得点が確定します/);
  assert.match(main,/<b>反射波タップ<\/b>：反射後の輪に重ねてタップすると、深度に応じて\+10〜40点/);
  assert.match(main,/<b>波の寿命<\/b>：波は約\$\{WAVE_LIFETIME\}秒で自然に消えます。タップしても、出ている波は消えません/);
  assert.doesNotMatch(main,/棒に波/);
  assert.match(styles,/\.legendLine\{/);
  assert.match(styles,/\.playStatus\{/);
  assert.match(styles,/\.reflectionTapPrompt\{/);
  assert.match(styles,/reflectionTapPromptPulse/);
  assert.match(styles,/\.legendWave\{/);
  assert.match(styles,/\.legendBoard\{/);
  assert.match(styles,/\.legendBeacon\{/);
  assert.match(styles,/\.legendTap\{/);
});

test('rules and practice entry explain scoring and the post-tap settlement',()=>{
  const main=source('src/main.js');
  assert.match(main,/ビーコンに波が重なると命中。反射板に当てるだけでは得点にならない/);
  assert.match(main,/基準点は直接20点、壁100点、反射板180点、2回反射300点/);
  assert.match(main,/命中確認は接触時、得点は波の精算時に「得点確定」として表示する/);
  assert.match(main,/\$\{MAX_TAPS\}回使い切った後は、入力と残っている波の精算を待ち、すべて終わると結果へ進む/);
  assert.match(main,/毎回変わる配置で反射経路を練習します/);
  assert.match(main,/ランキング外。練習結果は送信しません/);
  assert.match(main,/反射した波の輪をタイミングよくタップすると、深度1は10〜20点、深度2は20〜40点/);
  assert.match(main,/id="scoreReflectionTap"/);
  assert.match(main,/反射波タップ：\+\$\{tap\.points\}/);
});
