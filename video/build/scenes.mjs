// Builds index.html and compositions/*.html from build/timing.json.
// All figures are precomputed here (seeded, deterministic) so the render never uses randomness.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const T = JSON.parse(readFileSync(join(ROOT, 'build', 'timing.json'), 'utf8'));
mkdirSync(join(ROOT, 'compositions'), { recursive: true });

/* ---------------- maths (same as the website) ---------------- */
function lgamma(x){ const c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI/Math.abs(Math.sin(Math.PI*x))) - lgamma(1-x); x -= 1; let a = c[0]; const t = x + 7.5; for (let i = 1; i < 9; i++) a += c[i]/(x+i); return 0.5*Math.log(2*Math.PI) + (x+0.5)*Math.log(t) - t + Math.log(a); }
function betacf(a,b,x){ const FP=1e-300; let qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap; if(Math.abs(d)<FP)d=FP; d=1/d; let h=d;
  for(let m=1;m<=300;m++){ const m2=2*m; let aa=m*(b-m)*x/((qam+m2)*(a+m2)); d=1+aa*d; if(Math.abs(d)<FP)d=FP; c=1+aa/c; if(Math.abs(c)<FP)c=FP; d=1/d; h*=d*c; aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2)); d=1+aa*d; if(Math.abs(d)<FP)d=FP; c=1+aa/c; if(Math.abs(c)<FP)c=FP; d=1/d; const del=d*c; h*=del; if(Math.abs(del-1)<3e-14) break; } return h; }
function ibeta(x,a,b){ if(x<=0)return 0; if(x>=1)return 1; const bt=Math.exp(lgamma(a+b)-lgamma(a)-lgamma(b)+a*Math.log(x)+b*Math.log(1-x)); return x<(a+1)/(a+b+2)?bt*betacf(a,b,x)/a:1-bt*betacf(b,a,1-x)/b; }
const tcdf = (t, df) => { const x = df/(df+t*t), p = 0.5*ibeta(x, df/2, 0.5); return t > 0 ? 1-p : p; };
const tpdf = (t, df) => Math.exp(lgamma((df+1)/2) - lgamma(df/2) - 0.5*Math.log(df*Math.PI) - (df+1)/2*Math.log(1+t*t/df));
const npdf = z => Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);
const betaPdf = (x, a, b) => Math.exp((a-1)*Math.log(x) + (b-1)*Math.log(1-x) - (lgamma(a)+lgamma(b)-lgamma(a+b)));
const binom = (j, n, q) => Math.exp(lgamma(n+1)-lgamma(j+1)-lgamma(n-j+1)+j*Math.log(q)+(n-j)*Math.log(1-q));
let seed = 20260611; const rnd = () => (seed = (seed*1664525 + 1013904223) >>> 0) / 4294967296;
const randn = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*rnd()); };
const f1 = x => x.toFixed(1), f2 = x => x.toFixed(2);
const lin = (d0, d1, r0, r1) => v => r0 + (v - d0)/(d1 - d0)*(r1 - r0);
const pathFn = (f, a, b, X, Y, n = 240) => { let s = ''; for (let i = 0; i <= n; i++){ const v = a + (b - a)*i/n; s += (i ? 'L' : 'M') + X(v).toFixed(1) + ',' + Y(f(v)).toFixed(1); } return s; };
const areaFn = (f, a, b, X, Y, n = 160) => pathFn(f, a, b, X, Y, n) + `L${X(b).toFixed(1)},${Y(0).toFixed(1)}L${X(a).toFixed(1)},${Y(0).toFixed(1)}Z`;

/* ---------------- shared look ---------------- */
const C = { chalk:'#f5f2e7', dim:'#c9cfc3', faint:'rgba(245,242,231,.16)', amber:'#d9a44a', amberSoft:'#f3d9a8', red:'#e0604f', redBall:'#c24b3a', yellow:'#d9a44a', mint:'#8fd3a8', blue:'#9cc3ea', orange:'#e8912f', leaf:'#3f7d5a' };
const CSS = (sid) => `
#root{position:absolute;inset:0;overflow:hidden;color:${C.chalk};font-family:'Inter',sans-serif;
  background:radial-gradient(1500px 760px at 18% -4%,rgba(60,140,108,.42),transparent 62%),linear-gradient(165deg,#134232 0%,#0b2c21 58%,#082119 100%)}
#${sid}-c{position:absolute;inset:0}
.tag{position:absolute;left:132px;top:96px;font:500 28px 'IBM Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:${C.amber}}
.ttl{position:absolute;left:130px;top:132px;font:600 66px 'EB Garamond',serif;letter-spacing:-.01em;color:${C.chalk};white-space:nowrap}
.abs{position:absolute}
.lbl{font:500 30px 'Inter',sans-serif;color:${C.dim}}
.mono{font-family:'IBM Plex Mono',monospace}
.serif{font-family:'EB Garamond',serif}
.card{position:absolute;background:rgba(245,242,231,.06);border:1px solid rgba(245,242,231,.18);border-radius:12px}
.chip{position:absolute;border-radius:999px;padding:12px 26px;font:600 30px 'Inter',sans-serif;white-space:nowrap}
svg{position:absolute;overflow:visible}
svg text{font-family:'IBM Plex Mono',monospace}
`;
const BALL = { red:['#f4917d','#c24b3a','#74251c','#5e1d15'], yellow:['#f6d79a','#d9a44a','#8a5d12','#6b470c'], white:['#fffdf6','#efe9d8','#c9c0a9','#b3a98f'], orange:['#ffc27a','#e8912f','#9a4f0c','#7a3d08'] };
const defs = sid => `<defs>${Object.entries(BALL).map(([k, s]) => `<radialGradient id="${sid}-g-${k}" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="${s[0]}"/><stop offset="55%" stop-color="${s[1]}"/><stop offset="100%" stop-color="${s[2]}"/></radialGradient>`).join('')}</defs>`;
const ball = (sid, id, x, y, r, kind) => `<circle id="${id}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="url(#${sid}-g-${kind})" stroke="${BALL[kind][3]}" stroke-width="1"/>`;

/* tween helpers (emit GSAP code) */
const fade = (sel, t, o = {}) => `tl.fromTo(${JSON.stringify(sel)},{opacity:0,y:${o.dy ?? 18}${o.x !== undefined ? ',x:' + o.x : ''}},{opacity:${o.to ?? 1},y:0${o.x !== undefined ? ',x:0' : ''},duration:${o.d ?? .6},ease:"power2.out"${o.stagger ? ',stagger:' + o.stagger : ''}},${t.toFixed(2)});`;
const out = (sel, t, o = {}) => `tl.to(${JSON.stringify(sel)},{opacity:${o.to ?? 0},duration:${o.d ?? .45},ease:"power1.inOut"},${t.toFixed(2)});`;
const draw = (sel, t, d = 1.2, ease = 'power1.inOut') => `tl.fromTo(${JSON.stringify(sel)},{strokeDashoffset:1},{strokeDashoffset:0,duration:${d},ease:"${ease}"},${t.toFixed(2)});`;
const grow = (sel, t, o = {}) => `tl.fromTo(${JSON.stringify(sel)},{scaleY:0,transformOrigin:"50% 100%"},{scaleY:1,duration:${o.d ?? .5},ease:"power2.out"${o.stagger ? ',stagger:' + o.stagger : ''}},${t.toFixed(2)});`;
const pop = (sel, t, o = {}) => `tl.fromTo(${JSON.stringify(sel)},{opacity:0,scale:${o.from ?? .4},transformOrigin:"50% 50%"},{opacity:1,scale:1,duration:${o.d ?? .45},ease:"back.out(1.7)"${o.stagger ? ',stagger:' + o.stagger : ''}},${t.toFixed(2)});`;

function scene(sid, inner, tweens, sc){
  const tail = sc.dur - 0.45;
  return `<template>
<style>${CSS(sid)}</style>
<div id="root" data-composition-id="${sid}" data-width="1920" data-height="1080">
<div id="${sid}-c" data-layout-allow-overlap>
${inner}
</div>
</div>
<script>
const tl = gsap.timeline({ paused: true });
${tweens.join('\n')}
tl.fromTo("#${sid}-c",{scale:1,transformOrigin:"50% 45%"},{scale:1.035,duration:${sc.dur.toFixed(2)},ease:"none"},0);
tl.to("#${sid}-c",{opacity:0,duration:.4,ease:"power1.in"},${tail.toFixed(2)});
window.__timelines["${sid}"] = tl;
</script>
</template>
`;
}
const head = (sid, sc, tag, title) => ({
  html: `<div id="${sid}-tag" class="tag">${tag}</div><div id="${sid}-ttl" class="ttl">${title}</div>`,
  tw: [fade(`#${sid}-tag`, .15, { d: .5 }), fade(`#${sid}-ttl`, .3, { d: .7 })]
});

const S = Object.fromEntries(T.scenes.map(s => [s.id, s]));
const cue = (sc, i, f = 0) => sc.beats[i-1].start + sc.beats[i-1].dur*f;
const files = {};

