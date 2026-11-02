"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoalsEngine = void 0;
const crypto = __importStar(require("crypto"));
const types_1 = require("./types");
class GoalsEngine {
    userManager;
    sessions = new Map();
    userGames = new Map();
    constructor(userManager) {
        this.userManager = userManager;
    }
    startGame(userId, betAmount, fieldSize, clientSeed) {
        if (betAmount <= 0) {
            throw new Error('Số tiền cược không hợp lệ.');
        }
        if (this.userGames.has(userId)) {
            throw new Error('Bạn đang có một trò chơi đang diễn ra.');
        }
        const hasBalance = this.userManager.deductBalance(userId, betAmount, `Goals bet (${fieldSize})`);
        if (!hasBalance.success) {
            throw new Error(hasBalance.message || 'Số dư không đủ.');
        }
        const { rows, columns } = types_1.FIELD_CONFIGS[fieldSize];
        const gameId = crypto.randomUUID();
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const finalClientSeed = clientSeed || crypto.randomBytes(16).toString('hex');
        const nonce = 1;
        const seedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
        const bombPositions = this.generateBombPositions(serverSeed, finalClientSeed, nonce, rows, columns);
        const session = {
            gameId,
            userId,
            betAmount,
            fieldSize,
            rows,
            columns,
            serverSeed,
            clientSeed: finalClientSeed,
            nonce,
            seedHash,
            bombPositions,
            currentColumn: 0,
            revealedColumns: new Map(),
            currentMultiplier: 1.0,
            isGameOver: false,
            isWin: false,
            createdAt: Date.now()
        };
        this.sessions.set(gameId, session);
        this.userGames.set(userId, gameId);
        return this.toPublicState(session);
    }
    selectRow(gameId, rowIndex) {
        const session = this.sessions.get(gameId);
        if (!session) {
            throw new Error('Không tìm thấy trò chơi.');
        }
        if (session.isGameOver) {
            throw new Error('Trò chơi đã kết thúc.');
        }
        if (rowIndex < 0 || rowIndex >= session.rows) {
            throw new Error('Hàng được chọn không hợp lệ.');
        }
        const currentColumn = session.currentColumn;
        const bombRow = session.bombPositions[currentColumn];
        session.revealedColumns.set(currentColumn, rowIndex);
        if (bombRow === rowIndex) {
            // Hit bomb
            session.isGameOver = true;
            session.isWin = false;
            this.userGames.delete(session.userId);
            return this.toPublicState(session);
        }
        // Safe
        session.currentColumn += 1;
        session.currentMultiplier = this.calculateMultiplier(session.rows, session.currentColumn);
        // Check if auto cash out (all columns cleared)
        if (session.currentColumn === session.columns) {
            session.isGameOver = true;
            session.isWin = true;
            session.cashOutMultiplier = session.currentMultiplier;
            const payout = Math.floor(session.betAmount * session.currentMultiplier);
            this.userManager.addBalance(session.userId, payout, `Goals max win x${session.currentMultiplier}`);
            this.userGames.delete(session.userId);
        }
        return this.toPublicState(session);
    }
    cashOut(gameId) {
        const session = this.sessions.get(gameId);
        if (!session) {
            throw new Error('Không tìm thấy trò chơi.');
        }
        if (session.isGameOver) {
            throw new Error('Trò chơi đã kết thúc.');
        }
        if (session.currentColumn === 0) {
            throw new Error('Bạn chưa đi qua cột nào.');
        }
        session.isGameOver = true;
        session.isWin = true;
        session.cashOutMultiplier = session.currentMultiplier;
        const payout = Math.floor(session.betAmount * session.currentMultiplier);
        this.userManager.addBalance(session.userId, payout, `Goals cash out x${session.currentMultiplier}`);
        this.userGames.delete(session.userId);
        return this.toPublicState(session);
    }
    getActiveGame(userId) {
        const gameId = this.userGames.get(userId);
        if (!gameId) {
            return null;
        }
        const session = this.sessions.get(gameId);
        if (!session) {
            return null;
        }
        return this.toPublicState(session);
    }
    calculateMultiplier(rows, columnsCleared) {
        if (columnsCleared === 0)
            return 1.0;
        // Multiplier formula: floor(0.97 × (R/(R-1))^k × 100) / 100
        const R = rows;
        const k = columnsCleared;
        const raw = 0.97 * Math.pow(R / (R - 1), k);
        return Math.floor(raw * 100) / 100;
    }
    generateBombPositions(serverSeed, clientSeed, nonce, rows, columns) {
        const message = `${serverSeed}:${clientSeed}:${nonce}`;
        const hash = crypto.createHash('sha512').update(message).digest('hex');
        const bombPositions = [];
        for (let c = 0; c < columns; c++) {
            // For each column c, extract 4 bytes from SHA-512 hash at offset c*4
            const hexChunk = hash.substring(c * 8, c * 8 + 8);
            const value = parseInt(hexChunk, 16);
            bombPositions.push(value % rows);
        }
        return bombPositions;
    }
    toPublicState(session) {
        const grid = [];
        for (let c = 0; c < session.columns; c++) {
            grid[c] = [];
            for (let r = 0; r < session.rows; r++) {
                if (session.isGameOver) {
                    if (session.bombPositions[c] === r) {
                        grid[c][r] = 'bomb';
                    }
                    else {
                        const revealedRow = session.revealedColumns.get(c);
                        if (revealedRow === r) {
                            grid[c][r] = 'safe';
                        }
                        else {
                            grid[c][r] = 'hidden';
                        }
                    }
                }
                else {
                    if (c < session.currentColumn) {
                        const revealedRow = session.revealedColumns.get(c);
                        if (revealedRow === r) {
                            grid[c][r] = 'safe';
                        }
                        else {
                            grid[c][r] = 'hidden';
                        }
                    }
                    else {
                        grid[c][r] = 'hidden';
                    }
                }
            }
        }
        return {
            gameId: session.gameId,
            seedHash: session.seedHash,
            fieldSize: session.fieldSize,
            rows: session.rows,
            columns: session.columns,
            betAmount: session.betAmount,
            grid,
            currentColumn: session.currentColumn,
            currentMultiplier: session.currentMultiplier,
            currentPayout: session.betAmount * session.currentMultiplier,
            nextMultiplier: session.currentColumn < session.columns
                ? this.calculateMultiplier(session.rows, session.currentColumn + 1)
                : session.currentMultiplier,
            isGameOver: session.isGameOver,
            isWin: session.isWin,
            serverSeed: session.isGameOver ? session.serverSeed : undefined,
            clientSeed: session.isGameOver ? session.clientSeed : undefined,
            nonce: session.isGameOver ? session.nonce : undefined
        };
    }
}
exports.GoalsEngine = GoalsEngine;
