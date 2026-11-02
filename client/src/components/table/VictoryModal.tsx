import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Crown, RotateCcw, Trophy, Sparkles } from 'lucide-react';
import { sounds } from '../../utils/sound';

interface VictoryModalProps {
  winners: string[];
  players: { id: string; name: string; avatar: string; isBot: boolean }[];
  isHost: boolean;
  onRestartGame: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  winners,
  players,
  isHost,
  onRestartGame
}) => {
  useEffect(() => {
    sounds.playVictory();
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 }
    });
  }, []);

  const winnerPlayer = players.find(p => p.id === winners[0]);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#181818] border border-[#f5a623]/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-[0_0_60px_rgba(245,166,35,0.25)] text-center animate-bounce-short relative overflow-hidden">
        {/* PlayStation Ambient Gold & Blue Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#f5a623]/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#0070d1]/20 blur-3xl rounded-full pointer-events-none" />

        {/* PlayStation Trophy Badge */}
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#ffce21] via-[#f5a623] to-[#ee8e00] flex items-center justify-center text-black shadow-[0_0_30px_rgba(245,166,35,0.4)]">
          <Trophy className="w-10 h-10" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#f5a623]/15 text-[#f5a623] text-[10px] font-bold uppercase tracking-wider mb-2">
          <Sparkles className="w-3 h-3" /> PlayStation Trophy Unlocked
        </div>

        <h2 className="text-3xl font-light text-white tracking-tight mb-1">
          CHIẾN THẮNG!
        </h2>
        <p className="text-white/50 text-xs mb-6">Trận đấu đã khép lại với những pha lật kèo đỉnh cao!</p>

        {/* Winner Highlight */}
        <div className="p-4 rounded-2xl bg-white/[0.04] border border-[#f5a623]/30 mb-6 flex items-center justify-center gap-3.5">
          <Crown className="w-7 h-7 text-[#f5a623] flex-shrink-0" />
          <div className="text-left">
            <span className="text-[10px] text-[#f5a623] font-bold uppercase tracking-wider block">Quán Quân Ván Đấu</span>
            <span className="text-lg font-bold text-white">{winnerPlayer?.name || 'Người Thắng'}</span>
          </div>
        </div>

        {/* Standings List */}
        <div className="space-y-2 mb-6 text-left max-h-40 overflow-y-auto pr-1">
          {winners.map((wid, idx) => {
            const p = players.find(player => player.id === wid);
            return (
              <div
                key={wid}
                className="flex items-center justify-between p-2.5 rounded-full bg-white/[0.03] border border-white/10 text-xs"
              >
                <div className="flex items-center gap-2 pl-1">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    idx === 0 ? 'bg-[#f5a623] text-black font-extrabold' : 'bg-white/10 text-white/70'
                  }`}>
                    #{idx + 1}
                  </span>
                  <span className="font-medium text-white">{p?.name || 'Người chơi'}</span>
                </div>
                <span className="text-white/40 text-[11px] pr-2">{idx === 0 ? 'Vô Địch' : 'Hoàn Thành'}</span>
              </div>
            );
          })}
        </div>

        {isHost ? (
          <button
            onClick={onRestartGame}
            className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-[#ffce21] via-[#f5a623] to-[#ee8e00] hover:brightness-110 text-black font-extrabold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(245,166,35,0.4)] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Về Lại Phòng Chờ
          </button>
        ) : (
          <p className="text-xs text-white/40">Đang chờ chủ phòng quay về phòng chờ...</p>
        )}
      </div>
    </div>
  );
};

export default VictoryModal;
