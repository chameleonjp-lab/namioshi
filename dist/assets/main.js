import {World} from './game/world.js';
import {judgementFromPrecision} from './game/judgement.js';
import {advancePlayFrame,createPlayDeadline,FixedStepRunner,remainingPlaySeconds,settlePlayDeadline,shouldFinishWhenIdle,TimedInputQueue} from './game/session.js';
import {clientToLogical,createViewport} from './game/viewport.js';
import {GAME_MODE,modePresentation,normalizeGameMode,rankingPolicy} from './game/modes.js';
import {MAX_TAPS,OFFICIAL_RULE_VERSION,PLAY_SECONDS,REFLECTED_WAVE_LIFETIME,WAVE_LIFETIME} from './config.js';
import {WebGLView} from './render/webgl.js';
import {CanvasView} from './render/canvas.js';
import {share,shareText} from './services/share.js';
import {readPlayerState,recordPlayResult,saveDisplayName} from './services/local-progress.js';
import {isSoundEnabled,playCue,playHitSound,setAudioActive,setSoundEnabled,wake} from './core/audio.js';
import {isHapticsEnabled,isHapticsSupported,playHaptic,playHitHaptic,setHapticsActive,setHapticsEnabled} from './core/haptics.js';
const app=document.querySelector('#app');
app.innerHTML=`
<canvas id="game" role="img" aria-label="ゲーム盤面。プレイ中は画面をタップして波を出します。キーボード操作には対応していません。"></canvas>
<div id="hud" class="hud" role="group" aria-label="プレイ情報" aria-live="off">
  <div class="pill"><span id="modeHud">公式</span></div>
  <div class="pill">スコア <span id="s">0</span></div>
  <div class="pill">残り <span id="tm">30.0</span></div>
  <div class="pill">タップ <span id="tp">0</span>/${MAX_TAPS}</div>
  <div class="pill">反射 <span id="rf">0</span>回</div>
</div>
<div id="hitFeedback" class="hitFeedback" role="status" aria-live="polite" aria-atomic="true"></div>
<button id="playLegendToggle" class="playLegendToggle secondary" type="button" aria-controls="playLegend" aria-expanded="false">説明を表示</button>
<div id="playLegend" class="playLegend" role="note" aria-label="プレイ中の目的と見方">
  <div id="playStatus" class="playStatus" role="status" aria-live="polite" aria-atomic="true">目的：波をビーコンに重ねる。反射板経由は高得点、反射した水面波のタップは技能ボーナスです。</div>
  <div id="reflectionTapPrompt" class="reflectionTapPrompt" role="status" aria-live="polite" aria-atomic="true" hidden>反射した水面波に重ねてタップ：技能ボーナス +10〜40点（反射回数で増加・根波ごとに1回）</div>
  <div class="legendLine"><span class="legendMark legendWave" aria-hidden="true"></span><span><b>波</b>：タップ位置から広がり、ビーコンに重ねます</span></div>
  <div class="legendLine"><span class="legendMark legendBoard" aria-hidden="true"></span><span><b>反射板</b>：光る線に当てると波の向きが変わります</span></div>
  <div class="legendLine"><span class="legendMark legendBeacon" aria-hidden="true"></span><span><b>ビーコン</b>：白く光る点。波が重なると命中し、精算時に得点が確定します</span></div>
  <div class="legendLine"><span class="legendMark legendTap" aria-hidden="true"></span><span><b>水面波タップ</b>：反射したリアルな水面波に重ねてタップすると、反射回数に応じて+10〜40点（根波ごとに1回）</span></div>
  <div class="legendLine"><span class="legendMark legendWave" aria-hidden="true"></span><span><b>波の寿命</b>：通常の波は約${WAVE_LIFETIME}秒、反射した水面波は最大${REFLECTED_WAVE_LIFETIME}秒表示され、技能ボーナスのタップ対象です。加点と反射処理は約${WAVE_LIFETIME}秒以内です。タップしても、出ている波は消えません</span></div>
</div>
<div id="guideOverlay" class="guideOverlay" role="dialog" aria-modal="true" aria-labelledby="guideTitle" aria-describedby="guideText" aria-hidden="true">
  <h2 id="guideTitle">初回案内</h2>
  <p id="guideText">今は時間制限がありません。画面をタップして波を出し、光る反射板（線）へ当てて波の向きを変えてみてください。白いビーコン（点）へ波を重ねると得点です。反射したリアルな水面波をタップすると、小さな技能ボーナスを得られます。説明を確認したら、画面のどこかをタップしてカウントダウンへ進みます。</p>
  <p id="guideStatus" class="guideStatus" role="status" aria-live="polite">説明を確認したら画面をタップしてください。下のボタンから進むこともできます。</p>
  <div class="guideButtons">
    <button id="guideContinue" class="btn" type="button">案内を終えて本番へ</button>
    <button id="guideHome" class="btn secondary" type="button">ホームへ戻る</button>
  </div>
</div>
<section id="HOME" class="screen freshStart show" aria-labelledby="homeTitle" aria-hidden="false">
  <div class="panel">
    <h1 id="homeTitle">namioshi</h1>
    <p>${MAX_TAPS}回のタップで波を押し出し、壁や反射板を使って3つのビーコンへの異なる経路を探すゲームです。最大${PLAY_SECONDS}秒、${MAX_TAPS}回を使い切り、入力と波の精算が終わると結果へ進みます。反射した水面波をタップすると技能ボーナス、同じ経路は最高点だけが残ります。</p>
    <label class="srOnly" for="name">名前</label>
    <input id="name" class="input" maxlength="20" placeholder="名前" autocomplete="nickname" aria-describedby="nameHint">
    <p id="nameHint" class="srOnly">公式結果と練習結果の表示に使います。</p>
    <div class="modeGrid" role="group" aria-label="ゲームモード">
      <div class="modeCard officialCard">
        <p class="modeTitle">公式モード</p>
        <p class="modeDescription">最大${PLAY_SECONDS}秒・${MAX_TAPS}タップ。全員が同じ配置で遊びます。</p>
        <button id="startOfficial" class="btn" type="button">公式モード開始</button>
        <p class="small">ランキング送信はPhase 5で開始します。</p>
      </div>
      <div class="modeCard">
        <p class="modeTitle">練習モード</p>
        <p class="modeDescription">最大${PLAY_SECONDS}秒・${MAX_TAPS}タップ。毎回変わる配置で反射経路を練習します。</p>
        <button id="startPractice" class="btn secondary" type="button">練習モード開始</button>
        <p class="small">ランキング外。練習結果は送信しません。</p>
      </div>
    </div>
    <button id="soundToggle" class="btn secondary" type="button" aria-pressed="false">効果音：なし</button>
    <p id="soundStatus" class="small" role="status" aria-live="polite">効果音は初期設定で「なし」です。</p>
    <button id="hapticsToggle" class="btn secondary" type="button" aria-pressed="false">振動：なし</button>
    <p id="hapticsStatus" class="small" role="status" aria-live="polite">振動は初期設定で「なし」です。</p>
    <button id="rule" class="btn secondary" type="button">ルールを見る</button>
    <button id="homeShare" class="btn secondary" type="button">シェア</button>
    <p id="homeShareStatus" class="small" role="status" aria-live="polite"></p>
    <textarea id="homeShareText" class="shareText" aria-label="ホーム画面のシェア文" readonly></textarea>
    <a class="link" href="https://chameleonjp.codeberg.page/" target="_blank" rel="noreferrer">実験場リンク</a>
    <p id="msg" class="small warn" role="status" aria-live="polite"></p>
  </div>
</section>
<section id="RULES" class="screen freshStart" aria-labelledby="rulesTitle" aria-hidden="true">
  <div class="panel">
    <h1 id="rulesTitle" class="sectionTitle" tabindex="-1">RULES</h1>
    <ul class="rulesList">
      <li>タップは最大${MAX_TAPS}回</li>
      <li>制限時間は最大${PLAY_SECONDS}秒。${MAX_TAPS}回使い切り、入力と波の精算が終わると結果へ進む</li>
      <li>光る線の反射板に波を当てると、波の向きが変わる</li>
      <li>ビーコンに波が重なると命中。反射板に当てるだけでは得点にならない</li>
      <li>直接より、壁・反射板・2回反射の順に高得点</li>
      <li>基準点は直接20点、壁100点、反射板180点、2回反射300点。命中精度で変動する</li>
      <li>反射したリアルな水面波をタイミングよくタップすると、反射1回は10〜20点、反射2回は20〜40点。1つの根波につき1回まで</li>
      <li>1回のタップでは、各ビーコンへの一番高い経路だけを判定</li>
      <li>同じビーコンへ同じ順番で通った経路を繰り返しても、点は増えない</li>
      <li>命中確認は接触時、得点は波の精算時に「得点確定」として表示する</li>
      <li>${MAX_TAPS}回を別の場所へ使い、違う経路を探すほど得点を伸ばせる</li>
      <li>${MAX_TAPS}回使い切った後は、入力と残っている波の精算を待ち、すべて終わると結果へ進む</li>
      <li>公式は候補Cの固定配置</li>
      <li>練習はランダム配置でランキング送信なし</li>
    </ul>
    <button id="closeRules" class="btn secondary" type="button">閉じる</button>
  </div>
</section>
<section id="COUNTDOWN" class="screen freshStart" aria-labelledby="countdownMode" aria-hidden="true">
  <div>
    <p id="countdownMode" class="countdownMode">公式モード</p>
    <div id="countdownText" role="status" aria-live="assertive" aria-atomic="true" tabindex="-1">3</div>
    <p id="countdownHint" class="countdownHint" role="status" aria-live="polite">説明を確認したら画面をタップして開始</p>
  </div>
</section>
<section id="RESULT" class="screen" aria-labelledby="resultTitle" aria-hidden="true">
  <div class="panel">
    <h1 id="resultTitle" class="sectionTitle" tabindex="-1">公式結果</h1>
    <p id="resultMode" class="modeResult"></p>
    <p><span class="srOnly">最終得点：</span><b id="fs">0</b> 点</p>
    <p id="resultBestStatus" class="resultStatus" role="status" aria-live="polite"></p>
    <p id="resultPlayCount" class="resultStatus" role="status" aria-live="polite"></p>
    <div class="breakdown" aria-label="得点内訳">
      <p>直接 <b id="scoreDirect">0</b>点</p>
      <p>壁反射 <b id="scoreWall">0</b>点</p>
      <p>反射板 <b id="scoreGlass">0</b>点</p>
      <p>2回反射 <b id="scoreDouble">0</b>点</p>
      <p>水面波タップ <b id="scoreReflectionTap">0</b>点</p>
    </div>
    <p id="resultReflectionCount" class="resultStatus">波の反射回数：<b>0</b>回</p>
    <p id="resultRouteStatus" class="resultStatus">今回の有効ルート：<b id="routeCount">0</b>件</p>
    <p id="resultBestRoute" class="resultStatus resultHighlight" role="status" aria-live="polite"></p>
    <p id="resultNextGoal" class="resultStatus resultGoal" role="status" aria-live="polite"></p>
    <p id="rank" class="small" role="status" aria-live="polite"></p>
    <button id="share" class="btn" type="button">シェア</button>
    <button id="again" class="btn secondary" type="button">同じモードでもう一度</button>
    <button id="changeMode" class="btn secondary" type="button">モードを選び直す</button>
    <button id="rankingDetails" class="btn secondary" type="button" disabled aria-disabled="true">詳細ランキング（準備中）</button>
    <button id="endGame" class="btn secondary" type="button">ゲーム終了</button>
    <a class="btn secondary btnLink" href="https://chameleonjp.codeberg.page/" target="_blank" rel="noreferrer">実験場へ戻る</a>
    <p id="resultStorageStatus" class="small" role="status" aria-live="polite"></p>
    <p id="resultShareStatus" class="small" role="status" aria-live="polite"></p>
    <p id="resultExitStatus" class="small" role="status" aria-live="polite"></p>
    <textarea id="shareText" class="shareText" aria-label="結果画面のシェア文" readonly></textarea>
  </div>
</section>
<section id="ERROR" class="screen" aria-labelledby="errorTitle" aria-hidden="true">
  <div class="panel">
    <h1 id="errorTitle" tabindex="-1">ERROR</h1>
    <p id="err" class="warn" role="alert"></p>
  </div>
</section>`;

