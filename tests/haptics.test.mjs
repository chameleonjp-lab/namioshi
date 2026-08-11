import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function source(path){
  return readFileSync(new URL('../'+path,import.meta.url),'utf8');
}

function installNavigator(value){
  Object.defineProperty(globalThis,'navigator',{
    configurable:true,
    enumerable:true,
    writable:true,
    value
  });
}

function restoreNavigator(descriptor){
  if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);
  else delete globalThis.navigator;
}

test('haptics default to off, persist opt-in, and stop while inactive',async()=>{
  const previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const previousStorage=globalThis.localStorage;
  const patterns=[];
  let storedValue=null;

  installNavigator({
    vibrate(pattern){
      patterns.push(pattern);
      return true;
    }
  });
  globalThis.localStorage={
    getItem:key=>key==='namioshi.settings.haptics'?storedValue:null,
    setItem:(key,value)=>{if(key==='namioshi.settings.haptics')storedValue=value}
  };

  try{
    const haptics=await import(new URL('../src/core/haptics.js?default-off',import.meta.url));
    assert.equal(haptics.HAPTICS_STORAGE_KEY,'namioshi.settings.haptics');
    assert.equal(haptics.isHapticsSupported(),true);
    assert.equal(haptics.isHapticsEnabled(),false);
    assert.equal(haptics.playHaptic('TAP'),false);
    assert.equal(patterns.length,0);

    assert.equal(haptics.setHapticsEnabled(true),true);
    assert.equal(storedValue,'on');
    assert.equal(haptics.playHaptic('TAP'),true);
    assert.deepEqual(patterns[0],8);
    assert.equal(haptics.playHitHaptic({judgement:'PERFECT',reflections:2}),true);
    assert.equal(patterns.length,3);
    assert.deepEqual(patterns[1],[22,18,22]);
    assert.deepEqual(patterns[2],[22,16,22,16]);

    assert.equal(haptics.setHapticsActive(false),true);
    assert.deepEqual(patterns.at(-1),0);
    assert.equal(haptics.playHaptic('RESULT'),false);
    assert.equal(haptics.setHapticsActive(true),true);
    assert.equal(haptics.playHaptic('RESULT'),true);

    const reloaded=await import(new URL('../src/core/haptics.js?stored-on',import.meta.url));
    assert.equal(reloaded.isHapticsEnabled(),true);
    assert.equal(haptics.setHapticsEnabled(false),false);
    assert.equal(storedValue,'off');
    assert.equal(haptics.playHitHaptic({judgement:'PERFECT',reflections:2}),false);
  }finally{
    restoreNavigator(previousNavigator);
    if(previousStorage===undefined)delete globalThis.localStorage;
    else globalThis.localStorage=previousStorage;
  }
});

test('unsupported vibration APIs stay silent and do not throw',async()=>{
  const previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const previousStorage=globalThis.localStorage;
  installNavigator({});
  globalThis.localStorage={getItem:()=>null,setItem(){}};

  try{
    const haptics=await import(new URL('../src/core/haptics.js?unsupported',import.meta.url));
    assert.equal(haptics.isHapticsSupported(),false);
    assert.equal(haptics.setHapticsEnabled(true),false);
    assert.equal(haptics.playHaptic('TAP'),false);
    assert.equal(haptics.playHitHaptic({judgement:'GREAT',reflections:2}),false);
    assert.equal(haptics.setHapticsActive(false),false);
  }finally{
    restoreNavigator(previousNavigator);
    if(previousStorage===undefined)delete globalThis.localStorage;
    else globalThis.localStorage=previousStorage;
  }
});

test('haptic patterns distinguish feedback value without changing game rules',async()=>{
  const {HAPTIC_PATTERNS}=await import(new URL('../src/core/haptics.js?pattern-contract',import.meta.url));
  assert.deepEqual(HAPTIC_PATTERNS.TAP,8);
  assert.deepEqual(HAPTIC_PATTERNS.GLASS_REFLECT,[10,16,10]);
  assert.ok(JSON.stringify(HAPTIC_PATTERNS.HIT)!==JSON.stringify(HAPTIC_PATTERNS.GOOD));
  assert.ok(JSON.stringify(HAPTIC_PATTERNS.GOOD)!==JSON.stringify(HAPTIC_PATTERNS.GREAT));
  assert.ok(JSON.stringify(HAPTIC_PATTERNS.GREAT)!==JSON.stringify(HAPTIC_PATTERNS.PERFECT));
  assert.ok(JSON.stringify(HAPTIC_PATTERNS.DOUBLE_HIT)!==JSON.stringify(HAPTIC_PATTERNS.RESULT));
});

test('main wires optional haptics to input, feedback, lifecycle, and an accessible control',()=>{
  const main=source('src/main.js');
  assert.match(main,/from '\.\/core\/haptics\.js'/);
  assert.match(main,/id="hapticsToggle"[^>]*aria-pressed="false"/);
  assert.match(main,/function updateHapticsControl\(\)/);
  assert.match(main,/button\.disabled=!supported/);
  assert.match(main,/playHaptic\('TAP'\)/);
  assert.match(main,/playHitHaptic\(hit\)/);
  assert.match(main,/setHapticsActive\(!document\.hidden\)/);
  assert.match(main,/setHapticsActive\(false\)/);
});
