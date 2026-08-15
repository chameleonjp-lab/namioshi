export const SOUND_STORAGE_KEY='namioshi.settings.sound';

export const SOUND_CUES=Object.freeze({
  ENABLE:Object.freeze([{frequency:440,duration:.06,type:'sine',volume:.035}]),
  TAP:Object.freeze([{frequency:180,duration:.07,type:'triangle',volume:.04}]),
  // Low, short layered tones make the optional cues read as water without
  // requiring a downloaded audio asset. They are intentionally quieter than
  // judgement cues so the action remains understandable when several events
  // settle close together.
  WATER_TAP:Object.freeze([
    {frequency:145,duration:.09,type:'sine',volume:.018},
    {frequency:290,duration:.055,type:'triangle',delay:.03,volume:.012}
  ]),
  WALL_REFLECT:Object.freeze([{frequency:260,duration:.055,type:'triangle',volume:.028}]),
  WATER_WALL:Object.freeze([
    {frequency:210,duration:.07,type:'triangle',volume:.014},
    {frequency:140,duration:.09,type:'sine',delay:.035,volume:.01}
  ]),
  GLASS_REFLECT:Object.freeze([
    {frequency:520,duration:.07,type:'sine',volume:.026},
    {frequency:720,duration:.06,type:'sine',delay:.035,volume:.022}
  ]),
  WATER_GLASS:Object.freeze([
    {frequency:390,duration:.06,type:'sine',volume:.014},
    {frequency:260,duration:.08,type:'sine',delay:.04,volume:.011}
  ]),
  HIT:Object.freeze([{frequency:320,duration:.075,type:'triangle',volume:.038}]),
  WATER_SPLASH:Object.freeze([
    {frequency:95,duration:.08,type:'triangle',volume:.02},
    {frequency:250,duration:.05,type:'sine',delay:.02,volume:.015}
  ]),
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
  ]),
  WATER_SCORE:Object.freeze([
    {frequency:280,duration:.1,type:'sine',volume:.016},
    {frequency:420,duration:.1,type:'sine',delay:.06,volume:.014}
  ]),
  WATER_RIPPLE:Object.freeze([
    {frequency:230,duration:.07,type:'sine',volume:.016},
    {frequency:460,duration:.08,type:'triangle',delay:.035,volume:.012}
  ]),
  WATER_SETTLE:Object.freeze([
    {frequency:180,duration:.12,type:'sine',volume:.012},
    {frequency:270,duration:.12,type:'sine',delay:.08,volume:.01}
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
let audioActive=true;
const activeOscillators=new Set();

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
  masterGain.gain.value=0;
  masterGain.connect(audioContext.destination);
  return audioContext;
}

function setMasterVolume(value){
  if(!audioContext||!masterGain)return;
  try{masterGain.gain.setValueAtTime(value,audioContext.currentTime)}catch{}
}

function stopActiveOscillators(){
  for(const oscillator of activeOscillators){
    try{oscillator.stop()}catch{}
  }
  activeOscillators.clear();
}

async function suspendContext(){
  stopActiveOscillators();
  setMasterVolume(0);
  try{
    if(audioContext?.state==='running'&&typeof audioContext.suspend==='function')await audioContext.suspend();
    return true;
  }catch{return false}
}

async function resumeContext(context){
  try{
    if(context.state!=='running'&&context.state!=='closed')await context.resume();
    return context.state==='running';
  }catch{return false}
}

function isPlaybackReady(){
  return soundEnabled&&audioActive&&audioContext?.state==='running'&&masterGain!==null;
}

export function isSoundEnabled(){
  return soundEnabled;
}

export function setSoundEnabled(enabled){
  soundEnabled=enabled===true;
  saveSetting();
  if(!soundEnabled)void suspendContext();
  return soundEnabled;
}

export async function wake(){
  try{
    if(!soundEnabled||!audioActive)return false;
    const context=createAudioContext();
    if(!context||!masterGain)return false;
    const resumed=await resumeContext(context);
    if(!resumed||!soundEnabled||!audioActive){
      if(!soundEnabled||!audioActive)await suspendContext();
      return false;
    }
    setMasterVolume(1);
    return true;
  }catch{return false}
}

export async function setAudioActive(active){
  audioActive=active===true;
  if(!audioActive)return suspendContext();
  if(!soundEnabled||!audioContext)return false;
  return wake();
}

export function tone(frequency,duration=.08,type='sine',delay=0,volume=.045){
  let oscillator=null;
  try{
    if(!isPlaybackReady())return false;
    oscillator=audioContext.createOscillator();
    const gain=audioContext.createGain();
    const startTime=audioContext.currentTime+Math.max(0,delay);
    const stopTime=startTime+Math.max(.01,duration);
    oscillator.type=type;
    oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(Math.max(.0001,volume),startTime);
    gain.gain.exponentialRampToValueAtTime(.0001,stopTime);
    oscillator.connect(gain).connect(masterGain);
    const forget=()=>activeOscillators.delete(oscillator);
    if(typeof oscillator.addEventListener==='function')oscillator.addEventListener('ended',forget,{once:true});
    else oscillator.onended=forget;
    activeOscillators.add(oscillator);
    oscillator.start(startTime);
    oscillator.stop(stopTime);
    return true;
  }catch{
    if(oscillator){
      activeOscillators.delete(oscillator);
      try{oscillator.stop()}catch{}
    }
    return false;
  }
}

export function playCue(name){
  const notes=SOUND_CUES[name];
  if(!notes||!isPlaybackReady())return false;
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
