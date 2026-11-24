(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '–');
const int = x => x.toLocaleString('en-US');
const pct = (x, d = 1) => (Number.isFinite(x) ? (100 * x).toFixed(d) + '%' : '–');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MINUS = s => String(s).replace(/^-/, '−');

/* ---------------- colors ---------------- */
const C = {ink:'#f5f2e7', muted:'#c9cfc3', line:'#3f6656', surface:'#0f3a2c', bg:'#0a2a20', felt:'#1c5c45', 'felt-2':'#0e3b2c', wood:'#3f2c22', 'wood-2':'#16503c', pocket:'#0b241b', orange:'#e8912f', 'orange-ink':'#f6b46e', leaf:'#6fae7f', bayes:'#9cc3ea', freq:'#e6b660', cover:'#8fd3a8', miss:'#ef7a66', 'ball-l':'#c24b3a', 'ball-r':'#d9a44a', bar:'#f5f2e7', amber:'#d9a44a'};
function readColors(){}
function rgba(hex, a){ const h = hex.replace('#',''); const n = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; }
readColors();

/* ---------------- math ---------------- */
let spare = null;
function randn(){ if (spare !== null){ const s = spare; spare = null; return s; } let u = 0, v = 0; while (u === 0) u = Math.random(); v = Math.random(); const r = Math.sqrt(-2*Math.log(u)); spare = r*Math.sin(2*Math.PI*v); return r*Math.cos(2*Math.PI*v); }
function lgamma(x){ const c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI/Math.abs(Math.sin(Math.PI*x))) - lgamma(1-x);
  x -= 1; let a = c[0]; const t = x + 7.5; for (let i = 1; i < 9; i++) a += c[i]/(x+i);
  return 0.5*Math.log(2*Math.PI) + (x+0.5)*Math.log(t) - t + Math.log(a); }
function betacf(a, b, x){ const FP = 1e-300; let qab=a+b, qap=a+1, qam=a-1, c=1, d=1-qab*x/qap; if (Math.abs(d)<FP) d=FP; d=1/d; let h=d;
  for (let m=1; m<=300; m++){ const m2=2*m; let aa=m*(b-m)*x/((qam+m2)*(a+m2)); d=1+aa*d; if(Math.abs(d)<FP)d=FP; c=1+aa/c; if(Math.abs(c)<FP)c=FP; d=1/d; h*=d*c;
    aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2)); d=1+aa*d; if(Math.abs(d)<FP)d=FP; c=1+aa/c; if(Math.abs(c)<FP)c=FP; d=1/d; const del=d*c; h*=del; if(Math.abs(del-1)<3e-14) break; }
  return h; }
function ibeta(x, a, b){ if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a+b)-lgamma(a)-lgamma(b)+a*Math.log(x)+b*Math.log(1-x));
  return x < (a+1)/(a+b+2) ? bt*betacf(a,b,x)/a : 1 - bt*betacf(b,a,1-x)/b; }
function tcdf(t, df){ const x = df/(df+t*t); const p = 0.5*ibeta(x, df/2, 0.5); return t > 0 ? 1-p : p; }
function tpdf(t, df){ return Math.exp(lgamma((df+1)/2) - lgamma(df/2) - 0.5*Math.log(df*Math.PI) - (df+1)/2*Math.log(1+t*t/df)); }
function bisect(f, target, lo, hi, it = 100){ for (let i=0;i<it;i++){ const m=(lo+hi)/2; if (f(m) < target) lo=m; else hi=m; } return (lo+hi)/2; }
const tinvCache = new Map();
function tinv(p, df){ const k = p+'|'+df; if (!tinvCache.has(k)) tinvCache.set(k, bisect(t=>tcdf(t,df), p, -2000, 2000, 80)); return tinvCache.get(k); }
function erf(x){ const s=Math.sign(x); x=Math.abs(x); const t=1/(1+0.3275911*x); const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x); return s*y; }
const ncdf = z => 0.5*(1+erf(z/Math.SQRT2));
const npdf = z => Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);
function betaPdf(x, a, b){ x = clamp(x, 1e-9, 1-1e-9); return Math.exp((a-1)*Math.log(x)+(b-1)*Math.log(1-x)-(lgamma(a)+lgamma(b)-lgamma(a+b))); }
const betaInv = (p, a, b) => bisect(x=>ibeta(x,a,b), p, 0, 1, 60);
function wilson(k, n, z = 1.959964){ const ph=k/n, z2=z*z, den=1+z2/n; const c=(ph+z2/(2*n))/den; const h=z*Math.sqrt(ph*(1-ph)/n+z2/(4*n*n))/den; return [Math.max(0,c-h), Math.min(1,c+h)]; }
const meanOf = a => a.reduce((s,x)=>s+x,0)/a.length;
function sdOf(a){ const m = meanOf(a); let s=0; for (const x of a) s+=(x-m)**2; return Math.sqrt(s/(a.length-1)); }

/* ---------------- orchard shapes (standardised: mean 0, sd 1) ---------------- */
const R3 = Math.sqrt(3);
const SHAPES = {
  normal:  {label:'Normal',     std:()=>randn(),                                pdf:z=>npdf(z), skew:0},
  skewed:  {label:'Skewed',     std:()=>-Math.log(1-Math.random())-1,           pdf:z=>z<-1?0:Math.exp(-(z+1)), skew:2},
  uniform: {label:'Flat',       std:()=>R3*(2*Math.random()-1),                 pdf:z=>Math.abs(z)<=R3?1/(2*R3):0, skew:0},
  bimodal: {label:'Two-humped', std:()=>(Math.random()<.5?-.8:.8)+.6*randn(),   pdf:z=>.5*(npdf((z+.8)/.6)+npdf((z-.8)/.6))/.6, skew:0},
};
let shape = 'normal';
const MU = 145, SIG = 15;
const weight = (mu = MU, sig = SIG) => mu + sig*SHAPES[shape].std();
const popPdf = (x, mu = MU, sig = SIG) => SHAPES[shape].pdf((x-mu)/sig)/sig;
const shapeListeners = [];
function buildShapePickers(){
  $$('.shape-pick').forEach(el => {
    el.setAttribute('role','group'); el.setAttribute('aria-label','Shape of the orchard');
    el.innerHTML = '<span class="lbl">orchard shape</span>' + Object.entries(SHAPES).map(([k,s]) => `<button type="button" data-shape="${k}" aria-pressed="${k===shape}">${s.label}</button>`).join('');
    el.addEventListener('click', e => { const b = e.target.closest('button[data-shape]'); if (b) setShape(b.dataset.shape); });
  });
}
function setShape(k){ if (k === shape) return; shape = k; $$('.shape-pick button').forEach(b => b.setAttribute('aria-pressed', b.dataset.shape === k)); shapeListeners.forEach(f => f()); }
buildShapePickers();

/* ---------------- canvas helpers ---------------- */
const canvases = [];
function makeCanvas(el, heightFn, draw){
  const c = {el, ctx: el.getContext('2d'), w: 0, h: 0};
  c.resize = () => { const w = el.clientWidth; if (!w) return; const h = Math.round(heightFn(w)); if (w === c.w && h === c.h) return;
    c.w = w; c.h = h; const d = window.devicePixelRatio || 1; el.style.height = h + 'px'; el.width = Math.round(w*d); el.height = Math.round(h*d); c.ctx.setTransform(d,0,0,d,0,0); draw(c); };
  c.redraw = () => { if (c.w) draw(c); };
  new ResizeObserver(c.resize).observe(el);
  canvases.push(c); return c;
}
function redrawAll(){ readColors(); canvases.forEach(c => c.redraw()); }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redrawAll);
new MutationObserver(redrawAll).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawAll);

