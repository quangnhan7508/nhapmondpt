"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CasinoEngine = exports.CASINO_PAYOUT = exports.CASINO_MAX_BET = exports.CASINO_MIN_BET = void 0;
const events_1 = require("events");
const fair_1 = require("./fair");
exports.CASINO_MIN_BET = 10;
exports.CASINO_MAX_BET = 5000;
exports.CASINO_PAYOUT = 1.95;
const ROULETTE_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const ROULETTE_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const CHICKEN_CONFIG = {
    easy: { bust: 0.12, mults: [1.15, 1.35, 1.6, 1.9, 2.25, 2.7, 3.3, 4.1, 5.2, 6.8] },
    medium: { bust: 0.2, mults: [1.25, 1.6, 2.1, 2.8, 3.8, 5.2, 7.3, 10.5, 15.5, 24] },
    hard: { bust: 0.3, mults: [1.4, 2.0, 3.0, 4.6, 7.2, 11.5, 19, 32, 55, 100] },
};
class CasinoEngine extends events_1.EventEmitter {
    userManager;
    nonce = 0;
    chickens = new Map();
    hilos = new Map();
    // ===== Aviator (vòng chung, live) =====
    avPhase = 'waiting';
    avRoundId = '';
    avCrashPoint = 2;
    avMult = 1;
    avStartedAt = 0;
    avEndsAt = 0;
    avBets = [];
    avHistory = [];
    avSeeds = (0, fair_1.newSeeds)();
    avTimer = null;
    constructor(userManager) {
        super();
        this.userManager = userManager;
    }
    // ---------- helpers ----------
    checkBet(amount) {
        if (!Number.isFinite(amount) || amount < exports.CASINO_MIN_BET)
            return `Cược tối thiểu ${exports.CASINO_MIN_BET} 🪙`;
        if (amount > exports.CASINO_MAX_BET)
            return `Cược tối đa ${exports.CASINO_MAX_BET} 🪙`;
        return null;
    }
    deduct(userId, amount, reason) {
        return this.userManager.deductBalance(userId, amount, reason);
    }
    credit(userId, amount, reason) {
        return this.userManager.addBalance(userId, amount, reason);
    }
    // ---------- Roulette (European 0-36) ----------
    rouletteBet(userId, betType, num, amount) {
        const err = this.checkBet(amount);
        if (err)
            return { success: false, message: err };
        if (betType === 'number' && (num === undefined || num < 0 || num > 36)) {
            return { success: false, message: 'Số cược phải từ 0 đến 36.' };
        }
        const d = this.deduct(userId, amount, `Roulette ${betType}${betType === 'number' ? ' ' + num : ''}`);
        if (!d.success)
            return { success: false, message: d.message || 'Không đủ số dư.' };
        const seeds = (0, fair_1.newSeeds)(undefined, ++this.nonce);
        const winning = Math.floor((0, fair_1.drawFloat)(seeds.serverSeed, seeds.clientSeed, seeds.nonce, 0) * 37);
        const color = winning === 0 ? 'green' : ROULETTE_RED.has(winning) ? 'red' : 'black';
        const isOdd = winning !== 0 && winning % 2 === 1;
        let win = false;
        let payout = 0;
        if (betType === 'number' && winning === num) {
            win = true;
            payout = amount * 35 + amount; // ăn 35 + hoàn gốc
        }
        else if (betType === 'red' && color === 'red')
            win = true;
        else if (betType === 'black' && color === 'black')
            win = true;
        else if (betType === 'odd' && isOdd)
            win = true;
        else if (betType === 'even' && winning !== 0 && !isOdd)
            win = true;
        else if (betType === 'high' && winning >= 19)
            win = true;
        else if (betType === 'low' && winning >= 1 && winning <= 18)
            win = true;
        if (win && betType !== 'number')
            payout = Math.floor(amount * exports.CASINO_PAYOUT);
        let newBalance = d.newBalance;
        if (win)
            newBalance = this.credit(userId, payout, `Roulette thắng số ${winning}`).newBalance;
        return {
            success: true, win, payout: win ? payout : 0, newBalance,
            winningNumber: winning, color,
            wheelIndex: ROULETTE_ORDER.indexOf(winning),
            ...seeds,
        };
    }
    // ---------- Coinflip ----------
    coinflipBet(userId, choice, amount) {
        const err = this.checkBet(amount);
        if (err)
            return { success: false, message: err };
        if (choice !== 'heads' && choice !== 'tails')
            return { success: false, message: 'Chọn sấp hoặc ngửa.' };
        const d = this.deduct(userId, amount, `Coinflip ${choice}`);
        if (!d.success)
            return { success: false, message: d.message || 'Không đủ số dư.' };
        const seeds = (0, fair_1.newSeeds)(undefined, ++this.nonce);
        const result = (0, fair_1.drawFloat)(seeds.serverSeed, seeds.clientSeed, seeds.nonce, 0) < 0.5 ? 'heads' : 'tails';
        const win = result === choice;
        const payout = win ? Math.floor(amount * exports.CASINO_PAYOUT) : 0;
        const newBalance = win ? this.credit(userId, payout, 'Coinflip thắng').newBalance : d.newBalance;
        return { success: true, win, result, payout, newBalance, ...seeds };
    }
    // ---------- Rock Paper Scissors (vs nhà cái, hòa hoàn tiền) ----------
    rpsBet(userId, choice, amount) {
        const err = this.checkBet(amount);
        if (err)
            return { success: false, message: err };
        if (!['rock', 'paper', 'scissors'].includes(choice))
            return { success: false, message: 'Chọn kéo, búa hoặc bao.' };
        const d = this.deduct(userId, amount, `RPS ${choice}`);
        if (!d.success)
            return { success: false, message: d.message || 'Không đủ số dư.' };
        const seeds = (0, fair_1.newSeeds)(undefined, ++this.nonce);
        const house = ['rock', 'paper', 'scissors'][Math.floor((0, fair_1.drawFloat)(seeds.serverSeed, seeds.clientSeed, seeds.nonce, 0) * 3)];
        const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
        let outcome;
        let payout = 0;
        let newBalance = d.newBalance;
        if (house === choice) {
            outcome = 'tie';
            payout = amount;
            newBalance = this.credit(userId, amount, 'RPS hòa hoàn tiền').newBalance;
        }
        else if (beats[choice] === house) {
            outcome = 'win';
            payout = Math.floor(amount * exports.CASINO_PAYOUT);
            newBalance = this.credit(userId, payout, 'RPS thắng').newBalance;
        }
        else {
            outcome = 'lose';
        }
        return { success: true, outcome, houseChoice: house, payout, newBalance, ...seeds };
    }
    // ---------- Chicken Cross ----------
    chickenStart(userId, amount, difficulty) {
        const err = this.checkBet(amount);
        if (err)
            return { success: false, message: err };
        if (!CHICKEN_CONFIG[difficulty])
            return { success: false, message: 'Độ khó không hợp lệ.' };
        const existing = this.chickens.get(userId);
        if (existing && !existing.over)
            return { success: false, message: 'Bạn đang có ván Chicken chưa xong.' };
        const d = this.deduct(userId, amount, `Chicken ${difficulty}`);
        if (!d.success)
            return { success: false, message: d.message || 'Không đủ số dư.' };
        const seeds = (0, fair_1.newSeeds)(undefined, ++this.nonce);
        const state = {
            userId, betAmount: amount, difficulty, lane: 0, multiplier: 1, seeds, over: false,
        };
        this.chickens.set(userId, state);
        return { success: true, state: this.chickenPublic(state), newBalance: d.newBalance };
    }
    chickenPublic(s) {
        return {
            betAmount: s.betAmount, difficulty: s.difficulty, lane: s.lane,
            multiplier: s.multiplier, payout: Math.floor(s.betAmount * s.multiplier),
            lanes: CHICKEN_CONFIG[s.difficulty].mults.length,
            seedHash: s.seeds.seedHash, over: s.over,
        };
    }
    chickenAdvance(userId) {
        const s = this.chickens.get(userId);
        if (!s || s.over)
            return { success: false, message: 'Không có ván Chicken đang chơi.' };
        const cfg = CHICKEN_CONFIG[s.difficulty];
        if (s.lane >= cfg.mults.length)
            return { success: false, message: 'Đã qua hết làn, hãy rút tiền.' };
        const roll = (0, fair_1.drawFloat)(s.seeds.serverSeed, s.seeds.clientSeed, s.seeds.nonce, s.lane + 1);
        if (roll < cfg.bust) {
            s.over = true;
            this.chickens.delete(userId);
            return {
                success: true, busted: true, lane: s.lane,
                state: { ...this.chickenPublic(s), bustedLane: s.lane },
                serverSeed: s.seeds.serverSeed, clientSeed: s.seeds.clientSeed, nonce: s.seeds.nonce,
            };
        }
        s.lane += 1;
        s.multiplier = cfg.mults[s.lane - 1];
        // Qua hết làn = tự động rút max
        if (s.lane >= cfg.mults.length) {
            return this.chickenCashout(userId);
        }
        return { success: true, busted: false, lane: s.lane, state: this.chickenPublic(s) };
    }
    chickenCashout(userId) {
        const s = this.chickens.get(userId);
        if (!s || s.over)
            return { success: false, message: 'Không có ván Chicken đang chơi.' };
        if (s.lane === 0)
            return { success: false, message: 'Phải qua ít nhất 1 làn mới được rút.' };
        s.over = true;
        this.chickens.delete(userId);
        const payout = Math.floor(s.betAmount * s.multiplier);
        const r = this.credit(userId, payout, `Chicken rút x${s.multiplier}`);
        return {
            success: true, payout, newBalance: r.newBalance,
            state: this.chickenPublic(s),
            serverSeed: s.seeds.serverSeed, clientSeed: s.seeds.clientSeed, nonce: s.seeds.nonce,
        };
    }
    // ---------- Hi-Lo (dây chuyền, rút bất cứ lúc nào) ----------
    hiloStart(userId, amount) {
        const err = this.checkBet(amount);
        if (err)
            return { success: false, message: err };
        const existing = this.hilos.get(userId);
        if (existing && !existing.over)
            return { success: false, message: 'Bạn đang có dây Hi-Lo chưa xong.' };
        const d = this.deduct(userId, amount, 'Hi-Lo bắt đầu');
        if (!d.success)
            return { success: false, message: d.message || 'Không đủ số dư.' };
        const seeds = (0, fair_1.newSeeds)(undefined, ++this.nonce);
        const card = Math.floor((0, fair_1.drawFloat)(seeds.serverSeed, seeds.clientSeed, seeds.nonce, 0) * 13) + 1;
        const state = { userId, betAmount: amount, card, multiplier: 1, steps: 0, seeds, over: false };
        this.hilos.set(userId, state);
        return { success: true, state: this.hiloPublic(state), newBalance: d.newBalance };
    }
    hiloPublic(s) {
        const higherOuts = 13 - s.card;
        const lowerOuts = s.card - 1;
        return {
            betAmount: s.betAmount, card: s.card, multiplier: s.multiplier, steps: s.steps,
            payout: Math.floor(s.betAmount * s.multiplier),
            multHigher: higherOuts > 0 ? Math.floor((0.97 * 13 / higherOuts) * 100) / 100 : null,
            multLower: lowerOuts > 0 ? Math.floor((0.97 * 13 / lowerOuts) * 100) / 100 : null,
            seedHash: s.seeds.seedHash, over: s.over,
        };
    }
    hiloPick(userId, choice) {
        const s = this.hilos.get(userId);
        if (!s || s.over)
            return { success: false, message: 'Không có dây Hi-Lo đang chơi.' };
        if (choice !== 'higher' && choice !== 'lower')
            return { success: false, message: 'Chọn cao hơn hoặc thấp hơn.' };
        const next = Math.floor((0, fair_1.drawFloat)(s.seeds.serverSeed, s.seeds.clientSeed, s.seeds.nonce, s.steps + 1) * 13) + 1;
        const win = choice === 'higher' ? next > s.card : next < s.card;
        if (!win) {
            s.over = true;
            this.hilos.delete(userId);
            return {
                success: true, win: false, busted: true, card: next, prevCard: s.card,
                state: { ...this.hiloPublic(s), card: next },
                serverSeed: s.seeds.serverSeed, clientSeed: s.seeds.clientSeed, nonce: s.seeds.nonce,
            };
        }
        const outs = choice === 'higher' ? 13 - s.card : s.card - 1;
        const stepMult = Math.floor((0.97 * 13 / outs) * 100) / 100;
        s.multiplier = Math.floor(s.multiplier * stepMult * 100) / 100;
        s.card = next;
        s.steps += 1;
        return { success: true, win: true, busted: false, card: next, state: this.hiloPublic(s) };
    }
    hiloCashout(userId) {
        const s = this.hilos.get(userId);
        if (!s || s.over)
            return { success: false, message: 'Không có dây Hi-Lo đang chơi.' };
        if (s.steps === 0)
            return { success: false, message: 'Đoán đúng ít nhất 1 lá mới được rút.' };
        s.over = true;
        this.hilos.delete(userId);
        const payout = Math.floor(s.betAmount * s.multiplier);
        const r = this.credit(userId, payout, `Hi-Lo rút x${s.multiplier}`);
        return {
            success: true, payout, newBalance: r.newBalance,
            state: this.hiloPublic(s),
            serverSeed: s.seeds.serverSeed, clientSeed: s.seeds.clientSeed, nonce: s.seeds.nonce,
        };
    }
    // ---------- Aviator (vòng chung live) ----------
    aviatorStart() {
        if (this.avTimer)
            return;
        this.newAviatorRound();
    }
    aviatorStop() {
        if (this.avTimer) {
            clearTimeout(this.avTimer);
            this.avTimer = null;
        }
    }
    newAviatorRound() {
        this.avRoundId = Date.now().toString();
        this.avSeeds = (0, fair_1.newSeeds)(undefined, ++this.nonce);
        const r = (0, fair_1.drawFloat)(this.avSeeds.serverSeed, this.avSeeds.clientSeed, this.avSeeds.nonce, 0);
        this.avCrashPoint = r < 0.03 ? 1.0 : Math.min(100, Math.floor((0.97 / (1 - r)) * 100) / 100);
        this.avBets = [];
        this.avPhase = 'waiting';
        this.avMult = 1;
        this.avStartedAt = Date.now();
        this.avEndsAt = this.avStartedAt + 8000;
        this.emit('aviator', this.aviatorPublic());
        this.avTimer = setTimeout(() => this.aviatorFly(), 8000);
    }
    aviatorFly() {
        this.avPhase = 'flying';
        this.avStartedAt = Date.now();
        this.emit('aviator', this.aviatorPublic());
        this.aviatorTick();
    }
    aviatorTick() {
        const elapsed = Date.now() - this.avStartedAt;
        this.avMult = Math.floor(Math.pow(Math.E, 0.00012 * elapsed) * 100) / 100;
        if (this.avMult >= this.avCrashPoint) {
            this.avMult = this.avCrashPoint;
            this.avPhase = 'crashed';
            this.avHistory.unshift(this.avCrashPoint);
            if (this.avHistory.length > 20)
                this.avHistory.pop();
            this.emit('aviator', this.aviatorPublic(true));
            this.avTimer = setTimeout(() => this.newAviatorRound(), 5000);
            return;
        }
        this.emit('aviator', this.aviatorPublic());
        this.avTimer = setTimeout(() => this.aviatorTick(), 100);
    }
    aviatorPublic(reveal = false) {
        return {
            phase: this.avPhase,
            roundId: this.avRoundId,
            multiplier: this.avMult,
            crashPoint: this.avPhase === 'crashed' || reveal ? this.avCrashPoint : undefined,
            endsAt: this.avPhase === 'waiting' ? this.avEndsAt : undefined,
            bets: this.avBets.map((b) => ({
                displayName: b.displayName, amount: b.amount,
                cashedOut: b.cashedOut, cashoutMult: b.cashoutMult,
            })),
            history: this.avHistory,
            onlineCount: 0,
        };
    }
    aviatorBet(userId, displayName, amount) {
        if (this.avPhase !== 'waiting')
            return { success: false, message: 'Hết thời gian đặt cược, chờ vòng sau.' };
        const err = this.checkBet(amount);
        if (err)
            return { success: false, message: err };
        if (this.avBets.some((b) => b.userId === userId))
            return { success: false, message: 'Mỗi vòng chỉ cược 1 lần.' };
        const d = this.deduct(userId, amount, `Aviator #${this.avRoundId}`);
        if (!d.success)
            return { success: false, message: d.message || 'Không đủ số dư.' };
        this.avBets.push({ userId, displayName: displayName || 'Player', amount, cashedOut: false });
        this.emit('aviator', this.aviatorPublic());
        return { success: true, newBalance: d.newBalance };
    }
    aviatorCashout(userId) {
        if (this.avPhase !== 'flying')
            return { success: false, message: 'Máy bay chưa cất cánh hoặc đã nổ.' };
        const bet = this.avBets.find((b) => b.userId === userId && !b.cashedOut);
        if (!bet)
            return { success: false, message: 'Không có cược đang bay.' };
        bet.cashedOut = true;
        bet.cashoutMult = this.avMult;
        bet.payout = Math.floor(bet.amount * this.avMult);
        const r = this.credit(userId, bet.payout, `Aviator rút x${this.avMult} #${this.avRoundId}`);
        this.emit('aviator', this.aviatorPublic());
        return { success: true, payout: bet.payout, multiplier: this.avMult, newBalance: r.newBalance };
    }
}
exports.CasinoEngine = CasinoEngine;
