"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaishenWinsEngine = exports.CAISHEN_REEL_HEIGHTS = void 0;
const crypto_1 = __importDefault(require("crypto"));
// Caishen Wins (PG Soft, chuẩn PDF r776) — 6 reels 5 hàng + top reel phụ
// trên cuộn 2-5. Heights [5, 6, 6, 6, 6, 5] (tối đa 32,400 ways).
// - Stacked symbols: 1 symbol chiếm 2-4 ô nhưng chỉ tính 1 ways
//   (ways thực tế 2,025 - 32,400).
// - Wilds-on-the-Way: khối khung Bạc thắng -> Khung Vàng (cùng symbol),
//   khối Khung Vàng thắng -> 2-4 WILD.
// - Success Caishen: block 4 ô full top reel -> 4 WILD.
// - Free Spins: 4+ Scatter -> 8 lượt (+2/scatter thừa), x8, được gamble
//   tối đa 20 lượt / x20 (thua gamble mất bonus).
exports.CAISHEN_REEL_HEIGHTS = [5, 6, 6, 6, 6, 5];
// Paytable chuẩn PG Soft Caishen Wins (coins, cược chuẩn 20): [3, 4, 5, 6 cuộn]
const PAYTABLE = {
    caishen_lion: [30, 40, 50, 80],
    caishen_toad: [20, 25, 30, 50],
    caishen_koi: [10, 25, 30, 40],
    caishen_angpao: [8, 15, 20, 30],
    caishen_cymbal: [6, 10, 12, 15],
    caishen_firecracker: [6, 10, 12, 15],
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
    { symbol: 'caishen_firecracker', weight: 11 },
    { symbol: 'caishen_cymbal', weight: 10 },
    { symbol: 'caishen_angpao', weight: 9 },
    { symbol: 'caishen_koi', weight: 8 },
    { symbol: 'caishen_toad', weight: 6 },
    { symbol: 'caishen_lion', weight: 4 }
];
const TOTAL_REGULAR_WEIGHT = REGULAR_SYMBOLS.reduce((acc, s) => acc + s.weight, 0);
const MAX_WIN_MULT = 100000;
const SCATTER_NEED = 4;
const FREE_SPINS_BASE = 8;
const GAMBLE_MAX_SPINS = 20;
const GAMBLE_MAX_MULT = 20;
class CaishenWinsEngine {
    userManager;
    freeSpinsMap = new Map(); // userId -> FreeSpinsState
    freeSpinsMultipliers = new Map(); // userId -> accumulating multiplier
    pendingOffers = new Map(); // userId -> offer chờ Nhận/Gamble
    constructor(userManager) {
        this.userManager = userManager;
    }
    getFreeSpins(userId) {
        return this.freeSpinsMap.get(userId) || null;
    }
    getOffer(userId) {
        return this.pendingOffers.get(userId) || null;
    }
    /**
     * Nhận offer (bắt đầu Free Spins) hoặc Gamble thêm lượt / hệ số.
     * action: 'accept' | 'gamble-spins' | 'gamble-mult'
     */
    resolveOffer(userId, action) {
        const offer = this.pendingOffers.get(userId);
        if (!offer) {
            return { success: false, message: 'Không có offer Free Spins nào đang chờ.' };
        }
        if (action === 'accept') {
            const state = {
                userId,
                slotId: 'caishen-wins',
                remaining: offer.spins,
                total: offer.spins,
                betAmount: offer.betAmount,
                totalWon: 0
            };
            this.freeSpinsMap.set(userId, state);
            this.freeSpinsMultipliers.set(userId, offer.mult);
            this.pendingOffers.delete(userId);
            return { success: true, offer: null, freeSpins: { ...state } };
        }
        if (offer.gamblesLeft <= 0) {
            return { success: false, message: 'Đã hết lượt Gamble.', offer: { ...offer } };
        }
        const isSpins = action === 'gamble-spins';
        if (isSpins && offer.spins >= GAMBLE_MAX_SPINS) {
            return { success: false, message: 'Số lượt đã đạt tối đa 20.', offer: { ...offer } };
        }
        if (!isSpins && offer.mult >= GAMBLE_MAX_MULT) {
            return { success: false, message: 'Hệ số đã đạt tối đa x20.', offer: { ...offer } };
        }
        offer.gamblesLeft -= 1;
        // Chuẩn PDF gốc: gamble thắng +2 lượt / +2 hệ số, thua mất toàn bộ bonus.
        if (Math.random() < 0.6) {
            if (isSpins) {
                offer.spins = Math.min(GAMBLE_MAX_SPINS, offer.spins + 2);
            }
            else {
                offer.mult = Math.min(GAMBLE_MAX_MULT, offer.mult + 2);
            }
            this.pendingOffers.set(userId, offer);
            return { success: true, offer: { ...offer } };
        }
        this.pendingOffers.delete(userId);
        return { success: true, offer: null, bust: true };
    }
    /**
     * Spin Caishen Wins
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
            this.userManager.deductBalance(userId, actualCost, isBuy ? `Mua Free Spins Caishen Wins (${effectiveBet} 🪙 x75)` : `Quay Slot Caishen Wins (${effectiveBet} 🪙)`);
        }
        // Hệ số khởi điểm: Free Spins dùng hệ số cộng dồn (mặc định x8),
        // Base game x1.
        let currentMultiplier = isFreeSpin
            ? (this.freeSpinsMultipliers.get(userId) || 8)
            : 1;
        let grid = this.generateInitialGrid(isBuy);
        const cascades = [];
        let totalWin = 0;
        let stepIndex = 0;
        while (true) {
            // Success Caishen: block 4 ô full top reel -> 4 WILD trước khi tính thắng.
            if (this.isGodBlockFull(grid)) {
                const godSnapshot = grid.map(col => col.map(t => ({ ...t })));
                cascades.push({
                    stepIndex,
                    grid: godSnapshot,
                    multiplier: currentMultiplier,
                    winningWays: [],
                    stepWin: 0,
                    totalWinSoFar: totalWin,
                    hasWins: false,
                    scattersCount: this.countScatters(grid),
                    transformedWildIds: []
                });
                stepIndex++;
                grid = this.convertGodBlock(grid);
            }
            const { winningWays, winningTileIds, silverBlocks, goldBlocks } = this.evaluateGrid(grid, effectiveBet, currentMultiplier);
            const stepWin = winningWays.reduce((sum, w) => sum + w.payout, 0);
            totalWin += stepWin;
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
                scattersCount: this.countScatters(grid),
                transformedWildIds
            });
            if (winningWays.length === 0) {
                break; // No more wins, cascade ends
            }
            // Mỗi cascade thắng +1 multiplier (base x1->x2..., free x8->x9... cộng dồn).
            currentMultiplier += 1;
            // Cascade drop & Wilds-on-the-Way transform theo khối.
            grid = this.cascadeGrid(grid, winningTileIds, silverBlocks, goldBlocks);
            stepIndex++;
            if (stepIndex >= 25)
                break; // Circuit breaker
        }
        // Cap max win
        const maxWinAllowed = effectiveBet * MAX_WIN_MULT;
        if (totalWin > maxWinAllowed)
            totalWin = maxWinAllowed;
        if (totalWin > 0) {
            this.userManager.addBalance(userId, totalWin, isFreeSpin ? `Thắng Free Spin Caishen Wins (${totalWin} 🪙)` : `Thắng Slot Caishen Wins (${totalWin} 🪙)`);
        }
        // Trigger: 4+ Scatter ở lưới ban đầu -> OFFER (8 lượt +2/scatter thừa, x8),
        // người chơi chọn Nhận hoặc Gamble (không auto-start như trước).
        let triggeredFreeSpins = 0;
        let freeSpinsOffer = null;
        const initialScatters = cascades[0]?.scattersCount ?? 0;
        let freeSpinsStateResponse;
        if (isFreeSpin) {
            const fs = this.freeSpinsMap.get(userId);
            fs.remaining -= 1;
            fs.totalWon += totalWin;
            this.freeSpinsMultipliers.set(userId, currentMultiplier);
            // Retrigger: 4+ Scatter -> +8 lượt (+2/scatter thừa).
            if (initialScatters >= SCATTER_NEED) {
                const extra = FREE_SPINS_BASE + (initialScatters - SCATTER_NEED) * 2;
                fs.remaining += extra;
                fs.total += extra;
                triggeredFreeSpins = extra;
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
        else if (initialScatters >= SCATTER_NEED) {
            const spins = FREE_SPINS_BASE + (initialScatters - SCATTER_NEED) * 2;
            triggeredFreeSpins = spins;
            const offer = {
                spins,
                mult: 8,
                gamblesLeft: 2,
                betAmount: effectiveBet
            };
            this.pendingOffers.set(userId, offer);
            freeSpinsOffer = { ...offer };
        }
        const newBalance = this.userManager.getBalance(userId);
        return {
            success: true,
            result: {
                spinId: `spin_${Date.now()}_${crypto_1.default.randomUUID().substring(0, 6)}`,
                slotId: 'caishen-wins',
                betAmount: effectiveBet,
                isFreeSpin,
                freeSpinsState: freeSpinsStateResponse,
                freeSpinsOffer,
                cascades,
                totalWin,
                scattersCount: initialScatters,
                triggeredFreeSpins,
                newBalance
            }
        };
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
    /** Success Caishen block full 4 ô top reel (row 0 của cuộn 2-5)? */
    isGodBlockFull(grid) {
        for (let c = 1; c <= 4; c++) {
            if (!grid[c] || grid[c][0]?.symbol !== 'caishen_god')
                return false;
        }
        return true;
    }
    /** Biến block Thần Tài thành 4 WILD tại chỗ. */
    convertGodBlock(grid) {
        return grid.map((col, c) => col.map((tile, r) => {
            if (c >= 1 && c <= 4 && r === 0 && tile.symbol === 'caishen_god') {
                return {
                    id: `godwild_${c}_${crypto_1.default.randomUUID().substring(0, 6)}`,
                    symbol: 'wild',
                    isGold: false,
                    isSilver: false,
                    frame: 'none',
                    isTopReel: true,
                    transformedToWild: true
                };
            }
            return tile;
        }));
    }
    /**
     * Pick weighted regular symbol (không gồm scatter/wild/god)
     */
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
    singleTile(c, symbol, opts) {
        const frame = opts?.frame ?? 'none';
        return {
            id: this.makeId(`tile_${c}`),
            symbol,
            isGold: opts?.isGold ?? frame === 'gold',
            isSilver: frame === 'silver',
            frame,
            isTopReel: opts?.isTopReel
        };
    }
    /**
     * Dựng 1 cột từ các segment (single hoặc stacked block 2-4 ô).
     * Ô top reel của cuộn giữa luôn là single, không frame.
     */
    buildColumn(c, count, isMiddleReel, topReelCell) {
        const tiles = [];
        let remaining = count;
        // Ô top reel: single, có thể scatter/wild/symbol thường, không frame.
        if (topReelCell && remaining > 0) {
            const roll = Math.random();
            if (roll < 0.018) {
                tiles.push(this.singleTile(c, 'scatter', { isTopReel: true }));
            }
            else if (roll < 0.038 && isMiddleReel) {
                tiles.push(this.singleTile(c, 'wild', { isTopReel: true }));
            }
            else {
                tiles.push(this.singleTile(c, this.pickWeightedSymbol(), { isTopReel: true }));
            }
            remaining -= 1;
        }
        while (remaining > 0) {
            // Stacked block 2-4 ô trên cuộn giữa (chuẩn PG: chỉ block mới có frame).
            if (isMiddleReel && remaining >= 2 && Math.random() < 0.22) {
                const span = Math.min(remaining, 2 + Math.floor(Math.random() * 3));
                const blockId = this.makeId(`blk_${c}`);
                // 15% khối wild (jumbo wild 2-4 ô, không frame), còn lại symbol thường.
                const isWildBlock = Math.random() < 0.15;
                const sym = isWildBlock ? 'wild' : this.pickWeightedSymbol();
                // 40% khối thường có khung Bạc.
                const framed = !isWildBlock && Math.random() < 0.4;
                for (let i = 0; i < span; i++) {
                    tiles.push({
                        id: this.makeId(`tile_${c}`),
                        symbol: sym,
                        isGold: false,
                        isSilver: framed,
                        frame: framed ? 'silver' : 'none',
                        span: i === 0 ? span : undefined,
                        spanCont: i === 0 ? undefined : true,
                        block: blockId,
                        isTopReel: false
                    });
                }
                remaining -= span;
                continue;
            }
            // Single: scatter (~1.8% mọi cuộn), wild (~2% cuộn giữa), còn lại thường.
            const roll = Math.random();
            if (roll < 0.018) {
                tiles.push(this.singleTile(c, 'scatter', { isTopReel: false }));
            }
            else if (roll < 0.038 && isMiddleReel) {
                tiles.push(this.singleTile(c, 'wild', { isTopReel: false }));
            }
            else {
                tiles.push(this.singleTile(c, this.pickWeightedSymbol(), { isTopReel: false }));
            }
            remaining -= 1;
        }
        return tiles;
    }
    /**
     * Generate initial grid: heights [5, 6, 6, 6, 6, 5].
     * Ô top reel = row 0 của cuộn 2-5. Buy feature bảo đảm 4 Scatter.
     */
    generateInitialGrid(forceFeatureBuy) {
        const grid = [];
        // Guarantee 4 Scatters for feature buy (rải 4 cuộn khác nhau).
        const guaranteedScatterCols = new Set();
        if (forceFeatureBuy) {
            const cols = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, 4);
            for (const col of cols)
                guaranteedScatterCols.add(col);
        }
        // Success Caishen: ~4% ra full block 4 ô top reel (không áp khi mua).
        const godBlock = !forceFeatureBuy && Math.random() < 0.04;
        for (let c = 0; c < exports.CAISHEN_REEL_HEIGHTS.length; c++) {
            const colHeight = exports.CAISHEN_REEL_HEIGHTS[c];
            const isMiddleReel = c >= 1 && c <= 4;
            const colTiles = this.buildColumn(c, colHeight, isMiddleReel, isMiddleReel);
            if (godBlock && isMiddleReel) {
                colTiles[0] = {
                    id: this.makeId(`god_${c}`),
                    symbol: 'caishen_god',
                    isGold: false,
                    isSilver: false,
                    frame: 'none',
                    isTopReel: true
                };
            }
            if (guaranteedScatterCols.has(c)) {
                // Đặt scatter vào ô single (không đè vào giữa stacked block
                // để span không bị corrupt làm cột dài ra).
                const singles = [];
                colTiles.forEach((t, idx) => {
                    if (!t.span && !t.spanCont)
                        singles.push(idx);
                });
                const pool = singles.length > 0 ? singles : colTiles.map((_, idx) => idx);
                const row = pool[Math.floor(Math.random() * pool.length)];
                colTiles[row] = this.singleTile(c, 'scatter', { isTopReel: row === 0 && isMiddleReel });
            }
            grid.push(colTiles);
        }
        return grid;
    }
    /**
     * Evaluate Ways: stacked block chỉ tính 1 ways (duyệt ô đầu khối).
     * Thắng từ cuộn 1 sang phải, tối thiểu 3 cuộn liên tiếp.
     */
    evaluateGrid(grid, betAmount, multiplier) {
        const winningWays = [];
        const winningTileIds = new Set();
        const silverBlocks = new Map();
        const goldBlocks = new Map();
        // Ô đầu khối mỗi cuộn (bỏ ô nối spanCont).
        const headsPerReel = grid.map(col => {
            const heads = [];
            col.forEach((tile, r) => {
                if (!tile.spanCont)
                    heads.push({ tile, row: r });
            });
            return heads;
        });
        // Distinct symbols trên cuộn 1 (trừ scatter/wild/god).
        const firstReelSymbols = Array.from(new Set(headsPerReel[0]
            .map(h => h.tile.symbol)
            .filter(s => s !== 'scatter' && s !== 'wild' && s !== 'caishen_god')));
        for (const targetSymbol of firstReelSymbols) {
            const payArray = PAYTABLE[targetSymbol];
            if (!payArray)
                continue;
            let consecutiveReels = 0;
            const symbolCountsPerReel = [];
            const candidateTileIds = [];
            // Gom block Bạc/Vàng theo block id để transform cả khối.
            const candidateSilver = new Map();
            const candidateGold = new Map();
            for (let c = 0; c < headsPerReel.length; c++) {
                const matches = headsPerReel[c].filter(h => h.tile.symbol === targetSymbol || h.tile.symbol === 'wild');
                if (matches.length === 0) {
                    break; // Streak broken
                }
                consecutiveReels++;
                symbolCountsPerReel.push(matches.length);
                for (const { tile, row } of matches) {
                    // Với khối stacked: tính cả khối (ô đầu + ô nối) vào tiles thắng.
                    const blockRows = this.blockRows(grid[c], row);
                    for (const br of blockRows) {
                        candidateTileIds.push(grid[c][br].id);
                    }
                    const key = tile.block ?? tile.id;
                    if (tile.isSilver || tile.frame === 'silver') {
                        if (!candidateSilver.has(key)) {
                            candidateSilver.set(key, { col: c, rows: [...blockRows], symbol: tile.symbol });
                        }
                    }
                    else if (tile.isGold || tile.frame === 'gold') {
                        if (!candidateGold.has(key)) {
                            candidateGold.set(key, { col: c, rows: [...blockRows] });
                        }
                    }
                }
            }
            // Need at least 3 consecutive reels for a win
            if (consecutiveReels >= 3) {
                const totalWays = symbolCountsPerReel.reduce((acc, count) => acc * count, 1);
                const payoutTierIndex = consecutiveReels - 3; // 3->0, 4->1, 5->2, 6->3
                const baseSymbolPayout = payArray[payoutTierIndex] || 0;
                // Base payout per bet unit (chuẩn PG: paytable coins trên cược 20;
                // scale bet/100 như các game khác để cân bằng kinh tế xu).
                const payout = Math.round(baseSymbolPayout * totalWays * Math.max(1, betAmount / 100) * multiplier);
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
                    for (const [k, v] of candidateSilver) {
                        if (!silverBlocks.has(k))
                            silverBlocks.set(k, v);
                    }
                    for (const [k, v] of candidateGold) {
                        if (!goldBlocks.has(k))
                            goldBlocks.set(k, v);
                    }
                }
            }
        }
        return {
            winningWays,
            winningTileIds,
            silverBlocks,
            goldBlocks
        };
    }
    /** Các row thuộc cùng block với ô head tại (col,row). */
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
     * Cascade & Wilds-on-the-Way theo khối — xử lý CELL-BASED (1 ô vào = 1 ô
     * ra) để số ô mỗi cột không bao giờ thay đổi (cột không dài ra):
     * - Mọi ô của khối Bạc thắng -> Khung Vàng, cả khối cùng 1 symbol mới.
     * - Mọi ô của khối Vàng thắng -> WILD rời từng ô (chuẩn PG: 2-4 wild).
     * - Ô thắng thường vỡ; ô còn lại giữ nguyên (block giữ frame).
     */
    cascadeGrid(grid, winningTileIds, silverBlocks, goldBlocks) {
        const newGrid = [];
        // Symbol vàng cho từng khối Bạc (cả khối cùng 1 symbol).
        const goldSymbolByBlock = new Map();
        for (const [key] of silverBlocks) {
            goldSymbolByBlock.set(key, this.pickWeightedSymbol());
        }
        for (let c = 0; c < grid.length; c++) {
            const oldCol = grid[c];
            const targetHeight = exports.CAISHEN_REEL_HEIGHTS[c];
            const isMiddleReel = c >= 1 && c <= 4;
            const survivingTiles = [];
            for (let r = 0; r < oldCol.length; r++) {
                const tile = oldCol[r];
                const key = tile.block ?? tile.id;
                if (silverBlocks.has(key)) {
                    survivingTiles.push({
                        id: this.makeId(`tile_${c}`),
                        symbol: goldSymbolByBlock.get(key),
                        isGold: true,
                        isSilver: false,
                        frame: 'gold',
                        isTopReel: tile.isTopReel,
                        transformedToWild: false
                    });
                }
                else if (goldBlocks.has(key)) {
                    survivingTiles.push({
                        id: this.makeId(`tile_${c}`),
                        symbol: 'wild',
                        isGold: false,
                        isSilver: false,
                        frame: 'none',
                        isTopReel: tile.isTopReel,
                        transformedToWild: true
                    });
                }
                else if (winningTileIds.has(tile.id)) {
                    // Ô thắng thường vỡ (không survive).
                }
                else {
                    survivingTiles.push(tile);
                }
            }
            // Ô refill từ trên: ô đầu (top reel nếu cuộn giữa) là single,
            // phần còn lại dựng segment có thể chứa block mới.
            const missingCount = targetHeight - survivingTiles.length;
            const refillTop = this.buildColumn(c, missingCount, isMiddleReel, isMiddleReel).slice(0, missingCount);
            const finalColumn = [...refillTop, ...survivingTiles];
            newGrid.push(finalColumn);
        }
        return newGrid;
    }
}
exports.CaishenWinsEngine = CaishenWinsEngine;
