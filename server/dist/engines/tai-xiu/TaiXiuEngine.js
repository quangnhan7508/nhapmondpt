"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaiXiuEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const events_1 = require("events");
const redisRest_1 = require("../../storage/redisRest");
const types_1 = require("./types");
class TaiXiuEngine extends events_1.EventEmitter {
    userManager;
    phase = 'betting';
    roundId = '';
    md5Hash = '';
    rawString = '';
    serverSeed = '';
    phaseEndsAt = 0;
    timer = null;
    bets = [];
    totalTai = 0;
    totalXiu = 0;
    totalBao = 0;
    currentDice;
    currentResult;
    history = [];
    onlineCount = 0;
    isRunning = false;
    // Hũ jackpot: 5% mỗi cược chảy vào hũ, nổ khi bão 1-1-1 hoặc 6-6-6
    jackpotPool = 0;
    lastJackpot = null;
    jackpotFilePath;
    BETTING_DURATION = 30000;
    SHAKING_DURATION = 5000;
    // Mở bát + trả thưởng gộp trong 1 phase 15s: bát nhấc lên, xúc xắc 3D tung
    // lên rơi xuống rồi chốt kết quả, tiền thắng về ví ngay lúc mở bát.
    REVEALING_DURATION = 15000;
    MAX_HISTORY = 100;
    constructor(userManager, jackpotFilePath) {
        super();
        this.userManager = userManager;
        this.jackpotFilePath = jackpotFilePath || path_1.default.resolve(__dirname, '../../../../data/taixiu-jackpot.json');
        this.loadJackpot();
    }
    loadJackpot() {
        try {
            if (fs_1.default.existsSync(this.jackpotFilePath)) {
                const raw = fs_1.default.readFileSync(this.jackpotFilePath, 'utf-8');
                const data = JSON.parse(raw);
                if (typeof data.pool === 'number' && data.pool >= 0)
                    this.jackpotPool = Math.floor(data.pool);
                if (data.lastJackpot)
                    this.lastJackpot = data.lastJackpot;
            }
        }
        catch {
            this.jackpotPool = 0;
        }
    }
    saveJackpot() {
        try {
            const dir = path_1.default.dirname(this.jackpotFilePath);
            if (!fs_1.default.existsSync(dir))
                fs_1.default.mkdirSync(dir, { recursive: true });
            fs_1.default.writeFileSync(this.jackpotFilePath, JSON.stringify({ pool: this.jackpotPool, lastJackpot: this.lastJackpot }, null, 2), 'utf-8');
            (0, redisRest_1.scheduleRemoteSave)(redisRest_1.PERSISTED_KEYS.KEY_TAIXIU_JACKPOT, () => JSON.stringify({ pool: this.jackpotPool, lastJackpot: this.lastJackpot }));
        }
        catch {
            // Bỏ qua lỗi ghi file, hũ vẫn giữ trong RAM
        }
    }
    /** Pull jackpot from Upstash Redis on boot (if configured); first boot pushes local value up. */
    async initRemote() {
        if (!(0, redisRest_1.redisConfigured)())
            return;
        try {
            const raw = await (0, redisRest_1.redisGet)(redisRest_1.PERSISTED_KEYS.KEY_TAIXIU_JACKPOT);
            if (raw) {
                const data = JSON.parse(raw);
                if (typeof data.pool === 'number' && data.pool >= 0)
                    this.jackpotPool = Math.floor(data.pool);
                if (data.lastJackpot)
                    this.lastJackpot = data.lastJackpot;
                console.log(`[TaiXiu] Jackpot restored from Redis: ${this.jackpotPool} coins.`);
                this.saveJackpot(); // sync local file cache
            }
            else {
                // First boot: seed Redis with the current pool
                this.saveJackpot();
            }
        }
        catch (err) {
            console.warn('[TaiXiu] Redis jackpot init failed:', err instanceof Error ? err.message : err);
        }
    }
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        this.startNewRound();
    }
    stop() {
        this.isRunning = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    setOnlineCount(count) {
        this.onlineCount = count;
    }
    startNewRound() {
        if (!this.isRunning)
            return;
        this.roundId = Date.now().toString();
        this.bets = [];
        this.totalTai = 0;
        this.totalXiu = 0;
        this.totalBao = 0;
        this.currentDice = undefined;
        this.currentResult = undefined;
        this.rawString = '';
        // Generate dice and md5 for provably fair
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const d3 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2 + d3;
        let result = 'tai';
        if (d1 === d2 && d2 === d3) {
            result = 'bao';
        }
        else if (total >= 4 && total <= 10) {
            result = 'xiu';
        }
        else if (total >= 11 && total <= 17) {
            result = 'tai';
        }
        this.currentDice = { d1, d2, d3, total };
        this.currentResult = result;
        this.serverSeed = crypto_1.default.randomBytes(16).toString('hex');
        this.rawString = `${d1}-${d2}-${d3}-${this.serverSeed}`;
        this.md5Hash = crypto_1.default.createHash('md5').update(this.rawString).digest('hex');
        this.changePhase('betting', this.BETTING_DURATION);
    }
    changePhase(newPhase, duration) {
        this.phase = newPhase;
        this.phaseEndsAt = Date.now() + duration;
        this.emit('stateChange', this.getState());
        this.timer = setTimeout(() => {
            this.handlePhaseEnd();
        }, duration);
    }
    handlePhaseEnd() {
        if (!this.isRunning)
            return;
        switch (this.phase) {
            case 'betting':
                this.changePhase('shaking', this.SHAKING_DURATION);
                break;
            case 'shaking':
                // Trả thưởng ngay lúc bắt đầu mở bát để 15s vừa xem tung xúc xắc vừa nhận tiền
                this.settleBets();
                this.changePhase('revealing', this.REVEALING_DURATION);
                break;
            case 'revealing':
                this.startNewRound();
                break;
        }
    }
    settleBets() {
        if (!this.currentResult)
            return;
        const dice = this.currentDice;
        const isTriple = dice.d1 === dice.d2 && dice.d2 === dice.d3;
        const isJackpotTriple = isTriple && types_1.TAIXIU_JACKPOT_TRIPLES.includes(dice.d1);
        // 1. Trả thưởng thường 1:1.95 — bão (triple) thì Tài/Xỉu đều thua
        for (const bet of this.bets) {
            if (!isTriple && bet.betType === this.currentResult) {
                const winAmount = Math.floor(bet.amount * types_1.TAIXIU_PAYOUT_RATE);
                this.userManager.addBalance(bet.userId, winAmount, `Thắng Tài Xỉu #${this.roundId} x${types_1.TAIXIU_PAYOUT_RATE}`);
            }
            // 2. 5% mỗi cược chảy vào hũ jackpot
            this.jackpotPool += Math.floor(bet.amount * types_1.TAIXIU_JACKPOT_FEE);
        }
        // 3. Nổ hũ khi bão 1-1-1 (cửa Xỉu) hoặc 6-6-6 (cửa Tài): chia đều hũ cho
        // những người đã cược đúng cửa của phiên bão đó
        let jackpotShared = 0;
        if (isJackpotTriple && this.jackpotPool > 0) {
            const side = dice.total <= 10 ? 'xiu' : 'tai';
            const sharers = this.bets.filter((b) => b.betType === side);
            if (sharers.length > 0) {
                const shareEach = Math.floor(this.jackpotPool / sharers.length);
                if (shareEach > 0) {
                    for (const w of sharers) {
                        this.userManager.addBalance(w.userId, shareEach, `Nổ hũ Tài Xỉu ${dice.d1}-${dice.d2}-${dice.d3} #${this.roundId}`);
                    }
                    jackpotShared = shareEach * sharers.length;
                    this.lastJackpot = {
                        roundId: this.roundId,
                        dice: { ...dice },
                        side,
                        sharedPool: jackpotShared,
                        winnerCount: sharers.length,
                        shareEach,
                        timestamp: Date.now(),
                    };
                    this.jackpotPool -= jackpotShared;
                }
            }
        }
        this.saveJackpot();
        // Save to history
        this.history.unshift({
            roundId: this.roundId,
            dice,
            result: this.currentResult,
            md5Hash: this.md5Hash,
            rawString: this.rawString,
            timestamp: Date.now(),
            ...(jackpotShared > 0 ? { jackpotShared } : {}),
        });
        if (this.history.length > this.MAX_HISTORY) {
            this.history.pop();
        }
    }
    placeBet(userId, displayName, betType, amount) {
        if (this.phase !== 'betting') {
            return { success: false, message: 'Hết thời gian đặt cược' };
        }
        // Cửa Bão đã bị loại bỏ — chỉ còn Tài / Xỉu
        if (betType !== 'tai' && betType !== 'xiu') {
            return { success: false, message: 'Cửa Bão đã bị loại bỏ, chỉ còn Tài / Xỉu (1:1.95).' };
        }
        if (amount <= 0) {
            return { success: false, message: 'Số tiền cược không hợp lệ' };
        }
        // Attempt to deduct balance
        const result = this.userManager.deductBalance(userId, amount, `Cược Tài Xỉu #${this.roundId}`);
        if (result === false || (result && result.success === false)) {
            return { success: false, message: 'Số dư không đủ hoặc lỗi trừ tiền' };
        }
        this.bets.push({ userId, displayName, betType, amount });
        if (betType === 'tai')
            this.totalTai += amount;
        else if (betType === 'xiu')
            this.totalXiu += amount;
        // Emit event on new bet to update clients
        this.emit('stateChange', this.getState());
        return { success: true, message: 'Đặt cược thành công' };
    }
    getState() {
        const isRevealingOrLater = this.phase === 'revealing' || this.phase === 'settling';
        return {
            phase: this.phase,
            roundId: this.roundId,
            md5Hash: this.md5Hash,
            phaseEndsAt: this.phaseEndsAt,
            bets: this.bets,
            totalTai: this.totalTai,
            totalXiu: this.totalXiu,
            totalBao: this.totalBao,
            // Xúc xắc hiện số ngay từ đầu phiên (nắp bát che trên giao diện);
            // mở bát là thấy luôn mặt số
            dice: this.currentDice,
            result: this.currentResult,
            rawString: isRevealingOrLater ? this.rawString : undefined,
            history: this.history,
            onlineCount: this.onlineCount,
            jackpotPool: this.jackpotPool,
            lastJackpot: this.lastJackpot
        };
    }
    getMaskedStateForUser(userId) {
        const state = this.getState();
        // Hide bets from other users, but keep totals intact
        const userBets = this.bets.filter(b => b.userId === userId);
        return {
            ...state,
            bets: userBets
        };
    }
}
exports.TaiXiuEngine = TaiXiuEngine;
