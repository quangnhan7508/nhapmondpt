import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, X, CheckCircle, AlertCircle, Sparkles, Copy, Coins, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { sounds } from '../../utils/sound';
import { useGameSocketContext } from '../../hooks/GameSocketContext';

interface GiftcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth?: () => void;
}

const FEATURED_CODE = 'DINHVANTRINH';
const FEATURED_REWARD = 100000;

export const GiftcodeModal: React.FC<GiftcodeModalProps> = ({ isOpen, onClose, onOpenAuth }) => {
  const { user, token } = useAuth();
  const { socket } = useGameSocketContext();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ message: string; reward: number } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleApplyPreset = (presetCode: string) => {
    setCode(presetCode);
    setError(null);
  };

  const handleCopyPreset = (presetCode: string) => {
    navigator.clipboard?.writeText(presetCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    const clean = code.trim().toUpperCase();
    if (!clean) {
      setError('Vui lòng nhập mã giftcode.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessInfo(null);

    // Try socket first if available, otherwise fallback to REST API
    if (socket && socket.connected) {
      socket.emit('giftcode:redeem', { userId: user.id, code: clean }, (res: any) => {
        setLoading(false);
        if (res && res.success) {
          sounds.playCoinCollect();
          setSuccessInfo({
            message: res.message || `Kích hoạt thành công giftcode ${clean}!`,
            reward: res.reward || 0
          });
          setCode('');
        } else {
          setError(res?.message || 'Không thể kích hoạt giftcode.');
        }
      });
      return;
    }

    // REST fallback
    try {
      const res = await fetch('/api/giftcode/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: clean })
      });
      const data = await res.json();
      setLoading(false);
      if (data.success) {
        sounds.playCoinCollect();
        setSuccessInfo({
          message: data.message || `Kích hoạt thành công giftcode ${clean}!`,
          reward: data.reward || 0
        });
        setCode('');
      } else {
        setError(data.message || 'Mã giftcode không hợp lệ hoặc đã hết hạn.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Lỗi mạng khi kích hoạt giftcode.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-[#181818] border border-[#f5a623]/40 rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.8)] text-white overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Subtle background glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#f5a623]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#0070d1]/15 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Header */}
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ffce21] via-[#f5a623] to-[#ee8e00] flex items-center justify-center shadow-lg shadow-amber-500/30 flex-shrink-0">
              <Gift className="w-6 h-6 text-black" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f5a623]/15 text-[#f5a623] text-[10px] font-bold uppercase tracking-wider mb-1">
                <Sparkles className="w-3 h-3" /> PlayStation Special Rewards
              </div>
              <h2 className="text-xl font-light text-white tracking-tight">
                Nhập Giftcode
              </h2>
            </div>
          </div>

          {/* Featured Highlight: DINHVANTRINH */}
          <div className="mb-5 p-4 rounded-2xl bg-white/[0.04] border border-[#f5a623]/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#f5a623]" />
                <span className="text-xs font-bold uppercase text-[#f5a623] tracking-wider">
                  Mã Đặc Biệt Hôm Nay
                </span>
              </div>
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#ffce21] to-[#ee8e00] text-black">
                +{FEATURED_REWARD.toLocaleString('vi-VN')} 🪙
              </span>
            </div>
            <p className="text-xs text-white/70 mb-3">
              Mã thưởng độc quyền từ <strong className="text-white">Đinh Văn Trinh</strong> tặng ngay{' '}
              <strong className="text-[#f5a623]">{FEATURED_REWARD.toLocaleString('vi-VN')} coin</strong>!
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset(FEATURED_CODE)}
                className="flex-1 py-2 px-3 rounded-full bg-[#f5a623]/15 hover:bg-[#f5a623]/25 border border-[#f5a623]/40 text-xs font-mono font-bold text-[#f5a623] flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>{FEATURED_CODE}</span>
                <span className="text-[10px] text-white/50 font-sans font-normal">(Bấm để điền)</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopyPreset(FEATURED_CODE)}
                title="Sao chép mã"
                className="p-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-colors cursor-pointer"
              >
                {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-1.5">
                Mã Giftcode
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                placeholder="VD: DINHVANTRINH"
                className="w-full bg-[#121314] border border-white/15 focus:border-[#f5a623] rounded-full py-3 px-5 text-base font-bold tracking-wider text-[#f5a623] placeholder:text-white/30 placeholder:font-normal placeholder:tracking-normal focus:outline-none transition-all"
                maxLength={30}
                autoFocus
              />
            </div>

            {/* Quick Suggestions */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-white/40 text-[11px]">Gợi ý:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset('DINHVANTRINH')}
                className="text-[11px] font-bold text-[#f5a623] hover:underline bg-[#f5a623]/10 px-2.5 py-0.5 rounded-full border border-[#f5a623]/30 cursor-pointer"
              >
                DINHVANTRINH
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('TANTHU')}
                className="text-[11px] font-bold text-[#53b1ff] hover:underline bg-[#0070d1]/10 px-2.5 py-0.5 rounded-full border border-[#0070d1]/30 cursor-pointer"
              >
                TANTHU
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('OMNIDECK')}
                className="text-[11px] font-bold text-emerald-400 hover:underline bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30 cursor-pointer"
              >
                OMNIDECK
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Success Banner */}
            {successInfo && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs text-center space-y-2"
              >
                <div className="flex items-center justify-center gap-2 font-bold text-sm text-emerald-300">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span>Kích Hoạt Thành Công!</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 font-extrabold text-lg text-[#f5a623]">
                  <Coins className="w-5 h-5" />
                  <span>+{successInfo.reward.toLocaleString('vi-VN')} 🪙</span>
                </div>
                <p className="text-[11px] text-white/70">{successInfo.message}</p>
              </motion.div>
            )}

            {/* Action Button */}
            {!user ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenAuth) onOpenAuth();
                }}
                className="ps-btn-primary w-full !py-3.5 !rounded-full !text-sm cursor-pointer"
              >
                Đăng nhập để nhận Giftcode
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#ffce21] via-[#f5a623] to-[#ee8e00] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-black font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(245,166,35,0.4)] cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Đang kiểm tra...</span>
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4 text-black" />
                    <span>Đổi Thưởng Ngay</span>
                  </>
                )}
              </button>
            )}
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default GiftcodeModal;
