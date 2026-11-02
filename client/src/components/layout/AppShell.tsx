import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Gamepad2,
  Trophy,
  LogOut,
  User,
  UserPlus,
  Languages
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { DictKey } from '../../i18n/dict';
import { AuthModal } from '../auth/AuthModal';

interface NavItem {
  to: string;
  label: DictKey;
  icon: any;
  badge?: string;
}

const CONSOLE_NAV_ITEMS: NavItem[] = [
  { to: '/play', label: 'nav.play', icon: Gamepad2, badge: 'ĐẤU TRƯỜNG' },
  { to: '/leaderboard', label: 'nav.leaderboard', icon: Trophy, badge: 'XẾP HẠNG' }
];

export const LangToggle: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { lang, setLang } = useLang();
  return (
    <button
      onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
      title="Tiếng Việt / English"
      className={`flex items-center gap-1 rounded-full border border-white/15 bg-white/5 hover:bg-white/15 hover:border-[#0070d1] text-gray-200 transition-all cursor-pointer ${
        compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
      }`}
    >
      <Languages className="w-3.5 h-3.5 text-[#53b1ff]" />
      <span className={lang === 'vi' ? 'text-white font-bold' : 'text-gray-400 font-medium'}>VI</span>
      <span className="text-gray-600">|</span>
      <span className={lang === 'en' ? 'text-white font-bold' : 'text-gray-400 font-medium'}>EN</span>
    </button>
  );
};

export const AppShell: React.FC = () => {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();

  const [profileOpen, setProfileOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  return (
    <div className="h-screen h-[100dvh] w-full bg-[#0a0a0c] text-white font-sans overflow-hidden flex flex-col selection:bg-[#0070d1] selection:text-white">
      {/* Game Console Top HUD Bar (No Sidebar - 100% Game Experience) */}
      <header className="flex-shrink-0 z-40 bg-[#121314]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-2 flex items-center justify-between gap-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
        {/* Left: PlayStation Game Emblem */}
        <div
          className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0"
          onClick={() => navigate('/play')}
        >
          <div className="w-9 h-9 rounded-full bg-[#0070d1] flex items-center justify-center shadow-[0_0_20px_rgba(0,112,209,0.6)] transition-transform group-hover:scale-105">
            <span className="font-black text-sm tracking-tighter text-white">PS</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-white group-hover:text-[#53b1ff] transition-colors">
                OmniDeck
              </span>
              <span className="text-[10px] text-white/40 font-mono tracking-wider hidden sm:inline">△◯✕▢</span>
            </div>
            <p className="text-[10px] text-white/50 font-medium leading-none">Board Game Arena</p>
          </div>
        </div>

        {/* Center: Console Navigation Mode Selector (Game-style Menu Pills) */}
        <nav className="flex items-center gap-1.5 p-1 bg-black/50 border border-white/10 rounded-full shadow-inner">
          {CONSOLE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const label = t(item.label);
            const isActive = item.to === '/leaderboard'
              ? location.pathname === '/leaderboard' || location.search.includes('rank')
              : (location.pathname === '/play' || location.pathname === '/' || location.pathname === '/dashboard') && !location.search.includes('rank');

            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-[#0070d1] text-white shadow-[0_0_18px_rgba(0,112,209,0.6)] transform scale-[1.02]'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-white/60'}`} />
                <span>{label}</span>

                {item.badge && (
                  <span
                    className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full border hidden md:inline ${
                      isActive
                        ? 'bg-white/20 text-white border-white/30'
                        : 'bg-white/10 text-white/60 border-white/10'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Gamertag, Stats & Profile Menu */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <LangToggle compact />

          {user ? (
            <div className="flex items-center gap-2.5">
              {/* Wins Trophy Badge (No Currency) */}
              <div
                onClick={() => navigate('/leaderboard')}
                className="inline-flex items-center gap-1.5 bg-[#181818] hover:bg-[#202024] border border-white/10 hover:border-[#0070d1]/50 px-3.5 py-1.5 rounded-full cursor-pointer transition-all active:scale-95"
                title="Thành tích thi đấu"
              >
                <Trophy className="w-3.5 h-3.5 text-[#ffce21]" />
                <span className="font-bold text-xs text-white">
                  {user.stats?.totalWins || 0}
                </span>
                <span className="text-[11px] text-white/40 hidden md:inline font-medium">Trận Thắng</span>
              </div>

              {/* Gamertag Profile & Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1 pl-2 sm:pr-3 rounded-full bg-[#181818] hover:bg-[#202024] border border-white/15 hover:border-[#0070d1]/60 transition-all cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-[#0070d1] flex items-center justify-center font-black text-xs text-white shadow-[0_0_10px_rgba(0,112,209,0.5)]">
                    {user.avatar ? (
                      <span className="text-sm">{user.avatar === 'av-fox' ? '🦊' : user.avatar === 'av-cat' ? '🐱' : user.avatar === 'av-dragon' ? '🐉' : '🎮'}</span>
                    ) : (
                      user.displayName?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="font-semibold text-xs text-white hidden sm:inline max-w-[100px] truncate">
                    {user.displayName}
                  </span>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-[#141517] border border-white/15 shadow-2xl py-2 z-50 text-xs backdrop-blur-xl">
                    <div className="px-4 py-2 border-b border-white/10">
                      <div className="font-bold text-white truncate">{user.displayName}</div>
                      <div className="text-[11px] text-white/40">@{user.username}</div>
                    </div>

                    <button
                      onClick={() => {
                        navigate('/play');
                        setProfileOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-white/10 flex items-center gap-2 text-white/80 hover:text-white cursor-pointer"
                    >
                      <Gamepad2 className="w-4 h-4 text-[#53b1ff]" />
                      <span>Vào Đấu Trường</span>
                    </button>

                    <button
                      onClick={() => {
                        navigate('/leaderboard');
                        setProfileOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-white/10 flex items-center gap-2 text-white/80 hover:text-white cursor-pointer"
                    >
                      <Trophy className="w-4 h-4 text-[#ffce21]" />
                      <span>Bảng Vàng Kỳ Thủ</span>
                    </button>

                    <div className="border-t border-white/10 my-1" />

                    <button
                      onClick={() => {
                        logout();
                        setProfileOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-rose-500/20 text-rose-400 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng Xuất</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuth('login')}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white transition-all cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Đăng Nhập</span>
              </button>
              <button
                onClick={() => openAuth('register')}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#0070d1] hover:bg-[#0064b7] text-xs font-semibold text-white shadow-[0_0_12px_rgba(0,112,209,0.4)] transition-all cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Đăng Ký</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Full-Width Immersive Game Area (1-Page No Scroll) */}
      <main className="flex-1 w-full overflow-hidden px-3 sm:px-6 py-2 flex flex-col min-h-0">
        <Outlet />
      </main>

      {showAuthModal && (
        <AuthModal isOpen={showAuthModal} initialMode={authMode} onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
};

export default AppShell;
