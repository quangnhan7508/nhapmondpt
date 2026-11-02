"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreasuresOfAztecEngine = exports.AZTEC_REEL_HEIGHTS = void 0;
const crypto_1 = __importDefault(require("crypto"));
// Treasures of Aztec (PG Soft) — 6 reels, heights [5, 6, 6, 6, 6, 5] (up to 32,400 ways)
exports.AZTEC_REEL_HEIGHTS = [5, 6, 6, 6, 6, 5];
// Paytable: Symbol -> [3 reels, 4 reels, 5 reels, 6 reels] (chuẩn PG Soft Treasures of Aztec)
const PAYTABLE = {
    aztec_mask: [30, 40, 60, 80],
    aztec_chief: [20, 25, 50, 70],
    aztec_statue: [10, 25, 40, 60],
    aztec_snake: [8, 15, 20, 30],
    aztec_carving_blue: [6, 10, 12, 15],
    aztec_carving_green: [6, 10, 12, 15],
    A: [4, 6, 8, 10],
    K: [4, 6, 8, 10],
    Q: [2, 3, 5, 8],
    J: [2, 3, 5, 8],
    '10': [1, 2, 4, 6]
};
const REGULAR_SYMBOLS = [
    { symbol: '10', weight: 16 },
    { symbol: 'J', weight: 15 },
    { symbol: 'Q', weight: 14 },
    { symbol: 'K', weight: 13 },
    { symbol: 'A', weight: 12 },
    { symbol: 'aztec_carving_green', weight: 10 },
    { symbol: 'aztec_carving_blue', weight: 10 },
    { symbol: 'aztec_snake', weight: 9 },
    { symbol: 'aztec_statue', weight: 8 },
    { symbol: 'aztec_chief', weight: 6 },
    { symbol: 'aztec_mask', weight: 4 }
];
const TOTAL_REGULAR_WEIGHT = REGULAR_SYMBOLS.reduce((acc, s) => acc + s.weight, 0);
const MAX_WIN_MULT = 100000;
class TreasuresOfAztecEngine {
    userManager;
    freeSpinsMap = new Map(); // userId -> FreeSpinsState
    freeSpinsMultipliers = new Map(); // userId -> accumulating multiplier
    constructor(userManager) {
        this.userManager = userManager;
    }
    getFreeSpins(userId) {
        return this.freeSpinsMap.get(userId) || null;
    }
    /**
     * Spin Treasures of Aztec
     */
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
            actualCost = betAmount * 75; // 75x to buy Free Spins
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
            this.userManager.deductBalance(userId, actualCost, isBuy ? `Mua Free Spins Treasures of Aztec (${effectiveBet} 🪙 x75)` : `Quay Slot Treasures of Aztec (${effectiveBet} 🪙)`);
        }
        // Determine initial multiplier:
        // In Free Spins, multiplier starts at x2 and accumulates!
        // In Base Game, starts at x1.
        let currentMultiplier = isFreeSpin
            ? (this.freeSpinsMultipliers.get(userId) || 2)
            : 1;
        let grid = this.generateInitialGrid(isBuy);
        const cascades = [];
        let totalWin = 0;
        let stepIndex = 0;
        // Track Wilds-on-the-Way pending transformations:
        // silverWinning -> turns into gold in next step
        // goldWinning -> turns into wild in next step
        let nextStepTransformations = { toGold: [], toWild: [] };
        while (true) {
            const { winningWays, winningTileIds, silverWinningPositions, goldWinningPositions } = this.evaluateGrid(grid, effectiveBet, currentMultiplier);
            const stepWin = winningWays.reduce((sum, w) => sum + w.payout, 0);
            totalWin += stepWin;
            let scattersCount = 0;
            for (const col of grid) {
                for (const tile of col) {
                    if (tile.symbol === 'scatter')
                        scattersCount++;
                }
            }
            const transformedWildIds = [];
            const stepGridSnapshot = grid.map(col => col.map(tile => {
                if (tile.transformedToWild)
                    transformedWildIds.push(tile.id);
                return { ...tile, isWinning: winningTileIds.has(tile.id) };
            }));
            cascades.push({
                stepIndex,
                grid: stepGridSnapshot,
                multiplier: currentMultiplier,
                winningWays,
                stepWin,
                totalWinSoFar: totalWin,
                hasWins: winningWays.length > 0,
                scattersCount,
                transformedWildIds
            });
            if (winningWays.length === 0) {
                break; // No more wins, cascade ends
            }
            // Increase multiplier after a win:
            // Base game: +1 per winning cascade
            // Free Spins: +2 per winning cascade
            if (isFreeSpin) {
                currentMultiplier += 2;
            }
            else {
                currentMultiplier += 1;
            }
            // Next step Wilds-on-the-Way:
            nextStepTransformations = {
                toGold: silverWinningPositions,
                toWild: goldWinningPositions
            };
            // Cascade drop & transform
            grid = this.cascadeGrid(grid, winningTileIds, nextStepTransformations);
            stepIndex++;
            if (stepIndex >= 25)
                break; // Circuit breaker
        }
        // Cap max win
        const maxWinAllowed = effectiveBet * MAX_WIN_MULT;
        if (totalWin > maxWinAllowed)
            totalWin = maxWinAllowed;
        if (totalWin > 0) {
            this.userManager.addBalance(userId, totalWin, isFreeSpin ? `Thắng Free Spin Treasures of Aztec (${totalWin} 🪙)` : `Thắng Slot Treasures of Aztec (${totalWin} 🪙)`);
        }
        // Check Scatter trigger: 4 Scatters = 10 Free Spins (+2 per extra)
        let triggeredFreeSpins = 0;
        const finalScatters = cascades[0]?.scattersCount ?? 0;
        if (finalScatters >= 4) {
            triggeredFreeSpins = 10 + (finalScatters - 4) * 2;
        }
        // Update Free Spins state
        let freeSpinsStateResponse;
        if (isFreeSpin) {
            const fs = this.freeSpinsMap.get(userId);
            fs.remaining -= 1;
            fs.totalWon += totalWin;
            this.freeSpinsMultipliers.set(userId, currentMultiplier);
            if (triggeredFreeSpins > 0) {
                fs.remaining += triggeredFreeSpins;
                fs.total += triggeredFreeSpins;
            }
            if (fs.remaining <= 0) {
                this.freeSpinsMap.delete(userId);
                this.freeSpinsMultipliers.delete(userId);
            }
            freeSpinsStateResponse = {
                remaining: fs.remaining,
                total: fs.total,
                totalWon: fs.totalWon
            };
        }
        else if (triggeredFreeSpins > 0) {
            const newState = {
                userId,
                slotId: 'treasures-of-aztec',
                remaining: triggeredFreeSpins,
                total: triggeredFreeSpins,
                betAmount: effectiveBet,
                totalWon: 0
            };
            this.freeSpinsMap.set(userId, newState);
            this.freeSpinsMultipliers.set(userId, 2); // Initial multiplier in Free Spins is x2
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
                spinId: crypto_1.default.randomUUID(),
                slotId: 'treasures-of-aztec',
                betAmount: effectiveBet,
                isFreeSpin,
                freeSpinsState: freeSpinsStateResponse,
                cascades,
                totalWin,
                scattersCount: finalScatters,
                triggeredFreeSpins,
                newBalance
            }
        };
    }
    /**
     * Generates initial 6-reel grid: [5, 6, 6, 6, 6, 5]
     */
    generateInitialGrid(forceFeatureBuy) {
        const grid = [];
        // Pre-determine Scatter positions for feature buy (4 guaranteed)
        const guaranteedScatterPositions = [];
        if (forceFeatureBuy) {
            const cols = [1, 2, 3, 4]; // reels 2, 3, 4, 5
            for (const col of cols) {
                const row = Math.floor(Math.random() * exports.AZTEC_REEL_HEIGHTS[col]);
                guaranteedScatterPositions.push({ col, row });
            }
        }
        for (let c = 0; c < exports.AZTEC_REEL_HEIGHTS.length; c++) {
            const colTiles = [];
            const colHeight = exports.AZTEC_REEL_HEIGHTS[c];
            for (let r = 0; r < colHeight; r++) {
                const isGuaranteedScatter = guaranteedScatterPositions.some(p => p.col === c && p.row === r);
                if (isGuaranteedScatter) {
                    colTiles.push({
                        id: `tile_${c}_${r}_${crypto_1.default.randomUUID().substring(0, 8)}`,
                        symbol: 'scatter',
                        isGold: false,
                        isSilver: false,
                        frame: 'none'
                    });
                    continue;
                }
                // Natural Scatter chance: ~1.8%
                if (!forceFeatureBuy && Math.random() < 0.018) {
                    colTiles.push({
                        id: `tile_${c}_${r}_${crypto_1.default.randomUUID().substring(0, 8)}`,
                        symbol: 'scatter',
                        isGold: false,
                        isSilver: false,
                        frame: 'none'
                    });
                    continue;
                }
                // Wilds appear on reels 2, 3, 4, 5 with small initial chance (~2%)
                const canHaveWild = c >= 1 && c <= 4;
                if (canHaveWild && Math.random() < 0.02) {
                    colTiles.push({
                        id: `tile_${c}_${r}_${crypto_1.default.randomUUID().substring(0, 8)}`,
                        symbol: 'wild',
                        isGold: false,
                        isSilver: false,
                        frame: 'none'
                    });
                    continue;
                }
                const sym = this.pickWeightedSymbol();
                // Wilds-on-the-Way: Silver frames appear on reels 2, 3, 4, 5 (~12% chance)
                const isSilver = canHaveWild && Math.random() < 0.12;
                colTiles.push({
                    id: `tile_${c}_${r}_${crypto_1.default.randomUUID().substring(0, 8)}`,
                    symbol: sym,
                    isGold: false,
                    isSilver,
                    frame: isSilver ? 'silver' : 'none'
                });
            }
            grid.push(colTiles);
        }
        return grid;
    }
    /**
     * Evaluates adjacent ways starting from reel 1 (left to right)
     */
    evaluateGrid(grid, betAmount, multiplier) {
        const winningWays = [];
        const winningTileIds = new Set();
        const silverWinningPositions = [];
        const goldWinningPositions = [];
        const candidateSymbols = Object.keys(PAYTABLE);
        for (const sym of candidateSymbols) {
            let consecutiveReels = 0;
            const symbolCountsPerReel = [];
            const currentWinningTileIds = [];
            const tempSilverPositions = [];
            const tempGoldPositions = [];
            for (let c = 0; c < grid.length; c++) {
                let matchCount = 0;
                for (let r = 0; r < grid[c].length; r++) {
                    const tile = grid[c][r];
                    if (tile.symbol === sym || tile.symbol === 'wild') {
                        matchCount++;
                        currentWinningTileIds.push(tile.id);
                        if (tile.isSilver) {
                            tempSilverPositions.push({ col: c, row: r });
                        }
                        else if (tile.isGold) {
                            tempGoldPositions.push({ col: c, row: r });
                        }
                    }
                }
                if (matchCount > 0) {
                    consecutiveReels++;
                    symbolCountsPerReel.push(matchCount);
                }
                else {
                    break; // Must be consecutive from reel 1
                }
            }
            // Minimum 3 consecutive reels required
            if (consecutiveReels >= 3) {
                const payIndex = consecutiveReels - 3; // 0 for 3 reels, 1 for 4, 2 for 5, 3 for 6
                const basePayout = PAYTABLE[sym][payIndex];
                const ways = symbolCountsPerReel.reduce((prod, cnt) => prod * cnt, 1);
                // Payout = (betAmount / 20) * basePayout * ways * multiplier
                const payout = Math.floor((betAmount / 20) * basePayout * ways * multiplier);
                if (payout > 0) {
                    winningWays.push({
                        symbol: sym,
                        reelCount: consecutiveReels,
                        symbolCountsPerReel,
                        ways,
                        basePayout,
                        payout,
                        winningTileIds: currentWinningTileIds
                    });
                    currentWinningTileIds.forEach(id => winningTileIds.add(id));
                    tempSilverPositions.forEach(pos => silverWinningPositions.push(pos));
                    tempGoldPositions.forEach(pos => goldWinningPositions.push(pos));
                }
            }
        }
        return {
            winningWays,
            winningTileIds,
            silverWinningPositions,
            goldWinningPositions
        };
    }
    /**
     * Cascade:
     * - Silver winning tiles transform into new Gold tiles
     * - Gold winning tiles transform into Wilds
     * - Regular winning tiles shatter and disappear
     * - Remaining tiles fall down; new tiles drop from the top
     */
    cascadeGrid(grid, winningTileIds, transformations) {
        const newGrid = [];
        const goldKeySet = new Set(transformations.toGold.map(p => `${p.col},${p.row}`));
        const wildKeySet = new Set(transformations.toWild.map(p => `${p.col},${p.row}`));
        for (let c = 0; c < grid.length; c++) {
            const survivingTiles = [];
            const colHeight = exports.AZTEC_REEL_HEIGHTS[c];
            for (let r = 0; r < grid[c].length; r++) {
                const tile = grid[c][r];
                const key = `${c},${r}`;
                if (wildKeySet.has(key)) {
                    // Gold winning tile -> transforms to WILD!
                    survivingTiles.push({
                        id: `tile_wild_${c}_${r}_${crypto_1.default.randomUUID().substring(0, 8)}`,
                        symbol: 'wild',
                        isGold: false,
                        isSilver: false,
                        frame: 'none',
                        transformedToWild: true
                    });
                }
                else if (goldKeySet.has(key)) {
                    // Silver winning tile -> transforms to Gold tile with new symbol
                    const newSym = this.pickWeightedSymbol();
                    survivingTiles.push({
                        id: `tile_gold_${c}_${r}_${crypto_1.default.randomUUID().substring(0, 8)}`,
                        symbol: newSym,
                        isGold: true,
                        isSilver: false,
                        frame: 'gold'
                    });
                }
                else if (!winningTileIds.has(tile.id)) {
                    // Non-winning tile survives and retains properties
                    survivingTiles.push({ ...tile, isWinning: false, transformedToWild: false });
                }
                // Normal winning tile shatters (not added to survivingTiles)
            }
            // Fill empty spaces from top
            const missingCount = colHeight - survivingTiles.length;
            const newDropTiles = [];
            const canHaveSilver = c >= 1 && c <= 4;
            for (let i = 0; i < missingCount; i++) {
                const sym = this.pickWeightedSymbol();
                const isSilver = canHaveSilver && Math.random() < 0.1;
                newDropTiles.push({
                    id: `tile_drop_${c}_${i}_${crypto_1.default.randomUUID().substring(0, 8)}`,
                    symbol: sym,
                    isGold: false,
                    isSilver,
                    frame: isSilver ? 'silver' : 'none'
                });
            }
            // Drop order: new tiles at the top, surviving tiles below
            newGrid.push([...newDropTiles, ...survivingTiles]);
        }
        return newGrid;
    }
    pickWeightedSymbol() {
        let rand = Math.random() * TOTAL_REGULAR_WEIGHT;
        for (const item of REGULAR_SYMBOLS) {
            if (rand < item.weight)
                return item.symbol;
            rand -= item.weight;
        }
        return '10';
    }
}
exports.TreasuresOfAztecEngine = TreasuresOfAztecEngine;
