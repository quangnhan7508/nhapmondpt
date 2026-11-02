"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinesEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
class MinesEngine {
    sessions = new Map(); // gameId -> session
    userGames = new Map(); // userId -> active gameId
    userManager;
    globalNonce = 0;
    constructor(userManager) { this.userManager = userManager; }
    // Calculate multiplier for k revealed stars with M mines
    calculateMultiplier(mineCount, revealedCount) {
        if (revealedCount === 0)
            return 1;
        let product = 1;
        for (let i = 0; i < revealedCount; i++) {
            product *= (25 - i) / (25 - mineCount - i);
        }
        return Math.floor(0.97 * product * 100) / 100;
    }
    // Generate mine positions using SHA-512 + Fisher-Yates
    generateMinePositions(serverSeed, clientSeed, nonce, mineCount) {
        const combined = `${serverSeed}:${clientSeed}:${nonce}`;
        const hash = crypto_1.default.createHash('sha512').update(combined).digest('hex');
        // Fisher-Yates shuffle using hash bytes
        const indices = Array.from({ length: 25 }, (_, i) => i);
        for (let i = 24; i > 0; i--) {
            const byteOffset = ((24 - i) * 4) % 128; // 128 hex chars in sha512
            const val = parseInt(hash.substring(byteOffset, byteOffset + 8), 16);
            const j = val % (i + 1);
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        return new Set(indices.slice(0, mineCount));
    }
    startGame(userId, betAmount, mineCount, clientSeed) {
        // Validate
        if (mineCount < 1 || mineCount > 24)
            return { success: false, message: 'Số bom phải từ 1 đến 24' };
        if (betAmount < 10)
            return { success: false, message: 'Cược tối thiểu 10 🪙' };
        if (betAmount > 5000)
            return { success: false, message: 'Cược tối đa 5,000 🪙' };
        // Check if user already has active game
        const existingGameId = this.userGames.get(userId);
        if (existingGameId && this.sessions.has(existingGameId)) {
            return { success: false, message: 'Bạn đang có ván chơi đang mở. Hãy hoàn thành hoặc cash out trước.' };
        }
        // Deduct balance
        const deductResult = this.userManager.deductBalance(userId, betAmount, `Mines bet (${mineCount} bombs)`);
        if (!deductResult.success)
            return { success: false, message: deductResult.message };
        // Generate seeds
        const serverSeed = crypto_1.default.randomBytes(32).toString('hex');
        const cSeed = clientSeed || crypto_1.default.randomBytes(16).toString('hex');
        const nonce = ++this.globalNonce;
        const seedHash = crypto_1.default.createHash('sha256').update(serverSeed).digest('hex');
        const minePositions = this.generateMinePositions(serverSeed, cSeed, nonce, mineCount);
        const gameId = crypto_1.default.randomUUID();
        const session = {
            gameId, userId, betAmount, mineCount,
            serverSeed, clientSeed: cSeed, nonce, seedHash,
            minePositions,
            revealedTiles: new Set(),
            currentMultiplier: 1,
            isGameOver: false, isWin: false,
            createdAt: Date.now()
        };
        this.sessions.set(gameId, session);
        this.userGames.set(userId, gameId);
        return { success: true, state: this.toPublicState(session) };
    }
    revealTile(gameId, tileIndex) {
        const session = this.sessions.get(gameId);
        if (!session)
            return { success: false, message: 'Game not found' };
        if (session.isGameOver)
            return { success: false, message: 'Game đã kết thúc' };
        if (tileIndex < 0 || tileIndex > 24)
            return { success: false, message: 'Invalid tile' };
        if (session.revealedTiles.has(tileIndex))
            return { success: false, message: 'Ô này đã mở rồi' };
        session.revealedTiles.add(tileIndex);
        if (session.minePositions.has(tileIndex)) {
            // Hit a mine!
            session.isGameOver = true;
            session.isWin = false;
            session.currentMultiplier = 0;
            this.userGames.delete(session.userId);
            return { success: true, state: this.toPublicState(session, true) };
        }
        // Safe tile
        const safeCount = session.revealedTiles.size;
        session.currentMultiplier = this.calculateMultiplier(session.mineCount, safeCount);
        // Check if all safe tiles revealed
        const totalSafe = 25 - session.mineCount;
        if (safeCount >= totalSafe) {
            // Auto cash out - max win!
            session.isGameOver = true;
            session.isWin = true;
            session.cashOutMultiplier = session.currentMultiplier;
            const payout = Math.floor(session.betAmount * session.currentMultiplier);
            this.userManager.addBalance(session.userId, payout, `Mines max win x${session.currentMultiplier}`);
            this.userGames.delete(session.userId);
            return { success: true, state: this.toPublicState(session, true) };
        }
        return { success: true, state: this.toPublicState(session) };
    }
    cashOut(gameId) {
        const session = this.sessions.get(gameId);
        if (!session)
            return { success: false, message: 'Game not found' };
        if (session.isGameOver)
            return { success: false, message: 'Game đã kết thúc' };
        if (session.revealedTiles.size === 0)
            return { success: false, message: 'Phải mở ít nhất 1 ô trước khi rút tiền' };
        session.isGameOver = true;
        session.isWin = true;
        session.cashOutMultiplier = session.currentMultiplier;
        const payout = Math.floor(session.betAmount * session.currentMultiplier);
        this.userManager.addBalance(session.userId, payout, `Mines cash out x${session.currentMultiplier}`);
        this.userGames.delete(session.userId);
        return { success: true, state: this.toPublicState(session, true), payout };
    }
    getActiveGame(userId) {
        const gameId = this.userGames.get(userId);
        if (!gameId)
            return null;
        const session = this.sessions.get(gameId);
        if (!session)
            return null;
        return this.toPublicState(session);
    }
    // Pre-compute multiplier table for display
    getMultiplierTable(mineCount) {
        const safeTiles = 25 - mineCount;
        const table = [];
        for (let k = 1; k <= safeTiles; k++) {
            table.push(this.calculateMultiplier(mineCount, k));
        }
        return table;
    }
    toPublicState(session, revealAll = false) {
        const grid = Array(25).fill('hidden');
        for (const idx of session.revealedTiles) {
            grid[idx] = session.minePositions.has(idx) ? 'mine' : 'star';
        }
        if (revealAll && session.isGameOver) {
            for (let i = 0; i < 25; i++) {
                if (!session.revealedTiles.has(i)) {
                    grid[i] = session.minePositions.has(i) ? 'mine' : 'star';
                }
            }
        }
        const safeCount = 25 - session.mineCount;
        const nextMultiplier = session.revealedTiles.size < safeCount && !session.isGameOver
            ? this.calculateMultiplier(session.mineCount, session.revealedTiles.size + 1)
            : session.currentMultiplier;
        const state = {
            gameId: session.gameId,
            seedHash: session.seedHash,
            mineCount: session.mineCount,
            betAmount: session.betAmount,
            grid,
            revealedCount: session.revealedTiles.size,
            currentMultiplier: session.currentMultiplier,
            currentPayout: Math.floor(session.betAmount * session.currentMultiplier),
            nextMultiplier,
            isGameOver: session.isGameOver,
            isWin: session.isWin
        };
        // Reveal seeds when game is over
        if (session.isGameOver) {
            state.serverSeed = session.serverSeed;
            state.clientSeed = session.clientSeed;
            state.nonce = session.nonce;
        }
        return state;
    }
}
exports.MinesEngine = MinesEngine;
