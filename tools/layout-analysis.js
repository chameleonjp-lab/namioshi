import {LOGICAL_HEIGHT as HEIGHT,LOGICAL_WIDTH as WIDTH} from '../src/config.js';

export const ANALYSIS_CONFIG=Object.freeze({waveSpeed:165,waveLifetime:3,hitBand:18,timeStart:.25,timeStep:.05,timeSamples:56});
export const REFERENCE_TAPS=Object.freeze([{x:90,y:140},{x:180,y:340},{x:270,y:490}]);

const WAVE_SPEED=ANALYSIS_CONFIG.waveSpeed;
const HIT_BAND=ANALYSIS_CONFIG.hitBand;
const TAP_GRID_X=Array.from({length:11},(_,index)=>30+index*30);
const TAP_GRID_Y=Array.from({length:11},(_,index)=>90+index*50);
const ARRIVAL_TIMES=Array.from({length:ANALYSIS_CONFIG.timeSamples},(_,index)=>ANALYSIS_CONFIG.timeStart+index*ANALYSIS_CONFIG.timeStep);
const SCORE_BASE={direct:20,wall:100,glass:180,double:300};
const EPSILON=1e-8;

const WALLS=[
  {id:'wall-left',kind:'wall',x1:0,y1:0,x2:0,y2:HEIGHT},
  {id:'wall-right',kind:'wall',x1:WIDTH,y1:0,x2:WIDTH,y2:HEIGHT},
  {id:'wall-top',kind:'wall',x1:0,y1:0,x2:WIDTH,y2:0},
  {id:'wall-bottom',kind:'wall',x1:0,y1:HEIGHT,x2:WIDTH,y2:HEIGHT}
];

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const segmentLength=segment=>Math.hypot(segment.x2-segment.x1,segment.y2-segment.y1);

function pointSegmentDistance(point,segment){
  const vx=segment.x2-segment.x1;
  const vy=segment.y2-segment.y1;
  const lengthSquared=vx*vx+vy*vy;
  const t=lengthSquared?clamp(((point.x-segment.x1)*vx+(point.y-segment.y1)*vy)/lengthSquared,0,1):0;
  return Math.hypot(point.x-(segment.x1+vx*t),point.y-(segment.y1+vy*t));
}

function reflectedCoordinate(start,velocity,time,min,max){
  const span=max-min;
  const period=span*2;
  const raw=start-min+velocity*time;
  const wrapped=((raw%period)+period)%period;
  return wrapped<=span?min+wrapped:max-(wrapped-span);
}

export function beaconPosition(beacon,time){
  return{
    x:reflectedCoordinate(beacon.x,beacon.vx,time,beacon.radius,WIDTH-beacon.radius),
    y:reflectedCoordinate(beacon.y,beacon.vy,time,70,HEIGHT-beacon.radius)
  };
}

function reflectPoint(point,surface){
  const vx=surface.x2-surface.x1;
  const vy=surface.y2-surface.y1;
  const lengthSquared=vx*vx+vy*vy;
  const t=((point.x-surface.x1)*vx+(point.y-surface.y1)*vy)/lengthSquared;
  const projection={x:surface.x1+vx*t,y:surface.y1+vy*t};
  return{x:2*projection.x-point.x,y:2*projection.y-point.y};
}

function segmentIntersection(start,end,surface){
  const rx=end.x-start.x;
  const ry=end.y-start.y;
  const sx=surface.x2-surface.x1;
  const sy=surface.y2-surface.y1;
  const denominator=rx*sy-ry*sx;
  if(Math.abs(denominator)<EPSILON)return null;
  const qpx=surface.x1-start.x;
  const qpy=surface.y1-start.y;
  const alongPath=(qpx*sy-qpy*sx)/denominator;
  const alongSurface=(qpx*ry-qpy*rx)/denominator;
  if(alongPath<=EPSILON||alongPath>=1-EPSILON||alongSurface<-EPSILON||alongSurface>1+EPSILON)return null;
  return{x:start.x+alongPath*rx,y:start.y+alongPath*ry};
}

function reflectedRoute(tap,target,surfaces){
  const images=new Array(surfaces.length+1);
  images[surfaces.length]=target;
  for(let index=surfaces.length-1;index>=0;index--)images[index]=reflectPoint(images[index+1],surfaces[index]);
  let current=tap;
  let totalLength=0;
  const points=[];
  for(let index=0;index<surfaces.length;index++){
    const hit=segmentIntersection(current,images[index],surfaces[index]);
    if(!hit)return null;
    totalLength+=distance(current,hit);
    points.push(hit);
    current=hit;
  }
  totalLength+=distance(current,target);
  return{length:totalLength,points};
}

