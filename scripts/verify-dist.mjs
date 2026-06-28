import{readdirSync,readFileSync,statSync}from'node:fs';import{join}from'node:path';
const bad=[];
const stale=[
  ['legacy GAME_URL constant',/const\s+GAME_URL\s*=/],
  ['legacy app lookup',/const\s+app\s*=\s*document\.getElementById\(['"]app['"]\)/],
  ['legacy draw function',/function\s+draw\s*\(\s*t\s*\)/],
  ['legacy shared-canvas WebGL context',/gl\s*=\s*cv\.getContext\(['"]webgl['"]/],
  ['legacy shared-canvas 2D context',/ctx\s*=\s*cv\.getContext\(['"]2d['"]/],
  ['legacy hand-written build script reference',/scripts\/build\.mjs/]
];
function walk(d){for(const f of readdirSync(d)){const p=join(d,f),s=statSync(p);if(s.isDirectory())walk(p);else{if(p.endsWith('.map'))bad.push('source map: '+p);const txt=readFileSync(p,'utf8');if(/https?:\/\/(?!chameleonjp\.codeberg\.page(?:[\/'\"]|$)|chameleonjp\.supabase\.co(?:[\/'\"]|$))/.test(txt))bad.push('external CDN/url: '+p);if(/service_role/i.test(txt))bad.push('service_role string: '+p);if(/ranking_scores/.test(txt))bad.push('direct ranking_scores reference: '+p);for(const[label,re]of stale)if(re.test(txt))bad.push(label+': '+p)}}}
walk('dist');if(bad.length){console.error(bad.join('\n'));process.exit(1)}console.log('verify ok: no source maps, external CDN, service_role, direct ranking_scores POST, or legacy hand-written dist markers');
