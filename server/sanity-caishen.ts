import os from 'os';
import path from 'path';
import { UserManager } from './src/auth/UserManager';
import { CaishenWinsEngine } from './src/engines/slots/CaishenWinsEngine';

const tmp = path.join(os.tmpdir(), 'caishen-sanity-users.json');
const um = new UserManager(tmp);
const reg = um.register('sanity_' + Date.now(), 'password123', 'Sanity');
if (!reg.success || !reg.user) throw new Error('register failed');
const uid = reg.user.id;
um.addBalance(uid, 50_000_000, 'sanity fund');

const engine = new CaishenWinsEngine(um);
const BET = 100;
const N = 3000;
let wagered = 0;
let won = 0;
let offers = 0;
let accepts = 0;
let gambles = 0;
let gambleWins = 0;
let busts = 0;
let godSteps = 0;
let totalSteps = 0;
let stackedHeads = 0;
let totalHeads = 0;
let waysSum = 0;
let waysMin = Infinity;
let waysMax = 0;
let freeSpinsPlayed = 0;

for (let i = 0; i < N; i++) {
  const res = engine.spin(uid, BET);
  if (!res.success || !res.result) throw new Error('spin failed: ' + res.message);
  const r = res.result;
  if (!r.isFreeSpin) wagered += BET;
  else freeSpinsPlayed++;
  won += r.totalWin;
  for (const step of r.cascades) {
    totalSteps++;
    let heads = 0;
    let stacked = 0;
    for (const col of step.grid) {
      for (const t of col) {
        if (t.spanCont) continue;
        heads++;
        if ((t.span ?? 1) > 1) stacked++;
        if (t.symbol === 'caishen_god') godSteps++;
      }
    }
    totalHeads += heads;
    stackedHeads += stacked;
    const ways = step.grid.reduce((acc, col) => acc * Math.max(1, col.filter(t => !t.spanCont).length), 1);
    waysSum += ways;
    if (ways < waysMin) waysMin = ways;
    if (ways > waysMax) waysMax = ways;
  }
  if (r.freeSpinsOffer && !r.isFreeSpin) {
    offers++;
    // Luôn accept ngay để đo luôn giá trị free spins.
    const acc = engine.resolveOffer(uid, 'accept');
    if (!acc.success) throw new Error('accept failed');
    accepts++;
  }
}

// Test gamble flow riêng.
const g1 = engine.spin(uid, BET);
let gambleOffer = g1.result?.freeSpinsOffer ?? engine.getOffer(uid);
if (!gambleOffer) {
  // Force bằng buy cho chắc có offer.
  const buy = engine.spin(uid, BET, { buyFeature: true });
  gambleOffer = buy.result?.freeSpinsOffer ?? engine.getOffer(uid);
}
console.log('offer for gamble test:', gambleOffer ? 'OK' : 'NONE (hên xui)');
if (gambleOffer) {
  for (let k = 0; k < 6; k++) {
    const cur = engine.getOffer(uid);
    if (!cur) break;
    const action = cur.spins < 20 && (k % 2 === 0 || cur.mult >= 20) ? 'gamble-spins' : 'gamble-mult';
    const rr = engine.resolveOffer(uid, action as any);
    gambles++;
    if (rr.bust) { busts++; break; }
    if (rr.offer) gambleWins++;
    if (!rr.offer) break;
  }
  const leftover = engine.getOffer(uid);
  if (leftover) engine.resolveOffer(uid, 'accept');
}

console.log('=== CAISHEN SANITY ===');
console.log('spins:', N, 'wagered:', wagered, 'won:', won, 'RTP:', (won / Math.max(1, wagered)).toFixed(3));
console.log('offers:', offers, 'accepts:', accepts, 'freeSpinsPlayed:', freeSpinsPlayed);
console.log('godSteps:', godSteps, 'stackedHeads/totalHeads:', stackedHeads + '/' + totalHeads);
console.log('ways avg:', Math.round(waysSum / Math.max(1, totalSteps)), 'min:', waysMin, 'max:', waysMax);
console.log('gamble tries:', gambles, 'wins:', gambleWins, 'busts:', busts);
console.log('balance:', um.getBalance(uid));
