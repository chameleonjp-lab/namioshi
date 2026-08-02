import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldFinishPlay} from '../src/game/session.js';

test('a play session ends only when its ten-second timer expires',()=>{
  assert.equal(shouldFinishPlay(10),false);
  assert.equal(shouldFinishPlay(5.8),false);
  assert.equal(shouldFinishPlay(.001),false);
  assert.equal(shouldFinishPlay(0),true);
  assert.equal(shouldFinishPlay(-.001),true);
});

test('using all taps and clearing all waves cannot end play early',()=>{
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(main,/if\(shouldFinishPlay\(world\.time\)\)finish\(\)/);
  assert.doesNotMatch(main,/world\.taps\s*>=|world\.waves\.length\s*===\s*0/);
});
