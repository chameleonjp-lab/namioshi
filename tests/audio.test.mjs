import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('sound effects default to off, persist opt-in, and stay silent when disabled',async()=>{
  const previousAudioContext=globalThis.AudioContext;
  const previousStorage=globalThis.localStorage;
  let storedValue=null;
  let contextCount=0;
  let startCount=0;

  class FakeParam{
    value=0;
    setValueAtTime(value){this.value=value}
    exponentialRampToValueAtTime(value){this.value=value}
  }
  class FakeNode{
    connect(){return this}
  }
  class FakeGain extends FakeNode{
    gain=new FakeParam();
  }
  class FakeOscillator extends FakeNode{
    frequency=new FakeParam();
    start(){startCount++}
    stop(){}
  }
  class FakeAudioContext{
    currentTime=0;
    destination={};
    state='running';
    constructor(){contextCount++}
    createGain(){return new FakeGain()}
    createOscillator(){return new FakeOscillator()}
    resume(){this.state='running';return Promise.resolve()}
  }

  globalThis.AudioContext=FakeAudioContext;
  globalThis.localStorage={
    getItem:key=>key==='namioshi.settings.sound'?storedValue:null,
    setItem:(key,value)=>{if(key==='namioshi.settings.sound')storedValue=value}
  };

  try{
    const audio=await import(new URL('../src/core/audio.js?default-off',import.meta.url));
    assert.equal(audio.SOUND_STORAGE_KEY,'namioshi.settings.sound');
    assert.equal(audio.isSoundEnabled(),false);
    assert.equal(audio.wake(),false);
    assert.equal(audio.tone(180),false);
    assert.equal(contextCount,0);
    assert.equal(startCount,0);

    assert.equal(audio.setSoundEnabled(true),true);
    assert.equal(storedValue,'on');
    assert.equal(audio.wake(),true);
    assert.equal(audio.tone(180),true);
    assert.equal(contextCount,1);
    assert.equal(startCount,1);
    assert.equal(audio.playCue('PERFECT'),true);
    assert.equal(startCount,4);
    assert.equal(audio.playHitSound({judgement:'GREAT',reflections:2}),true);
    assert.equal(startCount,8);

    const reloaded=await import(new URL('../src/core/audio.js?stored-on',import.meta.url));
    assert.equal(reloaded.isSoundEnabled(),true);

    assert.equal(audio.setSoundEnabled(false),false);
    assert.equal(storedValue,'off');
    assert.equal(audio.wake(),false);
    assert.equal(audio.tone(620),false);
    assert.equal(audio.playCue('PERFECT'),false);
    assert.equal(audio.playHitSound({judgement:'PERFECT',reflections:2}),false);
    assert.equal(startCount,8);
  }finally{
    if(previousAudioContext===undefined)delete globalThis.AudioContext;
    else globalThis.AudioContext=previousAudioContext;
    if(previousStorage===undefined)delete globalThis.localStorage;
    else globalThis.localStorage=previousStorage;
  }
});

test('home provides an accessible sound-effects switch',()=>{
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(main,/id="soundToggle"[^>]*aria-pressed="false"[^>]*>効果音：なし<\/button>/);
  assert.match(main,/setSoundEnabled\(!isSoundEnabled\(\)\)/);
  assert.match(main,/setAttribute\('aria-pressed',String\(enabled\)\)/);
  assert.match(main,/function start\(mode\)\{[\s\S]*?\$\('name'\)\.blur\(\);\n  wake\(\);/);
  assert.match(main,/world\.onReflect=reflection=>playCue\(reflection\.kind==='glass'\?'GLASS_REFLECT':'WALL_REFLECT'\)/);
  assert.match(main,/world\.onHit=hit=>playHitSound\(hit\)/);
});

test('judgement sound cues become higher and richer for better hits',async()=>{
  const {SOUND_CUES}=await import(new URL('../src/core/audio.js?cue-contract',import.meta.url));
  const names=['HIT','GOOD','GREAT','PERFECT'];
  const signatures=names.map(name=>JSON.stringify(SOUND_CUES[name]));
  assert.equal(new Set(signatures).size,names.length);
  assert.deepEqual(names.map(name=>SOUND_CUES[name][0].frequency),[320,460,600,760]);
  assert.deepEqual(names.map(name=>SOUND_CUES[name].length),[1,1,2,3]);
  for(const name of ['TAP','WALL_REFLECT','GLASS_REFLECT','DOUBLE_HIT','RESULT']){
    assert.ok(SOUND_CUES[name]?.length>0,`${name} cue must exist`);
  }
});
