import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  BEACON_SHAKE_MAX_OFFSET,
  BEACON_SHAKE_MAX_SPEED,
  MAX_TAPS,
  MAX_WAVES,
  QUALITY,
  REFLECTIVE_SURFACE_COUNT,
  SCORE_HARD_CEILING
} from '../src/config.js';
import {createReflectionPath} from '../src/game/reflection-path.js';
import {World} from '../src/game/world.js';

test('the known finite-glass ghost route cannot score beacon b',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  const hits=[];
  let step=0;
  world.onHit=value=>hits.push({...value,step});
  assert.equal(world.tap(0,150),true);

  for(step=1;step<=60;step++)world.step(1/60);

  assert.equal(
    hits.some(hit=>hit.beaconId==='beacon-b'&&hit.category==='glass'),
    false
  );
  assert.equal(world.bestHits.get('tap-1:beacon-b')?.category==='glass',false);
});

test('every accepted reflected score records one in-range crossing per reflection',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  assert.equal(world.tap(0,150),true);
  for(let step=0;step<180;step++)world.step(1/60);

  for(const hit of world.bestHits.values()){
    assert.equal(hit.pathIntersections.length,hit.reflectionDepth);
    for(const crossing of hit.pathIntersections){
      assert.ok(crossing.segmentT>=0&&crossing.segmentT<=1);
      assert.ok(crossing.pathT>=0&&crossing.pathT<=1);
    }
  }
});

test('a reflected wave without its complete finite path cannot score',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.w=1000;
  world.h=1000;
  world.beacons=[{
    id:'target',
    x:100,
    y:100,
    baseX:100,
    baseY:100,
    vx:0,
    vy:0,
    radius:0,
    flash:0
  }];
  world.glass=[];
  world.waves=[];
  world.addWave(0,100,2,'glass',{
    rootTapId:'missing-path',
    radius:100,
    speed:0,
    width:1
  });

  world.step(1/60);

  assert.equal(world.score,0);
  assert.equal(world.bestHits.size,0);
});

test('a wall endpoint creates a finite reflected route',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.w=100;
  world.h=100;
  world.beacons=[];
  world.glass=[];
  world.waves=[];
  const root=world.addWave(-20,-20,0,'direct',{rootTapId:'wall-endpoint'});
  const endpointDistance=Math.hypot(120,20);
  root.radius=endpointDistance;

  world.reflect(root,endpointDistance-1);

  const reflected=world.waves.find(wave=>wave.reflectedBy==='wall:r');
  assert.ok(reflected);
  const trace=world.traceWavePath(reflected,-20,20);
  assert.equal(trace.valid,true);
  assert.equal(trace.intersections.length,1);
  assert.equal(trace.intersections[0].surfaceKey,'wall:r');
  assert.equal(trace.intersections[0].segmentT,0);
});

test('two finite reflections inside one fixed step are both generated',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.beacons=[{
    id:'same-step-target',
    x:90.6666666667,
    y:198.6666666667,
    baseX:90.6666666667,
    baseY:198.6666666667,
    vx:0,
    vy:0,
    radius:16,
    flash:0
  }];
  world.glass=[];
  world.waves=[];
  assert.equal(world.tap(6,7),true);
  world.waves[0].speed=165;

  for(let step=0;step<3;step++)world.step(1/60);

  const double=world.waves.find(wave=>
    wave.reflectionDepth===2&&
    wave.reflectionPath?.surfaceKey==='wall:l'&&
    wave.reflectionPath?.previous?.surfaceKey==='wall:t'
  );
  assert.ok(double);
  const trace=world.traceWavePath(double,90.6666666667,198.6666666667);
  assert.equal(trace.valid,true);
  assert.deepEqual(
    trace.intersections.map(intersection=>intersection.surfaceKey),
    ['wall:l','wall:t']
  );
  for(let step=3;step<180;step++)world.step(1/60);
  assert.equal(world.bestHits.get('tap-1:same-step-target')?.category,'double');
});

