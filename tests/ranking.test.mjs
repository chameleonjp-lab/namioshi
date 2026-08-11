import test from 'node:test';
import assert from 'node:assert/strict';
import{
  RANKING_REQUEST_TIMEOUT_MS,
  createRankingService,
  isCurrentSubmission,
  submitScore
}from'../src/services/ranking.js';
import{
  OFFICIAL_RULE_VERSION,
  RANKING_SEASON,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL
}from'../src/config.js';

function response({ok=true,status=200,body={accepted:true}}={}){
  return{ok,status,json:async()=>body};
}

test('default ranking service stays disabled without a network request',async()=>{
  let calls=0;
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>{calls++;return response()};
  try{
    await assert.rejects(
      submitScore('player',100,{playId:'disabled-play'}),
      error=>error.code==='RANKING_DISABLED'
    );
    assert.equal(calls,0);
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test('enabled service accepts official scores once and sends the versioned contract',async()=>{
  const requests=[];
  const service=createRankingService({
    enabled:true,
    fetchImpl:async(url,init)=>{
      requests.push({url,init});
      return response({body:{accepted:true,score:100}});
    }
  });

  const result=await service.submitScore('  player  ',100,{playId:'play-1',mode:'official'});
  assert.equal(result.accepted,true);
  assert.equal(result.playId,'play-1');
  assert.equal(requests.length,1);
  assert.equal(requests[0].url,`${SUPABASE_URL}/rest/v1/rpc/submit_score`);
  assert.deepEqual(requests[0].init.headers,{
    apikey:SUPABASE_PUBLISHABLE_KEY,
    'Content-Type':'application/json'
  });
  assert.equal(Object.hasOwn(requests[0].init.headers,'Authorization'),false);
  assert.deepEqual(JSON.parse(requests[0].init.body),{
    p_display_name:'player',
    p_game_slug:'namioshi',
    p_score:100,
    p_client_version:'namioshi-v3.1.0-official002',
    p_play_id:'play-1',
    p_rule_version:OFFICIAL_RULE_VERSION,
    p_season:RANKING_SEASON
  });
  await assert.rejects(
    service.submitScore('player',100,{playId:'play-1'}),
    error=>error.code==='RANKING_DUPLICATE_PLAY'
  );
});

test('server rejection is not recorded as a successful play and can be retried',async()=>{
  let calls=0;
  const service=createRankingService({
    enabled:true,
    fetchImpl:async()=>{
      calls++;
      return response({body:calls===1?[{accepted:false,status:'rate_limited'}]:[{accepted:true}]});
    }
  });

  await assert.rejects(
    service.submitScore('player',100,{playId:'retry-server'}),
    error=>error.code==='RANKING_SERVER_REJECTED'
  );
  const retried=await service.submitScore('player',100,{playId:'retry-server'});
  assert.equal(retried.accepted,true);
  assert.equal(calls,2);
});

test('practice mode, invalid values, and unsafe play IDs are rejected before fetch',async()=>{
  let calls=0;
  const service=createRankingService({enabled:true,fetchImpl:async()=>{calls++;return response()}});
  await assert.rejects(service.submitScore('player',100,{playId:'practice',mode:'practice'}),error=>error.code==='RANKING_MODE_REJECTED');
  await assert.rejects(service.submitScore('player',6481,{playId:'too-high'}),error=>error.code==='RANKING_INVALID_SCORE');
  await assert.rejects(service.submitScore('',100,{playId:'empty-name'}),error=>error.code==='RANKING_INVALID_NAME');
  await assert.rejects(service.submitScore('player',100,{playId:'not safe'}),error=>error.code==='RANKING_INVALID_PLAY_ID');
  assert.equal(calls,0);
});

test('a failed request can be retried, while concurrent duplicates are rejected',async()=>{
  let release;
  const waiting=new Promise(resolve=>{release=resolve});
  let calls=0;
  const service=createRankingService({
    enabled:true,
    fetchImpl:async()=>{
      calls++;
      if(calls===1){await waiting;return response({ok:false,status:503})}
      return response();
    }
  });
  const first=service.submitScore('player',100,{playId:'retry-play'});
  await assert.rejects(service.submitScore('player',100,{playId:'retry-play'}),error=>error.code==='RANKING_DUPLICATE_IN_FLIGHT');
  release();
  await assert.rejects(first,error=>error.code==='RANKING_HTTP_ERROR');
  const retried=await service.submitScore('player',100,{playId:'retry-play'});
  assert.equal(retried.accepted,true);
  assert.equal(calls,2);
});

test('requests are aborted at the fixed timeout and stale results can be ignored by play ID',async()=>{
  let observedSignal;
  const service=createRankingService({
    enabled:true,
    timeoutMs:10,
    fetchImpl:async(_url,init)=>{
      observedSignal=init.signal;
      return new Promise((_resolve,reject)=>{
        init.signal.addEventListener('abort',()=>{
          const error=new Error('aborted');
          error.name='AbortError';
          reject(error);
        },{once:true});
      });
    }
  });
  await assert.rejects(service.submitScore('player',100,{playId:'timeout-play'}),error=>error.code==='RANKING_TIMEOUT');
  assert.equal(observedSignal.aborted,true);
  assert.equal(RANKING_REQUEST_TIMEOUT_MS,10_000);
  assert.equal(isCurrentSubmission({accepted:true,playId:'new-play'},'new-play'),true);
  assert.equal(isCurrentSubmission({accepted:true,playId:'old-play'},'new-play'),false);
});
