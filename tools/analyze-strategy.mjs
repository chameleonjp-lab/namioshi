import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {analyzeStrategy} from './strategy-analysis.js';

const result=analyzeStrategy();
const serialized=JSON.stringify(result,null,2)+'\n';
const snapshotPath=fileURLToPath(new URL('./strategy-analysis.snapshot.json',import.meta.url));
const failures=[];

if(process.argv.includes('--write')){
  writeFileSync(snapshotPath,serialized);
  console.log(`wrote ${snapshotPath}`);
}else{
  let expected=null;
  try{expected=JSON.parse(readFileSync(snapshotPath,'utf8'))}catch{}
  if(!expected||JSON.stringify(expected)!==JSON.stringify(result)){
    failures.push('strategy analysis snapshot is stale; run npm run analyze:strategy:write and review the changed metrics');
  }
}

if(result.waveSpeed!==110)failures.push(`wave speed ${result.waveSpeed} is not 110`);
for(const [label,entry] of Object.entries(result.random)){
  if(entry.runs!==1000)failures.push(`${label} random run count ${entry.runs} is not 1000`);
  if(entry.q10<1100)failures.push(`${label} random q10 ${entry.q10} is below 1100`);
  if(entry.median>2100)failures.push(`${label} random median ${entry.median} exceeds 2100`);
  if(entry.q90>2600)failures.push(`${label} random q90 ${entry.q90} exceeds 2600`);
  if(entry.maximum>3500)failures.push(`${label} random maximum ${entry.maximum} exceeds 3500`);
  if(entry.zeroScores!==0)failures.push(`${label} random has ${entry.zeroScores} zero scores`);
  if(entry.doubleShareMedian<.25||entry.doubleShareMedian>.45){
    failures.push(`${label} double-reflection median share ${entry.doubleShareMedian} is outside 0.25..0.45`);
  }
  if(entry.scoreDrops!==0)failures.push(`${label} random score dropped ${entry.scoreDrops} times`);
  if(entry.integrityFailures!==0)failures.push(`${label} random has ${entry.integrityFailures} integrity failures`);
}
const medianRatio=result.random.calibration.median/result.random.holdout.median;
if(medianRatio<.9||medianRatio>1.1)failures.push(`calibration/holdout median ratio ${medianRatio} is outside 0.9..1.1`);

if(result.repeated.maximum.score>3300){
  failures.push(`full-round same-point maximum ${result.repeated.maximum.score} exceeds 3300`);
}
if(result.repeated.ratioFromDesigned<1.25){
  failures.push(`designed/same-point ratio ${result.repeated.ratioFromDesigned} is below 1.25`);
}
if(result.repeated.maximum.routeKnownCount<=0){
  failures.push('full-round same-point maximum does not report any known routes');
}
if(result.repeated.scoreDrops!==0||result.repeated.integrityFailures!==0){
  failures.push('full-round same-point search has score drops or integrity failures');
}
if(result.twoPointBaseline.maximum.score>=result.designed.score){
  failures.push(`two-point baseline ${result.twoPointBaseline.maximum.score} is not below designed ${result.designed.score}`);
}
if(result.twoPointBaseline.ratioFromDesigned<1.25){
  failures.push(`designed/two-point ratio ${result.twoPointBaseline.ratioFromDesigned} is below 1.25`);
}
if(result.twoPointBaseline.scoreDrops!==0||result.twoPointBaseline.integrityFailures!==0){
  failures.push('two-point baseline has score drops or integrity failures');
}
if(result.designed.score<4200)failures.push(`designed score ${result.designed.score} is below 4200`);
if(result.designed.ratioToCalibrationMedian<2){
  failures.push(`designed/calibration ratio ${result.designed.ratioToCalibrationMedian} is below 2`);
}
if(result.designed.ratioToHoldoutMedian<2){
  failures.push(`designed/holdout ratio ${result.designed.ratioToHoldoutMedian} is below 2`);
}

function consistent(entry){
  return entry.score===entry.routeLedgerSum&&
    entry.score===entry.breakdownSum&&
    entry.score===entry.routeSummaryPoints&&
    entry.stepCount===1800&&
    entry.queueLength===0&&
    entry.scoreDrops===0;
}

if(!consistent(result.designed))failures.push('designed score, ledgers, summaries, steps, or queue differ');
for(const [scenario,rates] of Object.entries(result.refreshRateChecks)){
  const entries=Object.values(rates);
  if(entries.some(entry=>JSON.stringify(entry)!==JSON.stringify(entries[0]))){
    failures.push(`${scenario} differs between 20/30/60/120Hz`);
  }
  if(entries.some(entry=>!consistent(entry)))failures.push(`${scenario} has an integrity failure at a refresh rate`);
}

console.log(serialized);
if(failures.length){
  console.error(failures.join('\n'));
  process.exit(1);
}
