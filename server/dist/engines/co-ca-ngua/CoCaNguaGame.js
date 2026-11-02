"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoCaNguaGame = void 0;
const BaseGame_1 = require("../BaseGame");
const COLOR_STARTS = {
    red: 0,
    blue: 14,
    yellow: 28,
    green: 42
};
const COLOR_ORDER = ['red', 'blue', 'yellow', 'green'];
class CoCaNguaGame extends BaseGame_1.BaseGame {
    constructor(players, turnTimeLimit = 30) {
        const assignedPlayers = players.map((p, idx) => {
            const color = COLOR_ORDER[idx % COLOR_ORDER.length];
            const horses = [0, 1, 2, 3].map(hIdx => ({
                id: `${color}-${hIdx}`,
                color,
                status: 'stable'
            }));
            return {
                ...p,
                color,
                horses,
                hasRolled: false,
                lastDiceRoll: null
            };
        });
        super({
            gameType: 'co-ca-ngua',
            players: assignedPlayers,
            currentTurnIndex: 0,
            direction: 1,
            turnTimeLimit,
            turnStartTime: Date.now(),
            isGameOver: false,
            winners: [],
            logs: [],
            currentDice: null,
            diceRollsCount: 0
        });
    }
    start() {
        this.state.isGameOver = false;
        this.state.currentTurnIndex = 0;
        this.addLog('Trò chơi Cờ Cá Ngựa bắt đầu!', 'info');
        this.resetTurnTimer();
        this.emitStateChange();
    }
    handleAction(playerId, action) {
        if (this.state.isGameOver)
            return { success: false, message: 'Game over' };
        const currentPlayer = this.state.players[this.state.currentTurnIndex];
        if (!currentPlayer || currentPlayer.id !== playerId)
            return { success: false, message: 'Not your turn' };
        let success = false;
        switch (action.type) {
            case 'ROLL_DICE':
                success = this.rollDice(currentPlayer);
                break;
            case 'DEPLOY':
                success = this.deployHorse(currentPlayer, action.horseId);
                break;
            case 'MOVE_HORSE':
                success = this.moveHorse(currentPlayer, action.horseId);
                break;
            case 'SKIP_TURN':
                success = this.passTurn();
                break;
            default:
                return { success: false, message: 'Unknown action' };
        }
        return { success };
    }
    rollDice(player) {
        if (player.hasRolled && this.state.currentDice !== null)
            return false;
        // Roll standard 6-sided dice (1..6)
        const roll = Math.floor(Math.random() * 6) + 1;
        this.state.currentDice = roll;
        player.hasRolled = true;
        player.lastDiceRoll = roll;
        this.state.diceRollsCount++;
        this.logAction(`${player.name} lắc xúc xắc được ${roll} nút 🎲!`, 'info', player.id);
        // Check if player has any valid move
        const canDeploy = (roll === 6 || roll === 1) && player.horses.some(h => h.status === 'stable');
        const canMoveTrack = player.horses.some(h => h.status === 'track' || h.status === 'homestretch');
        if (!canDeploy && !canMoveTrack) {
            // Auto pass after short delay if no valid moves
            setTimeout(() => {
                if (this.state.players[this.state.currentTurnIndex]?.id === player.id) {
                    this.passTurn();
                }
            }, 1500);
        }
        this.emitStateChange();
        return true;
    }
    deployHorse(player, horseId) {
        if (!player.hasRolled || this.state.currentDice === null)
            return false;
        if (this.state.currentDice !== 6 && this.state.currentDice !== 1)
            return false;
        const horse = player.horses.find(h => h.id === horseId && h.status === 'stable');
        if (!horse)
            return false;
        const startPos = COLOR_STARTS[player.color];
        // Check if another horse is on starting tile
        const occupyingHorse = this.findHorseAtTrack(startPos);
        if (occupyingHorse) {
            if (occupyingHorse.color === player.color) {
                // Can't kick own horse
                return false;
            }
            else {
                // Kick opponent horse back to stable!
                occupyingHorse.status = 'stable';
                occupyingHorse.trackPos = undefined;
                this.logAction(`💥 ${player.name} xuất quân và ĐÁ văng ngựa đối thủ về chuồng!`, 'action', player.id);
            }
        }
        horse.status = 'track';
        horse.trackPos = startPos;
        this.logAction(`🐎 ${player.name} xuất quân ngựa ra bàn cờ!`, 'action', player.id);
        this.finishTurn(player);
        return true;
    }
    moveHorse(player, horseId) {
        if (!player.hasRolled || this.state.currentDice === null)
            return false;
        const horse = player.horses.find(h => h.id === horseId);
        if (!horse || horse.status === 'stable' || horse.status === 'goal')
            return false;
        const dice = this.state.currentDice;
        if (horse.status === 'track') {
            const startTile = COLOR_STARTS[player.color];
            const currentPos = horse.trackPos ?? 0;
            // Calculate steps traveled relative to start
            const stepsTraveled = (currentPos - startTile + 56) % 56;
            if (stepsTraveled + dice >= 56) {
                // Enters home stretch
                const stepInHomestretch = Math.min(6, (stepsTraveled + dice - 56) + 1);
                horse.status = stepInHomestretch >= 6 ? 'goal' : 'homestretch';
                horse.trackPos = undefined;
                horse.homestretchStep = stepInHomestretch;
                this.logAction(`🏆 Ngựa của ${player.name} tiến vào chuồng bậc ${stepInHomestretch}!`, 'action', player.id);
            }
            else {
                // Move along track
                const newPos = (currentPos + dice) % 56;
                const occupying = this.findHorseAtTrack(newPos);
                if (occupying) {
                    if (occupying.color === player.color) {
                        return false; // Can't kick own horse
                    }
                    // Kick opponent
                    occupying.status = 'stable';
                    occupying.trackPos = undefined;
                    this.logAction(`💥 ${player.name} ĐÁ văng ngựa đối thủ về chuồng!`, 'action', player.id);
                }
                horse.trackPos = newPos;
                this.logAction(`🐎 ${player.name} di chuyển ngựa thêm ${dice} bước.`, 'action', player.id);
            }
        }
        else if (horse.status === 'homestretch') {
            const currentStep = horse.homestretchStep ?? 1;
            const nextStep = currentStep + 1;
            if (dice === nextStep) {
                horse.homestretchStep = nextStep;
                if (nextStep >= 6) {
                    horse.status = 'goal';
                    this.logAction(`🌟 ${player.name} đưa ngựa về ĐÍCH thành công!`, 'win', player.id);
                }
                else {
                    this.logAction(`🐎 ${player.name} leo thang lên bậc ${nextStep}.`, 'action', player.id);
                }
            }
            else {
                return false;
            }
        }
        // Check Win Condition (e.g. 2 horses in goal wins)
        const goalsCount = player.horses.filter(h => h.status === 'goal').length;
        if (goalsCount >= 2) {
            this.state.isGameOver = true;
            this.state.winners = [player.id];
            this.logAction(`👑 CHÚC MỪNG ${player.name} ĐÃ GIÀNH CHIẾN THẮNG CỜ CÁ NGỰA!`, 'win', player.id);
            this.emitStateChange();
            return true;
        }
        this.finishTurn(player);
        return true;
    }
    finishTurn(player) {
        // If rolled 6, gets bonus roll; otherwise pass
        if (this.state.currentDice === 6) {
            player.hasRolled = false;
            this.state.currentDice = null;
            this.logAction(`🎲 ${player.name} lắc được 6 nên được thêm một lượt lắc!`, 'special', player.id);
            this.emitStateChange();
        }
        else {
            this.passTurn();
        }
    }
    passTurn() {
        const curPlayer = this.state.players[this.state.currentTurnIndex];
        if (curPlayer) {
            curPlayer.hasRolled = false;
            curPlayer.lastDiceRoll = null;
        }
        this.state.currentDice = null;
        this.state.currentTurnIndex = (this.state.currentTurnIndex + 1) % this.state.players.length;
        this.state.turnStartTime = Date.now();
        this.resetTurnTimer();
        this.emitStateChange();
        return true;
    }
    handleTurnTimeout() {
        const curPlayer = this.state.players[this.state.currentTurnIndex];
        if (!curPlayer || this.state.isGameOver)
            return;
        this.addLog(`${curPlayer.name} hết thời gian lượt chơi!`, 'warning', curPlayer.id);
        this.passTurn();
    }
    findHorseAtTrack(pos) {
        for (const p of this.state.players) {
            for (const h of p.horses) {
                if (h.status === 'track' && h.trackPos === pos) {
                    return h;
                }
            }
        }
        return undefined;
    }
    getMaskedState(playerId) {
        return this.state;
    }
    handleDisconnect(playerId) {
        const p = this.state.players.find(x => x.id === playerId);
        if (p) {
            p.connected = false;
            this.addLog(`${p.name} mất kết nối.`, 'warning', playerId);
            this.emitStateChange();
        }
    }
    handleReconnect(playerId) {
        const p = this.state.players.find(x => x.id === playerId);
        if (p) {
            p.connected = true;
            this.addLog(`${p.name} đã kết nối lại!`, 'info', playerId);
            this.emitStateChange();
        }
    }
    logAction(message, type, playerId) {
        this.state.logs.push({
            id: Math.random().toString(36).substring(2, 9),
            timestamp: Date.now(),
            message,
            type,
            playerId
        });
    }
}
exports.CoCaNguaGame = CoCaNguaGame;
