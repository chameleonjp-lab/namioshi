import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {LAYOUT_CANDIDATES,LAYOUT_RULE_VERSION} from './layout-candidates.js';
import {analyzeLayouts,REFERENCE_TAPS} from './layout-analysis.js';

const snapshotPath=fileURLToPath(new URL('./layout-analysis.snapshot.json',import.meta.url));
const result={
  schemaVersion:1,
  ruleVersion:LAYOUT_RULE_VERSION,
  selectionStatus:'human-decision-pending',
  referenceTaps:REFERENCE_TAPS,
  results:analyzeLayouts(LAYOUT_CANDIDATES)
};
const serialized=JSON.stringify(result,null,2)+'\n';

if(process.argv.includes('--write')){
  writeFileSync(snapshotPath,serialized);
  console.log(`wrote ${snapshotPath}`);
}else{
  const expected=readFileSync(snapshotPath,'utf8');
  if(expected!==serialized){
    console.error('layout analysis snapshot is stale; run npm run analyze:layouts:write and review the changed metrics');
    process.exit(1);
  }
}

for(const entry of result.results){
  console.log([
    entry.id,
    `direct=${entry.routes.direct}`,
    `wall=${entry.routes.wall}`,
    `glass=${entry.routes.glass}`,
    `double=${entry.routes.double}`,
    `referenceBest=${entry.referenceBestScore}`,
    `riskPairs=${entry.beaconGlassRiskPairs.length}`,
    `fingerprint=${entry.fingerprint}`
  ].join(' '));
}
console.log(`selection status: ${result.selectionStatus}`);