const lin = (d0, d1, r0, r1) => v => r0 + (v-d0)/(d1-d0)*(r1-r0);
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
function txt(ctx, s, x, y, o = {}){ ctx.fillStyle = o.color || C.muted; ctx.font = `${o.weight||400} ${o.size||11}px ${o.font||MONO}`; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic'; ctx.fillText(s, x, y); }
function niceTicks(min, max, maxCount){ const raw = (max-min)/Math.max(1,maxCount); const mag = 10**Math.floor(Math.log10(raw)); const step = [1,2,2.5,5,10].map(m=>m*mag).find(s=>s>=raw-1e-12); const out=[]; for (let v=Math.ceil(min/step-1e-9)*step; v<=max+1e-9; v+=step) out.push(+v.toFixed(10)); return out; }
function xAxis(ctx, sx, y, min, max, w, fmtF, label, grid){
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx(min), y+.5); ctx.lineTo(sx(max), y+.5); ctx.stroke();
  const tk = niceTicks(min, max, Math.max(3, Math.floor(w/80)));
  tk.forEach(t => { const x = Math.round(sx(t))+.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y+4); ctx.stroke();
    if (grid){ ctx.save(); ctx.strokeStyle = rgba(C.line, .6); ctx.setLineDash([2,4]); ctx.beginPath(); ctx.moveTo(x, grid); ctx.lineTo(x, y); ctx.stroke(); ctx.restore(); }
    txt(ctx, MINUS(fmtF ? fmtF(t) : t), x, y+16, {align:'center'}); });
  if (label) txt(ctx, label, (sx(min)+sx(max))/2, y+31, {align:'center'});
}
function curvePath(ctx, f, a, b, sx, sy, steps = 300){ ctx.beginPath(); for (let i=0;i<=steps;i++){ const x=a+(b-a)*i/steps; const X=sx(x), Y=sy(f(x)); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y); } }
function vline(ctx, x, y0, y1, color, dash, width = 1.2){ ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(Math.round(x)+.5, y0); ctx.lineTo(Math.round(x)+.5, y1); ctx.stroke(); ctx.restore(); }
function circle(ctx, x, y, r, fill, stroke, lw = 1){ ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); if (fill){ ctx.fillStyle = fill; ctx.fill(); } if (stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } }
function roundRect(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function label(ctx, s, x, y, o = {}){ // text with background pill, keeps inside [minX,maxX]
  ctx.font = `${o.weight||500} ${o.size||11}px ${MONO}`; const w = ctx.measureText(s).width + 10, h = (o.size||11) + 8;
  let lx = o.align === 'right' ? x - w : o.align === 'center' ? x - w/2 : x; lx = clamp(lx, o.minX ?? 0, (o.maxX ?? 1e9) - w);
  roundRect(ctx, lx, y - h/2, w, h, 4); ctx.fillStyle = o.bg || rgba(C.surface, .92); ctx.fill();
  txt(ctx, s, lx+5, y+.5, {color: o.color || C.ink, size: o.size||11, base:'middle', weight: o.weight||500});
}
function player(btn, step){ let on = false, raf = 0; const loop = () => { if (!on) return; step(); raf = requestAnimationFrame(loop); };
  btn.addEventListener('click', () => { on = !on; btn.textContent = on ? 'Pause' : 'Play'; btn.setAttribute('aria-pressed', on); if (on) loop(); else cancelAnimationFrame(raf); });
  return { stop(){ on = false; cancelAnimationFrame(raf); btn.textContent = 'Play'; btn.setAttribute('aria-pressed', false); }, get on(){ return on; } };
}
function bindRange(id, outId, fn){ const el = $('#'+id), out = $('#'+outId); const h = () => { out.textContent = el.value; fn(+el.value); }; el.addEventListener('input', h); return el; }

/* =================================================================
   PRELUDE: POOL TABLE
   ================================================================= */
const pool = {p: .37, px: .45, drag: null, repRef: null, revealed: false, balls: [], mode: 'bayes', nRep: 0, kc: [], hover: null, raf: 0, lastN: -1};
function binomPmf(j, n, q){ if (q <= 0) return j === 0 ? 1 : 0; if (q >= 1) return j === n ? 1 : 0; return Math.exp(lgamma(n+1) - lgamma(j+1) - lgamma(n-j+1) + j*Math.log(q) + (n-j)*Math.log(1-q)); }
// probability, if the white ball is at q, of an estimate at least as far out as k/n on the same side of q
function tailProb(k, n, q){ let t = 0; if (k/n <= q){ for (let j = 0; j <= k; j++) t += binomPmf(j, n, q); } else { for (let j = k; j <= n; j++) t += binomPmf(j, n, q); } return Math.min(1, t); }
function chanceText(t, unit = 'experiments'){ if (t >= .095) return `${pct(t, 0)} of ${unit}`; if (t >= .001) return `${pct(t, 1)} of ${unit}`; if (t <= 0) return `none of the ${unit}`;
  const inv = 1/t, mag = 10**Math.max(0, Math.floor(Math.log10(inv)) - 1); return `about 1 in ${int(Math.round(inv/mag)*mag)} ${unit}`; }
// the 95% interval: the middle 95% of the bootstrap distribution, Binomial(n, p̂)/n (percentile bootstrap, computed exactly)
function bootCI(k, n){ return pctRange(k/n, n); }
// middle 95% of the estimates j/n when each ball lands below with probability q
function pctRange(q, n){ let c = 0, lo = null, hi = null;
  for (let j = 0; j <= n; j++){ c += binomPmf(j, n, q); if (lo === null && c >= .025 - 1e-12) lo = j; if (hi === null && c >= .975 - 1e-12){ hi = j; break; } }
  return [lo/n, (hi === null ? n : hi)/n]; }
// share of bootstrap estimates that land at least as far from p̂ as the white ball, on the white ball's side
function bootTail(k, n, p){ const q = k/n; let t = 0; for (let j = 0; j <= n; j++){ const x = j/n; if (p <= q ? x <= p + 1e-12 : x >= p - 1e-12) t += binomPmf(j, n, q); } return Math.min(1, t); }
const feltBox = c => { const pad = Math.max(16, Math.round(c.w*.045)); return {x0: pad, x1: c.w-pad, y0: pad, y1: c.h-pad}; };
function poolCounts(now = performance.now()){ let n = 0, k = 0; for (const b of pool.balls){ if (now >= b.t0 + b.dur){ n++; if (b.below) k++; } } return {n, k}; }
const BALLS = {red:['#f4917d','#c24b3a','#74251c','#5e1d15'], amber:['#f6d79a','#d9a44a','#8a5d12','#6b470c'], white:['#fffdf6','#efe9d8','#c9c0a9','#b3a98f']};
function drawBall(ctx, x, y, r, kind){ const s = BALLS[kind]; ctx.beginPath(); ctx.ellipse(x + r*.2, y + r*.6, r*.95, r*.5, 0, 0, Math.PI*2); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fill();
  const g = ctx.createRadialGradient(x - r*.32, y - r*.38, r*.08, x, y, r*1.05); g.addColorStop(0, s[0]); g.addColorStop(.55, s[1]); g.addColorStop(1, s[2]); circle(ctx, x, y, r, g, s[3], .7); }

const poolTable = makeCanvas($('#poolTable'), w => clamp(w*.48, 180, 420), c => {
  const {ctx, w, h} = c; ctx.clearRect(0,0,w,h); const f = feltBox(c);
  roundRect(ctx, 0, 0, w, h, 14); ctx.fillStyle = C.wood; ctx.fill();
  roundRect(ctx, f.x0-6, f.y0-6, f.x1-f.x0+12, f.y1-f.y0+12, 6); ctx.fillStyle = C['wood-2']; ctx.fill();
  const g = ctx.createRadialGradient(w/2, h/2, 10, w/2, h/2, w*.6); g.addColorStop(0, C.felt); g.addColorStop(1, C['felt-2']);
  ctx.fillStyle = g; ctx.fillRect(f.x0, f.y0, f.x1-f.x0, f.y1-f.y0);
  // diamonds (sights) on rails at eighths
  for (let i = 1; i < 8; i++){ if (i === 4) continue; const x = f.x0 + (f.x1-f.x0)*i/8; [f.y0/2, h - f.y0/2].forEach(y => { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI/4); ctx.fillStyle = 'rgba(255,240,215,.7)'; ctx.fillRect(-2.2,-2.2,4.4,4.4); ctx.restore(); }); }
  const pr = Math.max(7, f.y0*.6);
  [[f.x0,f.y0],[(f.x0+f.x1)/2,f.y0-3],[f.x1,f.y0],[f.x0,f.y1],[(f.x0+f.x1)/2,f.y1+3],[f.x1,f.y1]].forEach(([x,y]) => circle(ctx, x, y, pr, C.pocket));
  const r = clamp((f.y1-f.y0)*.042, 4, 10);
  const X = u => f.x0 + r + u*(f.x1-f.x0-2*r), H = v => f.y1 - r - v*(f.y1-f.y0-2*r);
  [.25, .5, .75].forEach(v => txt(ctx, String(v), f.x0/2 - 1, H(v) + 3, {align:'center', size: 9, color: 'rgba(255,240,215,.75)'}));
  const now = performance.now();
  // the current 95% interval, drawn as a band across the felt
  const cnt = poolCounts(now); let ci = null;
  if (cnt.n && pool.mode === 'freq'){ const col = C.amber;
    // glide the displayed band toward the current interval so changes are visible
    const [tlo, thi] = bootCI(cnt.k, cnt.n), test = cnt.k/cnt.n; const B = pool.band || (pool.band = {lo: tlo, hi: thi, est: test});
    let moving = false; for (const [key, tv] of [['lo', tlo], ['hi', thi], ['est', test]]){ const d = tv - B[key]; if (Math.abs(d) > .002 && !reduceMotion){ B[key] += d*.22; moving = true; } else B[key] = tv; }
    if (moving && !pool.bandRaf) pool.bandRaf = requestAnimationFrame(() => { pool.bandRaf = 0; poolTable.redraw(); });
    const lo = B.lo, hi = B.hi, est = B.est; const yA = H(hi), yB = H(lo);
    ctx.fillStyle = rgba(col, .13); ctx.fillRect(f.x0, yA, f.x1-f.x0, yB-yA);
    ctx.strokeStyle = rgba(col, .6); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.x0, Math.round(yA)+.5); ctx.lineTo(f.x1, Math.round(yA)+.5); ctx.moveTo(f.x0, Math.round(yB)+.5); ctx.lineTo(f.x1, Math.round(yB)+.5); ctx.stroke();
    ctx.save(); ctx.setLineDash([2,4]); ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(f.x0, H(est)); ctx.lineTo(f.x1, H(est)); ctx.stroke(); ctx.restore();
    // bracket on the right rail: the interval, with a pointer at p̂
    const bx = f.x1 + (w - f.x1)*.55; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bx, yA); ctx.lineTo(bx, yB); ctx.stroke(); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx, yA); ctx.lineTo(bx - 6, yA); ctx.moveTo(bx, yB); ctx.lineTo(bx - 6, yB); ctx.stroke(); ctx.lineCap = 'butt';
    const ye = H(est); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(bx - 4, ye); ctx.lineTo(bx + 5, ye - 5); ctx.lineTo(bx + 5, ye + 5); ctx.closePath(); ctx.fill();
    ci = [tlo, thi]; } else pool.band = null;
  if (pool.revealed){ const yy = Math.round(H(pool.p)) + .5; ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.setLineDash([5,5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(f.x0, yy); ctx.lineTo(f.x1, yy); ctx.stroke(); ctx.restore(); }
  for (const b of pool.balls){ if (now < b.t0) continue; const e = b.dur ? clamp((now-b.t0)/b.dur, 0, 1) : 1; const q = 1 - (1-e)**3;
    const x = X(b.sx + (b.x - b.sx)*q), y = H(b.sy + (b.y - b.sy)*q);
    if (pool.drag && pool.drag.ball === b && pool.drag.out) ctx.globalAlpha = .35;
    drawBall(ctx, x, y, r*(pool.balls.length > 300 ? .7 : 1), b.below ? 'red' : 'amber'); ctx.globalAlpha = 1; }
  if (pool.revealed){
    if (ci){ const inside = ci[0] <= pool.p && pool.p <= ci[1]; circle(ctx, X(pool.px), H(pool.p), r*1.2 + 5, null, inside ? C.cover : C.miss, 2.5); }
    drawBall(ctx, X(pool.px), H(pool.p), r*1.2, 'white'); }
  // live label next to whatever is being dragged
  if (pool.drag){ const d = pool.drag; let s, bx, by;
    if (d.type === 'white'){ s = `p = ${fmt(pool.p, 2)}`; bx = X(pool.px); by = H(pool.p); }
    else { bx = X(d.ball.x); by = H(d.ball.y); s = d.out ? 'release to remove this ball' : `height ${fmt(d.ball.y, 2)} · ${d.ball.below ? 'below' : 'above'} the white ball · ` + (pool.mode === 'freq' ? `p̂ = ${cnt.k}/${cnt.n} = ${fmt(cnt.k/cnt.n, 2)}` : `${cnt.k} of ${cnt.n} below`); }
    label(ctx, s, bx + r + 8, clamp(by - r - 10, f.y0 + 10, f.y1 - 10), {minX: f.x0 + 4, maxX: f.x1 - 4, size: 10.5}); }
});
const poolChart = makeCanvas($('#poolChart'), w => pool.mode === 'freq' ? (w < 560 ? 340 : 360) : (w < 560 ? 250 : 280), c => {
  const {ctx, w, h} = c; ctx.clearRect(0,0,w,h); const pad = Math.max(16, Math.round(w*.045));
  const x0 = pad, x1 = w - pad, top = 18, bot = h - 36; const sx = lin(0, 1, x0, x1);
  const {n, k} = poolCounts();
  if (pool.mode === 'bayes'){
    const a = k+1, b = n-k+1; const N = 600; let ymax = 1.5; const ys = [];
    for (let i = 0; i <= N; i++){ const d = betaPdf(i/N, a, b); ys.push(d); if (d > ymax) ymax = d; }
    ymax *= 1.12; const sy = lin(0, ymax, bot, top);
    const lo = betaInv(.025, a, b), hi = betaInv(.975, a, b);
    // area
    ctx.beginPath(); ctx.moveTo(sx(0), sy(0)); ys.forEach((d,i) => ctx.lineTo(sx(i/N), sy(d))); ctx.lineTo(sx(1), sy(0)); ctx.closePath(); ctx.fillStyle = rgba(C.bayes, .10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx(lo), sy(0)); for (let i=0;i<=N;i++){ const x=i/N; if (x>=lo && x<=hi) ctx.lineTo(sx(x), sy(ys[i])); } ctx.lineTo(sx(hi), sy(0)); ctx.closePath(); ctx.fillStyle = rgba(C.bayes, .28); ctx.fill();
    // prior
    ctx.save(); ctx.setLineDash([5,5]); ctx.strokeStyle = C.muted; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(sx(0), sy(1)); ctx.lineTo(sx(1), sy(1)); ctx.stroke(); ctx.restore();
    txt(ctx, 'prior (flat)', sx(1) - 4, sy(1) - 6, {align:'right'});
    ctx.beginPath(); ys.forEach((d,i) => i ? ctx.lineTo(sx(i/N), sy(d)) : ctx.moveTo(sx(0), sy(d))); ctx.strokeStyle = C.bayes; ctx.lineWidth = 2.2; ctx.stroke();
    txt(ctx, n ? `posterior: Beta(${a}, ${b})` : 'no data yet: posterior = prior', x0, top + 4, {color: C.bayes, size: 12, weight: 500, base: 'top'});
    if (n) txt(ctx, `shaded: 95% credible interval [${fmt(lo,2)}, ${fmt(hi,2)}]`, x0, top + 20, {size: 11, base:'top'});
    if (pool.revealed){ vline(ctx, sx(pool.p), top, bot, C.ink, [3,3], 1.5); label(ctx, `white ball at ${fmt(pool.p,2)}`, sx(pool.p) + 6, bot - 14, {minX: x0, maxX: x1, size: 10}); }
    if (pool.hover !== null){ const hx = sx(pool.hover); vline(ctx, hx, top, bot, C.bayes, null, 1);
      const pr = ibeta(pool.hover, a, b); ctx.save(); ctx.beginPath(); ctx.moveTo(sx(0), sy(0)); for (let i=0;i<=N;i++){ const x=i/N; if (x<=pool.hover) ctx.lineTo(sx(x), sy(ys[i])); } ctx.lineTo(hx, sy(0)); ctx.closePath(); ctx.fillStyle = rgba(C.bayes, .25); ctx.fill(); ctx.restore();
      label(ctx, `P(p < ${fmt(pool.hover,2)} | data) = ${fmt(pr,3)}`, hx + 8, top + 44, {minX: x0, maxX: x1, color: C.bayes}); }
    xAxis(ctx, sx, bot, 0, 1, x1-x0, t => t.toFixed(t*10%1 ? 2 : 1), 'height of the white ball, p   (0 = bottom cushion, 1 = top cushion)');
  } else {
    const SANS = "'Avenir Next','Segoe UI',Arial,sans-serif";
    xAxis(ctx, sx, bot, 0, 1, x1-x0, t => t.toFixed(t*10%1 ? 2 : 1), 'height on the table   (0 = bottom cushion, 1 = top cushion)');
    if (!n){ txt(ctx, 'Roll some red balls first: without data there is nothing to estimate.', (x0+x1)/2, (top+bot)/2, {align:'center', size: 13, font: SANS, color: C.muted}); return; }
    const ph = k/n; const [lo, hi] = bootCI(k, n); const truth = pool.revealed;
    // smooth binomial curve through the exact probability of each possible estimate j/n
    const curveAt = (x, q) => { q = clamp(q, 1e-4, 1 - 1e-4); const j = x*n; return Math.exp(lgamma(n+1) - lgamma(j+1) - lgamma(n-j+1) + j*Math.log(q) + (n-j)*Math.log(1-q)); };
    txt(ctx, 'The bootstrap: where estimates land if the white ball were at your p̂', x0, top, {base:'top', size: 13.5, weight: 600, font: SANS, color: C.ink});
    const items = [['sq', C.amber, `your estimate p̂ = ${k}/${n} = ${fmt(ph,2)}`], ['dash', C.amber, 'exact bootstrap distribution'], ['fill', C.amber, `middle 95% = your interval [${fmt(lo,2)}, ${fmt(hi,2)}]`]];
    if (pool.nRep) items.push(['bar', rgba(C.ink, .45), `${int(pool.nRep)} bootstrap replays`]); else items.push(['bar', rgba(C.ink, .2), 'press Replay to add bootstrap replays']);
    if (truth) items.push(['line', C.bayes, 'where estimates land if the white ball is where it really is'], ['line', C.ink, `the white ball, p = ${fmt(pool.p,2)}`]);
    ctx.font = `400 11px ${SANS}`; let lx = x0, ly = top + 24;
    for (const [kind, col, s] of items){ const iw = 20 + ctx.measureText(s).width + 18; if (lx + iw > x1 && lx > x0){ lx = x0; ly += 17; }
      if (kind === 'sq' || kind === 'bar'){ ctx.fillStyle = col; ctx.fillRect(lx, ly + 1, 10, 10); }
      else if (kind === 'fill'){ ctx.fillStyle = rgba(col, .3); ctx.fillRect(lx, ly + 1, 14, 10); ctx.fillStyle = col; ctx.fillRect(lx, ly + 1, 1.5, 10); ctx.fillRect(lx + 12.5, ly + 1, 1.5, 10); }
      else { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; if (kind === 'dash') ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(lx, ly + 6); ctx.lineTo(lx + 15, ly + 6); ctx.stroke(); ctx.restore(); }
      txt(ctx, s, lx + 20, ly, {base:'top', size: 11, font: SANS, color: kind === 'sq' ? '#f3d9a8' : C.muted}); lx += iw; }
    const aTop = ly + 46, aBot = bot - 1;
    const grid = Array.from({length: 241}, (_, i) => i/240);
    let mx = .05; for (let j = 0; j <= n; j++) mx = Math.max(mx, pool.nRep ? (pool.kc[j] || 0)/pool.nRep : 0);
    for (const x of grid) mx = Math.max(mx, curveAt(x, ph));
    if (truth) for (const x of grid) mx = Math.max(mx, curveAt(x, pool.p));
    const sy = lin(0, mx*1.1, aBot, aTop);
    niceTicks(0, mx, 2).filter(t => t > 0 && t <= mx*1.1).forEach(t => { const y = Math.round(sy(t)) + .5; ctx.strokeStyle = rgba(C.ink, .1); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      txt(ctx, `${Math.round(t*100)}% of replays`, x1, y - 4, {align:'right', size: 10, font: SANS}); });
    // your interval: the middle 95% of the bootstrap distribution
    const bx0 = sx(lo) - 2, bx1 = Math.max(sx(hi) + 2, bx0 + 4);
    ctx.fillStyle = rgba(C.amber, .13); ctx.fillRect(bx0, aTop - 10, bx1 - bx0, aBot - aTop + 10);
    ctx.fillStyle = rgba(C.amber, .7); ctx.fillRect(bx0, aTop - 10, 1.5, aBot - aTop + 10); ctx.fillRect(bx1 - 1.5, aTop - 10, 1.5, aBot - aTop + 10);
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 2, aTop - 6, x1 - x0 + 4, aBot - aTop + 7); ctx.clip();
    const slot = (x1 - x0)/(n + 1); const bw = clamp(slot*.55, 2, 20);
    if (pool.nRep) for (let j = 0; j <= n; j++){ const v = (pool.kc[j] || 0)/pool.nRep; if (!v) continue; const X = sx(j/n), y = sy(v);
      roundRect(ctx, X - bw/2, y, bw, aBot - y + .5, Math.min(3, bw/2)); ctx.fillStyle = j === k ? rgba(C.amber, .85) : rgba(C.ink, .45); ctx.fill(); }
    else { roundRect(ctx, sx(ph) - bw/2, aBot - 6, bw, 6.5, 2); ctx.fillStyle = C.amber; ctx.fill(); }
    // the white ball's own distribution: where estimates land if the white ball is where it really is
    if (truth){ ctx.beginPath(); ctx.moveTo(sx(0), sy(0)); grid.forEach(x => ctx.lineTo(sx(x), sy(curveAt(x, pool.p)))); ctx.lineTo(sx(1), sy(0)); ctx.closePath(); ctx.fillStyle = rgba(C.bayes, .12); ctx.fill();
      ctx.beginPath(); grid.forEach((x, i) => { const Y = sy(curveAt(x, pool.p)); i ? ctx.lineTo(sx(x), Y) : ctx.moveTo(sx(x), Y); }); ctx.strokeStyle = C.bayes; ctx.lineWidth = 2.2; ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(sx(0), sy(0)); grid.forEach(x => ctx.lineTo(sx(x), sy(curveAt(x, ph)))); ctx.lineTo(sx(1), sy(0)); ctx.closePath(); ctx.fillStyle = rgba(C.amber, .07); ctx.fill();
    ctx.save(); ctx.setLineDash([5,4]); ctx.beginPath(); grid.forEach((x, i) => { const Y = sy(curveAt(x, ph)); i ? ctx.lineTo(sx(x), Y) : ctx.moveTo(sx(x), Y); }); ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    ctx.restore();
    if (k === 0 || k === n) label(ctx, 'all balls on one side: no spread to copy, so every replay repeats p̂', (x0 + x1)/2, aTop + 14, {align:'center', minX: x0, maxX: x1, size: 10.5, color: '#f3d9a8'});
    // the white ball: inside or outside the middle 95%?
    if (truth){ const inside = lo <= pool.p && pool.p <= hi, X = sx(pool.p), yb = aTop - 24;
      vline(ctx, X, yb, aBot, rgba(C.ink, .85), null, 1.6); drawBall(ctx, X, yb, 6, 'white');
      const t = bootTail(k, n, pool.p), left = pool.p > .5;
      label(ctx, inside ? 'the white ball is inside your interval' : `outside: only ${chanceText(t, 'bootstrap replays')} land this far out`, X + (left ? -12 : 12), yb, {align: left ? 'right' : 'left', minX: x0, maxX: x1, size: 10.5, color: inside ? C.cover : C.miss}); }
  }
});
function poolText(){
  const {n, k} = poolCounts(); $('#kLeft').textContent = k; $('#kRight').textContent = n-k; $('#kN').textContent = n;
  // status line under the table
  const white = pool.revealed ? `<span class="ts-item"><i class="sw white"></i>white ball at <b>p = ${fmt(pool.p, 2)}</b></span>` : `<span class="ts-item muted">white ball hidden · tick “Show the white ball” to play nature</span>`;
  let ts = '';
  if (pool.mode === 'freq'){
    if (!n) ts = `<span class="ts-item muted">Click the felt or roll a ball: the interval appears once there is data.</span>` + white;
    else { const [lo, hi] = bootCI(k, n);
      ts =`<span class="ts-item"><i class="sw band"></i>95% confidence interval <b>[${fmt(lo,2)}, ${fmt(hi,2)}]</b></span><span class="ts-item"><i class="sw dash"></i>estimate <b>p̂ = ${k}/${n} = ${fmt(k/n,2)}</b></span>` + white;
      if (pool.revealed) ts += (lo <= pool.p && pool.p <= hi) ? `<span class="pill ok">caught: p is inside this interval</span>` : `<span class="pill bad">missed: p is outside this interval</span>`; }
  } else ts = white + `<span class="ts-item muted">The Bayesian answer is the posterior curve below.</span>`;
  // live reading while a ball is being dragged
  const d = pool.drag;
  if (d && d.type === 'red' && !d.out){ const crossed = d.lastBelow !== undefined && d.lastBelow !== d.ball.below; d.lastBelow = d.ball.below;
    if (crossed) d.flash = performance.now();
    const fresh = d.flash && performance.now() - d.flash < 1500;
    ts = `<span class="ts-item drag"><i class="sw ${d.ball.below ? 'red' : 'yellow'}"></i>dragged ball at height <b>${fmt(d.ball.y, 2)}</b>, ${d.ball.below ? 'below' : 'above'} the white ball</span>` + ts +
      `<span class="ts-item muted">${fresh ? '<strong style="color:#f3d9a8">The ball just crossed the white ball, so k changed and the interval moved.</strong>' : 'The interval stays put until the ball crosses the white ball’s height.'}</span>`;
  } else if (d && d.type === 'white') ts = `<span class="ts-item drag"><i class="sw white"></i>moving the white ball: <b>p = ${fmt(pool.p, 2)}</b></span>` + ts;
  $('#tableStatus').innerHTML = ts;
  let s = '';
  if (pool.mode === 'bayes'){
    const a = k+1, b = n-k+1;
    if (!n) s = `<p><strong>No red balls yet.</strong> The belief about <i>p</i> is the flat prior: every position equally plausible. P(white ball in the lower half) = 0.50.</p>`;
    else { const lo = betaInv(.025,a,b), hi = betaInv(.975,a,b);
      s = `<p><strong>${n} red ball${n>1?'s':''}: ${k} below, ${n-k} above.</strong> Posterior Beta(${k}+1, ${n-k}+1) = Beta(${a}, ${b}).</p>
      <p>Posterior mean (best guess): <span class="num">${fmt(a/(a+b),3)}</span>.<br>P(white ball in the lower half | data) = <span class="num">${fmt(ibeta(.5,a,b),3)}</span>.</p>
      <p>"There is a 95% probability that the white ball lies between <span class="num">${fmt(lo,2)}</span> and <span class="num">${fmt(hi,2)}</span>." A Bayesian may say this; a frequentist may not.</p>`; }
    s += `<p style="color:var(--muted);font-size:.85rem">Hover or drag across the chart to read off P(p &lt; x | data).</p>`;
  } else {
    if (!n) s = `<p><strong>No data yet.</strong> The white ball is somewhere, at one fixed position. There is no distribution over <i>p</i> to draw.</p>`;
    else { const [lo, hi] = bootCI(k, n), ph = k/n, inside = lo <= pool.p && pool.p <= hi;
      s = `<p><strong>Estimate:</strong> p̂ = ${k}/${n} = <span class="num">${fmt(ph,3)}</span>. <strong>95% interval:</strong> [<span class="num">${fmt(lo,2)}</span>, <span class="num">${fmt(hi,2)}</span>], the middle 95% of the bootstrap distribution${pool.revealed ? (inside ? ', and it <span style="color:var(--cover)">contains</span> the white ball.' : ', and it <span style="color:var(--miss)">misses</span> the white ball.') : '.'}</p>`;
      if (k === 0 || k === n) s += `<p style="color:#f3d9a8">All ${n} ball${n > 1 ? 's' : ''} landed on the same side of the white ball, so your data show no spread. If the white ball really sat at ${fmt(ph,2)}, every ball would land on that side every time, so every bootstrap replay repeats p̂ = ${fmt(ph,2)} and the interval shrinks to a single point. The bootstrap can only copy the spread your data show. Roll more balls.</p>`;
      if (pool.revealed){ const t = bootTail(k, n, pool.p);
        s += `<p><strong>Where does the white ball fall?</strong> If the white ball sat at your estimate, ${fmt(ph,2)}, an estimate as far out as the real white ball (${fmt(pool.p,2)}) would come up in ${chanceText(t, 'bootstrap replays')}. ${inside ? 'That is inside the middle 95%, so your interval catches it.' : 'That is outside the middle 95%, so your interval misses it.'}</p>`;
        const [tl, th] = pctRange(pool.p, n), inMirror = tl <= ph && ph <= th;
        s += `<p><strong>The mirror view</strong> (blue curve): if the white ball is where it really is, ${n} random balls give estimates whose middle 95% is [${fmt(tl,2)}, ${fmt(th,2)}]. Your p̂ = ${fmt(ph,2)} is ${inMirror ? '<span style="color:var(--cover)">inside</span> it: an ordinary result.' : '<span style="color:var(--miss)">outside</span> it: an unusual result if the white ball really is there.'} ${inMirror === inside ? 'Both views agree.' : 'Here the two views disagree, which happens near the edge of the interval and with few balls.'}</p>`;
        const manual = pool.balls.filter(b => b.manual).length;
        if (manual) s += `<p style="color:#f3d9a8">${manual} of your ${n} balls were placed or moved by hand. The 95% promise is about balls rolled at random; hand-placed balls can say anything. Press <strong>Clear</strong> and use the <strong>Roll</strong> buttons to see what chance alone produces.</p>`; }
      s += `<p style="color:var(--muted);font-size:.85rem">Dragging a ball farther from the white ball changes nothing: <i>p̂</i> only uses which side each ball is on. It changes only when a ball crosses the white ball's height.</p>`;
      if (pool.nRep) s += `<p><strong>Bootstrap replays:</strong> ${int(pool.nRep)}. Each one pretends the white ball sits at your p̂ = ${fmt(ph,2)}, rolls ${n} balls and records the new estimate. The bars grow into the dashed curve, and the middle 95% of them is your interval.</p>`;
      else s += `<p>Press <strong>Replay</strong> to run the bootstrap: nobody can see the white ball, so pretend it sits at your estimate and roll ${n} balls again, many times. Where those estimates land shows how much p̂ wobbles.</p>`; }
  }
  $('#poolLive').innerHTML = s;
  $('#poolStatic').innerHTML = pool.mode === 'bayes'
    ? `<p><span class="badge bayes">Bayesian</span> <strong><i>p</i> is a random variable.</strong> Before any red balls, every position is equally plausible: a flat prior. Bayes justified it because the white ball itself was rolled at random.</p><p>Each below/above report updates that belief. After <i>k</i> balls below out of <i>n</i> the belief is the <strong>posterior</strong> Beta(<i>k</i>+1, <i>n</i>−<i>k</i>+1). The area under the curve between two positions is the probability that the ball lies there.</p><p style="color:var(--muted);font-size:.85rem">The balls are drawn so you can see them, but the models only use the counts, just like Bayes' blindfolded observer.</p>`
    : `<p><span class="badge freq">Frequentist</span> <strong><i>p</i> is a fixed number.</strong> The white ball has stopped. It is somewhere, and there is no probability distribution over where. So the chart has no curve over <i>p</i>.</p><p>What is random is the balls: <i>p̂</i> = <i>k</i>/<i>n</i> would come out differently if they were rolled again. Nobody can see the white ball, so the replays use the best stand-in available, your own estimate. This is the <strong>bootstrap</strong>: pretend the white ball sits at <i>p̂</i>, roll again many times, and see where the estimates land. The middle 95% of them is your <strong>95% interval</strong>.</p><p style="color:var(--muted);font-size:.85rem">This is the percentile bootstrap. The orchard chapters use the classical t interval. Both measure how far the estimate typically wanders from the truth, and they agree once there is enough data.</p>`;
}
function animatePool(){ if (pool.raf) return; const step = () => { pool.raf = 0; const now = performance.now(); poolTable.redraw(); const {n} = poolCounts(now);
    if (n !== pool.lastN){ pool.lastN = n; poolChart.redraw(); poolText(); }
    if (pool.balls.some(b => now < b.t0 + b.dur)) pool.raf = requestAnimationFrame(step); }; pool.raf = requestAnimationFrame(step); }
