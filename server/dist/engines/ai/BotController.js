"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotController = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ExplodingKittensGame_1 = require("../exploding-kittens/ExplodingKittensGame");
const TienLenGame_1 = require("../tien-len/TienLenGame");
const UnoGame_1 = require("../uno/UnoGame");
const CoVuaGame_1 = require("../co-vua/CoVuaGame");
const CoTuongGame_1 = require("../co-tuong/CoTuongGame");
const SamGame_1 = require("../sam/SamGame");
const ExplodingKittensBotStrategy_1 = require("./strategies/ExplodingKittensBotStrategy");
const TienLenBotStrategy_1 = require("./strategies/TienLenBotStrategy");
const UnoBotStrategy_1 = require("./strategies/UnoBotStrategy");
const SamBotStrategy_1 = require("./strategies/SamBotStrategy");
class BotController {
    game;
    botIds;
    pendingTimer = null;
    destroyed = false;
    constructor(game, botIds) {
        this.game = game;
        this.botIds = new Set(botIds);
    }
    updateBotList(botIds) {
        this.botIds = new Set(botIds);
    }
    notifyStateChange() {
        if (this.destroyed || this.game.state.isGameOver) {
            this.clearPendingAction();
            return;
        }
        // Clear any existing scheduled bot turn to debounce
        if (this.pendingTimer) {
            clearTimeout(this.pendingTimer);
            this.pendingTimer = null;
        }
        // Check if any bot needs to act
        const botToAct = this.determineBotAction();
        if (!botToAct)
            return;
        // Simulate natural human reaction time: 1000ms - 1800ms
        const delay = crypto_1.default.randomInt(1000, 1800);
        this.pendingTimer = setTimeout(() => {
            this.pendingTimer = null;
            if (this.destroyed || this.game.state.isGameOver)
                return;
            this.executeBotTurn(botToAct.botId, botToAct.actionType);
        }, delay);
    }
    determineBotAction() {
        // 1. Exploding Kittens checks
        if (this.game instanceof ExplodingKittensGame_1.ExplodingKittensGame) {
            const state = this.game.state;
            // Defusal emergency takes immediate priority
            if (state.pendingDefusal && this.botIds.has(state.pendingDefusal.playerId)) {
                return { botId: state.pendingDefusal.playerId, actionType: 'reaction' };
            }
            // Favor request pending
            if (state.pendingFavor && this.botIds.has(state.pendingFavor.fromPlayerId)) {
                return { botId: state.pendingFavor.fromPlayerId, actionType: 'reaction' };
            }
            // Nope window active: see if any bot wants to Nope
            if (state.pendingAction) {
                for (const botId of this.botIds) {
                    if (state.pendingAction.initiatorId !== botId) {
                        return { botId, actionType: 'reaction' };
                    }
                }
            }
        }
        // 2. UNO checks
        if (this.game instanceof UnoGame_1.UnoGame) {
            // Uno catch opportunities
            for (const botId of this.botIds) {
                const masked = this.game.getMaskedState(botId);
                if (masked.canCatchUno && masked.canCatchUno.length > 0) {
                    return { botId, actionType: 'reaction' };
                }
            }
        }
        // 3. Sâm checks
        if (this.game instanceof SamGame_1.SamGame) {
            if (this.game.state.phase === 'bao_sam') {
                for (const botId of this.botIds) {
                    const p = this.game.state.players.find(x => x.id === botId);
                    if (p && !p.hasPassedCurrentRound && !p.hasBaoSamResponded) {
                        return { botId, actionType: 'reaction' };
                    }
                }
            }
        }
        // 4. Regular active turn
        const currentPlayer = this.game.getCurrentPlayer();
        if (currentPlayer && this.botIds.has(currentPlayer.id) && !currentPlayer.eliminated) {
            return { botId: currentPlayer.id, actionType: 'turn' };
        }
        return null;
    }
    executeBotTurn(botId, actionType) {
        try {
            if (this.game instanceof UnoGame_1.UnoGame) {
                UnoBotStrategy_1.UnoBotStrategy.decideAction(botId, this.game);
            }
            else if (this.game instanceof ExplodingKittensGame_1.ExplodingKittensGame) {
                ExplodingKittensBotStrategy_1.ExplodingKittensBotStrategy.decideAction(botId, this.game);
            }
            else if (this.game instanceof TienLenGame_1.TienLenGame) {
                TienLenBotStrategy_1.TienLenBotStrategy.decideAction(botId, this.game);
            }
            else if (this.game instanceof SamGame_1.SamGame) {
                SamBotStrategy_1.SamBotStrategy.decideAction(botId, this.game);
            }
            else if (this.game instanceof CoVuaGame_1.CoVuaGame) {
                const botPlayer = this.game.state.players.find(p => p.id === botId);
                if (botPlayer && botPlayer.color === this.game.state.activeColor) {
                    const legalMoves = this.game.getAllLegalMoves(botPlayer.color);
                    if (legalMoves.length > 0) {
                        // Prioritize capturing opponent pieces
                        const captures = legalMoves.filter(m => {
                            const target = this.game.state.board[m.to.r][m.to.c];
                            return target && target.color !== botPlayer.color;
                        });
                        const selected = captures.length > 0
                            ? captures[Math.floor(Math.random() * captures.length)]
                            : legalMoves[Math.floor(Math.random() * legalMoves.length)];
                        this.game.handleAction(botId, {
                            type: 'MOVE_PIECE',
                            from: selected.from,
                            to: selected.to
                        });
                    }
                }
            }
            else if (this.game instanceof CoTuongGame_1.CoTuongGame) {
                const botPlayer = this.game.state.players.find(p => p.id === botId);
                if (botPlayer && botPlayer.color === this.game.state.activeColor) {
                    const legalMoves = this.game.getAllLegalMoves(botPlayer.color);
                    if (legalMoves.length > 0) {
                        // Prioritize captures
                        const captures = legalMoves.filter(m => {
                            const target = this.game.state.board[m.to.r][m.to.c];
                            return target && target.color !== botPlayer.color;
                        });
                        const selected = captures.length > 0
                            ? captures[Math.floor(Math.random() * captures.length)]
                            : legalMoves[Math.floor(Math.random() * legalMoves.length)];
                        this.game.handleAction(botId, {
                            type: 'MOVE_PIECE',
                            from: selected.from,
                            to: selected.to
                        });
                    }
                }
            }
        }
        catch (err) {
            console.error(`[BotController] Error executing bot ${botId}:`, err);
        }
    }
    clearPendingAction() {
        if (this.pendingTimer) {
            clearTimeout(this.pendingTimer);
            this.pendingTimer = null;
        }
    }
    destroy() {
        this.destroyed = true;
        this.clearPendingAction();
    }
}
exports.BotController = BotController;
