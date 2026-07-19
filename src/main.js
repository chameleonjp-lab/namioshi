import {MAX_TAPS} from './config.js';
import {World} from './game/world.js';
import {clientToLogical,createViewport} from './game/viewport.js';
import {GAME_MODE,modePresentation,normalizeGameMode,rankingPolicy} from './game/modes.js';
import {WebGLView} from './render/webgl.js';
import {CanvasView} from './render/canvas.js';
import {share,shareText} from './services/share.js';
import {tone,wake} from './core/audio.js';

const app=document.querySelector('#app');
app.innerHTML=`
<canvas id="game"></canvas>
<div id="hud" class="hud">
  <div class="pill"><span id="modeHud">公式</span></div>
  <div class="pill">スコア <span id="s">0</span></div>
  <div class="pill">残り <span id="tm">10.0</span></div>
  <div class="pill">タップ <span id="tp">0</span>/3</div>
</div>
<section id="HOME" class="screen show">
  <div class="panel">
    <h1>namioshi</h1>
    <p>暗い水面に波を押し出し、壁やガラス片で反射させて3つのビーコンへ波の線を重ねる10秒ゲーム。</p>
    <input id="name" class="input" maxlength="20" placeholder="名前">
    <div class="modeGrid" role="group" aria-label="ゲームモード">
      <div class="modeCard officialCard">
        <p class="modeTitle">公式モード</p>
        <p class="modeDescription">候補C・開港型。全員が同じ配置で遊びます。</p>
        <button id="startOfficial" class="btn">公式モード開始</button>
        <p class="small">ランキング送信はPhase 5で開始します。</p>
      </div>
      <div class="modeCard">
        <p class="modeTitle">練習モード</p>
        <p class="modeDescription">毎回変わるランダム配置で遊びます。</p>
        <button id="startPractice" class="btn secondary">練習モード開始</button>
        <p class="small">練習結果はランキングへ送信しません。</p>
      </div>
    </div>
    <button id="rule" class="btn secondary">ルールを見る</button>
    <button id="homeShare" class="btn secondary">シェア</button>
    <p id="homeShareStatus" class="small"></p>
    <textarea id="homeShareText" class="shareText" readonly></textarea>
    <a class="link" href="https://chameleonjp.codeberg.page/" target="_blank" rel="noreferrer">実験場リンク</a>
    <p id="msg" class="small warn" aria-live="polite"></p>
  </div>
</section>
<section id="RULES" class="screen">
  <div class="panel">
    <h1 class="sectionTitle">RULES</h1>
    <ul class="rulesList">
      <li>タップは最大3回</li>
      <li>制限時間は10秒</li>
      <li>波を壁やガラス片で反射させる</li>
      <li>波を3つのビーコンへ重ねる</li>
      <li>公式は候補Cの固定配置</li>
      <li>練習はランダム配置でランキング送信なし</li>
    </ul>
    <button id="closeRules" class="btn secondary">閉じる</button>
  </div>
</section>
<section id="COUNTDOWN" class="screen">
  <div>
    <p id="countdownMode" class="countdownMode">公式モード</p>
    <div id="countdownText">3</div>
  </div>
</section>
<section id="RESULT" class="screen">
  <div class="panel">
    <h1 id="resultTitle" class="sectionTitle">公式結果</h1>
    <p id="resultMode" class="modeResult"></p>
    <p><b id="fs">0</b> 点</p>
    <p id="rank" class="small" aria-live="polite"></p>
    <button id="share" class="btn">シェア</button>
    <button id="again" class="btn secondary">同じモードでもう一度</button>
    <p id="resultShareStatus" class="small"></p>
    <textarea id="shareText" class="shareText" readonly></textarea>
  </div>
</section>
<section id="ERROR" class="screen">
  <div class="panel">
    <h1>ERROR</h1>
    <p id="err" class="warn"></p>
  </div>
</section>`;

const $=id=>document.getElementById(id);
let state='HOME';
let quality='MID';
let player='';
let selectedMode=GAME_MODE.OFFICIAL;
const world=new World();
const canvas=$('game');
let view;
let last=0;
let frames=[];
let viewport=createViewport(1,1);
let lastHudScore=-1;
let lastHudTaps=-1;
let lastHudTime=-1;
let countdownTimer=0;
let countdownId=0;

function setState(nextState){
  state=nextState;
  for(const screen of ['HOME','RULES','COUNTDOWN','PLAYING','RESULT','ERROR']){
    $(screen)?.classList?.toggle('show',screen===nextState);
  }
  $('hud').classList.toggle('show',nextState==='PLAYING');
  const busy=nextState==='COUNTDOWN';
  $('startOfficial').disabled=busy;
  $('startPractice').disabled=busy;
  $('again').disabled=busy;
}

function clearCountdown(){
  countdownId++;
  if(countdownTimer){
    clearTimeout(countdownTimer);
    countdownTimer=0;
  }
}

function resize(){
  const rect=canvas.getBoundingClientRect();
  const width=Math.max(1,rect.width||innerWidth||1);
  const height=Math.max(1,rect.height||innerHeight||1);
  viewport=createViewport(width,height);
  view?.resize(width,height,quality,viewport);
}

