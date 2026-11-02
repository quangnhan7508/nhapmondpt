"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocketHandlers = registerSocketHandlers;
const RoomManager_1 = require("../rooms/RoomManager");
function registerSocketHandlers(io, roomManager, userManager, workManager, caseEngine, upgradeEngine, giftcodeManager) {
    const formatPlayerDTO = (p) => ({
        id: p.id,
        sessionId: p.sessionId,
        userId: p.userId,
        name: p.name,
        avatar: p.avatar,
        isHost: p.isHost,
        isBot: p.isBot,
        isReady: p.isReady,
        connected: p.connected,
        hasPaidBet: p.hasPaidBet
    });
    const formatRoomDTO = (room) => ({
        id: room.id,
        hostId: room.hostId,
        players: room.players.map(formatPlayerDTO),
        settings: room.settings,
        inGame: room.inGame,
        chatMessages: room.chatMessages
    });
    const broadcastRoomState = (room) => {
        // 1. Broadcast public room metadata (lobby view, player list, chat)
        io.to(room.id).emit('room_updated', formatRoomDTO(room));
        // 2. Server-authoritative state masking: emit tailored state to each connected player
        if (room.inGame && room.gameInstance) {
            for (const player of room.players) {
                if (!player.isBot && player.socketId) {
                    const maskedState = room.gameInstance.getMaskedState(player.id);
                    io.to(player.socketId).emit('game_state', maskedState);
                }
            }
        }
    };
    const sendPrivateMessage = (room, targetPlayerId, event, payload) => {
        const player = room.players.find(p => p.id === targetPlayerId);
        if (player && player.socketId) {
            io.to(player.socketId).emit(event, payload);
        }
    };
    io.on('connection', (socket) => {
        // Handle Room Creation (phòng luôn tính phí — kèm tiền cược)
        socket.on('create_room', (data, callback) => {
            const { sessionId, playerName, avatar, userId, betAmount, gameType } = data;
            const bet = (0, RoomManager_1.sanitizeRoomBet)(betAmount);
            if (betAmount !== undefined && (Math.floor(Number(betAmount)) < RoomManager_1.MIN_ROOM_BET || Math.floor(Number(betAmount)) > RoomManager_1.MAX_ROOM_BET)) {
                if (typeof callback === 'function') {
                    callback({ success: false, message: `Mức cược phòng từ ${RoomManager_1.MIN_ROOM_BET} đến ${RoomManager_1.MAX_ROOM_BET} 🪙.` });
                }
                return;
            }
            // Kiểm tra và trừ tiền chủ phòng ngay khi tạo phòng (nếu là user đã đăng nhập)
            if (userId && bet > 0) {
                const bal = userManager.getBalance(userId);
                if (bal < bet) {
                    if (typeof callback === 'function') {
                        callback({ success: false, message: `Không đủ tiền tạo phòng ${bet} 🪙 (đang có ${bal} 🪙). Hãy đi làm kiếm thêm!` });
                    }
                    return;
                }
                const deductRes = userManager.deductBalance(userId, bet, `Tạo phòng cược ${bet} 🪙`);
                if (!deductRes.success) {
                    if (typeof callback === 'function') {
                        callback({ success: false, message: deductRes.message || 'Không thể trừ tiền tạo phòng.' });
                    }
                    return;
                }
            }
            const room = roomManager.createRoom(sessionId, playerName, avatar, socket.id, userId, bet, gameType);
            if (userId && bet > 0) {
                if (!room.paidUsers)
                    room.paidUsers = {};
                room.paidUsers[userId] = bet;
                if (room.players[0]) {
                    room.players[0].hasPaidBet = true;
                }
                socket.emit('balance_updated', { balance: userManager.getBalance(userId) });
            }
            socket.join(room.id);
            if (typeof callback === 'function') {
                callback({ success: true, room: formatRoomDTO(room), player: formatPlayerDTO(room.players[0]) });
            }
            broadcastRoomState(room);
        });
        // Handle Join Room (trừ tiền cược ngay khi tham gia)
        socket.on('join_room', (data, callback) => {
            const { roomId, sessionId, playerName, avatar, userId } = data;
            const targetRoom = roomManager.getRoom(roomId);
            if (!targetRoom) {
                if (typeof callback === 'function') {
                    callback({ success: false, message: 'Không tìm thấy phòng chơi.' });
                }
                return;
            }
            const existing = targetRoom.players.find(p => p.sessionId === sessionId);
            const betAmount = Math.floor(Number(targetRoom.settings?.betAmount || 0));
            // Nếu là người chơi mới tham gia (không phải reconnect), kiểm tra số dư trước
            if (!existing && userId && betAmount > 0) {
                const bal = userManager.getBalance(userId);
                if (bal < betAmount) {
                    if (typeof callback === 'function') {
                        callback({ success: false, message: `Không đủ tiền vào phòng! Cần ${betAmount} 🪙 (bạn đang có ${bal} 🪙). Hãy làm việc kiếm thêm!` });
                    }
                    return;
                }
            }
            const res = roomManager.joinRoom(roomId, sessionId, playerName, avatar, socket.id, userId);
            if (res.success && res.room && res.player) {
                // Trừ tiền người mới vào phòng
                if (!existing && userId && betAmount > 0) {
                    const deductRes = userManager.deductBalance(userId, betAmount, `Cược vào phòng ${res.room.id}`);
                    if (!deductRes.success) {
                        roomManager.leaveRoom(res.room.id, res.player.id);
                        if (typeof callback === 'function') {
                            callback({ success: false, message: deductRes.message || 'Không thể trừ tiền cược vào phòng.' });
                        }
                        return;
                    }
                    if (!res.room.paidUsers)
                        res.room.paidUsers = {};
                    res.room.paidUsers[userId] = betAmount;
                    res.player.hasPaidBet = true;
                    socket.emit('balance_updated', { balance: userManager.getBalance(userId) });
                }
                else if (existing && userId && res.room.paidUsers?.[userId]) {
                    res.player.hasPaidBet = true;
                }
                socket.join(res.room.id);
                if (typeof callback === 'function') {
                    callback({ success: true, room: formatRoomDTO(res.room), player: formatPlayerDTO(res.player) });
                }
                broadcastRoomState(res.room);
            }
            else {
                if (typeof callback === 'function') {
                    callback({ success: false, message: res.message });
                }
            }
        });
        // Handle Session Reconnection
        socket.on('reconnect_session', (data, callback) => {
            const { sessionId, userId } = data;
            const room = roomManager.getRoomBySession(sessionId);
            if (!room) {
                if (typeof callback === 'function')
                    callback({ success: false });
                return;
            }
            const player = room.players.find(p => p.sessionId === sessionId);
            if (player) {
                player.connected = true;
                player.socketId = socket.id;
                if (userId)
                    player.userId = userId;
                if (userId && room.paidUsers?.[userId]) {
                    player.hasPaidBet = true;
                }
                socket.join(room.id);
                if (room.gameInstance) {
                    room.gameInstance.handleReconnect(player.id);
                }
                if (typeof callback === 'function') {
                    callback({ success: true, room: formatRoomDTO(room), player: formatPlayerDTO(player) });
                }
                broadcastRoomState(room);
            }
            else {
                if (typeof callback === 'function')
                    callback({ success: false });
            }
        });
        // Handle Fetch Leaderboard via Socket
        socket.on('get_leaderboard', (data, callback) => {
            const gameType = data?.gameType || 'all';
            const leaderboard = userManager.getLeaderboard(gameType);
            if (typeof callback === 'function') {
                callback({ success: true, leaderboard });
            }
        });
        // Handle Fetch Public Rooms List via Socket
        socket.on('get_rooms', (_data, callback) => {
            const rooms = roomManager.getPublicRooms();
            if (typeof callback === 'function') {
                callback({ success: true, rooms });
            }
        });
        // Handle Add Bot
        socket.on('add_bot', (data, callback) => {
            const { roomId, requesterId } = data;
            const res = roomManager.addBot(roomId, requesterId);
            const room = roomManager.getRoom(roomId);
            if (room)
                broadcastRoomState(room);
            if (typeof callback === 'function')
                callback(res);
        });
        // Handle Remove Bot / Kick Player (hoàn tiền nếu đã trừ cược trước game)
        socket.on('remove_bot', (data, callback) => {
            const { roomId, requesterId, targetPlayerId } = data;
            const roomBefore = roomManager.getRoom(roomId);
            const targetPlayer = roomBefore?.players.find(p => p.id === targetPlayerId);
            const wasInGame = roomBefore?.inGame;
            const res = roomManager.removeBotOrKick(roomId, requesterId, targetPlayerId);
            // Nếu bị kick trước khi game bắt đầu và đã nộp cược -> hoàn tiền cho người bị kick
            if (res.success && !wasInGame && targetPlayer?.userId && roomBefore?.paidUsers?.[targetPlayer.userId]) {
                const refundAmt = roomBefore.paidUsers[targetPlayer.userId];
                delete roomBefore.paidUsers[targetPlayer.userId];
                userManager.addBalance(targetPlayer.userId, refundAmt, `Hoàn tiền bị kick khỏi phòng ${roomId}`);
                if (targetPlayer.socketId) {
                    io.to(targetPlayer.socketId).emit('balance_updated', { balance: userManager.getBalance(targetPlayer.userId) });
                }
            }
            const room = roomManager.getRoom(roomId);
            if (room)
                broadcastRoomState(room);
            if (typeof callback === 'function')
                callback(res);
        });
        // Handle Update Settings
        socket.on('update_settings', (data, callback) => {
            const { roomId, requesterId, settings } = data;
            const room = roomManager.getRoom(roomId);
            if (room && settings?.betAmount !== undefined) {
                const newBet = Math.floor(Number(settings.betAmount));
                if (room.players.length > 1 && newBet !== room.settings.betAmount) {
                    if (typeof callback === 'function') {
                        callback({ success: false, message: 'Không thể đổi mức cược khi đã có người chơi khác trong phòng.' });
                    }
                    return;
                }
                // Nếu chủ phòng ở một mình, điều chỉnh số dư theo chênh lệch
                if (room.players.length === 1 && newBet !== room.settings.betAmount && room.players[0].userId) {
                    const hostUid = room.players[0].userId;
                    const oldPaid = room.paidUsers?.[hostUid] || 0;
                    const diff = newBet - oldPaid;
                    if (diff > 0) {
                        const hostBal = userManager.getBalance(hostUid);
                        if (hostBal < diff) {
                            if (typeof callback === 'function') {
                                callback({ success: false, message: `Không đủ tiền tăng cược thêm ${diff} 🪙 (đang có ${hostBal} 🪙).` });
                            }
                            return;
                        }
                        userManager.deductBalance(hostUid, diff, `Tăng mức cược phòng ${roomId}`);
                    }
                    else if (diff < 0) {
                        userManager.addBalance(hostUid, Math.abs(diff), `Giảm mức cược phòng ${roomId}`);
                    }
                    if (!room.paidUsers)
                        room.paidUsers = {};
                    room.paidUsers[hostUid] = newBet;
                    socket.emit('balance_updated', { balance: userManager.getBalance(hostUid) });
                }
            }
            const res = roomManager.updateSettings(roomId, requesterId, settings);
            const updatedRoom = roomManager.getRoom(roomId);
            if (updatedRoom)
                broadcastRoomState(updatedRoom);
            if (typeof callback === 'function')
                callback(res);
        });
        // Handle Ready Toggle
        socket.on('set_ready', (data, callback) => {
            const { roomId, playerId, isReady } = data;
            const res = roomManager.setPlayerReady(roomId, playerId, isReady);
            const room = roomManager.getRoom(roomId);
            if (room)
                broadcastRoomState(room);
            if (typeof callback === 'function')
                callback(res);
        });
        // Handle Start Game (trả thưởng x15 - x30 lần cược cho người thắng)
        socket.on('start_game', (data, callback) => {
            const { roomId, requesterId } = data;
            const roomBefore = roomManager.getRoom(roomId);
            if (!roomBefore) {
                if (typeof callback === 'function')
                    callback({ success: false, message: 'Phòng không tồn tại.' });
                return;
            }
            const betAmount = Math.floor(Number(roomBefore.settings?.betAmount || 0));
            // Đảm bảo tất cả người chơi thật (đã đăng nhập) đều đã trừ tiền cược trước khi trận bắt đầu
            if (betAmount > 0) {
                if (!roomBefore.paidUsers)
                    roomBefore.paidUsers = {};
                const unpaidHumans = roomBefore.players.filter(p => !p.isBot && p.userId && !roomBefore.paidUsers?.[p.userId]);
                for (const p of unpaidHumans) {
                    const bal = userManager.getBalance(p.userId);
                    if (bal < betAmount) {
                        if (typeof callback === 'function') {
                            callback({ success: false, message: `Người chơi ${p.name} không đủ tiền cược: cần ${betAmount} 🪙 (đang có ${bal} 🪙).` });
                        }
                        return;
                    }
                }
                for (const p of unpaidHumans) {
                    const r = userManager.deductBalance(p.userId, betAmount, `Room bet ${roomId} (${roomBefore.settings.gameType})`);
                    if (r.success) {
                        roomBefore.paidUsers[p.userId] = betAmount;
                        p.hasPaidBet = true;
                        if (p.socketId)
                            io.to(p.socketId).emit('balance_updated', { balance: userManager.getBalance(p.userId) });
                    }
                }
            }
            const res = roomManager.startGame(roomId, requesterId, {
                onBroadcastState: (r) => broadcastRoomState(r),
                onPrivateMessage: (playerId, event, payload) => {
                    const roomObj = roomManager.getRoom(roomId);
                    if (roomObj)
                        sendPrivateMessage(roomObj, playerId, event, payload);
                },
                onGameOver: (r, winners) => {
                    if (winners && winners.length > 0) {
                        const participantUserIds = r.players.filter(p => p.userId).map(p => p.userId);
                        const winnerPlayers = r.players.filter(p => winners.includes(p.id));
                        const winnerUserIds = winnerPlayers.filter(p => p.userId).map(p => p.userId);
                        userManager.recordGameResult(r.settings.gameType, participantUserIds, winnerUserIds);
                        const potBet = Math.floor(Number(r.settings?.betAmount || 0));
                        if (potBet > 0 && winnerUserIds.length > 0) {
                            // Tiền thắng từ tạo phòng gấp 15-30 lần mức cược
                            const multiplier = 15 + Math.floor(Math.random() * 16); // 15 đến 30
                            const totalPrize = potBet * multiplier;
                            const perWinner = Math.floor(totalPrize / winnerUserIds.length);
                            for (const uid of winnerUserIds) {
                                userManager.addBalance(uid, perWinner, `Thắng phòng ${r.id} (${r.settings.gameType}) x${multiplier} cược`);
                                const winP = r.players.find(p => p.userId === uid);
                                if (winP?.socketId) {
                                    io.to(winP.socketId).emit('balance_updated', { balance: userManager.getBalance(uid) });
                                }
                            }
                            const winnerNames = winnerPlayers.map(p => p.name).join(', ');
                            roomManager.addChatMessage(r.id, 'System', `🏆 CHIẾN THẮNG VANG DỘI! ${winnerNames} đã thắng và nhận thưởng gấp ${multiplier} LẦN cược (+${perWinner.toLocaleString()} 🪙)! 🎉`, true);
                        }
                        else if (winnerPlayers.length > 0) {
                            const winnerNames = winnerPlayers.map(p => p.name).join(', ');
                            roomManager.addChatMessage(r.id, 'System', `🏆 Trận đấu kết thúc! Người chiến thắng: ${winnerNames}.`, true);
                        }
                        io.emit('leaderboard_updated', userManager.getLeaderboard('all'));
                    }
                    // Reset trạng thái thanh toán cược cho ván chơi tiếp theo
                    r.paidUsers = {};
                    for (const p of r.players) {
                        p.hasPaidBet = false;
                    }
                    broadcastRoomState(r);
                }
            });
            const room = roomManager.getRoom(roomId);
            if (room)
                broadcastRoomState(room);
            if (typeof callback === 'function')
                callback(res);
        });
        // Handle Restart Game (Return to Lobby)
        socket.on('restart_game', (data, callback) => {
            const { roomId, requesterId } = data;
            const res = roomManager.restartGame(roomId, requesterId);
            const room = roomManager.getRoom(roomId);
            if (room) {
                room.paidUsers = {};
                for (const p of room.players) {
                    p.hasPaidBet = false;
                }
                broadcastRoomState(room);
            }
            if (typeof callback === 'function')
                callback(res);
        });
        // Handle Player Game Action
        socket.on('game_action', (data, callback) => {
            const { roomId, playerId, action } = data;
            const room = roomManager.getRoom(roomId);
            if (!room || !room.gameInstance) {
                if (typeof callback === 'function')
                    callback({ success: false, message: 'No active game in room.' });
                return;
            }
            const res = room.gameInstance.handleAction(playerId, action);
            broadcastRoomState(room);
            if (typeof callback === 'function')
                callback(res);
        });
        // Handle In-Game Chat / Message
        socket.on('send_chat', (data) => {
            const { roomId, senderId, senderName, text } = data;
            if (!text || !text.trim())
                return;
            roomManager.addChatMessage(roomId, senderName, text.trim(), false, senderId);
            const room = roomManager.getRoom(roomId);
            if (room)
                broadcastRoomState(room);
        });
        // Handle Leave Room (hoàn trả tiền nếu rời trước khi trận bắt đầu)
        socket.on('leave_room', (data, callback) => {
            const { roomId, playerId } = data;
            const roomBefore = roomManager.getRoom(roomId);
            const playerObj = roomBefore?.players.find(p => p.id === playerId);
            const wasInGame = roomBefore?.inGame;
            const res = roomManager.leaveRoom(roomId, playerId);
            socket.leave(roomId);
            // Nếu rời phòng trước khi bắt đầu trận và đã trừ tiền cược -> hoàn trả tiền
            if (!wasInGame && playerObj?.userId && roomBefore?.paidUsers?.[playerObj.userId]) {
                const refundAmt = roomBefore.paidUsers[playerObj.userId];
                delete roomBefore.paidUsers[playerObj.userId];
                userManager.addBalance(playerObj.userId, refundAmt, `Hoàn tiền rời phòng ${roomId}`);
                socket.emit('balance_updated', { balance: userManager.getBalance(playerObj.userId) });
            }
            // Nếu phòng bị giải tán (res.roomDeleted), hoàn tiền cho tất cả người chơi còn lại đã nộp tiền
            if (res.roomDeleted && roomBefore?.paidUsers) {
                for (const [uid, amt] of Object.entries(roomBefore.paidUsers)) {
                    if (amt > 0) {
                        userManager.addBalance(uid, amt, `Hoàn tiền giải tán phòng ${roomId}`);
                        const uPlayer = roomBefore.players.find(p => p.userId === uid);
                        if (uPlayer?.socketId) {
                            io.to(uPlayer.socketId).emit('balance_updated', { balance: userManager.getBalance(uid) });
                        }
                    }
                }
                roomBefore.paidUsers = {};
            }
            const room = roomManager.getRoom(roomId);
            if (room) {
                broadcastRoomState(room);
            }
            if (typeof callback === 'function')
                callback(res);
        });
        // Handle Disconnect
        socket.on('disconnect', () => {
            roomManager.handleSocketDisconnect(socket.id);
            // Broadcast state update to any affected rooms
            for (const r of roomManager.rooms.values()) {
                broadcastRoomState(r);
            }
        });
        // ========== WORK SYSTEM ==========
        if (workManager) {
            socket.on('work:request-word', (data, callback) => {
                const userId = data?.userId;
                if (!userId)
                    return callback({ success: false, message: 'Chưa đăng nhập' });
                const result = workManager.requestWord(userId, data?.lang);
                callback(result);
            });
            socket.on('work:submit-word', (data, callback) => {
                const { userId, word } = data || {};
                if (!userId)
                    return callback({ success: false, message: 'Chưa đăng nhập' });
                const result = workManager.submitWord(userId, word);
                callback(result);
            });
        }
        // ========== CS2 CASE OPENING ==========
        if (caseEngine) {
            socket.on('cases:get', (_data, callback) => {
                if (typeof callback === 'function') {
                    callback({ success: true, cases: caseEngine.getCases() });
                }
            });
            socket.on('cases:open', (data, callback) => {
                const { userId, caseId } = data || {};
                if (!userId) {
                    if (typeof callback === 'function')
                        callback({ success: false, message: 'Chưa đăng nhập.' });
                    return;
                }
                const result = caseEngine.openCase(userId, caseId);
                if (result.success && result.newBalance !== undefined) {
                    socket.emit('balance_updated', { balance: result.newBalance });
                }
                if (typeof callback === 'function') {
                    callback(result);
                }
            });
            socket.on('cases:open-multi', (data, callback) => {
                const { userId, caseId, count } = data || {};
                if (!userId) {
                    if (typeof callback === 'function')
                        callback({ success: false, message: 'Chưa đăng nhập.' });
                    return;
                }
                const result = caseEngine.openCases(userId, caseId, count);
                if (result.success && result.newBalance !== undefined) {
                    socket.emit('balance_updated', { balance: result.newBalance });
                }
                if (typeof callback === 'function') {
                    callback(result);
                }
            });
        }
        // ========== INVENTORY SYSTEM ==========
        socket.on('inventory:get', (data, callback) => {
            const { userId } = data || {};
            if (!userId) {
                if (typeof callback === 'function')
                    callback({ success: false, message: 'Chưa đăng nhập.' });
                return;
            }
            const inventory = userManager.getInventory(userId);
            if (typeof callback === 'function') {
                callback({ success: true, inventory });
            }
        });
        socket.on('inventory:sell', (data, callback) => {
            const { userId, itemId } = data || {};
            if (!userId || !itemId) {
                if (typeof callback === 'function')
                    callback({ success: false, message: 'Thiếu thông tin người chơi hoặc vật phẩm.' });
                return;
            }
            const res = userManager.sellItem(userId, itemId);
            if (res.success && res.newBalance !== undefined) {
                socket.emit('balance_updated', { balance: res.newBalance });
            }
            if (typeof callback === 'function') {
                callback(res);
            }
        });
        socket.on('inventory:sell-all', (data, callback) => {
            const { userId } = data || {};
            if (!userId) {
                if (typeof callback === 'function')
                    callback({ success: false, message: 'Chưa đăng nhập.' });
                return;
            }
            const res = userManager.sellAllItems(userId);
            if (res.success && res.newBalance !== undefined) {
                socket.emit('balance_updated', { balance: res.newBalance });
            }
            if (typeof callback === 'function') {
                callback(res);
            }
        });
        // ========== SKINCLUB UPGRADE ==========
        if (upgradeEngine) {
            socket.on('upgrade:play', (data, callback) => {
                const { userId, betType, betAmount, itemInstanceId, targetValue, rollDirection } = data || {};
                if (!userId) {
                    if (typeof callback === 'function')
                        callback({ success: false, message: 'Chưa đăng nhập.' });
                    return;
                }
                const result = upgradeEngine.playUpgrade({
                    userId,
                    betType,
                    betAmount,
                    itemInstanceId,
                    targetValue,
                    rollDirection
                });
                if (result.success && result.newBalance !== undefined) {
                    socket.emit('balance_updated', { balance: result.newBalance });
                }
                if (typeof callback === 'function') {
                    callback(result);
                }
            });
        }
        // User subscription for real-time notifications (e.g. money transfer received)
        socket.on('user:subscribe', (data) => {
            const { userId } = data || {};
            if (userId) {
                socket.join(`user:${userId}`);
            }
        });
        // Wallet: Transfer coins between users
        socket.on('wallet:transfer', (data, callback) => {
            const { senderId, recipientQuery, amount, note } = data || {};
            const result = userManager.transferBalance(senderId, recipientQuery, amount, note);
            if (result.success && result.transaction && result.recipientUser) {
                // Update sender balance on current socket
                socket.emit('balance_updated', { balance: result.senderNewBalance });
                // Update recipient balance & push real-time received notification if online
                io.to(`user:${result.recipientUser.id}`).emit('balance_updated', {
                    balance: result.recipientNewBalance
                });
                io.to(`user:${result.recipientUser.id}`).emit('wallet:received', {
                    senderName: result.transaction.senderDisplayName,
                    senderUsername: result.transaction.senderUsername,
                    amount: result.transaction.amount,
                    note: result.transaction.note,
                    newBalance: result.recipientNewBalance,
                    timestamp: result.transaction.timestamp
                });
            }
            if (typeof callback === 'function') {
                callback(result);
            }
        });
        // Wallet: Get user transfer history
        socket.on('wallet:get-history', (data, callback) => {
            const { userId } = data || {};
            if (!userId) {
                if (typeof callback === 'function')
                    callback({ success: false, message: 'Thiếu userId.' });
                return;
            }
            const transactions = userManager.getUserTransactions(userId);
            if (typeof callback === 'function') {
                callback({ success: true, transactions });
            }
        });
        // Wallet: Search players by username or display name
        socket.on('wallet:search-users', (data, callback) => {
            const { query, excludeUserId } = data || {};
            const users = userManager.searchUsers(query || '', excludeUserId);
            if (typeof callback === 'function') {
                callback({ success: true, users });
            }
        });
        // Giftcode: Redeem giftcode (e.g. dinhvantrinh)
        socket.on('giftcode:redeem', (data, callback) => {
            const { userId, code } = data || {};
            if (!giftcodeManager) {
                if (typeof callback === 'function')
                    callback({ success: false, message: 'Hệ thống Giftcode đang bảo trì.' });
                return;
            }
            const result = giftcodeManager.redeem(userId, code);
            if (result.success && result.newBalance !== undefined) {
                socket.emit('balance_updated', { balance: result.newBalance });
            }
            if (typeof callback === 'function') {
                callback(result);
            }
        });
    });
}
