import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_WAVES} from '../src/config.js';
import {HIT_JUDGEMENT,judgementFromPrecision} from '../src/game/judgement.js';
import {createReflectionPath} from '../src/game/reflection-path.js';
import {scoreRouteKey} from '../src/game/scoring.js';
import {World} from '../src/game/world.js';

test('hit precision has four stable judgement levels',()=>{
  assert.equal(judgementFromPrecision(1),HIT_JUDGEMENT.PERFECT);
  assert.equal(judgementFromPrecision(.85),HIT_JUDGEMENT.PERFECT);
  assert.equal(judgementFromPrecision(.849),HIT_JUDGEMENT.GREAT);
  assert.equal(judgementFromPrecision(.6),HIT_JUDGEMENT.GREAT);
  assert.equal(judgementFromPrecision(.599),HIT_JUDGEMENT.GOOD);
  assert.equal(judgementFromPrecision(.3),HIT_JUDGEMENT.GOOD);
  assert.equal(judgementFromPrecision(.299),HIT_JUDGEMENT.HIT);
  assert.equal(judgementFromPrecision(Number.NaN),HIT_JUDGEMENT.HIT);
});

test('world reports judgement quality without changing hit scoring',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.beacons=[{id:'test-beacon',x:100,y:100,radius:10,flash:0,vx:0,vy:0}];
  world.glass=[];
  world.waves=[];
  const wave=world.addWave(0,100,0,'direct',{speed:0});
  wave.radius=100;
  let hit=null;
  let route=null;
  world.onHit=value=>{hit=value};
  world.onRoute=value=>{route=value};

  world.step(.01);
  world.finalizePendingHits();

  assert.equal(hit?.judgement,HIT_JUDGEMENT.PERFECT);
  assert.ok(Math.abs(hit.precision-1)<1e-9);
  assert.equal(hit.points,0);
  assert.equal(hit.candidateScore,24);
  assert.equal(hit.category,'direct');
  assert.equal(hit.kind,'direct');
  assert.equal(hit.reflections,0);
  assert.equal(hit.routeStatus,'impact');
  assert.equal(route.points,24);
  assert.equal(route.newRoutes,1);
  assert.equal(route.improvedRoutes,0);
  assert.equal(route.knownRoutes,0);
  assert.equal(route.discoveredRoutes,1);
  assert.equal(world.score,24);
  assert.deepEqual(world.getScoreBreakdown(),{direct:24,wall:0,glass:0,double:0});
});

test('a hit keeps the closest fixed-step approach instead of the first band entry',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.beacons=[{id:'closest-beacon',x:100,y:100,baseX:100,baseY:100,radius:10,flash:0,vx:0,vy:0,shakeX:0,shakeY:0,shakeVx:0,shakeVy:0}];
  world.glass=[];
  world.waves=[];
  const wave=world.addWave(0,100,0,'direct',{speed:0,width:10});
  const hits=[];
  world.onHit=value=>hits.push(value);
  wave.radius=91;
  world.scoreWave(wave,world.beacons);
  const first=wave.hitCandidates.get('closest-beacon');
  assert.equal(first?.score,19);
  assert.equal(first?.error,9);
  assert.equal(first?.pending,true);
  assert.equal(world.score,0);
  assert.equal(world.particles.length,0);
  assert.equal(hits.length,0);

  wave.radius=100.5;
  world.scoreWave(wave,world.beacons);
  const closest=wave.hitCandidates.get('closest-beacon');
  assert.equal(closest?.score,24);
  assert.ok(closest?.error<first.error);
  assert.equal(closest?.pending,true);
  assert.equal(world.score,0);
  assert.equal(world.particles.length,0);
  assert.equal(hits.length,0);

  wave.radius=115;
  world.scoreWave(wave,world.beacons);
  const committed=world.bestHits.get('manual-1:closest-beacon');
  assert.equal(committed?.score,24);
  assert.equal(committed?.pending,false);
  assert.equal(world.score,0);
  assert.equal(hits.length,1);
  assert.equal(world.particles.length,14);
  const committedShake=[world.beacons[0].shakeVx,world.beacons[0].shakeVy];
  world.settleRoots(['manual-1']);
  assert.equal(world.score,24);
  assert.equal(hits.length,1);
  world.flushWaveHits(wave);
  assert.equal(world.score,24);
  assert.equal(hits.length,1);
  assert.equal(world.particles.length,14);
  assert.deepEqual([world.beacons[0].shakeVx,world.beacons[0].shakeVy],committedShake);
  assert.deepEqual(world.getScoreBreakdown(),{direct:24,wall:0,glass:0,double:0});
});

