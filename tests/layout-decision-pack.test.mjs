import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const guide=read('../docs/OFFICIAL_LAYOUT_DECISION_GUIDE_v3.md');
const horizontal=read('../docs/layout-previews/layout-comparison.svg');
const mobile=read('../docs/layout-previews/layout-comparison-mobile.svg');

test('decision guide keeps selection pending while recommending candidate C for device review',()=>{
  assert.match(guide,/human-decision-pending/);
  assert.match(guide,/初回の実機確認へ進める優先候補は、候補C・開港型/);
  assert.match(guide,/採用決定ではありません/);
  for(const option of ['候補Aを採用','候補Bを採用','候補Cを採用','候補Dを追加して再比較'])assert.match(guide,new RegExp(option));
});

test('both comparison SVGs contain all three candidates and remain accessible images',()=>{
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
});

test('decision guide embeds the mobile preview and links the horizontal preview',()=>{
  assert.match(guide,/layout-previews\/layout-comparison-mobile\.svg/);
  assert.match(guide,/layout-previews\/layout-comparison\.svg/);
});
