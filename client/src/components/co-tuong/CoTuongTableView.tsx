import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { sounds } from '../../utils/sound';

interface CoTuongTableViewProps {
  gameState: any;
  myPlayerId: string;
  onSendAction: (action: any) => void;
}

const XIANGQI_LABELS: Record<string, Record<string, string>> = {
  red: {
    tuong: '帥',
    si: '仕',
    voi: '相',
    xe: '俥',
    phao: '炮',
    ma: '傌',
    tot: '兵'
  },
  black: {
    tuong: '將',
    si: '士',
    voi: '象',
    xe: '車',
    phao: '砲',
    ma: '馬',
    tot: '卒'
  }
};

export const CoTuongTableView: React.FC<CoTuongTableViewProps> = ({
  gameState,
  myPlayerId,
  onSendAction
}) => {
  const [selectedSquare, setSelectedSquare] = useState<{ r: number; c: number } | null>(null);
  const [turnNotice, setTurnNotice] = useState<string | null>(null);

  const myPlayer = gameState.players?.find(
    (p: any) => p.id === myPlayerId || p.sessionId === myPlayerId || p.userId === myPlayerId
  );
  const myColor: 'red' | 'black' =
    myPlayer?.color || (gameState.players?.[0]?.id === myPlayerId ? 'red' : 'black');
  const isMyTurn = myColor === gameState.activeColor;

  const board: any[][] = gameState.board || [];
  const isFlipped = myColor === 'black';

  // Count pieces strictly between two collinear points
  const countPiecesBetween = (from: { r: number; c: number }, to: { r: number; c: number }): number => {
    const stepR = Math.sign(to.r - from.r);
    const stepC = Math.sign(to.c - from.c);
    let count = 0;
    let curR = from.r + stepR;
    let curC = from.c + stepC;
    while (curR !== to.r || curC !== to.c) {
      if (board[curR]?.[curC] !== null && board[curR]?.[curC] !== undefined) {
        count++;
      }
      curR += stepR;
      curC += stepC;
    }
    return count;
  };

  // Calculate valid moves according to Xiangqi rules
  const getValidMoves = (r: number, c: number): Array<{ r: number; c: number }> => {
    const piece = board[r]?.[c];
    if (!piece || piece.color !== myColor) return [];

    const moves: Array<{ r: number; c: number }> = [];

    const canMoveTo = (toR: number, toC: number): boolean => {
      if (toR < 0 || toR > 9 || toC < 0 || toC > 8) return false;
      const target = board[toR]?.[toC];
      if (target && target.color === piece.color) return false;

      const dr = toR - r;
      const dc = toC - c;
      const absDr = Math.abs(dr);
      const absDc = Math.abs(dc);

      switch (piece.type) {
        case 'tuong': { // General (Cung tướng: col 3..5, Red: row 7..9, Black: row 0..2)
          if (absDr + absDc !== 1) return false;
          if (toC < 3 || toC > 5) return false;
          if (piece.color === 'red' && (toR < 7 || toR > 9)) return false;
          if (piece.color === 'black' && (toR < 0 || toR > 2)) return false;
          return true;
        }

        case 'si': { // Advisor (diagonal 1 step inside palace)
          if (absDr !== 1 || absDc !== 1) return false;
          if (toC < 3 || toC > 5) return false;
          if (piece.color === 'red' && (toR < 7 || toR > 9)) return false;
          if (piece.color === 'black' && (toR < 0 || toR > 2)) return false;
          return true;
        }

        case 'voi': { // Elephant (diagonal 2 steps, cannot cross river, eye of elephant cannot be blocked)
          if (absDr !== 2 || absDc !== 2) return false;
          if (piece.color === 'red' && toR < 5) return false;
          if (piece.color === 'black' && toR > 4) return false;
          const eyeR = r + dr / 2;
          const eyeC = c + dc / 2;
          if (board[eyeR]?.[eyeC] !== null && board[eyeR]?.[eyeC] !== undefined) return false;
          return true;
        }

        case 'ma': { // Horse (L-shape, check blocking horse foot)
          if (!((absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2))) return false;
          if (absDr === 2) {
            const footR = r + Math.sign(dr);
            if (board[footR]?.[c] !== null && board[footR]?.[c] !== undefined) return false;
          } else {
            const footC = c + Math.sign(dc);
            if (board[r]?.[footC] !== null && board[r]?.[footC] !== undefined) return false;
          }
          return true;
        }

        case 'xe': { // Chariot (orthogonal path clear)
          if (dr !== 0 && dc !== 0) return false;
          return countPiecesBetween({ r, c }, { r: toR, c: toC }) === 0;
        }

        case 'phao': { // Cannon (orthogonal, empty to move, jumps 1 piece to capture)
          if (dr !== 0 && dc !== 0) return false;
          const between = countPiecesBetween({ r, c }, { r: toR, c: toC });
          if (target) {
            return between === 1; // Jumps over exactly 1 piece
          } else {
            return between === 0; // Clear path
          }
        }

        case 'tot': { // Soldier
          const forward = piece.color === 'red' ? -1 : 1;
          const crossedRiver = piece.color === 'red' ? r <= 4 : r >= 5;
          // Forward 1 step
          if (dr === forward && dc === 0) return true;
          // Sideways 1 step if crossed river
          if (crossedRiver && dr === 0 && absDc === 1) return true;
          return false;
        }

        default:
          return false;
      }
    };

    for (let tr = 0; tr < 10; tr++) {
      for (let tc = 0; tc < 9; tc++) {
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
      setTurnNotice(`Chưa đến lượt của bạn! Đang là lượt của ${gameState.activeColor === 'red' ? 'Quân Đỏ' : 'Quân Đen'}.`);
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

      // Switch piece if clicked own piece
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
              className={`w-3.5 h-3.5 rounded-full ${
                gameState.activeColor === 'red'
                  ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                  : 'bg-slate-300 shadow-[0_0_8px_#cbd5e1]'
              }`}
            />
            <span className="text-white tracking-wide">
              LƯỢT: {gameState.activeColor === 'red' ? 'QUÂN ĐỎ (RED)' : 'QUÂN ĐEN (BLACK)'}
            </span>
          </span>
          {isMyTurn ? (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 font-extrabold border border-emerald-400/40 text-[10px] animate-pulse tracking-wider">
              ĐẾN LƯỢT BẠN
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/50 text-[10px]">
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

      {/* Authentic Xiangqi Board matching reference image perfectly */}
      <div className="relative w-full max-w-[460px] aspect-[9/10] rounded-2xl bg-[#a04000] p-1.5 sm:p-2 shadow-[0_0_50px_rgba(0,0,0,0.85)] border-4 border-[#6e2900] flex items-center justify-center overflow-hidden pointer-events-auto">
        <svg
          viewBox="0 0 900 1000"
          className="w-full h-full rounded-xl select-none"
          style={{ pointerEvents: 'all' }}
        >
          {/* Outer Brown Wood Frame Border */}
          <rect x="0" y="0" width="900" height="1000" fill="#b85d19" rx="20" />

          {/* Yellow Board Surface */}
          <rect
            x="35"
            y="35"
            width="830"
            height="930"
            fill="#f8a846"
            stroke="#26170d"
            strokeWidth="3.5"
            rx="6"
          />

          {/* 10 Horizontal Grid Lines (each intersection at y = 95 + r*90) */}
          {Array.from({ length: 10 }).map((_, r) => (
            <line
              key={`h-${r}`}
              x1="90"
              y1={95 + r * 90}
              x2="810"
              y2={95 + r * 90}
              stroke="#222"
              strokeWidth="2.5"
            />
          ))}

          {/* Vertical Border Lines (connect all 10 rows completely) */}
          <line x1="90" y1="95" x2="90" y2="905" stroke="#222" strokeWidth="3" />
          <line x1="810" y1="95" x2="810" y2="905" stroke="#222" strokeWidth="3" />

          {/* Interior Vertical Lines (col 1..7): Broken across River between row 4 (y=455) and row 5 (y=545) */}
          {Array.from({ length: 7 }).map((_, i) => {
            const x = 180 + i * 90;
            return (
              <React.Fragment key={`v-${i}`}>
                {/* Top Half: row 0 to row 4 */}
                <line x1={x} y1="95" x2={x} y2="455" stroke="#222" strokeWidth="2.2" />
                {/* Bottom Half: row 5 to row 9 */}
                <line x1={x} y1="545" x2={x} y2="905" stroke="#222" strokeWidth="2.2" />
              </React.Fragment>
            );
          })}

          {/* Top Palace Diagonals (X in Cung Tướng trên, row 0..2, col 3..5) */}
          <line x1="360" y1="95" x2="540" y2="275" stroke="#222" strokeWidth="2.2" />
          <line x1="540" y1="95" x2="360" y2="275" stroke="#222" strokeWidth="2.2" />

          {/* Bottom Palace Diagonals (X in Cung Tướng dưới, row 7..9, col 3..5) */}
          <line x1="360" y1="725" x2="540" y2="905" stroke="#222" strokeWidth="2.2" />
          <line x1="540" y1="725" x2="360" y2="905" stroke="#222" strokeWidth="2.2" />

          {/* All 90 Intersections & Piece Tokens (Intersection cx = 90 + c*90, cy = 95 + r*90) */}
          {Array.from({ length: 10 }).map((_, rIdx) => {
            const actualR = isFlipped ? 9 - rIdx : rIdx;
            const cy = 95 + rIdx * 90;

            return Array.from({ length: 9 }).map((__, cIdx) => {
              const actualC = isFlipped ? 8 - cIdx : cIdx;
              const cx = 90 + cIdx * 90;

              const piece = board[actualR]?.[actualC];
              const isSelected = selectedSquare?.r === actualR && selectedSquare?.c === actualC;
              const isLastMove =
                (gameState.lastMove?.from.r === actualR && gameState.lastMove?.from.c === actualC) ||
                (gameState.lastMove?.to.r === actualR && gameState.lastMove?.to.c === actualC);
              const isValidTarget = validMoves.some(m => m.r === actualR && m.c === actualC);
              const label = piece ? XIANGQI_LABELS[piece.color]?.[piece.type] || piece.type : '';

              return (
                <g key={`int-${rIdx}-${cIdx}`}>
                  {/* Invisible 86x86 Hit Target Centered at Line Crossing (Guarantees 100% Reliable Clicks!) */}
                  <rect
                    x={cx - 43}
                    y={cy - 43}
                    width="86"
                    height="86"
                    fill="#000000"
                    fillOpacity="0.001"
                    className="cursor-pointer"
                    style={{ pointerEvents: 'all' }}
                    onClick={() => handleSquareClick(actualR, actualC)}
                  />

                  {/* Last Move Indicator Ring */}
                  {isLastMove && (
                    <circle cx={cx} cy={cy} r="43" fill="none" stroke="#0284c7" strokeWidth="3.5" opacity="0.85" pointerEvents="none" />
                  )}

                  {/* Empty Valid Move Dot Indicator */}
                  {isValidTarget && !piece && (
                    <g pointerEvents="none">
                      <circle cx={cx} cy={cy} r="18" fill="rgba(16, 185, 129, 0.45)" stroke="#10b981" strokeWidth="2.5" />
                      <circle cx={cx} cy={cy} r="6" fill="#10b981" className="animate-pulse" />
                    </g>
                  )}

                  {/* Enemy Capture Reticle Highlight */}
                  {isValidTarget && piece && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="43"
                      fill="rgba(239, 68, 68, 0.3)"
                      stroke="#ef4444"
                      strokeWidth="4"
                      strokeDasharray="8 4"
                      className="animate-pulse"
                      pointerEvents="none"
                    />
                  )}

                  {/* Selected Piece Highlight Halo */}
                  {isSelected && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="44"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="5"
                      strokeDasharray="8 4"
                      className="animate-spin"
                      pointerEvents="none"
                    />
                  )}

                  {/* Piece Token (Authentic Double-Concentric Wooden Disc at Line Intersection) */}
                  {piece && (
                    <g
                      className="cursor-pointer transition-transform duration-100"
                      onClick={() => handleSquareClick(actualR, actualC)}
                      style={{ pointerEvents: 'all' }}
                    >
                      {/* 3D Drop Shadow */}
                      <circle cx={cx + 2} cy={cy + 3} r="37" fill="rgba(0,0,0,0.35)" />

                      {/* Main Ivory/Wood Token Body */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r="37"
                        fill="#fcead2"
                        stroke={piece.color === 'red' ? '#c5221f' : '#18181b'}
                        strokeWidth="2.8"
                      />

                      {/* Concentric Inner Ring */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r="31"
                        fill="none"
                        stroke={piece.color === 'red' ? '#c5221f' : '#18181b'}
                        strokeWidth="1.6"
                      />

                      {/* Chinese Calligraphy Character */}
                      <text
                        x={cx}
                        y={cy + 12}
                        textAnchor="middle"
                        fill={piece.color === 'red' ? '#c5221f' : '#18181b'}
                        fontSize="34"
                        fontFamily="'Noto Serif SC', 'Songti SC', 'SimSun', serif"
                        fontWeight="bold"
                        style={{ userSelect: 'none' }}
                      >
                        {label}
                      </text>
                    </g>
                  )}
                </g>
              );
            });
          })}
        </svg>
      </div>

      {/* Bottom Controls */}
      <div className="mt-1 flex items-center gap-3 pointer-events-auto">
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
