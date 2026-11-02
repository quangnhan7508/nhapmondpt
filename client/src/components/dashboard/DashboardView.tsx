import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Users,
  Clock,
  Sparkles,
  Play,
  Swords,
  Star,
  Info,
  CheckCircle2,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import type { PublicUser } from '../../types/game';
import { AuthModal } from '../auth/AuthModal';

interface BoardGameInfo {
  id: string;
  name: string;
  vietnameseName: string;
  badge: string;
  tagline: string;
  description: string;
  playerCount: string;
  playTime: string;
  genre: string;
  icon: string;
  coverGradient: string;
  glowColor: string;
  accentColor: string;
  features: string[];
  rulesSummary: string[];
  route: string;
}

const BOARD_GAMES: BoardGameInfo[] = [
  {
    id: 'uno',
    name: 'UNO Arena',
    vietnameseName: 'Thẻ Bài Sắc Màu',
    badge: 'Phổ Biến Nhất',
    tagline: 'Kinh điển thế giới với tính năng bốc phạt & cướp lượt thần tốc',
    description: 'Ghép nối màu sắc và con số, tung lá chức năng Đổi chiều, Cấm lượt, +2, +4 để hạ gục đối phương. Hỗ trợ luật Flex Card lật màu và Cướp lượt Jump-In!',
    playerCount: '2 - 10 Người',
    playTime: '5 - 15 Phút',
    genre: 'Thẻ bài đối kháng',
    icon: '🎴',
    coverGradient: 'from-[#0070d1] via-[#004d8d] to-[#001f4d]',
    glowColor: 'shadow-[0_0_30px_rgba(0,112,209,0.4)]',
    accentColor: '#53b1ff',
    features: ['Cộng dồn phạt lá bài (+2 / +4)', 'Đổi bài toàn bộ khi ra 7', 'Cướp lượt khi trùng bài', 'Gom màu tự động một chạm'],
    rulesSummary: [
      'Đánh bài cùng màu hoặc cùng số với lá trên bàn.',
      'Lá +2, +4 bắt đối thủ tiếp theo rút bài nếu không có lá đè.',
      'Người đầu tiên hết bài sẽ giành chiến thắng vinh quang!'
    ],
    route: '/play'
  },
  {
    id: 'exploding-kittens',
    name: 'Exploding Kittens',
    vietnameseName: 'Mèo Nổ Nga Roulette',
    badge: 'Chiến Thuật Căng Thẳng',
    tagline: 'Đấu trí sinh tồn kịch tính, gỡ bom và né lá Mèo Nổ tử thần',
    description: 'Game bài giải trí hàng đầu với cơ chế rút bài may rủi sinh tử. Sử dụng Gỡ bom, Soi tương lai, Đảo thứ tự và Thẻ Nope thần thánh để sống sót đến cuối cùng!',
    playerCount: '2 - 5 Người',
    playTime: '10 - 20 Phút',
    genre: 'Sinh tồn chiến thuật',
    icon: '🐱💣',
    coverGradient: 'from-[#c23616] via-[#8b1500] to-[#3a0600]',
    glowColor: 'shadow-[0_0_30px_rgba(213,59,0,0.4)]',
    accentColor: '#ff7675',
    features: ['Thẻ gỡ bom Defuse cứu sinh', 'Soi & xếp lại 3-5 lá tương lai', 'Chặn hành động với lá NOPE', 'Thẻ Mèo Phát Nổ Imploding úp/ngửa'],
    rulesSummary: [
      'Lần lượt đánh bài chức năng hoặc kết thúc lượt bằng việc rút 1 lá bài.',
      'Nếu rút phải Mèo Nổ mà không có Gỡ Bom, bạn sẽ bị loại ngay lập tức!',
      'Người sống sót duy nhất cuối cùng là người chiến thắng.'
    ],
    route: '/play'
  },
  {
    id: 'tien-len',
    name: 'Tiến Lên Miền Nam',
    vietnameseName: 'Game Bài Dân Gian',
    badge: 'Truyền Thống',
    tagline: 'Sát phạt kịch tính, chặt heo, đôi thông, tứ quý kinh điển',
    description: 'Trò chơi bài dân tộc phổ biến nhất Việt Nam với đầy đủ luật chặt 2/Heo, 3 Đôi thông, 4 Đôi thông, Tứ quý chặt bất kỳ lượt mà không cần theo vòng!',
    playerCount: '2 - 4 Người',
    playTime: '5 - 10 Phút',
    genre: 'Bài dân gian đối kháng',
    icon: '🃏',
    coverGradient: 'from-[#1e6f42] via-[#0d4424] to-[#041c0e]',
    glowColor: 'shadow-[0_0_30px_rgba(46,204,113,0.35)]',
    accentColor: '#2ecc71',
    features: ['Chặt heo không cần theo vòng', 'Tự động phát hiện & gợi ý đè bài', 'Xếp bài theo điểm (3➔2) & theo chất', 'Hỗ trợ kéo thả tự do như sòng bài thật'],
    rulesSummary: [
      'Chia đều 13 lá cho mỗi người chơi.',
      'Đánh bài lớn hơn chặn bài người trước theo bậc điểm 3 < 4 < ... < K < A < 2.',
      'Chặt heo bằng 3 đôi thông, 4 đôi thông hoặc tứ quý!'
    ],
    route: '/play'
  },
  {
    id: 'sam-loc',
    name: 'Sâm Lốc',
    vietnameseName: 'Tốc Độ & Báo Sâm',
    badge: 'Tốc Độ Cao',
    tagline: 'Đấu trí thần tốc miền Bắc: Báo sâm cướp cái, không phân biệt chất',
    description: 'Trận chiến tốc độ 10 lá bài mỗi người. Chỉ cần 1 nước cờ táo bạo Báo Sâm cướp quyền đi đầu, bạn có thể kết thúc cả ván bài trong một nốt nhạc!',
    playerCount: '2 - 5 Người',
    playTime: '3 - 8 Phút',
    genre: 'Tốc độ quyết đoán',
    icon: '⚡',
    coverGradient: 'from-[#5f27cd] via-[#341f97] to-[#170a4a]',
    glowColor: 'shadow-[0_0_30px_rgba(95,39,205,0.4)]',
    accentColor: '#a29bfe',
    features: ['Cơ chế Báo Sâm cướp cái độc đáo', 'Đánh bài không phân biệt chất', 'Tính điểm thần tốc', 'Tối đa 5 người thi đấu cùng lúc'],
    rulesSummary: [
      'Mỗi người được chia 10 lá bài.',
      'Đầu ván ai tự tin bài đẹp có thể Báo Sâm để đánh hết trước.',
      'Chặn bài chỉ cần điểm số lớn hơn, không phụ thuộc vào chất cơ rô tép bích.'
    ],
    route: '/play'
  }
];