test('the route ledger keeps one award for the same beacon and ordered path',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  const beacon={id:'route-beacon',x:100,y:100,baseX:100,baseY:100,radius:0,flash:0,vx:0,vy:0,shakeX:0,shakeY:0,shakeVx:0,shakeVy:0};
  world.beacons=[beacon];
  world.glass=[];
  world.waves=[];
  const routeEvents=[];
  world.onRoute=event=>routeEvents.push(event);

  const first=world.addWave(0,100,0,'direct',{rootTapId:'route-a'});
  first.hitCandidates.set(beacon.id,{category:'direct',score:24,error:0,precision:1,targetX:100,targetY:100,waveId:first.id,reflectionDepth:0,pathIntersections:[],pending:true});
  world.commitWaveHit(first,beacon);
  world.settleRoots(['route-a']);

  const second=world.addWave(0,100,0,'direct',{rootTapId:'route-b'});
  second.hitCandidates.set(beacon.id,{category:'direct',score:24,error:0,precision:1,targetX:100,targetY:100,waveId:second.id,reflectionDepth:0,pathIntersections:[],pending:true});
  world.commitWaveHit(second,beacon);
  world.settleRoots(['route-b']);

  assert.equal(world.bestHits.size,2);
  assert.equal(world.routeBestHits.size,1);
  assert.equal(world.getDiscoveredRouteCount(),1);
  assert.equal(world.score,24);
  assert.deepEqual(world.getScoreBreakdown(),{direct:24,wall:0,glass:0,double:0});
  assert.equal(routeEvents.length,2);
  assert.deepEqual(
    routeEvents.map(event=>[event.routeStatus,event.points,event.newRoutes,event.improvedRoutes,event.knownRoutes]),
    [['new',24,1,0,0],['known',0,0,0,1]]
  );
  assert.equal(scoreRouteKey('route-beacon',[]),'route-beacon|direct');
  assert.notEqual(
    scoreRouteKey('route-beacon',[{surfaceKey:'wall:l'},{surfaceKey:'glass:a'}]),
    scoreRouteKey('route-beacon',[{surfaceKey:'glass:a'},{surfaceKey:'wall:l'}])
  );
});

test('world exposes the highest finalized route for result guidance',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  const beacons=[
    {id:'best-direct',x:100,y:100,baseX:100,baseY:100,radius:0,flash:0,vx:0,vy:0,shakeX:0,shakeY:0,shakeVx:0,shakeVy:0},
    {id:'best-double',x:200,y:100,baseX:200,baseY:100,radius:0,flash:0,vx:0,vy:0,shakeX:0,shakeY:0,shakeVx:0,shakeVy:0}
  ];
  world.beacons=beacons;
  world.glass=[];
  world.waves=[];

  const direct=world.addWave(0,100,0,'direct',{rootTapId:'best-root'});
  direct.hitCandidates.set(beacons[0].id,{category:'direct',score:24,error:0,precision:1,targetX:100,targetY:100,waveId:direct.id,reflectionDepth:0,pathIntersections:[],pending:true});
  world.commitWaveHit(direct,beacons[0]);
  const double=world.addWave(0,100,2,'glass',{rootTapId:'best-root'});
  double.hitCandidates.set(beacons[1].id,{category:'double',score:360,error:1,precision:.9,targetX:200,targetY:100,waveId:double.id,reflectionDepth:2,pathIntersections:[{surfaceKey:'wall:l'},{surfaceKey:'glass:a'}],pending:true});
  world.commitWaveHit(double,beacons[1]);
  world.settleRoots(['best-root']);

  const best=world.getBestRoute();
  assert.equal(best?.score,360);
  assert.equal(best?.sourceHitKey,'best-root:best-double');
  assert.deepEqual(best?.pathIntersections,[{surfaceKey:'wall:l'},{surfaceKey:'glass:a'}]);
  assert.notStrictEqual(best?.pathIntersections,double.hitCandidates.get(beacons[1].id).pathIntersections);
  world.reset();
  assert.equal(world.getBestRoute(),null);
});