function resetReps(){ pool.nRep = 0; pool.kc = []; pool.repRef = null; }
function throwBalls(N){ N = Math.min(N, 3000 - pool.balls.length); if (N <= 0) return; const now = performance.now(); const stag = reduceMotion ? 0 : Math.min(70, 1200/N);
  for (let i = 0; i < N; i++){ const y = Math.random(); pool.balls.push({x: Math.random(), y, sx: .985, sy: Math.random(), t0: now + i*stag, dur: reduceMotion ? 0 : 500 + Math.random()*400, below: y < pool.p}); }
  resetReps(); animatePool(); }
function replay(times){ const {n, k: k0} = poolCounts(); if (!n) return;
  const q = k0/n;   // the bootstrap: pretend the white ball sits at your estimate
  if (pool.repRef !== null && pool.repRef !== q) resetReps(); pool.repRef = q;
  for (let t = 0; t < times; t++){ let k = 0; for (let i = 0; i < n; i++) if (Math.random() < q) k++; pool.nRep++; pool.kc[k] = (pool.kc[k] || 0) + 1; }
  poolChart.redraw(); poolText(); }
function setMode(m){ pool.mode = m; $('#modeBayes').setAttribute('aria-pressed', m === 'bayes'); $('#modeFreq').setAttribute('aria-pressed', m === 'freq');
  $('#poolLab').classList.toggle('mode-bayes', m === 'bayes'); $('#poolLab').classList.toggle('mode-freq', m === 'freq'); pool.hover = null; poolTable.redraw(); poolChart.resize(); poolChart.redraw(); poolText(); }
