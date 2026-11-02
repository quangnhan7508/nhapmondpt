import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Sparkles, ShieldCheck, RefreshCw, ChevronRight, Layers } from 'lucide-react';
import { CaseDefinition, CaseItemTemplate, CaseSingleSpin, InventoryItem, ItemRarity } from '../../types/game';
import { useAuth } from '../../context/AuthContext';
import { useGameSocketContext } from '../../hooks/GameSocketContext';

export const RARITY_CONFIG: Record<ItemRarity, { label: string; text: string; bg: string; border: string; glow: string; hex: string }> = {
  white: {
    label: 'Hạng Trắng (Phổ Thông)',
    text: 'text-slate-300',
    bg: 'bg-slate-800/80',
    border: 'border-slate-600',
    glow: 'shadow-slate-500/20',
    hex: '#94a3b8'
  },
  blue: {
    label: 'Hạng Xanh (Hiếm)',
    text: 'text-blue-400',
    bg: 'bg-blue-950/80',
    border: 'border-blue-500',
    glow: 'shadow-blue-500/40',
    hex: '#3b82f6'
  },
  purple: {
    label: 'Hạng Tím (Cao Cấp)',
    text: 'text-purple-400',
    bg: 'bg-purple-950/80',
    border: 'border-purple-500',
    glow: 'shadow-purple-500/40',
    hex: '#a855f7'
  },
  red: {
    label: 'Hạng Đỏ (Thần Thoại)',
    text: 'text-rose-400',
    bg: 'bg-rose-950/80',
    border: 'border-rose-500',
    glow: 'shadow-rose-500/40',
    hex: '#f43f5e'
  },
  gold: {
    label: 'Hạng Vàng (Báu Vật Dao)',
    text: 'text-amber-300',
    bg: 'bg-amber-950/80',
    border: 'border-amber-400',
    glow: 'shadow-amber-400/50',
    hex: '#fbbf24'
  }
};

export const playCaseTickSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {}
};

export const playCaseWinSound = (rarity: ItemRarity) => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const freqs = rarity === 'gold' ? [523, 659, 784, 1046] : rarity === 'red' ? [440, 554, 659, 880] : [330, 392, 523];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  } catch (e) {}
};

const SPIN_OPTIONS = [1, 3, 5, 10] as const;

