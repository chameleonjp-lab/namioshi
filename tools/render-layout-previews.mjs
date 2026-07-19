import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {LAYOUT_CANDIDATES} from './layout-candidates.js';

const snapshot=JSON.parse(readFileSync(new URL('./layout-analysis.snapshot.json',import.meta.url),'utf8'));
const metricsById=new Map(snapshot.results.map(result=>[result.id,result]));
const outputDir=fileURLToPath(new URL('../docs/layout-previews/',import.meta.url));
const shouldWrite=process.argv.includes('--write');
const WIDTH=360;
const HEIGHT=640;
const colors=['#7de7ff','#d8ff9a','#d4a8ff'];
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const round=value=>Number(value.toFixed(2));

function bounce(start,velocity,time,min,max){
  const span=max-min;
  const period=span*2;
  const wrapped=(((start-min+velocity*time)%period)+period)%period;
  return wrapped<=span?min+wrapped:max-(wrapped-span);
}

function beaconPosition(beacon,time){
  return{x:bounce(beacon.x,beacon.vx,time,beacon.radius,WIDTH-beacon.radius),y:bounce(beacon.y,beacon.vy,time,70,HEIGHT-beacon.radius)};
}

function board(layout,metrics,x,y,scale){
  const sx=value=>round(x+value*scale);
  const sy=value=>round(y+value*scale);
  const width=round(WIDTH*scale);
  const height=round(HEIGHT*scale);
  const warningGlass=new Set(metrics.beaconGlassRiskPairs.map(pair=>pair.split('/')[1]));
  const out=['<g>'];
  out.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="url(#water)" stroke="#57839a" stroke-width="2"/>`);
  out.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="url(#grid)" opacity=".45"/>`);
  layout.beacons.forEach((beacon,index)=>{
    const points=[];
    for(let time=0;time<=10;time+=1){const point=beaconPosition(beacon,time);points.push(`${sx(point.x)},${sy(point.y)}`);}
    out.push(`<polyline points="${points.join(' ')}" fill="none" stroke="${colors[index]}" stroke-opacity=".42" stroke-width="${round(Math.max(1.4,2*scale))}" stroke-dasharray="6 5"/>`);
  });
  layout.glass.forEach(glass=>{
    const warning=warningGlass.has(glass.id);
    out.push(`<line x1="${sx(glass.x1)}" y1="${sy(glass.y1)}" x2="${sx(glass.x2)}" y2="${sy(glass.y2)}" stroke="${warning?'#ff8aa8':'#7cecff'}" stroke-opacity=".24" stroke-width="${round(10*scale)}" stroke-linecap="round"/>`);
    out.push(`<line x1="${sx(glass.x1)}" y1="${sy(glass.y1)}" x2="${sx(glass.x2)}" y2="${sy(glass.y2)}" stroke="${warning?'#ffc0cf':'#c2f6ff'}" stroke-width="${round(3*scale)}" stroke-linecap="round"/>`);
  });
  snapshot.referenceTaps.forEach((tap,index)=>{
    out.push(`<circle cx="${sx(tap.x)}" cy="${sy(tap.y)}" r="${round(13*scale)}" fill="#ffb45b" fill-opacity=".12" stroke="#ffbe73" stroke-width="${round(2*scale)}"/>`);
    out.push(`<text x="${sx(tap.x)}" y="${round(sy(tap.y)+4*scale)}" text-anchor="middle" font-size="${round(12*scale)}" font-weight="700" fill="#ffe4bd">${index+1}</text>`);
  });
  layout.beacons.forEach((beacon,index)=>{
    out.push(`<circle cx="${sx(beacon.x)}" cy="${sy(beacon.y)}" r="${round(28*scale)}" fill="${colors[index]}" fill-opacity=".13"/>`);
    out.push(`<circle cx="${sx(beacon.x)}" cy="${sy(beacon.y)}" r="${round(beacon.radius*scale)}" fill="${colors[index]}" stroke="#fff" stroke-width="${round(2*scale)}"/>`);
    out.push(`<text x="${sx(beacon.x)}" y="${round(sy(beacon.y)+4*scale)}" text-anchor="middle" font-size="${round(12*scale)}" font-weight="800" fill="#07111f">${String.fromCharCode(65+index)}</text>`);
  });
  out.push('</g>');
  return out.join('');
}

function facts(metrics){
  return[
    `ガラス反射 ${metrics.routes.glass}`,
    `2回反射 ${metrics.routes.double}`,
    `共通3タップ ${metrics.referenceBestScore}点`,
    `ビーコン間隔 ${metrics.minBeaconDistance}px`,
    `近接警告 ${metrics.beaconGlassRiskPairs.length}件`,
    `端余白 ${metrics.glassEndpointEdgeMargin}px`
  ];
}

