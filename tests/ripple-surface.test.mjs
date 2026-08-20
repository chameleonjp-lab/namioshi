import test from 'node:test';
import assert from 'node:assert/strict';
import {RippleSurface,RIPPLE_SURFACE_CONSTANTS,pickRippleGrid,viscosityToDamping} from '../src/render/ripple-surface.js';

test('HAMEN grid is bounded by device-friendly quality caps',()=>{
  for(const quality of ['HIGH','MID','LOW']){
    const grid=pickRippleGrid(360,640,quality);
    assert.ok(grid.w>=64);
    assert.ok(grid.h>=64);
    assert.ok(grid.w*grid.h<={HIGH:48000,MID:30000,LOW:16000}[quality]);
  }
  assert.equal(RIPPLE_SURFACE_CONSTANTS.fixedStep,1/60);
  assert.equal(RIPPLE_SURFACE_CONSTANTS.maxFrameDelta,.1);
});

test('viscosity curve clamps to the documented HAMEN damping range',()=>{
  assert.equal(viscosityToDamping(-10),.996);
  assert.equal(viscosityToDamping(28),.9652);
  assert.equal(viscosityToDamping(120),.886);
});

test('drop writes current only and never disturbs the Dirichlet boundary',()=>{
  const surface=new RippleSurface();
  surface.resize(360,640,'LOW');
  surface.drop(surface.w/2,surface.h/2,64);
  assert.ok(surface.current.some(value=>value>0));
  assert.equal(surface.previous.every(value=>value===0),true);
  for(let x=0;x<surface.w;x++){
    assert.equal(surface.current[x],0);
    assert.equal(surface.current[(surface.h-1)*surface.w+x],0);
  }
  for(let y=0;y<surface.h;y++){
    assert.equal(surface.current[y*surface.w],0);
    assert.equal(surface.current[y*surface.w+surface.w-1],0);
  }
});

test('fixed-step advancement is deterministic and clips long frame gaps',()=>{
  const one=new RippleSurface();
  const two=new RippleSurface();
  one.resize(360,640,'LOW');
  two.resize(360,640,'LOW');
  one.drop(30,40,64);
  two.drop(30,40,64);
  one.advance(0);
  two.advance(0);
  assert.equal(one.advance(1000),6);
  assert.equal(two.advance(1000),6);
  assert.deepEqual([...one.current],[...two.current]);
  assert.deepEqual([...one.previous],[...two.previous]);
});

test('world synchronization consumes each root tap once and resets on a new round',()=>{
  const surface=new RippleSurface();
  surface.resize(360,640,'LOW');
  const world={mode:'official',layoutId:'fixed',w:360,h:640,taps:1,waves:[{
    id:1,rootTapId:'tap-1',reflectionDepth:0,originX:120,originY:200
  }],reflectionEffects:[]};
  surface.syncWorld(world);
  const first=[...surface.current];
  surface.syncWorld(world);
  assert.deepEqual([...surface.current],first);
  world.taps=0;
  world.waves=[];
  surface.syncWorld(world);
  assert.equal(surface.current.every(value=>value===0),true);
});

test('painting produces transparent highlights without changing height buffers',()=>{
  const surface=new RippleSurface();
  surface.resize(360,640,'LOW');
  surface.drop(30,40,64);
  const current=[...surface.current];
  const pixels=surface.paint();
  assert.equal(pixels.length,surface.w*surface.h*4);
  assert.ok(pixels.some((value,index)=>index%4===3&&value>0));
  assert.deepEqual([...surface.current],current);
});
