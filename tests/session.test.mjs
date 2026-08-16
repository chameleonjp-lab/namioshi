import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  advancePlayFrame,
  createPlayDeadline,
  FixedStepRunner,
  remainingPlaySeconds,
  settlePlayDeadline,
  shouldFinishPlay,
  shouldFinishWhenIdle,
  TimedInputQueue
} from '../src/game/session.js';
import {MAX_TAPS,REFLECTED_WAVE_LIFETIME,WAVE_LIFETIME} from '../src/config.js';
import {World} from '../src/game/world.js';
import {GAME_MODE} from '../src/game/modes.js';

test('the thirty-second deadline helper still expires at zero',()=>{
  assert.equal(shouldFinishPlay(30),false);
  assert.equal(shouldFinishPlay(5.8),false);
  assert.equal(shouldFinishPlay(.001),false);
  assert.equal(shouldFinishPlay(0),true);
  assert.equal(shouldFinishPlay(-.001),true);
});

test('a full root-tap round ends when every wave and queued input are settled',()=>{
  assert.equal(shouldFinishWhenIdle(),false);
  assert.equal(shouldFinishWhenIdle({
    taps:MAX_TAPS,
    maximumTaps:MAX_TAPS,
    activeWaves:0,
    pendingInputs:0,
    tutorial:false
  }),true);
  assert.equal(shouldFinishWhenIdle({
    taps:MAX_TAPS,
    maximumTaps:MAX_TAPS,
    activeWaves:1,
    pendingInputs:0,
    tutorial:false
  }),false);
  assert.equal(shouldFinishWhenIdle({
    taps:MAX_TAPS,
    maximumTaps:MAX_TAPS,
    activeWaves:0,
    pendingInputs:1,
    tutorial:false
  }),false);
  assert.equal(shouldFinishWhenIdle({
    taps:MAX_TAPS,
    maximumTaps:MAX_TAPS,
    activeWaves:0,
    pendingInputs:0,
    tutorial:true
  }),false);
  const world=new World();
  world.reset({mode:GAME_MODE.OFFICIAL});
  for(let index=0;index<MAX_TAPS;index++){
    assert.equal(world.tap(24+index*30,120+index*35,{action:'root'}),true);
  }
  for(let frame=0;frame<Math.ceil((REFLECTED_WAVE_LIFETIME+1)*60);frame++)world.step(1/60,{countTime:false});
  assert.equal(world.taps,MAX_TAPS);
  assert.equal(world.waves.length,0);
  assert.equal(shouldFinishWhenIdle({
    taps:world.taps,
    maximumTaps:MAX_TAPS,
    activeWaves:world.waves.length,
    pendingInputs:0,
    tutorial:false
  }),true);
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(main,/const playFrame=rememberPlayFrame\(advanceSimulation\(now\)\)[\s\S]*?if\(playFrame\.shouldFinish\|\|shouldFinishIdlePlay\(\)\)finish\(\)/);
  assert.match(main,/function finish\(\){\s*if\(state!=='PLAYING'\)return/);
  assert.match(main,/function finish\(\)[\s\S]*?timedInputs\.drainThrough\(playDeadline,applyTimedInput\)[\s\S]*?world\.finalizePendingHits\(\)[\s\S]*?timedInputs\.clear\(\)/);
  assert.match(main,/timedInputs\.reset\(start\)/);
  assert.match(main,/function shouldFinishIdlePlay\(\)\{[\s\S]*?shouldFinishWhenIdle\(/);
  assert.match(main,/if\(playFrame\.shouldFinish\|\|shouldFinishIdlePlay\(\)\)finish\(\)/);
});


test('reflected waves remain available for up to ten seconds',()=>{
  const world=new World();
  world.reset({mode:GAME_MODE.OFFICIAL});
  assert.equal(world.tap(10,320,{action:'root'}),true);
  for(let frame=0;frame<60;frame++)world.step(1/60,{countTime:false});
  const reflected=world.waves.find(wave=>wave.reflectionDepth>0);
  assert.ok(reflected,'a near-wall root tap should create a reflected wave');
  assert.equal(reflected.lifetime,REFLECTED_WAVE_LIFETIME);
  assert.equal(world.waves.some(wave=>wave.reflectionDepth===0&&wave.lifetime===WAVE_LIFETIME),false);
});

test('an empty play still finalizes after a long deadline frame',()=>{
  const runner=new FixedStepRunner();
  runner.reset(0);
  const queue=new TimedInputQueue();
  queue.reset(0);
  let steps=0;
  const first=advancePlayFrame({
    timestamp:30050,
    deadline:30000,
    runner,
    inputQueue:queue,
    update:()=>{steps++}
  });
  assert.equal(first.steps,3);
  assert.equal(first.shouldFinish,false);
  let frame=first;
  let settlementFrames=1;
  while(!frame.shouldFinish&&settlementFrames<1000){
    frame=advancePlayFrame({
      timestamp:30000,
      deadline:30000,
      runner,
      inputQueue:queue,
      update:()=>{steps++}
    });
    settlementFrames++;
  }
  assert.equal(frame.shouldFinish,true);
  assert.equal(runner.stepCount,1800);
  assert.equal(queue.length,0);
  assert.equal(steps,1800);
});

test('deadline backlog drains in bounded chunks without waiting for more render frames',()=>{
  const events=[
    [90,140,137],
    [180,340,1073],
    [270,490,2249],
    [90,140,3377],
    [180,340,4193],
    [270,490,5281]
  ];
  const world=new World();
  world.reset({mode:GAME_MODE.OFFICIAL});
  const queue=new TimedInputQueue();
  queue.reset(0);
  for(const [x,y,timestamp] of events)assert.equal(queue.enqueue({x,y,timestamp}),true);
  const runner=new FixedStepRunner();
  runner.reset(0);
  const update=(step,{boundaryTimestamp})=>{
    world.step(step,{countTime:false});
    queue.drainThrough(boundaryTimestamp,input=>world.tap(input.x,input.y));
  };

  let frame=null;
  for(let second=1;second<=30;second++){
    frame=advancePlayFrame({
      timestamp:second*1000,
      deadline:30000,
      runner,
      inputQueue:queue,
      update
    });
  }
  assert.equal(frame.shouldFinish,false);
  assert.equal(runner.stepCount,90);

  let chunks=0;
  while(!frame.shouldFinish&&chunks<20){
    frame=settlePlayDeadline({
      deadline:30000,
      runner,
      inputQueue:queue,
      update,
      maxFrames:60
    });
    assert.ok(frame.settlementFrames<=60);
    chunks++;
  }

  assert.equal(frame.shouldFinish,true);
  assert.ok(chunks<=10);
  assert.equal(runner.stepCount,1800);
  assert.equal(queue.length,0);
  world.finalizePendingHits();
  assert.equal(world.score,1566);
  assert.deepEqual(world.getScoreBreakdown(),{direct:48,wall:221,glass:581,double:716});
  assert.equal(world.getDiscoveredRouteCount(),9);
});

test('deadline settlement validates its chunk boundary',()=>{
  const runner=new FixedStepRunner();
  runner.reset(0);
  const queue=new TimedInputQueue();
  queue.reset(0);
  const update=()=>{};
  assert.throws(()=>settlePlayDeadline({deadline:Number.NaN,runner,inputQueue:queue,update}),/finite deadline/);
  assert.throws(()=>settlePlayDeadline({deadline:30000,runner,inputQueue:queue,update,maxFrames:0}),/positive frame limit/);
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

test('the exact play deadline accepts 29,999ms and reserves ten equal-time inputs',()=>{
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
  assert.deepEqual(delivered,[0,1,2,3,4,5,6,7,8,9]);
});

test('reflection actions remain queued without consuming a pending root-tap slot',()=>{
  const queue=new TimedInputQueue();
  queue.reset(0);
  for(let index=0;index<MAX_TAPS;index++){
    assert.equal(queue.enqueue({x:index,y:index,timestamp:index,action:'root'}),true);
  }
  assert.equal(queue.enqueue({x:100,y:100,timestamp:20,action:'reflection'}),true);
  assert.equal(queue.enqueueWithinLimit({x:200,y:200,timestamp:21,action:'root'},{
    accepted:0,
    maximum:MAX_TAPS,
    pendingCount:entry=>entry.action!=='reflection'
  }),false);
  const actions=[];
  queue.drainThrough(20,input=>actions.push(input.action));
  assert.equal(actions.at(-1),'reflection');
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

test('visibility suspension preserves visible backlog and excludes hidden elapsed time',()=>{
  const runner=new FixedStepRunner();
  runner.reset(0);
  const queue=new TimedInputQueue();
  queue.reset(0);
  assert.equal(queue.enqueue({x:1,y:1,timestamp:1000}),true);
  let steps=0;
  let deliveredAt=null;
  const update=(step,{boundaryTimestamp})=>{
    steps++;
    queue.drainThrough(boundaryTimestamp,()=>{deliveredAt=boundaryTimestamp});
  };
  advancePlayFrame({timestamp:1000,deadline:30000,runner,inputQueue:queue,update});
  const pendingBefore=runner.accumulator;
  assert.ok(pendingBefore>.9);
  runner.suspend(1000);
  const hiddenDuration=runner.resume(11000);
  assert.equal(hiddenDuration,10000);
  assert.equal(runner.accumulator,pendingBefore);
  assert.equal(queue.shiftPendingTimestamps(hiddenDuration,{before:30000}),0);
  while(runner.hasPendingSteps())runner.advance(11000,update);
  assert.equal(steps,60);
  assert.ok(Math.abs(deliveredAt-11000)<1e-6);
  assert.equal(queue.length,0);
  assert.equal(runner.processedBoundaryTimestamp,11000);

  assert.equal(queue.enqueue({x:2,y:2,timestamp:29999}),true);
  assert.equal(queue.shiftPendingTimestamps(2,{before:30000}),1);
  assert.equal(queue.length,0);
  queue.reset(32000);
  assert.equal(queue.length,0);
  assert.equal(queue.isClosed,false);
});

test('deadline settlement survives a visibility interruption between render frames',()=>{
  const runner=new FixedStepRunner();
  runner.reset(29900);
  const queue=new TimedInputQueue();
  queue.reset(29900);
  assert.equal(queue.enqueue({x:1,y:1,timestamp:29999}),true);
  let steps=0;
  let delivered=0;
  const update=(step,{boundaryTimestamp})=>{
    steps++;
    queue.drainThrough(boundaryTimestamp,()=>{delivered++});
  };
  const first=advancePlayFrame({timestamp:30050,deadline:30000,runner,inputQueue:queue,update});
  assert.equal(first.steps,3);
  assert.equal(first.shouldFinish,false);
  const pending=runner.accumulator;
  runner.suspend(30050);
  runner.resume(30000,{shiftTimeline:false});
  assert.equal(runner.accumulator,pending);
  const second=advancePlayFrame({timestamp:31000,deadline:30000,runner,inputQueue:queue,update});
  assert.equal(second.steps,3);
  assert.equal(second.shouldFinish,true);
  assert.equal(steps,6);
  assert.equal(delivered,1);
  assert.equal(queue.length,0);
  assert.ok(Math.abs(runner.processedBoundaryTimestamp-30000)<1e-6);
});

test('visible backlog is settled when a hidden page resumes after the deadline',()=>{
  const run=(refreshRate,{settleBacklog=true}={})=>{
    const world=new World();
    world.reset({mode:GAME_MODE.OFFICIAL});
    const queue=new TimedInputQueue();
    queue.reset(0);
    assert.equal(queue.enqueue({x:0,y:110,timestamp:27025}),true);
    const runner=new FixedStepRunner();
    runner.reset(0);
    const update=(step,{boundaryTimestamp})=>{
      world.step(step,{countTime:false});
      queue.drainThrough(boundaryTimestamp,input=>world.tap(input.x,input.y));
    };

    for(let frame=1;frame<=Math.round(refreshRate*29.8);frame++){
      advancePlayFrame({
        timestamp:frame*1000/refreshRate,
        deadline:30000,
        runner,
        inputQueue:queue,
        update
      });
    }
    const hiddenFrame=advancePlayFrame({
      timestamp:29900,
      deadline:30000,
      runner,
      inputQueue:queue,
      update
    });
    assert.equal(hiddenFrame.steps,3);
    assert.equal(runner.stepCount,1791);
    assert.equal(runner.hasPendingSteps(),true);
    runner.suspend(29900);

    if(settleBacklog){
      // The page returns at 31s. Only the hidden interval up to the 30s
      // deadline shifts the paused timeline; the three visible steps already
      // accumulated before suspension are then drained at that deadline.
      const hiddenUntilDeadline=runner.resume(30000);
      assert.equal(hiddenUntilDeadline,100);
      queue.shiftPendingTimestamps(hiddenUntilDeadline,{before:30000});
      const settled=advancePlayFrame({
        timestamp:30000,
        deadline:30000,
        runner,
        inputQueue:queue,
        update
      });
      assert.equal(settled.steps,3);
      assert.equal(settled.shouldFinish,true);
      assert.equal(runner.stepCount,1794);
      assert.equal(runner.hasPendingSteps(),false);
    }

    world.finalizePendingHits();
    return{
      score:world.score,
      breakdown:world.getScoreBreakdown(),
      stepCount:runner.stepCount,
      queueLength:queue.length
    };
  };

  assert.equal(run(60,{settleBacklog:false}).score,24);
  const results=[20,30,60,120].map(refreshRate=>run(refreshRate));
  for(const result of results.slice(1))assert.deepEqual(result,results[0]);
  assert.deepEqual(results[0],{
    score:41,
    breakdown:{direct:41,wall:0,glass:0,double:0},
    stepCount:1794,
    queueLength:0
  });
});

test('a pre-deadline input is applied at the terminal boundary after a visibility shift',()=>{
  const world=new World();
  world.reset({mode:GAME_MODE.OFFICIAL});
  const queue=new TimedInputQueue();
  queue.reset(0);
  const runner=new FixedStepRunner();
  runner.reset(0);
  const update=(step,{boundaryTimestamp})=>{
    world.step(step,{countTime:false});
    queue.drainThrough(boundaryTimestamp,input=>world.tap(input.x,input.y));
  };

  for(let stepIndex=1;stepIndex<=1799;stepIndex++){
    runner.advance(stepIndex*1000/60,update);
  }
  assert.equal(runner.stepCount,1799);
  assert.equal(queue.enqueue({x:0,y:110,timestamp:29990}),true);
  runner.suspend(29990);
  const hiddenDuration=runner.resume(29995);
  assert.equal(hiddenDuration,5);
  assert.equal(queue.shiftPendingTimestamps(hiddenDuration,{before:30000}),0);

  const deadlineFrame=advancePlayFrame({
    timestamp:30000,
    deadline:30000,
    runner,
    inputQueue:queue,
    update
  });
  assert.equal(deadlineFrame.steps,0);
  assert.equal(deadlineFrame.shouldFinish,true);
  assert.equal(queue.length,1);
  assert.equal(world.taps,0);

  queue.closeBefore(30000);
  assert.equal(queue.drainThrough(30000,input=>world.tap(input.x,input.y)),1);
  world.finalizePendingHits();
  assert.equal(queue.length,0);
  assert.equal(world.taps,1);
  assert.equal(world.waves.length,1);
  assert.equal(world.waves[0].age,0);
  assert.equal(world.waves[0].radius,1);
  assert.equal(world.score,0);
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
    ledgerSum:[...world.routeBestHits.values()].reduce((sum,hit)=>sum+hit.score,0),
    routeCount:world.routeBestHits.size,
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

  assert.equal(regular[60].score,1566);
  assert.deepEqual(regular[60].breakdown,{direct:48,wall:221,glass:581,double:716});
  assert.equal(regular[60].taps,6);
  assert.equal(regular[60].stepCount,1800);
  assert.equal(regular[60].queueLength,0);
  assert.equal(regular[60].bestHits.length,16);
  assert.equal(regular[60].routeCount,9);
  assert.equal(regular[60].ledgerSum,1566);

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

test('deadline finalization keeps late official hits deterministic across render rates',()=>{
  const run=refreshRate=>{
    const world=new World();
    world.reset({mode:GAME_MODE.OFFICIAL});
    const queue=new TimedInputQueue();
    queue.reset(0);
    assert.equal(queue.enqueue({x:0,y:110,timestamp:27025}),true);
    const runner=new FixedStepRunner();
    runner.reset(0);
    let hitCount=0;
    world.onHit=()=>{hitCount++};
    let scoreBeforeFinalization=null;
    let finished=false;
    const update=(step,{boundaryTimestamp})=>{
      world.step(step,{countTime:false});
      queue.drainThrough(boundaryTimestamp,input=>world.tap(input.x,input.y));
    };
    for(let frame=1;frame<=refreshRate*32&&!finished;frame++){
      const playFrame=advancePlayFrame({
        timestamp:frame*1000/refreshRate,
        deadline:30000,
        runner,
        inputQueue:queue,
        update
      });
      if(playFrame.shouldFinish){
        scoreBeforeFinalization=world.score;
        world.finalizePendingHits();
        finished=true;
      }
    }
    assert.equal(finished,true);
    const physicalState=world.waves.map(wave=>[wave.waveId,wave.age,wave.radius,wave.previousRadius]);
    const finalizedHitCount=hitCount;
    world.finalizePendingHits();
    assert.equal(hitCount,finalizedHitCount);
    assert.deepEqual(world.waves.map(wave=>[wave.waveId,wave.age,wave.radius,wave.previousRadius]),physicalState);
    return{
      scoreBeforeFinalization,
      score:world.score,
      breakdown:world.getScoreBreakdown(),
      ledger:[...world.bestHits].sort(([left],[right])=>left.localeCompare(right)).map(([key,hit])=>[key,hit.category,hit.score,hit.waveId]),
      stepCount:runner.stepCount,
      queueLength:queue.length,
      hitCount
    };
  };
  const results=[20,30,60,120].map(run);
  for(const result of results.slice(1))assert.deepEqual(result,results[0]);
  assert.equal(results[0].scoreBeforeFinalization,0);
  assert.equal(results[0].score,47);
  assert.equal(results[0].stepCount,1800);
  assert.equal(results[0].queueLength,0);
  assert.deepEqual(results[0].breakdown,{direct:47,wall:0,glass:0,double:0});
  assert.equal(Object.values(results[0].breakdown).reduce((sum,value)=>sum+value,0),47);
});

test('suspending and resuming a fixed-step runner does not fast-forward the world',()=>{
  const runner=new FixedStepRunner();
  runner.reset(0);
  let steps=0;

  assert.equal(runner.advance(1000/60,()=>{steps++}),1);
  runner.suspend(1000/60);
  assert.ok(Math.abs(runner.resume(10000)-(10000-1000/60))<1e-6);
  assert.equal(runner.advance(10000+1000/60,()=>{steps++}),1);
  assert.equal(steps,2);
  assert.ok(Math.abs(runner.processedBoundaryTimestamp-(10000+1000/60))<1e-6);
});

test('duplicate visibility restoration does not resume or advance twice',()=>{
  const runner=new FixedStepRunner();
  runner.reset(0);
  let steps=0;
  runner.advance(1000,()=>{steps++});
  assert.equal(steps,3);
  assert.equal(runner.hasPendingSteps(),true);
  runner.suspend(1000);
  assert.equal(runner.resume(11000),10000);
  const resumedState={
    lastTimestamp:runner.lastTimestamp,
    boundaryOriginTimestamp:runner.boundaryOriginTimestamp,
    processedBoundaryTimestamp:runner.processedBoundaryTimestamp,
    accumulator:runner.accumulator,
    steps
  };
  assert.equal(runner.resume(11001),0);
  assert.deepEqual({
    lastTimestamp:runner.lastTimestamp,
    boundaryOriginTimestamp:runner.boundaryOriginTimestamp,
    processedBoundaryTimestamp:runner.processedBoundaryTimestamp,
    accumulator:runner.accumulator,
    steps
  },resumedState);
  assert.equal(runner.advance(11000,()=>{steps++}),3);
  assert.equal(steps,6);
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
  assert.match(main,/fixedSteps\.resume\(resumeAt\)/);
  assert.match(main,/timedInputs\.shiftPendingTimestamps\(hiddenDuration/);
  assert.match(main,/fixedSteps\.resume\(playDeadline,\{shiftTimeline:false\}\)/);
  assert.match(main,/const resumeAt=state==='PLAYING'&&!tutorialMode&&now>=playDeadline/);
  const visibilityHandler=main.slice(
    main.indexOf('function syncAudioVisibility()'),
    main.indexOf('world.onReflect=')
  );
  assert.doesNotMatch(visibilityHandler,/advanceSimulation\(/);
});