test('simultaneous roots produce one route summary with awarded and known totals',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  const beacons=[
    {id:'summary-a',x:100,y:100,baseX:100,baseY:100,radius:0,flash:0,vx:0,vy:0,shakeX:0,shakeY:0,shakeVx:0,shakeVy:0},
    {id:'summary-b',x:200,y:100,baseX:200,baseY:100,radius:0,flash:0,vx:0,vy:0,shakeX:0,shakeY:0,shakeVx:0,shakeVy:0}
  ];
  world.beacons=beacons;
  world.glass=[];
  world.waves=[];
  const routeEvents=[];
  world.onRoute=event=>routeEvents.push(event);

  for(const rootTapId of ['batch-a','batch-b']){
    for(const beacon of beacons){
      const wave=world.addWave(0,100,0,'direct',{rootTapId});
      wave.hitCandidates.set(beacon.id,{category:'direct',score:24,error:0,precision:1,targetX:beacon.x,targetY:beacon.y,waveId:wave.id,reflectionDepth:0,pathIntersections:[],pending:true});
      world.commitWaveHit(wave,beacon);
    }
  }
  world.settleRoots(['batch-a','batch-b']);

  assert.equal(routeEvents.length,1);
  assert.deepEqual({
    points:routeEvents[0].points,
    rootCount:routeEvents[0].rootCount,
    candidateCount:routeEvents[0].candidateCount,
    newRoutes:routeEvents[0].newRoutes,
    improvedRoutes:routeEvents[0].improvedRoutes,
    knownRoutes:routeEvents[0].knownRoutes,
    candidateCategoryCounts:routeEvents[0].candidateCategoryCounts,
    awardedCategoryCounts:routeEvents[0].awardedCategoryCounts
  },{
    points:48,
    rootCount:2,
    candidateCount:4,
    newRoutes:2,
    improvedRoutes:0,
    knownRoutes:2,
    candidateCategoryCounts:{direct:4,wall:0,glass:0,double:0},
    awardedCategoryCounts:{direct:2,wall:0,glass:0,double:0}
  });
  assert.equal(world.score,48);
  assert.equal(routeEvents[0].points,world.score);
});

test('route summary exposes every awarded reflection category',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  const beacons=[
    {id:'category-direct',x:100,y:100,baseX:100,baseY:100,radius:0,flash:0,vx:0,vy:0,shakeX:0,shakeY:0,shakeVx:0,shakeVy:0},
    {id:'category-wall',x:200,y:100,baseX:200,baseY:100,radius:0,flash:0,vx:0,vy:0,shakeX:0,shakeY:0,shakeVx:0,shakeVy:0}
  ];
  world.beacons=beacons;
  world.glass=[];
  world.waves=[];
  const routeEvents=[];
  world.onRoute=event=>routeEvents.push(event);

  const direct=world.addWave(0,100,0,'direct',{rootTapId:'category-root'});
  direct.hitCandidates.set(beacons[0].id,{category:'direct',score:24,error:0,precision:1,targetX:100,targetY:100,waveId:direct.id,reflectionDepth:0,pathIntersections:[],pending:true});
  world.commitWaveHit(direct,beacons[0]);
  const wall=world.addWave(0,100,1,'wall',{rootTapId:'category-root'});
  wall.hitCandidates.set(beacons[1].id,{category:'wall',score:100,error:0,precision:1,targetX:200,targetY:100,waveId:wall.id,reflectionDepth:1,pathIntersections:[{surfaceKey:'wall:l'}],pending:true});
  world.commitWaveHit(wall,beacons[1]);
  world.settleRoots(['category-root']);

  assert.equal(routeEvents.length,1);
  assert.deepEqual(routeEvents[0].candidateCategoryCounts,{direct:1,wall:1,glass:0,double:0});
  assert.deepEqual(routeEvents[0].awardedCategoryCounts,{direct:1,wall:1,glass:0,double:0});
  assert.equal(routeEvents[0].points,124);
});