export const DashboardView: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [leaderboardTab, setLeaderboardTab] = useState<'all' | 'uno' | 'exploding-kittens' | 'tien-len'>('all');
  const [topPlayers, setTopPlayers] = useState<PublicUser[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [selectedGameModal, setSelectedGameModal] = useState<BoardGameInfo | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Load Leaderboard purely by wins / ranking (No money!)
  useEffect(() => {
    let isMounted = true;
    setLoadingLeaderboard(true);
    fetch(`/api/leaderboard?gameType=${leaderboardTab}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.success && Array.isArray(data.leaderboard)) {
          setTopPlayers(data.leaderboard.slice(0, 10));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingLeaderboard(false);
      });

    return () => {
      isMounted = false;
    };
  }, [leaderboardTab]);

  // Rank title and tier calculation
  const playerRankTitle = useMemo(() => {
    const wins = user?.stats?.totalWins || 0;
    if (wins >= 50) return { title: 'Đại Sư Huyền Thoại', tier: 'Grandmaster', badge: 'bg-gradient-to-r from-amber-400 to-yellow-300 text-black', icon: '👑' };
    if (wins >= 25) return { title: 'Bậc Thầy Chiến Thuật', tier: 'Master', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40', icon: '⭐' };
    if (wins >= 10) return { title: 'Kỳ Thủ Xuất Sắc', tier: 'Diamond', badge: 'bg-[#0070d1]/20 text-[#53b1ff] border-[#0070d1]/40', icon: '💎' };
    if (wins >= 5) return { title: 'Kỳ Thủ Dày Dạn', tier: 'Platinum', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: '🛡️' };
    if (wins >= 1) return { title: 'Tập Sự Triển Vọng', tier: 'Gold', badge: 'bg-white/10 text-white/80 border-white/20', icon: '⚔️' };
    return { title: 'Tân Thủ Nhập Môn', tier: 'Rookie', badge: 'bg-white/5 text-white/60 border-white/10', icon: '♟️' };
  }, [user?.stats?.totalWins]);

  const winRate = useMemo(() => {
    const total = user?.stats?.totalGames || 0;
    const wins = user?.stats?.totalWins || 0;
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  }, [user?.stats?.totalGames, user?.stats?.totalWins]);

  return (
    <div className="flex flex-col gap-8 pb-16 max-w-7xl mx-auto px-1 sm:px-2">
      {/* 1. Modern Board Game Header Hero (No Currency) */}
      <section className="relative overflow-hidden rounded-3xl bg-[#121314] border border-white/10 p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
        {/* Ambient PlayStation Blue & Cyan Halos */}
        <div className="absolute -top-36 -right-36 w-96 h-96 bg-[#0070d1]/25 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-36 -left-36 w-80 h-80 bg-[#00f0ff]/15 blur-[100px] rounded-full pointer-events-none" />

        {/* Ambient Pattern Watermark */}
        <div className="absolute right-6 bottom-4 select-none pointer-events-none text-white/[0.03] font-mono text-8xl sm:text-9xl font-black">
          △◯✕▢
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0070d1]/20 border border-[#0070d1]/40 text-xs font-semibold text-[#53b1ff]">
              <Sparkles className="w-3.5 h-3.5 text-[#00f0ff]" />
              <span>Sảnh Đấu Trường Board Game Trực Tuyến</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light text-white tracking-tight">
              {user ? (
                <>
                  Chào mừng, <span className="font-semibold text-[#53b1ff]">{user.displayName}</span>
                </>
              ) : (
                <>Đấu Trường <span className="font-semibold text-white">Board Game</span></>
              )}
            </h1>

            <p className="text-sm sm:text-base text-white/60 font-normal max-w-2xl leading-relaxed">
              Tuyển tập các trò chơi thẻ bài đối kháng đỉnh cao: UNO, Mèo Nổ, Tiến Lên Miền Nam và Sâm Lốc. Thi đấu thời gian thực, tranh tài xếp hạng và ghi danh vào Bảng Vàng Kỳ Thủ!
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => navigate('/play')}
                className="px-7 py-3 rounded-full bg-[#0070d1] hover:bg-[#0064b7] text-white font-semibold text-sm shadow-[0_0_20px_rgba(0,112,209,0.5)] flex items-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                Vào Phòng Chơi Ngay
              </button>

              <button
                onClick={() => {
                  const el = document.getElementById('leaderboard-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-[#ffce21]" />
                Xem Bảng Vàng Kỳ Thủ
              </button>
            </div>
          </div>

          {/* Player Honor Badge (Zero Currency) */}
          <div className="bg-[#181818]/90 border border-white/10 rounded-3xl p-5 lg:min-w-[320px] shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <span className="text-xs uppercase tracking-wider text-white/50 font-bold">Hồ Sơ Kỳ Thủ</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Trực Tuyến
              </span>
            </div>

            {user ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#0070d1]/30 border border-[#0070d1]/50 flex items-center justify-center text-2xl shadow-inner">
                    {user.avatar || '🦊'}
                  </div>
                  <div>
                    <div className="font-bold text-white text-base truncate max-w-[170px]">{user.displayName}</div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border mt-0.5 border-white/10 bg-white/5 text-[#53b1ff]">
                      <span>{playerRankTitle.icon}</span>
                      <span>{playerRankTitle.title}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center">
                  <div className="bg-white/[0.03] p-2.5 rounded-2xl border border-white/5">
                    <div className="text-[10px] uppercase font-bold text-white/40">Trận Thắng</div>
                    <div className="text-lg font-bold text-[#53b1ff] mt-0.5">{user.stats?.totalWins || 0}</div>
                  </div>
                  <div className="bg-white/[0.03] p-2.5 rounded-2xl border border-white/5">
                    <div className="text-[10px] uppercase font-bold text-white/40">Tổng Trận</div>
                    <div className="text-lg font-bold text-white mt-0.5">{user.stats?.totalGames || 0}</div>
                  </div>
                  <div className="bg-white/[0.03] p-2.5 rounded-2xl border border-white/5">
                    <div className="text-[10px] uppercase font-bold text-white/40">Tỉ Lệ Thắng</div>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">{winRate}%</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-white/60">Đăng nhập tài khoản để lưu lại thành tích chiến thắng và thăng hạng trên bảng vàng!</p>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="w-full py-2.5 rounded-full bg-[#0070d1] hover:bg-[#0064b7] text-white font-semibold text-xs shadow-md cursor-pointer transition-colors"
                >
                  Đăng Nhập / Đăng Ký Ngay
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Board Game Selection Menu (Library Grid) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-2xl font-light text-white tracking-tight flex items-center gap-2">
              <Layers className="w-6 h-6 text-[#0070d1]" />
              Chọn Trò Chơi Board Game
            </h2>
            <p className="text-xs text-white/50 mt-0.5">Chọn tựa game bạn muốn tham gia để tạo phòng hoặc vào sảnh ghép trận tự động</p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/10 text-white/70 border border-white/10 self-start sm:self-auto">
            {BOARD_GAMES.length} Trò Chơi Sẵn Sàng
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {BOARD_GAMES.map((game) => (
            <div
              key={game.id}
              className={`group relative overflow-hidden rounded-3xl bg-[#141517] border border-white/10 hover:border-[#0070d1]/80 transition-all duration-300 p-6 flex flex-col justify-between hover:scale-[1.01] hover:${game.glowColor}`}
            >
              {/* Radial Game Backdrop Accent */}
              <div className={`absolute top-0 right-0 w-80 h-80 bg-gradient-to-br ${game.coverGradient} opacity-30 blur-3xl pointer-events-none group-hover:opacity-45 transition-opacity`} />

              <div>
                {/* Top Badges & Meta */}
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl drop-shadow-md">{game.icon}</span>
                    <div>
                      <h3 className="text-xl font-bold text-white group-hover:text-[#53b1ff] transition-colors">
                        {game.name}
                      </h3>
                      <p className="text-xs text-white/50">{game.vietnameseName}</p>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-white/10 border border-white/15 text-white/90">
                    {game.badge}
                  </span>
                </div>

                {/* Tagline & Description */}
                <p className="text-xs font-medium text-white/80 italic mb-2 relative z-10">
                  "{game.tagline}"
                </p>
                <p className="text-xs text-white/55 leading-relaxed mb-5 relative z-10">
                  {game.description}
                </p>

                {/* Specs Pill List (Player count, time, genre) */}
                <div className="flex flex-wrap gap-2 mb-5 relative z-10">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold text-white/80">
                    <Users className="w-3.5 h-3.5 text-[#53b1ff]" />
                    {game.playerCount}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold text-white/80">
                    <Clock className="w-3.5 h-3.5 text-amber-300" />
                    {game.playTime}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold text-white/80">
                    <Swords className="w-3.5 h-3.5 text-emerald-400" />
                    {game.genre}
                  </span>
                </div>

                {/* Highlights tags */}
                <div className="space-y-1.5 mb-6 relative z-10">
                  {game.features.slice(0, 3).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-white/70">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00f0ff] flex-shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-white/10 relative z-10">
                <button
                  onClick={() => navigate('/play')}
                  className="flex-1 py-3 px-5 rounded-full bg-[#0070d1] hover:bg-[#0064b7] text-white font-semibold text-xs transition-all shadow-[0_0_15px_rgba(0,112,209,0.4)] flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Chơi {game.name} Ngay
                </button>

                <button
                  onClick={() => setSelectedGameModal(game)}
                  className="py-3 px-4 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white/80 hover:text-white font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  title="Xem chi tiết luật chơi"
                >
                  <Info className="w-4 h-4" />
                  <span>Luật Chơi</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Pure Board Game Leaderboard (Ranking by Wins & Skill - Zero Currency) */}
      <section id="leaderboard-section" className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-light text-white tracking-tight flex items-center gap-2">
              <Trophy className="w-6 h-6 text-[#ffce21]" />
              Bảng Vàng Kỳ Thủ Danh Vọng
            </h2>
            <p className="text-xs text-white/50 mt-0.5">Xếp hạng các kỳ thủ có số trận thắng nhiều nhất trên toàn hệ thống (PvP)</p>
          </div>

          {/* Game Type Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-[#181818] border border-white/10 rounded-full self-start sm:self-auto overflow-x-auto max-w-full">
            {[
              { id: 'all', label: 'Tất Cả Game' },
              { id: 'uno', label: 'UNO' },
              { id: 'exploding-kittens', label: 'Mèo Nổ' },
              { id: 'tien-len', label: 'Tiến Lên' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setLeaderboardTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  leaderboardTab === tab.id
                    ? 'bg-[#0070d1] text-white shadow-[0_0_12px_rgba(0,112,209,0.5)]'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard Table Card */}
        <div className="bg-[#141517] border border-white/10 rounded-3xl p-5 sm:p-7 shadow-xl relative overflow-hidden">
          {loadingLeaderboard ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-8 h-8 border-2 border-[#0070d1] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-white/50">Đang tải bảng xếp hạng kỳ thủ...</p>
            </div>
          ) : topPlayers.length === 0 ? (
            <div className="py-12 text-center text-xs text-white/40 italic">
              Chưa có dữ liệu thi đấu cho chế độ này. Hãy là người đầu tiên ghi danh trên bảng vàng!
            </div>
          ) : (
            <div className="space-y-2.5">
              {topPlayers.map((player, idx) => {
                const isCurrentUser = user?.id === player.id;
                const wins =
                  leaderboardTab === 'uno'
                    ? player.stats?.unoWins || 0
                    : leaderboardTab === 'exploding-kittens'
                    ? player.stats?.explodingKittensWins || 0
                    : leaderboardTab === 'tien-len'
                    ? player.stats?.tienLenWins || 0
                    : player.stats?.totalWins || 0;

                const games = player.stats?.totalGames || 0;
                const winRateLocal = games > 0 ? Math.round((wins / games) * 100) : 0;

                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all ${
                      isCurrentUser
                        ? 'bg-[#0070d1]/15 border-[#0070d1] shadow-[0_0_15px_rgba(0,112,209,0.3)]'
                        : 'bg-[#181818]/60 border-white/5 hover:border-white/15 hover:bg-[#181818]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Trophy Rank Badge */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                          idx === 0
                            ? 'bg-gradient-to-r from-[#ffce21] to-[#ee8e00] text-black shadow-[0_0_15px_rgba(255,206,33,0.6)]'
                            : idx === 1
                            ? 'bg-gradient-to-r from-slate-200 to-slate-400 text-black shadow-sm'
                            : idx === 2
                            ? 'bg-gradient-to-r from-amber-600 to-amber-800 text-white shadow-sm'
                            : 'bg-white/10 text-white/60'
                        }`}
                      >
                        {idx === 0 ? '👑' : idx + 1}
                      </div>

                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl flex-shrink-0">
                        {player.avatar || '🦊'}
                      </div>

                      {/* Name & Tier Title */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white truncate">
                            {player.displayName}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-[#0070d1] text-white font-bold">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/50 truncate">
                          @{player.username}
                        </div>
                      </div>
                    </div>

                    {/* Win Stats */}
                    <div className="flex items-center gap-4 sm:gap-8 flex-shrink-0">
                      <div className="hidden sm:block text-right">
                        <div className="text-[10px] uppercase font-bold text-white/40">Tỷ lệ thắng</div>
                        <div className="text-xs font-semibold text-emerald-400">{winRateLocal}%</div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-white/40">Số trận thắng</div>
                        <div className="text-sm sm:text-base font-bold text-[#53b1ff] flex items-center justify-end gap-1">
                          <Trophy className="w-4 h-4 text-[#ffce21]" />
                          <span>{wins}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
            <span>Cập nhật xếp hạng theo thời gian thực sau mỗi trận đấu.</span>
            <button
              onClick={() => navigate('/leaderboard')}
              className="font-semibold text-[#53b1ff] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Xem toàn bộ bảng xếp hạng <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Rules Modal for Board Games */}
      <AnimatePresence>
        {selectedGameModal && (
          <div
            onClick={() => setSelectedGameModal(null)}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#141517] border border-white/15 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative"
            >
              <button
                onClick={() => setSelectedGameModal(null)}
                className="absolute top-5 right-5 text-white/50 hover:text-white text-base font-bold w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10 hover:border-white/30 transition-colors cursor-pointer"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">{selectedGameModal.icon}</span>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedGameModal.name}</h3>
                  <p className="text-xs text-[#53b1ff] font-semibold">{selectedGameModal.vietnameseName} • {selectedGameModal.playerCount}</p>
                </div>
              </div>

              <div className="space-y-4 my-5 text-xs text-white/75 leading-relaxed">
                <div>
                  <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-2 text-[#00f0ff]">
                    📖 Tóm Tắt Luật Chơi Cốt Lõi:
                  </h4>
                  <ul className="space-y-2 pl-2">
                    {selectedGameModal.rulesSummary.map((rule, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-bold text-[#53b1ff]">#{idx + 1}</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#181818] border border-white/10 rounded-2xl p-4">
                  <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5 text-amber-300">
                    <Star className="w-3.5 h-3.5 fill-amber-300" /> Tính Năng Nổi Bật:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    {selectedGameModal.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-white/80">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-white/10">
                <button
                  onClick={() => setSelectedGameModal(null)}
                  className="flex-1 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs cursor-pointer transition-colors"
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    setSelectedGameModal(null);
                    navigate('/play');
                  }}
                  className="flex-1 py-3 rounded-full bg-[#0070d1] hover:bg-[#0064b7] text-white font-semibold text-xs shadow-[0_0_15px_rgba(0,112,209,0.5)] cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Vào Bàn Chơi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Modal if triggered */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          initialMode="login"
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
};

export const NavigationPanel = DashboardView;
export default DashboardView;