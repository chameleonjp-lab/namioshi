export const HAPTICS_STORAGE_KEY='namioshi.settings.haptics';

export const HAPTIC_PATTERNS=Object.freeze({
  TAP:8,
  WALL_REFLECT:10,
  GLASS_REFLECT:Object.freeze([10,16,10]),
  HIT:14,
  GOOD:18,
  GREAT:Object.freeze([18,18,18]),
  PERFECT:Object.freeze([22,18,22]),
  DOUBLE_HIT:Object.freeze([22,16,22,16]),
  RESULT:Object.freeze([12,18,12])
});

const JUDGEMENT_PATTERNS=Object.freeze({
  PERFECT:'PERFECT',
  GREAT:'GREAT',
  GOOD:'GOOD',
  HIT:'HIT'
});

let hapticsEnabled=readStoredSetting();
let hapticsActive=true;

function storage(){
  try{return globalThis.localStorage??null}catch{return null}
}

function readStoredSetting(){
  try{return storage()?.getItem(HAPTICS_STORAGE_KEY)==='on'}catch{return false}
}

function saveSetting(){
  try{storage()?.setItem(HAPTICS_STORAGE_KEY,hapticsEnabled?'on':'off')}catch{}
}

function navigatorObject(){
  try{return globalThis.navigator??null}catch{return null}
}

export function isHapticsSupported(){
  return typeof navigatorObject()?.vibrate==='function';
}

export function isHapticsEnabled(){
  return hapticsEnabled&&isHapticsSupported();
}

export function setHapticsEnabled(enabled){
  hapticsEnabled=enabled===true;
  saveSetting();
  if(!hapticsEnabled)cancelVibration();
  return isHapticsEnabled();
}

function cancelVibration(){
  const target=navigatorObject();
  if(typeof target?.vibrate!=='function')return false;
  try{
    target.vibrate(0);
    return true;
  }catch{return false}
}

export function setHapticsActive(active){
  hapticsActive=active===true;
  if(hapticsActive)return true;
  return cancelVibration();
}

export function playHaptic(name){
  const pattern=HAPTIC_PATTERNS[name];
  const target=navigatorObject();
  if(pattern===undefined||!hapticsEnabled||!hapticsActive||typeof target?.vibrate!=='function')return false;
  try{
    return target.vibrate(pattern)!==false;
  }catch{return false}
}

export function playHitHaptic({judgement='HIT',reflections=0}={}){
  const played=playHaptic(JUDGEMENT_PATTERNS[judgement]??'HIT');
  if(reflections>=2)playHaptic('DOUBLE_HIT');
  return played;
}