test('a finalized root cannot mutate either score ledger',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  const beacon={id:'finalized-beacon',x:100,y:100,baseX:100,baseY:100,radius:0,flash:0,vx:0,vy:0,shakeX:0,shakeY:0,shakeVx:0,shakeVy:0};
  world.beacons=[beacon];
  world.glass=[];
  world.waves=[];
  const first=world.addWave(0,100,0,'direct',{rootTapId:'finalized-root'});
  first.hitCandidates.set(beacon.id,{category:'direct',score:20,error:2,precision:.5,targetX:100,targetY:100,waveId:first.id,reflectionDepth:0,pathIntersections:[],pending:true});
  world.commitWaveHit(first,beacon);
  world.settleRoots(['finalized-root']);
  const second=world.addWave(0,100,0,'direct',{rootTapId:'finalized-root'});
  second.hitCandidates.set(beacon.id,{category:'direct',score:24,error:0,precision:1,targetX:100,targetY:100,waveId:second.id,reflectionDepth:0,pathIntersections:[],pending:true});
  world.commitWaveHit(second,beacon);
  assert.equal(world.score,20);
  assert.equal(world.bestHits.get('finalized-root:finalized-beacon')?.score,20);
  assert.equal(world.routeBestHits.get('finalized-beacon|direct')?.score,20);
});

test('each root and beacon selects its highest candidate before route deduplication',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  const beacon={id:'precedence-beacon',x:100,y:100,baseX:100,baseY:100,radius:0,flash:0,vx:0,vy:0,shakeX:0,shakeY:0,shakeVx:0,shakeVy:0};
  world.beacons=[beacon];
  world.glass=[];
  world.waves=[];
  const strongest=world.addWave(0,100,2,'glass',{rootTapId:'precedence-root'});
  strongest.hitCandidates.set(beacon.id,{category:'double',score:360,error:0,precision:1,targetX:100,targetY:100,waveId:strongest.id,reflectionDepth:2,pathIntersections:[{surfaceKey:'wall:l'},{surfaceKey:'glass:a'}],pending:true});
  world.commitWaveHit(strongest,beacon);
  const lowerNewRoute=world.addWave(0,100,1,'glass',{rootTapId:'precedence-root'});
  lowerNewRoute.hitCandidates.set(beacon.id,{category:'glass',score:216,error:0,precision:1,targetX:100,targetY:100,waveId:lowerNewRoute.id,reflectionDepth:1,pathIntersections:[{surfaceKey:'glass:b'}],pending:true});
  world.commitWaveHit(lowerNewRoute,beacon);
  world.settleRoots(['precedence-root']);

  assert.equal(world.bestHits.size,1);
  assert.equal(world.routeBestHits.size,1);
  assert.equal(world.score,360);
  assert.equal(world.routeBestHits.has('precedence-beacon|glass:b'),false);
});

test('an exact candidate records immediately and awards once settled',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  const beacon={id:'exact-beacon',x:100,y:100,baseX:100,baseY:100,radius:0,flash:0,vx:0,vy:0,shakeX:0,shakeY:0,shakeVx:0,shakeVy:0};
  world.beacons=[beacon];
  world.glass=[];
  world.waves=[];
  const wave=world.addWave(0,100,0,'direct',{rootTapId:'exact-root',radius:100,speed:0,width:10});
  const hits=[];
  world.onHit=value=>hits.push(value);

  world.scoreWave(wave,world.beacons);
  assert.equal(world.bestHits.get('exact-root:exact-beacon')?.score,24);
  assert.equal(world.score,0);
  world.settleRoots(['exact-root']);
  assert.equal(world.score,24);
  assert.equal(hits.length,1);
  assert.equal(world.particles.length,14);

  world.scoreWave(wave,world.beacons);
  world.flushWaveHits(wave);
  assert.equal(world.score,24);
  assert.equal(hits.length,1);
  assert.equal(world.particles.length,14);
});

