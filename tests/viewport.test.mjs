import test from 'node:test';
import assert from 'node:assert/strict';
import {LOGICAL_HEIGHT,LOGICAL_WIDTH} from '../src/config.js';
import {World} from '../src/game/world.js';
import {clientToLogical,createViewport,logicalToClient} from '../src/game/viewport.js';

const sizes=[[320,568],[375,812],[390,844],[1024,1366]];
const points=[[0,0],[LOGICAL_WIDTH/2,LOGICAL_HEIGHT/2],[LOGICAL_WIDTH,LOGICAL_HEIGHT]];
const close=(actual,expected,tolerance=.25)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} is not within ${tolerance} of ${expected}`);

function seededRandom(seed){
  let value=seed>>>0;
  return()=>{value=(value*1664525+1013904223)>>>0;return value/0x100000000};
}

function withRandom(seed,callback){
  const original=Math.random;
  Math.random=seededRandom(seed);
  try{return callback()}finally{Math.random=original}
}

function simulate(viewWidth,viewHeight){
  const viewport=createViewport(viewWidth,viewHeight);
  const rect={left:11.5,top:23.25,width:viewWidth,height:viewHeight};
  const world=new World();
  withRandom(123456,()=>{
    world.reset();
    for(const [x,y] of [[90,160],[180,320],[270,480]]){
      const client=logicalToClient(x,y,rect,viewport);
      const logical=clientToLogical(client.x,client.y,rect,viewport);
      assert.ok(logical);
      world.tap(logical.x,logical.y);
    }
    for(let frame=0;frame<240;frame++)world.step(1/60);
  });
  const round=value=>Math.round(value*1e9)/1e9;
  return{
    width:world.w,
    height:world.h,
    score:world.score,
    taps:world.taps,
    time:round(world.time),
    beacons:world.beacons.map(beacon=>[round(beacon.x),round(beacon.y),round(beacon.vx),round(beacon.vy)]),
    glass:world.glass.map(piece=>[round(piece.x1),round(piece.y1),round(piece.x2),round(piece.y2)]),
    waves:world.waves.map(wave=>[round(wave.originX),round(wave.originY),round(wave.radius),wave.reflections,wave.kind]),
    particles:world.particles.map(particle=>[round(particle.x),round(particle.y),round(particle.age)])
  };
}

test('viewport fits the complete 360x640 logical area without cropping',()=>{
  for(const [viewWidth,viewHeight] of sizes){
    const viewport=createViewport(viewWidth,viewHeight);
    assert.equal(viewport.logicalWidth,LOGICAL_WIDTH);
    assert.equal(viewport.logicalHeight,LOGICAL_HEIGHT);
    assert.ok(viewport.displayWidth<=viewWidth+1e-9);
    assert.ok(viewport.displayHeight<=viewHeight+1e-9);
    close(viewport.offsetX*2+viewport.displayWidth,viewWidth,1e-9);
    close(viewport.offsetY*2+viewport.displayHeight,viewHeight,1e-9);
  }
});

test('client and logical coordinates round-trip within 0.25 logical pixels',()=>{
  for(const [viewWidth,viewHeight] of sizes){
    const viewport=createViewport(viewWidth,viewHeight);
    const rect={left:17.25,top:31.5,width:viewWidth,height:viewHeight};
    for(const [x,y] of points){
      const client=logicalToClient(x,y,rect,viewport);
      const logical=clientToLogical(client.x,client.y,rect,viewport);
      assert.ok(logical);
      close(logical.x,x);
      close(logical.y,y);
    }
  }
});

test('input in letterbox margins or outside the canvas is rejected',()=>{
  const portrait=createViewport(375,812);
  const portraitRect={left:10,top:20,width:375,height:812};
  assert.equal(clientToLogical(portraitRect.left+portrait.viewWidth/2,portraitRect.top+portrait.offsetY/2,portraitRect,portrait),null);
  assert.equal(clientToLogical(portraitRect.left-1,portraitRect.top+400,portraitRect,portrait),null);

  const landscape=createViewport(844,390);
  const landscapeRect={left:4,top:8,width:844,height:390};
  assert.equal(clientToLogical(landscapeRect.left+landscape.offsetX/2,landscapeRect.top+landscape.viewHeight/2,landscapeRect,landscape),null);
  assert.equal(clientToLogical(landscapeRect.left+845,landscapeRect.top+200,landscapeRect,landscape),null);
});

test('world dimensions stay fixed and viewport changes do not mutate play state',()=>{
  const world=withRandom(24680,()=>{const instance=new World();instance.reset();instance.tap(180,320);instance.step(.5);return instance});
  const before=JSON.stringify({w:world.w,h:world.h,score:world.score,taps:world.taps,time:world.time,waves:world.waves.map(wave=>[wave.originX,wave.originY,wave.radius]),beacons:world.beacons.map(beacon=>[beacon.x,beacon.y])});
  for(const [width,height] of [[390,844],[844,390],[320,568]])createViewport(width,height);
  const after=JSON.stringify({w:world.w,h:world.h,score:world.score,taps:world.taps,time:world.time,waves:world.waves.map(wave=>[wave.originX,wave.originY,wave.radius]),beacons:world.beacons.map(beacon=>[beacon.x,beacon.y])});
  assert.equal(world.w,LOGICAL_WIDTH);
  assert.equal(world.h,LOGICAL_HEIGHT);
  assert.equal(after,before);
});

test('the same logical taps produce the same simulation on supported view sizes',()=>{
  const baseline=simulate(...sizes[0]);
  for(const size of sizes.slice(1))assert.deepEqual(simulate(...size),baseline);
});
