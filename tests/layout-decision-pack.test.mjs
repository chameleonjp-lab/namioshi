import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const guide=read('../docs/OFFICIAL_LAYOUT_DECISION_GUIDE_v3.md');
const selection=read('../docs/OFFICIAL_LAYOUT_SELECTION_v3.md');
const horizontal=read('../docs/layout-previews/layout-comparison.svg');
const mobile=read('../docs/layout-previews/layout-comparison-mobile.svg');

test('decision guide and selection record adopt candidate C for implementation',()=>{
  assert.match(guide,/candidate-c-selected-for-implementation/);
  assert.match(guide,/候補C・開港型を公式配置の実装対象として採用/);
  assert.match(guide,/公開承認: 未完了/);
  assert.match(selection,/selected-for-implementation/);
  assert.match(selection,/候補Cでまずは実装/);
  assert.match(selection,/candidate-c-open-harbor/);
  assert.match(selection,/fnv1a-fc71e804/);
  assert.match(selection,/namioshi-v3-layout-study-001/);
});

test('comparison SVGs remain accessible pre-selection history',()=>{
  for(const [name,svg] of [['horizontal',horizontal],['mobile',mobile]]){
    assert.match(svg,/^<svg\b/);
    assert.match(svg,/role="img"/);
    assert.match(svg,/<title\b/);
    assert.match(svg,/候補A・交差流/);
    assert.match(svg,/候補B・段流路/);
    assert.match(svg,/候補C・開港型/);
    assert.match(svg,/採用状態: 人の判断待ち/);
    assert.ok(svg.length>1000,`${name} preview is unexpectedly small`);
  }
  assert.match(guide,/画像内の「人の判断待ち」は比較時点の状態/);
});

test('decision guide links selection record and both comparison previews',()=>{
  assert.match(guide,/OFFICIAL_LAYOUT_SELECTION_v3\.md/);
  assert.match(guide,/layout-previews\/layout-comparison-mobile\.svg/);
  assert.match(guide,/layout-previews\/layout-comparison\.svg/);
});
