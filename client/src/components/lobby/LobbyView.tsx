import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle,
  Copy,
  Gamepad2,
  Play,
  Plus,
  Send,
  Settings,
  Trash2,
  Trophy,
  Users,
  Search,
  RefreshCw,
  Radio,
  Bot,
  ArrowRight,
  UserCheck,
  X,
  Sparkles
} from 'lucide-react';
import { EKExpansions, GameType, RoomPlayer, RoomSettings, RoomState, PublicUser } from '../../types/game';
import { useAuth } from '../../context/AuthContext';
import { AuthModal } from '../auth/AuthModal';

interface PublicRoomItem {
  id: string;
  hostName: string;
  gameType: GameType;
  playerCount: number;
  maxPlayers: number;
  inGame: boolean;
  betAmount: number;
  createdAt: number;
}

interface LobbyViewProps {
  room: RoomState | null;
  player: RoomPlayer | null;
  connected: boolean;
  onCreateRoom: (name: string, avatar: string, userId?: string, betAmount?: number, gameType?: GameType) => void;
  onJoinRoom: (roomId: string, name: string, avatar: string, userId?: string) => void;
  onAddBot: () => void;
  onRemoveBot: (id: string) => void;
  onUpdateSettings: (settings: Partial<RoomSettings>) => void;
  onSetReady: (ready: boolean) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onSendMessage: (text: string) => void;
  errorMsg: string | null;
  initialJoinCode?: string;
}

const AVATARS = [
  { id: 'av-fox', emoji: '🦊', label: 'Cáo' },
  { id: 'av-cat', emoji: '🐱', label: 'Mèo' },
  { id: 'av-robot', emoji: '🤖', label: 'Robo' },
  { id: 'av-dragon', emoji: '🐉', label: 'Rồng' },
  { id: 'av-wizard', emoji: '🧙', label: 'Phù Thủy' },
  { id: 'av-ninja', emoji: '🥷', label: 'Ninja' },
  { id: 'av-tiger', emoji: '🐯', label: 'Hổ' },
  { id: 'av-bear', emoji: '🐻', label: 'Gấu' }
];

const GAME_MODES: Array<{
  type: GameType;
  title: string;
  shortTitle: string;
  icon: string;
  badge: string;
  color: string;
  accentHex: string;
  maxPlayers: number;
  subtitle: string;
}> = [
  {
    type: 'uno',
    title: 'UNO ARENA',
    shortTitle: 'UNO',
    icon: '🃏',
    badge: 'HOT',
    color: 'from-[#0070d1] to-[#002d5c]',
    accentHex: '#0070d1',
    maxPlayers: 8,
    subtitle: 'Đấu thẻ bài chiến thuật & hô UNO kinh điển'
  },
  {
    type: 'exploding-kittens',
    title: 'MÈO NỔ (EK)',
    shortTitle: 'Mèo Nổ',
    icon: '💣',
    badge: 'BATTLE',
    color: 'from-[#e63946] to-[#590d22]',
    accentHex: '#e63946',
    maxPlayers: 10,
    subtitle: 'Rút bài sinh tồn, gỡ bom mèo căng não'
  },
  {
    type: 'tien-len',
    title: 'TIẾN LÊN MIỀN NAM',
    shortTitle: 'Tiến Lên',
    icon: '♠️',
    badge: 'ESPORTS',
    color: 'from-[#0d9488] to-[#134e4a]',
    accentHex: '#0d9488',
    maxPlayers: 4,
    subtitle: 'Chặt 2, tới trắng, đấu trí đỉnh cao'
  },
  {
    type: 'co-vua',
    title: 'CỜ VUA (CHESS)',
    shortTitle: 'Cờ Vua',
    icon: '♟️',
    badge: 'TACTIC',
    color: 'from-[#7c3aed] to-[#3b0764]',
    accentHex: '#7c3aed',
    maxPlayers: 2,
    subtitle: 'Chiến thuật 64 ô cờ trí tuệ đẳng cấp thế giới'
  },
  {
    type: 'co-tuong',
    title: 'CỜ TƯỚNG (XIANGQI)',
    shortTitle: 'Cờ Tướng',
    icon: '🩵',
    badge: 'CLASSIC',
    color: 'from-[#b91c1c] to-[#450a0a]',
    accentHex: '#b91c1c',
    maxPlayers: 2,
    subtitle: 'Sở Hà Hán Giới, đại chiến soái tướng cân não'
  }
];

