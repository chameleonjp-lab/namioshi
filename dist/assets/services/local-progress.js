import {CLIENT_VERSION,OFFICIAL_RULE_VERSION} from '../config.js';

export const STORAGE_KEYS=Object.freeze({
  displayName:'namioshi.displayName',
  bestScore:`namioshi.bestScore.${OFFICIAL_RULE_VERSION}`,
  playCount:'namioshi.playCount',
  lastClientVersion:'namioshi.lastClientVersion'
});

const MODES=Object.freeze({official:'official',practice:'practice'});
const EMPTY_COUNTS=Object.freeze({official:0,practice:0});

function getStorage(){
  try{return globalThis.localStorage??null}catch{return null}
}

function finiteCount(value){
  return Number.isSafeInteger(value)&&value>=0?value:0;
}

function parseCounts(raw){
  if(raw===null||raw===undefined)return{...EMPTY_COUNTS};
  try{
    const parsed=JSON.parse(raw);
    if(typeof parsed==='number')return{official:finiteCount(parsed),practice:0};
    if(parsed&&typeof parsed==='object'){
      return{
        official:finiteCount(parsed.official),
        practice:finiteCount(parsed.practice)
      };
    }
  }catch{}
  return{...EMPTY_COUNTS};
}

function parseBestScore(raw){
  if(raw===null||raw===undefined||raw==='')return null;
  const value=Number(raw);
  return Number.isSafeInteger(value)&&value>=0?value:null;
}

function emptyState(available=false){
  return{
    available,
    displayName:'',
    bestScore:null,
    playCount:{...EMPTY_COUNTS},
    lastClientVersion:''
  };
}

export function readPlayerState(storage=getStorage()){
  if(!storage||typeof storage.getItem!=='function')return emptyState(false);
  try{
    return{
      available:true,
      displayName:storage.getItem(STORAGE_KEYS.displayName)?.trim()??'',
      bestScore:parseBestScore(storage.getItem(STORAGE_KEYS.bestScore)),
      playCount:parseCounts(storage.getItem(STORAGE_KEYS.playCount)),
      lastClientVersion:storage.getItem(STORAGE_KEYS.lastClientVersion)??''
    };
  }catch{
    return emptyState(false);
  }
}

export function saveDisplayName(displayName,storage=getStorage()){
  if(!storage||typeof storage.setItem!=='function')return false;
  const value=typeof displayName==='string'?displayName.trim():'';
  if(!value)return false;
  try{
    storage.setItem(STORAGE_KEYS.displayName,value);
    return true;
  }catch{return false}
}

export function recordPlayResult({mode,score,displayName=''},storage=getStorage()){
  const current=readPlayerState(storage);
  if(mode!==MODES.official&&mode!==MODES.practice){
    return{saved:false,mode,bestScore:null,playCount:null,isNewBest:false};
  }
  if(!Number.isSafeInteger(score)||score<0||!current.available||typeof storage.setItem!=='function'){
    return{saved:false,mode,bestScore:null,playCount:null,isNewBest:false};
  }

  const nextCounts={...current.playCount,[mode]:current.playCount[mode]+1};
  const nextBest=mode===MODES.official
    ?Math.max(current.bestScore??0,score)
    :current.bestScore;
  const isNewBest=mode===MODES.official&&(current.bestScore===null||score>current.bestScore);
  const previous=new Map();
  const writes=[
    [STORAGE_KEYS.playCount,JSON.stringify(nextCounts)],
    [STORAGE_KEYS.lastClientVersion,CLIENT_VERSION]
  ];
  if(typeof displayName==='string'&&displayName.trim())writes.push([STORAGE_KEYS.displayName,displayName.trim()]);
  if(mode===MODES.official)writes.push([STORAGE_KEYS.bestScore,String(nextBest)]);

  try{
    for(const [key,value] of writes){
      previous.set(key,storage.getItem(key));
      storage.setItem(key,value);
    }
    return{
      saved:true,
      mode,
      bestScore:mode===MODES.official?nextBest:current.bestScore,
      playCount:nextCounts[mode],
      isNewBest
    };
  }catch{
    for(const [key,value] of previous){
      try{
        if(value===null)storage.removeItem(key);
        else storage.setItem(key,value);
      }catch{}
    }
    return{saved:false,mode,bestScore:null,playCount:null,isNewBest:false};
  }
}
