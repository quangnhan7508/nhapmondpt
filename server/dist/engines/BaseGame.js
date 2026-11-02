"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseGame = void 0;
const crypto_1 = __importDefault(require("crypto"));
class BaseGame {
    state;
    turnTimer = null;
    onStateChangeCallback;
    onPrivateMessageCallback;
    onGameOverCallback;
    constructor(state) {
        this.state = state;
    }
    setCallbacks(callbacks) {
        this.onStateChangeCallback = callbacks.onStateChange;
        this.onPrivateMessageCallback = callbacks.onPrivateMessage;
        this.onGameOverCallback = callbacks.onGameOver;
    }
    emitStateChange() {
        if (this.onStateChangeCallback) {
            this.onStateChangeCallback();
        }
    }
    emitPrivateMessage(playerId, event, payload) {
        if (this.onPrivateMessageCallback) {
            this.onPrivateMessageCallback(playerId, event, payload);
        }
    }
    emitGameOver(winners) {
        this.clearTurnTimer();
        this.state.isGameOver = true;
        this.state.winners = winners;
        if (this.onGameOverCallback) {
            this.onGameOverCallback(winners);
        }
        this.emitStateChange();
    }
    addLog(message, type = 'info', playerId) {
        const entry = {
            id: crypto_1.default.randomUUID(),
            timestamp: Date.now(),
            message,
            type,
            playerId
        };
        this.state.logs.push(entry);
        // Keep max 100 log entries
        if (this.state.logs.length > 100) {
            this.state.logs.shift();
        }
    }
    /**
     * Cryptographically secure Fisher-Yates shuffle
     */
    static shuffleDeck(deck) {
        const shuffled = [...deck];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = crypto_1.default.randomInt(0, i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    /**
     * Turn timer management
     */
    resetTurnTimer() {
        this.clearTurnTimer();
        if (this.state.isGameOver)
            return;
        this.state.turnStartTime = Date.now();
        this.turnTimer = setTimeout(() => {
            this.handleTurnTimeout();
        }, this.state.turnTimeLimit * 1000);
        if (this.turnTimer && typeof this.turnTimer.unref === 'function') {
            this.turnTimer.unref();
        }
    }
    clearTurnTimer() {
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
            this.turnTimer = null;
        }
    }
    getCurrentPlayer() {
        return this.state.players[this.state.currentTurnIndex];
    }
    getNextPlayerIndex(skipCount = 1) {
        const activePlayers = this.state.players;
        const total = activePlayers.length;
        let index = this.state.currentTurnIndex;
        const steps = Math.max(1, Math.abs(skipCount));
        let count = 0;
        while (count < steps) {
            index = (index + this.state.direction + total) % total;
            // Skip eliminated players if any
            if (!activePlayers[index].eliminated) {
                count++;
            }
            // Safety guard against infinite loops
            if (count > total * 2)
                break;
        }
        return index;
    }
}
exports.BaseGame = BaseGame;
