export const SOUND_STORAGE_KEY='namioshi.settings.sound';

let audioContext=null;
let masterGain=null;
let soundEnabled=readStoredSetting();

function storage(){
  try{return globalThis.localStorage??null}catch{return null}
}

function readStoredSetting(){
  try{return storage()?.getItem(SOUND_STORAGE_KEY)==='on'}catch{return false}
}

function saveSetting(){
  try{storage()?.setItem(SOUND_STORAGE_KEY,soundEnabled?'on':'off')}catch{}
}

function createAudioContext(){
  if(!soundEnabled)return null;
  if(audioContext)return audioContext;
  const AudioContextClass=globalThis.AudioContext??globalThis.webkitAudioContext;
  if(!AudioContextClass)return null;
  audioContext=new AudioContextClass();
  masterGain=audioContext.createGain();
  masterGain.gain.value=1;
  masterGain.connect(audioContext.destination);
  return audioContext;
}

export function isSoundEnabled(){
  return soundEnabled;
}

export function setSoundEnabled(enabled){
  soundEnabled=enabled===true;
  saveSetting();
  if(audioContext&&masterGain){
    masterGain.gain.setValueAtTime(soundEnabled?1:0,audioContext.currentTime);
  }
  return soundEnabled;
}

export function wake(){
  try{
    if(!soundEnabled)return false;
    const context=createAudioContext();
    if(!context||!masterGain)return false;
    masterGain.gain.setValueAtTime(1,context.currentTime);
    if(context.state==='suspended')void context.resume();
    return true;
  }catch{return false}
}

export function tone(frequency,duration=.08,type='sine'){
  try{
    if(!soundEnabled||!audioContext||!masterGain||audioContext.state==='closed')return false;
    const oscillator=audioContext.createOscillator();
    const gain=audioContext.createGain();
    oscillator.type=type;
    oscillator.frequency.value=frequency;
    gain.gain.value=.045;
    gain.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+duration);
    oscillator.connect(gain).connect(masterGain);
    oscillator.start();
    oscillator.stop(audioContext.currentTime+duration);
    return true;
  }catch{return false}
}
