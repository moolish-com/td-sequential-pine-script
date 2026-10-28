// Proves the Pine logic without TradingView: the state machine below is a line-by-line
// port of td_sequential.pine (same variable names, same statement order, same
// na-comparison behaviour: NaN <= x is false, like na in Pine). It is run over every
// fixture and compared bar by bar with the reference counter in ./td-sequential.js.
//
// Not covered: label drawing, colours and plots, which only TradingView can render.
// Label *selection* (showNum) is ported and checked against the counts below.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeTdSequential } from './td-sequential.js';

const here = dirname(fileURLToPath(import.meta.url));
const na = NaN;
const isNa = Number.isNaN;

// ---- helpers (port of the Pine helpers) -------------------------------------
function showNum(mode, n, full) {
  return mode === 'Eco (1/6/8/9/13)'
    ? n === 1 || n === 6 || n === 8 || n === 9 || n === 13
    : mode === '9 only' || mode === '13 only' ? n === full : true;
}

function addLevel(prices, actives, price) {
  let dup = false;
  const n = prices.length;
  if (n > 0) for (let k = 0; k < n; k++) if (actives[k] && prices[k] === price) dup = true;
  if (price > 0 && !dup) {
    prices.push(price);
    actives.push(true);
    if (prices.length > 20) { prices.shift(); actives.shift(); }
  }
}

function breakLevels(prices, actives, isResistance, bar) {
  let latestBroken = false;
  const n = prices.length;
  if (n > 0) {
    for (let k = 0; k < n; k++) {
      if (actives[k]) {
        const p = prices[k];
        const broken = isResistance ? (bar.close > p || bar.low > p) : (bar.close < p || bar.high < p);
        if (broken) {
          actives[k] = false;
          if (k === n - 1) latestBroken = true;
        }
      }
    }
  }
  return latestBroken;
}

function latestActive(prices, actives) {
  const n = prices.length;
  return n > 0 && actives[n - 1] ? prices[n - 1] : na;
}

// ---- the indicator, run bar by bar -------------------------------------------
function runPine(bars) {
  // var state
  let buySetup = 0, sellSetup = 0, buyCd = 0, sellCd = 0;
  let buyEightClose = na, sellEightClose = na;
  const resPrices = [], resActive = [], supPrices = [], supActive = [];
  const out = [];

  for (let bar_index = 0; bar_index < bars.length; bar_index++) {
    // series access, Pine style: close[n] is na before the first bar
    const at = (key, n) => (bar_index - n >= 0 ? bars[bar_index - n][key] : na);
    const close = at('c', 0), high = at('h', 0), low = at('l', 0);
    const closeAgo = (n) => at('c', n), lowAgo = (n) => at('l', n), highAgo = (n) => at('h', n);
    const bar = { close, high, low };

    // 1. setup
    buySetup = bar_index >= 4 && close < closeAgo(4) ? buySetup + 1 : 0;
    sellSetup = bar_index >= 4 && close > closeAgo(4) ? sellSetup + 1 : 0;
    const buy9 = buySetup === 9;
    const sell9 = sellSetup === 9;

    // 2. TDST levels (ta.highest / ta.lowest over 9 bars, na until 9 bars exist)
    let hi9 = na, lo9 = na;
    if (bar_index >= 8) {
      hi9 = -Infinity; lo9 = Infinity;
      for (let k = 0; k < 9; k++) { hi9 = Math.max(hi9, highAgo(k)); lo9 = Math.min(lo9, lowAgo(k)); }
    }
    if (buy9) addLevel(resPrices, resActive, hi9);
    if (sell9) addLevel(supPrices, supActive, lo9);
    const resBroken = breakLevels(resPrices, resActive, true, bar);
    const supBroken = breakLevels(supPrices, supActive, false, bar);
    const resistance = latestActive(resPrices, resActive);
    const support = latestActive(supPrices, supActive);

    // 3. countdown
    const buyQual = bar_index >= 2 && close <= lowAgo(2);
    const sellQual = bar_index >= 2 && close >= highAgo(2);
    const buyTest = low <= buyEightClose;
    const sellTest = high >= sellEightClose;
    let buyDeferred = false, sellDeferred = false;
    const prevBuyCd = buyCd, prevSellCd = sellCd;

    if (buy9) buyCd = buyQual ? 1 : 0;
    else if (sell9 || isNa(resistance)) buyCd = 14;
    else if (Math.abs(prevBuyCd) === 12 && buyQual && !buyTest) { buyCd = -12; buyDeferred = true; }
    else if (buyQual) buyCd = Math.abs(prevBuyCd) + 1;
    else buyCd = prevBuyCd === 0 ? 0 : -Math.abs(prevBuyCd);
    if (buyCd === 8) buyEightClose = close;

    if (sell9) sellCd = sellQual ? 1 : 0;
    else if (buy9 || isNa(support)) sellCd = 14;
    else if (Math.abs(prevSellCd) === 12 && sellQual && !sellTest) { sellCd = -12; sellDeferred = true; }
    else if (sellQual) sellCd = Math.abs(prevSellCd) + 1;
    else sellCd = prevSellCd === 0 ? 0 : -Math.abs(prevSellCd);
    if (sellCd === 8) sellEightClose = close;

    // 4. information only
    const buyPerfected = buy9 && Math.min(lowAgo(1), low) < Math.min(lowAgo(3), lowAgo(2));
    const sellPerfected = sell9 && Math.max(highAgo(1), high) > Math.max(highAgo(3), highAgo(2));
    const bullishFlip = bar_index >= 5 && closeAgo(1) < closeAgo(5) && close > closeAgo(4);
    const bearishFlip = bar_index >= 5 && closeAgo(1) > closeAgo(5) && close < closeAgo(4);

    out.push({
      t: bars[bar_index].t, buySetup, sellSetup, buyCd, sellCd, resistance, support,
      buyDeferred, sellDeferred, buyPerfected, sellPerfected, bullishFlip, bearishFlip,
      resBroken, supBroken,
    });
  }
  return out;
}