$('#modeBayes').onclick = () => setMode('bayes'); $('#modeFreq').onclick = () => setMode('freq');
$('#revealWhite').onchange = e => { pool.revealed = e.target.checked; poolTable.redraw(); poolChart.redraw(); poolText(); };
$('#throw1').onclick = () => throwBalls(1); $('#throw10').onclick = () => throwBalls(10); $('#throw100').onclick = () => throwBalls(100);
$('#clearRed').onclick = () => { pool.balls = []; resetReps(); pool.lastN = -1; animatePool(); poolTable.redraw(); poolChart.redraw(); poolText(); };
$('#newWhite').onclick = () => { pool.p = .03 + Math.random()*.94; pool.px = Math.random(); pool.balls = []; resetReps(); pool.revealed = false; $('#revealWhite').checked = false; pool.lastN = -1; poolTable.redraw(); poolChart.redraw(); poolText(); };
$('#rep1').onclick = () => replay(1); $('#rep100').onclick = () => replay(100);
/* ---- direct manipulation: click to drop a red ball, drag balls, drag the white ball ---- */
function tableGeom(){ const f = feltBox(poolTable), r = clamp((f.y1-f.y0)*.042, 4, 10);
  return {f, r, X: u => f.x0 + r + u*(f.x1-f.x0-2*r), H: v => f.y1 - r - v*(f.y1-f.y0-2*r),
    U: x => clamp((x-f.x0-r)/(f.x1-f.x0-2*r), 0, 1), V: y => clamp((f.y1-r-y)/(f.y1-f.y0-2*r), 0, 1)}; }