test('an early virtual contact keeps a later valid two-surface route without false feedback',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  const events=[];
  const effects=[];
  const addEffect=world.addReflectionEffect.bind(world);
  world.addReflectionEffect=(...args)=>{
    effects.push(args);
    return addEffect(...args);
  };
  let laterChild=null;
  world.onReflect=event=>{
    const parent=world.waves.find(wave=>wave.id===event.parentWaveId);
    events.push({surfaceKey:event.surfaceKey,parentReflectedBy:parent?.reflectedBy});
  };
  assert.equal(world.tap(0,80),true);
  for(let step=0;step<180;step++){
    world.step(1/60);
    laterChild=world.waves.find(wave=>
      wave.reflectedBy==='wall:l'&&
      wave.reflectionPath?.previous?.surfaceKey==='glass:glass-c1'
    )||laterChild;
  }

  assert.ok(laterChild);
  const laterTrace=world.traceWavePath(laterChild,0,275.2);
  assert.equal(laterTrace.valid,true);
  assert.deepEqual(
    laterTrace.intersections.map(intersection=>intersection.surfaceKey),
    ['wall:l','glass:glass-c1']
  );
  assert.equal(events.some(event=>(
    event.parentReflectedBy==='glass:glass-c1'&&event.surfaceKey==='wall:l'
  )),false);
  assert.equal(effects.length,events.length);
});

test('a new child keeps valid routes whose virtual minimum is already behind it without false feedback',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.beacons=[];
  const events=[];
  const effects=[];
  const addEffect=world.addReflectionEffect.bind(world);
  world.addReflectionEffect=(...args)=>{
    effects.push(args);
    return addEffect(...args);
  };
  let laterChild=null;
  world.onReflect=event=>{
    const parent=world.waves.find(wave=>wave.id===event.parentWaveId);
    events.push({surfaceKey:event.surfaceKey,parentReflectedBy:parent?.reflectedBy});
  };
  assert.equal(world.tap(0,180),true);
  for(let step=0;step<180;step++){
    world.step(1/60);
    laterChild=world.waves.find(wave=>
      wave.reflectedBy==='wall:r'&&
      wave.reflectionPath?.previous?.surfaceKey==='glass:glass-c2'
    )||laterChild;
  }

  assert.ok(laterChild);
  const laterTrace=world.traceWavePath(laterChild,360,345.6);
  assert.ok(laterChild.previousRadius>0);
  assert.equal(laterTrace.valid,true);
  assert.deepEqual(
    laterTrace.intersections.map(intersection=>intersection.surfaceKey),
    ['wall:r','glass:glass-c2']
  );
  assert.equal(events.some(event=>(
    event.parentReflectedBy==='glass:glass-c2'&&event.surfaceKey==='wall:r'
  )),false);
  assert.equal(effects.length,events.length);
});

test('a valid finite-glass route still upgrades a direct score',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.w=1000;
  world.h=1000;
  world.beacons=[{
    id:'target',
    x:460,
    y:500,
    baseX:460,
    baseY:500,
    vx:0,
    vy:0,
    radius:10,
    flash:0
  }];
  world.glass=[{id:'gate',x1:500,y1:400,x2:500,y2:600,nx:-1,ny:0}];
  world.waves=[];
  assert.equal(world.tap(480,500),true);
  for(let step=0;step<40;step++)world.step(1/60);

  const best=world.bestHits.get('tap-1:target');
  assert.equal(best?.category,'glass');
  assert.equal(best?.pathIntersections.length,1);
  assert.equal(best?.pathIntersections[0].surfaceKey,'glass:gate');
  assert.equal(best?.pathIntersections[0].segmentT,.5);
});

test('a valid two-surface route keeps both finite crossings in reverse order',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.w=1000;
  world.h=1000;
  world.beacons=[{
    id:'target',
    x:520,
    y:500,
    baseX:520,
    baseY:500,
    vx:0,
    vy:0,
    radius:1,
    flash:0
  }];
  world.glass=[
    {id:'first',x1:500,y1:400,x2:500,y2:600,nx:-1,ny:0},
    {id:'second',x1:460,y1:400,x2:460,y2:600,nx:-1,ny:0}
  ];
  world.waves=[];
  const root=world.addWave(480,500,0,'direct',{rootTapId:'double-route',width:1});
  root.hit.add('target');
  for(let step=0;step<80;step++)world.step(1/60);

  const best=world.bestHits.get('double-route:target');
  assert.equal(best?.category,'double');
  assert.deepEqual(
    best?.pathIntersections.map(value=>value.surfaceKey),
    ['glass:second','glass:first']
  );
  assert.deepEqual(
    best?.pathIntersections.map(value=>value.segmentT),
    [.5,.5]
  );
});

