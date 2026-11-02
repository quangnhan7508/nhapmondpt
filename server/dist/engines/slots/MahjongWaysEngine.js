"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MahjongWaysEngine = exports.MAHJONG_REEL_HEIGHTS = void 0;
const crypto_1 = __importDefault(require("crypto"));
// Mahjong Ways (PG Soft bản gốc) — 5 reels 4-4-4-4-4, 1,024 ways.
// Base multiplier ladder x1 -> x2 -> x3 -> x5, Free Spins x2 -> x4 -> x6 -> x10.
exports.MAHJONG_REEL_HEIGHTS = [4, 4, 4, 4, 4];
const BASE_MULTIPLIERS = [1, 2, 3, 5];
const FREE_MULTIPLIERS = [2, 4, 6, 10];
// Paytable bản Ways 1 gốc: top cao hơn Ways 2 (Green 5-kind tới 100x).
const PAYTABLE = {
    mj_green: [15, 40, 100],
    mj_red: [12, 30, 80],
    mj_white: [10, 25, 60],
    mj_char8: [8, 15, 40],
    mj_dots5: [5, 10, 25],
    mj_bamboo5: [5, 10, 25],
    mj_dots3: [4, 8, 20],
    mj_bamboo2: [4, 8, 20]
};
const REGULAR_SYMBOLS = [
    { symbol: 'mj_bamboo2', weight: 16 },
    { symbol: 'mj_dots3', weight: 15 },
    { symbol: 'mj_bamboo5', weight: 13 },
    { symbol: 'mj_dots5', weight: 13 },
    { symbol: 'mj_char8', weight: 12 },
    { symbol: 'mj_white', weight: 10 },
    { symbol: 'mj_red', weight: 9 },
    { symbol: 'mj_green', weight: 7 }
];
const TOTAL_REGULAR_WEIGHT = REGULAR_SYMBOLS.reduce((acc, s) => acc + s.weight, 0);
const MAX_WIN_MULT = 25000;
class MahjongWaysEngine {
    userManager;
    freeSpinsMap = new Map();
    constructor(userManager) {
        this.userManager = userManager;
    }
    getFreeSpins(userId) {
        return this.freeSpinsMap.get(userId) || null;
    }
    spin(userId, betAmount, _options) {
        // Mahjong Ways gốc KHÔNG có Mua Free Spins — từ chối buy để giữ chuẩn PG.
        if (_options?.buyFeature) {
            return { success: false, message: 'Mahjong Ways không hỗ trợ Mua Tính Năng (chuẩn PG Soft gốc).' };
        }
        const currentFreeSpins = this.freeSpinsMap.get(userId);
        const isFreeSpin = currentFreeSpins !== undefined && currentFreeSpins.remaining > 0;
        let actualCost = 0;
        let effectiveBet = betAmount;
        if (isFreeSpin) {
            actualCost = 0;
            effectiveBet = currentFreeSpins.betAmount;
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
            this.userManager.deductBalance(userId, actualCost, `Quay Slot Mahjong Ways (${effectiveBet} 🪙)`);
        }
        const ladder = isFreeSpin ? FREE_MULTIPLIERS : BASE_MULTIPLIERS;
        let grid = this.generateInitialGrid(isFreeSpin);
        const cascades = [];
        let totalWin = 0;
        let stepIndex = 0;
        while (true) {
            const currentMultiplier = ladder[Math.min(stepIndex, ladder.length - 1)];
            const { winningWays, winningTileIds, goldWinningPositions } = this.evaluateGrid(grid, effectiveBet, currentMultiplier);
            const stepWin = winningWays.reduce((sum, w) => sum + w.payout, 0);
            totalWin += stepWin;
            let scattersCount = 0;
            for (const col of grid) {
                for (const tile of col) {
                    if (tile.symbol === 'scatter')
                        scattersCount++;
                }
            }
            const stepGridSnapshot = grid.map(col => col.map(tile => ({ ...tile, isWinning: winningTileIds.has(tile.id) })));
            cascades.push({
                stepIndex,
                grid: stepGridSnapshot,
                multiplier: currentMultiplier,
                winningWays,
                stepWin,
                totalWinSoFar: totalWin,
                hasWins: winningWays.length > 0,
                scattersCount,
                transformedWildIds: []
            });
            if (winningWays.length === 0)
                break;
            grid = this.advanceGrid(grid, winningTileIds, goldWinningPositions, isFreeSpin);
            stepIndex++;
            if (stepIndex > 25)
                break;
        }
        // Scatter: >=3 bất kỳ vị trí nào = 10 Free Spins, mỗi scatter thêm +2.
        const initialScatters = cascades[0].scattersCount;
        let triggeredFreeSpins = 0;
        if (initialScatters >= 3) {
            triggeredFreeSpins = 10 + (initialScatters - 3) * 2;
        }
        let freeSpinsInfo;
        if (isFreeSpin) {
            const state = this.freeSpinsMap.get(userId);
            state.remaining -= 1;
            state.totalWon += totalWin;
            if (triggeredFreeSpins > 0) {
                state.remaining += triggeredFreeSpins;
                state.total += triggeredFreeSpins;
            }
            if (state.remaining <= 0) {
                this.freeSpinsMap.delete(userId);
            }
            else {
                this.freeSpinsMap.set(userId, state);
            }
            freeSpinsInfo = { remaining: state.remaining, total: state.total, totalWon: state.totalWon };
        }
        else if (triggeredFreeSpins > 0) {
            const newState = {
                userId,
                slotId: 'mahjong-ways',
                remaining: triggeredFreeSpins,
                total: triggeredFreeSpins,
                betAmount: effectiveBet,
                totalWon: 0
            };
            this.freeSpinsMap.set(userId, newState);
            freeSpinsInfo = { remaining: newState.remaining, total: newState.total, totalWon: 0 };
        }
        // Chặn max win theo chuẩn PG để chống lạm phát xu.
        const maxWinCap = effectiveBet * MAX_WIN_MULT;
        if (totalWin > maxWinCap)
            totalWin = maxWinCap;
        let finalBalance = this.userManager.getBalance(userId);
        if (totalWin > 0) {
            const addRes = this.userManager.addBalance(userId, totalWin, isFreeSpin ? 'Thắng Free Spin Mahjong Ways' : 'Thắng Slot Mahjong Ways');
            finalBalance = addRes.newBalance;
        }
        const spinResult = {
            spinId: 'MJ-' + crypto_1.default.randomUUID().slice(0, 8).toUpperCase(),
            slotId: 'mahjong-ways',
            betAmount: effectiveBet,
            isFreeSpin,
            freeSpinsState: freeSpinsInfo,
            cascades,
            totalWin,
            scattersCount: initialScatters,
            triggeredFreeSpins,
            newBalance: finalBalance
        };
        return { success: true, result: spinResult };
    }
    generateInitialGrid(isFreeSpin) {
        const grid = [];
        for (let colIdx = 0; colIdx < exports.MAHJONG_REEL_HEIGHTS.length; colIdx++) {
            const height = exports.MAHJONG_REEL_HEIGHTS[colIdx];
            const col = [];
            const isMiddleReel = colIdx >= 1 && colIdx <= 3;
            for (let rowIdx = 0; rowIdx < height; rowIdx++) {
                const symbol = this.rollSymbol(colIdx);
                // Free Spins: chỉ cuộn giữa (reel 3) tự mạ vàng toàn bộ (chuẩn PG, tránh lạm phát wild).
                const forceGold = isFreeSpin && colIdx === 2 && symbol !== 'wild' && symbol !== 'scatter';
                const isGold = forceGold || (isMiddleReel && symbol !== 'wild' && symbol !== 'scatter' && Math.random() < 0.08);
                col.push({
                    id: `mj_${colIdx}_${rowIdx}_${crypto_1.default.randomUUID().slice(0, 4)}`,
                    symbol,
                    isGold
                });
            }
            grid.push(col);
        }
        return grid;
    }
    rollSymbol(colIdx) {
        if (Math.random() < 0.014)
            return 'scatter';
        // Wild tự nhiên chỉ ở 3 cuộn giữa, tỉ lệ thấp để giữ RTP.
        if (colIdx >= 1 && colIdx <= 3 && Math.random() < 0.01)
            return 'wild';
        let rand = Math.random() * TOTAL_REGULAR_WEIGHT;
        for (const item of REGULAR_SYMBOLS) {
            if (rand < item.weight)
                return item.symbol;
            rand -= item.weight;
        }
        return 'mj_bamboo2';
    }
    evaluateGrid(grid, betAmount, currentMultiplier) {
        const winningWays = [];
        const winningTileIds = new Set();
        const goldWinningPositions = [];
        const reel0Symbols = new Set();
        for (const tile of grid[0]) {
            if (tile.symbol !== 'scatter')
                reel0Symbols.add(tile.symbol);
        }
        for (const candSymbol of reel0Symbols) {
            if (!PAYTABLE[candSymbol])
                continue;
            let consecutiveReels = 0;
            const symbolCountsPerReel = [];
            const winningTilesForThisSymbol = [];
            for (let colIdx = 0; colIdx < grid.length; colIdx++) {
                const matchesInCol = [];
                for (let rowIdx = 0; rowIdx < grid[colIdx].length; rowIdx++) {
                    const tile = grid[colIdx][rowIdx];
                    if (tile.symbol === candSymbol || tile.symbol === 'wild') {
                        matchesInCol.push({ col: colIdx, row: rowIdx, id: tile.id, isGold: tile.isGold });
                    }
                }
                if (matchesInCol.length > 0) {
                    consecutiveReels++;
                    symbolCountsPerReel.push(matchesInCol.length);
                    winningTilesForThisSymbol.push(...matchesInCol);
                }
                else {
                    break;
                }
            }
            if (consecutiveReels >= 3) {
                const payIndex = consecutiveReels - 3; // 0:3, 1:4, 2:5
                const basePayout = PAYTABLE[candSymbol][payIndex];
                const ways = symbolCountsPerReel.reduce((prod, c) => prod * c, 1);
                // Chia cho 100 + scale 0.5 để cân bằng xu với Wild Bounty (giữ paytable hiển thị chuẩn PG).
                const betUnit = Math.max(1, betAmount / 100);
                const payout = Math.round(basePayout * betUnit * ways * currentMultiplier * 0.5);
                const tileIds = winningTilesForThisSymbol.filter(t => t.col < consecutiveReels).map(t => t.id);
                winningWays.push({
                    symbol: candSymbol,
                    reelCount: consecutiveReels,
                    symbolCountsPerReel,
                    ways,
                    basePayout,
                    payout,
                    winningTileIds: tileIds
                });
                for (const wt of winningTilesForThisSymbol) {
                    if (wt.col < consecutiveReels) {
                        winningTileIds.add(wt.id);
                        if (wt.isGold)
                            goldWinningPositions.push({ col: wt.col, row: wt.row });
                    }
                }
            }
        }
        return { winningWays, winningTileIds, goldWinningPositions };
    }
    advanceGrid(grid, winningTileIds, goldWinningPositions, isFreeSpin) {
        const goldSet = new Set(goldWinningPositions.map(p => `${p.col},${p.row}`));
        const newGrid = [];
        for (let colIdx = 0; colIdx < grid.length; colIdx++) {
            const col = grid[colIdx];
            const targetHeight = exports.MAHJONG_REEL_HEIGHTS[colIdx];
            const survivingTiles = [];
            const isMiddleReel = colIdx >= 1 && colIdx <= 3;
            for (let rowIdx = 0; rowIdx < col.length; rowIdx++) {
                const tile = col[rowIdx];
                if (goldSet.has(`${colIdx},${rowIdx}`)) {
                    survivingTiles.push({
                        id: `mjwild_${colIdx}_${rowIdx}_${crypto_1.default.randomUUID().slice(0, 4)}`,
                        symbol: 'wild',
                        isGold: false,
                        transformedToWild: true
                    });
                }
                else if (!winningTileIds.has(tile.id)) {
                    survivingTiles.push({ ...tile, isWinning: false, transformedToWild: false });
                }
            }
            const needed = targetHeight - survivingTiles.length;
            const newTiles = [];
            for (let r = 0; r < needed; r++) {
                const symbol = this.rollSymbol(colIdx);
                const forceGold = isFreeSpin && colIdx === 2 && symbol !== 'wild' && symbol !== 'scatter';
                const isGold = forceGold || (isMiddleReel && symbol !== 'wild' && symbol !== 'scatter' && Math.random() < 0.08);
                newTiles.push({
                    id: `mjnew_${colIdx}_${r}_${crypto_1.default.randomUUID().slice(0, 4)}`,
                    symbol,
                    isGold
                });
            }
            newGrid.push([...newTiles, ...survivingTiles]);
        }
        return newGrid;
    }
}
exports.MahjongWaysEngine = MahjongWaysEngine;
