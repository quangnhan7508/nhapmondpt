"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoTuongGame = void 0;
const BaseGame_1 = require("../BaseGame");
class CoTuongGame extends BaseGame_1.BaseGame {
    constructor(players, turnTimeLimit = 30) {
        const assignedPlayers = [
            {
                ...players[0],
                color: 'red',
                capturedPieces: []
            },
            {
                ...(players[1] || players[0]),
                color: 'black',
                capturedPieces: []
            }
        ];
        super({
            gameType: 'co-tuong',
            players: assignedPlayers,
            currentTurnIndex: 0,
            direction: 1,
            turnTimeLimit,
            turnStartTime: Date.now(),
            isGameOver: false,
            winners: [],
            logs: [],
            board: CoTuongGame.createInitialBoard(),
            activeColor: 'red'
        });
    }
    static createInitialBoard() {
        const board = Array(10).fill(null).map(() => Array(9).fill(null));
        // Black pieces (rows 0..3)
        const blackBack = ['xe', 'ma', 'voi', 'si', 'tuong', 'si', 'voi', 'ma', 'xe'];
        for (let c = 0; c < 9; c++) {
            board[0][c] = { type: blackBack[c], color: 'black' };
        }
        board[2][1] = { type: 'phao', color: 'black' };
        board[2][7] = { type: 'phao', color: 'black' };
        for (let c = 0; c < 9; c += 2) {
            board[3][c] = { type: 'tot', color: 'black' };
        }
        // Red pieces (rows 6..9)
        for (let c = 0; c < 9; c += 2) {
            board[6][c] = { type: 'tot', color: 'red' };
        }
        board[7][1] = { type: 'phao', color: 'red' };
        board[7][7] = { type: 'phao', color: 'red' };
        const redBack = ['xe', 'ma', 'voi', 'si', 'tuong', 'si', 'voi', 'ma', 'xe'];
        for (let c = 0; c < 9; c++) {
            board[9][c] = { type: redBack[c], color: 'red' };
        }
        return board;
    }
    start() {
        this.state.isGameOver = false;
        this.state.currentTurnIndex = 0;
        this.state.activeColor = 'red';
        this.addLog('Trò chơi Cờ Tướng bắt đầu! Quân Đỏ đi trước.', 'info');
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
        if (from.r < 0 || from.r > 9 || from.c < 0 || from.c > 8)
            return false;
        if (to.r < 0 || to.r > 9 || to.c < 0 || to.c > 8)
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
            this.logAction(`⚔️ ${player.name} ăn quân ${this.getPieceName(targetPiece)} của đối thủ!`, 'action', player.id);
            // If captured King/General -> Win!
            if (targetPiece.type === 'tuong') {
                this.state.board[to.r][to.c] = piece;
                this.state.board[from.r][from.c] = null;
                this.logAction(`👑 CHIẾU TƯỚNG BẮT ĐẦU! ${player.name} giành CHIẾN THẮNG CỜ TƯỚNG!`, 'win', player.id);
                this.emitGameOver([player.id]);
                return true;
            }
        }
        this.state.board[to.r][to.c] = piece;
        this.state.board[from.r][from.c] = null;
        this.state.lastMove = { from, to };
        // Toggle Turn
        this.state.activeColor = this.state.activeColor === 'red' ? 'black' : 'red';
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
            case 'tuong': { // General (Cung tướng: col 3..5, Red: row 7..9, Black: row 0..2)
                if (absDr + absDc !== 1)
                    return false;
                if (to.c < 3 || to.c > 5)
                    return false;
                if (piece.color === 'red' && (to.r < 7 || to.r > 9))
                    return false;
                if (piece.color === 'black' && (to.r < 0 || to.r > 2))
                    return false;
                return true;
            }
            case 'si': { // Advisor (diagonal 1 step in palace)
                if (absDr !== 1 || absDc !== 1)
                    return false;
                if (to.c < 3 || to.c > 5)
                    return false;
                if (piece.color === 'red' && (to.r < 7 || to.r > 9))
                    return false;
                if (piece.color === 'black' && (to.r < 0 || to.r > 2))
                    return false;
                return true;
            }
            case 'voi': { // Elephant (diagonal 2 steps, cannot cross river, blocked by eye)
                if (absDr !== 2 || absDc !== 2)
                    return false;
                // Cannot cross river (Red must be rows 5..9, Black rows 0..4)
                if (piece.color === 'red' && to.r < 5)
                    return false;
                if (piece.color === 'black' && to.r > 4)
                    return false;
                // Check eye of elephant
                const eyeR = from.r + dr / 2;
                const eyeC = from.c + dc / 2;
                if (this.state.board[eyeR][eyeC] !== null)
                    return false;
                return true;
            }
            case 'ma': { // Horse (L-shape, blocked by foot)
                if (!((absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2)))
                    return false;
                // Check horse foot
                if (absDr === 2) {
                    const footR = from.r + Math.sign(dr);
                    if (this.state.board[footR][from.c] !== null)
                        return false;
                }
                else {
                    const footC = from.c + Math.sign(dc);
                    if (this.state.board[from.r][footC] !== null)
                        return false;
                }
                return true;
            }
            case 'xe': { // Chariot (straight orthogonal line, path clear)
                if (dr !== 0 && dc !== 0)
                    return false;
                return this.countPiecesBetween(from, to) === 0;
            }
            case 'phao': { // Cannon (moves like Chariot, captures by jumping over 1 piece)
                if (dr !== 0 && dc !== 0)
                    return false;
                const between = this.countPiecesBetween(from, to);
                const target = this.state.board[to.r][to.c];
                if (target) {
                    return between === 1; // Exactly 1 piece to jump over
                }
                else {
                    return between === 0; // Empty path
                }
            }
            case 'tot': { // Soldier
                const forward = piece.color === 'red' ? -1 : 1;
                const crossedRiver = piece.color === 'red' ? from.r <= 4 : from.r >= 5;
                // Forward 1 step
                if (dr === forward && dc === 0)
                    return true;
                // Sideways 1 step if crossed river
                if (crossedRiver && dr === 0 && absDc === 1)
                    return true;
                return false;
            }
            default:
                return false;
        }
    }
    countPiecesBetween(from, to) {
        const stepR = Math.sign(to.r - from.r);
        const stepC = Math.sign(to.c - from.c);
        let count = 0;
        let curR = from.r + stepR;
        let curC = from.c + stepC;
        while (curR !== to.r || curC !== to.c) {
            if (this.state.board[curR][curC] !== null) {
                count++;
            }
            curR += stepR;
            curC += stepC;
        }
        return count;
    }
    resign(player) {
        const opponent = this.state.players.find(p => p.id !== player.id);
        if (!opponent)
            return false;
        this.logAction(`🏳️ ${player.name} xin thua. ${opponent.name} chiến thắng!`, 'win', opponent.id);
        this.emitGameOver([opponent.id]);
        return true;
    }
    getAllLegalMoves(color) {
        const moves = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = this.state.board[r][c];
                if (piece && piece.color === color) {
                    for (let tr = 0; tr < 10; tr++) {
                        for (let tc = 0; tc < 9; tc++) {
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
        this.state.activeColor = this.state.activeColor === 'red' ? 'black' : 'red';
        this.state.currentTurnIndex = (this.state.currentTurnIndex + 1) % this.state.players.length;
        this.state.turnStartTime = Date.now();
        this.resetTurnTimer();
        this.emitStateChange();
    }
    getPieceName(piece) {
        const names = {
            tuong: 'Tướng',
            si: 'Sĩ',
            voi: 'Tượng',
            xe: 'Xe',
            phao: 'Pháo',
            ma: 'Mã',
            tot: 'Tốt'
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
exports.CoTuongGame = CoTuongGame;
