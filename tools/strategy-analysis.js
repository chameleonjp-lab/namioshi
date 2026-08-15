import {
  CLIENT_VERSION,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  MAX_TAPS,
  OFFICIAL_LAYOUT_FINGERPRINT,
  OFFICIAL_LAYOUT_ID,
  OFFICIAL_LAYOUT_VERSION,
  OFFICIAL_RULE_VERSION,
  SCORE_HARD_CEILING,
  WAVE_SPEED
} from '../src/config.js';
import {GAME_MODE} from '../src/game/modes.js';
import {advancePlayFrame,FixedStepRunner,TimedInputQueue} from '../src/game/session.js';
import {World} from '../src/game/world.js';

const FULL_ROUND_TIMESTAMPS=Object.freeze([1000,4000,7000,10000,13000,16000,19000,22000,25000,28000]);

export const STRATEGY_ANALYSIS_CONFIG=Object.freeze({
  analysisVersion:'namioshi-strategy-analysis-003',
  waveSpeed:WAVE_SPEED,
  percentileMethod:'sorted[floor((n-1)*ratio)]',
  coordinateDomain:Object.freeze({xMin:0,xMax:LOGICAL_WIDTH,yMin:0,yMax:LOGICAL_HEIGHT}),
  random:Object.freeze({
    runs:1000,
    calibrationSeedStart:1,
    holdoutSeedStart:10001,
    timestamps:FULL_ROUND_TIMESTAMPS
  }),
  designedInputs:Object.freeze([
    Object.freeze([60,310,1000]),
    Object.freeze([300,260,4000]),
    Object.freeze([60,280,7000]),
    Object.freeze([270,260,10000]),
    Object.freeze([300,480,13000]),
    Object.freeze([120,500,16000]),
    Object.freeze([90,280,19000]),
    Object.freeze([240,240,22000]),
    Object.freeze([150,120,25000]),
    Object.freeze([330,100,28000])
  ]),
  repeated:Object.freeze({
    timestamps:FULL_ROUND_TIMESTAMPS,
    coarse:Object.freeze({xStep:30,yStep:20}),
    refinement:Object.freeze({topPoints:10,radius:15,step:5})
  }),
  twoPointCandidateCount:12,
  refreshRates:Object.freeze([20,30,60,120])
});

function seededRandom(seed){
  let state=seed>>>0;
  return()=>{
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/0x100000000;
  };
}

function percentile(values,ratio){
  return values[Math.floor((values.length-1)*ratio)];
}

function resultIsConsistent(result){
  return result.score===result.routeLedgerSum&&
    result.score===result.breakdownSum&&
    result.score===result.routeSummaryPoints&&
    result.stepCount===1800&&
    result.queueLength===0&&
    result.scoreDrops===0;
}

function resultRank(left,right){
  return right.result.score-left.result.score||left.x-right.x||left.y-right.y;
}

function pointKey(x,y){return`${x},${y}`}

export function simulateStrategy(events,refreshRate=60){
  const world=new World();
  world.reset({mode:GAME_MODE.OFFICIAL});
  const queue=new TimedInputQueue();
  queue.reset(0);
  for(const [x,y,timestamp] of events)queue.enqueue({x,y,timestamp});
  const runner=new FixedStepRunner();
  runner.reset(0);
  let scoreDrops=0;
  let routeSummaryPoints=0;
  let routeSummaryCount=0;
  let routeKnownCount=0;
  world.onRoute=summary=>{
    routeSummaryPoints+=summary.points;
    routeSummaryCount++;
    routeKnownCount+=summary.knownRoutes;
  };
  const update=(step,{boundaryTimestamp})=>{
    const previousScore=world.score;
    world.step(step,{countTime:false});
    queue.drainThrough(boundaryTimestamp,input=>world.tap(input.x,input.y));
    if(world.score<previousScore)scoreDrops++;
  };
  for(let frame=1;frame<=refreshRate*31;frame++){
    const playFrame=advancePlayFrame({
      timestamp:frame*1000/refreshRate,
      deadline:30000,
      runner,
      inputQueue:queue,
      update
    });
    if(playFrame.shouldFinish)break;
  }
  const previousScore=world.score;
  world.finalizePendingHits();
  if(world.score<previousScore)scoreDrops++;
  const breakdown=world.getScoreBreakdown();
  return{
    score:world.score,
    breakdown,
    routeCount:world.getDiscoveredRouteCount(),
    rootHitCount:world.bestHits.size,
    routeLedgerSum:[...world.routeBestHits.values()].reduce((sum,hit)=>sum+hit.score,0),
    breakdownSum:Object.values(breakdown).reduce((sum,points)=>sum+points,0),
    routeSummaryPoints,
    routeSummaryCount,
    routeKnownCount,
    stepCount:runner.stepCount,
    queueLength:queue.length,
    scoreDrops
  };
}