const $=id=>document.getElementById(id);
const storedPlayerState=readPlayerState();
if(storedPlayerState.displayName)$('name').value=storedPlayerState.displayName;
let state='HOME';
let quality='MID';
let player='';
let selectedMode=GAME_MODE.OFFICIAL;
const world=new World();
let canvas=$('game');
let view;
let rendererKind='webgl';
let rendererSuspended=false;
let frames=[];
let viewport=createViewport(1,1);
let lastHudScore=-1;
let lastHudTaps=-1;
let lastHudTime=-1;
let lastPlayStatus='';
let countdownTimer=0;
let countdownId=0;
let countdownWaitingForTap=false;
let countdownExplanationVisible=false;
let tutorialMode=false;
let playLegendOpen=false;
let guideCompletedInMemory=false;
const fixedSteps=new FixedStepRunner();
const timedInputs=new TimedInputQueue();
let playDeadline=null;
let lastRenderTimestamp=null;
let lastStaticRenderTimestamp=null;
let deadlineSettlementActive=false;
let deadlineSettlementTimer=0;
const STATIC_RENDER_INTERVAL=1000/30;
const DEADLINE_SETTLEMENT_FRAMES_PER_CHUNK=60;
let hitFeedbackTimer=0;

const GUIDE_STORAGE_KEY=`namioshi.guide.completed.${OFFICIAL_RULE_VERSION}`;
const STATE_FOCUS_TARGETS=Object.freeze({
  HOME:'name',
  RULES:'closeRules',
  COUNTDOWN:'countdownHint',
  RESULT:'share',
  ERROR:'errorTitle'
});

