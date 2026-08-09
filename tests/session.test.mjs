import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  advancePlayFrame,
  createPlayDeadline,
  FixedStepRunner,
  remainingPlaySeconds,
  shouldFinishPlay,
  TimedInputQueue
} from '../src/game/session.js';
import {MAX_TAPS} from '../src/config.js';
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
  assert.match(main,/const playFrame=advanceSimulation\(now\)[\s\S]*?if\(playFrame\.shouldFinish\)finish\(\)/);
  assert.match(main,/function finish\(\){\s*if\(state!=='PLAYING'\)return/);
  assert.match(main,/function finish\(\)[\s\S]*?timedInputs\.clear\(\)/);
  assert.match(main,/timedInputs\.reset\(start\)/);
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

test('fixed-step runner caps each render at three steps and preserves backlog',()=>{
  const runner=new FixedStepRunner();
  runner.reset(0);
  let steps=0;

  assert.equal(runner.advance(1000,()=>{steps++}),3);
  assert.equal(steps,3);
  assert.equal(runner.hasPendingSteps(),true);
  let renderFrames=1;
  while(runner.hasPendingSteps()){
    assert.equal(runner.advance(1000,()=>{steps++}),3);
    renderFrames++;
  }
  assert.equal(steps,60);
  assert.equal(renderFrames,20);
  assert.equal(runner.isCaughtUp(),true);
});

test('timed input queue orders equal timestamps and uses a half-open deadline',()=>{
  const queue=new TimedInputQueue();
  queue.reset(1000);
  assert.equal(queue.enqueue({x:1,y:1,timestamp:999}),false);
  assert.equal(queue.enqueue({x:2,y:2,timestamp:Number.NaN}),false);
  assert.equal(queue.enqueue({x:3,y:3,timestamp:1005}),true);
  assert.equal(queue.enqueue({x:4,y:4,timestamp:1005}),true);
  assert.equal(queue.enqueue({x:5,y:5,timestamp:1000}),true);
  queue.closeAt(1030);
  assert.equal(queue.enqueue({x:6,y:6,timestamp:1030}),false);
  assert.equal(queue.enqueue({x:7,y:7,timestamp:1020}),true);

  const first=[];
  assert.equal(queue.drainThrough(1005,input=>first.push(input.x)),3);
  assert.deepEqual(first,[5,3,4]);
  const second=[];
  assert.equal(queue.drainThrough(1030,input=>second.push(input.x)),1);
  assert.deepEqual(second,[7]);
});

test('the exact play deadline accepts 29,999ms and reserves only six equal-time inputs',()=>{
  const queue=new TimedInputQueue();
  queue.reset(0);
  queue.closeBefore(30000);
  for(let index=0;index<MAX_TAPS;index++){
    assert.equal(queue.enqueueWithinLimit({x:index,y:index,timestamp:29999},{
      accepted:0,
      maximum:MAX_TAPS
    }),true);
  }
  assert.equal(queue.enqueueWithinLimit({x:6,y:6,timestamp:29999},{accepted:0,maximum:MAX_TAPS}),false);
  assert.equal(queue.enqueue({x:7,y:7,timestamp:30000}),false);
  assert.equal(queue.enqueue({x:8,y:8,timestamp:30001}),false);
  const delivered=[];
  queue.drainThrough(30000,input=>delivered.push(input.x));
  assert.deepEqual(delivered,[0,1,2,3,4,5]);
});

test('an input exactly on a fixed boundary drains after that step',()=>{
  const queue=new TimedInputQueue();
  queue.reset(0);
  const boundary=1000/60;
  assert.equal(queue.enqueue({x:1,y:1,timestamp:boundary}),true);
  const runner=new FixedStepRunner();
  runner.reset(0);
  const order=[];
  runner.advance(boundary,(step,{boundaryTimestamp})=>{
    order.push('world-step');
    queue.drainThrough(boundaryTimestamp,()=>order.push('input'));
  });
  assert.deepEqual(order,['world-step','input']);
  assert.equal(queue.length,0);

  const longQueue=new TimedInputQueue();
  longQueue.reset(0);
  assert.equal(longQueue.enqueue({x:2,y:2,timestamp:1000}),true);
  const longRunner=new FixedStepRunner();
  longRunner.reset(0);
  let deliveredAt=null;
  const update=(step,{boundaryTimestamp})=>{
    longQueue.drainThrough(boundaryTimestamp,()=>{deliveredAt=boundaryTimestamp});
  };
  longRunner.advance(1000,update);
  while(longRunner.hasPendingSteps())longRunner.advance(1000,update);
  assert.ok(Math.abs(deliveredAt-1000)<1e-6);
  assert.equal(longQueue.length,0);
});

test('fixed-step runner never rewinds its wall-clock cursor',()=>{
  const runner=new FixedStepRunner();
  runner.reset(100);
  let steps=0;
  runner.advance(200,()=>{steps++});
  const cursor=runner.lastTimestamp;
  runner.advance(150,()=>{steps++});
  assert.equal(runner.lastTimestamp,cursor);
  runner.advance(200,()=>{steps++});
  assert.equal(runner.lastTimestamp,cursor);
  assert.ok(steps>0);
});

test('a 29.9 to 30.05 second crossing supplies all six deadline steps',()=>{
  const runner=new FixedStepRunner();
  runner.reset(29900);
  const queue=new TimedInputQueue();
  queue.reset(29900);
  assert.equal(queue.enqueue({x:1,y:1,timestamp:29999}),true);
  let steps=0;
  let deliveredAt=null;
  const update=(step,{boundaryTimestamp})=>{
    steps++;
    queue.drainThrough(boundaryTimestamp,()=>{deliveredAt=boundaryTimestamp});
  };
  const first=advancePlayFrame({timestamp:30050,deadline:30000,runner,inputQueue:queue,update});
  assert.equal(first.steps,3);
  assert.equal(first.shouldFinish,false);
  assert.equal(runner.hasPendingSteps(),true);
  const second=advancePlayFrame({timestamp:30066,deadline:30000,runner,inputQueue:queue,update});
  assert.equal(second.steps,3);
  assert.equal(second.shouldFinish,true);
  assert.equal(steps,6);
  assert.equal(runner.hasPendingSteps(),false);
  assert.ok(Math.abs(runner.processedBoundaryTimestamp-30000)<1e-6);
  assert.ok(Math.abs(deliveredAt-30000)<1e-6);
  assert.equal(queue.length,0);
});

test('visibility suspension discards backlog and excludes hidden elapsed time',()=>{
  const runner=new FixedStepRunner();
  runner.reset(0);
  const queue=new TimedInputQueue();
  queue.reset(0);
  assert.equal(queue.enqueue({x:1,y:1,timestamp:29999}),true);
  let steps=0;
  advancePlayFrame({timestamp:1000,deadline:30000,runner,inputQueue:queue,update:()=>{steps++}});
  const pendingBefore=runner.accumulator;
  assert.ok(pendingBefore>.9);
  runner.suspend();
  runner.resume(31000);
  assert.equal(runner.accumulator,0);
  assert.equal(runner.lastTimestamp,31000);
  assert.equal(runner.processedBoundaryTimestamp,31000);
  const resumed=advancePlayFrame({timestamp:31000,deadline:30000,runner,inputQueue:queue,update:()=>{steps++}});
  assert.equal(resumed.steps,0);
  assert.equal(resumed.shouldFinish,true);
  assert.equal(steps,3);
  assert.equal(runner.processedBoundaryTimestamp,31000);
  assert.equal(queue.isClosed,true);
  queue.clear();
  assert.equal(queue.length,0);
  queue.reset(32000);
  assert.equal(queue.length,0);
  assert.equal(queue.isClosed,false);
});

test('timestamped input results are identical across render rates and long frames',()=>{
  const events=[
    [90,140,137],
    [180,340,1073],
    [270,490,2249],
    [90,140,3377],
    [180,340,4193],
    [270,490,5281]
  ];
  const round=value=>Math.round(value*1e9)/1e9;
  const snapshot=(world,runner,queue,reflections)=>({
    score:world.score,
    breakdown:world.getScoreBreakdown(),
    taps:world.taps,
    stepCount:runner.stepCount,
    queueLength:queue.length,
    ledgerSum:[...world.bestHits.values()].reduce((sum,hit)=>sum+hit.score,0),
    bestHits:[...world.bestHits].sort(([left],[right])=>left.localeCompare(right)).map(([key,hit])=>[
      key,
      hit.category,
      hit.score,
      round(hit.error),
      hit.waveId,
      hit.pathIntersections.map(intersection=>intersection.surfaceKey)
    ]),
    waves:world.waves.map(wave=>[
      wave.waveId,
      wave.parentWaveId,
      wave.reflectionDepth,
      round(wave.radius)
    ]),
    beacons:world.beacons.map(beacon=>[
      beacon.id,
      round(beacon.x),
      round(beacon.y),
      round(beacon.vx),
      round(beacon.vy)
    ]),
    reflections
  });
  const run=frameTimes=>{
    const world=new World();
    world.reset({mode:GAME_MODE.OFFICIAL});
    const queue=new TimedInputQueue();
    queue.reset(0);
    for(const [x,y,timestamp] of events)assert.equal(queue.enqueue({x,y,timestamp}),true);
    const runner=new FixedStepRunner();
    runner.reset(0);
    const reflections=[];
    world.onReflect=event=>reflections.push([
      event.kind,
      event.reflections,
      event.waveId,
      event.parentWaveId,
      event.surfaceKey,
      round(event.contactAge),
      round(event.contactRadius)
    ]);
    const apply=(step,{boundaryTimestamp})=>{
      // Inputs at t=10ms are applied after the 16.667ms step, never inside it.
      world.step(step,{countTime:false});
      queue.drainThrough(boundaryTimestamp,input=>world.tap(input.x,input.y));
    };
    for(const wallTimestamp of frameTimes){
      if(wallTimestamp>=30000)queue.closeAt(30000);
      runner.advance(Math.min(wallTimestamp,30000),apply);
    }
    while(runner.hasPendingSteps())runner.advance(30000,apply);
    return snapshot(world,runner,queue,reflections);
  };
  const regular={};
  for(const refreshRate of [20,30,60,120]){
    regular[refreshRate]=run(Array.from({length:refreshRate*31},(_,index)=>(index+1)*1000/refreshRate));
  }
  assert.deepEqual(regular[20],regular[30]);
  assert.deepEqual(regular[20],regular[60]);
  assert.deepEqual(regular[20],regular[120]);

  assert.equal(regular[60].score,5481);
  assert.deepEqual(regular[60].breakdown,{direct:0,wall:239,glass:429,double:4813});
  assert.equal(regular[60].taps,6);
  assert.equal(regular[60].stepCount,1800);
  assert.equal(regular[60].queueLength,0);
  assert.equal(regular[60].bestHits.length,18);
  assert.equal(regular[60].ledgerSum,5481);

  for(const stopMilliseconds of [50,100,150,1000]){
    const frameTimes=[];
    let timestamp=1000/60;
    while(timestamp<10000){
      frameTimes.push(timestamp);
      timestamp+=1000/60;
    }
    timestamp+=stopMilliseconds;
    for(;timestamp<=31000;timestamp+=1000/60)frameTimes.push(timestamp);
    assert.deepEqual(run(frameTimes),regular[60]);
  }
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
  assert.match(main,/addEventListener\('pagehide',[\s\S]*?state==='COUNTDOWN'[\s\S]*?setState\('HOME'\)/);
  assert.match(main,/fixedSteps\.resume\(now\)/);
});
