"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BattleEngine = void 0;
const events_1 = require("events");
const crypto_1 = __importDefault(require("crypto"));
const BOT_NAMES = [
    'Bot Alpha 🤖',
    'Bot Phoenix 🗡️',
    'Bot Cyber ⚡',
    'Bot Shadow 🥷',
    'Bot Dragon 🐉',
    'Bot Titan 🛡️',
    'Bot Viper 🐍'
];
const BOT_AVATARS = ['av-cat', 'av-fox', 'av-robot', 'av-dragon', 'av-ninja', 'av-tiger'];
class BattleEngine extends events_1.EventEmitter {
    userManager;
    caseEngine;
    rooms = new Map();
    constructor(userManager, caseEngine) {
        super();
        this.userManager = userManager;
        this.caseEngine = caseEngine;
    }
    listBattles() {
        const list = [];
        for (const room of this.rooms.values()) {
            list.push({
                id: room.id,
                creatorId: room.creatorId,
                maxPlayers: room.maxPlayers,
                mode: room.mode,
                caseIds: room.caseIds,
                totalCost: room.totalCost,
                playersCount: room.players.length,
                players: room.players.map(p => ({
                    id: p.id,
                    displayName: p.displayName,
                    avatar: p.avatar,
                    isBot: p.isBot
                })),
                status: room.status,
                currentRound: room.currentRound,
                totalRounds: room.totalRounds,
                winnerName: room.winnerName,
                createdAt: room.createdAt
            });
        }
        // Sort: waiting first, then starting/spinning, then finished (latest first)
        return list.sort((a, b) => {
            const order = { waiting: 0, starting: 1, spinning: 2, round_ended: 3, finished: 4 };
            if (order[a.status] !== order[b.status]) {
                return order[a.status] - order[b.status];
            }
            return b.createdAt - a.createdAt;
        });
    }
    getBattle(battleId) {
        return this.rooms.get(battleId) || null;
    }
    createBattle(creatorId, caseIds, maxPlayers, mode = 'standard') {
        const user = this.userManager.getUserById(creatorId);
        if (!user) {
            return { success: false, message: 'Người dùng không tồn tại.' };
        }
        if (![2, 3, 4].includes(maxPlayers)) {
            return { success: false, message: 'Số lượng người chơi phải là 2, 3 hoặc 4.' };
        }
        if (!Array.isArray(caseIds) || caseIds.length < 1 || caseIds.length > 50) {
            return { success: false, message: 'Danh sách hòm đấu phải từ 1 đến 50 hòm.' };
        }
        // Verify all cases exist and calculate totalCost
        let totalCost = 0;
        for (const cId of caseIds) {
            const cDef = this.caseEngine.getCaseById(cId);
            if (!cDef) {
                return { success: false, message: `Hòm ${cId} không hợp lệ.` };
            }
            totalCost += cDef.price;
        }
        const balance = this.userManager.getBalance(creatorId);
        if (balance < totalCost) {
            return {
                success: false,
                message: `Số dư không đủ! Cần ${totalCost.toLocaleString('vi-VN')} 🪙, bạn có ${balance.toLocaleString('vi-VN')} 🪙.`
            };
        }
        // Deduct creator entry cost
        const deductRes = this.userManager.deductBalance(creatorId, totalCost, `Tạo Case Battle (Vé ${totalCost} 🪙)`);
        if (!deductRes.success) {
            return { success: false, message: deductRes.message || 'Lỗi trừ tiền cược.' };
        }
        const battleId = 'BTL-' + crypto_1.default.randomBytes(3).toString('hex').toUpperCase();
        const creatorPlayer = {
            id: user.id,
            displayName: user.displayName,
            avatar: user.avatar || 'av-fox',
            isBot: false,
            totalValue: 0,
            drops: []
        };
        const room = {
            id: battleId,
            creatorId,
            maxPlayers,
            mode,
            caseIds,
            totalCost,
            players: [creatorPlayer],
            status: 'waiting',
            currentRound: 0,
            totalRounds: caseIds.length,
            roundsHistory: [],
            winnerId: null,
            allPrizes: [],
            createdAt: Date.now()
        };
        this.rooms.set(battleId, room);
        this.emit('battle:list-updated');
        return { success: true, battle: room };
    }
    joinBattle(battleId, userId) {
        const room = this.rooms.get(battleId);
        if (!room) {
            return { success: false, message: 'Phòng đấu không tồn tại.' };
        }
        if (room.status !== 'waiting') {
            return { success: false, message: 'Trận đấu đã bắt đầu hoặc đã kết thúc.' };
        }
        if (room.players.length >= room.maxPlayers) {
            return { success: false, message: 'Phòng đấu đã đủ người.' };
        }
        if (room.players.some(p => p.id === userId)) {
            return { success: false, message: 'Bạn đã ở trong phòng đấu này rồi.' };
        }
        const user = this.userManager.getUserById(userId);
        if (!user) {
            return { success: false, message: 'Người dùng không tồn tại.' };
        }
        const balance = this.userManager.getBalance(userId);
        if (balance < room.totalCost) {
            return {
                success: false,
                message: `Số dư không đủ! Cần ${room.totalCost.toLocaleString('vi-VN')} 🪙, bạn có ${balance.toLocaleString('vi-VN')} 🪙.`
            };
        }
        // Deduct entry cost
        const deductRes = this.userManager.deductBalance(userId, room.totalCost, `Tham gia Case Battle ${room.id}`);
        if (!deductRes.success) {
            return { success: false, message: deductRes.message || 'Lỗi trừ tiền cược.' };
        }
        const newPlayer = {
            id: user.id,
            displayName: user.displayName,
            avatar: user.avatar || 'av-cat',
            isBot: false,
            totalValue: 0,
            drops: []
        };
        room.players.push(newPlayer);
        this.emit('battle:updated', room);
        this.emit('battle:list-updated');
        // Auto start if full
        if (room.players.length === room.maxPlayers) {
            this.startBattle(room.id);
        }
        return { success: true, battle: room };
    }
    addBot(battleId, requesterId) {
        const room = this.rooms.get(battleId);
        if (!room) {
            return { success: false, message: 'Phòng đấu không tồn tại.' };
        }
        if (room.status !== 'waiting') {
            return { success: false, message: 'Không thể thêm bot khi trận đã bắt đầu.' };
        }
        if (room.players.length >= room.maxPlayers) {
            return { success: false, message: 'Phòng đấu đã đầy.' };
        }
        // Pick bot name not currently in room
        const existingNames = new Set(room.players.map(p => p.displayName));
        const availableNames = BOT_NAMES.filter(n => !existingNames.has(n));
        const botName = availableNames[0] || `Bot ${room.players.length + 1} 🤖`;
        const botAvatar = BOT_AVATARS[room.players.length % BOT_AVATARS.length];
        const botPlayer = {
            id: 'bot_' + crypto_1.default.randomBytes(3).toString('hex'),
            displayName: botName,
            avatar: botAvatar,
            isBot: true,
            totalValue: 0,
            drops: []
        };
        room.players.push(botPlayer);
        this.emit('battle:updated', room);
        this.emit('battle:list-updated');
        // Auto start if full
        if (room.players.length === room.maxPlayers) {
            this.startBattle(room.id);
        }
        return { success: true, battle: room };
    }
    cancelBattle(battleId, requesterId) {
        const room = this.rooms.get(battleId);
        if (!room) {
            return { success: false, message: 'Phòng đấu không tồn tại.' };
        }
        if (room.creatorId !== requesterId) {
            return { success: false, message: 'Chỉ chủ phòng mới có quyền hủy phòng.' };
        }
        if (room.status !== 'waiting') {
            return { success: false, message: 'Trận đấu đang diễn ra, không thể hủy.' };
        }
        // Refund all human players
        for (const p of room.players) {
            if (!p.isBot) {
                this.userManager.addBalance(p.id, room.totalCost, `Hoàn tiền hủy Case Battle ${room.id}`);
            }
        }
        this.rooms.delete(battleId);
        this.emit('battle:cancelled', { battleId });
        this.emit('battle:list-updated');
        return { success: true };
    }
    startBattle(battleId) {
        const room = this.rooms.get(battleId);
        if (!room || room.status !== 'waiting')
            return;
        room.status = 'starting';
        this.emit('battle:updated', room);
        this.emit('battle:list-updated');
        // 3 second countdown before first round
        setTimeout(() => {
            this.runRound(battleId, 0);
        }, 3000);
    }
    runRound(battleId, roundIndex) {
        const room = this.rooms.get(battleId);
        if (!room)
            return;
        const caseId = room.caseIds[roundIndex];
        const caseDef = this.caseEngine.getCaseById(caseId);
        if (!caseDef)
            return;
        room.status = 'spinning';
        room.currentRound = roundIndex + 1;
        // Roll item and tape for every player
        const playerTapes = {};
        for (const player of room.players) {
            const roll = this.caseEngine.rollItemForBattle(caseId);
            if (roll) {
                playerTapes[player.id] = {
                    tape: roll.tape,
                    winningIndex: roll.winningIndex,
                    wonItem: roll.wonTemplate
                };
            }
        }
        const roundData = {
            roundIndex: roundIndex + 1,
            caseId: caseDef.id,
            caseName: caseDef.name,
            casePrice: caseDef.price,
            caseIcon: caseDef.icon,
            playerTapes
        };
        room.roundsHistory.push(roundData);
        // Broadcast spin start to all clients
        this.emit('battle:round-start', {
            battleId: room.id,
            roundData,
            room
        });
        // Roulette tape animation takes ~4.5 seconds on client
        setTimeout(() => {
            // Accumulate round scores and inventory items
            for (const player of room.players) {
                const tapeInfo = playerTapes[player.id];
                if (tapeInfo) {
                    player.totalValue += tapeInfo.wonItem.value;
                    const droppedItem = {
                        id: 'item_' + crypto_1.default.randomBytes(4).toString('hex'),
                        itemId: tapeInfo.wonItem.itemId,
                        name: tapeInfo.wonItem.name,
                        rarity: tapeInfo.wonItem.rarity,
                        value: tapeInfo.wonItem.value,
                        icon: tapeInfo.wonItem.icon,
                        caseType: caseDef.id,
                        obtainedAt: Date.now()
                    };
                    player.drops.push(droppedItem);
                    room.allPrizes.push(droppedItem);
                }
            }
            room.status = 'round_ended';
            this.emit('battle:round-end', {
                battleId: room.id,
                roundIndex: roundIndex + 1,
                players: room.players,
                room
            });
            // Pause 2.5s for users to see round results
            setTimeout(() => {
                if (roundIndex + 1 < room.totalRounds) {
                    this.runRound(battleId, roundIndex + 1);
                }
                else {
                    this.finishBattle(battleId);
                }
            }, 2500);
        }, 4500);
    }
    finishBattle(battleId) {
        const room = this.rooms.get(battleId);
        if (!room)
            return;
        room.status = 'finished';
        // Determine winner based on mode
        let winner;
        if (room.mode === 'crazy') {
            // Crazy Mode: Lowest totalValue wins!
            winner = [...room.players].sort((a, b) => a.totalValue - b.totalValue)[0];
        }
        else {
            // Standard Mode: Highest totalValue wins!
            winner = [...room.players].sort((a, b) => b.totalValue - a.totalValue)[0];
        }
        room.winnerId = winner.id;
        room.winnerName = winner.displayName;
        // Award ALL prizes from all players to the winner (if human)
        if (!winner.isBot) {
            for (const item of room.allPrizes) {
                this.userManager.addItemToInventory(winner.id, {
                    itemId: item.itemId,
                    name: item.name,
                    rarity: item.rarity,
                    value: item.value,
                    icon: item.icon,
                    caseType: item.caseType
                });
            }
        }
        this.emit('battle:finished', {
            battleId: room.id,
            winner,
            allPrizes: room.allPrizes,
            room
        });
        this.emit('battle:updated', room);
        this.emit('battle:list-updated');
    }
}
exports.BattleEngine = BattleEngine;