function randomEvents(seed){
  const random=seededRandom(seed);
  const domain=STRATEGY_ANALYSIS_CONFIG.coordinateDomain;
  return STRATEGY_ANALYSIS_CONFIG.random.timestamps.map(timestamp=>[
    domain.xMin+Math.floor(random()*(domain.xMax-domain.xMin+1)),
    domain.yMin+Math.floor(random()*(domain.yMax-domain.yMin+1)),
    timestamp
  ]);
}

function summarizeRandom(seedStart){
  const scores=[];
  const doubleShares=[];
  let scoreDrops=0;
  let integrityFailures=0;
  let zeroScores=0;
  for(let offset=0;offset<STRATEGY_ANALYSIS_CONFIG.random.runs;offset++){
    const result=simulateStrategy(randomEvents(seedStart+offset));
    scores.push(result.score);
    doubleShares.push(result.score?result.breakdown.double/result.score:0);
    scoreDrops+=result.scoreDrops;
    if(result.score===0)zeroScores++;
    if(!resultIsConsistent(result))integrityFailures++;
  }
  scores.sort((left,right)=>left-right);
  doubleShares.sort((left,right)=>left-right);
  return{
    runs:scores.length,
    seedStart,
    seedEnd:seedStart+scores.length-1,
    q10:percentile(scores,.1),
    median:percentile(scores,.5),
    q90:percentile(scores,.9),
    maximum:scores.at(-1),
    zeroScores,
    doubleShareMedian:Number(percentile(doubleShares,.5).toFixed(4)),
    scoreDrops,
    integrityFailures
  };
}

function samePointEvents(x,y){
  return STRATEGY_ANALYSIS_CONFIG.repeated.timestamps.map(timestamp=>[x,y,timestamp]);
}

function analyzeRepeated(){
  const domain=STRATEGY_ANALYSIS_CONFIG.coordinateDomain;
  const coarse=STRATEGY_ANALYSIS_CONFIG.repeated.coarse;
  const coarseResults=[];
  for(let x=domain.xMin;x<=domain.xMax;x+=coarse.xStep){
    for(let y=domain.yMin;y<=domain.yMax;y+=coarse.yStep){
      coarseResults.push({x,y,result:simulateStrategy(samePointEvents(x,y))});
    }
  }
  coarseResults.sort(resultRank);

  const refinement=STRATEGY_ANALYSIS_CONFIG.repeated.refinement;
  const refinedPoints=new Map();
  for(const point of coarseResults.slice(0,refinement.topPoints)){
    for(let x=point.x-refinement.radius;x<=point.x+refinement.radius;x+=refinement.step){
      for(let y=point.y-refinement.radius;y<=point.y+refinement.radius;y+=refinement.step){
        const boundedX=Math.max(domain.xMin,Math.min(domain.xMax,x));
        const boundedY=Math.max(domain.yMin,Math.min(domain.yMax,y));
        refinedPoints.set(pointKey(boundedX,boundedY),{x:boundedX,y:boundedY});
      }
    }
  }
  const refinedResults=[...refinedPoints.values()].map(({x,y})=>({
    x,
    y,
    result:simulateStrategy(samePointEvents(x,y))
  })).sort(resultRank);
  const allResults=[...coarseResults,...refinedResults].sort(resultRank);
  const maximum=allResults[0];
  const integrityFailures=allResults.reduce((count,entry)=>count+Number(!resultIsConsistent(entry.result)),0);
  const scoreDrops=allResults.reduce((sum,entry)=>sum+entry.result.scoreDrops,0);
  return{
    coarseResults,
    refinedResults,
    rankedResults:allResults,
    report:{
      timestamps:STRATEGY_ANALYSIS_CONFIG.repeated.timestamps,
      coarseSamples:coarseResults.length,
      refinedSamples:refinedResults.length,
      refinementTopPoints:refinement.topPoints,
      coarseMaximum:{x:coarseResults[0].x,y:coarseResults[0].y,...coarseResults[0].result},
      maximum:{x:maximum.x,y:maximum.y,...maximum.result},
      scoreDrops,
      integrityFailures
    }
  };
}