function routeKind(sequence){
  if(sequence.length===0)return'direct';
  if(sequence.length===2)return'double';
  return sequence[0].kind;
}

function routeSequences(surfaces){
  const sequences=[[]];
  for(const surface of surfaces)sequences.push([surface]);
  for(const first of surfaces){
    for(const second of surfaces){
      if(first.id!==second.id)sequences.push([first,second]);
    }
  }
  return sequences;
}

function stableStringify(value){
  if(Array.isArray(value))return`[${value.map(stableStringify).join(',')}]`;
  if(value&&typeof value==='object')return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function fnv1a(text){
  let hash=0x811c9dc5;
  for(let index=0;index<text.length;index++){
    hash^=text.charCodeAt(index);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return hash.toString(16).padStart(8,'0');
}

export function layoutFingerprint(layout){
  return`fnv1a-${fnv1a(stableStringify(layout))}`;
}

export function validateLayout(layout){
  const errors=[];
  if(!/^candidate-[a-z0-9-]+$/.test(layout?.id||''))errors.push('candidate id is invalid');
  if(!layout?.ruleVersion)errors.push('ruleVersion is required');
  if(layout?.selected!==undefined||layout?.official!==undefined)errors.push('study candidate must not declare selected or official');
  if(!Array.isArray(layout?.beacons)||layout.beacons.length!==3)errors.push('exactly three beacons are required');
  if(!Array.isArray(layout?.glass)||layout.glass.length!==4)errors.push('exactly four glass segments are required');
  const ids=new Set();
  for(const beacon of layout?.beacons||[]){
    if(ids.has(beacon.id))errors.push(`duplicate id: ${beacon.id}`);
    ids.add(beacon.id);
    if(!(beacon.x>=beacon.radius&&beacon.x<=WIDTH-beacon.radius&&beacon.y>=70&&beacon.y<=HEIGHT-beacon.radius))errors.push(`beacon out of bounds: ${beacon.id}`);
    if(!Number.isFinite(beacon.vx)||!Number.isFinite(beacon.vy))errors.push(`beacon velocity invalid: ${beacon.id}`);
  }
  for(const glass of layout?.glass||[]){
    if(ids.has(glass.id))errors.push(`duplicate id: ${glass.id}`);
    ids.add(glass.id);
    for(const[name,value,min,max]of[['x1',glass.x1,0,WIDTH],['x2',glass.x2,0,WIDTH],['y1',glass.y1,0,HEIGHT],['y2',glass.y2,0,HEIGHT]]){
      if(!(value>=min&&value<=max))errors.push(`${glass.id}.${name} out of bounds`);
    }
    const length=segmentLength(glass);
    if(length<60||length>130)errors.push(`glass length outside 60..130: ${glass.id}`);
  }
  return errors;
}

export function analyzeLayout(layout){
  const validationErrors=validateLayout(layout);
  if(validationErrors.length)throw new Error(`${layout.id}: ${validationErrors.join('; ')}`);
  const glass=layout.glass.map(item=>({...item,kind:'glass'}));
  const surfaces=[...WALLS,...glass];
  const sequences=routeSequences(surfaces);
  const counts={direct:0,wall:0,glass:0,double:0};
  const beaconCoverage={direct:new Set(),wall:new Set(),glass:new Set(),double:new Set()};
  const reflectedTapRoutes=new Map();
  const referenceTapKeys=new Set(REFERENCE_TAPS.map(point=>`${point.x},${point.y}`));
  const referenceCounts={direct:0,wall:0,glass:0,double:0};
  const referenceBestByTapBeacon=new Map();
  const referenceDirectByTapBeacon=new Map();
  let bestRoute=null;

  for(const x of TAP_GRID_X){
    for(const y of TAP_GRID_Y){
      const tap={x,y};
      const tapKey=`${x},${y}`;
      let tapReflectedRoutes=0;
      for(const beacon of layout.beacons){
        for(const sequence of sequences){
          let bestError=Infinity;
          let bestTime=null;
          let bestLength=null;
          for(const time of ARRIVAL_TIMES){
            const target=beaconPosition(beacon,time);
            const route=sequence.length?reflectedRoute(tap,target,sequence):{length:distance(tap,target),points:[]};
            if(!route)continue;
            const error=Math.abs(route.length-WAVE_SPEED*time);
            if(error<bestError){bestError=error;bestTime=time;bestLength=route.length;}
          }
          if(bestError>HIT_BAND)continue;
          const kind=routeKind(sequence);
          const accuracy=clamp(1-bestError/HIT_BAND,0,1);
          const candidateScore=Math.round(SCORE_BASE[kind]*(0.8+accuracy*0.4));
          counts[kind]++;
          if(referenceTapKeys.has(tapKey)){
            referenceCounts[kind]++;
            const key=`${tapKey}/${beacon.id}`;
            referenceBestByTapBeacon.set(key,Math.max(referenceBestByTapBeacon.get(key)||0,candidateScore));
            if(kind==='direct')referenceDirectByTapBeacon.set(key,Math.max(referenceDirectByTapBeacon.get(key)||0,candidateScore));
          }
          beaconCoverage[kind].add(beacon.id);
          if(kind!=='direct')tapReflectedRoutes++;
          if(!bestRoute||bestError<bestRoute.error){
            bestRoute={tap:tapKey,beaconId:beacon.id,surfaces:sequence.map(surface=>surface.id),kind,error:bestError,time:bestTime,length:bestLength};
          }
        }
      }
      if(tapReflectedRoutes)reflectedTapRoutes.set(tapKey,tapReflectedRoutes);
    }
  }

  let minBeaconDistance=Infinity;
  let minBeaconGlassDistance=Infinity;
  const beaconGlassRiskPairs=new Set();
  for(let step=0;step<=100;step++){
    const time=step/10;
    const positions=layout.beacons.map(beacon=>({beacon,point:beaconPosition(beacon,time)}));
    for(let first=0;first<positions.length;first++){
      for(let second=first+1;second<positions.length;second++)minBeaconDistance=Math.min(minBeaconDistance,distance(positions[first].point,positions[second].point));
    }
    for(const{beacon,point}of positions){
      for(const segment of glass){
        const value=pointSegmentDistance(point,segment);
        minBeaconGlassDistance=Math.min(minBeaconGlassDistance,value);
        if(value<beacon.radius+8)beaconGlassRiskPairs.add(`${beacon.id}/${segment.id}`);
      }
    }
  }

  const reflectedTotal=counts.wall+counts.glass+counts.double;
  const totalRoutes=counts.direct+reflectedTotal;
  const maxRoutesFromOneTap=Math.max(0,...reflectedTapRoutes.values());
  const edgeMargin=Math.min(...layout.glass.flatMap(piece=>[piece.x1,WIDTH-piece.x1,piece.x2,WIDTH-piece.x2,piece.y1,HEIGHT-piece.y1,piece.y2,HEIGHT-piece.y2]));

  return{
    id:layout.id,
    label:layout.label,
    ruleVersion:layout.ruleVersion,
    fingerprint:layoutFingerprint(layout),
    samples:{tapPoints:TAP_GRID_X.length*TAP_GRID_Y.length,arrivalTimes:ARRIVAL_TIMES.length,surfaces:surfaces.length},
    routes:counts,
    totalRoutes,
    referenceTaps:REFERENCE_TAPS,
    referenceTapRoutes:referenceCounts,
    referenceDirectScore:[...referenceDirectByTapBeacon.values()].reduce((sum,value)=>sum+value,0),
    referenceBestScore:[...referenceBestByTapBeacon.values()].reduce((sum,value)=>sum+value,0),
    directDominance:Number((totalRoutes?counts.direct/totalRoutes:0).toFixed(4)),
    reflectedTapDiversity:reflectedTapRoutes.size,
    maxReflectedRoutesFromOneTap:maxRoutesFromOneTap,
    reflectedRouteConcentration:Number((reflectedTotal?maxRoutesFromOneTap/reflectedTotal:0).toFixed(4)),
    beaconCoverage:Object.fromEntries(Object.entries(beaconCoverage).map(([kind,set])=>[kind,[...set].sort()])),
    doubleReflectionPossible:counts.double>0,
    doubleReflectionBeaconCount:beaconCoverage.double.size,
    minBeaconDistance:Number(minBeaconDistance.toFixed(2)),
    minBeaconGlassDistance:Number(minBeaconGlassDistance.toFixed(2)),
    beaconGlassRiskPairs:[...beaconGlassRiskPairs].sort(),
    glassEndpointEdgeMargin:Number(edgeMargin.toFixed(2)),
    bestMatchedRoute:bestRoute?{...bestRoute,error:Number(bestRoute.error.toFixed(3)),time:Number(bestRoute.time.toFixed(2)),length:Number(bestRoute.length.toFixed(2))}:null
  };
}

export function analyzeLayouts(layouts){
  return layouts.map(analyzeLayout);
}