export const CaseOpeningView: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { socket } = useGameSocketContext();

  const [cases, setCases] = useState<CaseDefinition[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseDefinition | null>(null);
  const [spinCount, setSpinCount] = useState<number>(1);
  const [isOpening, setIsOpening] = useState(false);
  const [tape, setTape] = useState<CaseItemTemplate[]>([]);
  const [wonItem, setWonItem] = useState<InventoryItem | null>(null);
  const [multiSpins, setMultiSpins] = useState<CaseSingleSpin[]>([]);
  const [multiSummary, setMultiSummary] = useState<{ totalSpent: number; totalWonValue: number } | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tapeContainerRef = useRef<HTMLDivElement>(null);
  const multiTapeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ITEM_WIDTH = 140; // width of item card in tape

  // Load cases from server
  useEffect(() => {
    fetch('/api/cases')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.cases?.length > 0) {
          setCases(data.cases);
          setSelectedCase(data.cases[0]);
        }
      })
      .catch(() => {});
  }, []);

  const animateTapeEl = (el: HTMLDivElement | null, winningIdx: number, doneDelayMs: number, onDone: () => void) => {
    if (!el) {
      onDone();
      return;
    }
    el.style.transition = 'none';
    el.style.transform = 'translateX(0px)';
    // force reflow
    void el.offsetWidth;
    setTimeout(() => {
      if (!el) {
        onDone();
        return;
      }
      const jitter = (Math.random() - 0.5) * 60;
      const viewportW = el.parentElement?.clientWidth || 700;
      const targetOffset = -(winningIdx * (ITEM_WIDTH + 12) - viewportW / 2 + ITEM_WIDTH / 2) + jitter;
      el.style.transition = 'transform 5.5s cubic-bezier(0.12, 0.8, 0.2, 1)';
      el.style.transform = `translateX(${targetOffset}px)`;
      let tickCount = 0;
      const tickInterval = setInterval(() => {
        tickCount++;
        if (tickCount < 45) {
          playCaseTickSound();
        } else {
          clearInterval(tickInterval);
        }
      }, 110);
      setTimeout(() => {
        clearInterval(tickInterval);
        onDone();
      }, doneDelayMs);
    }, 80);
  };


  const handleOpenCase = () => {
    if (!user) {
      setErrorMsg('Vui lòng đăng nhập để mở hòm.');
      return;
    }
    if (!selectedCase) {
      return;
    }
    const totalCost = selectedCase.price * spinCount;
    if (user.balance < totalCost) {
      setErrorMsg(`Không đủ tiền! Bạn có ${user.balance.toLocaleString('vi-VN')} 🪙, cần ${totalCost.toLocaleString('vi-VN')} 🪙 cho ${spinCount} lượt.`);
      return;
    }
    if (!socket) {
      setErrorMsg('Mất kết nối máy chủ, thử lại sau giây lát.');
      return;
    }

    setErrorMsg(null);
    setIsOpening(true);
    setWonItem(null);
    setMultiSpins([]);
    setMultiSummary(null);
    setShowResultModal(false);
    setShowMultiModal(false);

    if (spinCount === 1) {
      socket.emit('cases:open', { userId: user.id, caseId: selectedCase.id }, (res: any) => {
        if (!res.success) {
              setErrorMsg(res.message || 'Mở hòm thất bại');
          setIsOpening(false);
          return;
        }

        const generatedTape: CaseItemTemplate[] = res.tape || [];
        const winningIdx = res.winningIndex ?? 30;
        setTape(generatedTape);
        setWonItem(res.wonItem);

        setTimeout(() => {
          animateTapeEl(tapeContainerRef.current, winningIdx, 5800, () => {
            setIsOpening(false);
            playCaseWinSound(res.wonItem?.rarity || 'white');
            refreshUser();
            setShowResultModal(true);
          });
        }, 60);
      });
    } else {
      socket.emit('cases:open-multi', { userId: user.id, caseId: selectedCase.id, count: spinCount }, (res: any) => {
        if (!res.success) {
              setErrorMsg(res.message || 'Mở hòm thất bại');
          setIsOpening(false);
          return;
        }
        const spins: CaseSingleSpin[] = res.spins || [];
        setMultiSpins(spins);
        setMultiSummary({ totalSpent: res.totalSpent || 0, totalWonValue: res.totalWonValue || 0 });
        setTape([]);

        setTimeout(() => {
          let finished = 0;
          const total = spins.length;
          if (total === 0) {
            setIsOpening(false);
            return;
          }
          spins.forEach((spin, idx) => {
            animateTapeEl(multiTapeRefs.current[idx] || null, spin.winningIndex ?? 30, 5800, () => {
              finished++;
              if (finished === total) {
                setIsOpening(false);
                const best: ItemRarity = spins.some(s => s.wonItem.rarity === 'gold')
                  ? 'gold'
                  : spins.some(s => s.wonItem.rarity === 'red')
                    ? 'red'
                    : 'purple';
                playCaseWinSound(best);
                refreshUser();
                setShowMultiModal(true);
              }
            });
          });
        }, 60);
      });
    }
  };

  const handleQuickSell = (itemInstanceId: string) => {
    if (!socket || !user) return;
    socket.emit('inventory:sell', { userId: user.id, itemId: itemInstanceId }, (res: any) => {
      if (res.success) {
        setShowResultModal(false);
        refreshUser();
      }
    });
  };

  const handleSellAllMulti = () => {
    if (!socket || !user || multiSpins.length === 0) return;
    const ids = multiSpins.map(s => s.wonItem.id);
    let idx = 0;
    const sellNext = () => {
      if (idx >= ids.length) {
        setShowMultiModal(false);
        refreshUser();
        return;
      }
      socket.emit('inventory:sell', { userId: user.id, itemId: ids[idx] }, () => {
        idx++;
        sellNext();
      });
    };
    sellNext();
  };

  const renderTapeCards = (cards: CaseItemTemplate[]) => cards.map((item, idx) => {
    const cfg = RARITY_CONFIG[item.rarity];
    return (
      <div
        key={idx}
        style={{ width: `${ITEM_WIDTH}px` }}
        className={`h-36 rounded-2xl border ${cfg.border} ${cfg.bg} flex flex-col items-center justify-between p-3 flex-shrink-0 shadow-lg relative overflow-hidden`}
      >
        <div className="text-[10px] uppercase font-black tracking-wider text-gray-400 self-start">
          {item.weaponType}
        </div>
        <div className="text-4xl my-auto transition-transform hover:scale-110 drop-shadow-md">
          {item.icon}
        </div>
        <div className="w-full text-center">
          <div className={`text-xs font-black truncate ${cfg.text}`}>{item.name}</div>
          <div className="text-[11px] font-bold text-yellow-400 mt-0.5">{item.value.toLocaleString('vi-VN')} 🪙</div>
        </div>
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ backgroundColor: cfg.hex }}
        />
      </div>
    );
  });

  const renderSingleTape = () => (
    <div className="overflow-hidden w-full py-4 border-y border-gray-800/80 bg-gray-950/60 rounded-2xl relative">
      <div
        ref={tapeContainerRef}
        className="flex items-center gap-3 px-4 will-change-transform"
        style={{ width: 'max-content' }}
      >
        {renderTapeCards(tape.length > 0 ? tape : selectedCase!.items.concat(selectedCase!.items))}
      </div>
    </div>
  );

  const renderMultiTapes = () => (
    <div className="flex flex-col gap-4 w-full">
      {multiSpins.length > 0 ? multiSpins.map((spin, spinIdx) => (
        <div key={spinIdx} className="overflow-hidden w-full py-3 border-y border-gray-800/80 bg-gray-950/60 rounded-2xl relative">
          <div className="absolute top-1 left-3 z-10 text-[11px] font-black text-amber-300 bg-black/60 px-2 py-0.5 rounded-full border border-amber-500/40">
            Vòng {spinIdx + 1}
          </div>
          <div
            ref={(el) => { multiTapeRefs.current[spinIdx] = el; }}
            className="flex items-center gap-3 px-4 will-change-transform"
            style={{ width: 'max-content' }}
          >
            {renderTapeCards(spin.tape)}
          </div>
        </div>
      )) : (
        <div className="text-center text-xs text-gray-500 py-6 border border-dashed border-gray-800 rounded-2xl">
          Bấm Mở {spinCount} Hòm để quay {spinCount} băng thưởng cùng lúc
        </div>
      )}
    </div>
  );

  const totalCost = selectedCase ? selectedCase.price * spinCount : 0;

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 pb-12">
      {/* 6 Case Selector Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cases.map((c) => {
          const isSelected = selectedCase?.id === c.id;
          return (
            <button
              key={c.id}
              disabled={isOpening}
              onClick={() => {
                setSelectedCase(c);
                setErrorMsg(null);
                setTape([]);
                setMultiSpins([]);
                setShowResultModal(false);
                setShowMultiModal(false);
              }}
              className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-b from-[#1b2234] to-[#121620] border-ps-blue shadow-ps-glow scale-[1.01]'
                  : 'bg-[#181818] border-white/10 hover:border-white/25 hover:bg-[#202020]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl drop-shadow-md">{c.icon}</span>
                <span className="px-3 py-1 rounded-full bg-ps-blue/15 border border-ps-blue/30 text-ps-cyan text-xs font-semibold tracking-wide">
                  {c.badge}
                </span>
              </div>
              <h3 className="font-semibold text-lg text-white mb-1 tracking-tight">{c.name}</h3>
              <p className="text-xs text-white/60 leading-relaxed mb-4">{c.description}</p>
              <div className="flex items-center justify-between text-xs pt-3 border-t border-white/10">
                <span className="text-white/50 font-medium">{c.items.length} Skins Bên Trong</span>
                <span className="text-ps-cyan font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Chọn hòm <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Case Opening Arena */}
      {selectedCase && (
        <div className="bg-[#121314] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center relative overflow-hidden">
          {/* Roulette Tape Strip */}
          <div className="w-full relative py-6">
            {/* Center Pointer Line with PlayStation Cyan Halo */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-ps-cyan z-30 shadow-[0_0_16px_#00f0ff] pointer-events-none flex flex-col justify-between items-center">
              <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-ps-cyan -mt-1 drop-shadow-[0_0_6px_#00f0ff]" />
              <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[12px] border-b-ps-cyan -mb-1 drop-shadow-[0_0_6px_#00f0ff]" />
            </div>

            {spinCount === 1 ? renderSingleTape() : renderMultiTapes()}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-center font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Spin count + Action Button */}
          <div className="mt-4 flex flex-col items-center gap-4 w-full">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Số lượt quay:</span>
              <div className="flex items-center gap-1.5 bg-[#181818] p-1 rounded-full border border-white/10">
                {SPIN_OPTIONS.map((n) => (
                  <button
                    key={n}
                    disabled={isOpening}
                    onClick={() => {
                      setSpinCount(n);
                      setTape([]);
                      setMultiSpins([]);
                      setShowMultiModal(false);
                    }}
                    className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer ${
                      spinCount === n
                        ? 'bg-ps-blue text-white shadow-ps-glow'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    x{n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <button
                disabled={isOpening}
                onClick={handleOpenCase}
                className={`px-10 py-3.5 rounded-full font-semibold text-base transition-all flex items-center gap-3 cursor-pointer ${
                  isOpening
                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                    : 'bg-ps-blue hover:bg-ps-blue-hover text-white shadow-ps-glow active:scale-95'
                }`}
              >
                {isOpening ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin text-ps-cyan" /> Đang Quay {spinCount > 1 ? `${spinCount} Vòng` : 'Thưởng'}...
                  </>
                ) : (
                  <>
                    <Package className="w-5 h-5" /> Mở {spinCount > 1 ? `${spinCount} Hòm` : 'Hòm'} ({totalCost.toLocaleString('vi-VN')} 🪙)
                  </>
                )}
              </button>
            </div>
            <div className="text-xs text-white/50 flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Vật phẩm tự động lưu vào Kho Đồ và có thể bán lại bất kỳ lúc nào.
            </div>
          </div>

          {/* List of items in this case */}
          <div className="w-full mt-10">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h4 className="font-semibold text-sm text-white/90 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-ps-cyan" /> Vật Phẩm Trong Hòm ({selectedCase.items.length})
              </h4>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-white/50">
                <span>Trắng: 54%</span> •
                <span className="text-blue-400">Xanh: 28%</span> •
                <span className="text-purple-400">Tím: 12%</span> •
                <span className="text-rose-400">Đỏ: 5%</span> •
                <span className="text-amber-400">Vàng: 1%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {selectedCase.items.map((item) => {
                const cfg = RARITY_CONFIG[item.rarity];
                return (
                  <div
                    key={item.itemId}
                    className={`p-3 rounded-2xl border ${cfg.border}/40 ${cfg.bg} flex flex-col items-center justify-between text-center gap-2 relative overflow-hidden hover:scale-[1.02] transition-transform`}
                  >
                    <div className="text-3xl my-1 drop-shadow-sm">{item.icon}</div>
                    <div>
                      <div className={`text-xs font-semibold truncate max-w-full ${cfg.text}`}>{item.name}</div>
                      <div className="text-[10px] text-white/50 font-medium">{item.weaponType}</div>
                      <div className="text-[11px] font-bold text-amber-300 mt-1">{item.value.toLocaleString('vi-VN')} 🪙</div>
                    </div>
                    <div className="absolute top-1 right-2 text-[9px] uppercase font-bold text-white/40">{item.rarity}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Won Item Celebration Modal (single) */}
      <AnimatePresence>
        {showResultModal && wonItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`max-w-md w-full rounded-3xl border p-7 flex flex-col items-center text-center shadow-2xl relative overflow-hidden bg-[#141517] ${RARITY_CONFIG[wonItem.rarity].border} ${RARITY_CONFIG[wonItem.rarity].glow}`}
            >
              <div className="text-xs font-bold uppercase tracking-widest text-ps-cyan mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> THƯỞNG PLAYSTATION MỞ HÒM
              </div>

              <div className="text-6xl my-4 drop-shadow-[0_0_24px_rgba(0,112,209,0.5)]">
                {wonItem.icon}
              </div>

              <h2 className={`text-2xl font-semibold mb-1 ${RARITY_CONFIG[wonItem.rarity].text}`}>
                {wonItem.name}
              </h2>
              <div className="text-xs text-white/60 font-medium mb-4">
                {RARITY_CONFIG[wonItem.rarity].label}
              </div>

              <div className="bg-[#181818] border border-white/10 rounded-2xl px-5 py-3 mb-6 w-full flex items-center justify-between">
                <span className="text-xs text-white/50 font-medium">Giá trị quy đổi:</span>
                <span className="text-lg font-bold text-amber-300 flex items-center gap-1">
                  +{wonItem.value.toLocaleString('vi-VN')} 🪙
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={() => setShowResultModal(false)}
                  className="flex-1 py-3 px-5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  Giữ Trong Kho
                </button>
                <button
                  onClick={() => handleQuickSell(wonItem.id)}
                  className="flex-1 py-3 px-5 rounded-full bg-ps-blue hover:bg-ps-blue-hover text-white font-semibold text-xs transition-all shadow-ps-glow cursor-pointer flex items-center justify-center gap-1"
                >
                  Bán Ngay (+{wonItem.value.toLocaleString('vi-VN')} 🪙)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Multi-spin result modal */}
      <AnimatePresence>
        {showMultiModal && multiSpins.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-3xl border border-ps-blue/40 bg-[#141517] p-7 shadow-2xl"
            >
              <div className="text-xs font-bold uppercase tracking-widest text-ps-cyan mb-2 flex items-center gap-1.5 justify-center">
                <Sparkles className="w-4 h-4" /> KẾT QUẢ {multiSpins.length} VÒNG QUAY!
              </div>
              {multiSummary && (
                <div className="flex items-center justify-center gap-4 text-xs font-semibold mb-4">
                  <span className="text-white/50">Đã chi: <span className="text-rose-400">-{multiSummary.totalSpent.toLocaleString('vi-VN')} 🪙</span></span>
                  <span className="text-white/50">Tổng trúng: <span className="text-emerald-400">+{multiSummary.totalWonValue.toLocaleString('vi-VN')} 🪙</span></span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
                {multiSpins.map((spin, idx) => {
                  const cfg = RARITY_CONFIG[spin.wonItem.rarity];
                  return (
                    <div key={idx} className={`p-3 rounded-2xl border ${cfg.border}/40 ${cfg.bg} flex flex-col items-center text-center gap-1`}>
                      <div className="text-[10px] font-bold text-ps-cyan">Vòng {idx + 1}</div>
                      <div className="text-3xl drop-shadow-sm">{spin.wonItem.icon}</div>
                      <div className={`text-[11px] font-semibold truncate max-w-full ${cfg.text}`}>{spin.wonItem.name}</div>
                      <div className="text-[11px] font-bold text-amber-300">{spin.wonItem.value.toLocaleString('vi-VN')} 🪙</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={() => setShowMultiModal(false)}
                  className="flex-1 py-3 px-5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  Giữ Tất Cả Trong Kho
                </button>
                <button
                  onClick={handleSellAllMulti}
                  className="flex-1 py-3 px-5 rounded-full bg-ps-blue hover:bg-ps-blue-hover text-white font-semibold text-xs transition-all shadow-ps-glow cursor-pointer"
                >
                  Bán Tất Cả (+{(multiSummary?.totalWonValue || 0).toLocaleString('vi-VN')} 🪙)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CaseOpeningView;
