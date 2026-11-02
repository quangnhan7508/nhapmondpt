import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  X,
  History,
  Coins,
  CheckCircle,
  AlertCircle,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { sounds } from '../../utils/sound';
import { useGameSocketContext } from '../../hooks/GameSocketContext';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth?: () => void;
}

interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
}

interface TransactionItem {
  id: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  recipientId: string;
  recipientUsername: string;
  recipientDisplayName: string;
  amount: number;
  note?: string;
  timestamp: number;
}

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose, onOpenAuth }) => {
  const { user, token } = useAuth();
  const { socket } = useGameSocketContext();

  const [activeTab, setActiveTab] = useState<'transfer' | 'history'>('transfer');

  // Form states
  const [recipientInput, setRecipientInput] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<UserSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  const [note, setNote] = useState('');

  // Execution states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // History states
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Reset states on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      if (activeTab === 'history') {
        loadHistory();
      }
    }
  }, [isOpen, activeTab]);

  // Debounced search for players
  useEffect(() => {
    if (!recipientInput.trim() || selectedRecipient) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        if (socket && socket.connected) {
          socket.emit(
            'wallet:search-users',
            { query: recipientInput.trim(), excludeUserId: user?.id },
            (res: any) => {
              setSearching(false);
              if (res && res.success) {
                setSearchResults(res.users || []);
              }
            }
          );
          return;
        }

        const res = await fetch(`/api/wallet/search-users?q=${encodeURIComponent(recipientInput.trim())}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setSearching(false);
        if (data.success) {
          setSearchResults(data.users || []);
        }
      } catch {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [recipientInput, selectedRecipient, socket, token, user?.id]);

  const loadHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    if (socket && socket.connected) {
      socket.emit('wallet:history', { userId: user.id }, (res: any) => {
        setLoadingHistory(false);
        if (res && res.success) {
          setTransactions(res.transactions || []);
        }
      });
      return;
    }

    try {
      const res = await fetch('/api/wallet/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setLoadingHistory(false);
      if (data.success) {
        setTransactions(data.transactions || []);
      }
    } catch {
      setLoadingHistory(false);
    }
  };

  if (!isOpen) return null;

  const currentBalance = user?.balance || 0;
  const numAmount = typeof amount === 'number' ? amount : 0;

  const handleSelectUser = (u: UserSearchResult) => {
    setSelectedRecipient(u);
    setRecipientInput(u.displayName || u.username);
    setSearchResults([]);
  };

  const handleClearRecipient = () => {
    setSelectedRecipient(null);
    setRecipientInput('');
    setSearchResults([]);
  };

  const handleAddAmount = (add: number) => {
    const current = typeof amount === 'number' ? amount : 0;
    const next = Math.min(currentBalance, current + add);
    setAmount(next);
  };

  const handleSetMax = () => {
    setAmount(currentBalance);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    const targetQuery = selectedRecipient ? selectedRecipient.username : recipientInput.trim();
    if (!targetQuery) {
      setError('Vui lòng nhập người nhận.');
      return;
    }

    if (!numAmount || numAmount <= 0) {
      setError('Vui lòng nhập số tiền lớn hơn 0.');
      return;
    }

    if (numAmount > currentBalance) {
      setError(`Số dư không đủ. Bạn chỉ có ${currentBalance.toLocaleString('vi-VN')} 🪙.`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const payload = {
      senderId: user.id,
      recipient: targetQuery,
      amount: numAmount,
      note: note.trim()
    };

    if (socket && socket.connected) {
      socket.emit('wallet:transfer', payload, (res: any) => {
        setLoading(false);
        if (res && res.success) {
          sounds.playCoinTransfer();
          setSuccessMsg(res.message || `Đã chuyển thành công ${numAmount.toLocaleString('vi-VN')} 🪙!`);
          setAmount('');
          setNote('');
          setSelectedRecipient(null);
          setRecipientInput('');
          loadHistory();
        } else {
          setError(res?.message || 'Chuyển tiền thất bại.');
        }
      });
      return;
    }

    try {
      const res = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setLoading(false);
      if (data.success) {
        sounds.playCoinTransfer();
        setSuccessMsg(data.message || `Đã chuyển thành công ${numAmount.toLocaleString('vi-VN')} 🪙!`);
        setAmount('');
        setNote('');
        setSelectedRecipient(null);
        setRecipientInput('');
        loadHistory();
      } else {
        setError(data.message || 'Chuyển tiền thất bại.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Lỗi mạng khi thực hiện chuyển tiền.');
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
          className="relative w-full max-w-lg bg-[#181818] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.8)] text-white overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Subtle background glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#0070d1]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#00f0ff]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Header */}
          <div className="flex items-center gap-3.5 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00f0ff] to-[#0070d1] flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
              <Send className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0070d1]/15 text-[#53b1ff] text-[10px] font-bold uppercase tracking-wider mb-1">
                <Sparkles className="w-3 h-3" /> Instant Wallet Transfer
              </div>
              <h2 className="text-xl font-light text-white tracking-tight">
                Chuyển Tiền / Chuyển Xu
              </h2>
            </div>
          </div>

          {/* Balance Preview Card */}
          <div className="mb-4 p-3.5 rounded-2xl bg-[#121314] border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#f5a623]" />
              <span className="text-xs text-white/50">Số dư hiện tại:</span>
            </div>
            <span className="font-bold text-sm text-[#f5a623]">
              {currentBalance.toLocaleString('vi-VN')} 🪙
            </span>
          </div>

          {/* Tab Navigation */}
          <div className="flex p-1.5 mb-5 bg-[#121314] rounded-full border border-white/10">
            <button
              type="button"
              onClick={() => {
                setActiveTab('transfer');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'transfer'
                  ? 'bg-[#0070d1] text-white shadow-[0_0_12px_rgba(0,112,209,0.4)]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Chuyển Tiền</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                loadHistory();
              }}
              className={`flex-1 py-2 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-[#0070d1] text-white shadow-[0_0_12px_rgba(0,112,209,0.4)]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Lịch Sử Giao Dịch</span>
            </button>
          </div>

          {/* TAB 1: TRANSFER FORM */}
          {activeTab === 'transfer' && (
            <form onSubmit={handleTransfer} className="space-y-4">
              {/* Recipient Picker */}
              <div className="relative">
                <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-1.5">
                  Người Nhận
                </label>
                <div className="relative flex items-center">
                  <Search className="absolute left-4 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    value={recipientInput}
                    onChange={(e) => {
                      setRecipientInput(e.target.value);
                      setSelectedRecipient(null);
                      setError(null);
                    }}
                    placeholder="Nhập tên đăng nhập hoặc tên hiển thị..."
                    className="w-full bg-[#121314] border border-white/15 focus:border-[#0070d1] rounded-full py-2.5 pl-11 pr-10 text-sm text-white placeholder:text-white/30 focus:outline-none transition-all"
                  />
                  {searching ? (
                    <div className="absolute right-3.5 flex items-center">
                      <Loader2 className="w-4 h-4 animate-spin text-[#53b1ff]" />
                    </div>
                  ) : recipientInput ? (
                    <button
                      type="button"
                      onClick={handleClearRecipient}
                      className="absolute right-3.5 p-1 text-white/40 hover:text-white rounded-full"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>

                {/* Autocomplete Dropdown */}
                {searchResults.length > 0 && !selectedRecipient && (
                  <div className="absolute z-20 left-0 right-0 mt-1.5 bg-[#181818] border border-white/15 rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                    {searchResults.map((sr) => (
                      <button
                        key={sr.id}
                        type="button"
                        onClick={() => handleSelectUser(sr)}
                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 text-left transition-colors border-b border-white/5 last:border-0"
                      >
                        <div className="w-7 h-7 rounded-full bg-[#0070d1] flex items-center justify-center font-bold text-xs text-white">
                          {sr.displayName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-white truncate">{sr.displayName}</div>
                          <div className="text-[10px] text-white/40">@{sr.username}</div>
                        </div>
                        <span className="text-[10px] font-bold text-[#53b1ff] bg-[#0070d1]/15 px-2 py-0.5 rounded-full border border-[#0070d1]/30">
                          Chọn
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedRecipient && (
                  <div className="mt-2 p-2.5 rounded-full bg-[#0070d1]/10 border border-[#0070d1]/30 flex items-center gap-2.5 px-3.5">
                    <div className="w-5 h-5 rounded-full bg-[#0070d1] flex items-center justify-center font-bold text-xs text-white">
                      ✓
                    </div>
                    <div className="text-xs text-white">
                      Đã chọn người nhận:{' '}
                      <strong className="text-[#53b1ff]">{selectedRecipient.displayName}</strong>{' '}
                      <span className="text-white/40">(@{selectedRecipient.username})</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-white/50 uppercase tracking-wider">
                    Số Tiền Chuyển
                  </label>
                  <button
                    type="button"
                    onClick={handleSetMax}
                    className="text-[11px] font-bold text-[#f5a623] hover:underline"
                  >
                    Tất cả ({currentBalance.toLocaleString('vi-VN')} 🪙)
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={currentBalance}
                    value={amount}
                    onChange={(e) => {
                      const v = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0);
                      setAmount(v);
                      setError(null);
                    }}
                    placeholder="0"
                    className="w-full bg-[#121314] border border-white/15 focus:border-[#f5a623] rounded-full py-2.5 px-5 text-base font-bold text-[#f5a623] placeholder:text-white/30 focus:outline-none transition-all"
                  />
                  <span className="absolute right-4 top-2.5 text-sm font-bold text-[#f5a623]">🪙</span>
                </div>

                {/* Preset Chips */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {[1000, 10000, 50000, 100000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddAmount(preset)}
                      className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-white/70 border border-white/10 transition-colors cursor-pointer"
                    >
                      +{preset.toLocaleString('vi-VN')}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleSetMax}
                    className="px-3 py-1 rounded-full bg-[#f5a623]/15 hover:bg-[#f5a623]/25 text-[11px] font-bold text-[#f5a623] border border-[#f5a623]/30 transition-colors cursor-pointer"
                  >
                    Tối đa
                  </button>
                </div>
              </div>

              {/* Note Input */}
              <div>
                <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-1.5">
                  Lời Nhắn (Không bắt buộc)
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="VD: Quà tặng, chơi game vui vẻ nhé!"
                  className="w-full bg-[#121314] border border-white/15 focus:border-[#0070d1] rounded-full py-2.5 px-4 text-xs text-white placeholder:text-white/30 focus:outline-none transition-all"
                />
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
              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs text-center space-y-1"
                >
                  <div className="flex items-center justify-center gap-1.5 font-bold text-sm text-emerald-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Giao Dịch Thành Công!</span>
                  </div>
                  <p className="text-[11px] text-white/70">{successMsg}</p>
                </motion.div>
              )}

              {/* Submit Button */}
              {!user ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenAuth) onOpenAuth();
                  }}
                  className="ps-btn-primary w-full !py-3.5 !rounded-full !text-sm cursor-pointer"
                >
                  Đăng nhập để chuyển tiền
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || !numAmount || numAmount <= 0 || !recipientInput.trim()}
                  className="ps-btn-primary w-full !py-3.5 !rounded-full !text-sm cursor-pointer disabled:opacity-40"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Đang xử lý giao dịch...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        Xác Nhận Chuyển {numAmount > 0 ? `${numAmount.toLocaleString('vi-VN')} 🪙` : ''}
                      </span>
                    </>
                  )}
                </button>
              )}
            </form>
          )}

          {/* TAB 2: TRANSACTION HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50 font-bold uppercase tracking-wider">
                  Giao dịch gần đây ({transactions.length})
                </span>
                <button
                  type="button"
                  onClick={loadHistory}
                  className="text-xs text-[#53b1ff] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                  <span>Làm mới</span>
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/20">
                {loadingHistory ? (
                  <div className="py-8 text-center text-xs text-white/40 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#0070d1]" />
                    <span>Đang tải lịch sử...</span>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-white/40 bg-white/[0.02] rounded-2xl border border-white/10">
                    Chưa có giao dịch chuyển tiền nào.
                  </div>
                ) : (
                  transactions.map((tx) => {
                    const isSender = tx.senderId === user?.id;
                    const dateStr = new Date(tx.timestamp).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div
                        key={tx.id}
                        className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isSender
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-[#0070d1]/20 text-[#53b1ff] border border-[#0070d1]/30'
                            }`}
                          >
                            {isSender ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownLeft className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate">
                              {isSender ? (
                                <>
                                  Tới: <span className="text-white">{tx.recipientDisplayName || tx.recipientUsername}</span>
                                </>
                              ) : (
                                <>
                                  Từ: <span className="text-[#53b1ff]">{tx.senderDisplayName || tx.senderUsername}</span>
                                </>
                              )}
                            </div>
                            <div className="text-[10px] text-white/40">{dateStr}</div>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div
                            className={`font-bold text-xs ${
                              isSender ? 'text-rose-400' : 'text-[#f5a623]'
                            }`}
                          >
                            {isSender ? '-' : '+'}{tx.amount.toLocaleString('vi-VN')} 🪙
                          </div>
                          {tx.note && (
                            <div className="text-[10px] text-white/40 italic max-w-[120px] truncate">
                              "{tx.note}"
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TransferModal;
