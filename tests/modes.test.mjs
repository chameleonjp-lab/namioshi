import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  OFFICIAL_LAYOUT_FINGERPRINT,
  OFFICIAL_LAYOUT_ID,
  OFFICIAL_RULE_VERSION
} from '../src/config.js';
import {OFFICIAL_LAYOUT,createPracticeLayout} from '../src/game/layouts.js';
import {GAME_MODE,rankingPolicy} from '../src/game/modes.js';
import {World} from '../src/game/world.js';
import {LAYOUT_CANDIDATES} from '../tools/layout-candidates.js';

function seededRandom(seed){
  let state=seed>>>0;
  return()=>{
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/0x100000000;
  };
}

function initialState(world){
  return{
    mode:world.mode,
    layoutId:world.layoutId,
    ruleVersion:world.ruleVersion,
    layoutFingerprint:world.layoutFingerprint,
    rankingCandidate:world.rankingCandidate,
    beacons:world.beacons.map(({id,x,y,baseX,baseY,vx,vy,radius})=>({id,x,y,baseX,baseY,vx,vy,radius})),
    glass:world.glass.map(({id,x1,y1,x2,y2,nx,ny})=>({id,x1,y1,x2,y2,nx,ny}))
  };
}

function simulationState(world){
  const round=value=>Math.round(value*1e9)/1e9;
  return{
    score:world.score,
    taps:world.taps,
    time:round(world.time),
    beacons:world.beacons.map(beacon=>[beacon.id,round(beacon.x),round(beacon.y),round(beacon.vx),round(beacon.vy)]),
    waves:world.waves.map(wave=>[round(wave.originX),round(wave.originY),round(wave.radius),wave.reflections,wave.kind]),
    particles:world.particles.map(particle=>[round(particle.x),round(particle.y),round(particle.vx),round(particle.vy),round(particle.age),round(particle.life)])
  };
}

test('selected official layout exactly matches study candidate C',()=>{
  const candidate=LAYOUT_CANDIDATES.find(layout=>layout.id==='candidate-c-open-harbor');
  assert.ok(candidate);
  assert.equal(OFFICIAL_LAYOUT_ID,candidate.id);
  assert.equal(OFFICIAL_LAYOUT.ruleVersion,candidate.ruleVersion);
  assert.equal(OFFICIAL_RULE_VERSION,candidate.ruleVersion);
  assert.equal(OFFICIAL_LAYOUT.fingerprint,OFFICIAL_LAYOUT_FINGERPRINT);
  assert.equal(OFFICIAL_LAYOUT_FINGERPRINT,'fnv1a-fc71e804');
  assert.deepEqual(OFFICIAL_LAYOUT.beacons,candidate.beacons);
  assert.deepEqual(OFFICIAL_LAYOUT.glass,candidate.glass);
});

test('official reset does not call Math.random and always creates the same initial state',()=>{
  const original=Math.random;
  Math.random=()=>{throw new Error('official mode must not call Math.random')};
  try{
    const first=new World();
    const second=new World();
    first.reset({mode:GAME_MODE.OFFICIAL});
    second.reset({mode:GAME_MODE.OFFICIAL});
    assert.deepEqual(initialState(first),initialState(second));
    assert.equal(first.mode,GAME_MODE.OFFICIAL);
    assert.equal(first.layoutId,OFFICIAL_LAYOUT_ID);
    assert.equal(first.rankingCandidate,true);
  }finally{
    Math.random=original;
  }
});

test('same official taps and fixed steps produce the same score and visible state',()=>{
  const simulate=()=>{
    const world=new World();
    world.reset({mode:GAME_MODE.OFFICIAL});
    for(const [x,y] of [[90,140],[180,340],[270,490]])world.tap(x,y);
    for(let frame=0;frame<300;frame++)world.step(1/60);
    return simulationState(world);
  };
  assert.deepEqual(simulate(),simulate());
});

test('practice mode is reproducible with injected random and changes with another seed',()=>{
  const first=createPracticeLayout(seededRandom(12345));
  const second=createPracticeLayout(seededRandom(12345));
  const third=createPracticeLayout(seededRandom(54321));
  assert.deepEqual(first,second);
  assert.notDeepEqual(first,third);

  const world=new World({random:seededRandom(12345)});
  world.reset({mode:GAME_MODE.PRACTICE,random:seededRandom(12345)});
  assert.equal(world.mode,GAME_MODE.PRACTICE);
  assert.equal(world.layoutId,'practice-random');
  assert.equal(world.layoutFingerprint,null);
  assert.equal(world.rankingCandidate,false);
});

test('practice can never submit and official remains disabled until ranking Phase 5',()=>{
  assert.deepEqual(rankingPolicy(GAME_MODE.PRACTICE),{
    mode:GAME_MODE.PRACTICE,
    rankingCandidate:false,
    submitNow:false,
    statusText:'練習モードのためランキングへ送信しません。'
  });
  assert.deepEqual(rankingPolicy(GAME_MODE.OFFICIAL),{
    mode:GAME_MODE.OFFICIAL,
    rankingCandidate:true,
    submitNow:false,
    statusText:'公式モードです。ランキング送信はPhase 5で開始します。'
  });

  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.doesNotMatch(main,/submitScore/);
  assert.match(main,/startOfficial/);
  assert.match(main,/startPractice/);
  assert.match(main,/rankingPolicy\(world\.mode\)/);
});
