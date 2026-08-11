import{
  CLIENT_VERSION,
  GAME_SLUG,
  OFFICIAL_RULE_VERSION,
  RANKING_SEASON,
  SCORE_HARD_CEILING,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL
}from'../config.js';

export const RANKING_SERVICE_STATE=Object.freeze({
  enabled:false,
  activationPhase:'Phase 5'
});

export const RANKING_REQUEST_TIMEOUT_MS=10_000;
const OFFICIAL_MODE='official';

function rankingError(code,message,details={}){
  const error=new Error(message);
  error.code=code;
  Object.assign(error,details);
  return error;
}

function normalizePlayerName(playerName){
  if(typeof playerName!=='string')throw rankingError('RANKING_INVALID_NAME','player name must be text');
  const normalized=playerName.trim();
  if(normalized.length<1||normalized.length>20){
    throw rankingError('RANKING_INVALID_NAME','player name must contain 1 to 20 characters');
  }
  return normalized;
}

function normalizePlayId(playId){
  if(typeof playId!=='string'||playId.length<1||playId.length>128||!/^[A-Za-z0-9_-]+$/.test(playId)){
    throw rankingError('RANKING_INVALID_PLAY_ID','play ID must contain 1 to 128 safe characters');
  }
  return playId;
}

function normalizeScore(score){
  if(!Number.isSafeInteger(score)||score<0||score>SCORE_HARD_CEILING){
    throw rankingError('RANKING_INVALID_SCORE',`score must be an integer from 0 to ${SCORE_HARD_CEILING}`);
  }
  return score;
}

function validateMode(mode){
  if(mode!==OFFICIAL_MODE)throw rankingError('RANKING_MODE_REJECTED','only official mode may be submitted');
}

function createRequestController(timeoutMs,outerSignal){
  if(typeof AbortController==='undefined')return{controller:null,cleanup(){}};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const abort=()=>controller.abort();
  outerSignal?.addEventListener('abort',abort,{once:true});
  return{
    controller,
    cleanup(){
      clearTimeout(timer);
      outerSignal?.removeEventListener('abort',abort);
    }
  };
}

function responseAccepted(data){
  const first=Array.isArray(data)?data[0]:data;
  return first?.accepted===true;
}

export function createRankingService({
  enabled=RANKING_SERVICE_STATE.enabled,
  fetchImpl=globalThis.fetch,
  timeoutMs=RANKING_REQUEST_TIMEOUT_MS,
  url=SUPABASE_URL,
  apiKey=SUPABASE_PUBLISHABLE_KEY
}={}){
  const submittedPlayIds=new Set();
  const inFlightPlayIds=new Set();

  async function submitScore(playerName,score,{playId,mode=OFFICIAL_MODE,signal}={}){
    if(!enabled)throw rankingError('RANKING_DISABLED',`ranking service is disabled until ${RANKING_SERVICE_STATE.activationPhase}`);
    validateMode(mode);
    const normalizedName=normalizePlayerName(playerName);
    const normalizedPlayId=normalizePlayId(playId);
    const normalizedScore=normalizeScore(score);
    if(typeof fetchImpl!=='function')throw rankingError('RANKING_UNAVAILABLE','fetch is unavailable');
    if(!/^https:\/\//.test(url)||!/^sb_publishable_/.test(apiKey)){
      throw rankingError('RANKING_CONFIGURATION_INVALID','ranking endpoint configuration is invalid');
    }
    if(submittedPlayIds.has(normalizedPlayId)){
      throw rankingError('RANKING_DUPLICATE_PLAY','this play has already been submitted');
    }
    if(inFlightPlayIds.has(normalizedPlayId)){
      throw rankingError('RANKING_DUPLICATE_IN_FLIGHT','this play is already being submitted');
    }

    inFlightPlayIds.add(normalizedPlayId);
    const request=createRequestController(timeoutMs,signal);
    try{
      const response=await fetchImpl(`${url}/rest/v1/rpc/submit_namioshi_score_v1`,{
        method:'POST',
        headers:{
          apikey:apiKey,
          'Content-Type':'application/json'
        },
        signal:request.controller?.signal,
        body:JSON.stringify({
          p_display_name:normalizedName,
          p_game_slug:GAME_SLUG,
          p_score:normalizedScore,
          p_client_version:CLIENT_VERSION,
          p_play_id:normalizedPlayId,
          p_rule_version:OFFICIAL_RULE_VERSION,
          p_season:RANKING_SEASON
        })
      });
      if(!response?.ok){
        throw rankingError('RANKING_HTTP_ERROR',`ranking request failed with HTTP ${response?.status??'unknown'}`,{status:response?.status});
      }
      let data=null;
      if(typeof response.json==='function'){
        try{data=await response.json()}catch{}
      }
      if(!responseAccepted(data))throw rankingError('RANKING_SERVER_REJECTED','ranking server rejected this play');
      submittedPlayIds.add(normalizedPlayId);
      return{accepted:true,playId:normalizedPlayId,data};
    }catch(error){
      if(error?.name==='AbortError')throw rankingError('RANKING_TIMEOUT','ranking request timed out');
      throw error;
    }finally{
      request.cleanup();
      inFlightPlayIds.delete(normalizedPlayId);
    }
  }

  return Object.freeze({
    submitScore,
    reset(){
      submittedPlayIds.clear();
      inFlightPlayIds.clear();
    }
  });
}

const defaultRankingService=createRankingService();

export async function submitScore(playerName,score,options){
  return defaultRankingService.submitScore(playerName,score,options);
}

export function isCurrentSubmission(result,currentPlayId){
  return Boolean(result?.accepted&&result.playId===currentPlayId);
}
