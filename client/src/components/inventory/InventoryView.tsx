import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, ArrowUpRight, Trash2, Filter, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import { InventoryItem } from '../../types/game';
import { useAuth } from '../../context/AuthContext';
import { useGameSocketContext } from '../../hooks/GameSocketContext';
import { RARITY_CONFIG } from '../cases/CaseOpeningView';

export const InventoryView: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { socket } = useGameSocketContext();
  const navigate = useNavigate();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filterRarity, setFilterRarity] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'value_desc' | 'value_asc'>('newest');
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [isSellingAll, setIsSellingAll] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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
          setItems(data.inventory);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadInventory();
  }, [user]);

  const handleSellItem = (item: InventoryItem) => {
    if (!user || !socket) return;
    setSellingId(item.id);
    socket.emit('inventory:sell', { userId: user.id, itemId: item.id }, (res: any) => {
      setSellingId(null);
      if (res.success) {
        setActionMsg({ text: `Đã bán ${item.name} và nhận +${res.earned?.toLocaleString('vi-VN')} 🪙!`, type: 'success' });
        loadInventory();
        refreshUser();
      } else {
        setActionMsg({ text: res.message || 'Lỗi khi bán vật phẩm', type: 'error' });
      }
      setTimeout(() => setActionMsg(null), 3500);
    });
  };

  const handleSellAll = () => {
    if (!user || !socket || items.length === 0) return;
    if (!window.confirm(`Bạn có chắc chắn muốn bán toàn bộ ${items.length} vật phẩm để nhận ${totalValue.toLocaleString('vi-VN')} 🪙?`)) {
      return;
    }

    setIsSellingAll(true);
    socket.emit('inventory:sell-all', { userId: user.id }, (res: any) => {
      setIsSellingAll(false);
      if (res.success) {
        setActionMsg({ text: `Đã bán tất cả ${res.count} vật phẩm và nhận +${res.earned?.toLocaleString('vi-VN')} 🪙!`, type: 'success' });
        loadInventory();
        refreshUser();
      } else {
        setActionMsg({ text: res.message || 'Lỗi khi bán tất cả', type: 'error' });
      }
      setTimeout(() => setActionMsg(null), 3500);
    });
  };

  const totalValue = items.reduce((sum, it) => sum + (it.value || 0), 0);

  const filteredItems = items
    .filter(it => filterRarity === 'all' || it.rarity === filterRarity)
    .sort((a, b) => {
      if (sortBy === 'value_desc') return b.value - a.value;
      if (sortBy === 'value_asc') return a.value - b.value;
      return b.obtainedAt - a.obtainedAt;
    });

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 pb-12">
      {/* Notification Toast */}
      {actionMsg && (
        <div
          className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-2 ${
            actionMsg.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              : 'bg-red-950/80 border-red-500/50 text-red-300'
          }`}
        >
          {actionMsg.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
          {actionMsg.text}
        </div>
      )}

      {/* Filters and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#141517] border border-white/10 p-4 sm:p-5 rounded-3xl shadow-xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-white/50 font-semibold flex items-center gap-1 mr-2">
            <Filter className="w-3.5 h-3.5" /> Hạng:
          </span>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'white', label: 'Trắng' },
            { id: 'blue', label: 'Xanh' },
            { id: 'purple', label: 'Tím' },
            { id: 'red', label: 'Đỏ' },
            { id: 'gold', label: 'Vàng' }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterRarity(f.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                filterRarity === f.id
                  ? 'bg-ps-blue text-white shadow-ps-glow'
                  : 'bg-[#1e2024] border border-white/10 text-white/70 hover:text-white hover:border-white/30'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 font-semibold">Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#181818] border border-white/15 text-xs text-white rounded-full px-3.5 py-1.5 font-semibold focus:outline-none focus:border-ps-blue cursor-pointer"
            >
              <option value="newest">Mới nhất</option>
              <option value="value_desc">Giá trị: Cao &rarr; Thấp</option>
              <option value="value_asc">Giá trị: Thấp &rarr; Cao</option>
            </select>
          </div>

          <div className="h-5 w-px bg-white/10 hidden sm:block" />

          <div className="text-xs font-semibold text-white/70">
            <span>{items.length} món</span> • <span className="text-amber-300 font-bold">{totalValue.toLocaleString('vi-VN')} 🪙</span>
          </div>

          {items.length > 0 && (
            <button
              disabled={isSellingAll}
              onClick={handleSellAll}
              className="px-4 py-1.5 rounded-full bg-ps-commerce hover:bg-ps-commerce-hover text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Bán Tất Cả
            </button>
          )}
        </div>
      </div>

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-[#141517] border border-dashed border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-5xl opacity-40">🎒</div>
          <div>
            <h3 className="text-lg font-semibold text-white">Kho đồ hiện tại đang trống</h3>
            <p className="text-xs text-white/50 mt-1">Hãy ghé thăm Mở Hòm CS2 để quay được những skin giá trị!</p>
          </div>
          <button
            onClick={() => navigate('/cases')}
            className="px-6 py-2.5 rounded-full bg-ps-blue hover:bg-ps-blue-hover text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-ps-glow cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-ps-cyan" /> Mở Hòm Ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => {
            const cfg = RARITY_CONFIG[item.rarity];
            const isSelling = sellingId === item.id;
            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border ${cfg.border}/40 ${cfg.bg} flex flex-col justify-between shadow-xl relative overflow-hidden group hover:border-ps-blue/40 hover:scale-[1.01] transition-all`}
              >
                <div className="flex items-center justify-between text-[10px] font-semibold text-white/50 mb-2">
                  <span className={`uppercase font-bold ${cfg.text}`}>{cfg.label}</span>
                  <span>{new Date(item.obtainedAt).toLocaleDateString('vi-VN')}</span>
                </div>

                <div className="text-5xl my-4 text-center group-hover:scale-110 transition-transform drop-shadow-md">
                  {item.icon}
                </div>

                <div className="mb-4 text-center">
                  <h4 className={`font-semibold text-sm truncate ${cfg.text}`}>{item.name}</h4>
                  <div className="text-sm font-bold text-amber-300 mt-1 flex items-center justify-center gap-1">
                    <Coins className="w-4 h-4" /> {item.value.toLocaleString('vi-VN')} 🪙
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={isSelling}
                    onClick={() => handleSellItem(item)}
                    className="flex-1 py-2 px-3 rounded-full bg-white/10 hover:bg-rose-600/30 hover:border-rose-500/50 hover:text-rose-200 border border-white/10 text-white/80 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Coins className="w-3.5 h-3.5 text-amber-300" /> Bán ({item.value}🪙)
                  </button>

                  <button
                    onClick={() => navigate(`/upgrade?itemId=${item.id}`)}
                    className="py-2 px-3.5 rounded-full bg-ps-blue hover:bg-ps-blue-hover text-white text-xs font-semibold transition-all shadow-ps-glow cursor-pointer flex items-center justify-center gap-1"
                    title="Dùng item này để Nâng Cấp"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" /> Nâng Cấp
                  </button>
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: cfg.hex }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InventoryView;
