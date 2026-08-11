import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLIENT_VERSION} from '../src/config.js';
import {STORAGE_KEYS,readPlayerState,recordPlayResult,saveDisplayName} from '../src/services/local-progress.js';

class MemoryStorage{
  #values=new Map();

  getItem(key){return this.#values.has(key)?this.#values.get(key):null}
  setItem(key,value){this.#values.set(key,String(value))}
  removeItem(key){this.#values.delete(key)}
}

class FailingStorage extends MemoryStorage{
  setItem(key,value){
    if(key===STORAGE_KEYS.lastClientVersion)throw new Error('quota');
    super.setItem(key,value);
  }
}

test('official results persist the display name, best score, mode count, and client version',()=>{
  const storage=new MemoryStorage();
  assert.equal(saveDisplayName('  波の人  ',storage),true);
  const result=recordPlayResult({mode:'official',score:1234,displayName:'波の人'},storage);
  assert.deepEqual(result,{saved:true,mode:'official',bestScore:1234,playCount:1,isNewBest:true});
  assert.deepEqual(readPlayerState(storage),{
    available:true,
    displayName:'波の人',
    bestScore:1234,
    playCount:{official:1,practice:0},
    lastClientVersion:CLIENT_VERSION
  });
});

test('official best is not lowered and practice results never change it',()=>{
  const storage=new MemoryStorage();
  assert.equal(recordPlayResult({mode:'official',score:200,displayName:'A'},storage).isNewBest,true);
  assert.equal(recordPlayResult({mode:'official',score:100,displayName:'A'},storage).isNewBest,false);
  const practice=recordPlayResult({mode:'practice',score:9999,displayName:'A'},storage);
  assert.deepEqual(practice,{saved:true,mode:'practice',bestScore:200,playCount:1,isNewBest:false});
  assert.deepEqual(readPlayerState(storage).playCount,{official:2,practice:1});
  assert.equal(readPlayerState(storage).bestScore,200);
});

test('legacy numeric play count is treated as the official count',()=>{
  const storage=new MemoryStorage();
  storage.setItem(STORAGE_KEYS.playCount,'4');
  assert.deepEqual(readPlayerState(storage).playCount,{official:4,practice:0});
});

test('storage failure does not report a saved result and rolls back partial writes',()=>{
  const storage=new FailingStorage();
  const result=recordPlayResult({mode:'official',score:500,displayName:'失敗'},storage);
  assert.deepEqual(result,{saved:false,mode:'official',bestScore:null,playCount:null,isNewBest:false});
  assert.equal(readPlayerState(storage).bestScore,null);
  assert.deepEqual(readPlayerState(storage).playCount,{official:0,practice:0});
  assert.equal(readPlayerState(storage).displayName,'');
});

test('missing storage keeps the game result usable without claiming persistence',()=>{
  assert.equal(saveDisplayName('名前',null),false);
  assert.deepEqual(recordPlayResult({mode:'official',score:10,displayName:'名前'},null),{
    saved:false,mode:'official',bestScore:null,playCount:null,isNewBest:false
  });
});

test('result screen exposes persistence status and non-ranking exit paths',()=>{
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const styles=readFileSync(new URL('../src/ui/styles.css',import.meta.url),'utf8');
  assert.match(main,/id="resultBestStatus"/);
  assert.match(main,/id="resultPlayCount"/);
  assert.match(main,/id="resultStorageStatus"/);
  assert.match(main,/id="rankingDetails"[^>]*disabled/);
  assert.match(main,/id="endGame"/);
  assert.match(main,/実験場へ戻る/);
  assert.match(main,/recordPlayResult\(\{/);
  assert.match(main,/saveDisplayName\(player\)/);
  assert.match(main,/結果を端末に保存しました/);
  assert.match(main,/この環境では結果を端末に保存できません/);
  assert.match(styles,/\.resultStatus\{/);
  assert.match(styles,/\.btnLink\{/);
});

