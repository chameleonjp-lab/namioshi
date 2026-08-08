import test from 'node:test';
import assert from 'node:assert/strict';
import {HIT_JUDGEMENT,judgementFromPrecision} from '../src/game/judgement.js';
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
  const wave=world.addWave(0,100,0,'direct');
  wave.radius=98.35;
  let hit=null;
  world.onHit=value=>{hit=value};

  world.step(.01);

  assert.equal(hit?.judgement,HIT_JUDGEMENT.PERFECT);
  assert.ok(Math.abs(hit.precision-1)<1e-9);
  assert.equal(hit.points,24);
  assert.equal(hit.candidateScore,24);
  assert.equal(hit.category,'direct');
  assert.equal(hit.kind,'direct');
  assert.equal(hit.reflections,0);
  assert.equal(world.score,24);
  assert.deepEqual(world.getScoreBreakdown(),{direct:24,wall:0,glass:0,double:0});
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
  assert.equal(world.score,24);

  const wall=world.addWave(0,100,1,'wall',{rootTapId:'root-1'});
  wall.speed=0;
  wall.radius=100;
  world.step(.01);
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