/* =============================== INTRO =============================== */
{ const sid = 'intro', sc = S[sid]; const tw = []; let h = '';
  // orchard: 5 rows of trees, oranges on each
  const trees = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) trees.push({ x: 170 + c*105 + (r%2)*52, y: 300 + r*128, r: 50 + ((r*9+c)%3)*4 });
  let svg = `<svg id="${sid}-orch" width="1920" height="1080" viewBox="0 0 1920 1080" style="left:0;top:0">${defs(sid)}`;
  trees.forEach((t, i) => { svg += `<g id="${sid}-tr${i}" class="${sid}-tree"><circle cx="${t.x}" cy="${t.y}" r="${t.r}" fill="${C.leaf}" opacity=".85"/><circle cx="${t.x-12}" cy="${t.y-14}" r="${t.r*.55}" fill="#4f9470" opacity=".7"/>`;
    for (let k = 0; k < 5; k++){ const a = rnd()*6.28, d = Math.sqrt(rnd())*t.r*.72; svg += ball(sid, `${sid}-o${i}_${k}`, t.x + Math.cos(a)*d, t.y + Math.sin(a)*d, 7.5, 'orange'); } svg += `</g>`; });
  const pick = [3, 8, 11, 15, 19, 22, 27, 31, 36, 40];
  pick.forEach((ti, k) => { const t = trees[ti]; svg += `<circle id="${sid}-pk${k}" class="${sid}-pick" cx="${t.x}" cy="${t.y}" r="${t.r + 10}" fill="none" stroke="${C.amber}" stroke-width="4"/>`; });
  svg += `</svg>`;
  h += svg;
  h += `<div id="${sid}-mu" class="abs serif" style="left:1300px;top:330px;font-size:150px;font-style:italic;color:${C.amber}">μ = ?</div>`;
  h += `<div id="${sid}-mul" class="abs lbl" style="left:1306px;top:530px;width:480px;font-size:34px;line-height:1.4">the average weight of every orange in the orchard</div>`;
  h += `<div id="${sid}-n" class="abs lbl" style="left:1306px;top:690px;font-size:34px;color:${C.amberSoft}">a handful: <span class="mono">n = 10</span></div>`;
  h += `<div id="${sid}-veil" class="abs" style="left:0;top:0;width:1920px;height:1080px;background:#0a281d"></div>`;
  h += `<div id="${sid}-title" class="abs serif" style="left:0;width:1920px;top:380px;text-align:center;font-size:118px;font-weight:600;letter-spacing:-.01em">The Pool Table <span style="color:${C.amber};font-style:italic">&amp;</span> the Orchard</div>`;
  h += `<div id="${sid}-sub" class="abs" style="left:0;width:1920px;top:560px;text-align:center;font:400 38px Inter;color:${C.dim}">Understanding frequentist inference, chapter by chapter</div>`;
  tw.push(pop(`.${sid}-tree`, .3, { stagger: .035, d: .5, from: .6 }));
  tw.push(fade(`#${sid}-mu`, cue(sc, 1, .55), { d: .8 }), fade(`#${sid}-mul`, cue(sc, 1, .7)));
  tw.push(pop(`.${sid}-pick`, cue(sc, 2, .45), { stagger: .12, from: 1.6 }), fade(`#${sid}-n`, cue(sc, 2, .55)));
  tw.push(out([`#${sid}-mu`, `#${sid}-mul`, `#${sid}-n`].join(','), cue(sc, 3, 0) - .1, { d: .5 }));
  tw.push(`tl.fromTo("#${sid}-veil",{opacity:0},{opacity:.82,duration:.9},${cue(sc, 3, .05).toFixed(2)});`);
  tw.push(fade(`#${sid}-title`, cue(sc, 3, .15), { d: 1, dy: 26 }), fade(`#${sid}-sub`, cue(sc, 3, .35), { d: .9 }));
  files[sid] = scene(sid, h, tw, sc);
}

/* =============================== CH0: POOL TABLE =============================== */
{ const sid = 'ch0', sc = S[sid]; const H = head(sid, sc, 'Chapter 0', 'The pool table'); let h = H.html; const tw = [...H.tw];
  const tx0 = 130, ty0 = 290, tw0 = 900, th0 = 520, pad = 34;
  const fx0 = tx0 + pad, fy0 = ty0 + pad, fw = tw0 - 2*pad, fh = th0 - 2*pad, P = .37;
  const Hy = v => fy0 + 16 + (1 - v)*(fh - 32);
  const balls = [[.12,.68],[.29,.22],[.45,.82],[.58,.46],[.66,.62],[.81,.18],[.93,.86]];
  let s = `<svg id="${sid}-tbl" width="1920" height="1080" viewBox="0 0 1920 1080" style="left:0;top:0">${defs(sid)}
  <rect x="${tx0}" y="${ty0}" width="${tw0}" height="${th0}" rx="26" fill="#3f2c22"/>
  <rect x="${fx0-8}" y="${fy0-8}" width="${fw+16}" height="${fh+16}" rx="8" fill="#16503c"/>
  <rect x="${fx0}" y="${fy0}" width="${fw}" height="${fh}" rx="4" fill="#1c5c45"/>
  ${[[fx0,fy0],[fx0+fw/2,fy0-4],[fx0+fw,fy0],[fx0,fy0+fh],[fx0+fw/2,fy0+fh+4],[fx0+fw,fy0+fh]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="21" fill="#0b241b"/>`).join('')}
  <line id="${sid}-line" x1="${fx0+10}" y1="${Hy(P)}" x2="${fx0+fw-10}" y2="${Hy(P)}" stroke="#efe9d8" stroke-width="2" stroke-dasharray="10 9" opacity=".55"/>
  ${ball(sid, `${sid}-white`, fx0 + .47*fw, Hy(P), 20, 'white')}
  ${balls.map(([x, y], i) => ball(sid, `${sid}-ball${i}`, fx0 + 20 + x*(fw-40), Hy(y), 16, y < P ? 'red' : 'yellow')).join('')}
  </svg>`;
  h += s;
  h += `<div id="${sid}-yr" class="abs mono" style="left:${tx0}px;top:${ty0+th0+26}px;font-size:28px;color:${C.dim}">Thomas Bayes · essay published 1763</div>`;
  h += `<div id="${sid}-cnt" class="abs" style="left:${tx0}px;top:${ty0+th0+70}px;font:600 30px Inter"><span style="color:#f08a78">● 2 below</span>&nbsp;&nbsp;&nbsp;<span style="color:${C.amber}">● 5 above</span></div>`;
  h += `<div id="${sid}-q" class="abs serif" style="left:1130px;top:430px;width:680px;font-size:84px;font-style:italic;line-height:1.1">Where is the white ball?</div>`;
  // Bayesian chart
  const bx0 = 1130, bx1 = 1790, by0 = 330, by1 = 560, X = lin(0, 1, bx0, bx1);
  const Yb1 = lin(0, 3.2, by1, by0 + 30), Yb2 = lin(0, 7.6, by1, by0 + 30);
  h += `<div id="${sid}-bh" class="abs" style="left:${bx0}px;top:${by0-46}px;font:700 32px Inter;color:${C.blue}">Bayesian <span style="font-weight:400;color:${C.dim};font-size:28px">· p is uncertain</span></div>`;
  h += `<svg id="${sid}-bc" width="1920" height="1080" style="left:0;top:0">
    <line x1="${bx0}" y1="${by1}" x2="${bx1}" y2="${by1}" stroke="${C.faint}" stroke-width="2"/>
    <path id="${sid}-bA" d="${areaFn(x => betaPdf(x, 3, 6), .002, .998, X, Yb1)}" fill="rgba(156,195,234,.16)"/>
    <path id="${sid}-b1" d="${pathFn(x => betaPdf(x, 3, 6), .002, .998, X, Yb1)}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" fill="none" stroke="${C.blue}" stroke-width="4"/>
    <path id="${sid}-b2" d="${pathFn(x => betaPdf(x, 27, 45), .002, .998, X, Yb2)}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" fill="none" stroke="${C.blue}" stroke-width="4"/>
    <text id="${sid}-b2l" x="${X(.37)+40}" y="${by0+40}" fill="${C.blue}" font-size="28">after 70 balls</text>
  </svg>`;
  // Frequentist chart
  const qy0 = 680, qy1 = 900, Yq = lin(0, .32, qy1, qy0 + 20);
  h += `<div id="${sid}-fh" class="abs" style="left:${bx0}px;top:${qy0-50}px;font:700 32px Inter;color:${C.amber}">Frequentist <span style="font-weight:400;color:${C.dim};font-size:28px">· p is fixed</span></div>`;
  let bars = ''; for (let j = 0; j <= 7; j++){ const v = binom(j, 7, P), x = X(j/7); bars += `<rect class="${sid}-qb" x="${(x-17).toFixed(1)}" y="${Yq(v).toFixed(1)}" width="34" height="${(qy1-Yq(v)).toFixed(1)}" rx="3" fill="rgba(245,242,231,.72)"/>`; }
  h += `<svg id="${sid}-fc" width="1920" height="1080" style="left:0;top:0">
    <line x1="${bx0}" y1="${qy1}" x2="${bx1}" y2="${qy1}" stroke="${C.faint}" stroke-width="2"/>${bars}
    <line id="${sid}-pl" x1="${X(P)}" y1="${qy0}" x2="${X(P)}" y2="${qy1}" stroke="${C.chalk}" stroke-width="3" stroke-dasharray="7 6"/>
    <text id="${sid}-plt" x="${X(P)+12}" y="${qy0+16}" fill="${C.chalk}" font-size="28">p (fixed)</text>
    <text id="${sid}-pht" x="${bx1}" y="${qy1+40}" fill="${C.dim}" font-size="28" text-anchor="end">estimates p̂ over repeated experiments</text>
  </svg>`;
  h += `<div id="${sid}-ban" class="abs serif" style="left:0;width:1920px;top:950px;text-align:center;font-size:50px;font-style:italic;color:${C.amberSoft}">“How would my method behave over repetitions?”</div>`;
  tw.push(fade(`#${sid}-tbl`, cue(sc, 1, .05), { d: .8, dy: 30 }), fade(`#${sid}-yr`, cue(sc, 1, .45)));
  tw.push(pop(`#${sid}-white`, cue(sc, 2, .12)), fade(`#${sid}-line`, cue(sc, 2, .2), { dy: 0 }));
  balls.forEach((b, i) => tw.push(`tl.fromTo("#${sid}-ball${i}",{opacity:0,x:${(fx0+fw - (fx0+20+b[0]*(fw-40))).toFixed(0)}},{opacity:1,x:0,duration:.9,ease:"power3.out"},${cue(sc, 2, .38 + i*.075).toFixed(2)});`));
  tw.push(fade(`#${sid}-cnt`, cue(sc, 2, .92)));
  tw.push(fade(`#${sid}-q`, cue(sc, 3, .05), { d: .7 }), out(`#${sid}-q`, cue(sc, 4, 0) - .2));
  tw.push(fade(`#${sid}-bh`, cue(sc, 4, .02)), `tl.fromTo("#${sid}-bA",{opacity:0},{opacity:1,duration:.8},${cue(sc, 4, .1).toFixed(2)});`, draw(`#${sid}-b1`, cue(sc, 4, .08), 1.4));
  tw.push(out(`#${sid}-bA`, cue(sc, 4, .62)), out(`#${sid}-b1`, cue(sc, 4, .62), { to: .25 }), draw(`#${sid}-b2`, cue(sc, 4, .62), 1.2), fade(`#${sid}-b2l`, cue(sc, 4, .8), { dy: 0 }));
  tw.push(fade(`#${sid}-fh`, cue(sc, 5, .02)), fade(`#${sid}-pl`, cue(sc, 5, .2), { dy: 0 }), fade(`#${sid}-plt`, cue(sc, 5, .2), { dy: 0 }), grow(`.${sid}-qb`, cue(sc, 5, .55), { stagger: .09 }), fade(`#${sid}-pht`, cue(sc, 5, .75), { dy: 0 }));
  tw.push(fade(`#${sid}-ban`, cue(sc, 6, .1), { d: .8 }));
  files[sid] = scene(sid, h, tw, sc);
}

