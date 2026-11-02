import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Dices, ArrowRight } from 'lucide-react';
import { sounds } from '../../utils/sound';

interface CoCaNguaTableViewProps {
  gameState: any;
  myPlayerId: string;
  onSendAction: (action: any) => void;
}

const COLOR_STYLES: Record<string, { bg: string; text: string; border: string; label: string; stablePos: string }> = {
  red: { bg: 'bg-rose-600', text: 'text-rose-400', border: 'border-rose-500', label: 'ĐỎ', stablePos: 'top-2 left-2' },
  blue: { bg: 'bg-blue-600', text: 'text-blue-400', border: 'border-blue-500', label: 'XANH DƯƠNG', stablePos: 'top-2 right-2' },
  yellow: { bg: 'bg-amber-500', text: 'text-amber-300', border: 'border-amber-400', label: 'VÀNG', stablePos: 'bottom-2 right-2' },
  green: { bg: 'bg-emerald-600', text: 'text-emerald-400', border: 'border-emerald-500', label: 'XANH LÁ', stablePos: 'bottom-2 left-2' }
};

export const CoCaNguaTableView: React.FC<CoCaNguaTableViewProps> = ({
  gameState,
  myPlayerId,
  onSendAction
}) => {
  const [rollingAnim, setRollingAnim] = useState(false);

  const currentPlayer = gameState.players[gameState.currentTurnIndex];
  const isMyTurn = currentPlayer?.id === myPlayerId;
  const myPlayer = gameState.players.find((p: any) => p.id === myPlayerId);

  const handleRollDice = () => {
    if (!isMyTurn || myPlayer?.hasRolled) return;
    setRollingAnim(true);
    sounds.playCardSnap();
    setTimeout(() => {
      setRollingAnim(false);
      onSendAction({ type: 'ROLL_DICE' });
    }, 400);
  };

  const handleSelectHorse = (horse: any) => {
    if (!isMyTurn || !myPlayer?.hasRolled) return;
    sounds.playCardWhoosh();

    if (horse.status === 'stable') {
      if (gameState.currentDice === 6 || gameState.currentDice === 1) {
        onSendAction({ type: 'DEPLOY', horseId: horse.id });
      }
    } else {
      onSendAction({ type: 'MOVE_HORSE', horseId: horse.id });
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-between p-2 select-none font-sans relative">
      {/* Center Co Ca Ngua Board Arena (Fitted into screen) */}
      <div className="relative w-full max-w-[540px] aspect-square rounded-3xl bg-[#0c101c] border-4 border-[#0070d1]/40 shadow-[0_0_50px_rgba(0,112,209,0.3)] p-3 flex flex-col justify-between overflow-hidden">
        {/* Board Background Cross Pattern */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-20 bg-white/[0.03] border-y border-white/5 pointer-events-none" />
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-20 bg-white/[0.03] border-x border-white/5 pointer-events-none" />

        {/* 4 Corner Stables (Chuồng ngựa 4 màu) */}
        {gameState.players.map((p: any) => {
          const style = COLOR_STYLES[p.color] || COLOR_STYLES.red;
          const isPlayerTurn = p.id === currentPlayer?.id;

          return (
            <div
              key={p.id}
              className={`absolute ${style.stablePos} p-2 rounded-2xl border-2 ${style.border} ${
                isPlayerTurn ? 'bg-white/10 ring-4 ring-[#0070d1]/50 shadow-lg' : 'bg-black/50'
              } flex flex-col items-center gap-1.5 w-24 sm:w-28`}
            >
              <div className="flex items-center gap-1 text-[10px] font-black tracking-wide text-white">
                <span className={`w-2 h-2 rounded-full ${style.bg}`} />
                <span className="truncate max-w-[70px]">{p.name}</span>
              </div>

              {/* 4 Horses in Stable */}
              <div className="grid grid-cols-2 gap-1.5 w-full">
                {p.horses.map((horse: any, hIdx: number) => {
                  const inStable = horse.status === 'stable';
                  const inGoal = horse.status === 'goal';
                  const isSelectable = isMyTurn && p.id === myPlayerId && myPlayer?.hasRolled && inStable && (gameState.currentDice === 6 || gameState.currentDice === 1);

                  return (
                    <button
                      key={horse.id || hIdx}
                      onClick={() => handleSelectHorse(horse)}
                      disabled={!isSelectable}
                      className={`h-7 rounded-lg flex items-center justify-center text-sm font-bold border transition-all cursor-pointer ${
                        inGoal
                          ? 'bg-amber-400 text-black border-amber-300 shadow'
                          : inStable
                          ? `${style.bg} text-white border-white/20 hover:scale-105 active:scale-95 ${isSelectable ? 'animate-bounce ring-2 ring-yellow-400' : 'opacity-80'}`
                          : 'bg-black/40 border-dashed border-white/20 text-white/40'
                      }`}
                      title={inGoal ? 'Đã về đích' : inStable ? 'Trong chuồng' : 'Đang trên đường đua'}
                    >
                      {inGoal ? '⭐' : inStable ? '🐴' : '👟'}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Center Dice Control & Goal Arena */}
        <div className="absolute inset-0 m-auto w-36 h-36 rounded-full bg-gradient-to-br from-[#121624] to-[#080b14] border-4 border-amber-400/40 shadow-2xl flex flex-col items-center justify-center p-2 z-20">
          <div className="text-[10px] font-extrabold uppercase text-amber-300 tracking-wider mb-1">
            {isMyTurn ? 'LƯỢT CỦA BẠN' : `LƯỢT: ${currentPlayer?.name}`}
          </div>

          {/* Dice Box */}
          <div className="relative w-12 h-12 rounded-xl bg-white text-slate-900 border-2 border-slate-300 shadow-xl flex items-center justify-center text-2xl font-black mb-1">
            {rollingAnim ? (
              <motion.span
                animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.2 }}
              >
                🎲
              </motion.span>
            ) : gameState.currentDice ? (
              <span>{gameState.currentDice}</span>
            ) : (
              <span className="text-sm text-slate-400">?</span>
            )}
          </div>

          {/* Roll Button */}
          {isMyTurn && !myPlayer?.hasRolled && (
            <button
              onClick={handleRollDice}
              disabled={rollingAnim}
              className="px-3 py-1 rounded-full bg-[#0070d1] hover:bg-[#0060b5] active:scale-95 text-white font-extrabold text-[10px] uppercase tracking-wider shadow-[0_0_15px_rgba(0,112,209,0.5)] flex items-center gap-1 transition-all cursor-pointer"
            >
              <Dices className="w-3 h-3 text-yellow-300" />
              <span>LẮC XÚC XẮC</span>
            </button>
          )}

          {isMyTurn && myPlayer?.hasRolled && (
            <span className="text-[9px] font-bold text-emerald-400 animate-pulse text-center leading-tight">
              Chọn ngựa để xuất quân hoặc tiến bước!
            </span>
          )}
        </div>

        {/* Track Horses list in bottom HUD */}
        <div className="absolute bottom-2 inset-x-20 z-10 flex items-center justify-center gap-2 pointer-events-auto">
          {myPlayer?.horses.filter((h: any) => h.status === 'track' || h.status === 'homestretch').map((h: any, i: number) => (
            <button
              key={h.id}
              onClick={() => handleSelectHorse(h)}
              disabled={!isMyTurn || !myPlayer?.hasRolled}
              className="px-2.5 py-1 rounded-xl bg-[#0070d1]/30 hover:bg-[#0070d1]/60 border border-[#0070d1] text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              <span>🐴 Ngựa #{i + 1}</span>
              <span className="text-[10px] text-amber-300">
                {h.status === 'track' ? `Ô ${h.trackPos}` : `Bậc ${h.homestretchStep}`}
              </span>
              <ArrowRight className="w-3 h-3 text-emerald-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
