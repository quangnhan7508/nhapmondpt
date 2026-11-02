"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WildBountyEngine = exports.REEL_HEIGHTS = void 0;
const crypto_1 = __importDefault(require("crypto"));
exports.REEL_HEIGHTS = [3, 4, 5, 5, 4, 3]; // 6 reels, 3,600 ways
// Paytable: Symbol -> [3 reels, 4 reels, 5 reels, 6 reels]
const PAYTABLE = {
    cowgirl: [10, 20, 30, 50],
    whiskey: [8, 15, 20, 30],
    hat: [5, 10, 15, 20],
    holster: [4, 8, 10, 15],
    A: [2, 5, 8, 10],
    K: [2, 4, 6, 8],
    Q: [1, 3, 5, 6],
    J: [1, 2, 4, 5]
};
// Weighted distribution for symbol generation - balanced for ~26% realistic slot hit rate
const REGULAR_SYMBOLS = [
    { symbol: 'J', weight: 16 },
    { symbol: 'Q', weight: 15 },
    { symbol: 'K', weight: 14 },
    { symbol: 'A', weight: 13 },
    { symbol: 'holster', weight: 12 },
    { symbol: 'hat', weight: 11 },
    { symbol: 'whiskey', weight: 10 },
    { symbol: 'cowgirl', weight: 8 }
];
const TOTAL_REGULAR_WEIGHT = REGULAR_SYMBOLS.reduce((acc, s) => acc + s.weight, 0);
class WildBountyEngine {
    userManager;
    freeSpinsMap = new Map(); // userId -> FreeSpinsState
    constructor(userManager) {
        this.userManager = userManager;
    }
    getFreeSpins(userId) {
        return this.freeSpinsMap.get(userId) || null;
    }
    /**
     * Spin the Wild Bounty Showdown reels
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
            actualCost = betAmount * 75; // 75x bet to buy 10 Free Spins feature
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
            this.userManager.deductBalance(userId, actualCost, isBuy ? `Mua Free Spins Wild Bounty (${effectiveBet} 🪙 x75)` : `Quay Slot Wild Bounty (${effectiveBet} 🪙)`);
        }
        // Determine initial multiplier: 8x in Free Spins, 1x in Base Game
        let currentMultiplier = isFreeSpin ? 8 : 1;
        // Generate initial grid
        let grid = this.generateInitialGrid(isBuy);
        const cascades = [];
        let totalWin = 0;
        let stepIndex = 0;
        let pendingWildPositions = [];
        // Main cascading loop
        while (true) {
            // Evaluate winning ways on current grid
            const { winningWays, winningTileIds, goldWinningPositions } = this.evaluateGrid(grid, effectiveBet, currentMultiplier);
            const stepWin = winningWays.reduce((sum, w) => sum + w.payout, 0);
            totalWin += stepWin;
            // Count scatters across the entire grid
            let scattersCount = 0;
            for (const col of grid) {
                for (const tile of col) {
                    if (tile.symbol === 'scatter')
                        scattersCount++;
                }
            }
            // Mark winning tiles in this step
            const stepGridSnapshot = grid.map(col => col.map(tile => ({
                ...tile,
                isWinning: winningTileIds.has(tile.id)
            })));
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
            if (winningWays.length === 0) {
                // No more wins -> End of cascade
                break;
            }
            // Prepare next cascade:
            // 1. Gold-framed winning tiles become transformed Wilds
            pendingWildPositions = [...goldWinningPositions];
            // 2. Multiplier DOUBLES for next cascade (up to 1,024x)
            currentMultiplier = Math.min(1024, currentMultiplier * 2);
            // 3. Remove non-gold winning tiles, transform gold ones into Wilds, drop surviving tiles down, fill from top
            grid = this.advanceGrid(grid, winningTileIds, pendingWildPositions);
            stepIndex++;
            // Guard against infinite loop
            if (stepIndex > 25)
                break;
        }
        // Check Scatters trigger (only counts on initial grid or full spin)
        // 3+ Scatters award 10 Free Spins (+2 for each additional)
        const initialScatters = cascades[0].scattersCount;
        let triggeredFreeSpins = 0;
        if (initialScatters >= 3) {
            triggeredFreeSpins = 10 + (initialScatters - 3) * 2;
        }
        // Handle Free Spins State Progression
        let freeSpinsInfo;
        if (isFreeSpin) {
            const state = this.freeSpinsMap.get(userId);
            state.remaining -= 1;
            state.totalWon += totalWin;
            // Retrigger in free spins?
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
            freeSpinsInfo = {
                remaining: state.remaining,
                total: state.total,
                totalWon: state.totalWon
            };
        }
        else if (triggeredFreeSpins > 0) {
            // Triggered from base game or buy feature
            const newState = {
                userId,
                slotId: 'wild-bounty-showdown',
                remaining: triggeredFreeSpins,
                total: triggeredFreeSpins,
                betAmount: effectiveBet,
                totalWon: 0
            };
            this.freeSpinsMap.set(userId, newState);
            freeSpinsInfo = {
                remaining: newState.remaining,
                total: newState.total,
                totalWon: 0
            };
        }
        // Credit winnings to user
        let finalBalance = this.userManager.getBalance(userId);
        if (totalWin > 0) {
            const addRes = this.userManager.addBalance(userId, totalWin, isFreeSpin ? `Thắng Free Spin Wild Bounty` : `Thắng Slot Wild Bounty`);
            finalBalance = addRes.newBalance;
        }
        const spinResult = {
            spinId: 'SPIN-' + crypto_1.default.randomUUID().slice(0, 8).toUpperCase(),
            slotId: 'wild-bounty-showdown',
            betAmount: effectiveBet,
            isFreeSpin,
            freeSpinsState: freeSpinsInfo,
            cascades,
            totalWin,
            scattersCount: initialScatters,
            triggeredFreeSpins,
            newBalance: finalBalance
        };
        return {
            success: true,
            result: spinResult
        };
    }
    /**
     * Generates the initial 6-reel grid matching REEL_HEIGHTS [3, 4, 5, 5, 4, 3]
     */
    generateInitialGrid(forceFeatureBuy) {
        const grid = [];
        for (let colIdx = 0; colIdx < exports.REEL_HEIGHTS.length; colIdx++) {
            const height = exports.REEL_HEIGHTS[colIdx];
            const col = [];
            for (let rowIdx = 0; rowIdx < height; rowIdx++) {
                // Can symbols on reels 1, 2, 3, 4 have gold frames? (Reels 2, 3, 4, 5 in 1-based indexing)
                const canHaveGold = colIdx >= 1 && colIdx <= 4;
                const isGold = canHaveGold && Math.random() < 0.08; // ~8% chance of gold frame
                const symbol = this.rollSymbol(colIdx);
                col.push({
                    id: `t_${colIdx}_${rowIdx}_${crypto_1.default.randomUUID().slice(0, 4)}`,
                    symbol,
                    isGold: symbol !== 'wild' && symbol !== 'scatter' && isGold
                });
            }
            grid.push(col);
        }
        // If Feature Buy was purchased, guarantee 3 or 4 Scatters placed across distinct reels!
        if (forceFeatureBuy) {
            const scatterCols = [1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 3);
            for (const c of scatterCols) {
                const r = Math.floor(Math.random() * exports.REEL_HEIGHTS[c]);
                grid[c][r] = {
                    id: `scatter_${c}_${r}_${crypto_1.default.randomUUID().slice(0, 4)}`,
                    symbol: 'scatter',
                    isGold: false
                };
            }
        }
        return grid;
    }
    /**
     * Randomly roll a symbol based on reel position and weight
     */
    rollSymbol(colIdx) {
        // Scatter chance: ~2.2% on each position
        if (Math.random() < 0.022) {
            return 'scatter';
        }
        // Natural Wilds only spawn on reels 2, 3, 4, 5 (indices 1, 2, 3, 4) with ~2% rate
        if (colIdx >= 1 && colIdx <= 4 && Math.random() < 0.02) {
            return 'wild';
        }
        // Weighted roll among regular symbols
        let rand = Math.random() * TOTAL_REGULAR_WEIGHT;
        for (const item of REGULAR_SYMBOLS) {
            if (rand < item.weight) {
                return item.symbol;
            }
            rand -= item.weight;
        }
        return 'J';
    }
    /**
     * Evaluates all winning ways on the current 6-reel grid (ways to win left-to-right starting from reel 0)
     */
    evaluateGrid(grid, betAmount, currentMultiplier) {
        const winningWays = [];
        const winningTileIds = new Set();
        const goldWinningPositions = [];
        // Distinct regular symbols present on reel 0
        const reel0Symbols = new Set();
        for (const tile of grid[0]) {
            if (tile.symbol !== 'scatter') {
                reel0Symbols.add(tile.symbol);
            }
        }
        // Check each possible candidate symbol
        for (const candSymbol of reel0Symbols) {
            // Must be regular paying symbol
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
                    // Streak broken
                    break;
                }
            }
            // Needs at least 3 consecutive reels (3 to 6)
            if (consecutiveReels >= 3) {
                const payIndex = consecutiveReels - 3; // 0 for 3, 1 for 4, 2 for 5, 3 for 6
                const basePayout = PAYTABLE[candSymbol][payIndex];
                // Total ways for this symbol = product of symbol counts on the winning reels
                const ways = symbolCountsPerReel.reduce((prod, c) => prod * c, 1);
                // Payout formula: (basePayout * (betAmount / 20)) * ways * currentMultiplier
                const betUnit = Math.max(1, betAmount / 20);
                const payout = Math.round(basePayout * betUnit * ways * currentMultiplier);
                const tileIds = winningTilesForThisSymbol
                    .filter(t => t.col < consecutiveReels)
                    .map(t => t.id);
                winningWays.push({
                    symbol: candSymbol,
                    reelCount: consecutiveReels,
                    symbolCountsPerReel,
                    ways,
                    basePayout,
                    payout,
                    winningTileIds: tileIds
                });
                // Record winning tile IDs and gold positions
                for (const wt of winningTilesForThisSymbol) {
                    if (wt.col < consecutiveReels) {
                        winningTileIds.add(wt.id);
                        if (wt.isGold) {
                            goldWinningPositions.push({ col: wt.col, row: wt.row });
                        }
                    }
                }
            }
        }
        return {
            winningWays,
            winningTileIds,
            goldWinningPositions
        };
    }
    /**
     * Advances the grid for the next cascade:
     * 1. Gold-framed winning tiles transform into Wilds
     * 2. Non-gold winning tiles explode
     * 3. Gravity drops remaining tiles down
     * 4. New tiles fill in from the top
     */
    advanceGrid(grid, winningTileIds, goldWinningPositions) {
        const goldSet = new Set(goldWinningPositions.map(p => `${p.col},${p.row}`));
        const newGrid = [];
        for (let colIdx = 0; colIdx < grid.length; colIdx++) {
            const col = grid[colIdx];
            const targetHeight = exports.REEL_HEIGHTS[colIdx];
            const survivingTiles = [];
            for (let rowIdx = 0; rowIdx < col.length; rowIdx++) {
                const tile = col[rowIdx];
                const isGoldWinner = goldSet.has(`${colIdx},${rowIdx}`);
                if (isGoldWinner) {
                    // Transform into WILD! Keep in the column
                    survivingTiles.push({
                        id: `wild_trans_${colIdx}_${rowIdx}_${crypto_1.default.randomUUID().slice(0, 4)}`,
                        symbol: 'wild',
                        isGold: false,
                        transformedToWild: true
                    });
                }
                else if (!winningTileIds.has(tile.id)) {
                    // Non-winning tile survives
                    survivingTiles.push({
                        ...tile,
                        isWinning: false,
                        transformedToWild: false
                    });
                }
                // Non-gold winning tile is removed (explodes)
            }
            // How many new tiles needed from top?
            const needed = targetHeight - survivingTiles.length;
            const newTiles = [];
            for (let r = 0; r < needed; r++) {
                const canHaveGold = colIdx >= 1 && colIdx <= 4;
                const isGold = canHaveGold && Math.random() < 0.08;
                const symbol = this.rollSymbol(colIdx);
                newTiles.push({
                    id: `tile_new_${colIdx}_${r}_${crypto_1.default.randomUUID().slice(0, 4)}`,
                    symbol,
                    isGold: symbol !== 'wild' && symbol !== 'scatter' && isGold
                });
            }
            // New tiles drop from top above surviving tiles
            newGrid.push([...newTiles, ...survivingTiles]);
        }
        return newGrid;
    }
}
exports.WildBountyEngine = WildBountyEngine;