function analyzeTwoPointBaseline(rankedResults){
  const unique=[];
  const seen=new Set();
  for(const entry of rankedResults){
    const key=pointKey(entry.x,entry.y);
    if(seen.has(key))continue;
    seen.add(key);
    unique.push({x:entry.x,y:entry.y});
    if(unique.length===STRATEGY_ANALYSIS_CONFIG.twoPointCandidateCount)break;
  }
  let maximum=null;
  let samples=0;
  let scoreDrops=0;
  let integrityFailures=0;
  for(let first=0;first<unique.length;first++){
    for(let second=0;second<unique.length;second++){
      if(first===second)continue;
      const events=STRATEGY_ANALYSIS_CONFIG.random.timestamps.map((timestamp,index)=>{
        const point=index%2===0?unique[first]:unique[second];
        return[point.x,point.y,timestamp];
      });
      const result=simulateStrategy(events);
      const entry={first:unique[first],second:unique[second],result};
      if(!maximum||result.score>maximum.result.score)maximum=entry;
      scoreDrops+=result.scoreDrops;
      if(!resultIsConsistent(result))integrityFailures++;
      samples++;
    }
  }
  return{
    selection:'ordered pairs from the top full-round same-point candidates',
    candidatePoints:unique,
    samples,
    maximum:{first:maximum.first,second:maximum.second,...maximum.result},
    scoreDrops,
    integrityFailures
  };
}

function refreshRateResults(events){
  return Object.fromEntries(STRATEGY_ANALYSIS_CONFIG.refreshRates.map(refreshRate=>[
    refreshRate,
    simulateStrategy(events,refreshRate)
  ]));
}

export function analyzeStrategy(){
  const calibration=summarizeRandom(STRATEGY_ANALYSIS_CONFIG.random.calibrationSeedStart);
  const holdout=summarizeRandom(STRATEGY_ANALYSIS_CONFIG.random.holdoutSeedStart);
  const repeated=analyzeRepeated();
  const twoPointBaseline=analyzeTwoPointBaseline(repeated.rankedResults);
  const designedByRefreshRate=refreshRateResults(STRATEGY_ANALYSIS_CONFIG.designedInputs);
  const designed=designedByRefreshRate[60];
  const holdoutFixture=randomEvents(STRATEGY_ANALYSIS_CONFIG.random.holdoutSeedStart);
  const refreshRateChecks={
    designed:designedByRefreshRate,
    repeatedMaximum:refreshRateResults(samePointEvents(repeated.report.maximum.x,repeated.report.maximum.y)),
    holdoutSeed10001:refreshRateResults(holdoutFixture)
  };
  return{
    schemaVersion:2,
    analysisVersion:STRATEGY_ANALYSIS_CONFIG.analysisVersion,
    clientVersion:CLIENT_VERSION,
    ruleVersion:OFFICIAL_RULE_VERSION,
    maxTaps:MAX_TAPS,
    layoutId:OFFICIAL_LAYOUT_ID,
    layoutVersion:OFFICIAL_LAYOUT_VERSION,
    layoutFingerprint:OFFICIAL_LAYOUT_FINGERPRINT,
    waveSpeed:WAVE_SPEED,
    scoreHardCeiling:SCORE_HARD_CEILING,
    percentileMethod:STRATEGY_ANALYSIS_CONFIG.percentileMethod,
    coordinateDomain:STRATEGY_ANALYSIS_CONFIG.coordinateDomain,
    randomTimestamps:STRATEGY_ANALYSIS_CONFIG.random.timestamps,
    random:{calibration,holdout},
    repeated:{
      ...repeated.report,
      ratioFromDesigned:Number((designed.score/repeated.report.maximum.score).toFixed(3))
    },
    twoPointBaseline:{
      ...twoPointBaseline,
      ratioFromDesigned:Number((designed.score/twoPointBaseline.maximum.score).toFixed(3))
    },
    designed:{
      inputs:STRATEGY_ANALYSIS_CONFIG.designedInputs,
      ...designed,
      ratioToCalibrationMedian:Number((designed.score/calibration.median).toFixed(3)),
      ratioToHoldoutMedian:Number((designed.score/holdout.median).toFixed(3))
    },
    refreshRateChecks
  };
}
