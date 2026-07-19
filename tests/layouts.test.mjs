import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LAYOUT_CANDIDATES,LAYOUT_RULE_VERSION} from '../tools/layout-candidates.js';
import {analyzeLayouts,layoutFingerprint,REFERENCE_TAPS,validateLayout} from '../tools/layout-analysis.js';

const snapshot=JSON.parse(readFileSync(new URL('../tools/layout-analysis.snapshot.json',import.meta.url),'utf8'));

test('study has at least three neutral candidates with the same rule version',()=>{
  assert.ok(LAYOUT_CANDIDATES.length>=3);
  assert.equal(new Set(LAYOUT_CANDIDATES.map(layout=>layout.id)).size,LAYOUT_CANDIDATES.length);
  for(const layout of LAYOUT_CANDIDATES){
    assert.equal(layout.ruleVersion,LAYOUT_RULE_VERSION);
    assert.equal(layout.beacons.length,3);
    assert.equal(layout.glass.length,4);
    assert.equal(layout.selected,undefined);
    assert.equal(layout.official,undefined);
    assert.deepEqual(validateLayout(layout),[]);
  }
});

test('candidate fingerprints are stable and unique',()=>{
  const fingerprints=LAYOUT_CANDIDATES.map(layoutFingerprint);
  assert.equal(new Set(fingerprints).size,fingerprints.length);
  assert.deepEqual(fingerprints,snapshot.results.map(result=>result.fingerprint));
});

test('analysis snapshot matches the current candidate data',()=>{
  const current={
    schemaVersion:1,
    ruleVersion:LAYOUT_RULE_VERSION,
    selectionStatus:'human-decision-pending',
    referenceTaps:REFERENCE_TAPS,
    results:analyzeLayouts(LAYOUT_CANDIDATES)
  };
  assert.deepEqual(current,snapshot);
});

test('all candidates offer direct, wall, glass, and double-reflection routes to every beacon',()=>{
  for(const result of snapshot.results){
    for(const kind of ['direct','wall','glass','double']){
      assert.ok(result.routes[kind]>0,`${result.id} has no ${kind} route`);
      assert.equal(result.beaconCoverage[kind].length,3,`${result.id} ${kind} coverage`);
    }
    assert.equal(result.doubleReflectionPossible,true);
    assert.equal(result.doubleReflectionBeaconCount,3);
    assert.equal(result.reflectedTapDiversity,result.samples.tapPoints);
  }
});

test('the same three reference taps are used and geometric score estimates stay within the v3 ceiling',()=>{
  assert.deepEqual(snapshot.referenceTaps,[{x:90,y:140},{x:180,y:340},{x:270,y:490}]);
  for(const result of snapshot.results){
    assert.deepEqual(result.referenceTaps,snapshot.referenceTaps);
    assert.ok(result.referenceDirectScore>=0&&result.referenceDirectScore<=216);
    assert.ok(result.referenceBestScore>=result.referenceDirectScore&&result.referenceBestScore<=3240);
  }
});
