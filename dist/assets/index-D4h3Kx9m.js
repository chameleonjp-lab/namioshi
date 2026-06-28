import './ui/styles.css';
import { MAX_TAPS } from './config.js';
import { World } from './game/world.js';
import { WebGLView } from './render/webgl.js';
import { CanvasView } from './render/canvas.js';
import { submitScore } from './services/ranking.js';
import { share, shareText } from './services/share.js';
import { tone, wake } from './core/audio.js';
const app = document.querySelector('#app');
app.innerHTML = `<canvas id="game"></canvas><div id="hud" class="hud"><div class="pill">スコア <span id="s">0</span></div><div class="pill">残り <span id="tm">10.0</span></div><div class="pill">タップ <span id="tp">0</span>/3</div></div><section id="HOME" class="screen show"><div class="panel"><h1>namioshi</h1><p>暗い水面に波を押し出し、壁やガラス片で反射させて3つのビーコンへ波の線を重ねる10秒ゲーム。</p><input id="name" class="input" maxlength="20" placeholder="名前"><button id="start" class="btn">開始</button><button id="rule" class="btn secondary">ルール: 最大3タップ / 高得点ほど上位</button><button id="homeShare" class="btn secondary">シェア</button><textarea id="homeShareText" class="shareText" readonly></textarea><a class="link" href="https://chameleonjp.codeberg.page/" target="_blank" rel="noreferrer">実験場リンク</a><p id="msg" class="small warn"></p></div></section><section id="LOADING" class="screen"><div id="readyText">LOADING</div></section><section id="READY" class="screen"><div id="readyText">3</div></section><section id="RESULT" class="screen"><div class="panel"><h1 style="font-size:42px">RESULT</h1><p><b id="fs">0</b> 点</p><p id="rank" class="small"></p><button id="share" class="btn">シェア</button><button id="again" class="btn secondary">もう一度</button><textarea id="shareText" class="shareText" readonly></textarea></div></section><section id="ERROR" class="screen"><div class="panel"><h1>ERROR</h1><p id="err" class="warn"></p></div></section>`;
const $ = (id) => document.getElementById(id);
let state = 'HOME', quality = 'MID', player = '';
const world = new World();
const canvas = $('game');
let view, last = 0, frames = [];
let submitted = false, lastHudScore = -1, lastHudTaps = -1, lastHudTime = -1;
function setState(s) { state = s; for (const k of ['HOME', 'LOADING', 'READY', 'PLAYING', 'RESULT', 'ERROR'])
    $(k)?.classList?.toggle('show', k === s); $('hud').classList.toggle('show', s === 'PLAYING'); }
function resize() { const w = innerWidth, h = innerHeight; world.w = w; world.h = h; view?.resize(w, h, quality); }
function boot() { try {
    try {
        view = new WebGLView(canvas);
    }
    catch {
        view = new CanvasView(canvas);
    }
    resize();
    addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', e => { if (!e.isPrimary)
        return; e.preventDefault(); wake(); if (state === 'PLAYING' && world.tap(e.clientX, e.clientY)) {
        tone(180, .07, 'triangle');
        hud();
    } }, { passive: false });
    requestAnimationFrame(loop);
}
catch (e) {
    $('err').textContent = '初期化に失敗しました: ' + e.message;
    setState('ERROR');
} }
function start() { player = $('name').value.trim(); if (!player) {
    $('msg').textContent = '名前を入力してください';
    return;
} setState('LOADING'); setTimeout(ready, 180); }
function ready() { setState('READY'); const seq = ['3', '2', '1', 'START']; let i = 0; $('readyText').textContent = seq[0]; const id = setInterval(() => { i++; if (i < seq.length) {
    $('readyText').textContent = seq[i];
}
else {
    clearInterval(id);
    setTimeout(play, 400);
} }, 700); }
function play() { world.reset(innerWidth, innerHeight); submitted = false; lastHudScore = -1; lastHudTaps = -1; lastHudTime = -1; setState('PLAYING'); hud(true); }
function finish() { if (state !== 'PLAYING')
    return; setState('RESULT'); $('fs').textContent = String(world.score); tone(330, .12); sendOnce(); }
async function sendOnce() { if (submitted)
    return; submitted = true; $('rank').textContent = 'ランキング送信中...'; try {
    await submitScore(player, world.score);
    $('rank').textContent = 'ランキング送信完了';
}
catch {
    $('rank').textContent = 'ランキング送信に失敗しました（ゲームは保存されました）';
} }
function hud(force = false) { const time = Math.max(0, world.time); if (force || world.score !== lastHudScore) {
    $('s').textContent = String(world.score);
    lastHudScore = world.score;
} if (force || world.taps !== lastHudTaps) {
    $('tp').textContent = String(world.taps);
    lastHudTaps = world.taps;
} if (force || Math.abs(time - lastHudTime) >= .1) {
    $('tm').textContent = time.toFixed(1);
    lastHudTime = time;
} }
function degrade(avg) { const old = quality; if (avg < 32)
    quality = 'LOW';
else if (avg < 45)
    quality = quality === 'HIGH' ? 'MID' : quality === 'MID' ? 'LOW' : 'LOW'; if (old !== quality)
    resize(); }
function loop(t) { const dt = Math.min(.033, (t - last) / 1000 || 0); last = t; if (state === 'PLAYING') {
    world.step(dt);
    if (world.score !== lastHudScore || world.taps !== lastHudTaps || Math.abs(Math.max(0, world.time) - lastHudTime) >= .1)
        hud();
    if (world.time <= 0 || (world.taps >= MAX_TAPS && world.waves.length === 0))
        finish();
} view?.render(world, t, quality); frames.push(1 / dt); if (frames.length > 90) {
    degrade(frames.reduce((a, b) => a + b, 0) / frames.length);
    frames = [];
} requestAnimationFrame(loop); }
world.onHit = () => tone(620, .09, 'sine');
$('start').onclick = start;
$('again').onclick = ready;
$('share').onclick = async () => { try {
    $('rank').textContent = await share(world.score);
}
catch {
    const ta = $('shareText');
    ta.style.display = 'block';
    ta.value = shareText(world.score);
    ta.focus();
    ta.select();
} };
$('homeShare').onclick = async () => { try {
    await share(0);
}
catch {
    const ta = $('homeShareText');
    ta.style.display = 'block';
    ta.value = shareText(0);
    ta.focus();
    ta.select();
} };
document.addEventListener('gesturestart', e => e.preventDefault());
boot();