function tablePoint(e){ const b = poolTable.el.getBoundingClientRect(); return {x: e.clientX - b.left, y: e.clientY - b.top}; }
function hitBall(x, y){ const G = tableGeom(), now = performance.now();
  if (pool.revealed && Math.hypot(x - G.X(pool.px), y - G.H(pool.p)) <= G.r*1.7) return {type: 'white'};
  for (let i = pool.balls.length - 1; i >= 0; i--){ const b = pool.balls[i]; if (now < b.t0 + b.dur) continue;
    if (Math.hypot(x - G.X(b.x), y - G.H(b.y)) <= G.r*1.5) return {type: 'red', ball: b}; }
  return null; }
let liveRaf = 0;
function liveUpdate(){ if (liveRaf) return; liveRaf = requestAnimationFrame(() => { liveRaf = 0; const cc = poolCounts(); pool.lastN = cc.n;
  if (pool.nRep && cc.n && pool.repRef !== cc.k/cc.n) resetReps(); /* bootstrap replays depend on your p̂ */ poolTable.redraw(); poolChart.redraw(); poolText(); }); }
const tEl = $('#poolTable');
tEl.style.cursor = 'crosshair'; tEl.style.touchAction = 'none';
tEl.addEventListener('pointerdown', e => { const {x, y} = tablePoint(e), G = tableGeom(), f = G.f; let hit = hitBall(x, y);
  if (!hit){ if (x < f.x0 || x > f.x1 || y < f.y0 || y > f.y1 || pool.balls.length >= 3000) return;
    const b = {x: G.U(x), y: G.V(y), t0: 0, dur: 0, manual: true}; b.sx = b.x; b.sy = b.y; b.below = b.y < pool.p; pool.balls.push(b); resetReps(); hit = {type: 'red', ball: b}; }
  pool.drag = Object.assign(hit, {out: false}); tEl.setPointerCapture(e.pointerId); tEl.style.cursor = 'grabbing'; e.preventDefault(); liveUpdate(); });
tEl.addEventListener('pointermove', e => { const {x, y} = tablePoint(e), G = tableGeom(), f = G.f;
  if (!pool.drag){ tEl.style.cursor = hitBall(x, y) ? 'grab' : 'crosshair'; return; }
  if (pool.drag.type === 'white'){ pool.p = clamp(G.V(y), .01, .99); pool.px = G.U(x); pool.balls.forEach(b => b.below = b.y < pool.p); }
  else { const b = pool.drag.ball; b.manual = true; b.x = b.sx = G.U(x); b.y = b.sy = G.V(y); b.below = b.y < pool.p;
    pool.drag.out = x < f.x0 - 6 || x > f.x1 + 6 || y < f.y0 - 6 || y > f.y1 + 6; }
  liveUpdate(); });
const endDrag = () => { if (!pool.drag) return; const d = pool.drag; pool.drag = null;
  if (d.type === 'red' && d.out){ pool.balls.splice(pool.balls.indexOf(d.ball), 1); resetReps(); }
  tEl.style.cursor = 'crosshair'; liveUpdate(); };
tEl.addEventListener('pointerup', endDrag); tEl.addEventListener('pointercancel', endDrag);
const chartHover = e => { if (pool.mode !== 'bayes') return; const c = poolChart, pad = Math.max(16, Math.round(c.w*.045)), r = c.el.getBoundingClientRect(); pool.hover = clamp((e.clientX - r.left - pad)/(c.w - 2*pad), 0.001, .999); poolChart.redraw(); };
$('#poolChart').addEventListener('pointermove', chartHover); $('#poolChart').addEventListener('pointerdown', chartHover);
$('#poolChart').addEventListener('pointerleave', () => { pool.hover = null; poolChart.redraw(); });
poolText();
// start with a few balls so the first view shows something
pool.balls = [[.68,.12],[.22,.29],[.82,.45],[.3,.58],[.62,.66],[.16,.81],[.86,.93]].map(([x, y]) => ({x, y, sx: x, sy: y, t0: 0, dur: 0, below: y < pool.p}));
poolText();

/* =================================================================
   CHAPTER 2: RUNNING FREQUENCY
   ================================================================= */
const fq = {N: 0, NA: 0, pts: [], last: NaN};
const P_A = ncdf((140-MU)/(SIG/Math.sqrt(10)));
function fRep(times){ for (let t = 0; t < times; t++){ let s = 0; for (let i = 0; i < 10; i++) s += MU + SIG*randn(); const m = s/10; fq.N++; if (m < 140) fq.NA++; fq.pts.push(fq.NA/fq.N); fq.last = m; } fUpd(); }
function fUpd(){ $('#fN').textContent = int(fq.N); $('#fNA').textContent = int(fq.NA); $('#fRatio').textContent = fq.N ? fmt(fq.NA/fq.N, 3) : '–'; $('#fLast').textContent = fq.N ? `${fmt(fq.last,1)} g ${fq.last < 140 ? '(A)' : ''}` : '–'; fCanvas.redraw(); }
const fCanvas = makeCanvas($('#runFreq'), w => w < 560 ? 230 : 260, c => {
  const {ctx, w, h} = c; ctx.clearRect(0,0,w,h); const x0 = 44, x1 = w - 14, top = 14, bot = h - 38;
  const xmaxE = Math.max(2, Math.ceil(Math.log10(Math.max(10, fq.N)))); const lx = lin(0, xmaxE, x0, x1); const sy = lin(0, .5, bot, top);
  [0, .1, .2, .3, .4, .5].forEach(v => { ctx.strokeStyle = rgba(C.line, .7); ctx.beginPath(); ctx.moveTo(x0, Math.round(sy(v))+.5); ctx.lineTo(x1, Math.round(sy(v))+.5); ctx.stroke(); txt(ctx, v.toFixed(1), x0 - 6, sy(v) + 4, {align:'right'}); });
  ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(x0, bot+.5); ctx.lineTo(x1, bot+.5); ctx.stroke();
  for (let e = 0; e <= xmaxE; e++){ const x = lx(e); vline(ctx, x, bot, bot+4, C.line); txt(ctx, int(10**e), x, bot + 16, {align:'center'}); }
  txt(ctx, 'number of repetitions N (log scale)', (x0+x1)/2, bot + 31, {align:'center'});
  ctx.save(); ctx.setLineDash([6,5]); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x0, sy(P_A)); ctx.lineTo(x1, sy(P_A)); ctx.stroke(); ctx.restore();
  label(ctx, `P(A) = ${fmt(P_A,3)} (only nature knows this)`, x1, sy(P_A) - 14, {align:'right', minX: x0, maxX: x1, size: 10});
  if (fq.N){ ctx.beginPath(); const N = fq.N; const steps = Math.min(N, 1500); let prev = -1;
    for (let j = 0; j < steps; j++){ const i = steps === N ? j : Math.min(N-1, Math.round(10**(j/(steps-1)*Math.log10(N))) - 1); if (i === prev) continue; prev = i;
      const X = lx(Math.log10(i+1)), Y = sy(Math.min(.5, fq.pts[i])); j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.strokeStyle = C.orange; ctx.lineWidth = 2; ctx.stroke();
    const X = lx(Math.log10(N)), Y = sy(Math.min(.5, fq.pts[N-1])); circle(ctx, X, Y, 4, C.orange, C.surface, 1.5); }
  else txt(ctx, 'Press "Repeat" to run the experiment.', (x0+x1)/2, (top+bot)/2 + 30, {align:'center', size: 12});
  txt(ctx, 'N_A / N', x0 + 4, top + 10, {color: C.orange, weight: 500});
});
$('#f1').onclick = () => fRep(1); $('#f10').onclick = () => fRep(10); $('#f100').onclick = () => fRep(100);
const fPlayer = player($('#fPlay'), () => { if (fq.N >= 100000){ fPlayer.stop(); return; } fRep(Math.max(1, Math.floor(fq.N*.02))); });
$('#fReset').onclick = () => { fPlayer.stop(); fq.N = 0; fq.NA = 0; fq.pts = []; fq.last = NaN; fUpd(); };
fUpd();

/* =================================================================
   CHAPTER 3: CLT
   ================================================================= */