test('reset discards a pending closest-hit candidate without side effects',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.beacons=[{id:'reset-beacon',x:100,y:100,radius:0,flash:0,vx:0,vy:0}];
  world.glass=[];
  world.waves=[];
  const wave=world.addWave(0,100,0,'direct',{rootTapId:'reset-root',radius:91,speed:0,width:10});
  let hitCount=0;
  world.onHit=()=>{hitCount++};
  world.scoreWave(wave,world.beacons);
  assert.equal(wave.hitCandidates.get('reset-beacon')?.pending,true);

  world.reset();
  assert.equal(world.score,0);
  assert.equal(world.bestHits.size,0);
  assert.equal(world.waves.length,0);
  assert.equal(world.particles.length,0);
  assert.equal(hitCount,0);
});

test('a non-perfect candidate commits once in the lifetime-final slice',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.w=1000;
  world.h=1000;
  world.beacons=[{id:'final-beacon',x:100,y:100,radius:0,flash:0,vx:0,vy:0}];
  world.glass=[];
  world.waves=[];
  const wave=world.addWave(0,100,0,'direct',{
    rootTapId:'final-pending',
    radius:99,
    previousRadius:99,
    speed:0,
    width:10,
    lifetime:.01
  });
  const hits=[];
  world.onHit=value=>hits.push(value);
  world.step(.01);
  assert.equal(world.waves.length,0);
  assert.equal(world.bestHits.get('final-pending:final-beacon')?.pending,false);
  assert.equal(hits.length,1);
  assert.equal(world.score,23);
  world.flushWaveHits(wave);
  assert.equal(hits.length,1);
  assert.equal(world.score,23);
});

test('round finalization commits only observed candidates without advancing physics',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.w=1000;
  world.h=1000;
  const beacon={id:'deadline-beacon',x:100,y:100,baseX:100,baseY:100,radius:0,flash:0,vx:0,vy:0,shakeX:0,shakeY:0,shakeVx:0,shakeVy:0};
  world.beacons=[beacon];
  world.glass=[];
  world.waves=[];
  const pending=world.addWave(0,100,0,'direct',{
    rootTapId:'deadline-root',
    radius:99,
    previousRadius:99,
    speed:165,
    width:10,
    age:1
  });
  const untouched=world.addWave(0,100,0,'direct',{
    rootTapId:'untouched-root',
    radius:1,
    previousRadius:1,
    speed:165,
    width:10,
    age:0
  });
  const hits=[];
  world.onHit=value=>hits.push(value);
  world.scoreWave(pending,world.beacons);
  assert.equal(pending.hitCandidates.get(beacon.id)?.pending,true);
  assert.equal(untouched.hitCandidates.size,0);
  const physicalState=world.waves.map(wave=>[wave.waveId,wave.age,wave.radius,wave.previousRadius]);
  const reflections=world.reflectionEffects.map(effect=>({...effect}));

  world.finalizePendingHits();
  assert.equal(world.score,23);
  assert.equal(world.bestHits.get('deadline-root:deadline-beacon')?.pending,false);
  assert.equal(world.bestHits.has('untouched-root:deadline-beacon'),false);
  assert.equal(hits.length,1);
  assert.equal(world.particles.length,14);
  assert.deepEqual(world.waves.map(wave=>[wave.waveId,wave.age,wave.radius,wave.previousRadius]),physicalState);
  assert.deepEqual(world.reflectionEffects,reflections);

  world.finalizePendingHits();
  assert.equal(world.score,23);
  assert.equal(hits.length,1);
  assert.equal(world.particles.length,14);
  assert.deepEqual(world.waves.map(wave=>[wave.waveId,wave.age,wave.radius,wave.previousRadius]),physicalState);
});

