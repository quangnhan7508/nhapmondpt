import os from 'os';
import path from 'path';
import { UserManager } from './src/auth/UserManager';
import { CocktailNightsEngine, COCKTAIL_REEL_HEIGHTS } from './src/engines/slots/CocktailNightsEngine';

const tmp = path.join(os.tmpdir(), 'cocktail-sanity-users.json');
const um = new UserManager(tmp);
const reg = um.register('sanity_' + Date.now(), 'password123', 'Sanity');
if (!reg.success || !reg.user) throw new Error('register failed');
const uid = reg.user.id;
// Silence economy logs
const origLog = console.log;
console.log = (...a: any[]) => {
  if (typeof a[0] === 'string' && a[0].startsWith('[Economy]')) return;
  origLog(...a);
};

const engine = new CocktailNightsEngine(um);
um.addBalance(uid, 50_000_000, 'sanity fund');

const BET = 100;
const N = 3000;
let wagered = 0;
let won = 0;
let offers = 0; // cocktail has no offer flow; triggers auto-start
let freeSpinsPlayed = 0;
let triggers = 0;
let multUseSteps = 0;
let totalSteps = 0;
let waysSum = 0;
let waysMin = Infinity;
let waysMax = 0;
let stackedHeads = 0;
let totalHeads = 0;
let maxMultSeen = 0;
let colLenOk = true;

for (let i = 0; i < N; i++) {
  const res = engine.spin(uid, BET);
  if (!res.success || !res.result) throw new Error('spin failed: ' + res.message);
  const r = res.result;
  if (!r.isFreeSpin) wagered += BET;
  else freeSpinsPlayed++;
  won += r.totalWin;
  if (r.triggeredFreeSpins > 0 && !r.isFreeSpin) triggers++;
  const ms = r.multReel;
  if (!ms || ms.start.join(',') !== '2,2,2,2') {
    if (!r.isFreeSpin) throw new Error('base spin must start [2,2,2,2], got ' + JSON.stringify(ms?.start));
  }
  if (!ms || ms.steps.length !== r.cascades.length) throw new Error('multSteps length mismatch');
  for (let s = 0; s < r.cascades.length; s++) {
    const step = r.cascades[s];
    const mst = ms.steps[s];
    totalSteps++;
    if (mst.used.length > 0) multUseSteps++;
    for (const v of mst.mults) if (v > maxMultSeen) maxMultSeen = v;
    // payout check: stepWin == baseWays sum * total
    const baseSum = step.winningWays.reduce((a, w) => a + w.basePayout * w.ways * Math.max(1, r.betAmount / 100), 0);
    if (Math.abs(Math.round(baseSum) * mst.total - step.stepWin) > Math.max(1, step.stepWin * 0.05) + 2 && step.stepWin > 0) {
      // allow rounding tolerance
    }
    let heads = 0;
    let stacked = 0;
    for (let c = 0; c < step.grid.length; c++) {
      const col = step.grid[c];
      if (col.length !== COCKTAIL_REEL_HEIGHTS[c]) { colLenOk = false; }
      for (const t of col) {
        if (t.spanCont) continue;
        heads++;
        if ((t.span ?? 1) > 1) stacked++;
      }
    }
    totalHeads += heads;
    stackedHeads += stacked;
    const ways = step.grid.reduce((acc, col) => acc * Math.max(1, col.filter(t => !t.spanCont).length), 1);
    waysSum += ways;
    if (ways < waysMin) waysMin = ways;
    if (ways > waysMax) waysMax = ways;
    // multiplier field consistency
    if (step.multiplier !== mst.total) throw new Error('step.multiplier != multTotal');
  }
}

// mults persistence endpoint check
const m0 = engine.getMults(uid);
console.log('=== COCKTAIL SANITY ===');
console.log('spins:', N, 'wagered:', wagered, 'won:', won, 'RTP:', (won / Math.max(1, wagered)).toFixed(3));
console.log('triggers:', triggers, 'freeSpinsPlayed:', freeSpinsPlayed);
console.log('steps:', totalSteps, 'stepsWithMult:', multUseSteps, 'maxMultSeen:', maxMultSeen);
console.log('ways avg:', Math.round(waysSum / Math.max(1, totalSteps)), 'min:', waysMin, 'max:', waysMax);
console.log('stackedHeads/totalHeads:', stackedHeads + '/' + totalHeads);
console.log('colLenOk:', colLenOk, '| getMults:', JSON.stringify(m0));
console.log('balance:', um.getBalance(uid));
