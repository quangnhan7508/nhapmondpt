"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoVuaGame = void 0;
const BaseGame_1 = require("../BaseGame");
class CoVuaGame extends BaseGame_1.BaseGame {
    constructor(players, turnTimeLimit = 30) {
        const assignedPlayers = [
            {
                ...players[0],
                color: 'white',
                capturedPieces: []
            },
            {
                ...(players[1] || players[0]),
                color: 'black',
                capturedPieces: []
            }
        ];
        super({
            gameType: 'co-vua',
            players: assignedPlayers,
            currentTurnIndex: 0,
            direction: 1,
            turnTimeLimit,
            turnStartTime: Date.now(),
            isGameOver: false,
            winners: [],
            logs: [],
            board: CoVuaGame.createInitialBoard(),
            activeColor: 'white',
            isCheck: false
        });
    }
    static createInitialBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        // Black pieces (row 0, 1)
        const backRow = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
        for (let c = 0; c < 8; c++) {
            board[0][c] = { type: backRow[c], color: 'black' };
            board[1][c] = { type: 'p', color: 'black' };
        }
        // White pieces (row 6, 7)
        for (let c = 0; c < 8; c++) {
            board[6][c] = { type: 'p', color: 'white' };
            board[7][c] = { type: backRow[c], color: 'white' };
        }
        return board;
    }
    start() {
        this.state.isGameOver = false;
        this.state.currentTurnIndex = 0;
        this.state.activeColor = 'white';
        this.addLog('Trò chơi Cờ Vua bắt đầu! Quân Trắng đi trước.', 'info');
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
            case 'MOVE_PIECE':
                success = this.movePiece(currentPlayer, action.from, action.to);
                break;
            case 'RESIGN':
                success = this.resign(currentPlayer);
                break;
            default:
                return { success: false, message: 'Unknown action' };
        }
        return { success };
    }
    movePiece(player, from, to) {
        if (player.color !== this.state.activeColor)
            return false;
        if (from.r < 0 || from.r > 7 || from.c < 0 || from.c > 7)
            return false;
        if (to.r < 0 || to.r > 7 || to.c < 0 || to.c > 7)
            return false;
        const piece = this.state.board[from.r][from.c];
        if (!piece || piece.color !== player.color)
            return false;
        const targetPiece = this.state.board[to.r][to.c];
        if (targetPiece && targetPiece.color === player.color)
            return false;
        if (!this.isValidMove(piece, from, to))
            return false;
        // Execute Move
        if (targetPiece) {
            player.capturedPieces.push(targetPiece);
            this.logAction(`⚔️ ${player.name} bắt quân ${this.getPieceName(targetPiece)} của đối thủ!`, 'action', player.id);
            // King capture ends game
            if (targetPiece.type === 'k') {
                this.state.board[to.r][to.c] = piece;
                this.state.board[from.r][from.c] = null;
                this.state.isGameOver = true;
                this.state.winners = [player.id];
                this.logAction(`👑 CHIẾU BÍ! ${player.name} bắt được Vua và giành CHIẾN THẮNG!`, 'win', player.id);
                this.emitStateChange();
                return true;
            }
        }
        // Pawn Promotion
        if (piece.type === 'p' && ((piece.color === 'white' && to.r === 0) || (piece.color === 'black' && to.r === 7))) {
            piece.type = 'q'; // Auto-promote to Queen
            this.logAction(`🌟 Tốt của ${player.name} đã phong cấp thành HẬU!`, 'special', player.id);
        }
        this.state.board[to.r][to.c] = piece;
        this.state.board[from.r][from.c] = null;
        this.state.lastMove = { from, to };
        // Toggle Turn
        this.state.activeColor = this.state.activeColor === 'white' ? 'black' : 'white';
        this.state.currentTurnIndex = (this.state.currentTurnIndex + 1) % this.state.players.length;
        this.state.turnStartTime = Date.now();
        this.resetTurnTimer();
        this.emitStateChange();
        return true;
    }
    isValidMove(piece, from, to) {
        const dr = to.r - from.r;
        const dc = to.c - from.c;
        const absDr = Math.abs(dr);
        const absDc = Math.abs(dc);
        switch (piece.type) {
            case 'p': { // Pawn
                const forward = piece.color === 'white' ? -1 : 1;
                const startRow = piece.color === 'white' ? 6 : 1;
                const target = this.state.board[to.r][to.c];
                // Normal 1 step forward
                if (dc === 0 && dr === forward && !target)
                    return true;
                // 2 steps from start
                if (dc === 0 && dr === forward * 2 && from.r === startRow && !target && !this.state.board[from.r + forward][from.c]) {
                    return true;
                }
                // Capture diagonally
                if (absDc === 1 && dr === forward && target && target.color !== piece.color) {
                    return true;
                }
                return false;
            }
            case 'n': // Knight: 2x1 or 1x2 L-shape
                return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
            case 'b': // Bishop: diagonal path clear
                if (absDr !== absDc)
                    return false;
                return this.isPathClear(from, to);
            case 'r': // Rook: straight line path clear
                if (dr !== 0 && dc !== 0)
                    return false;
                return this.isPathClear(from, to);
            case 'q': // Queen: diagonal or straight path clear
                if (absDr !== absDc && dr !== 0 && dc !== 0)
                    return false;
                return this.isPathClear(from, to);
            case 'k': // King: 1 step any direction
                return absDr <= 1 && absDc <= 1;
            default:
                return false;
        }
    }
    isPathClear(from, to) {
        const stepR = Math.sign(to.r - from.r);
        const stepC = Math.sign(to.c - from.c);
        let curR = from.r + stepR;
        let curC = from.c + stepC;
        while (curR !== to.r || curC !== to.c) {
            if (this.state.board[curR][curC] !== null) {
                return false;
            }
            curR += stepR;
            curC += stepC;
        }
        return true;
    }
    resign(player) {
        const opponent = this.state.players.find(p => p.id !== player.id);
        if (!opponent)
            return false;
        this.logAction(`🏳️ ${player.name} xin hàng. ${opponent.name} chiến thắng!`, 'win', opponent.id);
        this.emitGameOver([opponent.id]);
        return true;
    }
    getAllLegalMoves(color) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.state.board[r][c];
                if (piece && piece.color === color) {
                    for (let tr = 0; tr < 8; tr++) {
                        for (let tc = 0; tc < 8; tc++) {
                            const target = this.state.board[tr][tc];
                            if (target && target.color === color)
                                continue;
                            if (this.isValidMove(piece, { r, c }, { r: tr, c: tc })) {
                                moves.push({ from: { r, c }, to: { r: tr, c: tc } });
                            }
                        }
                    }
                }
            }
        }
        return moves;
    }
    handleTurnTimeout() {
        const curPlayer = this.state.players[this.state.currentTurnIndex];
        if (!curPlayer || this.state.isGameOver)
            return;
        this.addLog(`${curPlayer.name} hết thời gian lượt đi! Chuyển lượt.`, 'warning', curPlayer.id);
        this.state.activeColor = this.state.activeColor === 'white' ? 'black' : 'white';
        this.state.currentTurnIndex = (this.state.currentTurnIndex + 1) % this.state.players.length;
        this.state.turnStartTime = Date.now();
        this.resetTurnTimer();
        this.emitStateChange();
    }
    getPieceName(piece) {
        const names = {
            p: 'Tốt',
            r: 'Xe',
            n: 'Mã',
            b: 'Tượng',
            q: 'Hậu',
            k: 'Vua'
        };
        return names[piece.type] || piece.type;
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
exports.CoVuaGame = CoVuaGame;