test('equal-score representatives use depth, error, then wave id without side effects',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  const beacon={id:'tie-beacon',x:100,y:100,radius:0,flash:0,vx:0,vy:0};
  world.beacons=[beacon];
  world.glass=[];
  world.waves=[];
  let hitCount=0;
  world.onHit=()=>{hitCount++};
  const first=world.addWave(0,100,0,'direct',{rootTapId:'tie-root'});
  first.hitCandidates.set(beacon.id,{category:'direct',score:100,error:3,precision:.5,targetX:100,targetY:100,waveId:first.id,reflectionDepth:0,pathIntersections:[],pending:true});
  world.commitWaveHit(first,beacon);
  const second=world.addWave(0,100,1,'wall',{rootTapId:'tie-root'});
  second.hitCandidates.set(beacon.id,{category:'wall',score:100,error:3,precision:.5,targetX:100,targetY:100,waveId:second.id,reflectionDepth:1,pathIntersections:[],pending:true});
  world.commitWaveHit(second,beacon);
  assert.equal(world.bestHits.get('tie-root:tie-beacon')?.waveId,second.id);
  assert.equal(world.score,0);
  assert.deepEqual(world.getScoreBreakdown(),{direct:0,wall:0,glass:0,double:0});
  assert.equal(hitCount,1);
  const third=world.addWave(0,100,1,'wall',{rootTapId:'tie-root'});
  third.hitCandidates.set(beacon.id,{category:'wall',score:100,error:3,precision:.5,targetX:100,targetY:100,waveId:third.id,reflectionDepth:1,pathIntersections:[],pending:true});
  world.commitWaveHit(third,beacon);
  assert.equal(world.bestHits.get('tie-root:tie-beacon')?.waveId,second.id);
  assert.equal(world.score,0);
  assert.equal(hitCount,1);

  const closer=world.addWave(0,100,1,'wall',{rootTapId:'tie-root'});
  closer.hitCandidates.set(beacon.id,{category:'wall',score:100,error:2,precision:.5,targetX:100,targetY:100,waveId:closer.id,reflectionDepth:1,pathIntersections:[],pending:true});
  world.commitWaveHit(closer,beacon);
  assert.equal(world.bestHits.get('tie-root:tie-beacon')?.waveId,closer.id);
  assert.equal(world.score,0);
  assert.equal(hitCount,1);

  const higherScore=world.addWave(0,100,0,'direct',{rootTapId:'tie-root'});
  higherScore.hitCandidates.set(beacon.id,{category:'direct',score:101,error:99,precision:.5,targetX:100,targetY:100,waveId:higherScore.id,reflectionDepth:0,pathIntersections:[],pending:true});
  world.commitWaveHit(higherScore,beacon);
  assert.equal(world.bestHits.get('tie-root:tie-beacon')?.waveId,higherScore.id);
  world.settleRoots(['tie-root']);
  assert.equal(world.score,101);
  assert.deepEqual(world.getScoreBreakdown(),{direct:101,wall:0,glass:0,double:0});
  assert.equal(hitCount,2);

  const ledgerTotal=[...world.routeBestHits.values()].reduce((sum,hit)=>sum+hit.score,0);
  const breakdownTotal=Object.values(world.getScoreBreakdown()).reduce((sum,score)=>sum+score,0);
  assert.equal(world.score,ledgerTotal);
  assert.equal(world.score,breakdownTotal);

  const waveIdWorld=new World({random:()=>.5});
  waveIdWorld.reset();
  const waveIdBeacon={id:'wave-id-beacon',x:100,y:100,baseX:100,baseY:100,radius:0,flash:0,vx:0,vy:0,shakeX:0,shakeY:0,shakeVx:0,shakeVy:0};
  waveIdWorld.beacons=[waveIdBeacon];
  waveIdWorld.glass=[];
  waveIdWorld.waves=[];
  let waveIdHits=0;
  waveIdWorld.onHit=()=>{waveIdHits++};
  const smallerId=waveIdWorld.addWave(0,100,1,'wall',{rootTapId:'wave-id-root'});
  const largerId=waveIdWorld.addWave(0,100,1,'wall',{rootTapId:'wave-id-root'});
  for(const wave of [largerId,smallerId]){
    wave.hitCandidates.set(waveIdBeacon.id,{category:'wall',score:100,error:2,precision:.5,targetX:100,targetY:100,waveId:wave.id,reflectionDepth:1,pathIntersections:[],pending:true});
    waveIdWorld.commitWaveHit(wave,waveIdBeacon);
  }
  assert.equal(waveIdWorld.bestHits.get('wave-id-root:wave-id-beacon')?.waveId,smallerId.id);
  waveIdWorld.settleRoots(['wave-id-root']);
  assert.equal(waveIdWorld.score,100);
  assert.equal(waveIdHits,1);
});