function boot(){
  try{
    try{view=new WebGLView(canvas)}catch{view=new CanvasView(canvas)}
    resize();
    addEventListener('resize',resize);
    canvas.addEventListener('pointerdown',event=>{
      if(!event.isPrimary)return;
      event.preventDefault();
      wake();
      if(state!=='PLAYING')return;
      const point=clientToLogical(event.clientX,event.clientY,canvas.getBoundingClientRect(),viewport);
      if(point&&world.tap(point.x,point.y)){
        tone(180,.07,'triangle');
        hud();
      }
    },{passive:false});
    canvas.addEventListener('pointercancel',event=>{
      if(event.isPrimary)event.preventDefault();
    },{passive:false});
    requestAnimationFrame(loop);
  }catch(error){
    clearCountdown();
    $('err').textContent='初期化に失敗しました: '+error.message;
    setState('ERROR');
  }
}

function start(mode){
  if(state==='COUNTDOWN'||state==='PLAYING')return;
  selectedMode=normalizeGameMode(mode);
  player=$('name').value.trim();
  if(!player){
    $('msg').textContent='名前を入力してください';
    return;
  }
  $('msg').textContent='';
  $('name').blur();
  beginCountdown();
}

function beginCountdown(){
  if(state==='COUNTDOWN')return;
  clearCountdown();
  const id=++countdownId;
  const sequence=[['3',600],['2',600],['1',600],['START',400]];
  let index=0;
  const presentation=modePresentation(selectedMode);
  $('countdownMode').textContent=presentation.label+'モード';
  setState('COUNTDOWN');
  const tick=()=>{
    if(id!==countdownId)return;
    const item=sequence[index];
    if(!item){
      play();
      return;
    }
    $('countdownText').textContent=item[0];
    countdownTimer=setTimeout(()=>{
      index++;
      tick();
    },item[1]);
  };
  tick();
}

function play(){
  clearCountdown();
  world.reset({mode:selectedMode});
  const presentation=modePresentation(world.mode);
  $('modeHud').textContent=presentation.label;
  lastHudScore=-1;
  lastHudTaps=-1;
  lastHudTime=-1;
  setState('PLAYING');
  hud(true);
}

function finish(){
  if(state!=='PLAYING')return;
  clearCountdown();
  const presentation=modePresentation(world.mode);
  const policy=rankingPolicy(world.mode);
  setState('RESULT');
  $('resultTitle').textContent=presentation.resultTitle;
  $('resultMode').textContent=`${presentation.description} 配置ID: ${world.layoutId}`;
  $('fs').textContent=String(world.score);
  $('rank').textContent=policy.statusText;
  $('resultShareStatus').textContent='';
  $('shareText').style.display='none';
  tone(330,.12);
}

function hud(force=false){
  const time=Math.max(0,world.time);
  if(force||world.score!==lastHudScore){
    $('s').textContent=String(world.score);
    lastHudScore=world.score;
  }
  if(force||world.taps!==lastHudTaps){
    $('tp').textContent=String(world.taps);
    lastHudTaps=world.taps;
  }
  if(force||Math.abs(time-lastHudTime)>=.1){
    $('tm').textContent=time.toFixed(1);
    lastHudTime=time;
  }
}

function degrade(average){
  const old=quality;
  if(average<32)quality='LOW';
  else if(average<45)quality=quality==='HIGH'?'MID':quality==='MID'?'LOW':'LOW';
  if(old!==quality)resize();
}

function loop(timestamp){
  const dt=Math.min(.033,(timestamp-last)/1000||0);
  last=timestamp;
  if(state==='PLAYING'){
    world.step(dt);
    if(world.score!==lastHudScore||world.taps!==lastHudTaps||Math.abs(Math.max(0,world.time)-lastHudTime)>=.1)hud();
    if(world.time<=0||(world.taps>=MAX_TAPS&&world.waves.length===0))finish();
  }
  view?.render(world,timestamp,quality);
  frames.push(1/dt);
  if(frames.length>90){
    degrade(frames.reduce((sum,value)=>sum+value,0)/frames.length);
    frames=[];
  }
  requestAnimationFrame(loop);
}

async function doShare(score,statusId,textId){
  const status=$(statusId);
  const textarea=$(textId);
  status.textContent='';
  textarea.style.display='none';
  try{
    status.textContent=await share(score);
  }catch{
    textarea.style.display='block';
    textarea.value=shareText(score);
    textarea.focus();
    textarea.select();
    status.textContent='共有できないため、手動でコピーしてください';
  }
}

world.onHit=()=>tone(620,.09,'sine');
$('startOfficial').onclick=()=>start(GAME_MODE.OFFICIAL);
$('startPractice').onclick=()=>start(GAME_MODE.PRACTICE);
$('rule').onclick=()=>{if(state==='HOME')setState('RULES')};
$('closeRules').onclick=()=>setState('HOME');
$('again').onclick=()=>{if(state==='RESULT')beginCountdown()};
$('share').onclick=()=>doShare(world.score,'resultShareStatus','shareText');
$('homeShare').onclick=()=>doShare(0,'homeShareStatus','homeShareText');
document.addEventListener('gesturestart',event=>event.preventDefault());
boot();
