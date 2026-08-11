import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_URL} from '../src/config.js';
import {share,shareText} from '../src/services/share.js';

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

async function withNavigator(value,action){
  const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  installNavigator(value);
  try{return await action()}
  finally{restoreNavigator(previous)}
}

test('share text contains the score, game message, and the official URL',()=>{
  assert.equal(
    shareText(321),
    `波押しで 321点！\n反射する波をビーコンに重ねた。\n${GAME_URL}`
  );
});

test('native share succeeds with the text-only payload',async()=>{
  let payload=null;
  const result=await withNavigator({
    share:async value=>{payload=value}
  },()=>share(321));
  assert.equal(result,'共有しました');
  assert.deepEqual(payload,{text:shareText(321)});
});

test('native share cancellation is reported separately from failure',async()=>{
  const result=await withNavigator({
    share:async()=>{
      const error=new Error('cancelled');
      error.name='AbortError';
      throw error;
    }
  },()=>share(12));
  assert.equal(result,'共有をキャンセルしました');
});

test('native share failure falls back to the clipboard',async()=>{
  let copied=null;
  const result=await withNavigator({
    share:async()=>{throw new Error('native share failed')},
    clipboard:{writeText:async value=>{copied=value}}
  },()=>share(45));
  assert.equal(result,'シェア文をコピーしました');
  assert.equal(copied,shareText(45));
});

test('clipboard-only environments can copy the share text',async()=>{
  let copied=null;
  const result=await withNavigator({
    clipboard:{writeText:async value=>{copied=value}}
  },()=>share(67));
  assert.equal(result,'シェア文をコピーしました');
  assert.equal(copied,shareText(67));
});

test('missing sharing APIs return an actionable failure',async()=>{
  await withNavigator({},async()=>{
    await assert.rejects(share(89),/share unavailable/);
  });
});

test('clipboard failures remain failures for the UI fallback',async()=>{
  const failure=new Error('clipboard denied');
  await withNavigator({
    clipboard:{writeText:async()=>{throw failure}}
  },async()=>{
    await assert.rejects(share(90),error=>error===failure);
  });
});
