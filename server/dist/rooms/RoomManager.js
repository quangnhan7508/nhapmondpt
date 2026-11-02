"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomManager = exports.DEFAULT_ROOM_BET = exports.MAX_ROOM_BET = exports.MIN_ROOM_BET = void 0;
exports.sanitizeRoomBet = sanitizeRoomBet;
const crypto_1 = __importDefault(require("crypto"));
const BotController_1 = require("../engines/ai/BotController");
const ExplodingKittensGame_1 = require("../engines/exploding-kittens/ExplodingKittensGame");
const TienLenGame_1 = require("../engines/tien-len/TienLenGame");
const CoCaNguaGame_1 = require("../engines/co-ca-ngua/CoCaNguaGame");
const CoVuaGame_1 = require("../engines/co-vua/CoVuaGame");
const CoTuongGame_1 = require("../engines/co-tuong/CoTuongGame");
const SamGame_1 = require("../engines/sam/SamGame");
const UnoGame_1 = require("../engines/uno/UnoGame");
exports.MIN_ROOM_BET = 0;
exports.MAX_ROOM_BET = 5000;
exports.DEFAULT_ROOM_BET = 0;
function sanitizeRoomBet(raw) {
    const amt = Math.floor(Number(raw));
    if (Number.isNaN(amt) || amt < 0)
        return 0;
    return Math.min(exports.MAX_ROOM_BET, amt);
}
const BOT_NAMES = [
    '🤖 ByteBot', '🐱 MeowTron', '🃏 JokerAI', '⚡ QuickSilver',
    '🔥 NeoStrike', '🎯 Bullseye', '🎲 LuckyBot', '🐉 DragonMind'
];
const BOT_AVATARS = [
    'bot-1', 'bot-2', 'bot-3', 'bot-4', 'cat-1', 'cat-2', 'ninja', 'wizard'
];
class RoomManager {
    rooms = new Map();
    sessionToRoomMap = new Map();
    createRoom(hostSessionId, hostName, hostAvatar, socketId, userId, betAmount, gameType) {
        const roomId = this.generateRoomCode();
        const hostId = crypto_1.default.randomUUID();
        const hostPlayer = {
            id: hostId,
            sessionId: hostSessionId,
            userId,
            name: hostName || 'Player 1',
            avatar: hostAvatar || 'avatar-1',
            isHost: true,
            isBot: false,
            isReady: true,
            connected: true,
            socketId
        };
        const room = {
            id: roomId,
            hostId,
            players: [hostPlayer],
            settings: {
                gameType: gameType || 'uno',
                turnTimeLimit: 30,
                unoMode: 'classic',
                unoRules: {
                    freeStacking: true,
                    jumpIn: true,
                    sevenZero: true,
                    unoPenalty: true,
                    mercyLimit: 25,
                    drawToMatch: false
                },
                tienLenFirstTurnRule: true,
                tienLenCutTwoRule: true,
                ekExpansions: {
                    implodingKittens: false,
                    streakingKittens: false,
                    barkingKittens: false,
                    timebombMode: false
                },
                // Phòng luôn tính phí: cược tối thiểu MIN_ROOM_BET, mặc định DEFAULT_ROOM_BET
                betAmount: sanitizeRoomBet(betAmount)
            },
            inGame: false,
            gameInstance: null,
            botController: null,
            chatMessages: [
                {
                    id: crypto_1.default.randomUUID(),
                    senderId: 'system',
                    senderName: 'System',
                    text: `Room ${roomId} created. Welcome!`,
                    timestamp: Date.now(),
                    isSystem: true
                }
            ],
            createdAt: Date.now(),
            paidUsers: {}
        };
        this.rooms.set(roomId, room);
        this.sessionToRoomMap.set(hostSessionId, roomId);
        return room;
    }
    joinRoom(roomId, sessionId, playerName, avatar, socketId, userId) {
        const room = this.rooms.get(roomId.toUpperCase());
        if (!room) {
            return { success: false, message: 'Room not found.' };
        }
        // Check if player is reconnecting with existing sessionId
        const existing = room.players.find(p => p.sessionId === sessionId);
        if (existing) {
            existing.connected = true;
            existing.socketId = socketId;
            if (userId)
                existing.userId = userId;
            if (playerName)
                existing.name = playerName;
            if (avatar)
                existing.avatar = avatar;
            if (room.gameInstance) {
                room.gameInstance.handleReconnect(existing.id);
            }
            this.addChatMessage(room.id, 'System', `${existing.name} reconnected.`, true);
            return { success: true, room, player: existing };
        }
        // New player joining
        if (room.inGame) {
            return { success: false, message: 'Game in this room is already in progress.' };
        }
        const maxAllowed = this.getMaxCapacity(room);
        if (room.players.length >= maxAllowed) {
            return { success: false, message: `Phòng đã đầy cho ${room.settings.gameType.toUpperCase()} (Tối đa ${maxAllowed} người chơi). Bật thêm bản mở rộng để tăng sức chứa phòng!` };
        }
        const newPlayer = {
            id: crypto_1.default.randomUUID(),
            sessionId,
            userId,
            name: playerName || `Player ${room.players.length + 1}`,
            avatar: avatar || `avatar-${(room.players.length % 6) + 1}`,
            isHost: false,
            isBot: false,
            isReady: false,
            connected: true,
            socketId
        };
        room.players.push(newPlayer);
        this.sessionToRoomMap.set(sessionId, room.id);
        this.addChatMessage(room.id, 'System', `${newPlayer.name} joined the room.`, true);
        return { success: true, room, player: newPlayer };
    }
    addBot(roomId, requesterId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return { success: false, message: 'Room not found.' };
        if (room.hostId !== requesterId)
            return { success: false, message: 'Only the host can add bots.' };
        if (room.inGame)
            return { success: false, message: 'Cannot add bots while game is running.' };
        const maxAllowed = this.getMaxCapacity(room);
        if (room.players.length >= maxAllowed) {
            return { success: false, message: `Đã đạt số lượng người chơi tối đa (${maxAllowed} người). Bật thêm bản mở rộng để tăng sức chứa phòng!` };
        }
        const botNum = room.players.filter(p => p.isBot).length;
        const botName = BOT_NAMES[botNum % BOT_NAMES.length] || `Bot ${botNum + 1}`;
        const botAvatar = BOT_AVATARS[botNum % BOT_AVATARS.length] || 'bot-1';
        const botPlayer = {
            id: crypto_1.default.randomUUID(),
            sessionId: `bot-${crypto_1.default.randomUUID()}`,
            name: botName,
            avatar: botAvatar,
            isHost: false,
            isBot: true,
            isReady: true,
            connected: true,
            socketId: null
        };
        room.players.push(botPlayer);
        this.addChatMessage(room.id, 'System', `${botName} was added to the room.`, true);
        return { success: true };
    }
    removeBotOrKick(roomId, requesterId, targetPlayerId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return { success: false, message: 'Room not found.' };
        if (room.hostId !== requesterId)
            return { success: false, message: 'Only host can kick players or bots.' };
        if (room.inGame)
            return { success: false, message: 'Cannot kick players during an active game.' };
        if (targetPlayerId === room.hostId)
            return { success: false, message: 'Host cannot kick themselves.' };
        const idx = room.players.findIndex(p => p.id === targetPlayerId);
        if (idx === -1)
            return { success: false, message: 'Player not found in room.' };
        const [removed] = room.players.splice(idx, 1);
        this.sessionToRoomMap.delete(removed.sessionId);
        this.addChatMessage(room.id, 'System', `${removed.name} was removed from the room.`, true);
        return { success: true, removedPlayer: removed };
    }
    leaveRoom(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return { success: true, roomDeleted: true };
        const idx = room.players.findIndex(p => p.id === playerId);
        if (idx === -1)
            return { success: true };
        const [removedPlayer] = room.players.splice(idx, 1);
        this.sessionToRoomMap.delete(removedPlayer.sessionId);
        // If game was active, notify game engine of player leaving
        if (room.inGame && room.gameInstance) {
            room.gameInstance.handleDisconnect(playerId);
        }
        const remainingHumans = room.players.filter(p => !p.isBot);
        // If no human players left or room empty, clean up room and destroy bots
        if (remainingHumans.length === 0 || room.players.length === 0) {
            if (room.botController) {
                room.botController.destroy();
            }
            this.rooms.delete(room.id);
            return { success: true, roomDeleted: true, removedPlayer };
        }
        // If host left, transfer host role to the next human player
        if (removedPlayer.isHost) {
            const nextHost = remainingHumans[0] || room.players[0];
            if (nextHost) {
                nextHost.isHost = true;
                room.hostId = nextHost.id;
                this.addChatMessage(room.id, 'System', `${nextHost.name} là chủ phòng mới.`, true);
            }
        }
        this.addChatMessage(room.id, 'System', `${removedPlayer.name} đã rời phòng.`, true);
        return { success: true, roomDeleted: false, removedPlayer };
    }
    updateSettings(roomId, requesterId, newSettings) {
        const room = this.rooms.get(roomId);
        if (!room)
            return { success: false, message: 'Room not found.' };
        if (room.hostId !== requesterId)
            return { success: false, message: 'Only host can change room settings.' };
        if (room.inGame)
            return { success: false, message: 'Cannot change settings during a match.' };
        if (newSettings.betAmount !== undefined) {
            const amt = Math.floor(Number(newSettings.betAmount));
            if (Number.isNaN(amt) || amt < exports.MIN_ROOM_BET || amt > exports.MAX_ROOM_BET) {
                return { success: false, message: `Mức cược phòng từ ${exports.MIN_ROOM_BET} đến ${exports.MAX_ROOM_BET} 🪙 (phòng luôn tính phí).` };
            }
            newSettings.betAmount = amt;
        }
        room.settings = {
            ...room.settings,
            ...newSettings,
            unoRules: {
                ...room.settings.unoRules,
                ...(newSettings.unoRules || {})
            }
        };
        // If game type changed, adjust uno mode or prune excess players if necessary
        this.addChatMessage(room.id, 'System', `Room settings updated for ${room.settings.gameType.toUpperCase()}.`, true);
        return { success: true };
    }
    setPlayerReady(roomId, playerId, isReady) {
        const room = this.rooms.get(roomId);
        if (!room)
            return { success: false, message: 'Room not found.' };
        const player = room.players.find(p => p.id === playerId);
        if (!player)
            return { success: false, message: 'Player not in room.' };
        player.isReady = isReady;
        return { success: true };
    }
    startGame(roomId, requesterId, callbacks) {
        const room = this.rooms.get(roomId);
        if (!room)
            return { success: false, message: 'Room not found.' };
        if (room.hostId !== requesterId)
            return { success: false, message: 'Only host can start the game.' };
        if (room.inGame)
            return { success: false, message: 'Game is already running.' };
        // Phòng luôn tính phí — chặn ván free (phòng cũ tạo trước khi đổi luật)
        const roomBet = Math.floor(Number(room.settings?.betAmount || 0));
        if (roomBet < exports.MIN_ROOM_BET) {
            return { success: false, message: `Phòng cần đặt mức cược từ ${exports.MIN_ROOM_BET} 🪙 trở lên.` };
        }
        const count = room.players.length;
        if (count < 2) {
            return { success: false, message: 'Need at least 2 players (human or bots) to start!' };
        }
        const minMax = {
            'uno': { min: 2, max: 8 },
            'exploding-kittens': { min: 2, max: 10 },
            'tien-len': { min: 2, max: 4 },
            'sam': { min: 2, max: 4 },
            'co-ca-ngua': { min: 2, max: 4 },
            'co-vua': { min: 2, max: 2 },
            'co-tuong': { min: 2, max: 2 }
        };
        const limits = minMax[room.settings.gameType];
        if (count < limits.min || count > limits.max) {
            return {
                success: false,
                message: `${room.settings.gameType.toUpperCase()} requires ${limits.min} to ${limits.max} players.`
            };
        }
        // Clean up any old bot controller
        if (room.botController) {
            room.botController.destroy();
            room.botController = null;
        }
        const enginePlayers = room.players.map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            isBot: p.isBot,
            connected: p.connected ?? true
        }));
        // Instantiate game engine
        let game;
        switch (room.settings.gameType) {
            case 'uno':
                game = new UnoGame_1.UnoGame(enginePlayers, {
                    mode: room.settings.unoMode,
                    rules: room.settings.unoRules,
                    turnTimeLimit: room.settings.turnTimeLimit
                });
                break;
            case 'exploding-kittens':
                game = new ExplodingKittensGame_1.ExplodingKittensGame(enginePlayers, room.settings.turnTimeLimit, room.settings.ekExpansions);
                break;
            case 'tien-len':
                game = new TienLenGame_1.TienLenGame(enginePlayers, {
                    turnTimeLimit: room.settings.turnTimeLimit,
                    firstTurnRule: room.settings.tienLenFirstTurnRule,
                    cutTwoOutOfTurnRule: room.settings.tienLenCutTwoRule
                });
                break;
            case 'sam':
                game = new SamGame_1.SamGame(enginePlayers, {
                    turnTimeLimit: room.settings.turnTimeLimit
                });
                break;
            case 'co-ca-ngua':
                game = new CoCaNguaGame_1.CoCaNguaGame(enginePlayers, room.settings.turnTimeLimit);
                break;
            case 'co-vua':
                game = new CoVuaGame_1.CoVuaGame(enginePlayers, room.settings.turnTimeLimit);
                break;
            case 'co-tuong':
                game = new CoTuongGame_1.CoTuongGame(enginePlayers, room.settings.turnTimeLimit);
                break;
        }
        room.gameInstance = game;
        room.inGame = true;
        // Create Bot Controller for AI players
        const botIds = room.players.filter(p => p.isBot).map(p => p.id);
        const botController = new BotController_1.BotController(game, botIds);
        room.botController = botController;
        // Attach callbacks
        game.setCallbacks({
            onStateChange: () => {
                callbacks.onBroadcastState(room);
                botController.notifyStateChange();
            },
            onPrivateMessage: (playerId, event, payload) => {
                callbacks.onPrivateMessage(playerId, event, payload);
            },
            onGameOver: (winners) => {
                callbacks.onGameOver(room, winners);
            }
        });
        game.start();
        botController.notifyStateChange();
        this.addChatMessage(room.id, 'System', `Game started! Good luck have fun!`, true);
        return { success: true };
    }
    restartGame(roomId, requesterId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return { success: false, message: 'Room not found.' };
        if (room.hostId !== requesterId)
            return { success: false, message: 'Only host can return to lobby / restart.' };
        if (room.gameInstance) {
            room.gameInstance.clearTurnTimer();
            room.gameInstance = null;
        }
        if (room.botController) {
            room.botController.destroy();
            room.botController = null;
        }
        room.inGame = false;
        room.paidUsers = {};
        for (const p of room.players) {
            p.isReady = p.isBot; // Bots are always ready
            p.hasPaidBet = false;
        }
        this.addChatMessage(room.id, 'System', `Returned to lobby.`, true);
        return { success: true };
    }
    handleSocketDisconnect(socketId) {
        for (const room of this.rooms.values()) {
            const player = room.players.find(p => p.socketId === socketId);
            if (player) {
                player.connected = false;
                player.socketId = null;
                if (room.gameInstance) {
                    room.gameInstance.handleDisconnect(player.id);
                }
                this.addChatMessage(room.id, 'System', `${player.name} disconnected.`, true);
                break;
            }
        }
    }
    addChatMessage(roomId, senderName, text, isSystem = false, senderId = 'system') {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        const msg = {
            id: crypto_1.default.randomUUID(),
            senderId,
            senderName,
            text,
            timestamp: Date.now(),
            isSystem
        };
        room.chatMessages.push(msg);
        if (room.chatMessages.length > 80) {
            room.chatMessages.shift();
        }
    }
    getRoom(roomId) {
        return this.rooms.get(roomId.toUpperCase());
    }
    getRoomBySession(sessionId) {
        const roomId = this.sessionToRoomMap.get(sessionId);
        return roomId ? this.rooms.get(roomId) : undefined;
    }
    getMaxCapacity(room) {
        if (room.settings.gameType === 'uno')
            return 8;
        if (room.settings.gameType === 'tien-len')
            return 4;
        if (room.settings.gameType === 'co-ca-ngua')
            return 4;
        if (room.settings.gameType === 'co-vua')
            return 2;
        if (room.settings.gameType === 'co-tuong')
            return 2;
        if (room.settings.gameType === 'exploding-kittens') {
            let max = 5;
            const exp = room.settings.ekExpansions;
            if (exp?.implodingKittens)
                max += 1; // 6 players (official Imploding expansion)
            if (exp?.streakingKittens)
                max += 2; // up to 8 players
            if (exp?.barkingKittens)
                max += 2; // up to 10 players
            return Math.min(10, max);
        }
        return 4;
    }
    getPublicRooms() {
        const list = [];
        for (const r of this.rooms.values()) {
            const host = r.players.find(p => p.id === r.hostId);
            list.push({
                id: r.id,
                hostName: host ? host.name : 'Chủ phòng',
                gameType: r.settings.gameType,
                playerCount: r.players.length,
                maxPlayers: this.getMaxCapacity(r),
                inGame: r.inGame,
                betAmount: r.settings.betAmount || 0,
                createdAt: r.createdAt || Date.now()
            });
        }
        return list.sort((a, b) => b.createdAt - a.createdAt);
    }
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars 0/O, 1/I
        let code = '';
        do {
            code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(crypto_1.default.randomInt(0, chars.length));
            }
        } while (this.rooms.has(code));
        return code;
    }
}
exports.RoomManager = RoomManager;
