import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { sounds } from '../../utils/sound';

interface CoVuaTableViewProps {
  gameState: any;
  myPlayerId: string;
  onSendAction: (action: any) => void;
}

const ChessPieceSVG: React.FC<{ type: string; color: 'white' | 'black' }> = ({ type, color }) => {
  const isWhite = color === 'white';
  const fill = isWhite ? '#1e293b' : '#38bdf8';
  const stroke = isWhite ? '#0f172a' : '#e0f2fe';

  switch (type) {
    case 'k': // King
      return (
        <svg viewBox="0 0 45 45" className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow">
          <path d="M22.5 5v5M20 7.5h5" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path
            d="M12 15c2 0 4 3 4 5 0 2-2 4-2 4h17s-2-2-2-4c0-2 2-5 4-5 2.5 0 3 2.5 3 5 0 6-6 10-10.5 12-4.5-2-10.5-6-10.5-12 0-2.5.5-5 3-5z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          <path d="M11 35h23v4H11z" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path d="M14 31h17v3H14z" fill={fill} stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case 'q': // Queen
      return (
        <svg viewBox="0 0 45 45" className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow">
          <circle cx="9" cy="14" r="1.8" fill={stroke} />
          <circle cx="16" cy="11" r="1.8" fill={stroke} />
          <circle cx="22.5" cy="10" r="1.8" fill={stroke} />
          <circle cx="29" cy="11" r="1.8" fill={stroke} />
          <circle cx="36" cy="14" r="1.8" fill={stroke} />
          <path
            d="M9 16l3.5 13h20L36 16l-5.5 8-8-11-8 11L9 16z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M11 35h23v4H11z" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path d="M13 31h19v3H13z" fill={fill} stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case 'r': // Rook
      return (
        <svg viewBox="0 0 45 45" className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow">
          <path
            d="M12 14h4v3h3v-3h4v3h3v-3h4v5l-2 3v9h3v4H11v-4h3v-9l-2-3v-5z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M10 35h25v4H10z" fill={fill} stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case 'b': // Bishop
      return (
        <svg viewBox="0 0 45 45" className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow">
          <circle cx="22.5" cy="8.5" r="1.8" fill={stroke} />
          <path
            d="M22.5 11c-4 0-7.5 4-7.5 9 0 3 2 5.5 4 7.5v3.5h7V27.5c2-2 4-4.5 4-7.5 0-5-3.5-9-7.5-9z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          <path d="M21 15l4 5M25 15l-4 5" stroke={isWhite ? '#ffffff' : '#0f172a'} strokeWidth="1.5" />
          <path d="M12 35h21v4H12z" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path d="M15 31h15v3H15z" fill={fill} stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case 'n': // Knight
      return (
        <svg viewBox="0 0 45 45" className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow">
          <path
            d="M22 9c-3 0-7 2-8 7-1 4 0 7 2 9-1 1-3 3-3 6h21c0-4-2-7-5-9 1-1 2-3 2-5 0-3-4-8-9-8z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="18" cy="16" r="1.5" fill={isWhite ? '#ffffff' : '#0f172a'} />
          <path d="M11 35h23v4H11z" fill={fill} stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    default: // Pawn
      return (
        <svg viewBox="0 0 45 45" className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow">
          <circle cx="22.5" cy="13" r="4.5" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path
            d="M22.5 18c-3 0-5.5 3-5.5 8 0 2 1.5 4 3 5h5c1.5-1 3-3 3-5 0-5-2.5-8-5.5-8z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          <path d="M13 35h19v4H13z" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path d="M16 31h13v3H16z" fill={fill} stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
  }
};

export const CoVuaTableView: React.FC<CoVuaTableViewProps> = ({
  gameState,
  myPlayerId,
  onSendAction
}) => {
  const [selectedSquare, setSelectedSquare] = useState<{ r: number; c: number } | null>(null);
  const [turnNotice, setTurnNotice] = useState<string | null>(null);

  const myPlayer = gameState.players?.find(
    (p: any) => p.id === myPlayerId || p.sessionId === myPlayerId || p.userId === myPlayerId
  );
  // Default to white if player 0, else black
  const myColor: 'white' | 'black' =
    myPlayer?.color || (gameState.players?.[0]?.id === myPlayerId ? 'white' : 'black');
  const isMyTurn = myColor === gameState.activeColor;

  const board: any[][] = gameState.board || [];
  const isFlipped = myColor === 'black';

  // Calculate legal moves for piece at (r, c)
  const getValidMoves = (r: number, c: number): Array<{ r: number; c: number }> => {
    const piece = board[r]?.[c];
    if (!piece || piece.color !== myColor) return [];

    const moves: Array<{ r: number; c: number }> = [];

    const isPathClear = (fromR: number, fromC: number, toR: number, toC: number): boolean => {
      const sR = Math.sign(toR - fromR);
      const sC = Math.sign(toC - fromC);
      let curR = fromR + sR;
      let curC = fromC + sC;
      while (curR !== toR || curC !== toC) {
        if (board[curR]?.[curC] !== null && board[curR]?.[curC] !== undefined) return false;
        curR += sR;
        curC += sC;
      }
      return true;
    };

    const canMoveTo = (toR: number, toC: number): boolean => {
      if (toR < 0 || toR > 7 || toC < 0 || toC > 7) return false;
      const target = board[toR]?.[toC];
      if (target && target.color === piece.color) return false;

      const dr = toR - r;
      const dc = toC - c;
      const absDr = Math.abs(dr);
      const absDc = Math.abs(dc);

      switch (piece.type) {
        case 'p': {
          const forward = piece.color === 'white' ? -1 : 1;
          const startRow = piece.color === 'white' ? 6 : 1;
          // 1 step forward
          if (dc === 0 && dr === forward && !target) return true;
          // 2 steps forward from initial rank
          if (dc === 0 && dr === forward * 2 && r === startRow && !target && !board[r + forward]?.[c]) return true;
          // diagonal capture
          if (absDc === 1 && dr === forward && target && target.color !== piece.color) return true;
          return false;
        }
        case 'n':
          return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
        case 'b':
          if (absDr !== absDc) return false;
          return isPathClear(r, c, toR, toC);
        case 'r':
          if (dr !== 0 && dc !== 0) return false;
          return isPathClear(r, c, toR, toC);
        case 'q':
          if (absDr !== absDc && dr !== 0 && dc !== 0) return false;
          return isPathClear(r, c, toR, toC);
        case 'k':
          return absDr <= 1 && absDc <= 1;
        default:
          return false;
      }
    };

    for (let tr = 0; tr < 8; tr++) {
      for (let tc = 0; tc < 8; tc++) {
        if (canMoveTo(tr, tc)) {
          moves.push({ r: tr, c: tc });
        }
      }
    }

    return moves;
  };

  const validMoves = selectedSquare ? getValidMoves(selectedSquare.r, selectedSquare.c) : [];

  const handleSquareClick = (r: number, c: number) => {
    if (gameState.isGameOver) return;

    if (!isMyTurn) {
      setTurnNotice(`Chưa đến lượt của bạn! Đang là lượt của ${gameState.activeColor === 'white' ? 'Quân Trắng' : 'Quân Đen'}.`);
      setTimeout(() => setTurnNotice(null), 2500);
      return;
    }

    const piece = board[r]?.[c];

    if (selectedSquare) {
      // Clicking same square cancels selection
      if (selectedSquare.r === r && selectedSquare.c === c) {
        setSelectedSquare(null);
        return;
      }

      // If clicking another piece of own color, switch selection
      if (piece && piece.color === myColor) {
        setSelectedSquare({ r, c });
        sounds.playCardSnap();
        return;
      }

      // Check if target is a valid move
      const isValid = validMoves.some(m => m.r === r && m.c === c);
      if (isValid) {
        sounds.playCardWhoosh();
        onSendAction({
          type: 'MOVE_PIECE',
          from: selectedSquare,
          to: { r, c }
        });
        setSelectedSquare(null);
      } else {
        // Clicked invalid target -> deselect
        setSelectedSquare(null);
      }
    } else {
      // Pick own piece
      if (piece && piece.color === myColor) {
        setSelectedSquare({ r, c });
        sounds.playCardSnap();
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-between p-2 select-none font-sans relative pointer-events-auto">
      {/* Top Banner Status */}
      <div className="flex flex-col items-center gap-1 mb-1">
        <div className="flex items-center gap-3 bg-black/70 px-4 py-1.5 rounded-full border border-white/10 text-xs shadow-xl backdrop-blur-md">
          <span className="font-bold flex items-center gap-1.5">
            <span
              className={`w-3.5 h-3.5 rounded-full border border-white/30 transition-all ${
                gameState.activeColor === 'white'
                  ? 'bg-white shadow-[0_0_10px_#fff]'
                  : 'bg-black shadow-[0_0_10px_#000]'
              }`}
            />
            <span className="text-white tracking-wide">
              LƯỢT:{' '}
              {gameState.activeColor === 'white' ? 'QUÂN TRẮNG (WHITE)' : 'QUÂN ĐEN (BLACK)'}
            </span>
          </span>
          {isMyTurn ? (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 font-extrabold border border-emerald-400/40 text-[10px] animate-pulse tracking-wider">
              ĐẾN LƯỢT BẠN
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-[10px]">
              ĐỢI ĐỐI THỦ
            </span>
          )}
        </div>

        {turnNotice && (
          <div className="px-3 py-1 rounded-full bg-amber-500/90 text-slate-950 font-bold text-[11px] shadow-lg animate-bounce">
            {turnNotice}
          </div>
        )}
      </div>

      {/* 8x8 Chessboard Container */}
      <div className="relative w-full max-w-[480px] aspect-square rounded-2xl bg-[#3e2723] border-4 border-[#8d6e63] shadow-[0_0_50px_rgba(0,0,0,0.85)] p-2 flex flex-col justify-between overflow-hidden pointer-events-auto">
        <div className="w-full h-full grid grid-cols-8 grid-rows-8 border-2 border-black/40 rounded-lg overflow-hidden shadow-inner">
          {Array(8).fill(null).map((_, rIdx) => {
            const actualR = isFlipped ? 7 - rIdx : rIdx;

            return Array(8).fill(null).map((__, cIdx) => {
              const actualC = isFlipped ? 7 - cIdx : cIdx;
              const isDark = (actualR + actualC) % 2 === 1;
              const piece = board[actualR]?.[actualC];
              const isSelected = selectedSquare?.r === actualR && selectedSquare?.c === actualC;
              const isLastMove =
                (gameState.lastMove?.from.r === actualR && gameState.lastMove?.from.c === actualC) ||
                (gameState.lastMove?.to.r === actualR && gameState.lastMove?.to.c === actualC);
              const isValidTarget = validMoves.some(m => m.r === actualR && m.c === actualC);

              return (
                <div
                  key={`${actualR}-${actualC}`}
                  onClick={() => handleSquareClick(actualR, actualC)}
                  className={`relative flex items-center justify-center transition-all duration-150 cursor-pointer ${
                    isDark ? 'bg-[#b58863]' : 'bg-[#f0d9b5]'
                  } ${
                    isSelected
                      ? '!bg-amber-400/85 ring-4 ring-amber-400 z-20 shadow-[0_0_15px_rgba(245,158,11,0.8)]'
                      : ''
                  } ${isLastMove ? '!bg-sky-400/35' : ''}`}
                >
                  {/* Empty Valid Move Dot Indicator */}
                  {isValidTarget && !piece && (
                    <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-400 border-2 border-white/90 shadow-[0_0_10px_#34d399] animate-pulse z-10 pointer-events-none" />
                  )}

                  {/* Enemy Capture Reticle Highlight */}
                  {isValidTarget && piece && (
                    <div className="absolute inset-0 rounded-full border-4 border-rose-500 bg-rose-500/25 animate-pulse z-10 pointer-events-none" />
                  )}

                  {/* Chess Piece Render */}
                  {piece && (
                    <div
                      className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-150 transform hover:scale-110 active:scale-95 ${
                        isSelected ? 'scale-115 ring-2 ring-white shadow-2xl' : ''
                      } ${
                        piece.color === 'white'
                          ? 'bg-gradient-to-b from-[#ffffff] via-[#f1f5f9] to-[#cbd5e1] shadow-[0_4px_10px_rgba(0,0,0,0.5),inset_0_2px_2px_rgba(255,255,255,1),inset_0_-2px_3px_rgba(0,0,0,0.2)] border-2 border-[#fef08a] ring-1 ring-black/30'
                          : 'bg-gradient-to-b from-[#334155] via-[#1e293b] to-[#090d16] shadow-[0_4px_10px_rgba(0,0,0,0.7),inset_0_2px_2px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.8)] border-2 border-[#38bdf8]/80 ring-1 ring-black/50'
                      }`}
                    >
                      <ChessPieceSVG type={piece.type} color={piece.color} />
                    </div>
                  )}
                </div>
              );
            });
          })}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="mt-2 flex items-center gap-3 pointer-events-auto">
        <button
          onClick={() => onSendAction({ type: 'RESIGN' })}
          className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-rose-500/25 text-white/80 hover:text-rose-300 border border-white/15 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95"
        >
          <Flag className="w-3.5 h-3.5" />
          <span>Xin Thua</span>
        </button>
      </div>
    </div>
  );
};