function hasCompletedGuide(){
  if(guideCompletedInMemory)return true;
  try{return localStorage.getItem(GUIDE_STORAGE_KEY)==='yes'}catch{return false}
}

function markGuideCompleted(){
  guideCompletedInMemory=true;
  try{localStorage.setItem(GUIDE_STORAGE_KEY,'yes')}catch{}
}

function focusStateTarget(nextState){
  const targetId=nextState==='PLAYING'&&tutorialMode
    ?'guideContinue'
    :STATE_FOCUS_TARGETS[nextState];
  if(!targetId)return;
  queueMicrotask(()=>{
    if(state!==nextState||nextState==='PLAYING'&&!tutorialMode)return;
    $(targetId)?.focus?.({preventScroll:true});
  });
}

function setState(nextState){
  if(state!==nextState)lastStaticRenderTimestamp=null;
  state=nextState;
  for(const screen of ['HOME','RULES','COUNTDOWN','PLAYING','RESULT','ERROR']){
    const visible=screen===nextState;
    $(screen)?.classList?.toggle('show',visible);
    $(screen)?.setAttribute?.('aria-hidden',String(!visible));
  }
  $('hud').classList.toggle('show',nextState==='PLAYING');
  if(nextState!=='PLAYING')playLegendOpen=false;
  updatePlayLegend();
  if(nextState!=='PLAYING'){
    $('hitFeedback').classList.remove('show');
    if(hitFeedbackTimer){clearTimeout(hitFeedbackTimer);hitFeedbackTimer=0;}
  }
  const guideVisible=nextState==='PLAYING'&&tutorialMode;
  $('guideOverlay').classList.toggle('show',guideVisible);
  $('guideOverlay').setAttribute('aria-hidden',String(!guideVisible));
  const busy=nextState==='COUNTDOWN';
  $('startOfficial').disabled=busy;
  $('startPractice').disabled=busy;
  $('again').disabled=busy;
  updateReflectionTapPrompt();
  focusStateTarget(nextState);
}

function updatePlayLegend(){
  const countdownVisible=state==='COUNTDOWN'&&countdownExplanationVisible;
  const guideVisible=state==='PLAYING'&&tutorialMode;
  const open=state==='PLAYING'&&!tutorialMode&&playLegendOpen;
  const visible=countdownVisible||guideVisible||open;
  $('playLegend').classList.toggle('show',visible);
  $('playLegend').setAttribute('aria-hidden',String(!visible));
  $('playLegendToggle').classList.toggle('show',state==='PLAYING'&&!tutorialMode);
  $('playLegendToggle').setAttribute('aria-expanded',String(open));
  $('playLegendToggle').textContent=open?'説明を閉じる':'説明を表示';
}

