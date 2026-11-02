import React from 'react';
import { motion } from 'framer-motion';
import { GameType } from '../../types/game';
import { UnoCardView } from '../uno/UnoCardView';
import { EKCardView } from '../exploding-kittens/EKCardView';

interface OpponentSeatProps {
  player: {
    id: string;
    name: string;
    avatar: string;
    isBot: boolean;
    cardCount: number;
    connected: boolean;
    eliminated?: boolean;
    isCong?: boolean;
  };
  gameType: GameType;
  isCurrentTurn: boolean;
  position: 'left' | 'top' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const AVATAR_EMOJIS: Record<string, string> = {
  'av-fox': '🦊',
  'av-cat': '🐱',
  'av-robot': '🤖',
  'av-dragon': '🐉',
  'av-wizard': '🧙',
  'av-ninja': '🥷',
  'av-tiger': '🐯',
  'av-bear': '🐻',
  'bot-1': '🤖',
  'bot-2': '🛸',
  'bot-3': '👾',
  'bot-4': '🦾',
  'cat-1': '😸',
  'cat-2': '😻',
  'ninja': '🥷',
  'wizard': '🧙'
};

export const OpponentSeat: React.FC<OpponentSeatProps> = ({
  player,
  gameType,
  isCurrentTurn,
  position
}) => {
  const count = Math.max(0, player.cardCount);
  const visualCardCount = Math.min(count, 5);
  const emoji = AVATAR_EMOJIS[player.avatar] || (player.isBot ? '🤖' : '👤');

  const renderCardBack = (idx: number, angle: number) => {
    return (
      <motion.div
        key={idx}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          transform: `rotate(${angle}deg)`,
          zIndex: idx + 1
        }}
        className="relative transition-transform pointer-events-none"
      >
        {gameType === 'uno' ? (
          <UnoCardView isBack={true} className="!w-11 sm:!w-13 !h-16 sm:!h-19 !rounded-xl shadow-xl" />
        ) : gameType === 'exploding-kittens' ? (
          <EKCardView isBack={true} className="!w-11 sm:!w-13 !h-16 sm:!h-19 !rounded-xl shadow-xl" />
        ) : (
          /* Tiến Lên PlayStation Dark Arena Card Back */
          <div
            className="w-11 sm:w-13 h-16 sm:h-19 rounded-xl bg-gradient-to-br from-[#0c1833] via-[#002244] to-[#001020] border border-[#0070d1]/60 p-0.5 shadow-xl flex items-center justify-center text-white"
          >
            <div className="w-full h-full border border-white/20 rounded flex flex-col items-center justify-center text-[10px] font-black">
              <span className="text-[#00f0ff] text-xs">♠️</span>
              <span className="text-[8px] text-white/50 tracking-tighter">PS</span>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  const renderCardFan = () => {
    if (count === 0) return null;
    const cards = Array.from({ length: visualCardCount });

    if (position === 'left' || position === 'bottom-left') {
      return (
        <div className="flex -space-x-7 sm:-space-x-8 items-center transform rotate-12 mt-1">
          {cards.map((_, i) => {
            const angle = (i - (visualCardCount - 1) / 2) * 5;
            return renderCardBack(i, angle);
          })}
        </div>
      );
    }

    if (position === 'right' || position === 'bottom-right') {
      return (
        <div className="flex -space-x-7 sm:-space-x-8 items-center transform -rotate-12 mt-1">
          {cards.map((_, i) => {
            const angle = (i - (visualCardCount - 1) / 2) * 5;
            return renderCardBack(i, angle);
          })}
        </div>
      );
    }

    return (
      <div className="flex -space-x-7 sm:-space-x-8 items-center justify-center mt-1">
        {cards.map((_, i) => {
          const angle = (i - (visualCardCount - 1) / 2) * 6;
          return renderCardBack(i, angle);
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center select-none font-sans">
      {/* Player Name Pill */}
      <div className="flex items-center gap-1 mb-1">
        <div className={`px-3 py-0.5 rounded-full border shadow-md flex items-center gap-1.5 transition-all ${
          isCurrentTurn
            ? 'bg-[#0070d1] border-[#00f0ff] text-white font-bold shadow-[0_0_15px_rgba(0,240,255,0.5)] scale-105'
            : 'bg-[#181818]/90 border-white/15 text-white/80'
        }`}>
          <span className="text-[11px] font-semibold tracking-wide truncate max-w-[85px]">
            {player.name}
          </span>
          {player.isBot && <span className={`text-[8px] font-bold px-1 py-0.2 rounded-full ${isCurrentTurn ? 'bg-white/20 text-white' : 'bg-[#0070d1]/30 text-[#53b1ff]'}`}>AI</span>}
        </div>
      </div>

      {/* Avatar Container & Card Counter */}
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <div
            className={`w-11 sm:w-13 h-11 sm:h-13 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shadow-xl transition-all ${
              isCurrentTurn
                ? 'bg-gradient-to-b from-[#0070d1] to-[#004d8d] ring-2 ring-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.6)] animate-pulse'
                : 'bg-[#181818] border border-white/15'
            }`}
          >
            {emoji}
          </div>

          {!player.connected && (
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 border border-black shadow" title="Mất kết nối" />
          )}
        </div>

        {/* Card Counter Pill with PlayStation Style */}
        <div className="flex items-center bg-[#181818] text-white px-2.5 py-1 rounded-full shadow-lg border border-white/20 font-bold text-xs gap-1">
          {gameType === 'uno' ? (
            <span className="text-[10px] text-[#0070d1] font-black">UNO</span>
          ) : (
            <span className="text-xs">🃏</span>
          )}
          <span className="text-white">{count}</span>
        </div>
      </div>

      {/* Face-Down Hand Fan */}
      <div className="relative">
        {renderCardFan()}
        <div className="w-full h-2 bg-gradient-to-b from-[#0070d1]/10 to-transparent blur-sm mt-0.5 pointer-events-none" />
      </div>

      {/* Knockout Badge */}
      {player.eliminated && (
        <span className="mt-1 px-2.5 py-0.5 rounded-full bg-rose-600/90 text-white font-bold text-[9px] uppercase shadow">
          💀 ĐÃ BỊ LOẠI
        </span>
      )}

      {/* Sâm Lốc Badges */}
      {(player as any).isBaoMot && (
        <span className="mt-1 px-2.5 py-0.5 rounded-full bg-[#f5a623] text-black font-extrabold text-[9px] uppercase shadow animate-bounce">
          ⚠️ BÁO 1 LÁ!
        </span>
      )}
      {(player as any).isBaoSam && (
        <span className="mt-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#ffce21] to-[#ee8e00] text-black font-extrabold text-[9px] uppercase shadow">
          👑 BÁO SÂM
        </span>
      )}
      {(player as any).isDenSam && (
        <span className="mt-1 px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-bold text-[9px] uppercase shadow">
          ❌ ĐỀN SÂM
        </span>
      )}
    </div>
  );
};

export default OpponentSeat;