export const LobbyView: React.FC<LobbyViewProps> = ({
  room,
  player,
  connected,
  onCreateRoom,
  onJoinRoom,
  onAddBot,
  onRemoveBot,
  onUpdateSettings,
  onSetReady,
  onStartGame,
  onLeaveRoom,
  onSendMessage,
  errorMsg,
  initialJoinCode = ''
}) => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Auth modal
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Player identity
  const [playerName, setPlayerName] = useState('Player ' + Math.floor(100 + Math.random() * 900));
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].id);

  // Right Panel Tab: 'browser' | 'rank'
  const [rightTab, setRightTab] = useState<'browser' | 'rank'>(() => {
    return searchParams.get('view') === 'rank' ? 'rank' : 'browser';
  });

  // Watch URL param change
  useEffect(() => {
    if (searchParams.get('view') === 'rank') {
      setRightTab('rank');
    }
  }, [searchParams]);

  // View Mode: 'welcome' (trang chào mừng bên ngoài) | 'lobby' (sảnh chọn phòng đấu)
  const [viewMode, setViewMode] = useState<'welcome' | 'lobby'>(() => {
    if (initialJoinCode && initialJoinCode.trim().length >= 4) return 'lobby';
    if (searchParams.get('view') === 'lobby' || searchParams.get('view') === 'rank') return 'lobby';
    return 'welcome';
  });

  // Matchmaking & Game Selection State
  const [selectedGameType, setSelectedGameType] = useState<GameType>('uno');
  const [searchingGame, setSearchingGame] = useState<GameType | null>(null);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const matchTimerRef = useRef<any>(null);

  // Quick Room PIN
  const [quickCode, setQuickCode] = useState(initialJoinCode.toUpperCase());

  // Create Room Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createGameType, setCreateGameType] = useState<GameType>('uno');
  const [createTurnLimit, setCreateTurnLimit] = useState<number>(30);

  // Room Browser State
  const [publicRooms, setPublicRooms] = useState<PublicRoomItem[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomFilterGame, setRoomFilterGame] = useState<'all' | GameType>('all');
  const [roomSearchQuery, setRoomSearchQuery] = useState('');

  // Compact Leaderboard State
  const [topPlayers, setTopPlayers] = useState<PublicUser[]>([]);
  const [isLoadingRank, setIsLoadingRank] = useState(false);

  // In-Room Staging State
  const [chatInput, setChatInput] = useState('');
  const [copied, setCopied] = useState(false);

  // Sync profile when user logs in
  useEffect(() => {
    if (user) {
      setPlayerName(user.displayName);
      if (user.avatar) setSelectedAvatar(user.avatar);
    }
  }, [user]);

  // Deep-link mã phòng (?id= / /room/:id)
  useEffect(() => {
    if (initialJoinCode) setQuickCode(initialJoinCode.toUpperCase());
  }, [initialJoinCode]);

  // Fetch Public Rooms list
  const fetchPublicRooms = async () => {
    try {
      setIsLoadingRooms(true);
      const isDev = window.location.port === '5173';
      const serverUrl = isDev ? 'http://localhost:3000' : window.location.origin;
      const res = await fetch(`${serverUrl}/api/rooms`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.rooms)) {
          setPublicRooms(data.rooms);
        }
      }
    } catch {
      // offline fallback
    } finally {
      setIsLoadingRooms(false);
    }
  };

  // Fetch Leaderboard list
  const fetchLeaderboard = async () => {
    try {
      setIsLoadingRank(true);
      const res = await fetch('/api/leaderboard?gameType=all');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.leaderboard)) {
          setTopPlayers(data.leaderboard.slice(0, 10));
        }
      }
    } catch {
      // fallback
    } finally {
      setIsLoadingRank(false);
    }
  };

  useEffect(() => {
    fetchPublicRooms();
    fetchLeaderboard();
    const interval = setInterval(fetchPublicRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (rightTab === 'rank') {
      fetchLeaderboard();
    }
  }, [rightTab]);

  // Matchmaking Engine
  useEffect(() => {
    if (searchingGame) {
      setSearchSeconds(0);
      matchTimerRef.current = setInterval(() => {
        setSearchSeconds((s) => s + 1);
      }, 1000);

      const tryMatch = async () => {
        try {
          const isDev = window.location.port === '5173';
          const serverUrl = isDev ? 'http://localhost:3000' : window.location.origin;
          const res = await fetch(`${serverUrl}/api/rooms`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.rooms)) {
              const openMatch = data.rooms.find(
                (r: PublicRoomItem) =>
                  r.gameType === searchingGame && !r.inGame && r.playerCount < r.maxPlayers
              );
              if (openMatch) {
                setSearchingGame(null);
                clearInterval(matchTimerRef.current);
                onJoinRoom(openMatch.id, playerName, selectedAvatar, user?.id);
                return;
              }
            }
          }
        } catch {
          // ignore
        }

        // If no match after 3.5s, create new open room
        setTimeout(() => {
          setSearchingGame((current) => {
            if (current) {
              clearInterval(matchTimerRef.current);
              onCreateRoom(playerName, selectedAvatar, user?.id, 0, current);
            }
            return null;
          });
        }, 3500);
      };

      tryMatch();
    } else {
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
    }

    return () => {
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
    };
  }, [searchingGame]);

  const handleStartMatchmaking = (game: GameType) => {
    if (!connected || !playerName.trim()) return;
    setSearchingGame(game);
  };

  const handleCancelMatchmaking = () => {
    setSearchingGame(null);
    if (matchTimerRef.current) clearInterval(matchTimerRef.current);
  };

  const handleJoinDirect = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean.length >= 4) {
      onJoinRoom(clean, playerName, selectedAvatar, user?.id);
    }
  };

  // =========================================================================
  // VIEW 1: 1-PAGE ZERO-SCROLL ESPORTS HUB (!room || !player)
  // =========================================================================
  // =========================================================================
  // VIEW 1: ZERO-SCROLL ESPORTS HUB (!room || !player)
  // =========================================================================
  if (!room || !player) {
    // -----------------------------------------------------------------------
    // SUB-VIEW A: TRANG CHÀO MỪNG BÊN NGOÀI (WELCOME PAGE)
    // -----------------------------------------------------------------------
    if (viewMode === 'welcome') {
      return (
        <div className="h-full w-full flex flex-col min-h-0 overflow-hidden select-none font-sans text-white">
          {/* TOP STATUS BAR */}
          <div className="flex-shrink-0 flex items-center justify-between gap-3 bg-[#181818]/90 border border-white/10 rounded-xl px-4 py-2 mb-2 shadow-lg">
            {/* Left: PlayStation Logo & Brand */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0070d1] flex items-center justify-center font-black text-xs text-white shadow-[0_0_12px_rgba(0,112,209,0.5)]">
                PS
              </div>
              <div>
                <div className="text-sm font-black tracking-wider uppercase text-white flex items-center gap-1.5">
                  <span>OMNIDECK ARENA</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                    ONLINE
                  </span>
                </div>
                <div className="text-[10px] text-white/40 font-mono">HỆ THỐNG ĐẤU TRƯỜNG BOARDGAME</div>
              </div>
            </div>

            {/* Right: User Status & Enter Lobby CTA */}
            <div className="flex items-center gap-2.5">
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1">
                    <span className="text-sm">{AVATARS.find((a) => a.id === user.avatar)?.emoji || '👤'}</span>
                    <span className="text-xs font-bold text-white max-w-[120px] truncate">{user.displayName}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#f5a623]/20 text-[#ffce21] font-bold">
                      {user.stats?.totalWins || 0}W
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setAuthModalOpen(true);
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all cursor-pointer"
                  >
                    Đăng Nhập
                  </button>
                  <button
                    onClick={() => {
                      setAuthMode('register');
                      setAuthModalOpen(true);
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-[#0070d1] hover:bg-[#005bb5] shadow-[0_0_12px_rgba(0,112,209,0.4)] transition-all cursor-pointer"
                  >
                    Đăng Ký
                  </button>
                </div>
              )}

              <button
                onClick={() => setViewMode('lobby')}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#0070d1] to-[#00a3ff] hover:brightness-110 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,112,209,0.5)] flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Gamepad2 className="w-4 h-4" />
                <span>VÀO SẢNH GAME</span>
              </button>
            </div>
          </div>

          {/* ERROR CALLOUT */}
          {errorMsg && (
            <div className="flex-shrink-0 mb-2 p-2 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-lg text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* MAIN WELCOME BODY (ZERO SCROLL, 1-PAGE): 7 COLS LEFT, 5 COLS RIGHT */}
          <div className="flex-1 min-h-0 grid grid-cols-12 gap-3 overflow-hidden">
            {/* LEFT COLUMN: HERO WELCOME + LOGIN/REGISTER + QUICK LAUNCHER (7 cols) */}
            <div className="col-span-12 md:col-span-7 flex flex-col min-h-0 overflow-hidden justify-between bg-gradient-to-br from-[#1c1d22]/90 to-[#121316]/95 border border-white/10 rounded-2xl p-4 sm:p-5 relative shadow-xl">
              {/* Ambient PlayStation Blue Glow */}
              <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-[#0070d1]/20 blur-3xl pointer-events-none" />

              {/* Top: Greetings Banner */}
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#53b1ff] mb-1 font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>PLAYSTATION BOARDGAME ARENA</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wide text-white leading-tight">
                  {user ? `XIN CHÀO, ${user.displayName.toUpperCase()}!` : 'XIN CHÀO, GAME THỦ!'}
                </h1>
                <p className="text-xs sm:text-sm text-white/60 mt-1 max-w-xl">
                  Chào mừng bạn đến với đấu trường trí tuệ trực tuyến. Tham gia ghép trận tự động hoặc tạo bàn riêng so tài cùng bạn bè.
                </p>
              </div>

              {/* Middle: Account Card (If not logged in, show login/register options!) */}
              <div className="relative z-10 my-auto py-2">
                {!user ? (
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-[#0070d1]/30 shadow-[0_0_20px_rgba(0,112,209,0.15)] flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-center sm:text-left">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0070d1] to-[#004385] flex items-center justify-center text-xl text-white shadow flex-shrink-0">
                        🎮
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase text-white tracking-wide">
                          BẠN ĐANG TRUY CẬP VỚI TƯ CÁCH KHÁCH
                        </div>
                        <div className="text-[11px] text-white/50">
                          Đăng nhập hoặc đăng ký tài khoản để lưu lại số trận thắng và vinh danh trên Bảng Vàng!
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                      <button
                        onClick={() => {
                          setAuthMode('login');
                          setAuthModalOpen(true);
                        }}
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                      >
                        ĐĂNG NHẬP
                      </button>
                      <button
                        onClick={() => {
                          setAuthMode('register');
                          setAuthModalOpen(true);
                        }}
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-[#0070d1] hover:bg-[#0060b5] text-white font-black text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(0,112,209,0.4)] transition-all cursor-pointer"
                      >
                        ĐĂNG KÝ
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#0070d1] flex items-center justify-center text-2xl border border-white/20 shadow">
                        {AVATARS.find((a) => a.id === user.avatar)?.emoji || '👤'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black uppercase text-white">{user.displayName}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                            ĐÃ KẾT NỐI
                          </span>
                        </div>
                        <div className="text-[11px] text-white/50 font-mono mt-0.5">
                          Thành tích cá nhân:{' '}
                          <span className="text-[#f5a623] font-bold">{user.stats?.totalWins || 0} Trận thắng</span> •{' '}
                          {user.stats?.totalGames || 0} Đã đấu
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-white/40 uppercase font-mono">Tỷ lệ thắng</div>
                      <div className="text-base font-black text-emerald-400 font-mono">
                        {user.stats?.totalGames ? Math.round(((user.stats.totalWins || 0) / user.stats.totalGames) * 100) : 0}%
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Area: Big Enter Lobby Button + 5 Game Quick Cards + PIN Join */}
              <div className="relative z-10 space-y-3">
                {/* Primary Action Button */}
                <button
                  onClick={() => setViewMode('lobby')}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#0070d1] via-[#0084f7] to-[#005bb5] hover:brightness-110 active:scale-[0.99] text-white text-sm sm:text-base font-black uppercase tracking-wider shadow-[0_0_25px_rgba(0,112,209,0.5)] flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                >
                  <Gamepad2 className="w-5 h-5 text-white" />
                  <span>VÀO SẢNH GAME • CHƠI NGAY</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>

                {/* 5 Game Direct Launchers */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5 flex items-center justify-between">
                    <span>CHỌN NHANH TRÒ CHƠI YÊU THÍCH</span>
                    <span className="font-mono">5 TRÒ CHƠI</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {GAME_MODES.map((mode) => (
                      <button
                        key={mode.type}
                        onClick={() => {
                          setSelectedGameType(mode.type);
                          setViewMode('lobby');
                        }}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 text-center transition-all cursor-pointer group"
                        title={mode.title}
                      >
                        <div className="text-xl group-hover:scale-115 transition-transform">{mode.icon}</div>
                        <div className="text-[10px] font-bold text-white/90 truncate mt-0.5">{mode.shortTitle}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick PIN Join Bar */}
                <div className="flex items-center justify-between bg-black/50 border border-white/10 rounded-xl px-3 py-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">VÀO PHÒNG BẰNG MÃ PIN:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={quickCode}
                      onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
                      placeholder="ABC123"
                      maxLength={6}
                      className="w-20 bg-transparent text-center font-mono font-bold text-xs uppercase text-[#53b1ff] placeholder-white/30 focus:outline-none tracking-widest"
                    />
                    <button
                      onClick={() => handleJoinDirect(quickCode)}
                      disabled={!connected || quickCode.trim().length < 4}
                      className="px-3 py-0.5 rounded bg-[#0070d1] hover:bg-[#0060b5] text-[10px] font-black uppercase text-white shadow disabled:opacity-30 transition-all cursor-pointer"
                    >
                      VÀO
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: BẢNG XẾP HẠNG THẮNG (5 cols) */}
            <div className="col-span-12 md:col-span-5 flex flex-col min-h-0 overflow-hidden bg-[#181818]/90 border border-white/10 rounded-2xl p-3.5 shadow-xl">
              {/* Header */}
              <div className="flex-shrink-0 flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#f5a623]/20 border border-[#f5a623]/40 flex items-center justify-center text-[#ffce21]">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-white">BẢNG XẾP HẠNG THẮNG</h2>
                    <p className="text-[10px] text-white/40">Top cao thủ có số trận thắng nhiều nhất</p>
                  </div>
                </div>

                <button
                  onClick={fetchLeaderboard}
                  disabled={isLoadingRank}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                  title="Làm mới"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRank ? 'animate-spin text-[#53b1ff]' : ''}`} />
                </button>
              </div>

              {/* Leaderboard Podium & List */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                {/* Top 3 Podium Cards */}
                {topPlayers.slice(0, 3).map((u, idx) => {
                  const rankColor =
                    idx === 0
                      ? 'border-[#f5a623]/60 bg-gradient-to-r from-[#f5a623]/20 to-black/40 text-[#ffce21]'
                      : idx === 1
                      ? 'border-slate-300/40 bg-gradient-to-r from-slate-300/10 to-black/40 text-slate-200'
                      : 'border-amber-700/40 bg-gradient-to-r from-amber-700/10 to-black/40 text-amber-400';
                  const rankBadge = idx === 0 ? '🥇 TOP 1' : idx === 1 ? '🥈 TOP 2' : '🥉 TOP 3';

                  return (
                    <div
                      key={u.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between shadow transition-all ${rankColor}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center text-lg border border-white/10">
                          {AVATARS.find((a) => a.id === u.avatar)?.emoji || '👤'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-black/60 font-mono">
                              {rankBadge}
                            </span>
                            <span className="font-bold text-xs text-white truncate max-w-[110px]">{u.displayName}</span>
                          </div>
                          <div className="text-[10px] text-white/50 font-mono mt-0.5">
                            {u.stats.totalGames} trận đấu • Winrate{' '}
                            {u.stats.totalGames ? Math.round((u.stats.totalWins / u.stats.totalGames) * 100) : 0}%
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-black font-mono tracking-tight">{u.stats.totalWins}</div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-white/50">Trận Thắng</div>
                      </div>
                    </div>
                  );
                })}

                {/* Rank 4 to 10 Rows */}
                <div className="pt-1 space-y-1">
                  {topPlayers.slice(3, 10).map((u, idx) => (
                    <div
                      key={u.id}
                      className="px-2.5 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-center font-mono font-bold text-white/40 text-[11px]">#{idx + 4}</span>
                        <span className="text-sm">{AVATARS.find((a) => a.id === u.avatar)?.emoji || '👤'}</span>
                        <span className="font-semibold text-white/90 truncate max-w-[120px]">{u.displayName}</span>
                      </div>
                      <div className="font-mono font-bold text-emerald-400 text-[11px]">
                        {u.stats.totalWins} <span className="text-white/40 font-normal text-[9px]">thắng</span>
                      </div>
                    </div>
                  ))}

                  {topPlayers.length === 0 && !isLoadingRank && (
                    <div className="text-center py-8 text-white/40 text-xs">
                      Chưa có dữ liệu bảng xếp hạng. Hãy là người đầu tiên chiến thắng!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Auth Modal */}
          <AuthModal isOpen={authModalOpen} initialMode={authMode} onClose={() => setAuthModalOpen(false)} />
        </div>
      );
    }

    // -----------------------------------------------------------------------
    // SUB-VIEW B: SẢNH PHÒNG GAME (LOBBY VIEW)
    // -----------------------------------------------------------------------
    const filteredRooms = publicRooms.filter((r) => {
      if (roomFilterGame !== 'all' && r.gameType !== roomFilterGame) return false;
      if (roomSearchQuery.trim()) {
        const q = roomSearchQuery.toLowerCase();
        return r.id.toLowerCase().includes(q) || r.hostName.toLowerCase().includes(q);
      }
      return true;
    });

    return (
      <div className="h-full w-full flex flex-col min-h-0 overflow-hidden select-none font-sans text-white">
        {/* TOP STATUS BAR (~42px) */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 bg-[#181818]/90 border border-white/10 rounded-xl px-3 py-1.5 mb-2 shadow-lg">
          {/* Left: Button Return to Welcome + Player Gamertag */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('welcome')}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Về Trang Chào Mừng"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180 text-[#53b1ff]" />
              <span className="hidden sm:inline">Trang Chủ</span>
            </button>

            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-[#0070d1] flex items-center justify-center text-lg border border-white/20 shadow">
                {AVATARS.find((a) => a.id === selectedAvatar)?.emoji || '🎮'}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#181818] ${connected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={18}
                className="bg-transparent hover:bg-white/5 focus:bg-black/60 border border-transparent focus:border-[#0070d1] px-1.5 py-0.5 rounded text-xs font-bold text-white tracking-wide transition-all focus:outline-none w-28 sm:w-36"
                title="Bấm để đổi tên hiển thị"
              />
              {user ? (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hidden sm:flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> ĐÃ ĐĂNG NHẬP
                </span>
              ) : (
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#0070d1]/20 hover:bg-[#0070d1]/30 text-[#53b1ff] border border-[#0070d1]/40 transition-colors cursor-pointer"
                >
                  Đăng Nhập
                </button>
              )}
            </div>

            {/* Quick Avatar Emojis */}
            <div className="hidden lg:flex items-center gap-1 ml-1 pl-2 border-l border-white/10">
              {AVATARS.slice(0, 6).map((av) => (
                <button
                  key={av.id}
                  onClick={() => setSelectedAvatar(av.id)}
                  className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-transform cursor-pointer ${
                    selectedAvatar === av.id ? 'bg-[#0070d1] scale-110 shadow' : 'hover:bg-white/10 opacity-70 hover:opacity-100'
                  }`}
                  title={av.label}
                >
                  {av.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Quick Join by Code + Quick Host */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-black/60 border border-white/15 rounded-lg px-2 py-1 gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 hidden sm:inline">MÃ PIN:</span>
              <input
                type="text"
                value={quickCode}
                onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                className="w-16 sm:w-20 bg-transparent text-center font-mono font-bold text-xs uppercase text-[#53b1ff] placeholder-white/30 focus:outline-none tracking-widest"
              />
              <button
                onClick={() => handleJoinDirect(quickCode)}
                disabled={!connected || quickCode.trim().length < 4}
                className="px-2.5 py-0.5 rounded bg-[#0070d1] hover:bg-[#0060b5] text-[10px] font-black uppercase text-white shadow disabled:opacity-30 transition-all cursor-pointer"
              >
                VÀO
              </button>
            </div>

            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#0070d1] to-[#00a3ff] hover:brightness-110 text-white font-extrabold text-[11px] uppercase tracking-wider shadow flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>TẠO PHÒNG</span>
            </button>
          </div>
        </div>

        {/* ERROR CALLOUT */}
        {errorMsg && (
          <div className="flex-shrink-0 mb-2 p-2 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-lg text-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* MAIN BODY: 2-COLUMN VIEWPORT (ZERO SCROLL, 100% VISIBLE) */}
        <div className="flex-1 min-h-0 grid grid-cols-12 gap-3 overflow-hidden">
          {/* =============================================================== */}
          {/* LEFT COLUMN: REBALANCED CONSOLE QUICK PLAY STATION (5 cols)      */}
          {/* =============================================================== */}
          <div className="col-span-12 md:col-span-5 flex flex-col min-h-0 overflow-hidden gap-2">
            {/* Section Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#53b1ff] flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                CHƠI NHANH (QUICK PLAY)
              </span>
              <span className="text-[10px] text-white/40 font-mono">5 BÀN ĐẤU</span>
            </div>

            {/* 5 Interactive Game Selection Cards (Balanced vertical sequence) */}
            <div className="flex-shrink-0 flex flex-col gap-1.5">
              {GAME_MODES.map((mode) => {
                const isSelected = selectedGameType === mode.type;
                const isSearchingThis = searchingGame === mode.type;

                return (
                  <button
                    key={mode.type}
                    onClick={() => setSelectedGameType(mode.type)}
                    className={`relative px-3 py-2 rounded-xl border text-left transition-all duration-150 cursor-pointer flex items-center justify-between overflow-hidden group ${
                      isSelected
                        ? `bg-gradient-to-r ${mode.color} border-white/50 shadow-md ring-1 ring-white/30 scale-[1.01]`
                        : 'bg-[#181818]/90 border-white/10 hover:border-white/25 hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Left: Icon + Title + Subtitle */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-lg flex-shrink-0 shadow">
                        {mode.icon}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-black uppercase truncate tracking-wide ${isSelected ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                            {mode.title}
                          </span>
                          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded font-mono ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
                          }`}>
                            {mode.badge}
                          </span>
                        </div>
                        <div className={`text-[10px] truncate max-w-[210px] ${isSelected ? 'text-white/80' : 'text-white/40 group-hover:text-white/60'}`}>
                          {mode.subtitle}
                        </div>
                      </div>
                    </div>

                    {/* Right: Player count + indicator */}
                    <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                      <span className={`text-[10px] font-mono font-bold ${isSelected ? 'text-white/90' : 'text-white/40'}`}>
                        {mode.maxPlayers}P
                      </span>
                      {isSearchingThis ? (
                        <span className="flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                      ) : isSelected ? (
                        <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_#fff]" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* HERO QUICK PLAY SHOWCASE (Takes remaining height, perfectly balanced, ZERO void!) */}
            {(() => {
              const activeMode = GAME_MODES.find((m) => m.type === (searchingGame || selectedGameType)) || GAME_MODES[0];
              const isSearching = searchingGame !== null;
              const matchingRooms = publicRooms.filter((r) => r.gameType === activeMode.type);

              return (
                <div
                  className={`flex-1 min-h-0 rounded-2xl border p-3.5 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
                    isSearching
                      ? 'border-[#0070d1] bg-gradient-to-br from-[#0070d1]/30 via-[#0a192f] to-[#001428] shadow-[0_0_35px_rgba(0,112,209,0.4)]'
                      : 'border-white/15 bg-gradient-to-br from-[#1c1d22] to-[#121316] shadow-xl'
                  }`}
                >
                  {/* PlayStation ambient neon background glow */}
                  <div
                    className="absolute -top-16 -right-16 w-52 h-52 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-500"
                    style={{ backgroundColor: activeMode.accentHex }}
                  />

                  {isSearching ? (
                    /* ACTIVE MATCHMAKING RADAR STATE */
                    <div className="h-full flex flex-col justify-between items-center text-center py-1 relative z-10">
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>ĐANG TÌM ĐỐI THỦ PHÙ HỢP</span>
                      </div>

                      {/* Radar Animation */}
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center my-auto">
                        <span className="absolute inset-0 rounded-full border border-[#0070d1]/40 animate-ping opacity-60" />
                        <span className="absolute inset-2 rounded-full border border-[#0070d1]/60 animate-ping opacity-80" />
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[#0070d1] to-[#004385] flex items-center justify-center text-2xl shadow-[0_0_30px_rgba(0,112,209,0.8)] z-10">
                          {activeMode.icon}
                        </div>
                      </div>

                      <div className="space-y-0.5 mb-2">
                        <div className="text-xl font-black font-mono text-white tracking-wider">
                          {String(Math.floor(searchSeconds / 60)).padStart(2, '0')}:{String(searchSeconds % 60).padStart(2, '0')}
                        </div>
                        <div className="text-xs font-extrabold text-[#53b1ff] uppercase">{activeMode.title}</div>
                        <div className="text-[10px] text-white/50 max-w-xs mx-auto">
                          Tự động ghép vào bàn đấu đang mở hoặc tự tạo phòng sau ít giây...
                        </div>
                      </div>

                      <button
                        onClick={handleCancelMatchmaking}
                        className="w-full py-2 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-[0.98]"
                      >
                        HỦY TÌM TRẬN
                      </button>
                    </div>
                  ) : (
                    /* STANDARD SELECTED GAME HERO */
                    <div className="h-full flex flex-col justify-between relative z-10">
                      {/* Top Info Banner */}
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${activeMode.color} flex items-center justify-center text-2xl shadow-[0_6px_16px_rgba(0,0,0,0.5)] border border-white/20 flex-shrink-0`}
                          >
                            {activeMode.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-base sm:text-lg font-black text-white tracking-wide truncate">
                                {activeMode.title}
                              </h3>
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-white/10 text-white/80 border border-white/15">
                                {activeMode.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-white/60 font-medium truncate">{activeMode.subtitle}</p>
                          </div>
                        </div>

                        {/* Badges / Game Attributes */}
                        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/10 text-[10px] font-medium text-white/70">
                          <span className="px-2 py-1 rounded-lg bg-black/40 border border-white/10 flex items-center gap-1.5 font-mono">
                            <Users className="w-3 h-3 text-[#53b1ff]" /> Max {activeMode.maxPlayers} người
                          </span>
                          <span className="px-2 py-1 rounded-lg bg-black/40 border border-white/10 flex items-center gap-1.5 font-mono">
                            <Gamepad2 className="w-3 h-3 text-emerald-400" /> Đấu Bot &amp; Online
                          </span>
                          <span className="px-2 py-1 rounded-lg bg-black/40 border border-white/10 flex items-center gap-1.5 font-mono col-span-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>{matchingRooms.length > 0 ? `${matchingRooms.length} phòng đang mở sẵn` : 'Chưa có phòng, tạo ngay!'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Bottom: Dual Action Buttons (50% / 50% width) */}
                      <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-white/10 mt-auto">
                        <button
                          onClick={() => handleStartMatchmaking(activeMode.type)}
                          disabled={!connected || !playerName.trim()}
                          className="w-full py-2.5 px-2 rounded-xl bg-gradient-to-r from-[#0070d1] to-[#005bb5] hover:brightness-110 active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider shadow-[0_0_15px_rgba(0,112,209,0.4)] flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                        >
                          <Radio className="w-3.5 h-3.5 text-emerald-300 animate-pulse flex-shrink-0" />
                          <span>TÌM TRẬN</span>
                        </button>

                        <button
                          onClick={() => {
                            setCreateGameType(activeMode.type);
                            setCreateModalOpen(true);
                          }}
                          disabled={!connected || !playerName.trim()}
                          className="w-full py-2.5 px-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/40 active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider shadow flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                          title="Tạo phòng đấu mới"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#53b1ff] flex-shrink-0" />
                          <span>TẠO PHÒNG</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* =============================================================== */}
          {/* RIGHT COLUMN: ROOM BROWSER & COMPACT LEADERBOARD (7 cols)       */}
          {/* =============================================================== */}
          <div className="col-span-12 md:col-span-7 flex flex-col min-h-0 overflow-hidden bg-[#181818]/90 border border-white/10 rounded-2xl p-3">
            {/* Header Tabs */}
            <div className="flex-shrink-0 flex items-center justify-between pb-2 mb-2 border-b border-white/10 gap-2">
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setRightTab('browser')}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                    rightTab === 'browser'
                      ? 'bg-[#0070d1] text-white shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-[#53b1ff]" />
                  <span>DANH SÁCH PHÒNG ({publicRooms.length})</span>
                </button>

                <button
                  onClick={() => setRightTab('rank')}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                    rightTab === 'rank'
                      ? 'bg-[#f5a623] text-black shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5 text-[#ffce21]" />
                  <span>BẢNG XẾP HẠNG</span>
                </button>
              </div>

              <button
                onClick={rightTab === 'browser' ? fetchPublicRooms : fetchLeaderboard}
                disabled={isLoadingRooms || isLoadingRank}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                title="Làm mới"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRooms || isLoadingRank ? 'animate-spin text-[#53b1ff]' : ''}`} />
              </button>
            </div>

            {/* TAB 1: ROOM BROWSER */}
            {rightTab === 'browser' && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Search & Filter pills */}
                <div className="flex-shrink-0 flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    {(['all', 'uno', 'exploding-kittens', 'tien-len', 'co-vua', 'co-tuong'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setRoomFilterGame(m)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                          roomFilterGame === m ? 'bg-white/20 text-white border border-white/30' : 'text-white/50 hover:text-white'
                        }`}
                      >
                        {m === 'all' ? 'Tất Cả' : m === 'uno' ? 'UNO' : m === 'exploding-kittens' ? 'Mèo Nổ' : m === 'tien-len' ? 'Tiến Lên' : m === 'co-vua' ? 'Cờ Vua' : 'Cờ Tướng'}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-36 sm:w-44">
                    <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      value={roomSearchQuery}
                      onChange={(e) => setRoomSearchQuery(e.target.value)}
                      placeholder="Tìm mã / chủ phòng..."
                      className="w-full bg-[#121314] border border-white/10 rounded-full pl-6 pr-2 py-0.5 text-[11px] text-white placeholder-white/30 focus:outline-none focus:border-[#0070d1]"
                    />
                  </div>
                </div>

                {/* Rooms scrollable inner list */}
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {filteredRooms.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
                      <div className="text-2xl mb-1">🏜️</div>
                      <div className="text-xs font-bold text-white/80">Chưa có phòng nào đang mở</div>
                      <p className="text-[10px] text-white/40 mt-0.5">Bấm &quot;Tạo Phòng&quot; để mở bàn đấu đầu tiên!</p>
                      <button
                        onClick={() => setCreateModalOpen(true)}
                        className="mt-2 px-3 py-1 rounded-full bg-[#0070d1] text-[10px] font-bold uppercase hover:bg-[#0060b5] cursor-pointer"
                      >
                        Tạo Phòng Ngay
                      </button>
                    </div>
                  ) : (
                    filteredRooms.map((r) => {
                      const modeInfo = GAME_MODES.find((m) => m.type === r.gameType) || GAME_MODES[0];
                      const isFull = r.playerCount >= r.maxPlayers;
                      const canJoin = !r.inGame && !isFull;

                      return (
                        <div
                          key={r.id}
                          className="p-2.5 rounded-xl border border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05] transition-all flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-lg border border-white/10 flex-shrink-0">
                              {modeInfo.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-white text-xs tracking-wider">#{r.id}</span>
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-[#0070d1]/20 text-[#53b1ff] border border-[#0070d1]/30">
                                  {modeInfo.title}
                                </span>
                              </div>
                              <div className="text-[11px] text-white/50 flex items-center gap-2 mt-0.5">
                                <span>Chủ: <strong className="text-white/80">{r.hostName}</strong></span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Users className="w-2.5 h-2.5 text-[#53b1ff]" /> {r.playerCount}/{r.maxPlayers}
                                </span>
                                <span>•</span>
                                <span className={r.inGame ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                                  {r.inGame ? 'Đang Đấu' : 'Đang Chờ'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {canJoin ? (
                            <button
                              onClick={() => handleJoinDirect(r.id)}
                              className="px-3.5 py-1.5 rounded-lg font-bold text-xs bg-[#0070d1] hover:bg-[#0060b5] text-white shadow transition-all cursor-pointer flex items-center gap-1 flex-shrink-0"
                            >
                              <span>VÀO</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-white/10 text-white/40 border border-white/10 flex-shrink-0">
                              {r.inGame ? 'Đang Đấu' : 'Đầy'}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: COMPACT LEADERBOARD */}
            {rightTab === 'rank' && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex-shrink-0 flex items-center justify-between text-[11px] text-white/50 pb-1.5 px-2 border-b border-white/5 font-semibold">
                  <span>HẠNG & KỲ THỦ</span>
                  <span>TRẬN THẮNG</span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5 pt-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {topPlayers.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-white/40">
                      Chưa có dữ liệu xếp hạng
                    </div>
                  ) : (
                    topPlayers.map((u, idx) => {
                      const rank = idx + 1;
                      const isTop1 = rank === 1;
                      const isTop2 = rank === 2;
                      const isTop3 = rank === 3;

                      return (
                        <div
                          key={u.id || idx}
                          className={`p-2 rounded-xl border flex items-center justify-between text-xs transition-all ${
                            isTop1
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                              : 'bg-white/[0.02] border-white/5 text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                              isTop1 ? 'bg-[#f5a623] text-black shadow' : isTop2 ? 'bg-gray-300 text-black' : isTop3 ? 'bg-amber-700 text-white' : 'bg-white/10 text-white/60'
                            }`}>
                              {rank}
                            </span>
                            <span className="text-base">{u.avatar ? (AVATARS.find(a => a.id === u.avatar)?.emoji || '👤') : '👤'}</span>
                            <span className="font-bold">{u.displayName}</span>
                          </div>

                          <div className="flex items-center gap-1 font-mono font-bold text-[#f5a623]">
                            <Trophy className="w-3 h-3 text-[#ffce21]" />
                            <span>{u.stats?.totalWins || 0}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MODAL: TẠO PHÒNG MỚI */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-[#181818] border border-white/15 rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#0070d1] flex items-center justify-center font-bold text-white shadow">
                    <Plus className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-black text-white">MỞ PHÒNG ĐẤU MỚI</h3>
                </div>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                  Chọn Board Game
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GAME_MODES.map((mode) => (
                    <button
                      key={mode.type}
                      type="button"
                      onClick={() => setCreateGameType(mode.type)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        createGameType === mode.type
                          ? 'border-[#0070d1] bg-[#0070d1]/30 shadow'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="text-xl mb-0.5">{mode.icon}</div>
                      <div className="text-[11px] font-bold text-white">{mode.title}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                  Thời gian mỗi lượt
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[15, 30, 45].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setCreateTurnLimit(sec)}
                      className={`py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        createTurnLimit === sec ? 'border-[#53b1ff] bg-[#0070d1]/40 text-white' : 'border-white/10 bg-white/5 text-white/60'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  setCreateModalOpen(false);
                  onCreateRoom(playerName, selectedAvatar, user?.id, 0, createGameType);
                }}
                disabled={!connected || !playerName.trim()}
                className="w-full py-3 rounded-full font-black text-xs tracking-wider uppercase bg-[#0070d1] hover:bg-[#0060b5] text-white shadow-[0_0_20px_rgba(0,112,209,0.5)] cursor-pointer disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
              >
                <Gamepad2 className="w-4 h-4" />
                <span>MỞ BÀN ĐẤU NGAY</span>
              </button>
            </div>
          </div>
        )}

        {/* Auth Modal */}
        <AuthModal
          isOpen={authModalOpen}
          initialMode={authMode}
          onClose={() => setAuthModalOpen(false)}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ACTIVE IN-ROOM STAGING ARENA (1-PAGE ZERO SCROLL)
  // =========================================================================
  const isHost = player.isHost;
  const getMaxAllowed = (settings: RoomSettings): number => {
    if (settings.gameType === 'uno') return 8;
    if (settings.gameType === 'tien-len') return 4;
    if (settings.gameType === 'co-ca-ngua') return 4;
    if (settings.gameType === 'co-vua') return 2;
    if (settings.gameType === 'co-tuong') return 2;
    if (settings.gameType === 'exploding-kittens') {
      let max = 5;
      const exp = settings.ekExpansions;
      if (exp?.implodingKittens) max += 1;
      if (exp?.streakingKittens) max += 2;
      if (exp?.barkingKittens) max += 2;
      return Math.min(10, max);
    }
    return 4;
  };
  const maxAllowed = getMaxAllowed(room.settings);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput);
    setChatInput('');
  };

  const currentGameInfo = GAME_MODES.find((m) => m.type === room.settings.gameType) || GAME_MODES[0];

  return (
    <div className="h-full w-full flex flex-col min-h-0 overflow-hidden select-none font-sans text-white">
      {/* ROOM TOP HUD BAR (~44px) */}
      <div className="flex-shrink-0 bg-[#181818]/90 border border-white/10 rounded-xl px-4 py-2 mb-2 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0070d1] flex items-center justify-center text-lg border border-white/20 shadow">
            {currentGameInfo.icon}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono font-extrabold text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              PHÒNG CHỜ
            </span>
            <span className="text-xs font-bold text-white px-2 py-0.5 rounded bg-white/10">
              {currentGameInfo.title}
            </span>
            <span className="text-xs text-white/50">• Mã phòng:</span>
            <button
              onClick={handleCopyCode}
              className="font-mono font-black text-sm tracking-wider text-[#53b1ff] bg-black/50 hover:bg-black/80 px-2 py-0.5 rounded flex items-center gap-1 border border-white/10 transition-all cursor-pointer"
              title="Sao chép mã"
            >
              <span>{room.id}</span>
              <Copy className="w-3 h-3" />
            </button>
            {copied && <span className="text-emerald-400 text-xs font-bold">Đã chép!</span>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-white/60 hidden sm:inline">
            {room.players.length} / {maxAllowed} Tuyển thủ
          </span>

          <button
            onClick={onLeaveRoom}
            className="px-3 py-1 rounded-lg bg-white/5 hover:bg-rose-500/20 text-white/70 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
          >
            ✕ Rời Phòng
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex-shrink-0 mb-2 p-2 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-lg text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STAGING ARENA BODY (ZERO SCROLL, 1-PAGE) */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-3 overflow-hidden">
        {/* LEFT: PLAYER PODS + COMPACT CHAT (7 cols) */}
        <div className="col-span-12 lg:col-span-7 flex flex-col min-h-0 overflow-hidden gap-2">
          {/* Player Pods Container */}
          <div className="flex-1 min-h-0 bg-[#181818]/90 border border-white/10 rounded-2xl p-3 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#53b1ff] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                ĐỘI HÌNH BÀN ĐẤU ({room.players.length}/{maxAllowed})
              </span>
              {isHost && room.players.length < maxAllowed && (
                <button
                  onClick={onAddBot}
                  className="px-2.5 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Bot className="w-3 h-3" />
                  + Thêm Bot AI
                </button>
              )}
            </div>

            {/* Inner scrollable Pods Grid */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
              {room.players.map((p) => {
                const avatarEmoji = AVATARS.find((a) => a.id === p.avatar)?.emoji || '👤';
                const isMe = p.id === player.id;

                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                      isMe
                        ? 'bg-[#0070d1]/20 border-[#0070d1]/60 shadow-[0_0_15px_rgba(0,112,209,0.3)]'
                        : 'bg-white/[0.03] border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-xl border border-white/10 flex-shrink-0">
                        {p.isBot ? '🤖' : avatarEmoji}
                      </div>

                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-xs text-white truncate max-w-[110px]">{p.name}</span>
                          {p.isHost && (
                            <span className="px-1 py-0.2 rounded text-[8px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              CHỦ
                            </span>
                          )}
                          {p.isBot && (
                            <span className="px-1 py-0.2 rounded text-[8px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              BOT
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] flex items-center gap-1 mt-0.5 font-medium">
                          <span className={`w-1.5 h-1.5 rounded-full ${p.isReady ? 'bg-emerald-400' : 'bg-white/30'}`} />
                          <span className={p.isReady ? 'text-emerald-400 font-bold' : 'text-white/40'}>
                            {p.isReady ? 'SẴN SÀNG' : 'CHỜ...'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {p.isReady && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                      {isHost && p.id !== player.id && (
                        <button
                          onClick={() => onRemoveBot(p.id)}
                          className="p-1 text-white/40 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                          title="Đuổi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {Array.from({ length: Math.max(0, maxAllowed - room.players.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="p-2.5 rounded-xl border border-dashed border-white/10 bg-white/[0.01] flex items-center justify-center text-white/30 text-[11px] font-bold gap-1.5"
                >
                  <Users className="w-3 h-3 opacity-30" />
                  Slot trống
                </div>
              ))}
            </div>
          </div>

          {/* Chat Feed (~130px) */}
          <div className="flex-shrink-0 h-32 bg-[#181818]/90 border border-white/10 rounded-2xl p-2.5 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1 mb-1.5 pr-1 text-[11px] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10">
              {room.chatMessages.map((m) => (
                <div key={m.id} className="p-1 rounded bg-white/[0.03]">
                  <span className="font-bold text-[#53b1ff] mr-1">{m.senderName}:</span>
                  <span className="text-white/90">{m.text}</span>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChat} className="flex gap-1.5 flex-shrink-0">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Nhập chat..."
                maxLength={80}
                className="flex-1 bg-[#121314] border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#0070d1]"
              />
              <button
                type="submit"
                className="p-1.5 bg-[#0070d1] hover:bg-[#0060b5] text-white rounded-lg transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT: SETTINGS & ACTION CTA (5 cols) */}
        <div className="col-span-12 lg:col-span-5 flex flex-col min-h-0 overflow-hidden bg-[#181818]/90 border border-white/10 rounded-2xl p-3 justify-between">
          <div className="space-y-3 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10">
            <div className="flex items-center gap-1.5 pb-2 border-b border-white/10">
              <Settings className="w-4 h-4 text-[#53b1ff]" />
              <h3 className="text-xs font-black uppercase text-white">THIẾT LẬP LUẬT ĐẤU</h3>
            </div>

            {/* Game Selector */}
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">Trò chơi</span>
              <div className="grid grid-cols-3 gap-1.5">
                {GAME_MODES.map((g) => (
                  <button
                    key={g.type}
                    disabled={!isHost}
                    onClick={() => onUpdateSettings({ gameType: g.type })}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      room.settings.gameType === g.type
                        ? 'border-[#0070d1] bg-[#0070d1]/30 shadow'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    } ${!isHost && 'cursor-not-allowed opacity-75'}`}
                  >
                    <div className="text-lg">{g.icon}</div>
                    <div className="text-[10px] font-bold text-white truncate">{g.title}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* UNO Rules */}
            {room.settings.gameType === 'uno' && (
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-white/50">Tùy chọn UNO</span>
                {[
                  { key: 'jumpIn', label: 'Cướp lượt (Jump-in)' },
                  { key: 'freeStacking', label: 'Cộng dồn lá phạt (+2, +4)' },
                  { key: 'sevenZero', label: 'Đổi bài khi ra lá 7-0' }
                ].map((rule) => {
                  const k = rule.key as keyof typeof room.settings.unoRules;
                  const val = room.settings.unoRules[k];
                  return (
                    <label
                      key={rule.key}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer ${
                        val ? 'bg-[#0070d1]/20 border-[#0070d1]/40 text-white' : 'bg-white/[0.02] border-white/10 text-white/60'
                      } ${!isHost && 'pointer-events-none'}`}
                    >
                      <span className="text-[11px]">{rule.label}</span>
                      <input
                        type="checkbox"
                        checked={val as boolean}
                        disabled={!isHost}
                        onChange={(e) =>
                          onUpdateSettings({
                            unoRules: { ...room.settings.unoRules, [k]: e.target.checked }
                          })
                        }
                        className="rounded text-[#0070d1] bg-black border-white/20"
                      />
                    </label>
                  );
                })}
              </div>
            )}

            {/* Tiến Lên Rules */}
            {room.settings.gameType === 'tien-len' && (
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-white/50">Tùy chọn Tiến Lên</span>
                <label
                  className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer ${
                    room.settings.tienLenCutTwoRule !== false ? 'bg-[#0070d1]/20 border-[#0070d1]/40 text-white' : 'bg-white/[0.02] border-white/10 text-white/60'
                  } ${!isHost && 'pointer-events-none'}`}
                >
                  <span className="text-[11px]">Luật chặt 2 (Heo) bằng hàng</span>
                  <input
                    type="checkbox"
                    checked={room.settings.tienLenCutTwoRule !== false}
                    disabled={!isHost}
                    onChange={(e) => onUpdateSettings({ tienLenCutTwoRule: e.target.checked })}
                    className="rounded text-[#0070d1] bg-black border-white/20"
                  />
                </label>
              </div>
            )}

            {/* Mèo Nổ Expansions */}
            {room.settings.gameType === 'exploding-kittens' && (
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-white/50">Mở rộng Mèo Nổ</span>
                {[
                  { key: 'implodingKittens', label: 'Imploding Kittens (Max 6)' },
                  { key: 'streakingKittens', label: 'Streaking Kittens (Max 8)' }
                ].map((exp) => {
                  const k = exp.key as keyof EKExpansions;
                  const val = !!room.settings.ekExpansions?.[k];
                  return (
                    <label
                      key={exp.key}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer ${
                        val ? 'bg-[#0070d1]/20 border-[#0070d1]/40 text-white' : 'bg-white/[0.02] border-white/10 text-white/60'
                      } ${!isHost && 'pointer-events-none'}`}
                    >
                      <span className="text-[11px]">{exp.label}</span>
                      <input
                        type="checkbox"
                        checked={val}
                        disabled={!isHost}
                        onChange={(e) => {
                          const current = room.settings.ekExpansions || {
                            implodingKittens: false,
                            streakingKittens: false,
                            barkingKittens: false,
                            timebombMode: false
                          };
                          onUpdateSettings({ ekExpansions: { ...current, [k]: e.target.checked } });
                        }}
                        className="rounded text-[#0070d1] bg-black border-white/20"
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Button at bottom */}
          <div className="pt-2 border-t border-white/10 flex-shrink-0">
            {isHost ? (
              <button
                onClick={onStartGame}
                disabled={room.players.length < 2}
                className="w-full py-3 rounded-xl font-black text-xs tracking-wider uppercase bg-[#0070d1] hover:bg-[#0060b5] text-white shadow-[0_0_20px_rgba(0,112,209,0.5)] cursor-pointer disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>BẮT ĐẦU TRẬN ({room.players.length} Tuyển thủ)</span>
              </button>
            ) : (
              <button
                onClick={() => onSetReady(!player.isReady)}
                className={`w-full py-3 rounded-xl font-black text-xs tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  player.isReady ? 'bg-[#0070d1] text-white shadow-[0_0_20px_rgba(0,112,209,0.5)]' : 'bg-white/10 hover:bg-white/15 text-white border border-white/20'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>{player.isReady ? 'ĐÃ SẴN SÀNG (BẤM ĐỂ HỦY)' : 'BẤM ĐỂ SẴN SÀNG'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbyView;