function defs(){
  return '<defs><linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#09263d"/><stop offset=".55" stop-color="#083047"/><stop offset="1" stop-color="#03101f"/></linearGradient><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#9fe9ff" stroke-opacity=".14"/></pattern></defs>';
}

function horizontalSvg(){
  const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="1170" height="760" viewBox="0 0 1170 760" role="img" aria-labelledby="title desc"><title id="title">namioshi公式配置候補A・B・C比較</title><desc id="desc">3候補の盤面、ビーコン移動、ガラス片、共通3タップ、主要指標を横並びで示す。</desc>${defs()}<rect width="1170" height="760" fill="#07111f"/><text x="24" y="38" font-family="system-ui,sans-serif" font-size="26" font-weight="800" fill="#f2fbff">namioshi v3 公式配置候補 比較</text><text x="24" y="64" font-family="system-ui,sans-serif" font-size="13" fill="#b9d7e6">採用状態: 人の判断待ち。数字だけで自動選択しない。</text>`];
  LAYOUT_CANDIDATES.forEach((layout,index)=>{
    const metrics=metricsById.get(layout.id);
    const x=index*390;
    parts.push(`<rect x="${x+12}" y="82" width="366" height="650" rx="18" fill="#0b1a28" stroke="#294b5d"/>`);
    parts.push(`<text x="${x+28}" y="116" font-family="system-ui,sans-serif" font-size="19" font-weight="800" fill="#f3fbff">${esc(layout.label)}</text>`);
    parts.push(board(layout,metrics,x+58,138,.72));
    facts(metrics).forEach((text,row)=>parts.push(`<text x="${x+28}" y="${618+row*18}" font-family="system-ui,sans-serif" font-size="13" fill="${row===4&&metrics.beaconGlassRiskPairs.length>1?'#ffb2c5':'#c6e1ed'}">${esc(text)}</text>`));
  });
  parts.push('<text x="24" y="750" font-family="system-ui,sans-serif" font-size="12" fill="#8daebd">破線はビーコンの10秒移動経路。橙色の1〜3は共通タップ地点。桃色のガラスは近接警告対象。</text></svg>\n');
  return parts.join('');
}

function mobileSvg(){
  const cardHeight=735;
  const totalHeight=88+cardHeight*3+24;
  const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="${totalHeight}" viewBox="0 0 420 ${totalHeight}" role="img" aria-labelledby="title desc"><title id="title">namioshi公式配置候補A・B・C縦比較</title><desc id="desc">スマートフォン向けに3候補を縦並びで示す。</desc>${defs()}<rect width="420" height="${totalHeight}" fill="#07111f"/><text x="18" y="34" font-family="system-ui,sans-serif" font-size="22" font-weight="800" fill="#f2fbff">公式配置候補 比較</text><text x="18" y="58" font-family="system-ui,sans-serif" font-size="12" fill="#b9d7e6">採用状態: 人の判断待ち</text>`];
  LAYOUT_CANDIDATES.forEach((layout,index)=>{
    const metrics=metricsById.get(layout.id);
    const y=78+index*cardHeight;
    parts.push(`<rect x="12" y="${y}" width="396" height="713" rx="18" fill="#0b1a28" stroke="#294b5d"/>`);
    parts.push(`<text x="28" y="${y+34}" font-family="system-ui,sans-serif" font-size="20" font-weight="800" fill="#f3fbff">${esc(layout.label)}</text>`);
    parts.push(board(layout,metrics,57,y+52,.85));
    facts(metrics).forEach((text,row)=>parts.push(`<text x="28" y="${y+617+row*16}" font-family="system-ui,sans-serif" font-size="12" fill="${row===4&&metrics.beaconGlassRiskPairs.length>1?'#ffb2c5':'#c6e1ed'}">${esc(text)}</text>`));
  });
  parts.push('</svg>\n');
  return parts.join('');
}

const outputs=new Map([
  ['layout-comparison.svg',horizontalSvg()],
  ['layout-comparison-mobile.svg',mobileSvg()]
]);
mkdirSync(outputDir,{recursive:true});
let stale=false;
for(const[name,content]of outputs){
  const filePath=fileURLToPath(new URL(name,new URL('../docs/layout-previews/',import.meta.url)));
  if(shouldWrite){writeFileSync(filePath,content);console.log(`wrote ${filePath}`);}
  else if(!existsSync(filePath)||readFileSync(filePath,'utf8')!==content){console.error(`layout preview is stale: ${name}`);stale=true;}
}
if(!shouldWrite&&stale){console.error('run npm run render:layouts:write and review the SVG changes');process.exit(1);}
if(!shouldWrite)console.log(`layout preview check ok: ${outputs.size} SVG files`);
