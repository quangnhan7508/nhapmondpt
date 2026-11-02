import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Coins, RefreshCw, AlertCircle, Sliders, Sparkles } from 'lucide-react';
import { InventoryItem, UpgradeResult } from '../../types/game';
import { useAuth } from '../../context/AuthContext';
import { useGameSocketContext } from '../../hooks/GameSocketContext';
import { playCaseTickSound, playCaseWinSound } from '../cases/CaseOpeningView';

export const UpgradeView: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { socket } = useGameSocketContext();
  const [searchParams] = useSearchParams();

  // Mode: bet by coins or by inventory item
  const [betMode, setBetMode] = useState<'coins' | 'item'>('coins');
  const [coinBetAmount, setCoinBetAmount] = useState<number>(50);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Target values
  const [targetMultiplier, setTargetMultiplier] = useState<number>(2.0);
  const [targetValue, setTargetValue] = useState<number>(100);
  const [rollDirection, setRollDirection] = useState<'under' | 'over'>('under');

  // Game state
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [lastResult, setLastResult] = useState<UpgradeResult | null>(null);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load inventory
  const loadInventory = () => {
    if (!user) return;
    fetch('/api/inventory', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('omnideck_token') || sessionStorage.getItem('omnideck_token') || ''}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.inventory)) {
          setInventory(data.inventory);
          // Auto select if query param itemId exists
          const preselectedId = searchParams.get('itemId');
          if (preselectedId) {
            const found = data.inventory.find((it: InventoryItem) => it.id === preselectedId);
            if (found) {
              setSelectedItem(found);
              setBetMode('item');
            }
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadInventory();
  }, [user, searchParams]);

  // Current effective bet amount
  const effectiveBet = betMode === 'item' ? (selectedItem?.value || 0) : coinBetAmount;

  // Sync target value when effectiveBet or multiplier changes
  useEffect(() => {
    if (effectiveBet > 0) {
      setTargetValue(Math.max(effectiveBet + 1, Math.round(effectiveBet * targetMultiplier)));
    }
  }, [effectiveBet, targetMultiplier]);

  // Win chance calculation: RTP 95%, clamped between 1% and 85%
  const calculateChance = (bet: number, target: number) => {
    if (bet <= 0 || target <= bet) return 0;
    const raw = (bet / target) * 95;
    return Math.max(1, Math.min(85, Math.round(raw * 100) / 100));
  };

  const winChance = calculateChance(effectiveBet, targetValue);

  // Quick Multipliers
  const MULTIPLIERS = [1.5, 2.0, 3.0, 5.0, 10.0, 20.0, 50.0];

  const handlePlayUpgrade = () => {
    if (!user) {
      setErrorMsg('Vui lòng đăng nhập để chơi Nâng Cấp.');
      return;
    }
    if (betMode === 'item' && !selectedItem) {
      setErrorMsg('Vui lòng chọn 1 vật phẩm từ kho đồ để cược.');
      return;
    }
    if (betMode === 'coins' && user.balance < coinBetAmount) {
      setErrorMsg(`Không đủ số dư: Cần ${coinBetAmount.toLocaleString('vi-VN')} 🪙, bạn có ${user.balance.toLocaleString('vi-VN')} 🪙.`);
      return;
    }
    if (targetValue <= effectiveBet) {
      setErrorMsg('Giá trị mục tiêu phải lớn hơn số tiền cược.');
      return;
    }

    setErrorMsg(null);
    setIsUpgrading(true);
    setIsResetting(false);
    setWheelRotation(0);
    setLastResult(null);

    if (socket) {
      socket.emit('upgrade:play', {
        userId: user.id,
        betType: betMode,
        betAmount: betMode === 'coins' ? coinBetAmount : undefined,
        itemInstanceId: betMode === 'item' ? selectedItem?.id : undefined,
        targetValue,
        rollDirection
      }, (res: UpgradeResult) => {
        if (!res.success) {
          setErrorMsg(res.message || 'Lỗi khi nâng cấp.');
          setIsUpgrading(false);
          setIsResetting(false);
          setWheelRotation(0);
          return;
        }

        // Animate the wheel: rotate several full spins plus the roll degree
        const fullSpins = 5 * 360;
        const targetDeg = fullSpins + (res.rollDegree ?? 0);
        setWheelRotation(targetDeg);

        // Play rolling tick sounds
        let ticks = 0;
        const tickTimer = setInterval(() => {
          ticks++;
          if (ticks < 35) {
            playCaseTickSound();
          } else {
            clearInterval(tickTimer);
          }
        }, 110);

        setTimeout(() => {
          clearInterval(tickTimer);
          setLastResult(res);
          if (res.isWin) {
            playCaseWinSound('gold');
          }
          if (betMode === 'item') {
            setSelectedItem(null);
            loadInventory();
          }
          refreshUser();

          // Chờ hết một lượt quay và người chơi xem kết quả 1.2s, sau đó reset về vị trí ban đầu (0 độ)
          setTimeout(() => {
            setIsResetting(true);
            setWheelRotation(0);
            setTimeout(() => {
              setIsResetting(false);
              setIsUpgrading(false); // Hoàn tất lượt quay, sẵn sàng cho lượt tiếp theo
            }, 400);
          }, 1200);
        }, 4200);
      });
    }
  };

  // SVG wheel geometry
  const size = 280;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const winningDash = (winChance / 100) * circumference;
  const losingDash = circumference - winningDash;
  // Rotation offset for "over" vs "under"
  const strokeDashoffset = rollDirection === 'under' ? 0 : -((100 - winChance) / 100) * circumference;

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 pb-12">

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-950/80 border border-red-500/50 text-red-300 text-sm font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400" /> {errorMsg}
        </div>
      )}

      {/* Main 3-Column Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Your Bet (4 cols) */}
        <div className="lg:col-span-4 bg-[#141517] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="font-semibold text-sm text-white/90 uppercase tracking-wider flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-300" /> 1. Cược Của Bạn
            </h3>
            <span className="text-xs font-bold text-amber-300">{effectiveBet.toLocaleString('vi-VN')} 🪙</span>
          </div>

          {/* Bet Mode Selector */}
          <div className="grid grid-cols-2 gap-1.5 bg-[#181818] p-1 rounded-full border border-white/10">
            <button
              onClick={() => setBetMode('coins')}
              className={`py-2 px-3 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                betMode === 'coins' ? 'bg-ps-blue text-white shadow-ps-glow' : 'text-white/60 hover:text-white'
              }`}
            >
              Tiền Coins 🪙
            </button>
            <button
              onClick={() => setBetMode('item')}
              className={`py-2 px-3 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                betMode === 'item' ? 'bg-ps-blue text-white shadow-ps-glow' : 'text-white/60 hover:text-white'
              }`}
            >
              Item Trong Kho ({inventory.length})
            </button>
          </div>

          {betMode === 'coins' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-2">Số tiền cược (🪙):</label>
                <input
                  type="number"
                  min={10}
                  value={coinBetAmount}
                  onChange={(e) => setCoinBetAmount(Math.max(10, Number(e.target.value)))}
                  className="w-full bg-[#181818] border border-white/15 rounded-2xl px-4 py-3 text-lg font-bold text-amber-300 focus:outline-none focus:border-ps-blue transition-colors"
                />
              </div>

              {/* Quick Chip Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {[10, 50, 100, 250, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setCoinBetAmount(amt)}
                    className={`py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                      coinBetAmount === amt
                        ? 'bg-ps-blue/20 border-ps-blue text-ps-cyan shadow-ps-glow'
                        : 'bg-[#1e2024] border-white/10 text-white/70 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    +{amt} 🪙
                  </button>
                ))}
              </div>

              {/* ALL IN: cược toàn bộ số dư */}
              <button
                onClick={() => user && setCoinBetAmount(Math.max(10, Math.floor(user.balance)))}
                disabled={!user || user.balance < 10}
                className="w-full py-3 rounded-full font-semibold text-xs uppercase tracking-wider bg-ps-commerce hover:bg-ps-commerce-hover text-white shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                🔥 ALL IN ({(user ? Math.max(0, Math.floor(user.balance)) : 0).toLocaleString('vi-VN')} 🪙)
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-white/60">Chọn vật phẩm để cược:</label>
              {inventory.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-white/10 text-center text-xs text-white/40">
                  Kho đồ chưa có item nào. Hãy qua Mở Hòm CS2 để lấy item!
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {inventory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                        selectedItem?.id === item.id
                          ? 'bg-ps-blue/15 border-ps-blue shadow-ps-glow'
                          : 'bg-[#181818] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl drop-shadow-sm">{item.icon}</span>
                        <div className="text-left">
                          <div className="text-xs font-semibold text-white truncate max-w-[150px]">{item.name}</div>
                          <div className="text-[10px] text-white/50 capitalize">{item.rarity}</div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-amber-300 whitespace-nowrap">
                        {item.value.toLocaleString('vi-VN')} 🪙
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center Column: Circular Upgrade Wheel (4 cols) */}
        <div className="lg:col-span-4 bg-[#141517] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col items-center justify-center gap-6 relative overflow-hidden">
          {/* Wheel Graphic */}
          <div className="relative flex items-center justify-center">
            {/* Top Indicator Arrow */}
            <div className="absolute top-0 z-30 flex flex-col items-center pointer-events-none">
              <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[16px] border-t-ps-cyan shadow-[0_0_12px_#00f0ff]" />
            </div>

            {/* SVG Wheel */}
            <div className="relative w-[280px] h-[280px] flex items-center justify-center">
              <svg
                width={size}
                height={size}
                className="transform -rotate-90"
              >
                {/* Background Full Track (PlayStation Navy Slate) */}
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#1c202a"
                  strokeWidth={strokeWidth}
                />
                {/* Winning Sector (PlayStation Cyan Halo) */}
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#00f0ff"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${winningDash} ${losingDash}`}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-300 drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]"
                />
              </svg>

              {/* Rotating Needle / Arrow Disk */}
              <div
                className="absolute inset-0 flex items-center justify-center will-change-transform"
                style={{
                  transform: `rotate(${wheelRotation}deg)`,
                  transition: isResetting
                    ? 'transform 0.4s ease-in-out'
                    : isUpgrading
                      ? 'transform 4.2s cubic-bezier(0.12, 0.8, 0.2, 1)'
                      : 'none'
                }}
              >
                <div className="w-1.5 h-24 bg-gradient-to-t from-transparent via-ps-cyan to-white rounded-full shadow-[0_0_10px_#00f0ff] -translate-y-12" />
              </div>

              {/* Center Display Badge */}
              <div className="absolute w-36 h-36 rounded-full bg-[#101114] border-2 border-ps-blue/40 flex flex-col items-center justify-center shadow-inner z-20 text-center p-2">
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Tỉ Lệ Trúng</span>
                <span className="text-3xl font-bold text-ps-cyan tracking-tight">
                  {winChance}%
                </span>
                <span className="text-xs font-semibold text-amber-300 mt-1">
                  x{targetMultiplier.toFixed(2)} Lần
                </span>
              </div>
            </div>
          </div>

          {/* Roll Direction Switcher */}
          <div className="flex items-center gap-1.5 bg-[#181818] p-1 rounded-full border border-white/10 text-xs font-semibold">
            <span className="text-white/40 text-[11px] px-2">Vùng Trúng:</span>
            <button
              onClick={() => setRollDirection('under')}
              className={`py-1.5 px-3 rounded-full transition-all cursor-pointer ${
                rollDirection === 'under' ? 'bg-ps-blue text-white shadow-ps-glow' : 'text-white/60 hover:text-white'
              }`}
            >
              Roll Dưới (0 - {winChance}%)
            </button>
            <button
              onClick={() => setRollDirection('over')}
              className={`py-1.5 px-3 rounded-full transition-all cursor-pointer ${
                rollDirection === 'over' ? 'bg-ps-blue text-white shadow-ps-glow' : 'text-white/60 hover:text-white'
              }`}
            >
              Roll Trên ({Math.round((100 - winChance) * 100) / 100}% - 100%)
            </button>
          </div>

          {/* Upgrade Action Button */}
          <button
            disabled={isUpgrading || isResetting || effectiveBet <= 0}
            onClick={handlePlayUpgrade}
            className={`w-full py-3.5 px-6 rounded-full font-semibold text-base transition-all flex items-center justify-center gap-3 cursor-pointer ${
              isUpgrading || isResetting || effectiveBet <= 0
                ? 'bg-white/10 text-white/40 cursor-not-allowed'
                : 'bg-ps-blue hover:bg-ps-blue-hover text-white shadow-ps-glow active:scale-95'
            }`}
          >
            {isUpgrading || isResetting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-ps-cyan" /> {isResetting ? 'Đang Đặt Lại...' : 'Đang Nâng Cấp...'}
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" /> Nâng Cấp Ngay ({effectiveBet.toLocaleString('vi-VN')} 🪙)
              </>
            )}
          </button>
        </div>

        {/* Right Column: Target Reward & Slider (4 cols) */}
        <div className="lg:col-span-4 bg-[#141517] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="font-semibold text-sm text-white/90 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-ps-cyan" /> 2. Tiền Thưởng Mục Tiêu
            </h3>
            <span className="text-xs font-bold text-ps-cyan">+{targetValue.toLocaleString('vi-VN')} 🪙</span>
          </div>

          {/* Number Input */}
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-2">Số tiền muốn nhận (🪙):</label>
            <input
              type="number"
              min={effectiveBet + 1}
              value={targetValue}
              onChange={(e) => {
                const val = Math.max(effectiveBet + 1, Number(e.target.value));
                setTargetValue(val);
                if (effectiveBet > 0) {
                  setTargetMultiplier(Math.round((val / effectiveBet) * 100) / 100);
                }
              }}
              className="w-full bg-[#181818] border border-white/15 rounded-2xl px-4 py-3 text-lg font-bold text-ps-cyan focus:outline-none focus:border-ps-blue transition-colors"
            />
          </div>

          {/* Multiplier Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-white/60 mb-2">
              <span className="flex items-center gap-1"><Sliders className="w-3.5 h-3.5" /> Hệ số nhân:</span>
              <span className="text-ps-cyan font-bold text-sm">{targetMultiplier.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={1.1}
              max={50}
              step={0.1}
              value={targetMultiplier}
              onChange={(e) => setTargetMultiplier(Number(e.target.value))}
              className="w-full accent-ps-cyan h-2 bg-[#181818] rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-white/40 font-medium mt-1">
              <span>1.1x</span>
              <span>10x</span>
              <span>25x</span>
              <span>50x</span>
            </div>
          </div>

          {/* Quick Multiplier Buttons */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-white/60 block">Chọn nhanh hệ số:</span>
            <div className="grid grid-cols-4 gap-2">
              {MULTIPLIERS.map((m) => (
                <button
                  key={m}
                  onClick={() => setTargetMultiplier(m)}
                  className={`py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                    Math.abs(targetMultiplier - m) < 0.05
                      ? 'bg-ps-blue border-ps-blue text-white shadow-ps-glow'
                      : 'bg-[#1e2024] border-white/10 text-white/70 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {m}x
                </button>
              ))}
            </div>
          </div>

          {/* Summary Box */}
          <div className="bg-[#181818] border border-white/10 rounded-2xl p-4 space-y-2 text-xs">
            <div className="flex justify-between text-white/60">
              <span>Tiền cược:</span>
              <span className="font-semibold text-white">{effectiveBet.toLocaleString('vi-VN')} 🪙</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Lợi nhuận ròng nếu thắng:</span>
              <span className="font-bold text-emerald-400">+{(targetValue - effectiveBet).toLocaleString('vi-VN')} 🪙</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Tỉ lệ trúng toán học:</span>
              <span className="font-bold text-amber-300">{winChance}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Result Announcement Toast / Box */}
      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`p-6 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl bg-[#141517] ${
              lastResult.isWin
                ? 'border-emerald-500/50 shadow-emerald-500/20'
                : 'border-rose-500/50 shadow-rose-500/20'
            }`}
          >
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="text-4xl drop-shadow-md">{lastResult.isWin ? '🏆' : '💔'}</div>
              <div>
                <h3 className={`text-lg font-semibold tracking-tight ${lastResult.isWin ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {lastResult.isWin ? 'NÂNG CẤP THÀNH CÔNG!' : 'NÂNG CẤP KHÔNG THÀNH CÔNG'}
                </h3>
                <p className="text-xs text-white/70 mt-1">
                  Kết quả quay: <strong className="text-white">{lastResult.rollNumber}%</strong> (Cần &lt; {lastResult.winChance}% để thắng).
                  {lastResult.isWin && ` Bạn đã nhận được +${lastResult.targetValue?.toLocaleString('vi-VN')} 🪙!`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setLastResult(null)}
                className="py-2.5 px-6 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Tiếp Tục
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UpgradeView;
