import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Coins, Briefcase, Check, X, Clock, Zap, Trophy, Sparkles 
} from 'lucide-react';
import { PublicUser } from '../../types/game';
import { useLang } from '../../i18n/LanguageContext';

interface WorkViewProps {
  user: PublicUser | null;
  socket: any; // Socket.IO client
  onBack: () => void;
  onBalanceUpdate: (newBalance: number) => void;
  onOpenAuth?: () => void;
}

const AntiCopyWord: React.FC<{ word: string }> = ({ word }) => {
  return (
    <div 
      className="select-none pointer-events-none w-full flex justify-center items-center py-4"
      onContextMenu={(e) => e.preventDefault()}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <svg width="100%" height="80" viewBox={`0 0 ${Math.max(word.length * 40, 300)} 80`}>
        <text 
          x="50%" 
          y="50%" 
          dominantBaseline="middle" 
          textAnchor="middle" 
          fill="white" 
          fontSize="48" 
          fontWeight="300"
          fontFamily="'Plus Jakarta Sans', sans-serif"
          letterSpacing="0.05em"
        >
          {word}
        </text>
      </svg>
    </div>
  );
};

export const WorkView: React.FC<WorkViewProps> = ({ user, socket, onBack, onBalanceUpdate, onOpenAuth }) => {
  const { t, lang, setLang } = useLang();
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [wordLang, setWordLang] = useState<string>('vi');
  const [typedText, setTypedText] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [sessionEarned, setSessionEarned] = useState(0);
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState<'success' | 'fail' | null>(null);
  const [balance, setBalance] = useState(user?.balance || 0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [cooldownLeft, setCooldownLeft] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Update balance when user prop changes
  useEffect(() => {
    if (user) {
      setBalance(user.balance);
    }
  }, [user]);

  // Timers
  const requestWorkRef = useRef<() => void>(() => {});
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (expiresAt) {
        const remaining = Math.max(0, expiresAt - now);
        setTimeLeft(remaining);
        if (remaining === 0 && currentWord) {
          handleTimeout();
        }
      }

      if (cooldownUntil) {
        const remaining = Math.max(0, cooldownUntil - now);
        setCooldownLeft(remaining);
        if (remaining === 0) {
          setCooldownUntil(null);
          if (!currentWord && !result && user && socket) {
            setTimeout(() => requestWorkRef.current(), 300);
          }
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [expiresAt, cooldownUntil, currentWord, result, user, socket]);

  useEffect(() => {
    if (currentWord && !result) {
      inputRef.current?.focus();
      const t1 = setTimeout(() => inputRef.current?.focus(), 50);
      const t2 = setTimeout(() => inputRef.current?.focus(), 150);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [currentWord, result]);

  const handleTimeout = () => {
    setResult('fail');
    setMessage('Hết thời gian! Nhập quá chậm.');
    setStreak(0);
    setCurrentWord(null);
    setExpiresAt(null);
    setCooldownUntil(Date.now() + 3000);
    setTimeout(() => {
      setResult(null);
      setMessage('');
    }, 2000);
  };

  const requestWork = useCallback(() => {
    if (!user) {
      onOpenAuth?.();
      return;
    }
    if (!socket || !socket.connected) {
      setMessage('Mất kết nối máy chủ!');
      return;
    }

    setMessage('');
    setResult(null);
    setTypedText('');

    socket.emit('work:request', { lang }, (res: any) => {
      if (res && res.success) {
        setCurrentWord(res.word);
        setWordLang(res.lang || lang);
        setExpiresAt(res.expiresAt);
        setTimeLeft(res.expiresAt - Date.now());
      } else {
        setMessage(res?.message || 'Không thể nhận việc lúc này');
        if (res?.cooldownUntil) {
          setCooldownUntil(res.cooldownUntil);
        }
      }
    });
  }, [user, socket, onOpenAuth, lang]);

  useEffect(() => {
    requestWorkRef.current = requestWork;
  }, [requestWork]);

  const submitWork = (finalText: string) => {
    if (!socket || !socket.connected || !user) return;

    socket.emit('work:submit', { typedText: finalText }, (res: any) => {
      if (res && res.success) {
        setResult('success');
        setMessage(res.message);
        setSessionEarned(prev => prev + res.reward);
        setStreak(res.streak);
        setBalance(res.newBalance);
        onBalanceUpdate(res.newBalance);
      } else {
        setResult('fail');
        setMessage(res?.message || 'Sai rồi!');
        setStreak(0);
      }

      setCurrentWord(null);
      setExpiresAt(null);
      if (res?.cooldownUntil) {
        setCooldownUntil(res.cooldownUntil);
      }

      setTimeout(() => {
        setResult(null);
        setMessage('');
      }, 1500);
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTypedText(val);

    if (currentWord && val.trim().toLowerCase() === currentWord.trim().toLowerCase()) {
      submitWork(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (typedText.trim()) {
        submitWork(typedText);
      }
    }
  };

  const renderColoredText = () => {
    if (!currentWord) return null;
    
    return (
      <div className="flex justify-center text-3xl font-mono mt-4 select-none pointer-events-none" onContextMenu={e => e.preventDefault()}>
        {currentWord.split('').map((char, index) => {
          let colorClass = 'text-white/30';
          if (index < typedText.length) {
            colorClass = typedText[index].toLowerCase() === char.toLowerCase() 
              ? 'text-emerald-400' 
              : 'text-rose-400';
          }
          return (
            <span key={index} className={`${colorClass} transition-colors duration-150`}>
              {char}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans max-w-5xl mx-auto pb-12">
      {/* Top Bar (PlayStation HUD) */}
      <div className="flex items-center justify-between p-4 bg-[#121314] rounded-2xl border border-white/10 sticky top-0 z-10 shadow-lg">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center text-white/70 hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <h1 className="text-lg font-light text-white flex items-center gap-2">
          <Briefcase className="text-[#53b1ff] w-5 h-5" />
          <span>{t('work.title')}</span>
        </h1>
        
        <div className="flex items-center gap-2.5">
          {/* Toggle VI/EN */}
          <div className="flex items-center rounded-full border border-white/15 bg-white/5 p-1" title="Ngôn ngữ từ">
            <button
              onClick={() => setLang('vi')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${lang === 'vi' ? 'bg-[#0070d1] text-white shadow-[0_0_10px_rgba(0,112,209,0.4)]' : 'text-white/60 hover:text-white'}`}
            >
              VI
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${lang === 'en' ? 'bg-[#0070d1] text-white shadow-[0_0_10px_rgba(0,112,209,0.4)]' : 'text-white/60 hover:text-white'}`}
            >
              EN
            </button>
          </div>
          <div className="flex items-center gap-2 bg-[#181818] px-4 py-1.5 rounded-full border border-[#f5a623]/30">
            <Coins className="w-4 h-4 text-[#f5a623]" />
            <span className="font-bold text-xs text-[#f5a623]">{balance.toLocaleString()} 🪙</span>
          </div>
        </div>
      </div>

      {/* Stats Row (PlayStation Tiles) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 my-6">
        <div className="bg-[#181818] p-5 rounded-2xl border border-white/10 flex flex-col items-center justify-center shadow-lg">
          <div className="text-white/50 text-xs mb-1 flex items-center gap-1.5 font-bold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 text-[#53b1ff]" /> {t('work.session')}
          </div>
          <div className="text-2xl font-light text-white">{sessionEarned}</div>
        </div>
        <div className="bg-[#181818] p-5 rounded-2xl border border-white/10 flex flex-col items-center justify-center shadow-lg">
          <div className="text-white/50 text-xs mb-1 flex items-center gap-1.5 font-bold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 text-[#f5a623]" /> {t('work.streak')}
          </div>
          <div className="text-2xl font-light text-[#f5a623]">{streak}</div>
        </div>
        <div className="bg-[#181818] p-5 rounded-2xl border border-white/10 flex flex-col items-center justify-center col-span-2 sm:col-span-1 shadow-lg">
          <div className="text-white/50 text-xs mb-1 flex items-center gap-1.5 font-bold uppercase tracking-wider">
            <Trophy className="w-3.5 h-3.5 text-[#f5a623]" /> {t('work.totalEarned')}
          </div>
          <div className="text-2xl font-bold text-[#f5a623]">{sessionEarned} 🪙</div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 w-full">
        <AnimatePresence mode="wait">
          {!currentWord && !result && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-6"
            >
              {message && (
                <div className="max-w-md text-center text-xs font-semibold px-5 py-3 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  {message}
                </div>
              )}
              {cooldownLeft > 0 ? (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="text-white/60 flex items-center gap-2 text-base">
                    <Clock className="w-5 h-5 text-[#53b1ff] animate-pulse" />
                    <span>{t('work.resting')}: <strong className="text-white font-mono">{(cooldownLeft / 1000).toFixed(1)}s</strong></span>
                  </div>
                  <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-[#0070d1] rounded-full"
                      initial={{ width: '100%' }}
                      animate={{ width: `${(cooldownLeft / 3000) * 100}%` }}
                      transition={{ duration: 0.1, ease: 'linear' }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={requestWork}
                  className="ps-btn-primary !py-4 !px-12 !text-lg !font-bold cursor-pointer"
                >
                  <Sparkles className="w-5 h-5" />
                  {t('work.getWork')}
                </button>
              )}
            </motion.div>
          )}

          {currentWord && !result && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              onClick={() => inputRef.current?.focus()}
              className="w-full max-w-xl flex flex-col items-center gap-8 bg-[#181818] p-8 rounded-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] cursor-text relative overflow-hidden"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#0070d1]/15 border border-[#0070d1]/30 text-[#53b1ff]">
                {wordLang === 'en' ? '🇬🇧 English Typing' : '🇻🇳 Tiếng Việt'}
              </div>
              <AntiCopyWord word={currentWord} />
              
              <div className="w-full max-w-md h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                <motion.div 
                  className="h-full bg-[#0070d1]"
                  initial={{ width: '100%' }}
                  animate={{ width: `${(timeLeft / 15000) * 100}%` }}
                  transition={{ duration: 0.1, ease: 'linear' }}
                />
              </div>

              <div className="w-full max-w-md relative" onClick={(e) => { e.stopPropagation(); inputRef.current?.focus(); }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={typedText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onPaste={(e) => e.preventDefault()}
                  onDrop={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-full bg-[#121314] border border-white/15 focus:border-[#0070d1] focus:ring-2 focus:ring-[#0070d1]/30 rounded-full px-6 py-4 text-center text-3xl font-mono text-white outline-none shadow-inner"
                  placeholder={t('work.typeHere')}
                  autoComplete="off"
                  spellCheck="false"
                  autoFocus
                />
                
                {renderColoredText()}
              </div>
            </motion.div>
          )}

          {result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.4 }}
              className="flex flex-col items-center justify-center gap-4"
            >
              {result === 'success' ? (
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-3 shadow-[0_0_25px_rgba(16,185,129,0.4)]">
                    <Check className="w-10 h-10" />
                  </div>
                  <div className="text-2xl font-bold text-[#f5a623]">
                    {message}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mb-3 shadow-[0_0_25px_rgba(244,63,94,0.4)]">
                    <X className="w-10 h-10" />
                  </div>
                  <div className="text-xl font-bold text-rose-400">
                    {message}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Instructions Panel */}
      <div className="mt-auto p-4 w-full">
        <div className="bg-[#181818] rounded-2xl p-4 border border-white/10 text-white/50 text-xs text-center">
          <p className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0070d1] animate-pulse"></span>
            {t('work.howto')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WorkView;
