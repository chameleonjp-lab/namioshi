import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

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
  assert.match(main,/const sequence=\[\['3',600\],\['2',600\],\['1',600\],\['START',400\]\]/);
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
  assert.match(main,/function settleSuspendedDeadline\(now\)\{[\s\S]*?advanceSimulation\(playDeadline\)[\s\S]*?if\(playFrame\.shouldFinish\)finish\(\)/);
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
