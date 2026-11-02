import React, { useEffect, useState } from 'react';
import { Flame, RefreshCw, Sparkles, Trophy, Users } from 'lucide-react';
import { PublicUser } from '../../types/game';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../i18n/LanguageContext';

type LeaderboardTab = 'all' | 'uno' | 'exploding-kittens' | 'tien-len' | 'items';

interface LeaderboardViewProps {
  onClose?: () => void;
}

const AVATAR_MAP: Record<string, string> = {
  'av-fox': '🦊',
  'av-cat': '🐱',
  'av-robot': '🤖',
  'av-dragon': '🐉',
  'av-wizard': '🧙',
  'av-ninja': '🥷',
  'av-tiger': '🐯',
  'av-bear': '🐻'
};

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('all');
  const [leaderboard, setLeaderboard] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = async (tab: LeaderboardTab) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?gameType=${tab}`);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.leaderboard)) {
        setLeaderboard(data.leaderboard);
      }
    } catch (err) {
      console.error('[Leaderboard] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(activeTab);
  }, [activeTab]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ffce21] via-[#f5a623] to-[#ee8e00] flex items-center justify-center text-black font-extrabold shadow-[0_0_15px_rgba(245,166,35,0.4)]">
          1
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 flex items-center justify-center text-black font-extrabold shadow-sm">
          2
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white font-extrabold shadow-sm">
          3
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 font-semibold text-xs">
        #{rank}
      </div>
    );
  };

  const getBestItem = (u: PublicUser) => {
    const inv = u.inventory || [];
    if (inv.length === 0) return null;
    return inv.reduce((best, it) => (it.value || 0) > (best.value || 0) ? it : best, inv[0]);
  };

  const getWinsForTab = (u: PublicUser, tab: LeaderboardTab) => {
    switch (tab) {
      case 'uno':
        return u.stats.unoWins;
      case 'exploding-kittens':
        return u.stats.explodingKittensWins;
      case 'tien-len':
        return u.stats.tienLenWins;
      case 'items': {
        const best = getBestItem(u);
        return best ? best.value || 0 : 0;
      }
      default:
        return u.stats.totalWins;
    }
  };

  const getTabLabel = (tab: LeaderboardTab) => {
    switch (tab) {
      case 'uno':
        return t('lb.unoWinsCol');
      case 'exploding-kittens':
        return t('lb.ekWinsCol');
      case 'tien-len':
        return t('lb.tlWinsCol');
      case 'items':
        return 'Giá trị đồ';
      default:
        return t('lb.totalWinsCol');
    }
  };

  return (
    <div className="w-full bg-[#181818] border border-white/10 rounded-3xl p-5 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ffce21] via-[#f5a623] to-[#ee8e00] flex items-center justify-center text-black shadow-lg shadow-amber-500/30 flex-shrink-0">
            <Trophy className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-light text-white tracking-tight">
                {t('lb.title')}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#f5a623]/20 border border-[#f5a623]/40 text-[10px] font-bold text-[#f5a623] uppercase tracking-wider">
                {t('lb.season')}
              </span>
            </div>
            <p className="text-xs text-white/50 mt-0.5">
              {t('lb.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLeaderboard(activeTab)}
            disabled={loading}
            className="ps-btn-secondary !px-3.5 !py-1.5 !text-xs disabled:opacity-50 cursor-pointer"
            title="Làm mới bảng xếp hạng"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('lb.refresh')}</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="ps-btn-secondary !px-3.5 !py-1.5 !text-xs"
            >
              {t('c.close')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-6 bg-[#121314] p-1.5 rounded-full border border-white/10">
        {[
          { id: 'all', label: t('lb.tabAll') },
          { id: 'uno', label: t('lb.tabUno') },
          { id: 'exploding-kittens', label: t('lb.tabEk') },
          { id: 'tien-len', label: t('lb.tabTl') },
          { id: 'items', label: 'Top Đồ Xịn' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as LeaderboardTab)}
            className={`py-2 px-3 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#0070d1] text-white shadow-[0_0_15px_rgba(0,112,209,0.4)]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Leaderboard Table / Cards */}
      <div className="flex-1 overflow-y-auto max-h-[480px] pr-1 space-y-2.5">
        {loading && leaderboard.length === 0 ? (
          <div className="py-16 text-center text-white/50 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-[#0070d1] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold">{t('lb.loading')}</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="py-16 text-center text-white/40 bg-white/[0.02] rounded-2xl border border-white/10">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-semibold text-white/60">{t('lb.empty')}</p>
            <p className="text-xs text-white/40 mt-1">{t('lb.emptySub')}</p>
          </div>
        ) : (
          leaderboard.map((playerItem, index) => {
            const rank = index + 1;
            const isMe = user?.id === playerItem.id;
            const wins = getWinsForTab(playerItem, activeTab);
            const totalGames = playerItem.stats.totalGames || wins;
            const winRate = totalGames > 0 ? Math.round((playerItem.stats.totalWins / totalGames) * 100) : 0;
            const avatarEmoji = AVATAR_MAP[playerItem.avatar] || '👤';

            return (
              <div
                key={playerItem.id}
                className={`relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  isMe
                    ? 'bg-[#0070d1]/15 border-[#0070d1] shadow-[0_0_15px_rgba(0,112,209,0.3)] ring-1 ring-[#00f0ff]/40'
                    : rank === 1
                    ? 'bg-white/[0.04] border-[#f5a623]/40'
                    : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                }`}
              >
                {/* Left: Rank + Avatar + Name */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex-shrink-0">{getRankBadge(rank)}</div>

                  <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-2xl flex-shrink-0 shadow">
                    {avatarEmoji}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white truncate">
                        {playerItem.displayName}
                      </span>
                      {isMe && (
                        <span className="px-2 py-0.5 rounded-full bg-[#0070d1] text-[9px] font-bold text-white uppercase tracking-wider">
                          {t('lb.you')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <span>@{playerItem.username}</span>
                      <span>•</span>
                      <span>{playerItem.stats.totalGames} {t('lb.matches')}</span>
                      <span>•</span>
                      <span className="text-[#53b1ff] font-semibold">{winRate}% {t('lb.winRate')}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Wins Highlight & Breakdown */}
                <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
                  {/* Detailed breakdown on larger screens */}
                  <div className="hidden md:flex items-center gap-3 text-xs text-white/50 font-medium">
                    <span title="UNO Wins" className="flex items-center gap-1">
                      🔴 <strong className="text-white">{playerItem.stats.unoWins}</strong>
                    </span>
                    <span title="Mèo Nổ Wins" className="flex items-center gap-1">
                      💣 <strong className="text-white">{playerItem.stats.explodingKittensWins}</strong>
                    </span>
                    <span title="Tiến Lên Wins" className="flex items-center gap-1">
                      🎴 <strong className="text-white">{playerItem.stats.tienLenWins}</strong>
                    </span>
                  </div>

                  {/* Primary Tab Wins Counter */}
                  <div className="text-right">
                    {activeTab === 'items' ? (
                      <div className="flex items-center gap-1 justify-end font-bold text-base sm:text-lg text-[#f5a623]">
                        <span className="text-xl">{getBestItem(playerItem)?.icon || '📦'}</span>
                        <span>{wins.toLocaleString('vi-VN')} 🪙</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 justify-end font-bold text-base sm:text-lg text-[#f5a623]">
                        <Flame className="w-4 h-4 fill-[#f5a623] text-[#f5a623]" />
                        <span>{wins}</span>
                      </div>
                    )}
                    <span className="text-[10px] uppercase font-semibold text-white/40 tracking-wider">
                      {getTabLabel(activeTab)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-white/40">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#53b1ff]" />
          <span>{t('lb.footer')}</span>
        </div>
        <div className="font-mono text-[11px] text-white/30">
          {leaderboard.length} {t('lb.playersOnBoard')}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardView;