/* =============================== CH1: FIXED TRUTH =============================== */
{ const sid = 'ch1', sc = S[sid]; const H = head(sid, sc, 'Chapter 1', 'A fixed truth, a random sample'); let h = H.html; const tw = [...H.tw];
  const sets = [[118,152,131,147,139,160,124,143,155,121]];
  for (let k = 0; k < 2; k++) sets.push(Array.from({ length: 10 }, () => Math.round(145 + 15*randn())));
  const means = sets.map(s => s.reduce((a, b) => a + b, 0)/10);
  h += `<div id="${sid}-mucard" class="card" style="left:130px;top:300px;width:640px;height:300px"></div>`;
  h += `<svg id="${sid}-wb" width="1920" height="1080" style="left:0;top:0">${defs(sid)}${ball(sid, `${sid}-white`, 250, 450, 46, 'white')}</svg>`;
  h += `<div id="${sid}-mu" class="abs serif" style="left:340px;top:360px;font-size:96px;font-style:italic;color:${C.chalk}">μ</div>`;
  h += `<div id="${sid}-mut" class="abs" style="left:430px;top:378px;font:500 32px Inter;color:${C.dim};line-height:1.45">true average weight<br><span style="color:${C.amberSoft}">fixed · hidden</span></div>`;
  h += `<div id="${sid}-same" class="abs mono" style="left:160px;top:540px;font-size:28px;color:${C.mint}">✓ unchanged by any sample</div>`;
  h += `<div id="${sid}-map" class="abs" style="left:860px;top:330px;font:500 34px Inter;color:${C.dim};line-height:1.9">white ball &nbsp;→&nbsp; <span class="serif" style="font-style:italic;color:${C.chalk};font-size:42px">μ</span><br>red balls &nbsp;→&nbsp; <span style="color:${C.chalk}">the oranges we pick</span></div>`;
  // oranges row with three weight sets
  const ox0 = 190, oy = 730, step = 162;
  let svg = `<svg id="${sid}-row" width="1920" height="1080" style="left:0;top:0">${defs(sid)}`;
  for (let i = 0; i < 10; i++) svg += ball(sid, `${sid}-or${i}`, ox0 + i*step, oy, 38, 'orange');
  svg += `</svg>`; h += svg;
  sets.forEach((set, k) => {
    h += `<div id="${sid}-w${k}" class="abs" style="left:${ox0-70}px;top:${oy+56}px;width:${step*10}px" data-layout-allow-overlap>` + set.map((w, i) => `<span class="abs mono" style="left:${i*step}px;width:140px;text-align:center;font-size:30px;color:${C.chalk}">${w}</span>`).join('') + `</div>`;
    h += `<div id="${sid}-m${k}" class="abs" style="left:${ox0-36}px;top:${oy+120}px;font:600 40px Inter;color:${C.amber}" data-layout-allow-overlap>sample ${k+1}: &nbsp;<span class="mono">ȳ = ${f1(means[k])} g</span></div>`;
  });
  h += `<div id="${sid}-no" class="card" style="left:860px;top:470px;width:930px;height:110px;padding:24px 30px;font:500 34px Inter"><span style="text-decoration:line-through;text-decoration-color:${C.red};text-decoration-thickness:4px;color:${C.dim}">“μ is probably below 150 g”</span> <span style="color:${C.red}">✗</span></div>`;
  h += `<div id="${sid}-yes" class="abs serif" style="left:860px;top:610px;font-size:46px;font-style:italic;color:${C.amberSoft}">Every probability describes the <b style="font-style:normal">method</b>.</div>`;
  tw.push(fade(`#${sid}-mucard`, cue(sc, 1, .1)), pop(`#${sid}-white`, cue(sc, 1, .2)), fade(`#${sid}-mu`, cue(sc, 1, .25)), fade(`#${sid}-mut`, cue(sc, 1, .45)));
  tw.push(fade(`#${sid}-map`, cue(sc, 1, .7)));
  tw.push(pop(`#${sid}-row circle`, cue(sc, 2, .2), { stagger: .08 }), fade(`#${sid}-w0`, cue(sc, 2, .45)), fade(`#${sid}-m0`, cue(sc, 2, .72)));
  const swap = (a, b, t) => { tw.push(out(`#${sid}-w${a}`, t, { d: .3 }), out(`#${sid}-m${a}`, t, { d: .3 }), `tl.to("#${sid}-row circle",{y:-26,duration:.22,yoyo:true,repeat:1,ease:"power1.out",stagger:.03},${t.toFixed(2)});`, fade(`#${sid}-w${b}`, t + .35, { d: .35 }), fade(`#${sid}-m${b}`, t + .4, { d: .35 })); };
  swap(0, 1, cue(sc, 3, .08)); swap(1, 2, cue(sc, 3, .38));
  tw.push(fade(`#${sid}-same`, cue(sc, 3, .7)));
  tw.push(out(`#${sid}-map`, cue(sc, 4, 0) - .1), fade(`#${sid}-no`, cue(sc, 4, .08)), fade(`#${sid}-yes`, cue(sc, 4, .55), { d: .8 }));
  files[sid] = scene(sid, h, tw, sc);
}