const XMIN = 85, XMAX = 215;
const clt = {n: 10, bins: [], bw: 2, cov: NaN, skA: NaN};
function cltCompute(){
  const n = clt.n, R = 20000, nb = (XMAX-XMIN)/clt.bw; const bins = new Array(nb).fill(0); let s1 = 0, s2 = 0, s3 = 0, cov = 0; const tc = n > 1 ? tinv(.975, n-1) : NaN; const ms = new Float64Array(R);
  for (let r = 0; r < R; r++){ let s = 0, ss = 0; for (let i = 0; i < n; i++){ const x = weight(); s += x; ss += x*x; } const m = s/n; ms[r] = m;
    if (n > 1){ const sd = Math.sqrt(Math.max(0, (ss - n*m*m)/(n-1))); if (Math.abs(m - MU) <= tc*sd/Math.sqrt(n)) cov++; }
    const b = Math.floor((m - XMIN)/clt.bw); if (b >= 0 && b < nb) bins[b]++; s1 += m; }
  const mean = s1/R; for (const m of ms){ const d = m - mean; s2 += d*d; s3 += d*d*d; } s2 /= R; s3 /= R;
  clt.bins = bins; clt.skA = s3/Math.pow(s2, 1.5); clt.cov = n > 1 ? cov/R : NaN; clt.R = R;
  $('#cltSkP').textContent = fmt(SHAPES[shape].skew, 2); $('#cltSkA').textContent = MINUS(fmt(clt.skA, 2)); $('#cltCov').textContent = n > 1 ? pct(clt.cov) : 'needs n ≥ 2';
  cltCanvas.redraw();
}
const cltCanvas = makeCanvas($('#clt'), w => w >= 640 ? 260 : 470, c => {
  const {ctx, w, h} = c; ctx.clearRect(0,0,w,h); const side = w >= 640;
  const panels = side ? [[12, w/2 - 12, 26, h - 38], [w/2 + 12, w - 12, 26, h - 38]] : [[12, w - 12, 26, h/2 - 34], [12, w - 12, h/2 + 26, h - 38]];
  // population
  { const [a, b, t, bt] = panels[0]; const sx = lin(XMIN, XMAX, a, b); let mx = 0; for (let x = XMIN; x <= XMAX; x += .5) mx = Math.max(mx, popPdf(x)); const sy = lin(0, mx*1.15, bt, t);
    curvePath(ctx, popPdf, XMIN, XMAX, sx, sy, 520); ctx.lineTo(sx(XMAX), sy(0)); ctx.lineTo(sx(XMIN), sy(0)); ctx.closePath(); ctx.fillStyle = rgba(C.orange, .3); ctx.fill();
    curvePath(ctx, popPdf, XMIN, XMAX, sx, sy, 520); ctx.strokeStyle = C['orange-ink']; ctx.lineWidth = 1.8; ctx.stroke();
    vline(ctx, sx(MU), t, bt, C.ink, [4,4]); txt(ctx, 'WEIGHTS OF SINGLE ORANGES', a, t - 10, {size: 10.5, color: C.ink, weight: 500});
    xAxis(ctx, sx, bt, XMIN, XMAX, b - a, null, 'grams'); }
  // averages
  { const [a, b, t, bt] = panels[1]; const sx = lin(XMIN, XMAX, a, b); const se = SIG/Math.sqrt(clt.n); const R = clt.R || 1;
    const dens = clt.bins.map(v => v/(R*clt.bw)); const mx = Math.max(npdf(0)/se, ...dens); const sy = lin(0, mx*1.1, bt, t);
    dens.forEach((d, i) => { if (!d) return; const xa = sx(XMIN + i*clt.bw), xb = sx(XMIN + (i+1)*clt.bw); ctx.fillStyle = rgba(C.bar, .75); ctx.fillRect(xa + .3, sy(d), Math.max(1, xb - xa - .6), bt - sy(d)); });
    curvePath(ctx, x => npdf((x - MU)/se)/se, XMIN, XMAX, sx, sy, 520); ctx.save(); ctx.setLineDash([5,4]); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore();
    vline(ctx, sx(MU), t, bt, C.ink, [4,4]); txt(ctx, `AVERAGES OF ${clt.n} ORANGE${clt.n > 1 ? 'S' : ''}`, a, t - 10, {size: 10.5, color: C.ink, weight: 500});
    txt(ctx, b - a > 400 ? 'dashed: normal curve the CLT predicts' : 'dashed: CLT normal', b, t + 2, {align:'right', size: 10, base:'top'});
    xAxis(ctx, sx, bt, XMIN, XMAX, b - a, null, 'grams'); }
});
bindRange('cltN', 'cltNo', v => { clt.n = v; cltCompute(); });
shapeListeners.push(cltCompute);
cltCompute();

/* =================================================================
   CHAPTER 4: MAIN SAMPLER
   ================================================================= */
const REAL = [118, 152, 131, 147, 139, 160, 124, 143, 155, 121];
const s4 = {n: 10, counts: new Array(XMAX-XMIN).fill(0), N: 0, sum: 0, sumsq: 0, cur: null, playing: false, speed: 2, raf: 0};
function commit4(m){ s4.N++; s4.sum += m; s4.sumsq += m*m; const i = Math.floor(m - XMIN); if (i >= 0 && i < s4.counts.length) s4.counts[i]++; }
function times4(){ if (reduceMotion) return {drop: 0, fall: 0}; const k = Math.pow(s4.speed, 1.45); return {drop: 1600/k, fall: 500/k}; }
function pick4(){ const ws = Array.from({length: s4.n}, () => weight()); const T = times4(); s4.cur = {ws, mean: meanOf(ws), t0: performance.now(), drop: T.drop, fall: T.fall, committed: false, real: false}; run4(); }
function run4(){ if (s4.raf) return; const step = () => { s4.raf = 0; const now = performance.now(); const c = s4.cur;
    if (s4.playing && (!c || c.committed)){ pick4(); return; }
    if (c && !c.committed && now >= c.t0 + c.drop + c.fall){ c.committed = true; if (!c.real) commit4(c.mean); upd4(); if (s4.playing){ pick4(); return; } }
    c4.redraw(); if (s4.playing || (c && !c.committed)) s4.raf = requestAnimationFrame(step); }; s4.raf = requestAnimationFrame(step); }
function upd4(){ $('#s4N').textContent = int(s4.N); const m = s4.sum/s4.N; $('#s4M').textContent = s4.N ? fmt(m, 2) + ' g' : '–';
  $('#s4S').textContent = s4.N > 1 ? fmt(Math.sqrt((s4.sumsq - s4.N*m*m)/(s4.N-1)), 2) + ' g' : '–'; $('#s4P').textContent = fmt(SIG/Math.sqrt(s4.n), 2) + ' g'; c4.redraw(); }
function reset4(){ s4.counts.fill(0); s4.N = 0; s4.sum = 0; s4.sumsq = 0; s4.cur = null; upd4(); }
const c4 = makeCanvas($('#c4'), w => w < 600 ? 440 : 490, c => {
  const {ctx, w, h} = c; ctx.clearRect(0,0,w,h); const x0 = 12, x1 = w - 12; const sx = lin(XMIN, XMAX, x0, x1);
  const r1t = 26, r1b = h*.27, r2t = h*.35, r2b = h*.5, r3t = h*.6, r3b = h - 36; const now = performance.now();
  // grid + mu
  niceTicks(XMIN, XMAX, Math.max(3, Math.floor(w/80))).forEach(t => vline(ctx, sx(t), r1t - 6, r3b, rgba(C.line, .55), [2,4], 1));
  vline(ctx, sx(MU), r1t - 6, r3b, C.ink, [5,4], 1.2); txt(ctx, 'μ', sx(MU) + 4, r1t + 4, {color: C.ink, size: 12, font: "'Source Serif 4',Georgia,serif"});
  // row 1 population
  let pmx = 0; for (let x = XMIN; x <= XMAX; x += .5) pmx = Math.max(pmx, popPdf(x)); const sy1 = lin(0, pmx*1.1, r1b, r1t);
  curvePath(ctx, popPdf, XMIN, XMAX, sx, sy1, 520); ctx.lineTo(sx(XMAX), r1b); ctx.lineTo(sx(XMIN), r1b); ctx.closePath(); ctx.fillStyle = rgba(C.orange, .22); ctx.fill();
  curvePath(ctx, popPdf, XMIN, XMAX, sx, sy1, 520); ctx.strokeStyle = C['orange-ink']; ctx.lineWidth = 1.6; ctx.stroke();
  txt(ctx, 'THE ORCHARD · weights of all oranges', x0, r1t - 12, {size: 10.5, color: C.ink, weight: 500});
  // row 2 current sample
  const cur = s4.cur; const nn = cur ? cur.ws.length : s4.n;
  txt(ctx, cur && cur.real ? 'OUR REAL SAMPLE · 10 oranges' : `THIS REPETITION · ${nn} oranges`, x0, r2t - 10, {size: 10.5, color: C.ink, weight: 500});
  ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(x0, r2b + .5); ctx.lineTo(x1, r2b + .5); ctx.stroke();
  if (cur){ const n = cur.ws.length; const r = clamp(7.5 - n*.05, 2.6, 7); const per = n ? cur.drop*.5/n : 0, trav = cur.drop*.5; const placed = [];
    cur.ws.forEach((wt, i) => { const X = sx(clamp(wt, XMIN, XMAX)); let lvl = 0; while (placed.some(p => p.l === lvl && Math.abs(p.x - X) < r*1.9)) lvl++; placed.push({x: X, l: lvl});
      const st = cur.t0 + i*per; if (now < st) return; const e = trav ? clamp((now - st)/trav, 0, 1) : 1; const q = e < 1 ? 1 - (1-e)**2 : 1;
      const yA = sy1(popPdf(wt)), yB = r2b - r - lvl*r*1.85; const y = yA + (yB - yA)*q; circle(ctx, X, y, r, C.orange, C['orange-ink'], 1); });
    if (now >= cur.t0 + cur.drop){ const X = sx(cur.mean); ctx.fillStyle = C.ink; ctx.fillRect(X - 1.5, r2t, 3, r2b - r2t);
      label(ctx, `ȳ = ${fmt(cur.mean, 1)} g`, X + 7, r2t + 6, {minX: x0, maxX: x1}); }
    if (!cur.committed && !cur.real && now >= cur.t0 + cur.drop){ const e = cur.fall ? clamp((now - cur.t0 - cur.drop)/cur.fall, 0, 1) : 1; const y = r2b + (r3b - 6 - r2b)*e*e;
      ctx.save(); ctx.translate(sx(cur.mean), y); ctx.rotate(Math.PI/4); ctx.fillStyle = C.ink; ctx.fillRect(-4, -4, 8, 8); ctx.restore(); }
  } else txt(ctx, 'Press "Pick once" to drop oranges out of the orchard.', (x0+x1)/2, (r2t + r2b)/2 + 4, {align:'center', size: 12});
  // row 3 histogram
  txt(ctx, `ALL AVERAGES SO FAR · ${int(s4.N)} repetitions`, x0, r3t - 12, {size: 10.5, color: C.ink, weight: 500});
  const se = SIG/Math.sqrt(s4.n); const dens = s4.counts.map(v => s4.N ? v/s4.N : 0); const mx = Math.max(npdf(0)/se, ...dens)*1.1; const sy3 = lin(0, mx, r3b, r3t);
  dens.forEach((d, i) => { if (!d) return; const xa = sx(XMIN + i), xb = sx(XMIN + i + 1); ctx.fillStyle = rgba(C.bar, .8); ctx.fillRect(xa + .25, sy3(d), Math.max(1, xb - xa - .5), r3b - sy3(d)); });
  curvePath(ctx, x => npdf((x - MU)/se)/se, XMIN, XMAX, sx, sy3, 520); ctx.save(); ctx.setLineDash([5,4]); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore();
  if (w >= 600) txt(ctx, `dashed: 𝒩(μ, σ²/${s4.n}) predicted by eq. (3)`, x1, r3t - 12, {align:'right', size: 10});
  else txt(ctx, `dashed: 𝒩(μ, σ²/${s4.n})`, x1, r3t + 2, {align:'right', size: 10, base:'top'});
  xAxis(ctx, sx, r3b, XMIN, XMAX, x1 - x0, null, 'weight of an orange (grams)');
});
bindRange('n4', 'n4o', v => { s4.n = v; reset4(); });
bindRange('sp4', 'sp4o', v => { s4.speed = v; });
$('#p4').onclick = () => { if (s4.cur && !s4.cur.committed && !s4.cur.real){ s4.cur.committed = true; commit4(s4.cur.mean); } pick4(); upd4(); };
$('#play4').onclick = e => { s4.playing = !s4.playing; e.target.textContent = s4.playing ? 'Pause' : 'Play'; e.target.setAttribute('aria-pressed', s4.playing); if (s4.playing && (!s4.cur || s4.cur.committed)) pick4(); else run4(); };
$('#k4').onclick = () => { let last = null; for (let i = 0; i < 1000; i++){ last = Array.from({length: s4.n}, () => weight()); commit4(meanOf(last)); } s4.cur = {ws: last, mean: meanOf(last), t0: -1e9, drop: 0, fall: 0, committed: true, real: false}; upd4(); };
$('#real4').onclick = () => { s4.cur = {ws: REAL.slice(), mean: 139, t0: performance.now(), drop: reduceMotion ? 0 : 1400, fall: 0, committed: false, real: true}; run4(); };
$('#r4').onclick = reset4;
shapeListeners.push(reset4);
// deviation table
(() => { const m = 139; const rows = REAL.map(y => [y, y - m, (y - m)**2]);
  $('#devTable').innerHTML = `<thead><tr><th>Orange <i>i</i></th>${rows.map((_, i) => `<th class="num">${i+1}</th>`).join('')}<th class="num">Sum</th></tr></thead><tbody>
  <tr><td><i>y<sub>i</sub></i> (g)</td>${rows.map(r => `<td class="num">${r[0]}</td>`).join('')}<td class="num">1390</td></tr>
  <tr><td><i>y<sub>i</sub></i> − <i>ȳ</i></td>${rows.map(r => `<td class="num">${MINUS(r[1])}</td>`).join('')}<td class="num">0</td></tr>
  <tr><td>(<i>y<sub>i</sub></i> − <i>ȳ</i>)²</td>${rows.map(r => `<td class="num">${r[2]}</td>`).join('')}<td class="num"><strong>2000</strong></td></tr></tbody>`; })();