test('world reports wall reflections for their own sound cue',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.beacons=[];
  world.glass=[];
  world.waves=[];
  const wave=world.addWave(10,200,0,'direct');
  wave.radius=11;
  const reflections=[];
  world.onReflect=value=>reflections.push(value);

  world.reflect(wave);

  assert.deepEqual(reflections.map(({kind,reflections})=>({kind,reflections})),[{kind:'wall',reflections:1}]);
});

test('a reflected wave does not report its source wall twice',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.beacons=[];
  world.glass=[];
  world.waves=[];
  const root=world.addWave(10,200,0,'direct');
  root.radius=11;
  const reflections=[];
  world.onReflect=value=>reflections.push(value);

  world.reflect(root);
  const reflected=world.waves.at(-1);
  world.reflect(reflected);

  assert.deepEqual(reflections.map(({kind,reflections})=>({kind,reflections})),[{kind:'wall',reflections:1}]);
  assert.equal(reflected.edges.has('l'),true);
});

test('reflected waves inherit the parent timing and lose reflection energy',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.beacons=[];
  world.glass=[];
  world.waves=[];
  const root=world.addWave(10,200,0,'direct',{rootTapId:'root-timing'});
  root.radius=11;
  root.age=1.25;
  root.energy=1;
  const reflections=[];
  world.onReflect=value=>reflections.push(value);

  world.reflect(root);
  const child=world.waves.at(-1);

  assert.equal(child.radius,root.radius);
  assert.equal(child.age,root.age);
  assert.equal(child.lifetime,root.lifetime);
  assert.equal(child.life,root.life);
  assert.equal(child.energy,.72);
  assert.equal(child.reflectionDepth,1);
  assert.equal(child.reflectedBy,'wall:l');
  assert.equal(reflections[0].waveId,child.id);
});

test('a reflected wave does not report its source glass twice',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.beacons=[];
  world.glass=[{id:'test-glass',x1:100,y1:0,x2:100,y2:400,nx:1,ny:0}];
  world.waves=[];
  const root=world.addWave(80,200,0,'direct');
  root.radius=20;
  const reflections=[];
  world.onReflect=value=>reflections.push(value);

  world.reflect(root);
  const reflected=world.waves.at(-1);
  reflected.radius=20;
  world.reflect(reflected);

  assert.deepEqual(reflections.map(({kind,reflections})=>({kind,reflections})),[{kind:'glass',reflections:1}]);
  assert.equal(reflected.glass.has('test-glass'),true);
});

test('finite glass segments do not reflect from their extension',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.beacons=[];
  world.waves=[];
  world.glass=[{id:'short-glass',x1:100,y1:0,x2:100,y2:40,nx:1,ny:0}];
  const root=world.addWave(80,100,0,'direct');
  root.radius=20;
  const reflections=[];
  world.onReflect=value=>reflections.push(value);

  world.reflect(root);

  assert.equal(reflections.length,0);
  assert.equal(world.waves.length,1);
});

test('finite glass segments reflect at an endpoint only after the endpoint distance is reached',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.beacons=[];
  world.waves=[];
  world.glass=[{id:'short-glass',x1:100,y1:0,x2:100,y2:40,nx:1,ny:0}];
  const root=world.addWave(80,100,0,'direct');
  root.radius=64;
  const reflections=[];
  world.onReflect=value=>reflections.push(value);

  world.reflect(root);

  assert.equal(reflections.length,1);
  assert.equal(reflections[0].kind,'glass');
  assert.equal(reflections[0].x,100);
  assert.equal(reflections[0].y,40);
});