/* =============================== CH2: PROBABILITY =============================== */
{ const sid = 'ch2', sc = S[sid]; const H = head(sid, sc, 'Chapter 2', 'What a probability means'); let h = H.html; const tw = [...H.tw];
  // running frequency of "average of 10 below 140"
  const N = 10000, pts = []; let na = 0;
  for (let i = 1; i <= N; i++){ let s = 0; for (let k = 0; k < 10; k++) s += 145 + 15*randn(); if (s/10 < 140) na++; pts.push(na/i); }
  const cx0 = 170, cx1 = 1100, cy0 = 330, cy1 = 860, X = v => cx0 + Math.log10(v)/4*(cx1-cx0), Y = lin(0, .5, cy1, cy0);
  let d = ''; for (let j = 0; j <= 400; j++){ const i = Math.min(N, Math.max(1, Math.round(10**(j/400*4)))); d += (j ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(Math.min(.5, pts[i-1])).toFixed(1); }
  let axes = `<line x1="${cx0}" y1="${cy1}" x2="${cx1}" y2="${cy1}" stroke="${C.faint}" stroke-width="2"/>`;
  [1, 10, 100, 1000, 10000].forEach(v => axes += `<text x="${X(v)}" y="${cy1+40}" fill="${C.dim}" font-size="28" text-anchor="middle">${v.toLocaleString('en-US')}</text>`);
  [0, .1, .2, .3, .4, .5].forEach(v => axes += `<line x1="${cx0}" y1="${Y(v)}" x2="${cx1}" y2="${Y(v)}" stroke="rgba(245,242,231,.07)" stroke-width="1.5"/><text x="${cx0-16}" y="${Y(v)+8}" fill="${C.dim}" font-size="28" text-anchor="end">${v.toFixed(1)}</text>`);
  h += `<svg id="${sid}-ch" width="1920" height="1080" style="left:0;top:0">${axes}
    <text x="${(cx0+cx1)/2}" y="${cy1+82}" fill="${C.dim}" font-size="28" text-anchor="middle">repetitions N (log scale)</text>
    <path id="${sid}-run" d="${d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" fill="none" stroke="${C.orange}" stroke-width="4"/>
    <line id="${sid}-lim" x1="${cx0}" y1="${Y(.146)}" x2="${cx1}" y2="${Y(.146)}" stroke="${C.chalk}" stroke-width="2.5" stroke-dasharray="10 8"/>
    <text id="${sid}-limt" x="${cx1}" y="${Y(.146)-16}" fill="${C.chalk}" font-size="28" text-anchor="end">→ 0.146</text></svg>`;
  h += `<div id="${sid}-ev" class="abs" style="left:${cx0}px;top:260px;font:500 30px Inter;color:${C.dim}">A = <span style="color:${C.chalk}">average of 10 oranges below 140 g</span></div>`;
  h += `<div id="${sid}-def" class="abs serif" style="left:1230px;top:300px;font-size:64px;font-style:italic">P(A) = lim <span style="font-size:44px">N→∞</span> N<sub style="font-size:36px">A</sub> / N</div>`;
  h += `<div id="${sid}-defl" class="abs lbl" style="left:1232px;top:400px;font-size:30px">probability = long-run frequency</div>`;
  const bx0 = 1230, bx1 = 1790, by1 = 860, by0 = 560, BX = lin(125, 165, bx0, bx1), BY = lin(0, .09, by1, by0);
  const pdf = v => npdf((v-145)/4.743)/4.743;
  h += `<svg id="${sid}-bell" width="1920" height="1080" style="left:0;top:0">
    <path d="${areaFn(pdf, 125, 140, BX, BY)}" fill="rgba(232,145,47,.5)"/>
    <path d="${pathFn(pdf, 125, 165, BX, BY)}" fill="none" stroke="${C.chalk}" stroke-width="3.5"/>
    <line x1="${bx0}" y1="${by1}" x2="${bx1}" y2="${by1}" stroke="${C.faint}" stroke-width="2"/>
    <text x="${BX(140)}" y="${by1+36}" fill="${C.dim}" font-size="28" text-anchor="middle">140</text><text x="${BX(145)}" y="${by1+36}" fill="${C.chalk}" font-size="28" text-anchor="middle">μ</text>
    <text x="${BX(131)}" y="${by1-24}" fill="${C.amberSoft}" font-size="28" text-anchor="middle">14.6%</text></svg>`;
  h += `<div id="${sid}-bl" class="abs" style="left:${bx0}px;top:${by0-70}px;font:700 34px Inter;color:${C.amber}">the sampling distribution</div>`;
  h += `<div id="${sid}-bl2" class="abs lbl" style="left:${bx0}px;top:${by1+60}px;font-size:28px">averages from all imagined repetitions</div>`;
  tw.push(fade(`#${sid}-def`, cue(sc, 1, .3), { d: .8 }), fade(`#${sid}-defl`, cue(sc, 1, .6)));
  tw.push(fade(`#${sid}-ch`, cue(sc, 2, .1), { dy: 0 }), fade(`#${sid}-ev`, cue(sc, 2, .45)));
  tw.push(draw(`#${sid}-run`, cue(sc, 2, .7), cue(sc, 3, .7) - cue(sc, 2, .7), 'power1.in'));
  tw.push(fade(`#${sid}-lim`, cue(sc, 3, .7), { dy: 0 }), fade(`#${sid}-limt`, cue(sc, 3, .75), { dy: 0 }));
  tw.push(fade(`#${sid}-bell`, cue(sc, 4, .3), { d: .8 }), fade(`#${sid}-bl`, cue(sc, 4, .35)), fade(`#${sid}-bl2`, cue(sc, 4, .55)));
  files[sid] = scene(sid, h, tw, sc);
}

/* =============================== CH3: ASSUMPTIONS =============================== */
{ const sid = 'ch3', sc = S[sid]; const H = head(sid, sc, 'Chapter 3', 'The assumptions'); let h = H.html; const tw = [...H.tw];
  const items = [['A1', 'The target is fixed'], ['A2', 'Oranges picked at random'], ['A4', 'The orchard doesn’t change'], ['A3', 'Averages are bell-shaped']];
  items.forEach(([k, t], i) => { h += `<div id="${sid}-a${i}" class="card" style="left:130px;top:${300 + i*122}px;width:760px;height:96px;padding:24px 28px;font:500 36px Inter"><span class="mono" style="color:${C.amber};margin-right:22px">${k}</span>${t}</div>`; });
  // CLT picture: skewed population -> bell of averages
  const px0 = 1040, px1 = 1780, py1 = 560, py0 = 330, PX = lin(120, 230, px0, px1);
  const pop0 = v => v < 130 ? 0 : Math.exp(-(v-130)/15)/15, PY = lin(0, .072, py1, py0);
  const avg = v => npdf((v-145)/4.74)/4.74, AY = lin(0, .09, 870, 650);
  h += `<svg id="${sid}-clt" width="1920" height="1080" style="left:0;top:0">
    <path d="${areaFn(pop0, 130, 230, PX, PY)}" fill="rgba(232,145,47,.28)"/><path id="${sid}-pc" d="${pathFn(pop0, 130, 230, PX, PY)}" fill="none" stroke="${C.orange}" stroke-width="3.5"/>
    <line x1="${px0}" y1="${py1}" x2="${px1}" y2="${py1}" stroke="${C.faint}" stroke-width="2"/>
    <text x="${px0}" y="${py0-20}" fill="${C.dim}" font-size="28">single oranges: lopsided</text>
  </svg>`;
  h += `<svg id="${sid}-avg" width="1920" height="1080" style="left:0;top:0">
    <path id="${sid}-ac" d="${pathFn(avg, 120, 230, PX, AY)}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" fill="none" stroke="${C.chalk}" stroke-width="4"/>
    <line x1="${px0}" y1="870" x2="${px1}" y2="870" stroke="${C.faint}" stroke-width="2"/>
    <text x="${px0}" y="630" fill="${C.dim}" font-size="28">averages of many: a bell curve</text></svg>`;
  h += `<div id="${sid}-cltl" class="abs" style="left:${px0}px;top:902px;font:700 30px Inter;color:${C.amber}">the central limit theorem</div>`;
  h += `<div id="${sid}-bend" class="chip" style="left:130px;top:830px;background:rgba(217,164,74,.16);border:2px solid ${C.amber};color:${C.amberSoft}">lopsided orchard → bends: 95% becomes ~90%</div>`;
  h += `<div id="${sid}-brk" class="chip" style="left:130px;top:920px;background:rgba(224,96,79,.16);border:2px solid ${C.red};color:#f3a69b">picking by the road → breaks · more oranges won’t help</div>`;
  tw.push(fade(`#${sid}-a0`, cue(sc, 2, .02), { x: -30 }), fade(`#${sid}-a1`, cue(sc, 2, .3), { x: -30 }), fade(`#${sid}-a2`, cue(sc, 2, .62), { x: -30 }), fade(`#${sid}-a3`, cue(sc, 3, .05), { x: -30 }));
  tw.push(`tl.to("#${sid}-a3",{borderColor:"${C.amber}",duration:.5},${cue(sc, 4, 0).toFixed(2)});`);
  tw.push(fade(`#${sid}-clt`, cue(sc, 4, .2), { d: .7 }), fade(`#${sid}-avg`, cue(sc, 4, .55), { dy: 0 }), draw(`#${sid}-ac`, cue(sc, 4, .6), 1.4), fade(`#${sid}-cltl`, cue(sc, 4, .25)));
  tw.push(fade(`#${sid}-bend`, cue(sc, 5, .25)), fade(`#${sid}-brk`, cue(sc, 5, .55)));
  files[sid] = scene(sid, h, tw, sc);
}

/* =============================== CH4: ESTIMATORS =============================== */
{ const sid = 'ch4', sc = S[sid]; const H = head(sid, sc, 'Chapter 4', 'Estimators are random variables'); let h = H.html; const tw = [...H.tw];
  const W = [118,152,131,147,139,160,124,143,155,121]; const x0 = 180, x1 = 1760, X = lin(100, 190, x0, x1), ly = 820;
  let axis = `<line x1="${x0}" y1="${ly}" x2="${x1}" y2="${ly}" stroke="${C.faint}" stroke-width="2"/>`;
  for (let v = 100; v <= 190; v += 10) axis += `<line x1="${X(v)}" y1="${ly}" x2="${X(v)}" y2="${ly+10}" stroke="${C.faint}" stroke-width="2"/><text x="${X(v)}" y="${ly+42}" fill="${C.dim}" font-size="28" text-anchor="middle">${v}</text>`;
  const popY = lin(0, .03, ly, ly - 420), avY = lin(0, .09, ly, ly - 430), av40Y = avY;
  const popPdf = v => npdf((v-145)/15)/15, av10 = v => npdf((v-145)/4.743)/4.743, av40 = v => npdf((v-145)/2.372)/2.372;
  let dots = ''; const lvl = {}; W.forEach((w, i) => { const k = Math.round(w/6); lvl[k] = (lvl[k] || 0) + 1; dots += `<circle id="${sid}-d${i}" class="${sid}-dot" cx="${X(w)}" cy="${ly - 22 - (lvl[k]-1)*40}" r="18" fill="url(#${sid}-g-orange)" stroke="#7a3d08" stroke-width="1"/>`; });
  h += `<svg id="${sid}-nl" width="1920" height="1080" style="left:0;top:0">${defs(sid)}${axis}<text x="${x1}" y="${ly+80}" fill="${C.dim}" font-size="28" text-anchor="end">grams</text>
    <path id="${sid}-pop" d="${pathFn(popPdf, 100, 190, X, popY)}" fill="none" stroke="${C.orange}" stroke-width="3" stroke-dasharray="10 8" opacity=".9"/>
    <path id="${sid}-a10" d="${areaFn(av10, 125, 165, X, avY)}" fill="rgba(245,242,231,.12)" stroke="${C.chalk}" stroke-width="4"/>
    <path id="${sid}-a40" d="${areaFn(av40, 133, 157, X, av40Y)}" fill="rgba(143,211,168,.14)" stroke="${C.mint}" stroke-width="4"/>
    <line id="${sid}-mu" x1="${X(145)}" y1="${ly}" x2="${X(145)}" y2="${ly-470}" stroke="${C.chalk}" stroke-width="2" stroke-dasharray="6 6"/>
    <text id="${sid}-mut" x="${X(145)-14}" y="${ly-448}" text-anchor="end" fill="${C.chalk}" font-size="30" font-family="EB Garamond" font-style="italic">μ (the centre)</text>
    ${dots}
    <line id="${sid}-ybar" x1="${X(139)}" y1="${ly+4}" x2="${X(139)}" y2="${ly-150}" stroke="${C.amber}" stroke-width="6"/>
    <text id="${sid}-ybt" x="${X(139)-14}" y="${ly-162}" fill="${C.amber}" font-size="30" text-anchor="end">ȳ = 139.0 g · one draw</text></svg>`;
  h += `<div id="${sid}-pl" class="abs lbl" style="left:${X(168)}px;top:${ly-250}px;font-size:28px;color:${C.orange}">single oranges, σ = 15 g</div>`;
  h += `<div id="${sid}-se" class="abs" style="left:1240px;top:300px;font:600 44px Inter">SE = <span class="serif" style="font-style:italic;font-size:54px">σ / √n</span> <span class="mono" style="font-size:36px;color:${C.dim}">= 4.74 g</span></div>`;
  h += `<div id="${sid}-se40" class="abs" style="left:1240px;top:372px;font:600 34px Inter;color:${C.mint}">n = 40 → 2.37 g &nbsp;<span style="font-weight:400;color:${C.dim}">4× oranges, ½ the wobble</span></div>`;
  // n-1 panel
  h += `<div id="${sid}-n1" class="abs serif" style="left:150px;top:300px;font-size:72px;font-style:italic">S² = Σ (Y<sub style="font-size:44px">i</sub> − Ȳ)² / <span style="color:${C.amber};font-style:normal;border-bottom:4px solid ${C.amber}">(n − 1)</span></div>`;
  h += `<div id="${sid}-ex" class="card" style="left:150px;top:470px;width:1620px;height:300px;padding:34px 40px;font:500 34px Inter;line-height:1.75">
    Two oranges, <span class="mono">140 g</span> and <span class="mono">150 g</span>.<br>
    from their average 145: &nbsp;<span class="mono" style="color:${C.amberSoft}">(−5)² + (+5)² = 50</span><br>
    from the true μ = 150: &nbsp;<span class="mono" style="color:${C.mint}">(−10)² + 0² = 100</span> &nbsp;<span style="color:${C.dim}">← always larger on average</span></div>`;
  h += `<div id="${sid}-ex2" class="abs serif" style="left:150px;top:810px;font-size:42px;font-style:italic;color:${C.amberSoft}">The sample sits closer to itself than the truth does: short by one orange’s worth.</div>`;
  tw.push(fade(`#${sid}-nl`, cue(sc, 1, .02), { dy: 0, d: .4 }));
  tw.push(`tl.fromTo(["#${sid}-pop","#${sid}-a10","#${sid}-a40","#${sid}-mu","#${sid}-mut","#${sid}-ybar","#${sid}-ybt"],{opacity:0},{opacity:0,duration:.01},0);`);
  tw.push(`tl.fromTo(".${sid}-dot",{opacity:0,y:-260},{opacity:1,y:0,duration:.7,ease:"bounce.out",stagger:.12},${cue(sc, 1, .08).toFixed(2)});`);
  tw.push(`tl.fromTo(["#${sid}-ybar","#${sid}-ybt"],{opacity:0},{opacity:1,duration:.5},${cue(sc, 1, .62).toFixed(2)});`);
  tw.push(`tl.to(["#${sid}-a10","#${sid}-mu","#${sid}-mut"],{opacity:1,duration:.7},${cue(sc, 2, .3).toFixed(2)});`);
  tw.push(`tl.to(".${sid}-dot",{opacity:.35,duration:.5},${cue(sc, 3, 0).toFixed(2)});`, `tl.to("#${sid}-pop",{opacity:.9,duration:.7},${cue(sc, 3, .5).toFixed(2)});`, fade(`#${sid}-pl`, cue(sc, 3, .55)), fade(`#${sid}-se`, cue(sc, 3, .08)));
  tw.push(`tl.to("#${sid}-a40",{opacity:1,duration:.6},${cue(sc, 4, .05).toFixed(2)});`, `tl.to("#${sid}-a10",{opacity:.3,duration:.6},${cue(sc, 4, .05).toFixed(2)});`, fade(`#${sid}-se40`, cue(sc, 4, .2)));
  tw.push(out([`#${sid}-nl`, `#${sid}-pl`, `#${sid}-se`, `#${sid}-se40`].join(','), cue(sc, 5, 0) - .15, { d: .4 }));
  tw.push(fade(`#${sid}-n1`, cue(sc, 5, .05)), fade(`#${sid}-ex`, cue(sc, 5, .35)), fade(`#${sid}-ex2`, cue(sc, 5, .72)));
  files[sid] = scene(sid, h, tw, sc);
}

/* =============================== CH5: THE RULER =============================== */
{ const sid = 'ch5', sc = S[sid]; const H = head(sid, sc, 'Chapter 5', 'The standard error as a ruler'); let h = H.html; const tw = [...H.tw];
  h += `<div id="${sid}-miss" class="abs" style="left:130px;top:290px;font:600 64px Inter"><span class="mono">139.0 − 150 = <span style="color:${C.amber}">−11 g</span></span> <span id="${sid}-q" style="color:${C.dim};font-weight:400">· a lot?</span></div>`;
  const rx0 = 1000, rx1 = 1790, SEpx = (rx1 - rx0)/3.4, ry = 340;
  let rul = `<rect x="${rx0-20}" y="${ry-44}" width="${rx1-rx0+40}" height="88" rx="8" fill="#e9dcb8"/>`;
  for (let k = 0; k <= 3; k++){ const x = rx1 - 20 - k*SEpx; rul += `<line x1="${x}" y1="${ry-44}" x2="${x}" y2="${ry+4}" stroke="#4a3a1c" stroke-width="3"/><text x="${x}" y="${ry+34}" fill="#4a3a1c" font-size="28" text-anchor="middle">${k ? '−' + k : 0}</text>`;
    if (k < 3) for (let m = 1; m < 5; m++){ const xm = x - m*SEpx/5; rul += `<line x1="${xm}" y1="${ry-44}" x2="${xm}" y2="${ry-22}" stroke="#4a3a1c" stroke-width="2"/>`; } }
  const mx = rx1 - 20 - 2.33*SEpx;
  h += `<svg id="${sid}-rul" width="1920" height="1080" style="left:0;top:0">${rul}<polygon id="${sid}-mk" points="${mx},${ry-50} ${mx-14},${ry-78} ${mx+14},${ry-78}" fill="${C.red}"/></svg>`;
  h += `<div id="${sid}-rl" class="abs mono" style="left:${rx0-20}px;top:${ry+60}px;font-size:28px;color:${C.dim}">1 unit = 1 standard error = 4.71 g</div>`;
  h += `<div id="${sid}-res" class="abs" style="left:130px;top:400px;font:600 50px Inter;color:${C.amber}"><span class="mono">−11 ÷ 4.71 = −2.33</span> <span style="font-weight:400;color:${C.dim};font-size:36px">standard errors</span></div>`;
  const cx0 = 260, cx1 = 1660, cy1 = 930, cy0 = 560, X = lin(-4.5, 4.5, cx0, cx1), Y = lin(0, .42, cy1, cy0);
  const t9 = v => tpdf(v, 9);
  h += `<svg id="${sid}-crv" width="1920" height="1080" style="left:0;top:0">
    <line x1="${cx0}" y1="${cy1}" x2="${cx1}" y2="${cy1}" stroke="${C.faint}" stroke-width="2"/>
    ${[-4,-3,-2,-1,0,1,2,3,4].map(v => `<text x="${X(v)}" y="${cy1+36}" fill="${C.dim}" font-size="28" text-anchor="middle">${v < 0 ? '−' + (-v) : v}</text>`).join('')}
    <path id="${sid}-n" d="${pathFn(npdf, -4.5, 4.5, X, Y)}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" fill="none" stroke="${C.chalk}" stroke-width="4"/>
    <g id="${sid}-tg"><path d="${areaFn(t9, -2.262, 2.262, X, Y)}" fill="rgba(143,211,168,.22)"/>
      <path d="${pathFn(t9, -4.5, 4.5, X, Y)}" fill="none" stroke="${C.mint}" stroke-width="4"/>
      ${[-2.262, 2.262].map(v => `<line x1="${X(v)}" y1="${cy0+10}" x2="${X(v)}" y2="${cy1}" stroke="${C.amber}" stroke-width="3" stroke-dasharray="8 6"/>`).join('')}
      <text x="${X(2.262)+12}" y="${cy0+30}" fill="${C.amber}" font-size="28">±2.262</text>
      <text x="${X(0)}" y="${Y(.2)}" fill="${C.mint}" font-size="34" text-anchor="middle">95%</text>
      <text x="${cx1}" y="${cy0-14}" fill="${C.mint}" font-size="28" text-anchor="end">Student’s t, 9 degrees of freedom</text></g>
  </svg>`;
  h += `<div id="${sid}-o1" class="chip" style="left:130px;top:540px;background:rgba(245,242,231,.08);border:2px solid ${C.faint};font-size:28px">orchard A · 145 g ± 15</div>`;
  h += `<div id="${sid}-o2" class="chip" style="left:130px;top:620px;background:rgba(245,242,231,.08);border:2px solid ${C.faint};font-size:28px">orchard B · 80 g ± 3</div>`;
  h += `<div id="${sid}-piv" class="abs serif" style="left:136px;top:705px;font-size:52px;font-style:italic;color:${C.amberSoft}">→ one curve: a <b>pivot</b></div>`;
  tw.push(fade(`#${sid}-miss`, cue(sc, 1, .3)), fade(`#${sid}-q`, cue(sc, 1, .8), { dy: 0 }));
  tw.push(out(`#${sid}-q`, cue(sc, 2, .02)), fade(`#${sid}-rul`, cue(sc, 2, .3), { dy: 0 }), fade(`#${sid}-rl`, cue(sc, 2, .35)), `tl.fromTo("#${sid}-mk",{opacity:0,x:${(rx1-20-mx).toFixed(0)}},{opacity:1,x:0,duration:1.1,ease:"power2.out"},${cue(sc, 2, .62).toFixed(2)});`, fade(`#${sid}-res`, cue(sc, 2, .72)));
  tw.push(fade(`#${sid}-crv`, cue(sc, 3, .05), { dy: 0, d: .3 }), draw(`#${sid}-n`, cue(sc, 3, .1), 1.3), fade(`#${sid}-o1`, cue(sc, 3, .32), { x: -20 }), fade(`#${sid}-o2`, cue(sc, 3, .45), { x: -20 }), fade(`#${sid}-piv`, cue(sc, 3, .82)));
  tw.push(`tl.fromTo("#${sid}-tg",{opacity:0},{opacity:0,duration:.01},0);`, `tl.to("#${sid}-n",{opacity:.35,duration:.5},${cue(sc, 4, .25).toFixed(2)});`, `tl.to("#${sid}-tg",{opacity:1,duration:.8},${cue(sc, 4, .25).toFixed(2)});`);
  files[sid] = scene(sid, h, tw, sc);
}

/* =============================== CH6: TEST =============================== */
{ const sid = 'ch6', sc = S[sid]; const H = head(sid, sc, 'Chapter 6', 'The hypothesis test'); let h = H.html; const tw = [...H.tw];
  h += `<div id="${sid}-h0" class="card" style="left:130px;top:280px;width:700px;height:120px;padding:28px 34px;font:600 44px Inter"><span class="serif" style="font-style:italic;font-size:52px">H₀</span> : μ = 150 g <span style="font-weight:400;color:${C.dim};font-size:30px">(grower is right)</span></div>`;
  h += `<div id="${sid}-ask" class="abs serif" style="left:890px;top:298px;font-size:54px;font-style:italic;color:${C.amberSoft}">Would our data be surprising?</div>`;
  const cx0 = 200, cx1 = 1720, cy1 = 900, cy0 = 470, X = lin(-4.5, 4.5, cx0, cx1), Y = lin(0, .42, cy1, cy0), t9 = v => tpdf(v, 9);
  h += `<svg id="${sid}-crv" width="1920" height="1080" style="left:0;top:0">
    <rect id="${sid}-rej" x="${cx0}" y="${cy0}" width="${(X(-1.833)-cx0).toFixed(1)}" height="${cy1-cy0}" fill="rgba(224,96,79,.14)"/>
    <text id="${sid}-rejt" x="${cx0+14}" y="${cy0+34}" fill="#f3a69b" font-size="28">reject if t &lt; −1.833 (α = 0.05)</text>
    <line x1="${cx0}" y1="${cy1}" x2="${cx1}" y2="${cy1}" stroke="${C.faint}" stroke-width="2"/>
    ${[-4,-3,-2,-1,0,1,2,3,4].map(v => `<text x="${X(v)}" y="${cy1+36}" fill="${C.dim}" font-size="28" text-anchor="middle">${v < 0 ? '−' + (-v) : v}</text>`).join('')}
    <path id="${sid}-tail" d="${areaFn(t9, -4.5, -2.33, X, Y)}" fill="${C.mint}"/>
    <path d="${pathFn(t9, -4.5, 4.5, X, Y)}" fill="none" stroke="${C.chalk}" stroke-width="4"/>
    <line id="${sid}-obs" x1="${X(-2.33)}" y1="${cy0+40}" x2="${X(-2.33)}" y2="${cy1}" stroke="${C.mint}" stroke-width="4"/>
    <text id="${sid}-obst" x="${X(-2.33)+14}" y="${cy0+80}" fill="${C.mint}" font-size="28">our t = −2.33</text>
    <text id="${sid}-pt" x="${X(-2.33)-20}" y="${Y(.06)}" fill="${C.mint}" font-size="34" text-anchor="end">p = 0.022</text>
    <text x="${cx1}" y="${cy0-10}" fill="${C.dim}" font-size="28" text-anchor="end">if H₀ were true: Student’s t, 9 df</text>
  </svg>`;
  h += `<div id="${sid}-ver" class="chip" style="left:1250px;top:640px;background:rgba(224,96,79,.18);border:2px solid ${C.red};color:#f7c4bc;font-size:34px">0.022 &lt; 0.05 → reject H₀</div>`;
  h += `<div id="${sid}-w1" class="card" style="left:130px;top:470px;width:800px;height:200px;padding:32px 36px;font:500 36px Inter;line-height:1.5"><span style="color:${C.red}">✗</span> p is <b>not</b> the chance<br>that the grower is right</div>`;
  h += `<div id="${sid}-w2" class="card" style="left:990px;top:470px;width:800px;height:200px;padding:32px 36px;font:500 36px Inter;line-height:1.5"><span style="color:${C.red}">✗</span> not rejecting would <b>not</b> prove him right</div>`;
  h += `<div id="${sid}-pw" class="abs" style="left:990px;top:720px;width:800px"><div class="lbl" style="font-size:28px;margin-bottom:14px">power with 10 oranges, true average 145 g</div>
    <div style="position:relative;height:46px;border-radius:8px;background:rgba(245,242,231,.1);overflow:hidden"><div id="${sid}-pwb" style="position:absolute;left:0;top:0;bottom:0;width:25%;background:${C.amber};transform-origin:0 50%"></div></div>
    <div class="mono" style="margin-top:12px;font-size:30px;color:${C.amberSoft}">25% · it misses 3 times in 4</div></div>`;
  tw.push(fade(`#${sid}-h0`, cue(sc, 1, .3)), fade(`#${sid}-ask`, cue(sc, 1, .62)));
  tw.push(`tl.fromTo(["#${sid}-rej","#${sid}-rejt","#${sid}-tail","#${sid}-obs","#${sid}-obst","#${sid}-pt"],{opacity:0},{opacity:0,duration:.01},0);`);
  tw.push(fade(`#${sid}-crv`, cue(sc, 2, .02), { dy: 0 }), `tl.to(["#${sid}-obs","#${sid}-obst"],{opacity:1,duration:.5},${cue(sc, 2, .35).toFixed(2)});`, `tl.to("#${sid}-tail",{opacity:.75,duration:.7},${cue(sc, 2, .5).toFixed(2)});`, `tl.to("#${sid}-pt",{opacity:1,duration:.5},${cue(sc, 2, .82).toFixed(2)});`);
  tw.push(`tl.to(["#${sid}-rej","#${sid}-rejt"],{opacity:1,duration:.6},${cue(sc, 3, .2).toFixed(2)});`, fade(`#${sid}-ver`, cue(sc, 3, .55)));
  tw.push(out([`#${sid}-crv`, `#${sid}-ver`, `#${sid}-ask`].join(','), cue(sc, 4, 0) - .1), fade(`#${sid}-w1`, cue(sc, 4, .1)), fade(`#${sid}-w2`, cue(sc, 4, .42)), fade(`#${sid}-pw`, cue(sc, 4, .62)),
    `tl.fromTo("#${sid}-pwb",{scaleX:0},{scaleX:1,duration:.9,ease:"power2.out"},${cue(sc, 4, .66).toFixed(2)});`);
  files[sid] = scene(sid, h, tw, sc);
}

/* =============================== CH7: INTERVAL =============================== */
{ const sid = 'ch7', sc = S[sid]; const H = head(sid, sc, 'Chapter 7', 'The confidence interval'); let h = H.html; const tw = [...H.tw];
  const x0 = 200, x1 = 1720, X = lin(120, 160, x0, x1), ly = 470;
  let ax = `<line x1="${x0}" y1="${ly}" x2="${x1}" y2="${ly}" stroke="${C.faint}" stroke-width="2"/>`;
  for (let v = 120; v <= 160; v += 5) ax += `<line x1="${X(v)}" y1="${ly-8}" x2="${X(v)}" y2="${ly+8}" stroke="${C.faint}" stroke-width="2"/><text x="${X(v)}" y="${ly+44}" fill="${C.dim}" font-size="28" text-anchor="middle">${v}</text>`;
  h += `<svg id="${sid}-nl" width="1920" height="1080" style="left:0;top:0">${ax}
    <rect id="${sid}-band" x="${X(139)}" y="${ly-34}" width="1" height="68" fill="rgba(217,164,74,.35)"/>
    <line id="${sid}-lo" x1="${X(128.3)}" y1="${ly-50}" x2="${X(128.3)}" y2="${ly+50}" stroke="${C.amber}" stroke-width="5"/>
    <line id="${sid}-hi" x1="${X(149.7)}" y1="${ly-50}" x2="${X(149.7)}" y2="${ly+50}" stroke="${C.amber}" stroke-width="5"/>
    <text id="${sid}-lot" x="${X(128.3)}" y="${ly-66}" fill="${C.amber}" font-size="32" text-anchor="middle">128.3</text>
    <text id="${sid}-hit" x="${X(149.7)-10}" y="${ly-66}" fill="${C.amber}" font-size="32" text-anchor="end">149.7</text>
    <circle id="${sid}-yb" cx="${X(139)}" cy="${ly}" r="10" fill="${C.chalk}"/>
    <g id="${sid}-150"><line x1="${X(150)}" y1="${ly-90}" x2="${X(150)}" y2="${ly+26}" stroke="${C.red}" stroke-width="4"/><text x="${X(150)+12}" y="${ly-70}" fill="${C.red}" font-size="30">150 ✗</text></g>
  </svg>`;
  h += `<div id="${sid}-cap" class="abs" style="left:200px;top:290px;font:500 34px Inter;color:${C.dim}">every value of μ the data cannot rule out</div>`;
  // ring toss: 20 intervals
  const reps = []; let guard = 0;
  while (reps.length < 20 && guard++ < 2000){ const ws = Array.from({ length: 10 }, () => 145 + 15*randn()); const m = ws.reduce((a, b) => a + b, 0)/10; const s = Math.sqrt(ws.reduce((a, b) => a + (b-m)**2, 0)/9); const hw = 2.262*s/Math.sqrt(10); const cov = m - hw <= 145 && 145 <= m + hw;
    const missing = reps.filter(r => !r.cov).length; if (reps.length === 13 ? !cov : cov) reps.push({ m, lo: m - hw, hi: m + hw, cov }); }
  const rx0 = 260, rx1 = 1660, ry0 = 640, ry1 = 960, RY = lin(120, 170, ry1, ry0);
  let rings = `<line x1="${rx0-30}" y1="${RY(145)}" x2="${rx1+30}" y2="${RY(145)}" stroke="${C.chalk}" stroke-width="2.5" stroke-dasharray="10 8"/><text x="${rx1+40}" y="${RY(145)+9}" fill="${C.chalk}" font-size="30" font-family="EB Garamond" font-style="italic">μ</text>`;
  reps.forEach((r, i) => { const x = rx0 + i*(rx1 - rx0)/19, col = r.cov ? C.mint : C.red; rings += `<g class="${sid}-ring"><line x1="${x}" y1="${RY(Math.min(170, r.hi))}" x2="${x}" y2="${RY(Math.max(120, r.lo))}" stroke="${col}" stroke-width="7" stroke-linecap="round"/><circle cx="${x}" cy="${RY(r.m)}" r="7" fill="#0b2c21" stroke="${col}" stroke-width="3"/></g>`; });
  h += `<svg id="${sid}-rt" width="1920" height="1080" style="left:0;top:0">${rings}</svg>`;
  h += `<div id="${sid}-inside" class="abs serif" style="left:200px;top:600px;font-size:60px;font-style:italic;color:${C.chalk}">μ is either inside, or not. <span style="color:${C.dim}">No probability left.</span></div>`;
  h += `<div id="${sid}-thr" class="abs serif" style="left:0;width:1920px;top:985px;text-align:center;font-size:44px;font-style:italic;color:${C.amberSoft}">19 rings in 20: the 95% describes the skill, never a single ring</div>`;
  tw.push(fade(`#${sid}-nl`, cue(sc, 1, .05), { dy: 0 }), fade(`#${sid}-cap`, cue(sc, 1, .55)));
  tw.push(`tl.fromTo(["#${sid}-lo","#${sid}-hi","#${sid}-lot","#${sid}-hit","#${sid}-150"],{opacity:0},{opacity:0,duration:.01},0);`);
  tw.push(`tl.fromTo("#${sid}-band",{attr:{x:${X(139)},width:1}},{attr:{x:${X(128.3).toFixed(1)},width:${(X(149.7)-X(128.3)).toFixed(1)}},duration:1.6,ease:"power2.inOut"},${cue(sc, 1, .5).toFixed(2)});`);
  tw.push(`tl.to(["#${sid}-lo","#${sid}-lot"],{opacity:1,duration:.5},${cue(sc, 2, .3).toFixed(2)});`, `tl.to(["#${sid}-hi","#${sid}-hit"],{opacity:1,duration:.5},${cue(sc, 2, .55).toFixed(2)});`, `tl.to("#${sid}-150",{opacity:1,duration:.5},${cue(sc, 2, .9).toFixed(2)});`);
  tw.push(fade(`#${sid}-inside`, cue(sc, 3, .1), { d: .7 }));
  tw.push(out(`#${sid}-inside`, cue(sc, 4, 0) - .1), fade(`#${sid}-rt`, cue(sc, 4, .02), { dy: 0, d: .2 }), pop(`.${sid}-ring`, cue(sc, 4, .05), { stagger: +Math.min(.25, sc.beats[3].dur*.6/20).toFixed(3), from: .2 }), fade(`#${sid}-thr`, cue(sc, 4, .72)));
  files[sid] = scene(sid, h, tw, sc);
}

/* =============================== CH8: PEEKING =============================== */
{ const sid = 'ch8', sc = S[sid]; const H = head(sid, sc, 'Chapter 8', 'Strengths and limitations'); let h = H.html; const tw = [...H.tw];
  const crs = []; for (let n = 2; n <= 100; n++) crs[n] = null;
  const runs = []; for (let g = 0; g < 400 && runs.length < 400; g++){ let mean = 0, M2 = 0, stop = 0; const ps = [];
    for (let i = 1; i <= 100; i++){ const x = 150 + 15*randn(); const d = x - mean; mean += d/i; M2 += d*(x - mean); if (i >= 2){ const t = (mean - 150)/Math.sqrt(M2/(i-1)/i); const p = tcdf(t, i-1); ps.push([i, p]); if (!stop && p < .05) stop = i; } }
    runs.push({ ps, stop }); }
  const rate = runs.filter(r => r.stop).length/runs.length;
  const cx0 = 200, cx1 = 1200, cy0 = 330, cy1 = 840, X = lin(2, 100, cx0, cx1), Y = v => lin(0, -3, cy0, cy1)(Math.log10(Math.max(1e-3, v)));
  const pathOf = r => { let d = ''; for (const [i, p] of r.ps){ if (r.stop && i > r.stop) break; d += (d ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(p).toFixed(1); } return d; };
  const hero = runs.find(r => r.stop > 25) || runs.find(r => r.stop);
  const others = []; let caught = 0; for (const r of runs){ if (r === hero) continue; if (r.stop && caught < 4){ others.push(r); caught++; } else if (!r.stop && others.length - caught < 8) others.push(r); if (others.length >= 12) break; }
  let ax = `<line x1="${cx0}" y1="${cy1}" x2="${cx1}" y2="${cy1}" stroke="${C.faint}" stroke-width="2"/>`;
  [[1, '1'], [.1, '0.1'], [.01, '0.01'], [.001, '0.001']].forEach(([v, s]) => ax += `<line x1="${cx0}" y1="${Y(v)}" x2="${cx1}" y2="${Y(v)}" stroke="rgba(245,242,231,.07)" stroke-width="1.5"/><text x="${cx0-14}" y="${Y(v)+8}" fill="${C.dim}" font-size="28" text-anchor="end">${s}</text>`);
  [2, 25, 50, 75, 100].forEach(v => ax += `<text x="${X(v)}" y="${cy1+38}" fill="${C.dim}" font-size="28" text-anchor="middle">${v}</text>`);
  h += `<svg id="${sid}-ch" width="1920" height="1080" style="left:0;top:0">${ax}
    <text x="${(cx0+cx1)/2}" y="${cy1+78}" fill="${C.dim}" font-size="28" text-anchor="middle">oranges weighed so far</text>
    <text x="${cx0}" y="${cy0-22}" fill="${C.dim}" font-size="28">p-value after each orange</text>
    <line x1="${cx0}" y1="${Y(.05)}" x2="${cx1}" y2="${Y(.05)}" stroke="${C.red}" stroke-width="3" stroke-dasharray="10 7"/><text x="${cx1}" y="${Y(.05)-12}" fill="#f3a69b" font-size="28" text-anchor="end">0.05: stop and accuse</text>
    ${others.map((r, i) => `<path class="${sid}-oth" d="${pathOf(r)}" fill="none" stroke="${r.stop ? C.red : 'rgba(245,242,231,.45)'}" stroke-width="2.5" opacity="${r.stop ? .9 : .6}"/>`).join('')}
    <path id="${sid}-hero" d="${pathOf(hero)}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" fill="none" stroke="${C.chalk}" stroke-width="4.5"/>
    <circle id="${sid}-stop" cx="${X(hero.stop)}" cy="${Y(hero.ps.find(q => q[0] === hero.stop)[1])}" r="12" fill="${C.red}"/>
  </svg>`;
  h += `<div id="${sid}-plan" class="abs serif" style="left:0;width:1920px;top:520px;text-align:center;font-size:72px;font-style:italic">Follow the plan.</div>`;
  h += `<div id="${sid}-hon" class="abs" style="left:1290px;top:330px;font:600 34px Inter;color:${C.mint}">every grower is honest:<br><span style="font-weight:400;color:${C.dim}">true average = 150 g</span></div>`;
  h += `<div id="${sid}-r1" class="card" style="left:1290px;top:500px;width:520px;height:150px;padding:24px 30px"><div class="lbl" style="font-size:28px">one planned test</div><div class="mono" style="font-size:64px;color:${C.mint}">5%</div></div>`;
  h += `<div id="${sid}-r2" class="card" style="left:1290px;top:680px;width:520px;height:150px;padding:24px 30px;border-color:${C.red}"><div class="lbl" style="font-size:28px">peeking after every orange</div><div class="mono" style="font-size:64px;color:${C.red}">≈ 30%</div></div>`;
  h += `<div id="${sid}-q" class="abs serif" style="left:0;width:1920px;top:966px;text-align:center;font-size:44px;font-style:italic;color:${C.amberSoft}">Same data. Different procedure. Different error rate.</div>`;
  tw.push(fade(`#${sid}-plan`, cue(sc, 1, .1), { d: .7 }), out(`#${sid}-plan`, cue(sc, 2, 0) - .1));
  tw.push(`tl.fromTo([".${sid}-oth","#${sid}-stop"],{opacity:0},{opacity:0,duration:.01},0);`);
  tw.push(fade(`#${sid}-ch`, cue(sc, 2, .05), { dy: 0 }), draw(`#${sid}-hero`, cue(sc, 2, .3), Math.max(1.5, sc.beats[1].dur*.6), 'none'), pop(`#${sid}-stop`, cue(sc, 2, .3) + Math.max(1.5, sc.beats[1].dur*.6)));
  tw.push(fade(`#${sid}-hon`, cue(sc, 3, .05)), `tl.to(".${sid}-oth",{opacity:.75,duration:.4,stagger:.12},${cue(sc, 3, .2).toFixed(2)});`, fade(`#${sid}-r1`, cue(sc, 3, .55)), fade(`#${sid}-r2`, cue(sc, 3, .78)));
  tw.push(fade(`#${sid}-q`, cue(sc, 4, .1), { d: .8 }));
  files[sid] = scene(sid, h, tw, sc);
  console.log('peeking rate in figure:', rate.toFixed(3));
}

/* =============================== CH9: BIG PICTURE =============================== */
{ const sid = 'ch9', sc = S[sid]; const H = head(sid, sc, 'Chapter 9', 'The bigger picture'); let h = H.html; const tw = [...H.tw];
  const nodes = ['Treat the truth as fixed', 'Model how data arise', 'Choose an estimator', 'Imagine repeating', 'Turn the miss into a pivot', 'Test, or build an interval'];
  const pos = (i) => ({ x: 130 + (i%3)*590, y: i < 3 ? 380 : 610 });
  nodes.forEach((t, i) => { const p = pos(i); h += `<div id="${sid}-n${i}" class="card" style="left:${p.x}px;top:${p.y}px;width:500px;height:150px;padding:28px 30px;font:600 36px Inter;line-height:1.3"><span class="mono" style="color:${C.amber};font-size:28px;display:block;margin-bottom:6px">${i+1}</span>${t}</div>`;
    if (i % 3 !== 2) h += `<div id="${sid}-ar${i}" class="abs" style="left:${p.x+512}px;top:${p.y+48}px;font-size:48px;color:${C.amber}">→</div>`; });
  h += `<div id="${sid}-dec" class="abs" style="left:130px;top:850px;width:1680px;height:120px;border-radius:12px;background:${C.amber};color:#1f1608;padding:28px 40px;font:700 44px Inter">→ Decide, knowing how often you would be wrong.</div>`;
  tw.push(fade(`#${sid}-n0`, cue(sc, 2, .02)), fade(`#${sid}-ar0`, cue(sc, 2, .3), { dy: 0 }), fade(`#${sid}-n1`, cue(sc, 2, .35)), fade(`#${sid}-ar1`, cue(sc, 2, .62), { dy: 0 }), fade(`#${sid}-n2`, cue(sc, 2, .66)));
  tw.push(fade(`#${sid}-n3`, cue(sc, 3, .02)), fade(`#${sid}-ar3`, cue(sc, 3, .4), { dy: 0 }), fade(`#${sid}-n4`, cue(sc, 3, .45)), fade(`#${sid}-ar4`, cue(sc, 3, .85), { dy: 0 }));
  tw.push(fade(`#${sid}-n5`, cue(sc, 4, .02)), fade(`#${sid}-dec`, cue(sc, 4, .45), { d: .7 }));
  files[sid] = scene(sid, h, tw, sc);
}

/* =============================== OUTRO =============================== */
{ const sid = 'outro', sc = S[sid]; let h = ''; const tw = [];
  h += `<svg id="${sid}-wb" width="1920" height="1080" style="left:0;top:0">${defs(sid)}<circle cx="960" cy="300" r="110" fill="rgba(245,242,231,.06)"/>${ball(sid, `${sid}-white`, 960, 300, 46, 'white')}</svg>`;
  h += `<div id="${sid}-l1" class="abs serif" style="left:0;width:1920px;top:430px;text-align:center;font-size:58px;font-style:italic;color:${C.dim}">We can never see the white ball. We can never weigh every orange.</div>`;
  h += `<div id="${sid}-l2" class="abs serif" style="left:0;width:1920px;top:540px;text-align:center;font-size:58px;font-style:italic">But we can know how often our methods lead us astray.</div>`;
  h += `<div id="${sid}-l3" class="abs serif" style="left:0;width:1920px;top:700px;text-align:center;font-size:76px;font-weight:600;color:${C.amberSoft};line-height:1.2">Not certainty about the truth,<br>but certainty about ourselves.</div>`;
  tw.push(pop(`#${sid}-white`, .3, { d: .8 }), fade(`#${sid}-l1`, cue(sc, 1, .05), { d: .9 }), fade(`#${sid}-l2`, cue(sc, 2, .05), { d: .9 }), out(`#${sid}-l1`, cue(sc, 3, 0) - .1, { to: .35 }), out(`#${sid}-l2`, cue(sc, 3, 0) - .1, { to: .5 }), fade(`#${sid}-l3`, cue(sc, 3, .35), { d: 1.1 }));
  files[sid] = scene(sid, h, tw, sc);
}

/* =============================== ROOT =============================== */
let hosts = '';
for (const sc of T.scenes){
  writeFileSync(join(ROOT, 'compositions', `${sc.id}.html`), files[sc.id]);
  hosts += `      <div id="${sc.id}" class="clip" data-composition-id="${sc.id}" data-composition-src="compositions/${sc.id}.html" data-start="${sc.start}" data-duration="${sc.dur}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080"></div>\n`;
}
const index = `<!doctype html>
<html lang="en" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>The Pool Table and the Orchard</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #0b2c21; }
      #ground { position: absolute; inset: 0; background: #0b2c21; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${T.total}" data-width="1920" data-height="1080">
      <div id="ground"></div>
${hosts}      <audio id="voiceover" src="assets/vo/voice.wav" data-start="0" data-duration="${T.total}" data-track-index="2" data-volume="1"></audio>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`;
writeFileSync(join(ROOT, 'index.html'), index);
console.log('scenes written:', T.scenes.map(s => `${s.id} ${s.dur}s`).join(', '), '| total', T.total);
