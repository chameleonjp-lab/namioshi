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
  assert.equal(hit.points,145);
  assert.equal(hit.kind,'direct');
  assert.equal(hit.reflections,0);
  assert.equal(world.score,145);
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

  assert.deepEqual(reflections,[{kind:'wall',reflections:1}]);
});