test('the structural wave bound keeps all ten root taps available',()=>{
  assert.equal(
    MAX_WAVES,
    MAX_TAPS*(1+REFLECTIVE_SURFACE_COUNT+REFLECTIVE_SURFACE_COUNT*(REFLECTIVE_SURFACE_COUNT-1))
  );
  const world=new World({random:()=>.5});
  world.reset();
  const accepted=[];
  for(let second=0;second<MAX_TAPS;second++){
    if(second>0){
      for(let frame=0;frame<60;frame++)world.step(1/60);
    }
    accepted.push(world.tap(0,190,{action:'root'}));
  }

  assert.deepEqual(accepted,Array.from({length:MAX_TAPS},()=>true));
  assert.equal(world.tap(0,190,{action:'root'}),false);
  assert.equal(world.taps,MAX_TAPS);
  assert.ok(world.waves.length<=MAX_WAVES);
});

test('quality limits background waves and particles without hiding scoring waves',()=>{
  assert.deepEqual(
    Object.fromEntries(Object.entries(QUALITY).map(([name,settings])=>[name,[settings.waves,settings.particles]])),
    {HIGH:[12,90],MID:[8,60],LOW:[5,30]}
  );
  const webgl=readFileSync(new URL('../src/render/webgl.js',import.meta.url),'utf8');
  const canvas=readFileSync(new URL('../src/render/canvas.js',import.meta.url),'utf8');
  assert.match(webgl,/for\(const wave of world\.waves\)\{/);
  assert.doesNotMatch(webgl,/world\.waves\.slice\(0,QUALITY\[quality\]\.waves\)/);
  assert.match(webgl,/const visibleCount=Math\.min\(MAX_BACKGROUND_WAVES,QUALITY\[quality\]\.waves,waves\.length\)/);
  assert.match(webgl,/const particleCount=Math\.min\(MAX_PARTICLES,QUALITY\[quality\]\.particles,world\.particles\.length\)/);
  assert.match(canvas,/for\(const wave of world\.waves\)\{/);
  assert.match(canvas,/const particleCount=Math\.min\(QUALITY\[quality\]\?\.particles\?/);
});

test('a wave cannot move or score beyond its three-second lifetime',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.w=1000;
  world.h=1000;
  world.beacons=[{
    id:'late-target',
    x:100,
    y:100,
    baseX:100,
    baseY:100,
    vx:50,
    vy:0,
    radius:0,
    flash:0
  }];
  world.glass=[];
  world.waves=[];
  world.addWave(0,100,0,'direct',{
    radius:100,
    previousRadius:100,
    width:.01,
    speed:100,
    age:2.995,
    lifetime:3
  });

  world.step(.01);

  assert.equal(world.score,0);
  assert.equal(world.waves.length,0);
  assert.ok(world.waveFades.length>0);
  world.step(.2);
  assert.equal(world.waveFades.length,0);

  const exactBoundary=new World({random:()=>.5});
  exactBoundary.reset();
  exactBoundary.w=1000;
  exactBoundary.h=1000;
  exactBoundary.beacons=[];
  exactBoundary.glass=[];
  exactBoundary.waves=[];
  exactBoundary.addWave(500,500,0,'direct',{speed:0});
  for(let frame=0;frame<180;frame++)exactBoundary.step(1/60);
  assert.equal(exactBoundary.waves.length,0);

  const expiringReflections=new World({random:()=>.5});
  expiringReflections.reset();
  assert.equal(expiringReflections.tap(0,80),true);
  expiringReflections.waves[0].speed=165;
  for(let frame=0;frame<179;frame++)expiringReflections.step(1/60);
  const finalFrameReflections=[];
  expiringReflections.onReflect=event=>finalFrameReflections.push(event);
  expiringReflections.step(1/60);
  assert.equal(
    finalFrameReflections.some(event=>event.surfaceKey==='glass:glass-c4'&&event.contactAge<3),
    true
  );
  assert.equal(expiringReflections.waves.length,0);

  const finalSlice=new World({random:()=>.5});
  finalSlice.reset();
  finalSlice.w=1000;
  finalSlice.h=1000;
  finalSlice.beacons=[{
    id:'final-slice-target',
    x:494,
    y:100,
    baseX:494,
    baseY:100,
    vx:0,
    vy:0,
    radius:0,
    flash:0
  }];
  finalSlice.glass=[{id:'final-gate',x1:495,y1:0,x2:495,y2:200,nx:-1,ny:0}];
  finalSlice.waves=[];
  const finalEvents=[];
  finalSlice.onReflect=event=>finalEvents.push(event);
  finalSlice.addWave(0,100,0,'direct',{
    rootTapId:'final-slice',
    age:179/60,
    radius:493.25,
    speed:165,
    width:.01,
    lifetime:3
  });

  finalSlice.step(1/60);

  assert.equal(finalEvents.some(event=>event.surfaceKey==='glass:final-gate'&&event.contactAge<3),true);
  assert.equal(finalSlice.bestHits.get('final-slice:final-slice-target')?.category,'glass');
  assert.equal(finalSlice.score,216);
  assert.equal(finalSlice.waves.length,0);
});

test('hit shake is bounded and returns to the unchanged base trajectory',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.w=1000;
  world.h=1000;
  const beacon={
    id:'stable',
    x:500,
    y:500,
    baseX:500,
    baseY:500,
    vx:5,
    vy:0,
    radius:10,
    flash:0
  };
  world.beacons=[beacon];
  world.glass=[];
  world.waves=[];

  for(let hit=0;hit<20;hit++){
    world.addWave(beacon.x-100,beacon.y,0,'direct',{
      rootTapId:`shake-${hit}`,
      radius:100,
      speed:0,
      width:9,
      lifetime:10
    });
    world.step(1/60);
  }

  assert.equal(beacon.vx,5);
  assert.equal(beacon.vy,0);
  assert.ok(Math.hypot(beacon.shakeVx,beacon.shakeVy)<=BEACON_SHAKE_MAX_SPEED+1e-9);
  assert.ok(Math.hypot(beacon.shakeX,beacon.shakeY)<=BEACON_SHAKE_MAX_OFFSET+1e-9);

  world.waves=[];
  for(let frame=0;frame<360;frame++)world.step(1/60);
  assert.ok(Math.hypot(beacon.shakeX,beacon.shakeY)<.01);
  assert.ok(Math.hypot(beacon.shakeVx,beacon.shakeVy)<.01);
  assert.ok(Math.abs(beacon.x-beacon.baseX)<.01);
  assert.ok(Math.hypot(beacon.vx,beacon.vy)<165);
});

test('the ten-root three-beacon route ledger remains capped at 10800 before reflection bonuses',()=>{
  assert.equal(SCORE_HARD_CEILING,11200);
  const world=new World({random:()=>.5});
  world.reset();
  world.w=1000;
  world.h=1000;
  world.beacons=[100,200,300].map((x,index)=>({
    id:`limit-${index+1}`,
    x,
    y:100,
    baseX:x,
    baseY:100,
    vx:0,
    vy:0,
    radius:0,
    flash:0
  }));
  world.glass=[];
  world.waves=[];

  for(let root=1;root<=MAX_TAPS;root++){
    for(const x of [100,200,300]){
      const firstSurfaceX=x*5/6;
      const first=createReflectionPath({
        surfaceKey:`ledger:${root}:${x}:first`,
        surfaceKind:'glass',
        x1:firstSurfaceX,
        y1:0,
        x2:firstSurfaceX,
        y2:200,
        parentOriginX:x*2/3,
        parentOriginY:100,
        childOriginX:x,
        childOriginY:100
      });
      const second=createReflectionPath({
        previous:first,
        surfaceKey:`ledger:${root}:${x}:second`,
        surfaceKind:'glass',
        x1:x/2,
        y1:0,
        x2:x/2,
        y2:200,
        parentOriginX:x,
        parentOriginY:100,
        childOriginX:0,
        childOriginY:100
      });
      world.addWave(0,100,2,'glass',{
        rootTapId:`tap-${root}`,
        radius:x,
        speed:0,
        width:1,
        reflectionPath:second
      });
    }
  }
  world.step(1/60);
  world.finalizePendingHits();

  assert.equal(world.bestHits.size,30);
  assert.equal(world.routeBestHits.size,30);
  assert.equal(world.score,10800);
  assert.equal(Object.values(world.getScoreBreakdown()).reduce((sum,value)=>sum+value,0),10800);
});