// ---- comparison --------------------------------------------------------------
const orNull = (x) => (isNa(x) ? null : x);
let failures = 0;
const fail = (msg) => { failures++; if (failures <= 20) console.error('FAIL', msg); };
const totals = { bars: 0, buy9: 0, sell9: 0, buy13: 0, sell13: 0, deferred: 0, perfected: 0, breaks: 0 };

const files = readdirSync(join(here, 'fixtures')).filter((f) => f.endsWith('.json')).sort();
if (files.length === 0) { console.error('no fixtures found'); process.exit(1); }

for (const file of files) {
  const { bars } = JSON.parse(readFileSync(join(here, 'fixtures', file), 'utf8'));
  const ref = computeTdSequential(bars);
  const pine = runPine(bars);
  if (ref.length !== pine.length) { fail(`${file}: length ${ref.length} vs ${pine.length}`); continue; }

  const pairs = [
    ['buySetup', 'buySetup'], ['sellSetup', 'sellSetup'], ['buyCountdown', 'buyCd'], ['sellCountdown', 'sellCd'],
    ['resistance', 'resistance'], ['support', 'support'], ['buyDeferred', 'buyDeferred'], ['sellDeferred', 'sellDeferred'],
    ['buyPerfected', 'buyPerfected'], ['sellPerfected', 'sellPerfected'], ['bullishFlip', 'bullishFlip'], ['bearishFlip', 'bearishFlip'],
  ];
  let prevRes = null, prevSup = null;
  for (let i = 0; i < ref.length; i++) {
    const r = ref[i], p = pine[i];
    for (const [rk, pk] of pairs) {
      const pv = rk === 'resistance' || rk === 'support' ? orNull(p[pk]) : p[pk];
      if (r[rk] !== pv) fail(`${file} bar ${i} ${rk}: reference ${r[rk]} vs pine ${pv}`);
    }
    // TDST break alert: latest level broken <=> reported level went from active to null
    if (p.resBroken !== (prevRes !== null && r.resistance === null)) fail(`${file} bar ${i} resBroken ${p.resBroken}`);
    if (p.supBroken !== (prevSup !== null && r.support === null)) fail(`${file} bar ${i} supBroken ${p.supBroken}`);
    prevRes = r.resistance; prevSup = r.support;

    // label selection: "1-9" / "1-13" show every count, "9 only" / "13 only" exactly the completion, eco a subset
    for (const n of [r.buySetup, r.sellSetup]) {
      if (n >= 1 && n <= 9) {
        if (!showNum('1-9', n, 9)) fail(`${file} bar ${i} showNum all ${n}`);
        if (showNum('9 only', n, 9) !== (n === 9)) fail(`${file} bar ${i} showNum 9-only ${n}`);
        if (showNum('Eco (1/6/8/9/13)', n, 9) !== [1, 6, 8, 9].includes(n)) fail(`${file} bar ${i} showNum eco ${n}`);
      }
    }
    totals.bars++;
    if (r.buySetup === 9) totals.buy9++;
    if (r.sellSetup === 9) totals.sell9++;
    if (r.buyCountdown === 13) totals.buy13++;
    if (r.sellCountdown === 13) totals.sell13++;
    if (r.buyDeferred || r.sellDeferred) totals.deferred++;
    if (r.buyPerfected || r.sellPerfected) totals.perfected++;
    if (p.resBroken || p.supBroken) totals.breaks++;
  }
  console.log(`ok  ${file}: ${ref.length} bars`);
}

console.log('coverage', JSON.stringify(totals));
if (totals.buy9 + totals.sell9 === 0 || totals.buy13 + totals.sell13 === 0) {
  console.error('fixtures never exercise a setup 9 and a countdown 13; the check proves too little');
  process.exit(1);
}
if (failures > 0) { console.error(`${failures} mismatches`); process.exit(1); }
console.log('Pine port matches the reference on every bar of every fixture.');