// cutoff table
(() => { const ns = [3, 5, 10, 30, 100]; $('#cutTable').innerHTML = `<thead><tr><th>Oranges <i>n</i></th>${ns.map(n => `<th class="num">${n}</th>`).join('')}<th class="num">known σ</th></tr></thead>
  <tbody><tr><td><strong>95% cut-off</strong></td>${ns.map(n => `<td class="num">${fmt(tinv(.975, n-1), 3)}</td>`).join('')}<td class="num">1.960</td></tr></tbody>`; })();

/* =================================================================
   CHAPTER 6: TEST + POWER
   ================================================================= */
const s6 = {data: REAL.slice(), mu0: 150, alt: 'less', alpha: .05};
function stats(d){ const n = d.length, m = meanOf(d), s = sdOf(d), se = s/Math.sqrt(n); return {n, m, s, se, df: n - 1}; }
function pval(t, df, alt){ const F = tcdf(t, df); return alt === 'less' ? F : alt === 'greater' ? 1 - F : 2*Math.min(F, 1 - F); }
function crit(alpha, df, alt){ return alt === 'less' ? [tinv(alpha, df)] : alt === 'greater' ? [tinv(1 - alpha, df)] : [tinv(alpha/2, df), tinv(1 - alpha/2, df)]; }
const c6 = makeCanvas($('#c6'), w => w < 520 ? 260 : 290, c => {
  const {ctx, w, h} = c; ctx.clearRect(0,0,w,h); const S = stats(s6.data); const t = (S.m - s6.mu0)/S.se; const df = S.df;
  const R = Math.max(4.5, Math.min(12, Math.abs(t) + 1)); const x0 = 10, x1 = w - 10, top = 14, bot = h - 36; const sx = lin(-R, R, x0, x1); const sy = lin(0, .44, bot, top);
  const cr = crit(s6.alpha, df, s6.alt); ctx.fillStyle = rgba(C.miss, .1);
  if (s6.alt === 'less') ctx.fillRect(x0, top, sx(cr[0]) - x0, bot - top);
  else if (s6.alt === 'greater') ctx.fillRect(sx(cr[0]), top, x1 - sx(cr[0]), bot - top);
  else { ctx.fillRect(x0, top, sx(cr[0]) - x0, bot - top); ctx.fillRect(sx(cr[1]), top, x1 - sx(cr[1]), bot - top); }
  const f = x => tpdf(x, df);
  const shade = (a, b) => { if (b <= a) return; curvePath(ctx, f, a, b, sx, sy, 200); ctx.lineTo(sx(b), sy(0)); ctx.lineTo(sx(a), sy(0)); ctx.closePath(); ctx.fillStyle = rgba(C.cover, .85); ctx.fill(); };
  const tt = clamp(t, -R, R); if (s6.alt === 'less') shade(-R, tt); else if (s6.alt === 'greater') shade(tt, R); else { shade(-R, -Math.abs(tt)); shade(Math.abs(tt), R); }
  curvePath(ctx, npdf, -R, R, sx, sy); ctx.save(); ctx.setLineDash([5,4]); ctx.strokeStyle = C.muted; ctx.lineWidth = 1.3; ctx.stroke(); ctx.restore();
  curvePath(ctx, f, -R, R, sx, sy); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
  const rl = s6.alt === 'two' ? `rejection region |t| > ${fmt(cr[1],3)}` : `rejection region t ${s6.alt === 'less' ? '<' : '>'} ${MINUS(fmt(cr[0],3))}`;
  txt(ctx, `${rl}  (α = ${s6.alpha})`, s6.alt === 'greater' ? x1 - 4 : x0 + 4, top + 12, {color: C.miss, size: 10.5, align: s6.alt === 'greater' ? 'right' : 'left'});
  vline(ctx, sx(clamp(t, -R, R)), top + 24, bot, C.cover, null, 2);
  label(ctx, `observed t = ${MINUS(fmt(t,2))}, shaded area = p = ${fmt(pval(t, df, s6.alt), 3)}`, sx(t) + (t < 0 ? 8 : -8), top + 40, {align: t < 0 ? 'left' : 'right', minX: x0, maxX: x1, color: C.cover, size: 10.5});
  xAxis(ctx, sx, bot, -R, R, x1 - x0, null, 'test statistic t (distance of ȳ from μ₀, in standard errors)');
});
function upd6(){
  const S = stats(s6.data); const t = (S.m - s6.mu0)/S.se; const p = pval(t, S.df, s6.alt); const rej = p <= s6.alpha;
  const h1 = s6.alt === 'less' ? '<' : s6.alt === 'greater' ? '>' : '≠';
  const pdesc = s6.alt === 'less' ? `P(t<sub>${S.df}</sub> ≤ ${MINUS(fmt(t,2))})` : s6.alt === 'greater' ? `P(t<sub>${S.df}</sub> ≥ ${MINUS(fmt(t,2))})` : `P(|t<sub>${S.df}</sub>| ≥ ${fmt(Math.abs(t),2)})`;
  $('#steps6').innerHTML = `<ol style="margin:0;padding-left:1.2rem;display:grid;gap:.3rem">
    <li><strong>Hypotheses:</strong> H₀: μ = ${s6.mu0} g vs H₁: μ ${h1} ${s6.mu0} g.</li>
    <li><strong>Significance level</strong>, fixed in advance: α = ${s6.alpha}.</li>
    <li><strong>Test statistic:</strong> if H₀ is true, T follows a t<sub>${S.df}</sub> distribution.</li>
    <li><strong>Observed:</strong> ȳ = ${fmt(S.m,1)}, s = ${fmt(S.s,2)}, SÊ = ${fmt(S.se,3)}; t = (${fmt(S.m,1)} − ${s6.mu0})/${fmt(S.se,3)} = <span class="num">${MINUS(fmt(t,2))}</span>.</li>
    <li><strong>p-value:</strong> ${pdesc} = <span class="num">${fmt(p,4)}</span>.</li>
    <li><strong>Decision:</strong> ${rej ? `p ≤ α, so we <strong style="color:var(--miss)">reject H₀</strong>.` : `p > α, so we <strong>do not reject H₀</strong>. That is not proof that H₀ is true.`}</li></ol>
    <p style="margin-top:.6rem">In words: if the average really were ${s6.mu0} g, a result at least this extreme would occur in about <strong>${pct(p)}</strong> of repetitions.</p>`;
  c6.redraw(); updCI(); schedulePower();
}
$('#data6').addEventListener('input', e => { const v = e.target.value.split(/[\s,;]+/).filter(Boolean).map(Number);
  if (v.length < 2 || v.some(x => !Number.isFinite(x))){ $('#err6').textContent = 'Enter at least two numbers, for example: 118, 152, 131'; return; }
  if (sdOf(v) === 0){ $('#err6').textContent = 'All weights are equal, so the spread s is zero and t is undefined. Change at least one value.'; return; }
  $('#err6').textContent = ''; s6.data = v; upd6(); });
