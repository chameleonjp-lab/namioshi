import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/ui/styles.css',import.meta.url),'utf8');

test('screen controls expose labels, status regions, and state semantics',()=>{
  assert.match(main,/<canvas id="game" role="img" aria-label="[^"]+">/);
  assert.match(main,/<label class="srOnly" for="name">名前<\/label>/);
  assert.match(main,/id="name"[^>]*autocomplete="nickname"[^>]*aria-describedby="nameHint"/);
  assert.match(main,/id="guideOverlay"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(main,/id="countdownText"[^>]*role="status"[^>]*aria-live="assertive"/);
  assert.match(main,/id="resultStorageStatus"[^>]*role="status"/);
  assert.match(main,/function focusStateTarget\(nextState\)/);
  assert.match(main,/STATE_FOCUS_TARGETS/);
  assert.match(main,/setAttribute\?\.\('aria-hidden',String\(!visible\)\)/);
  assert.match(main,/addEventListener\('orientationchange',resize\)/);
  assert.match(main,/globalThis\.visualViewport\?\.addEventListener\('resize',resize\)/);
});

test('styles protect safe areas and provide landscape and motion accommodations',()=>{
  assert.match(styles,/--safe-top:env\(safe-area-inset-top,0px\)/);
  assert.match(styles,/--safe-right:env\(safe-area-inset-right,0px\)/);
  assert.match(styles,/--safe-bottom:env\(safe-area-inset-bottom,0px\)/);
  assert.match(styles,/--safe-left:env\(safe-area-inset-left,0px\)/);
  assert.match(styles,/height:100dvh/);
  assert.match(styles,/overflow-x:hidden/);
  assert.match(styles,/:is\(button,a,input,textarea\):focus-visible/);
  assert.match(styles,/\.srOnly\{/);
  assert.match(styles,/@media\(orientation:landscape\)/);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
});
