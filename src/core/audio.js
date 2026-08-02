export const SOUND_STORAGE_KEY='namioshi.settings.sound';

export const SOUND_CUES=Object.freeze({
  ENABLE:Object.freeze([{frequency:440,duration:.06,type:'sine',volume:.035}]),
  TAP:Object.freeze([{frequency:180,duration:.07,type:'triangle',volume:.04}]),
  WALL_REFLECT:Object.freeze([{frequency:260,duration:.055,type:'triangle',volume:.028}]),
  GLASS_REFLECT:Object.freeze([
    {frequency:520,duration:.07,type:'sine',volume:.026},
    {frequency:720,duration:.06,type:'sine',delay:.035,volume:.022}
  ]),
  HIT:Object.freeze([{frequency:320,duration:.075,type:'triangle',volume:.038}]),
  GOOD:Object.freeze([{frequency:460,duration:.085,type:'triangle',volume:.04}]),
  GREAT:Object.freeze([
    {frequency:600,duration:.08,type:'sine',volume:.04},
    {frequency:780,duration:.075,type:'sine',delay:.045,volume:.034}
  ]),
  PERFECT:Object.freeze([
    {frequency:760,duration:.08,type:'sine',volume:.042},
    {frequency:1020,duration:.08,type:'sine',delay:.04,volume:.037},
    {frequency:1320,duration:.1,type:'sine',delay:.08,volume:.032}
  ]),
  DOUBLE_HIT:Object.freeze([
    {frequency:1120,duration:.07,type:'sine',delay:.11,volume:.028},
    {frequency:1480,duration:.09,type:'sine',delay:.15,volume:.024}
  ]),
  RESULT:Object.freeze([
    {frequency:330,duration:.12,type:'sine',volume:.035},
    {frequency:494,duration:.12,type:'sine',delay:.075,volume:.03}
  ])
});

const JUDGEMENT_CUES=Object.freeze({
  PERFECT:'PERFECT',
  GREAT:'GREAT',
  GOOD:'GOOD',
  HIT:'HIT'
});

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

export function tone(frequency,duration=.08,type='sine',delay=0,volume=.045){
  try{
    if(!soundEnabled||!audioContext||!masterGain||audioContext.state==='closed')return false;
    const oscillator=audioContext.createOscillator();
    const gain=audioContext.createGain();
    const startTime=audioContext.currentTime+Math.max(0,delay);
    const stopTime=startTime+Math.max(.01,duration);
    oscillator.type=type;
    oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(Math.max(.0001,volume),startTime);
    gain.gain.exponentialRampToValueAtTime(.0001,stopTime);
    oscillator.connect(gain).connect(masterGain);
    oscillator.start(startTime);
    oscillator.stop(stopTime);
    return true;
  }catch{return false}
}

export function playCue(name){
  const notes=SOUND_CUES[name];
  if(!notes||!soundEnabled||!audioContext||!masterGain)return false;
  let played=false;
  for(const note of notes){
    played=tone(note.frequency,note.duration,note.type,note.delay??0,note.volume??.045)||played;
  }
  return played;
}

export function playHitSound({judgement='HIT',reflections=0}={}){
  const played=playCue(JUDGEMENT_CUES[judgement]??'HIT');
  if(reflections>=2)playCue('DOUBLE_HIT');
  return played;
}