bindRange('mu0', 'mu0o', v => { s6.mu0 = v; upd6(); });
$('#alt6').onchange = e => { s6.alt = e.target.value; upd6(); };
$('#alpha6').onchange = e => { s6.alpha = +e.target.value; upd6(); };
// power
const sP = {muT: 145, n: 10, curve: [], here: NaN, timer: 0};
const PN = [2,3,4,5,6,8,10,12,15,20,25,30,40,50,60,80,100,125,150];
function rejRate(n, muT, reps){ const df = n - 1; const cr = crit(s6.alpha, df, s6.alt); let rej = 0;
  for (let r = 0; r < reps; r++){ let s = 0, ss = 0; for (let i = 0; i < n; i++){ const x = weight(muT, SIG); s += x; ss += x*x; } const m = s/n; const t = (m - s6.mu0)/Math.sqrt(Math.max(1e-12, (ss - n*m*m)/(n-1))/n);
    if (s6.alt === 'less' ? t <= cr[0] : s6.alt === 'greater' ? t >= cr[0] : (t <= cr[0] || t >= cr[1])) rej++; }
  return rej/reps; }
function computePower(){ sP.curve = PN.map(n => [n, rejRate(n, sP.muT, 1500)]); sP.here = rejRate(sP.n, sP.muT, 4000); updPower(); }
function schedulePower(){ clearTimeout(sP.timer); sP.timer = setTimeout(computePower, 120); }
function updPower(){ const d = sP.muT - s6.mu0; const same = Math.abs(d) < 1e-9;
  const onH1 = s6.alt === 'two' ? !same : s6.alt === 'less' ? d < 0 : d > 0;
  let msg;
  if (same) msg = `Here H₀ is actually true, so every rejection is a <strong>Type I error</strong>. ${shape === 'normal' ? 'For a normal orchard the rate stays near α whatever n is.' : 'With a non-normal orchard and small n it can drift away from α (A3 again); for a normal orchard it stays at α.'}`;
  else if (onH1) msg = `Here H₀ is false. Each time the test fails to reject is a <strong>Type II error</strong>, which happens in about ${pct(1 - sP.here, 0)} of experiments.`;
  else msg = `Here the true average lies on the opposite side of μ₀ from what H₁ looks for, so the one-sided test is not built to detect it. Rejections are rare, and neither H₀ (μ = μ₀) nor H₁ describes the truth.`;
  $('#powTxt').innerHTML = `<p>True average <strong>${sP.muT} g</strong>, claim μ₀ = ${s6.mu0} g, <strong>${sP.n} oranges</strong>: the test rejects H₀ in <strong class="num">${pct(sP.here)}</strong> of 4,000 imagined experiments.</p><p>${msg}</p>`;
  cP.redraw(); }
const cP = makeCanvas($('#cP'), w => 230, c => {
  const {ctx, w, h} = c; ctx.clearRect(0,0,w,h); const x0 = 44, x1 = w - 14, top = 12, bot = h - 38; const sx = lin(2, 150, x0, x1); const sy = lin(0, 1, bot, top);
  [0, .25, .5, .75, 1].forEach(v => { ctx.strokeStyle = rgba(C.line, .7); ctx.beginPath(); ctx.moveTo(x0, Math.round(sy(v)) + .5); ctx.lineTo(x1, Math.round(sy(v)) + .5); ctx.stroke(); txt(ctx, (v*100) + '%', x0 - 6, sy(v) + 4, {align:'right'}); });
  ctx.save(); ctx.setLineDash([4,4]); ctx.strokeStyle = C.miss; ctx.beginPath(); ctx.moveTo(x0, sy(s6.alpha)); ctx.lineTo(x1, sy(s6.alpha)); ctx.stroke(); ctx.restore(); txt(ctx, `α = ${s6.alpha}`, x1, sy(s6.alpha) - 5, {align:'right', color: C.miss, size: 10});
  if (sP.curve.length){ ctx.beginPath(); sP.curve.forEach(([n, r], i) => i ? ctx.lineTo(sx(n), sy(r)) : ctx.moveTo(sx(n), sy(r))); ctx.strokeStyle = C.bar; ctx.lineWidth = 2; ctx.stroke(); sP.curve.forEach(([n, r]) => circle(ctx, sx(n), sy(r), 2.5, C.bar)); }
  if (Number.isFinite(sP.here)){ const X = sx(sP.n), Y = sy(sP.here); vline(ctx, X, top, bot, C.orange, [3,3]); circle(ctx, X, Y, 5.5, C.orange, C.surface, 2); label(ctx, `n = ${sP.n}: ${pct(sP.here, 0)}`, X + 9, Y - 12, {minX: x0, maxX: x1, size: 10.5}); }
  xAxis(ctx, sx, bot, 2, 150, x1 - x0, null, 'number of oranges n'); txt(ctx, 'rejection rate', x0 + 4, top + 10, {color: C.bar, weight: 500});
});
bindRange('muT', 'muTo', v => { sP.muT = v; schedulePower(); });
bindRange('nP', 'nPo', v => { sP.n = v; sP.here = rejRate(v, sP.muT, 4000); updPower(); });
shapeListeners.push(schedulePower);

/* =================================================================
   CHAPTER 7: OUR CONFIDENCE INTERVAL
   ================================================================= */
function updCI(){ const S = stats(s6.data); const tc = tinv(.975, S.df); const lo = S.m - tc*S.se, hi = S.m + tc*S.se; const out = s6.mu0 < lo || s6.mu0 > hi;
  const p2 = pval((S.m - s6.mu0)/S.se, S.df, 'two');
  $('#ourCI').innerHTML = `For our oranges: ${fmt(S.m,1)} ± ${fmt(tc,3)} · ${fmt(S.se,3)} = ${fmt(S.m,1)} ± ${fmt(tc*S.se,1)}, i.e. <strong class="num">[${fmt(lo,1)} g, ${fmt(hi,1)} g]</strong>. The claimed ${s6.mu0} g lies ${out ? 'outside' : 'inside'} it. Tests and intervals are two views of the same calculation: a value lies outside the 95% interval exactly when a <em>two-sided</em> test at α = 0.05 rejects it (here the two-sided p = ${fmt(p2,3)}). Chapter 6's one-sided test matches a one-sided 95% upper bound instead: ȳ + ${fmt(tinv(.95, S.df),3)} · ${fmt(S.se,3)} = ${fmt(S.m + tinv(.95, S.df)*S.se,1)} g.`; }

/* =================================================================
   CHAPTER 8: OPTIONAL STOPPING
   ================================================================= */
const s8 = {maxN: 100, runs: [], N: 0, peek: 0, fixed: 0};
function run8(times){ const maxN = s8.maxN; const crs = []; for (let n = 2; n <= maxN; n++) crs[n] = tinv(.05, n - 1);
  for (let k = 0; k < times; k++){ let mean = 0, M2 = 0, stop = 0; const ps = [];
    for (let i = 1; i <= maxN; i++){ const x = 150 + 15*randn(); const d = x - mean; mean += d/i; M2 += d*(x - mean);
      if (i >= 2){ const t = (mean - 150)/Math.sqrt(M2/(i-1)/i); if (k >= times - 30) ps.push([i, t]); if (!stop && t <= crs[i]) stop = i; if (i === maxN && t <= crs[i]) s8.fixed++; } }
    s8.N++; if (stop) s8.peek++;
    if (k >= times - 30) s8.runs.push({ps: ps.length ? ps : null, stop}); }
  if (s8.runs.length > 30) s8.runs = s8.runs.slice(-30); upd8(); }
function upd8(){ $('#g8N').textContent = int(s8.N); $('#g8P').textContent = s8.N ? pct(s8.peek/s8.N) : '–'; $('#g8F').textContent = s8.N ? pct(s8.fixed/s8.N) : '–'; c8.redraw(); }
function reset8(){ s8.runs = []; s8.N = 0; s8.peek = 0; s8.fixed = 0; upd8(); }
const c8 = makeCanvas($('#c8'), w => w < 560 ? 260 : 290, c => {
  const {ctx, w, h} = c; ctx.clearRect(0,0,w,h); const x0 = 50, x1 = w - 12, top = 12, bot = h - 38; const sx = lin(2, s8.maxN, x0, x1); const sy = lin(0, -3, top, bot);
  [[1,'1'],[.1,'0.1'],[.01,'0.01'],[.001,'0.001']].forEach(([v, s]) => { const y = Math.round(sy(Math.log10(v))) + .5; ctx.strokeStyle = rgba(C.line, .7); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); txt(ctx, s, x0 - 6, y + 4, {align:'right'}); });
  txt(ctx, 'p-value (log scale)', x0 + 4, top + 12, {weight: 500, color: C.ink});
  const ya = sy(Math.log10(.05)); ctx.save(); ctx.setLineDash([5,4]); ctx.strokeStyle = C.miss; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x0, ya); ctx.lineTo(x1, ya); ctx.stroke(); ctx.restore();
  txt(ctx, 'p = 0.05: stop and accuse', x1, ya - 5, {align:'right', color: C.miss, size: 10});
  s8.runs.forEach((r, ri) => { if (!r.ps) return; const fresh = ri === s8.runs.length - 1; ctx.beginPath(); let started = false;
    for (const [i, t] of r.ps){ if (r.stop && i > r.stop) break; const p = Math.max(1e-3, tcdf(t, i - 1)); const X = sx(i), Y = sy(Math.log10(p)); started ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); started = true; }
    ctx.strokeStyle = r.stop ? rgba(C.miss, fresh ? 1 : .55) : rgba(C.muted, fresh ? .9 : .35); ctx.lineWidth = fresh ? 2 : 1.1; ctx.stroke();
    if (r.stop){ const last = r.ps.find(q => q[0] === r.stop); if (last) circle(ctx, sx(r.stop), sy(Math.log10(Math.max(1e-3, tcdf(last[1], r.stop - 1)))), fresh ? 5 : 3, C.miss); } });
  if (!s8.runs.length) txt(ctx, 'Each line will be one inspector weighing oranges one by one.', (x0+x1)/2, (top+bot)/2 + 20, {align:'center', size: 12});
  xAxis(ctx, sx, bot, 2, s8.maxN, x1 - x0, null, 'oranges weighed so far');
});
bindRange('max8', 'max8o', v => { s8.maxN = v; reset8(); });
$('#s8one').onclick = () => run8(1); $('#s8k').onclick = () => run8(500);
let f8 = 0; player($('#play8'), () => { f8++; if (f8 % 8 === 0) run8(1); });
$('#r8').onclick = reset8;
upd8();

/* ---------------- chapter rail highlight ---------------- */
const links = $$('#rail a'); const io = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting){ links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); const on = links.find(a => a.classList.contains('on')); if (on) on.scrollIntoView({block:'nearest', inline:'nearest'}); } }); }, {rootMargin: '-45% 0px -50% 0px'});
$$('section.ch').forEach(s => io.observe(s));

upd6();
})();