test('reflected waves keep their root, parent, and source surface history',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.beacons=[];
  world.glass=[];
  world.waves=[];
  const root=world.addWave(10,200,0,'direct',{rootTapId:'root-identity'});
  root.radius=11;

  world.reflect(root);
  const child=world.waves.at(-1);

  assert.equal(child.rootTapId,'root-identity');
  assert.equal(child.parentWaveId,root.id);
  assert.equal(child.surfaceHistory.has('wall:l'),true);
});

test('reset restarts wave IDs inside the world',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  const first=world.addWave(100,100,0,'direct');
  assert.equal(first.id,1);
  world.reset();
  const second=world.addWave(100,100,0,'direct');
  assert.equal(second.id,1);
});

test('wave capacity rejects a new wave without shifting existing waves',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.waves=[];
  const waves=Array.from({length:MAX_WAVES},(_,index)=>world.addWave(index,100,0,'direct'));
  const ids=waves.map(wave=>wave.id);
  assert.equal(world.addWave(200,100,0,'direct'),null);
  assert.deepEqual(world.waves.map(wave=>wave.id),ids);
});

test('one accepted tap creates one root wave and reflection depth stops at two',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.beacons=[];
  world.glass=[];
  assert.equal(world.tap(100,100),true);
  assert.equal(world.waves.length,1);
  assert.equal(world.waves[0].parentWaveId,null);
  assert.equal(world.waves[0].reflectionDepth,0);

  const depthTwo=world.addWave(10,200,2,'wall');
  depthTwo.radius=11;
  world.reflect(depthTwo);
  assert.equal(world.waves.filter(wave=>wave.parentWaveId===depthTwo.waveId).length,0);
});

test('the same tap and beacon keep only the highest candidate score',()=>{
  const world=new World({random:()=>.5});
  world.reset();
  world.beacons=[{id:'test-beacon',x:100,y:100,radius:10,flash:0,vx:0,vy:0}];
  world.glass=[];
  world.waves=[];

  const direct=world.addWave(0,100,0,'direct',{rootTapId:'root-1'});
  direct.speed=0;
  direct.radius=100;
  world.step(.01);
  assert.equal(world.score,0);

  const reflectionPath=createReflectionPath({
    surfaceKey:'wall:test',
    surfaceKind:'wall',
    x1:50,
    y1:0,
    x2:50,
    y2:200,
    parentOriginX:100,
    parentOriginY:100,
    childOriginX:0,
    childOriginY:100
  });
  const wall=world.addWave(0,100,1,'wall',{rootTapId:'root-1',reflectionPath});
  wall.speed=0;
  wall.radius=100;
  world.step(.01);
  world.flushWaveHits(wall);
  world.settleRoots(['root-1']);
  assert.ok(world.score>24);
  assert.deepEqual(world.getScoreBreakdown(),{direct:0,wall:world.score,glass:0,double:0});
  assert.equal(Object.values(world.getScoreBreakdown()).reduce((total,points)=>total+points,0),world.score);
});

test('world ignores taps after the six-tap limit',async()=>{
  const {MAX_TAPS}=await import(new URL('../src/config.js',import.meta.url));
  const world=new World({random:()=>.5});
  world.reset();
  for(let index=0;index<MAX_TAPS;index++)assert.equal(world.tap(100+index,100),true);
  assert.equal(world.tap(200,100),false);
  assert.equal(world.taps,MAX_TAPS);
  assert.equal(world.waves.length,MAX_TAPS);
});

test('score bases distinguish direct, wall, reflector, and double reflection',async()=>{
  const scoring=await import(new URL('../src/game/scoring.js',import.meta.url));
  assert.deepEqual(scoring.SCORE_BASES,{direct:20,wall:100,glass:180,double:300});
  assert.deepEqual([
    scoring.candidateScore('direct',1),
    scoring.candidateScore('wall',1),
    scoring.candidateScore('glass',1),
    scoring.candidateScore('double',1)
  ],[24,120,216,360]);
});