function playStatusText(){
  if(tutorialMode){
    return'案内：反射板に当てて波の向きを変え、白いビーコンへ重ねてみましょう。';
  }
  const pendingDisplayWaves=world.waves.length+(world.waveFades?.length??0);
  if(world.taps>=MAX_TAPS){
    return pendingDisplayWaves>0
      ?`${MAX_TAPS}回使い切りました。入力と波の精算を待っています。通常の波は約${WAVE_LIFETIME}秒、反射した水面波は最大${REFLECTED_WAVE_LIFETIME}秒表示されます（加点と反射処理は約${WAVE_LIFETIME}秒以内）。`
      :`${MAX_TAPS}回使い切り、入力と波の精算が終わりました。結果を表示します。`;
  }
  return`目的：波をビーコンに重ねる。反射した水面波をタップすると、反射回数に応じた技能ボーナスが入ります（現在${world.getReflectionCount()}回反射）。`;
}

function updatePlayStatus(force=false){
  const element=$('playStatus');
  if(!element)return;
  const text=playStatusText();
  if(!force&&text===lastPlayStatus)return;
  element.textContent=text;
  lastPlayStatus=text;
}

function updateReflectionTapPrompt(){
  const prompt=$('reflectionTapPrompt');
  if(!prompt)return;
  const available=state==='PLAYING'&&!tutorialMode&&world.hasAvailableWaterRipple();
  prompt.hidden=!available;
}

function clearCountdown(){
  countdownId++;
  countdownWaitingForTap=false;
  countdownExplanationVisible=false;
  if(countdownTimer){
    clearTimeout(countdownTimer);
    countdownTimer=0;
  }
}

function monotonicNow(){
  return performance.now();
}

function resetPlayClock(){
  cancelDeadlineSettlement();
  const start=monotonicNow();
  fixedSteps.reset(start);
  timedInputs.reset(start);
  playDeadline=tutorialMode?null:createPlayDeadline(start,PLAY_SECONDS);
  deadlineSettlementActive=false;
}

function updatePlayTime(timestamp){
  if(tutorialMode){
    world.time=Number.POSITIVE_INFINITY;
    return;
  }
  world.time=remainingPlaySeconds(playDeadline,timestamp);
}

function applyTimedInput(input){
  world.tap(input.x,input.y,{
    action:input.action??'auto',
    reflectionTarget:input.reflectionTarget??null
  });
}

function shouldFinishIdlePlay(){
  if(!fixedSteps.isCaughtUp())return false;
  return shouldFinishWhenIdle({
    taps:world.taps,
    maximumTaps:MAX_TAPS,
    activeWaves:world.waves.length+(world.waveFades?.length??0),
    pendingInputs:timedInputs.length,
    tutorial:tutorialMode
  });
}

function advanceSimulation(timestamp){
  return advancePlayFrame({
    timestamp,
    deadline:playDeadline,
    tutorial:tutorialMode,
    runner:fixedSteps,
    inputQueue:timedInputs,
    update:(step,{boundaryTimestamp})=>{
      world.step(step,{countTime:false});
      timedInputs.drainThrough(boundaryTimestamp,applyTimedInput);
    }
  });
}

function rememberPlayFrame(playFrame){
  deadlineSettlementActive=Boolean(playFrame?.deadlineExpired&&!playFrame?.caughtUp);
  return playFrame;
}

function cancelDeadlineSettlement(){
  if(deadlineSettlementTimer){
    clearTimeout(deadlineSettlementTimer);
    deadlineSettlementTimer=0;
  }
}

function scheduleDeadlineSettlement(){
  if(deadlineSettlementTimer||state!=='PLAYING'||tutorialMode||!Number.isFinite(playDeadline)||document.hidden)return;
  deadlineSettlementTimer=setTimeout(runDeadlineSettlementChunk,0);
}

function runDeadlineSettlementChunk(){
  deadlineSettlementTimer=0;
  if(state!=='PLAYING'||tutorialMode||!Number.isFinite(playDeadline)||document.hidden)return;
  const playFrame=rememberPlayFrame(settlePlayDeadline({
    deadline:playDeadline,
    runner:fixedSteps,
    inputQueue:timedInputs,
    update:(step,{boundaryTimestamp})=>{
      world.step(step,{countTime:false});
      timedInputs.drainThrough(boundaryTimestamp,applyTimedInput);
    },
    maxFrames:DEADLINE_SETTLEMENT_FRAMES_PER_CHUNK
  }));
  updatePlayTime(monotonicNow());
  if(playFrame.shouldFinish){
    finish();
    return;
  }
  scheduleDeadlineSettlement();
}

function suspendVisiblePlay(now){
  if(state==='PLAYING'&&fixedSteps.lastTimestamp!==null){
    updatePlayTime(now);
    const playFrame=rememberPlayFrame(advanceSimulation(now));
    updatePlayTime(now);
    if(playFrame.shouldFinish||shouldFinishIdlePlay()){
      finish();
      return;
    }
  }
  fixedSteps.suspend(now);
}

function resize(){
  const rect=canvas.getBoundingClientRect();
  const width=Math.max(1,rect.width||innerWidth||1);
  const height=Math.max(1,rect.height||innerHeight||1);
  viewport=createViewport(width,height);
  view?.resize(width,height,quality,viewport);
}

function inputViewport(target){
  const rect=target.getBoundingClientRect();
  const width=Math.max(1,rect.width||innerWidth||1);
  const height=Math.max(1,rect.height||innerHeight||1);
  // Safari can update the canvas box when its browser chrome or orientation
  // changes before the resize event reaches the page. Refresh the same
  // viewport used for drawing before converting this pointer event.
  if(
    Math.abs(width-viewport.viewWidth)>.5||
    Math.abs(height-viewport.viewHeight)>.5
  ){
    viewport=createViewport(width,height);
    view?.resize(width,height,quality,viewport);
  }
  return{rect,viewport};
}

