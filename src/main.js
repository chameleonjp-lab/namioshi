import {World} from './game/world.js';
import {shouldFinishPlay} from './game/session.js';
import {clientToLogical,createViewport} from './game/viewport.js';
import {GAME_MODE,modePresentation,normalizeGameMode,rankingPolicy} from './game/modes.js';
import {WebGLView} from './render/webgl.js';
import {CanvasView} from './render/canvas.js';
import {share,shareText} from './services/share.js';
import {isSoundEnabled,playCue,playHitSound,setAudioActive,setSoundEnabled,wake} from './core/audio.js';

const app=document.querySelector('#app');
app.innerHTML=`
<canvas id="game"></canvas>
<div id="hud" class="hud">
  <div class="pill"><span id="modeHud">公式</span></div>
  <div class="pill">スコア <span id="s">0</span></div>
  <div class="pill">残り <span id="tm">30.0</span></div>
  <div class="pill">タップ <span id="tp">0</span>/6</div>
</div>
<div id="playLegend" class="playLegend" aria-live="polite">
  <span><b>反射板</b>：棒に波を当てると、波の向きが変わります</span>
  <span>得点　直接20 ／ 壁100 ／ 反射板180 ／ 2回反射300</span>
</div>
<div id="guideOverlay" class="guideOverlay" role="dialog" aria-labelledby="guideTitle" aria-describedby="guideText">
  <h2 id="guideTitle">初回案内</h2>
  <p id="guideText">今は時間制限がありません。画面をタップして波を出し、光る反射板（棒）へ当ててみてください。反射板に触れると、波の向きが変わり、直接当てるより高得点になります。</p>
  <div class="guideButtons">
    <button id="guideContinue" class="btn">案内を終えて本番へ</button>
    <button id="guideHome" class="btn secondary">ホームへ戻る</button>
  </div>
</div>
<section id="HOME" class="screen freshStart show">
  <div class="panel">
    <h1>namioshi</h1>
    <p>暗い水面に波を押し出し、壁や反射板で反射させて3つのビーコンへ波の線を重ねる30秒ゲームです。</p>
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
    <button id="soundToggle" class="btn secondary" type="button" aria-pressed="false">効果音：なし</button>
    <p id="soundStatus" class="small">効果音は初期設定で「なし」です。</p>
    <button id="rule" class="btn secondary">ルールを見る</button>
    <button id="homeShare" class="btn secondary">シェア</button>
    <p id="homeShareStatus" class="small"></p>
    <textarea id="homeShareText" class="shareText" readonly></textarea>
    <a class="link" href="https://chameleonjp.codeberg.page/" target="_blank" rel="noreferrer">実験場リンク</a>
    <p id="msg" class="small warn" aria-live="polite"></p>
  </div>
</section>
<section id="RULES" class="screen freshStart">
  <div class="panel">
    <h1 class="sectionTitle">RULES</h1>
    <ul class="rulesList">
      <li>タップは最大6回</li>
      <li>制限時間は30秒</li>
      <li>棒の反射板に波を当てると、波の向きが変わる</li>
      <li>波を3つのビーコンへ重ねる</li>
      <li>直接より、壁・反射板・2回反射の順に高得点</li>
      <li>公式は候補Cの固定配置</li>
      <li>練習はランダム配置でランキング送信なし</li>
    </ul>
    <button id="closeRules" class="btn secondary">閉じる</button>
  </div>
</section>
<section id="COUNTDOWN" class="screen freshStart">
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
    <div class="breakdown" aria-label="得点内訳">
      <p>直接 <b id="scoreDirect">0</b>点</p>
      <p>壁反射 <b id="scoreWall">0</b>点</p>
      <p>反射板 <b id="scoreGlass">0</b>点</p>
      <p>2回反射 <b id="scoreDouble">0</b>点</p>
    </div>
    <p id="rank" class="small" aria-live="polite"></p>
    <button id="share" class="btn">シェア</button>
    <button id="again" class="btn secondary">同じモードでもう一度</button>
    <button id="changeMode" class="btn secondary">モードを選び直す</button>
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
let tutorialMode=false;
let guideCompletedInMemory=false;

const GUIDE_STORAGE_KEY='namioshi.guide.completed';

function hasCompletedGuide(){
  if(guideCompletedInMemory)return true;
  try{return localStorage.getItem(GUIDE_STORAGE_KEY)==='yes'}catch{return false}
}

function markGuideCompleted(){
  guideCompletedInMemory=true;
  try{localStorage.setItem(GUIDE_STORAGE_KEY,'yes')}catch{}
}

function setState(nextState){
  state=nextState;
  for(const screen of ['HOME','RULES','COUNTDOWN','PLAYING','RESULT','ERROR']){
    $(screen)?.classList?.toggle('show',screen===nextState);
  }
  $('hud').classList.toggle('show',nextState==='PLAYING');
  $('playLegend').classList.toggle('show',nextState==='PLAYING');
  $('guideOverlay').classList.toggle('show',nextState==='PLAYING'&&tutorialMode);
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
      const audioReady=wake();
      if(state!=='PLAYING')return;
      const point=clientToLogical(event.clientX,event.clientY,canvas.getBoundingClientRect(),viewport);
      if(point&&world.tap(point.x,point.y)){
        void audioReady.then(ready=>{if(ready&&state==='PLAYING')playCue('TAP')});
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
  void wake();
  if(!hasCompletedGuide())startGuide();
  else beginCountdown();
}

function updateSoundControl(){
  const enabled=isSoundEnabled();
  $('soundToggle').textContent=`効果音：${enabled?'あり':'なし'}`;
  $('soundToggle').setAttribute('aria-pressed',String(enabled));
  $('soundStatus').textContent=enabled?'効果音を使います。設定はこの端末に保存されます。':'効果音は鳴りません。必要なときだけ「あり」に変更できます。';
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

function startGuide(){
  clearCountdown();
  tutorialMode=true;
  world.reset({mode:selectedMode});
  world.time=Number.POSITIVE_INFINITY;
  const presentation=modePresentation(world.mode);
  $('modeHud').textContent=presentation.label+'・案内';
  lastHudScore=-1;
  lastHudTaps=-1;
  lastHudTime=-1;
  setState('PLAYING');
  hud(true);
}

function leaveGuide(startGame){
  if(state!=='PLAYING'||!tutorialMode)return;
  markGuideCompleted();
  tutorialMode=false;
  if(startGame)beginCountdown();
  else setState('HOME');
}

function play(){
  clearCountdown();
  tutorialMode=false;
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
  const breakdown=world.getScoreBreakdown();
  $('scoreDirect').textContent=String(breakdown.direct);
  $('scoreWall').textContent=String(breakdown.wall);
  $('scoreGlass').textContent=String(breakdown.glass);
  $('scoreDouble').textContent=String(breakdown.double);
  $('rank').textContent=policy.statusText;
  $('resultShareStatus').textContent='';
  $('shareText').style.display='none';
  playCue('RESULT');
}

function hud(force=false){
  const time=Number.isFinite(world.time)?Math.max(0,world.time):Number.POSITIVE_INFINITY;
  if(force||world.score!==lastHudScore){
    $('s').textContent=String(world.score);
    lastHudScore=world.score;
  }
  if(force||world.taps!==lastHudTaps){
    $('tp').textContent=String(world.taps);
    lastHudTaps=world.taps;
  }
  if(force||time!==lastHudTime&&(time===Infinity||Math.abs(time-lastHudTime)>=.1)){
    $('tm').textContent=time===Infinity?'∞':time.toFixed(1);
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
    world.step(dt,{countTime:!tutorialMode});
    const time=Number.isFinite(world.time)?Math.max(0,world.time):Number.POSITIVE_INFINITY;
    if(world.score!==lastHudScore||world.taps!==lastHudTaps||time!==lastHudTime&&Math.abs(time-lastHudTime)>=.1)hud();
    if(!tutorialMode&&shouldFinishPlay(world.time))finish();
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

function returnToModeSelection(){
  if(state!=='RESULT')return;
  clearCountdown();
  $('resultShareStatus').textContent='';
  $('shareText').value='';
  $('shareText').style.display='none';
  setState('HOME');
}

function syncAudioVisibility(){
  void setAudioActive(!document.hidden);
}

world.onReflect=reflection=>playCue(reflection.kind==='glass'?'GLASS_REFLECT':'WALL_REFLECT');
world.onHit=hit=>playHitSound(hit);
$('soundToggle').onclick=()=>{
  const enabled=setSoundEnabled(!isSoundEnabled());
  updateSoundControl();
  if(enabled)void wake().then(ready=>{if(ready)playCue('ENABLE')});
};
$('startOfficial').onclick=()=>start(GAME_MODE.OFFICIAL);
$('startPractice').onclick=()=>start(GAME_MODE.PRACTICE);
$('rule').onclick=()=>{if(state==='HOME')setState('RULES')};
$('closeRules').onclick=()=>setState('HOME');
$('again').onclick=()=>{if(state==='RESULT')beginCountdown()};
$('changeMode').onclick=returnToModeSelection;
$('guideContinue').onclick=()=>leaveGuide(true);
$('guideHome').onclick=()=>leaveGuide(false);
$('share').onclick=()=>doShare(world.score,'resultShareStatus','shareText');
$('homeShare').onclick=()=>doShare(0,'homeShareStatus','homeShareText');
document.addEventListener('gesturestart',event=>event.preventDefault());
document.addEventListener('visibilitychange',syncAudioVisibility);
addEventListener('pagehide',()=>{void setAudioActive(false)});
addEventListener('pageshow',syncAudioVisibility);
syncAudioVisibility();
updateSoundControl();
boot();
