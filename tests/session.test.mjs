import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  createPlayDeadline,
  FixedStepRunner,
  remainingPlaySeconds,
  shouldFinishPlay
} from '../src/game/session.js';
import {World} from '../src/game/world.js';
import {GAME_MODE} from '../src/game/modes.js';

test('a play session ends only when its thirty-second timer expires',()=>{
  assert.equal(shouldFinishPlay(30),false);
  assert.equal(shouldFinishPlay(5.8),false);
  assert.equal(shouldFinishPlay(.001),false);
  assert.equal(shouldFinishPlay(0),true);
  assert.equal(shouldFinishPlay(-.001),true);
});

test('using all taps and clearing all waves cannot end play early',()=>{
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(main,/shouldFinishPlay\(world\.time\)\)finish\(\)/);
  assert.doesNotMatch(main,/world\.taps\s*>=|world\.waves\.length\s*===\s*0/);
});

test('fixed-step runner produces the same update count at 60Hz and 120Hz',()=>{
  const run=(refreshRate)=>{
    const runner=new FixedStepRunner();
    runner.reset(0);
    let steps=0;
    const frameCount=refreshRate*5;
    for(let frame=1;frame<=frameCount;frame++){
      runner.advance(frame*1000/refreshRate,()=>{steps++});
    }
    return steps;
  };

  assert.equal(run(60),300);
  assert.equal(run(120),300);
});

test('fixed-step runner produces the same official world result at 60Hz and 120Hz',()=>{
  const run=(refreshRate)=>{
    const world=new World();
    world.reset({mode:GAME_MODE.OFFICIAL});
    for(const [x,y] of [[90,140],[180,340],[270,490]])world.tap(x,y);
    const runner=new FixedStepRunner();
    runner.reset(0);
    for(let frame=1;frame<=refreshRate*5;frame++){
      runner.advance(frame*1000/refreshRate,step=>world.step(step,{countTime:false}));
    }
    return{
      score:world.score,
      breakdown:world.getScoreBreakdown(),
      waves:world.waves.map(wave=>[wave.waveId,wave.parentWaveId,wave.reflectionDepth,Math.round(wave.radius*1e9)/1e9]),
      beacons:world.beacons.map(beacon=>[beacon.id,Math.round(beacon.x*1e9)/1e9,Math.round(beacon.y*1e9)/1e9])
    };
  };

  assert.deepEqual(run(60),run(120));
});

test('fixed-step runner caps a long frame at three steps and discards extra time',()=>{
  const runner=new FixedStepRunner();
  runner.reset(0);
  let steps=0;

  assert.equal(runner.advance(1000,()=>{steps++}),3);
  assert.equal(steps,3);
  assert.equal(runner.advance(1000+1000/60,()=>{steps++}),1);
  assert.equal(steps,4);
});

test('suspending and resuming a fixed-step runner does not fast-forward the world',()=>{
  const runner=new FixedStepRunner();
  runner.reset(0);
  let steps=0;

  assert.equal(runner.advance(1000/60,()=>{steps++}),1);
  runner.suspend();
  runner.resume(10000);
  assert.equal(runner.advance(10000+1000/60,()=>{steps++}),1);
  assert.equal(steps,2);
});

test('play deadline uses monotonic timestamps and never becomes negative',()=>{
  const deadline=createPlayDeadline(1000,30);
  assert.equal(deadline,31000);
  assert.equal(remainingPlaySeconds(deadline,1000),30);
  assert.equal(remainingPlaySeconds(deadline,30500),.5);
  assert.equal(remainingPlaySeconds(deadline,31000),0);
  assert.equal(remainingPlaySeconds(deadline,32000),0);
});

test('main uses fixed updates, a monotonic deadline, and visibility suspension rules',()=>{
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(main,/new FixedStepRunner\(\)/);
  assert.match(main,/performance\.now\(\)/);
  assert.match(main,/world\.step\(step,\{countTime:false\}\)/);
  assert.match(main,/if\(document\.hidden\)/);
  assert.match(main,/state==='COUNTDOWN'[\s\S]*?setState\('HOME'\)/);
  assert.match(main,/fixedSteps\.resume\(now\)/);
});