function replaceGameCanvas(){
  const previous=canvas;
  const next=document.createElement('canvas');
  next.id='game';
  next.className=previous.className;
  next.style.cssText=previous.style.cssText;
  for(const name of ['aria-label','role']){
    const value=previous.getAttribute(name);
    if(value!==null)next.setAttribute(name,value);
  }
  previous.replaceWith(next);
  canvas=next;
  return next;
}

function bindCanvasInput(){
  const target=canvas;
  target.addEventListener('pointerdown',event=>{
    if(!event.isPrimary)return;
    event.preventDefault();
    const audioReady=wake();
    if(state!=='PLAYING'||rendererSuspended)return;
    const inputTimestamp=monotonicNow();
    if(playDeadline!==null&&inputTimestamp>=playDeadline){
      timedInputs.closeBefore(playDeadline);
      return;
    }
    const inputLayout=inputViewport(target);
    const point=clientToLogical(event.clientX,event.clientY,inputLayout.rect,inputLayout.viewport);
    const reflectionTarget=point&&world.findWaterRippleTapTarget(point.x,point.y);
    const input={
      x:point?.x,
      y:point?.y,
      timestamp:inputTimestamp,
      action:reflectionTarget?'reflection':'root',
      reflectionTarget:reflectionTarget?{
        waveId:reflectionTarget.wave.id,
        rootTapId:reflectionTarget.rootTapId,
        reflectionDepth:reflectionTarget.reflectionDepth,
        radialError:reflectionTarget.radialError,
        precision:reflectionTarget.precision,
        projectedX:reflectionTarget.projectedX,
        projectedY:reflectionTarget.projectedY,
        rippleEffectId:reflectionTarget.rippleEffect?.id
      }:null
    };
    const pendingReflectionCount=timedInputs.pending.reduce((count,entry)=>
      count+(entry.action==='reflection'?1:0),0);
    const accepted=point&&(reflectionTarget
      ?pendingReflectionCount<MAX_TAPS&&timedInputs.enqueue(input)
      :timedInputs.enqueueWithinLimit(input,{
        accepted:world.taps,
        maximum:MAX_TAPS,
        pendingCount:entry=>entry.action!=='reflection'
      }));
    if(accepted){
      playHaptic('TAP');
      void audioReady.then(ready=>{
        if(ready&&state==='PLAYING'&&!rendererSuspended){
          playCue('TAP');
          playCue('WATER_TAP');
        }
      });
    }
  },{passive:false});
  target.addEventListener('pointercancel',event=>{
    if(event.isPrimary)event.preventDefault();
  },{passive:false});
}

function resumeRendererPause(now){
  if(!rendererSuspended)return;
  rendererSuspended=false;
  if(state!=='PLAYING')return;
  const settlingDeadline=Boolean(
    !tutorialMode&&
    playDeadline!==null&&
    deadlineSettlementActive
  );
  const resumeAt=!tutorialMode&&playDeadline!==null&&now>=playDeadline
    ?playDeadline
    :now;
  // Once deadline settlement has started, the fixed-step origin already
  // belongs to the visible timeline. Do not shift it by the renderer-loss
  // duration when the context comes back.
  const pausedDuration=fixedSteps.resume(resumeAt,{shiftTimeline:!settlingDeadline});
  if(pausedDuration>0&&!settlingDeadline){
    timedInputs.shiftPendingTimestamps(pausedDuration,{
      before:tutorialMode?Number.POSITIVE_INFINITY:playDeadline
    });
  }
  lastRenderTimestamp=now;
  updatePlayTime(now);
}

function suspendForRendererLoss(now){
  if(rendererSuspended)return;
  rendererSuspended=true;
  if(state==='PLAYING')suspendVisiblePlay(now);
  lastRenderTimestamp=null;
  frames=[];
  if(state==='COUNTDOWN'){
    clearCountdown();
    setState('HOME');
  }
}

function switchToCanvas({resume=true}={}){
  const wasSuspended=rendererSuspended;
  replaceGameCanvas();
  view=new CanvasView(canvas);
  rendererKind='canvas';
  bindCanvasInput();
  resize();
  if(resume&&wasSuspended)resumeRendererPause(monotonicNow());
}

function handleWebGLContextLost(event){
  event.preventDefault();
  suspendForRendererLoss(monotonicNow());
}

function handleWebGLContextRestored(){
  if(!(view instanceof WebGLView)||rendererKind!=='webgl')return;
  try{
    view.restore();
    resize();
    resumeRendererPause(monotonicNow());
  }catch{
    switchToCanvas();
  }
}

function bindWebGLRecovery(){
  canvas.addEventListener('webglcontextlost',handleWebGLContextLost,{passive:false});
  canvas.addEventListener('webglcontextrestored',handleWebGLContextRestored);
}

