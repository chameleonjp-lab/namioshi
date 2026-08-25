import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const world=readFileSync(new URL('../src/game/world.js',import.meta.url),'utf8');

test('main exposes every required screen and updates visibility from one state value',()=>{
  for(const state of ['HOME','RULES','COUNTDOWN','RESULT','ERROR']){
    assert.match(main,new RegExp(`id="${state}"`));
  }
  assert.match(main,/let state='HOME'/);
  assert.match(main,/for\(const screen of \['HOME','RULES','COUNTDOWN','PLAYING','RESULT','ERROR'\]\)/);
  assert.match(main,/nextState==='PLAYING'/);
  assert.match(main,/id="hud"[^>]*aria-label="プレイ情報"/);
  assert.match(main,/setAttribute\?\.\('aria-hidden',String\(!visible\)\)/);
});

test('countdown and play entry points reject duplicate starts',()=>{
  assert.match(main,/function start\(mode\)\{[\s\S]*?if\(state==='COUNTDOWN'\|\|state==='PLAYING'\)return;/);
  assert.match(main,/function beginCountdown\(\)\{[\s\S]*?if\(state==='COUNTDOWN'\)return;/);
  assert.match(main,/countdownWaitingForTap=true/);
  assert.match(main,/function startCountdownSequence\(\)[\s\S]*?const sequence=\[\['3',600\],\['2',600\],\['1',600\],\['START',400\]\]/);
  assert.match(main,/document\.addEventListener\('pointerdown',[\s\S]*?startCountdownSequence\(\)/);
});

test('first guide can continue without a glass-reflection exception',()=>{
  assert.match(main,/id="guideStatus"[^>]*role="status"/);
  assert.match(main,/id="guideContinue" class="btn" type="button">案内を終えて本番へ/);
  assert.doesNotMatch(main,/guideReflectionConfirmed/);
  assert.doesNotMatch(main,/function resetGuideProgress\(\)/);
  assert.doesNotMatch(main,/function markGuideReflectionSuccess\(\)/);
  const leaveGuide=main.match(/function leaveGuide\(startGame\)\{[\s\S]*?\n\}/)?.[0]??'';
  assert.doesNotMatch(leaveGuide,/guideReflectionConfirmed/);
  assert.match(leaveGuide,/if\(startGame\)markGuideCompleted\(\)/);
  assert.doesNotMatch(main,/markGuideReflectionSuccess/);
});

test('result flow keeps share, replay, mode selection, and exit paths available',()=>{
  for(const id of ['share','again','changeMode','rankingDetails','endGame']){
    assert.match(main,new RegExp(`id="${id}"`));
  }
  assert.match(main,/\$\('share'\)\.onclick=\(\)=>doShare\(world\.score,'resultShareStatus','shareText'\)/);
  assert.match(main,/\$\('again'\)\.onclick=\(\)=>\{if\(state==='RESULT'\)beginCountdown\(\)\}/);
  assert.match(main,/\$\('changeMode'\)\.onclick=returnToModeSelection/);
  assert.match(main,/\$\('endGame'\)\.onclick=endGame/);
});


test('renderer suspension keeps an expired deadline settlement alive',()=>{
  assert.match(main,/function settleSuspendedDeadline\(now\)\{[\s\S]*?advanceSimulation\(playDeadline\)[\s\S]*?if\(playFrame\.shouldFinish\|\|shouldFinishIdlePlay\(\)\)finish\(\)/);
  assert.match(main,/if\(rendererSuspended\)\{[\s\S]*?settleSuspendedDeadline\(now\);[\s\S]*?requestAnimationFrame\(loop\)/);
  assert.match(main,/function scheduleDeadlineSettlement\(\)[\s\S]*?setTimeout\(runDeadlineSettlementChunk,0\)/);
  assert.match(main,/function runDeadlineSettlementChunk\(\)[\s\S]*?settlePlayDeadline\([\s\S]*?maxFrames:DEADLINE_SETTLEMENT_FRAMES_PER_CHUNK[\s\S]*?scheduleDeadlineSettlement\(\)/);
  assert.match(main,/else if\(playFrame\.deadlineExpired\)scheduleDeadlineSettlement\(\)/);
  assert.match(main,/addEventListener\('pagehide',[\s\S]*?cancelDeadlineSettlement\(\)/);
});

test('input and renderer fallback contracts remain connected to the UI flow',()=>{
  assert.match(main,/enqueueWithinLimit\([\s\S]*?maximum:MAX_TAPS/);
  assert.match(main,/function switchToCanvas\(\{resume=true\}=\{\}\)/);
  assert.match(main,/new CanvasView\(canvas\)/);
  assert.match(main,/function handleWebGLContextLost\(event\)/);
  assert.match(main,/function handleWebGLContextRestored\(\)/);
});

test('play status explains the objective and the ten-tap wait state',()=>{
  assert.match(main,/function playStatusText\(\)\{[\s\S]*?const pendingDisplayWaves=world\.waves\.length\+\(world\.waveFades\?\.length\?\?0\)[\s\S]*?world\.taps>=MAX_TAPS[\s\S]*?pendingDisplayWaves>0/);
  assert.match(main,/\$\{MAX_TAPS\}回使い切りました。入力と波の精算を待っています。通常の波は約\$\{WAVE_LIFETIME\}秒、反射した水面波は最大\$\{REFLECTED_WAVE_LIFETIME\}秒表示されます（加点と反射処理は約\$\{WAVE_LIFETIME\}秒以内）/);
  assert.match(main,/\$\{MAX_TAPS\}回使い切り、入力と波の精算が終わりました。結果を表示します/);
  assert.match(main,/function updatePlayStatus\(force=false\)/);
  assert.match(main,/updatePlayStatus\(\);/);
});

test('explanation stays visible during countdown and is optional during play',()=>{
  assert.match(main,/id="playLegendToggle"[^>]*aria-controls="playLegend"/);
  assert.match(main,/let playLegendOpen=false/);
  assert.match(main,/function updatePlayLegend\(\)[\s\S]*?countdownVisible=state==='COUNTDOWN'&&countdownExplanationVisible[\s\S]*?open=state==='PLAYING'&&!tutorialMode&&playLegendOpen/);
  assert.match(main,/playLegendToggle'\)\.onclick=\(\)=>\{[\s\S]*?playLegendOpen=!playLegendOpen/);
  assert.match(main,/if\(nextState!=='PLAYING'\)playLegendOpen=false/);
});

test('reflection tap timing prompt follows the shared availability predicate',()=>{
  assert.match(main,/id="reflectionTapPrompt" class="reflectionTapPrompt"/);
  assert.match(main,/function updateReflectionTapPrompt\(\)\{[\s\S]*?state==='PLAYING'&&!tutorialMode[\s\S]*?world\.hasAvailableWaterRipple\(\)/);
  assert.match(main,/prompt\.hidden=!available/);
  assert.match(main,/setState\(nextState\)[\s\S]*?updateReflectionTapPrompt\(\);/);
  assert.match(main,/updatePlayStatus\(force\);[\s\S]*?updateReflectionTapPrompt\(\);/);
});

test('water ripple taps carry a stable target and the reflection count into the HUD/result',()=>{
  assert.match(main,/world\.findWaterRippleTapTarget\(point\.x,point\.y\)/);
  assert.match(main,/rippleEffectId:reflectionTarget\.rippleEffect\?\.id/);
  assert.match(main,/id="rf"/);
  assert.match(main,/\$\('rf'\)\.textContent=String\(world\.getReflectionCount\(\)\)/);
  assert.match(main,/id="resultReflectionCount"/);
  assert.match(main,/world\.getReflectionCount\(\)/);
  assert.match(world,/source:'water-ripple'/);
  assert.doesNotMatch(world,/findReflectionTapTarget/);
  assert.doesNotMatch(world,/hasVisibleReflectionArc/);
});

test('play feedback labels contact confirmation separately from score settlement',()=>{
  assert.match(main,/function showHitFeedback\(hit\)[\s\S]*?命中確認：/);
  assert.match(main,/function showRouteFeedback\(summary\)[\s\S]*?得点確定：\+\$\{summary\.points\}/);
  assert.match(main,/発見済み（得点なし）/);
  assert.match(main,/命中確認は接触時、得点は波の精算時/);
});
