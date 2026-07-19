import {LAYOUT_CANDIDATES} from './layout-candidates.js';
import {analyzeLayouts,beaconPosition,REFERENCE_TAPS} from './layout-analysis.js';

const canvas=document.getElementById('preview');
const context=canvas.getContext('2d');
const choices=document.getElementById('choices');
const title=document.getElementById('title');
const summary=document.getElementById('summary');
const metricsBody=document.getElementById('metrics');
const results=new Map(analyzeLayouts(LAYOUT_CANDIDATES).map(result=>[result.id,result]));
let selected=LAYOUT_CANDIDATES[0];

function metric(label,value){
  const row=document.createElement('tr');
  const heading=document.createElement('th');
  const cell=document.createElement('td');
  heading.textContent=label;
  cell.textContent=String(value);
  row.append(heading,cell);
  metricsBody.append(row);
}

function renderMetrics(){
  const result=results.get(selected.id);
  title.textContent=selected.label;
  summary.textContent=selected.summary;
  metricsBody.textContent='';
  metric('候補ID',selected.id);
  metric('指紋',result.fingerprint);
  metric('直接 / 壁 / ガラス / 2回反射',`${result.routes.direct} / ${result.routes.wall} / ${result.routes.glass} / ${result.routes.double}`);
  metric('共通3タップの比較得点',result.referenceBestScore);
  metric('共通3タップの直接波だけ',result.referenceDirectScore);
  metric('直接経路の割合',`${(result.directDominance*100).toFixed(1)}%`);
  metric('反射経路を持つ調査地点',`${result.reflectedTapDiversity} / ${result.samples.tapPoints}`);
  metric('ビーコン最小間隔',`${result.minBeaconDistance}px`);
  metric('ビーコンとガラスの最小間隔',`${result.minBeaconGlassDistance}px`);
  metric('近接警告',result.beaconGlassRiskPairs.length?result.beaconGlassRiskPairs.join(', '):'なし');
  metric('2回反射が届くビーコン',`${result.doubleReflectionBeaconCount} / 3`);
  metric('採用状態','人の判断待ち');
}

function selectCandidate(candidate){
  selected=candidate;
  for(const button of choices.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.id===candidate.id));
  renderMetrics();
}

for(const candidate of LAYOUT_CANDIDATES){
  const button=document.createElement('button');
  button.type='button';
  button.dataset.id=candidate.id;
  button.textContent=candidate.label;
  button.setAttribute('aria-pressed','false');
  button.addEventListener('click',()=>selectCandidate(candidate));
  choices.append(button);
}

function drawBackground(){
  const gradient=context.createLinearGradient(0,0,0,640);
  gradient.addColorStop(0,'#071a2c');
  gradient.addColorStop(.5,'#08283a');
  gradient.addColorStop(1,'#030d18');
  context.fillStyle=gradient;
  context.fillRect(0,0,360,640);
  context.strokeStyle='rgba(130,220,255,.08)';
  context.lineWidth=1;
  for(let x=40;x<360;x+=40){context.beginPath();context.moveTo(x,0);context.lineTo(x,640);context.stroke();}
  for(let y=40;y<640;y+=40){context.beginPath();context.moveTo(0,y);context.lineTo(360,y);context.stroke();}
}

function drawGlass(){
  context.lineCap='round';
  for(const piece of selected.glass){
    context.strokeStyle='rgba(92,221,255,.22)';
    context.lineWidth=10;
    context.beginPath();context.moveTo(piece.x1,piece.y1);context.lineTo(piece.x2,piece.y2);context.stroke();
    context.strokeStyle='#9cecff';
    context.lineWidth=3;
    context.beginPath();context.moveTo(piece.x1,piece.y1);context.lineTo(piece.x2,piece.y2);context.stroke();
  }
}

function drawReferenceTaps(){
  context.textAlign='center';
  context.textBaseline='middle';
  context.font='bold 12px system-ui';
  REFERENCE_TAPS.forEach((point,index)=>{
    context.strokeStyle='#ffbd6a';
    context.fillStyle='rgba(255,189,106,.12)';
    context.lineWidth=2;
    context.beginPath();context.arc(point.x,point.y,13,0,Math.PI*2);context.fill();context.stroke();
    context.fillStyle='#ffe0ad';
    context.fillText(String(index+1),point.x,point.y);
  });
}

function drawBeacon(beacon,time){
  const point=beaconPosition(beacon,time);
  context.strokeStyle='rgba(230,255,190,.18)';
  context.lineWidth=1;
  context.beginPath();
  for(let step=0;step<=20;step++){
    const trail=beaconPosition(beacon,step/2);
    if(step===0)context.moveTo(trail.x,trail.y);else context.lineTo(trail.x,trail.y);
  }
  context.stroke();
  const glow=context.createRadialGradient(point.x,point.y,1,point.x,point.y,30);
  glow.addColorStop(0,'rgba(255,255,220,.95)');
  glow.addColorStop(.25,'rgba(184,255,223,.75)');
  glow.addColorStop(1,'rgba(90,230,255,0)');
  context.fillStyle=glow;
  context.beginPath();context.arc(point.x,point.y,30,0,Math.PI*2);context.fill();
  context.fillStyle='#f6ffcf';
  context.beginPath();context.arc(point.x,point.y,beacon.radius,0,Math.PI*2);context.fill();
  context.strokeStyle='#ffffff';
  context.lineWidth=2;
  context.stroke();
}

function frame(now){
  drawBackground();
  drawGlass();
  drawReferenceTaps();
  const time=(now/1000)%10;
  for(const beacon of selected.beacons)drawBeacon(beacon,time);
  context.strokeStyle='rgba(160,230,255,.35)';
  context.lineWidth=2;
  context.strokeRect(1,1,358,638);
  requestAnimationFrame(frame);
}

selectCandidate(selected);
requestAnimationFrame(frame);
