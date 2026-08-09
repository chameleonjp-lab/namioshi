import test from 'node:test';
import assert from 'node:assert/strict';
import {createReflectionPath,traceReflectionPath} from '../src/game/reflection-path.js';

function path({
  previous=null,
  surfaceKey='glass:test',
  x1=100,
  y1=0,
  x2=100,
  y2=200,
  parentOriginX=80,
  parentOriginY=100,
  childOriginX=120,
  childOriginY=100
}={}){
  return createReflectionPath({
    previous,
    surfaceKey,
    surfaceKind:'glass',
    x1,
    y1,
    x2,
    y2,
    parentOriginX,
    parentOriginY,
    childOriginX,
    childOriginY
  });
}

test('a reflected route must cross the finite middle of its surface',()=>{
  const reflection=path();
  const valid=traceReflectionPath(120,100,80,100,reflection);
  const extension=traceReflectionPath(120,100,80,500,reflection);

  assert.equal(valid.valid,true);
  assert.equal(valid.intersections.length,1);
  assert.equal(valid.intersections[0].segmentT,.5);
  assert.equal(extension.valid,false);
  assert.equal(extension.reason,'outside-finite-surface');
});

test('an endpoint route is valid only when the unfolded line reaches the endpoint',()=>{
  const reflection=path({
    y1:200,
    y2:240,
    parentOriginX:80,
    parentOriginY:300,
    childOriginX:120,
    childOriginY:300
  });
  const endpoint=traceReflectionPath(120,300,80,180,reflection);
  const beyond=traceReflectionPath(120,300,80,40,reflection);

  assert.equal(endpoint.valid,true);
  assert.equal(endpoint.intersections[0].segmentT,1);
  assert.equal(beyond.valid,false);
});

test('two reflections are unfolded in reverse order through both finite surfaces',()=>{
  const first=path({surfaceKey:'glass:first'});
  const second=path({
    previous:first,
    surfaceKey:'glass:second',
    x1:60,
    y1:0,
    x2:60,
    y2:200,
    parentOriginX:120,
    parentOriginY:100,
    childOriginX:0,
    childOriginY:100
  });
  const valid=traceReflectionPath(0,100,120,100,second);

  assert.equal(valid.valid,true);
  assert.deepEqual(valid.intersections.map(value=>value.surfaceKey),['glass:second','glass:first']);
  assert.deepEqual(valid.intersections.map(value=>value.segmentT),[.5,.5]);

  const shortFirst=path({surfaceKey:'glass:first',y2:40});
  const blocked=path({
    previous:shortFirst,
    surfaceKey:'glass:second',
    x1:60,
    y1:0,
    x2:60,
    y2:200,
    parentOriginX:120,
    parentOriginY:100,
    childOriginX:0,
    childOriginY:100
  });
  assert.equal(traceReflectionPath(0,100,120,100,blocked).valid,false);
});

test('the same finite surface cannot appear twice in one reflected route',()=>{
  const first=path({surfaceKey:'glass:repeat'});
  const repeated=path({
    previous:first,
    surfaceKey:'glass:repeat',
    x1:60,
    x2:60,
    parentOriginX:120,
    childOriginX:0
  });
  const result=traceReflectionPath(0,100,120,100,repeated);
  assert.equal(result.valid,false);
  assert.equal(result.reason,'repeated-surface');
});
