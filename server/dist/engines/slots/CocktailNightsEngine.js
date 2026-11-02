"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CocktailNightsEngine = exports.COCKTAIL_REEL_HEIGHTS = void 0;
const crypto_1 = __importDefault(require("crypto"));
// Cocktail Nights (PG Soft) — 6 reels x 5 hàng + multiplier reel phụ
// DƯỚI cuộn 2-5. Ways 400 - 15,625 (stacked block tính 1 ways).
// - Wilds-on-the-Way: khối nền VÀNG (2-4 ô) thắng -> thành WILD.
// - Multiplier Reel: khởi đầu [x2,x2,x2,x2]; wild thắng ở cuộn nào thì
//   cộng dồn mult dưới các cuộn đó, rồi hủy mult đã dùng, mult lớn hơn
//   tràn vào từ bên phải. Free Spins không reset mult.
// - Free Spins: 4+ Scatter -> 10 lượt (+2/scatter thừa), mult giữ nguyên.
// - Max win x100,000. RTP 96.75%.
exports.COCKTAIL_REEL_HEIGHTS = [5, 5, 5, 5, 5, 5];
// Paytable chuẩn PG Soft Cocktail Nights (coins, cược chuẩn 20): [3, 4, 5, 6 cuộn]
const PAYTABLE = {
    cocktail_bottle: [30, 40, 50, 80],
    cocktail_whiskey: [20, 25, 30, 60],
    cocktail_blue: [10, 25, 30, 40],
    cocktail_green: [8, 15, 20, 30],
    cocktail_lemon: [6, 10, 12, 15],
    cocktail_shot: [6, 10, 12, 15],
    A: [4, 6, 8, 10],
    K: [4, 6, 8, 10],
    Q: [1, 2, 3, 4],
    J: [1, 2, 3, 4],
    '10': [1, 2, 3, 4]
};
const REGULAR_SYMBOLS = [
    { symbol: '10', weight: 16 },
    { symbol: 'J', weight: 15 },
    { symbol: 'Q', weight: 14 },
    { symbol: 'K', weight: 13 },
    { symbol: 'A', weight: 12 },
    { symbol: 'cocktail_shot', weight: 11 },
    { symbol: 'cocktail_lemon', weight: 10 },
    { symbol: 'cocktail_green', weight: 9 },
    { symbol: 'cocktail_blue', weight: 8 },
    { symbol: 'cocktail_whiskey', weight: 6 },
    { symbol: 'cocktail_bottle', weight: 4 }
];
const TOTAL_REGULAR_WEIGHT = REGULAR_SYMBOLS.reduce((acc, s) => acc + s.weight, 0);
const MAX_WIN_MULT = 100000;
const SCATTER_NEED = 4;
const FREE_SPINS_BASE = 10;
const MULT_START = 2;
const MULT_VALUE_CAP = 100;
const MULT_TOTAL_CAP = 999;
class CocktailNightsEngine {
    userManager;
    freeSpinsMap = new Map();
    // Multiplier reel đang giữ (chỉ có ý nghĩa trong Free Spins).
    multReelMap = new Map();
    constructor(userManager) {
        this.userManager = userManager;
    }
    getFreeSpins(userId) {
        return this.freeSpinsMap.get(userId) || null;
    }
    getMults(userId) {
        const m = this.multReelMap.get(userId);
        return m ? { mults: [...m.mults], max: m.max } : null;
    }
    spin(userId, betAmount, options) {
        const isBuy = !!options?.buyFeature;
        const currentFreeSpins = this.freeSpinsMap.get(userId);
        const isFreeSpin = !isBuy && currentFreeSpins !== undefined && currentFreeSpins.remaining > 0;
        let actualCost = 0;
        let effectiveBet = betAmount;
        if (isFreeSpin) {
            actualCost = 0;
            effectiveBet = currentFreeSpins.betAmount;
        }
        else if (isBuy) {
            actualCost = betAmount * 75;
            effectiveBet = betAmount;
        }
        else {
            actualCost = betAmount;
            effectiveBet = betAmount;
        }
        if (actualCost > 0) {
            const balance = this.userManager.getBalance(userId);
            if (balance < actualCost) {
                return {
                    success: false,
                    message: `Số dư không đủ! Cần tối thiểu ${actualCost.toLocaleString()} 🪙 để quay.`
                };
            }
            this.userManager.deductBalance(userId, actualCost, isBuy ? `Mua Free Spins Cocktail Nights (${effectiveBet} 🪙 x75)` : `Quay Slot Cocktail Nights (${effectiveBet} 🪙)`);
        }
        // Multiplier reel: base luôn reset [x2,x2,x2,x2]; free giữ lại (không reset).
        let mults;
        let multMax;
        if (isFreeSpin) {
            const saved = this.multReelMap.get(userId);
            mults = saved ? [...saved.mults] : [MULT_START, MULT_START, MULT_START, MULT_START];
            multMax = saved ? saved.max : MULT_START;
        }
        else {
            mults = [MULT_START, MULT_START, MULT_START, MULT_START];
            multMax = MULT_START;
        }
        const startMults = [...mults];
        const multSteps = [];
        let grid = this.generateInitialGrid(isBuy);
        const cascades = [];
        let totalWin = 0;
        let stepIndex = 0;
        while (true) {
            const { winningWays, winningTileIds, goldBlocks } = this.evaluateGrid(grid, effectiveBet);
            // Tổng mult = cộng dồn mult dưới các cuộn có WILD thắng (1 ô là đủ).
            // Không có wild thắng -> hệ số x1, mult giữ nguyên.
            const wildCols = new Set();
            for (const col of grid) {
                for (const tile of col) {
                    if (tile.symbol === 'wild' && winningTileIds.has(tile.id)) {
                        const c = this.colIndexOf(grid, tile);
                        if (c >= 1 && c <= 4)
                            wildCols.add(c);
                    }
                }
            }
            const usedIdx = [...wildCols].map(c => c - 1).sort((a, b) => a - b);
            const totalMult = usedIdx.length > 0
                ? Math.min(MULT_TOTAL_CAP, usedIdx.reduce((s, i) => s + mults[i], 0))
                : 1;
            const stepBaseWin = winningWays.reduce((sum, w) => sum + w.payout, 0);
            const stepWin = stepBaseWin * totalMult;
            totalWin += stepWin;
            const transformedWildIds = [];
            const stepGridSnapshot = grid.map(col => col.map(tile => {
                if (tile.transformedToWild)
                    transformedWildIds.push(tile.id);
                return { ...tile, isWinning: winningTileIds.has(tile.id) };
            }));
            // Ghi payout đã nhân mult vào từng way để client hiển thị đúng.
            const scaledWays = winningWays.map(w => ({
                ...w,
                payout: w.payout * totalMult
            }));
            cascades.push({
                stepIndex,
                grid: stepGridSnapshot,
                multiplier: totalMult,
                winningWays: scaledWays,
                stepWin,
                totalWinSoFar: totalWin,
                hasWins: winningWays.length > 0,
                scattersCount: this.countScatters(grid),
                transformedWildIds
            });
            multSteps.push({ mults: [...mults], used: [...usedIdx], total: totalMult });
            if (winningWays.length === 0) {
                break;
            }
            // Hủy mult đã dùng, mult lớn hơn tràn vào từ bên phải.
            for (const i of usedIdx) {
                multMax = Math.min(MULT_VALUE_CAP, multMax + 1);
                mults[i] = multMax;
            }
            grid = this.cascadeGrid(grid, winningTileIds, goldBlocks);
            stepIndex++;
            if (stepIndex >= 25)
                break;
        }
        const maxWinAllowed = effectiveBet * MAX_WIN_MULT;
        if (totalWin > maxWinAllowed)
            totalWin = maxWinAllowed;
        if (totalWin > 0) {
            this.userManager.addBalance(userId, totalWin, isFreeSpin ? `Thắng Free Spin Cocktail Nights (${totalWin} 🪙)` : `Thắng Slot Cocktail Nights (${totalWin} 🪙)`);
        }
        // Trigger: 4+ Scatter ở lưới ban đầu -> 10 lượt (+2/scatter thừa).
        let triggeredFreeSpins = 0;
        const initialScatters = cascades[0]?.scattersCount ?? 0;
        let freeSpinsStateResponse;
        if (isFreeSpin) {
            const fs = this.freeSpinsMap.get(userId);
            fs.remaining -= 1;
            fs.totalWon += totalWin;
            // Mult persits suốt đợt free (không reset sau lượt đầu).
            this.multReelMap.set(userId, { mults: [...mults], max: multMax });
            if (initialScatters >= SCATTER_NEED) {
                const extra = FREE_SPINS_BASE + (initialScatters - SCATTER_NEED) * 2;
                fs.remaining += extra;
                fs.total += extra;
                triggeredFreeSpins = extra;
            }
            if (fs.remaining <= 0) {
                this.freeSpinsMap.delete(userId);
                this.multReelMap.delete(userId);
            }
            freeSpinsStateResponse = {
                remaining: fs.remaining,
                total: fs.total,
                totalWon: fs.totalWon
            };
        }
        else if (initialScatters >= SCATTER_NEED) {
            const spins = FREE_SPINS_BASE + (initialScatters - SCATTER_NEED) * 2;
            triggeredFreeSpins = spins;
            const newState = {
                userId,
                slotId: 'cocktail-nights',
                remaining: spins,
                total: spins,
                betAmount: effectiveBet,
                totalWon: 0
            };
            this.freeSpinsMap.set(userId, newState);
            this.multReelMap.set(userId, { mults: [MULT_START, MULT_START, MULT_START, MULT_START], max: MULT_START });
            freeSpinsStateResponse = {
                remaining: newState.remaining,
                total: newState.total,
                totalWon: 0
            };
        }
        const newBalance = this.userManager.getBalance(userId);
        return {
            success: true,
            result: {
                spinId: `spin_${Date.now()}_${crypto_1.default.randomUUID().substring(0, 6)}`,
                slotId: 'cocktail-nights',
                betAmount: effectiveBet,
                isFreeSpin,
                freeSpinsState: freeSpinsStateResponse,
                multReel: { start: startMults, steps: multSteps },
                cascades,
                totalWin,
                scattersCount: initialScatters,
                triggeredFreeSpins,
                newBalance
            }
        };
    }
    colIndexOf(grid, tile) {
        for (let c = 0; c < grid.length; c++) {
            if (grid[c].includes(tile))
                return c;
        }
        return -1;
    }
    countScatters(grid) {
        let n = 0;
        for (const col of grid) {
            for (const tile of col) {
                if (tile.symbol === 'scatter')
                    n++;
            }
        }
        return n;
    }
    pickWeightedSymbol() {
        let roll = Math.floor(Math.random() * TOTAL_REGULAR_WEIGHT);
        for (const item of REGULAR_SYMBOLS) {
            if (roll < item.weight)
                return item.symbol;
            roll -= item.weight;
        }
        return '10';
    }
    makeId(prefix) {
        return `${prefix}_${crypto_1.default.randomUUID().substring(0, 8)}`;
    }
    singleTile(c, symbol) {
        return {
            id: this.makeId(`tile_${c}`),
            symbol,
            isGold: false,
            isSilver: false,
            frame: 'none'
        };
    }
    /**
     * Dựng 1 cột 5 ô từ các segment (single hoặc stacked block 2-4 ô).
     * Block nền VÀNG chỉ nằm trên cuộn 2-5 (chuẩn PG).
     */
    buildColumn(c, count, isMiddleReel) {
        const tiles = [];
        let remaining = count;
        while (remaining > 0) {
            if (isMiddleReel && remaining >= 2 && Math.random() < 0.26) {
                const span = Math.min(remaining, 2 + Math.floor(Math.random() * 3));
                const blockId = this.makeId(`blk_${c}`);
                const isWildBlock = Math.random() < 0.15;
                const sym = isWildBlock ? 'wild' : this.pickWeightedSymbol();
                // Khối nền vàng (Wilds-on-the-Way), trừ khối wild.
                const goldBg = !isWildBlock && Math.random() < 0.45;
                for (let i = 0; i < span; i++) {
                    tiles.push({
                        id: this.makeId(`tile_${c}`),
                        symbol: sym,
                        isGold: goldBg,
                        isSilver: false,
                        frame: goldBg ? 'gold' : 'none',
                        span: i === 0 ? span : undefined,
                        spanCont: i === 0 ? undefined : true,
                        block: blockId
                    });
                }
                remaining -= span;
                continue;
            }
            // Single: scatter ~2% mọi cuộn, wild ~2.5% cuộn giữa, còn lại thường.
            const roll = Math.random();
            if (roll < 0.02) {
                tiles.push(this.singleTile(c, 'scatter'));
            }
            else if (roll < 0.045 && isMiddleReel) {
                tiles.push(this.singleTile(c, 'wild'));
            }
            else {
                tiles.push(this.singleTile(c, this.pickWeightedSymbol()));
            }
            remaining -= 1;
        }
        return tiles;
    }
    generateInitialGrid(forceFeatureBuy) {
        const grid = [];
        const guaranteedScatterCols = new Set();
        if (forceFeatureBuy) {
            const cols = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, 4);
            for (const col of cols)
                guaranteedScatterCols.add(col);
        }
        for (let c = 0; c < exports.COCKTAIL_REEL_HEIGHTS.length; c++) {
            const colHeight = exports.COCKTAIL_REEL_HEIGHTS[c];
            const isMiddleReel = c >= 1 && c <= 4;
            const colTiles = this.buildColumn(c, colHeight, isMiddleReel);
            if (guaranteedScatterCols.has(c)) {
                const singles = [];
                colTiles.forEach((t, idx) => {
                    if (!t.span && !t.spanCont)
                        singles.push(idx);
                });
                const pool = singles.length > 0 ? singles : colTiles.map((_, idx) => idx);
                const row = pool[Math.floor(Math.random() * pool.length)];
                colTiles[row] = this.singleTile(c, 'scatter');
            }
            grid.push(colTiles);
        }
        return grid;
    }
    /**
     * Evaluate Ways: stacked block chỉ tính 1 ways (duyệt ô đầu khối).
     */
    evaluateGrid(grid, betAmount) {
        const winningWays = [];
        const winningTileIds = new Set();
        const goldBlocks = new Map();
        const headsPerReel = grid.map(col => {
            const heads = [];
            col.forEach((tile, r) => {
                if (!tile.spanCont)
                    heads.push({ tile, row: r });
            });
            return heads;
        });
        const firstReelSymbols = Array.from(new Set(headsPerReel[0]
            .map(h => h.tile.symbol)
            .filter(s => s !== 'scatter' && s !== 'wild')));
        for (const targetSymbol of firstReelSymbols) {
            const payArray = PAYTABLE[targetSymbol];
            if (!payArray)
                continue;
            let consecutiveReels = 0;
            const symbolCountsPerReel = [];
            const candidateTileIds = [];
            const candidateGold = new Map();
            for (let c = 0; c < headsPerReel.length; c++) {
                const matches = headsPerReel[c].filter(h => h.tile.symbol === targetSymbol || h.tile.symbol === 'wild');
                if (matches.length === 0) {
                    break;
                }
                consecutiveReels++;
                symbolCountsPerReel.push(matches.length);
                for (const { tile, row } of matches) {
                    const blockRows = this.blockRows(grid[c], row);
                    for (const br of blockRows) {
                        candidateTileIds.push(grid[c][br].id);
                    }
                    const key = tile.block ?? tile.id;
                    if (tile.isGold || tile.frame === 'gold') {
                        if (!candidateGold.has(key)) {
                            candidateGold.set(key, { col: c, rows: [...blockRows] });
                        }
                    }
                }
            }
            if (consecutiveReels >= 3) {
                const totalWays = symbolCountsPerReel.reduce((acc, count) => acc * count, 1);
                const payoutTierIndex = consecutiveReels - 3;
                const baseSymbolPayout = payArray[payoutTierIndex] || 0;
                // Paytable coins trên cược 20; scale bet/100 như các game khác.
                const payout = Math.round(baseSymbolPayout * totalWays * Math.max(1, betAmount / 100));
                if (payout > 0) {
                    winningWays.push({
                        symbol: targetSymbol,
                        reelCount: consecutiveReels,
                        symbolCountsPerReel,
                        ways: totalWays,
                        basePayout: baseSymbolPayout,
                        payout,
                        winningTileIds: candidateTileIds
                    });
                    for (const id of candidateTileIds)
                        winningTileIds.add(id);
                    for (const [k, v] of candidateGold) {
                        if (!goldBlocks.has(k))
                            goldBlocks.set(k, v);
                    }
                }
            }
        }
        return { winningWays, winningTileIds, goldBlocks };
    }
    blockRows(col, headRow) {
        const head = col[headRow];
        const span = head.span && head.span > 1 ? head.span : 1;
        const rows = [];
        for (let i = 0; i < span && headRow + i < col.length; i++) {
            rows.push(headRow + i);
        }
        return rows;
    }
    /**
     * Cascade cell-based (1 ô vào = 1 ô ra, cột không bao giờ dài ra):
     * - Mọi ô khối VÀNG thắng -> WILD rời từng ô.
     * - Ô thắng thường vỡ; còn lại giữ nguyên (block giữ nền vàng).
     */
    cascadeGrid(grid, winningTileIds, goldBlocks) {
        const newGrid = [];
        for (let c = 0; c < grid.length; c++) {
            const oldCol = grid[c];
            const targetHeight = exports.COCKTAIL_REEL_HEIGHTS[c];
            const isMiddleReel = c >= 1 && c <= 4;
            const survivingTiles = [];
            for (let r = 0; r < oldCol.length; r++) {
                const tile = oldCol[r];
                const key = tile.block ?? tile.id;
                if (goldBlocks.has(key)) {
                    survivingTiles.push({
                        id: this.makeId(`tile_${c}`),
                        symbol: 'wild',
                        isGold: false,
                        isSilver: false,
                        frame: 'none',
                        transformedToWild: true
                    });
                }
                else if (winningTileIds.has(tile.id)) {
                    // Ô thắng thường vỡ.
                }
                else {
                    survivingTiles.push(tile);
                }
            }
            const missingCount = targetHeight - survivingTiles.length;
            const refillTop = this.buildColumn(c, missingCount, isMiddleReel).slice(0, missingCount);
            const finalColumn = [...refillTop, ...survivingTiles];
            newGrid.push(finalColumn);
        }
        return newGrid;
    }
}
exports.CocktailNightsEngine = CocktailNightsEngine;