function boot(){
  try{
    try{
      view=new WebGLView(canvas);
      rendererKind='webgl';
      bindWebGLRecovery();
      bindCanvasInput();
    }catch{
      switchToCanvas({resume:false});
    }
    resize();
    addEventListener('resize',resize);
    addEventListener('orientationchange',resize);
    globalThis.visualViewport?.addEventListener('resize',resize);
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
  saveDisplayName(player);
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

function updateHapticsControl(){
  const supported=isHapticsSupported();
  const enabled=isHapticsEnabled();
  const button=$('hapticsToggle');
  button.disabled=!supported;
  button.setAttribute('aria-disabled',String(!supported));
  button.textContent=supported?`振動：${enabled?'あり':'なし'}`:'振動：非対応';
  button.setAttribute('aria-pressed',String(enabled));
  $('hapticsStatus').textContent=supported
    ?enabled?'振動を使います。設定はこの端末に保存されます。':'振動はありません。必要なときだけ「あり」に変更できます。'
    :'この環境は振動に対応していません。ゲームはそのまま遊べます。';
}

function beginCountdown(){
  if(state==='COUNTDOWN')return;
  clearCountdown();
  fixedSteps.suspend();
  countdownWaitingForTap=true;
  countdownExplanationVisible=true;
  const presentation=modePresentation(selectedMode);
  $('countdownMode').textContent=presentation.label+'モード';
  $('countdownText').textContent='タップで開始';
  $('countdownHint').textContent='説明を確認したら画面をタップして開始';
  setState('COUNTDOWN');
  // The first tap only dismisses the explanation. It is never sent to World,
  // so starting a round cannot create an extra wave.
  focusStateTarget('COUNTDOWN');
}

function startCountdownSequence(){
  if(state!=='COUNTDOWN'||!countdownWaitingForTap)return;
  clearCountdown();
  countdownExplanationVisible=false;
  fixedSteps.suspend();
  const id=++countdownId;
  const sequence=[['3',600],['2',600],['1',600],['START',400]];
  let index=0;
  $('countdownHint').textContent='ゲーム開始までお待ちください';
  updatePlayLegend();
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
  resetPlayClock();
  const presentation=modePresentation(world.mode);
  $('modeHud').textContent=presentation.label+'・案内';
  lastHudScore=-1;
  lastHudTaps=-1;
  lastHudTime=-1;
  lastPlayStatus='';
  setState('PLAYING');
  hud(true);
}

function leaveGuide(startGame){
  if(state!=='PLAYING'||!tutorialMode)return;
  if(startGame)markGuideCompleted();
  tutorialMode=false;
  fixedSteps.suspend();
  playDeadline=null;
  if(startGame)beginCountdown();
  else setState('HOME');
}

function play(){
  clearCountdown();
  playLegendOpen=false;
  tutorialMode=false;
  world.reset({mode:selectedMode});
  resetPlayClock();
  const presentation=modePresentation(world.mode);
  $('modeHud').textContent=presentation.label;
  lastHudScore=-1;
  lastHudTaps=-1;
  lastHudTime=-1;
  lastPlayStatus='';
  setState('PLAYING');
  hud(true);
}

function updateResultPersistence(result){
  const official=world.mode===GAME_MODE.OFFICIAL;
  if(!result.saved){
    $('resultBestStatus').textContent=official
      ?'端末ベストは利用できません（この環境では保存できません）。'
      :'練習結果です。公式の端末ベストは更新しません。';
    $('resultPlayCount').textContent='プレイ回数はこの環境では保存できません。';
    $('resultStorageStatus').textContent='この環境では結果を端末に保存できません。結果は画面に表示します。';
    return;
  }
  if(official){
    $('resultBestStatus').textContent=result.isNewBest
      ?`NEW BEST（端末ベスト：${result.bestScore}点）`
      :`端末ベスト：${result.bestScore}点`;
    $('resultPlayCount').textContent=`公式プレイ回数：${result.playCount}回`;
    $('resultStorageStatus').textContent='結果を端末に保存しました。';
  }else{
    $('resultBestStatus').textContent='練習結果です。公式の端末ベストは更新しません。';
    $('resultPlayCount').textContent=`練習プレイ回数：${result.playCount}回`;
    $('resultStorageStatus').textContent='練習結果を端末に保存しました。';
  }
}

const ROUTE_SURFACE_LABELS=Object.freeze({wall:'壁',glass:'反射板'});

function formatRoutePath(route){
  const surfaces=(route?.pathIntersections??[])
    .map(intersection=>String(intersection?.surfaceKey??'').split(':',1)[0])
    .map(surface=>ROUTE_SURFACE_LABELS[surface]??'反射')
    .filter(Boolean);
  return surfaces.length?surfaces.join('→'):'直接';
}

function formatBestRoute(route){
  if(!route)return'最高経路：まだありません';
  return`最高経路：${formatRoutePath(route)}・${judgementFromPrecision(route.precision)}・${route.score}点`;
}

function resultNextGoal(breakdown,routeCount){
  if(routeCount===0)return'次の目標：まずビーコンに1回波を重ねる';
  if(breakdown.glass<=0)return'次の目標：反射板を使う経路を1回成功させる';
  if(breakdown.double<=0)return'次の目標：2回反射を1回成功させる';
  if((breakdown.reflectionTap??0)<=0)return'次の目標：反射した水面波を1回タップしてボーナスを得る';
  return'次の目標：別の経路を探して最高経路を更新する';
}

function finish(){
  if(state!=='PLAYING')return;
  cancelDeadlineSettlement();
  clearCountdown();
  if(playDeadline!==null){
    timedInputs.closeBefore(playDeadline);
    // A visibility pause can shift the next fixed boundary beyond the wall
    // deadline. Apply any still-eligible input at the terminal boundary so an
    // input accepted before 30s is not silently lost. Physics is not advanced.
    timedInputs.drainThrough(playDeadline,applyTimedInput);
  }
  world.finalizePendingHits();
  world.waveFades.length=0;
  timedInputs.clear();
  fixedSteps.suspend();
  playDeadline=null;
  deadlineSettlementActive=false;
  world.time=0;
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
  $('scoreReflectionTap').textContent=String(breakdown.reflectionTap??0);
  $('resultReflectionCount').innerHTML=`波の反射回数：<b>${world.getReflectionCount()}</b>回`;
  const routeCount=world.getDiscoveredRouteCount();
  $('routeCount').textContent=String(routeCount);
  $('resultBestRoute').textContent=formatBestRoute(world.getBestRoute());
  $('resultNextGoal').textContent=resultNextGoal(breakdown,routeCount);
  updateResultPersistence(recordPlayResult({
    mode:world.mode,
    score:world.score,
    displayName:player
  }));
  $('rank').textContent=policy.statusText;
  $('resultShareStatus').textContent='';
  $('resultExitStatus').textContent='';
  $('shareText').style.display='none';
  playCue('RESULT');
  playCue('WATER_SETTLE');
  playHaptic('RESULT');
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
  $('rf').textContent=String(world.getReflectionCount());
  if(force||time!==lastHudTime&&(time===Infinity||Math.abs(time-lastHudTime)>=.1)){
    $('tm').textContent=time===Infinity?'∞':time.toFixed(1);
    lastHudTime=time;
  }
  updatePlayStatus(force);
  updateReflectionTapPrompt();
}

function degrade(average){
  if(state==='PLAYING')return;
  const old=quality;
  if(average<32)quality='LOW';
  else if(average<45)quality=quality==='HIGH'?'MID':quality==='MID'?'LOW':'LOW';
  if(old!==quality)resize();
}

function renderCurrentFrame(now){
  try{
    view?.render(world,now,quality);
  }catch(error){
    if(rendererKind!=='webgl')throw error;
    // A runtime WebGL failure may occur without a usable restored event. A
    // fresh canvas is the only safe way to obtain a 2D context after WebGL
    // has been acquired on the old canvas.
    switchToCanvas();
    view.render(world,now,quality);
  }
}

function settleSuspendedDeadline(now){
  if(state!=='PLAYING'||tutorialMode||playDeadline===null||now<playDeadline)return;
  // Renderer loss suspends the runner by clearing lastTimestamp. Resume at
  // the deadline without shifting the fixed timeline, then drain the
  // accumulated visible backlog against its original boundaries.
  if(fixedSteps.lastTimestamp===null){
    fixedSteps.resume(playDeadline,{shiftTimeline:false});
  }
  updatePlayTime(now);
  const playFrame=rememberPlayFrame(advanceSimulation(playDeadline));
  updatePlayTime(now);
  if(playFrame.shouldFinish)finish();
  else scheduleDeadlineSettlement();
}

function loop(timestamp){
  const now=Number.isFinite(timestamp)?timestamp:monotonicNow();
  const frameSeconds=lastRenderTimestamp===null
    ?0
    :Math.max(0,(now-lastRenderTimestamp)/1000);
  lastRenderTimestamp=now;

  if(document.hidden){
    suspendVisiblePlay(now);
    lastRenderTimestamp=null;
    frames=[];
    requestAnimationFrame(loop);
    return;
  }

  if(rendererSuspended){
    settleSuspendedDeadline(now);
    lastRenderTimestamp=null;
    frames=[];
    requestAnimationFrame(loop);
    return;
  }

  if(state==='PLAYING'){
    updatePlayTime(now);
    const playFrame=rememberPlayFrame(advanceSimulation(now));
    updatePlayTime(now);
    updatePlayStatus();
    const time=Number.isFinite(world.time)?Math.max(0,world.time):Number.POSITIVE_INFINITY;
    if(world.score!==lastHudScore||world.taps!==lastHudTaps||time!==lastHudTime&&Math.abs(time-lastHudTime)>=.1)hud();
    if(playFrame.shouldFinish||shouldFinishIdlePlay())finish();
    else if(playFrame.deadlineExpired)scheduleDeadlineSettlement();
  }
  const shouldRender=state==='PLAYING'||lastStaticRenderTimestamp===null||now-lastStaticRenderTimestamp>=STATIC_RENDER_INTERVAL;
  if(shouldRender){
    renderCurrentFrame(now);
    if(state!=='PLAYING')lastStaticRenderTimestamp=now;
  }
  if(state==='PLAYING'&&frameSeconds>0&&frames.length<90)frames.push(1/frameSeconds);
  if(state!=='PLAYING'&&frames.length>=90){
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
  $('resultExitStatus').textContent='';
  $('shareText').value='';
  $('shareText').style.display='none';
  setState('HOME');
}

function endGame(){
  if(state!=='RESULT')return;
  returnToModeSelection();
  $('msg').textContent='ゲームを終了しました。もう一度遊ぶ場合はモードを選んでください。';
}

function syncAudioVisibility(){
  const now=monotonicNow();
  void setAudioActive(!document.hidden);
  setHapticsActive(!document.hidden);
  if(document.hidden){
    cancelDeadlineSettlement();
    suspendVisiblePlay(now);
    lastRenderTimestamp=null;
    frames=[];
    if(state==='COUNTDOWN'){
      clearCountdown();
      setState('HOME');
    }
    return;
  }

  if(rendererSuspended)return;

  if(state==='PLAYING'&&deadlineSettlementActive){
    fixedSteps.resume(playDeadline,{shiftTimeline:false});
    scheduleDeadlineSettlement();
  }else{
    // If the wall-clock deadline passed while hidden, shift the paused
    // simulation only as far as that deadline. Visible backlog accumulated
    // before suspension still belongs to the round and must be settled.
    const resumeAt=state==='PLAYING'&&!tutorialMode&&now>=playDeadline
      ?playDeadline
      :now;
    const hiddenDuration=fixedSteps.resume(resumeAt);
    if(state==='PLAYING'&&hiddenDuration>0){
      timedInputs.shiftPendingTimestamps(hiddenDuration,{
        before:tutorialMode?Number.POSITIVE_INFINITY:playDeadline
      });
    }
  }
  lastRenderTimestamp=now;
  if(state==='PLAYING')updatePlayTime(now);
}

const HIT_FEEDBACK_LABELS=Object.freeze({
  direct:'直接',
  wall:'壁反射',
  glass:'反射板',
  double:'2回反射'
});

function presentFeedback(text,{status='impact',duration=1100}={}){
  const feedback=$('hitFeedback');
  feedback.dataset.routeStatus=status;
  feedback.textContent=text;
  feedback.classList.remove('show');
  void feedback.offsetWidth;
  feedback.classList.add('show');
  if(hitFeedbackTimer)clearTimeout(hitFeedbackTimer);
  hitFeedbackTimer=setTimeout(()=>{
    feedback.classList.remove('show');
    hitFeedbackTimer=0;
  },duration);
}

function showHitFeedback(hit){
  if(!hit||!Number.isFinite(hit.points))return;
  const category=HIT_FEEDBACK_LABELS[hit.category]??'命中';
  presentFeedback(`命中確認：${hit.judgement??'HIT'}・${category}`,{status:'impact'});
}

function formatRouteCategoryCounts(counts){
  if(!counts||typeof counts!=='object')return'';
  return Object.entries(HIT_FEEDBACK_LABELS)
    .filter(([category])=>Number.isFinite(counts[category])&&counts[category]>0)
    .map(([category,label])=>counts[category]===1?label:`${label}×${counts[category]}`)
    .join('・');
}

function showRouteFeedback(summary){
  if(!summary||!Number.isFinite(summary.points))return;
  const parts=[];
  if(summary.newRoutes)parts.push(`新${summary.newRoutes}`);
  if(summary.improvedRoutes)parts.push(`更新${summary.improvedRoutes}`);
  if(summary.knownRoutes)parts.push(`発見済み${summary.knownRoutes}`);
  const category=HIT_FEEDBACK_LABELS[summary.category]??'命中';
  const detail=`${summary.judgement??'HIT'}・${category}`;
  const categoryCounts=formatRouteCategoryCounts(
    summary.points>0?summary.awardedCategoryCounts:summary.candidateCategoryCounts
  );
  const categoryDetail=categoryCounts?`｜経路 ${categoryCounts}`:'';
  const stateLabel=parts.join('・')||'確定';
  const text=summary.points>0
    ?`得点確定：+${summary.points}（${stateLabel}）｜代表 ${detail}${categoryDetail}`
    :`発見済み（得点なし）${categoryDetail}｜別の経路を探そう`;
  presentFeedback(text,{status:summary.routeStatus??'known',duration:1400});
}

world.onReflect=reflection=>{
  const cue=reflection.kind==='glass'?'GLASS_REFLECT':'WALL_REFLECT';
  const waterCue=reflection.kind==='glass'?'WATER_GLASS':'WATER_WALL';
  playCue(cue);
  playCue(waterCue);
  playHaptic(cue);
};
world.onHit=hit=>{
  playHitSound(hit);
  playCue('WATER_SPLASH');
  playHitHaptic(hit);
  showHitFeedback(hit);
};
world.onReflectionTap=tap=>{
  playCue(tap?.judgement??'GOOD');
  playCue('WATER_RIPPLE');
  playHitHaptic(tap);
  const reflections=Math.max(1,Number(tap?.reflections)||1);
  presentFeedback(`水面波タップ：+${tap.points}（${tap.judgement}・${reflections}回反射）`,{
    status:'reflection-tap',
    duration:1200
  });
};
world.onRoute=summary=>{
  showRouteFeedback(summary);
  if(summary?.points>0)playCue('WATER_SCORE');
};
$('playLegendToggle').onclick=()=>{
  if(state!=='PLAYING'||tutorialMode)return;
  playLegendOpen=!playLegendOpen;
  updatePlayLegend();
};
$('soundToggle').onclick=()=>{
  const enabled=setSoundEnabled(!isSoundEnabled());
  updateSoundControl();
  if(enabled)void wake().then(ready=>{if(ready)playCue('ENABLE')});
};
$('hapticsToggle').onclick=()=>{
  setHapticsEnabled(!isHapticsEnabled());
  updateHapticsControl();
  if(isHapticsEnabled())playHaptic('TAP');
};
$('startOfficial').onclick=()=>start(GAME_MODE.OFFICIAL);
$('startPractice').onclick=()=>start(GAME_MODE.PRACTICE);
$('rule').onclick=()=>{if(state==='HOME')setState('RULES')};
$('closeRules').onclick=()=>setState('HOME');
$('again').onclick=()=>{if(state==='RESULT')beginCountdown()};
$('changeMode').onclick=returnToModeSelection;
$('endGame').onclick=endGame;
$('guideContinue').onclick=()=>leaveGuide(true);
$('guideHome').onclick=()=>leaveGuide(false);
$('share').onclick=()=>doShare(world.score,'resultShareStatus','shareText');
$('homeShare').onclick=()=>doShare(0,'homeShareStatus','homeShareText');
document.addEventListener('pointerdown',event=>{
  if(state==='PLAYING'&&tutorialMode){
    const target=event.target;
    if(target?.closest?.('#guideHome,#guideContinue'))return;
    event.preventDefault();
    event.stopPropagation();
    leaveGuide(true);
    return;
  }
  if(state!=='COUNTDOWN'||!countdownWaitingForTap)return;
  event.preventDefault();
  event.stopPropagation();
  startCountdownSequence();
},{capture:true,passive:false});
document.addEventListener('gesturestart',event=>event.preventDefault());
document.addEventListener('visibilitychange',syncAudioVisibility);
addEventListener('pagehide',()=>{
  cancelDeadlineSettlement();
  suspendVisiblePlay(monotonicNow());
  lastRenderTimestamp=null;
  frames=[];
  if(state==='COUNTDOWN'){
    clearCountdown();
    setState('HOME');
  }
  void setAudioActive(false);
  setHapticsActive(false);
});
addEventListener('pageshow',syncAudioVisibility);
syncAudioVisibility();
updateSoundControl();
updateHapticsControl();
boot();
