import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpDown, Play, Sparkles } from 'lucide-react';
import { MaskedSamGameState, MaskedTLGameState, Suit, TLCard } from '../../types/game';
import { sounds } from '../../utils/sound';
import { calcFanTransform, isDroppedInZone } from '../../utils/cardFan';
import { syncHandOrder, reorderHand, calcReorderIndex, sortTLCards } from '../../utils/handReorder';
import { getSuggestedCombos, findMatchingComboForCard } from '../../utils/tienLenSuggestions';

interface TienLenTableViewProps {
  gameState: MaskedTLGameState | MaskedSamGameState;
  myPlayerId: string;
  onSendAction: (action: any) => void;
}

export const TienLenTableView: React.FC<TienLenTableViewProps> = ({
  gameState,
  myPlayerId,
  onSendAction
}) => {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'rank' | 'suit' | 'custom'>('rank');
  const [isDraggingCard, setIsDraggingCard] = useState<boolean>(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [autoSelectCombo, setAutoSelectCombo] = useState<boolean>(false); // Mặc định là Chọn Lẻ để tự do toggle lá bài
  const [slidingCards, setSlidingCards] = useState<TLCard[] | null>(null);
  const [displayedTrick, setDisplayedTrick] = useState<any>(gameState.currentTrick);
  const [orderedHand, setOrderedHand] = useState<TLCard[]>(() => sortTLCards(gameState.myHand, 'rank'));
  const handContainerRef = useRef<HTMLDivElement>(null);

  const prevTrickKeyRef = useRef<string>(gameState.currentTrick?.combo?.cards?.map((c: any) => c.id).join('-') || '');
  const tlUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setOrderedHand(prev => {
      if (sortBy === 'custom') {
        return syncHandOrder(prev, gameState.myHand);
      }
      return sortTLCards(gameState.myHand, sortBy);
    });
  }, [gameState.myHand, sortBy]);

  useEffect(() => {
    const trickKey = gameState.currentTrick?.combo?.cards?.map((c: any) => c.id).join('-') || '';
    if (trickKey !== prevTrickKeyRef.current) {
      prevTrickKeyRef.current = trickKey;
      const isPlayedByMe = gameState.currentTrick?.playerId === myPlayerId;
      if (isPlayedByMe || !gameState.currentTrick) {
        setDisplayedTrick(gameState.currentTrick);
      } else {
        if (tlUpdateTimerRef.current) clearTimeout(tlUpdateTimerRef.current);
        tlUpdateTimerRef.current = setTimeout(() => {
          setDisplayedTrick(gameState.currentTrick);
        }, 300);
      }
    } else {
      setDisplayedTrick(gameState.currentTrick);
    }

    return () => {
      if (tlUpdateTimerRef.current) clearTimeout(tlUpdateTimerRef.current);
    };
  }, [gameState.currentTrick, myPlayerId]);

  const isMyTurn = gameState.players[gameState.currentTurnIndex]?.id === myPlayerId;
  const myPlayer = gameState.players.find(p => p.id === myPlayerId);
  const hasPassed = myPlayer?.hasPassedCurrentRound ?? false;

  const isSam = false;
  const samState = isSam ? (gameState as MaskedSamGameState) : null;
  const isBaoSamPhase = Boolean(isSam && samState?.phase === 'bao_sam');
  const samCaller = isSam && samState?.samCallerId
    ? gameState.players.find(p => p.id === samState.samCallerId)
    : null;

  // Check if current selection can perform a valid cut (even out of turn)
  const canCutOutOfTurn = useMemo(() => {
    if (isSam) return false;
    if (!gameState.currentTrick || selectedCardIds.length === 0) return false;
    const selected = gameState.myHand.filter(c => selectedCardIds.includes(c.id));
    const sorted = [...selected].sort((a, b) => a.overallRank - b.overallRank);
    const len = sorted.length;
    const curr = gameState.currentTrick.combo;

    // 4 Đôi thông
    if (len === 8 && isConsecutivePairs(sorted, 4)) {
      if (curr.type === 'single' && curr.cards[0].rankValue === 15) return true;
      if (curr.type === 'pair' && curr.cards[0].rankValue === 15) return true;
      if (curr.type === 'three_pair_sequence') return true;
      if (curr.type === 'four_of_a_kind') return true;
      if (curr.type === 'four_pair_sequence') return sorted[7].overallRank > curr.highestCard.overallRank;
    }

    const allowCutTwo = (gameState as MaskedTLGameState).cutTwoOutOfTurnRule !== false;
    if (!allowCutTwo) return false;

    // Tứ quý
    if (len === 4 && sorted[0].rankValue === sorted[1].rankValue && sorted[1].rankValue === sorted[2].rankValue && sorted[2].rankValue === sorted[3].rankValue) {
      if (curr.type === 'single' && curr.cards[0].rankValue === 15) return true;
      if (curr.type === 'pair' && curr.cards[0].rankValue === 15) return true;
      if (curr.type === 'three_pair_sequence') return true;
      if (curr.type === 'four_of_a_kind') return sorted[3].overallRank > curr.highestCard.overallRank;
    }

    // 3 Đôi thông
    if (len === 6 && isConsecutivePairs(sorted, 3)) {
      if (curr.type === 'single' && curr.cards[0].rankValue === 15) return true;
      if (curr.type === 'three_pair_sequence') return sorted[5].overallRank > curr.highestCard.overallRank;
    }

    return false;
  }, [isSam, gameState.currentTrick, selectedCardIds, gameState.myHand, (gameState as any).cutTwoOutOfTurnRule]);

  // Selected cards combination detector for live UI badge
  const comboPreview = useMemo(() => {
    const selected = gameState.myHand.filter(c => selectedCardIds.includes(c.id));
    if (selected.length === 0) return null;

    const sorted = [...selected].sort((a, b) => a.overallRank - b.overallRank);
    const len = sorted.length;
    const curr = gameState.currentTrick?.combo;

    // Sâm Lốc rules
    if (isSam) {
      if (len === 1) return `Bài lẻ [${sorted[0].value}]`;
      if (len === 2 && sorted[0].rankValue === sorted[1].rankValue) return `Đôi [${sorted[0].value}]`;
      if (len === 3 && sorted[0].rankValue === sorted[1].rankValue && sorted[1].rankValue === sorted[2].rankValue) {
        return `Sám cô [${sorted[0].value}]`;
      }
      if (len === 4 && sorted[0].rankValue === sorted[1].rankValue && sorted[1].rankValue === sorted[2].rankValue && sorted[2].rankValue === sorted[3].rankValue) {
        if (curr && curr.type === 'single' && curr.cards[0].rankValue === 15) return `💥 TỨ QUÝ CHẶT HEO!`;
        return `🔥 TỨ QUÝ [${sorted[0].value}]`;
      }
      if (len === 3 && sorted.some(c => c.rankValue === 14) && sorted.some(c => c.rankValue === 15) && sorted.some(c => c.rankValue === 3)) {
        return `Sảnh hạ [A-2-3]`;
      }
      if (len >= 3) {
        let isStraight = true;
        for (let i = 0; i < len - 1; i++) {
          if (sorted[i].rankValue === 15 || sorted[i + 1].rankValue === 15) {
            isStraight = false;
            break;
          }
          if (sorted[i + 1].rankValue !== sorted[i].rankValue + 1) {
            isStraight = false;
            break;
          }
        }
        if (isStraight) {
          return `Sảnh ${len} lá (${sorted[0].value} ➔ ${sorted[len - 1].value})`;
        }
      }
      return 'Tổ hợp chưa hợp lệ';
    }

    if (len === 1) return `Rác [${sorted[0].value}${getSuitIcon(sorted[0].suit)}]`;
    if (len === 2 && sorted[0].rankValue === sorted[1].rankValue) return `Đôi [${sorted[0].value}]`;
    if (len === 3 && sorted[0].rankValue === sorted[1].rankValue && sorted[1].rankValue === sorted[2].rankValue) {
      return `Sám cô [${sorted[0].value}]`;
    }

    // Tứ Quý
    if (len === 4 && sorted[0].rankValue === sorted[1].rankValue && sorted[1].rankValue === sorted[2].rankValue && sorted[2].rankValue === sorted[3].rankValue) {
      if (curr) {
        if (curr.type === 'single' && curr.cards[0].rankValue === 15) return `💥 TỨ QUÝ CHẶT HEO!`;
        if (curr.type === 'pair' && curr.cards[0].rankValue === 15) return `💥 TỨ QUÝ CHẶT ĐÔI HEO!`;
        if (curr.type === 'three_pair_sequence') return `💥 TỨ QUÝ CHẶT 3 ĐÔI THÔNG!`;
        if (curr.type === 'four_of_a_kind' && sorted[3].overallRank > curr.highestCard.overallRank) return `💥 TỨ QUÝ ĐÈ TỨ QUÝ!`;
      }
      return `🔥 TỨ QUÝ [${sorted[0].value}]`;
    }

    // Straight
    if (len >= 3) {
      let isStraight = true;
      for (let i = 0; i < len - 1; i++) {
        if (sorted[i].rankValue === 15 || sorted[i + 1].rankValue === 15) {
          isStraight = false;
          break;
        }
        if (sorted[i + 1].rankValue !== sorted[i].rankValue + 1) {
          isStraight = false;
          break;
        }
      }
      if (isStraight) {
        return `Sảnh ${len} lá (${sorted[0].value} ➔ ${sorted[len - 1].value})`;
      }
    }

    // 3 Đôi thông
    if (len === 6 && isConsecutivePairs(sorted, 3)) {
      if (curr && curr.type === 'single' && curr.cards[0].rankValue === 15) {
        return `💥 3 ĐÔI THÔNG CHẶT HEO!`;
      }
      return `⚡ 3 ĐÔI THÔNG (đến ${sorted[len - 1].value})`;
    }

    // 4 Đôi thông
    if (len === 8 && isConsecutivePairs(sorted, 4)) {
      if (curr && ((curr.type === 'single' || curr.type === 'pair') && curr.cards[0].rankValue === 15)) {
        return `👑 4 ĐÔI THÔNG CHẶT HEO!`;
      }
      return `👑 4 ĐÔI THÔNG (CHẶT KHÔNG CẦN VÒNG!)`;
    }

    return 'Tổ hợp chưa hợp lệ';
  }, [isSam, selectedCardIds, gameState.myHand, gameState.currentTrick]);

  const isFirstTurnWithThreeSpades = useMemo(() => {
    if (isSam) return false;
    return Boolean(
      (gameState as MaskedTLGameState).firstTurnRule &&
      gameState.trickHistory.length === 0 &&
      gameState.currentTrick === null
    );
  }, [isSam, (gameState as any).firstTurnRule, gameState.trickHistory.length, gameState.currentTrick]);

  // Suggested playable combinations from player hand
  const suggestedCombos = useMemo(() => {
    const isSpecialCuttingOpportunity = gameState.currentTrick && (
      (gameState.currentTrick.combo.type === 'single' && gameState.currentTrick.combo.cards[0].rankValue === 15) ||
      (gameState.currentTrick.combo.type === 'pair' && gameState.currentTrick.combo.cards[0].rankValue === 15) ||
      gameState.currentTrick.combo.type === 'three_pair_sequence' ||
      gameState.currentTrick.combo.type === 'four_of_a_kind'
    );

    if (!isMyTurn && !isSpecialCuttingOpportunity) return [];
    if (hasPassed && !isSpecialCuttingOpportunity) return [];

    return getSuggestedCombos(gameState.myHand, gameState.currentTrick, isFirstTurnWithThreeSpades);
  }, [gameState.myHand, gameState.currentTrick, isMyTurn, hasPassed, isFirstTurnWithThreeSpades]);

  // Hovered combo detector: ONLY active when autoSelectCombo is TRUE. When in 'chọn lẻ', return null so user can freely toggle!
  const hoveredCombo = useMemo(() => {
    if (!autoSelectCombo) return null;
    if (!hoveredCardId) return null;
    return findMatchingComboForCard(
      hoveredCardId,
      gameState.myHand,
      gameState.currentTrick,
      isFirstTurnWithThreeSpades
    );
  }, [autoSelectCombo, hoveredCardId, gameState.myHand, gameState.currentTrick, isFirstTurnWithThreeSpades]);

  const hoveredComboIds = useMemo(() => {
    if (!hoveredCombo) return hoveredCardId ? [hoveredCardId] : [];
    return hoveredCombo.map(c => c.id);
  }, [hoveredCombo, hoveredCardId]);

  const handleCardClick = (card: TLCard) => {
    sounds.playCardSnap();

    // If auto combo select is enabled and hovered combo contains this card with > 1 cards
    if (autoSelectCombo && hoveredCombo && hoveredCombo.length > 1 && hoveredCombo.some(c => c.id === card.id)) {
      const comboIds = hoveredCombo.map(c => c.id);
      const allComboSelected = comboIds.every(id => selectedCardIds.includes(id));

      if (allComboSelected) {
        // Player clicks a card in the selected combo to deselect that card individually ("người chơi muốn sẽ tự bấm không chọn")
        setSelectedCardIds(selectedCardIds.filter(id => id !== card.id));
      } else {
        // Select all cards in this combination
        setSelectedCardIds(comboIds);
      }
      return;
    }

    // Default toggle
    if (selectedCardIds.includes(card.id)) {
      setSelectedCardIds(selectedCardIds.filter(i => i !== card.id));
    } else {
      setSelectedCardIds([...selectedCardIds, card.id]);
    }
  };

  const handlePlayCards = (overrideCardIds?: string[]) => {
    const cardsToPlay = overrideCardIds || selectedCardIds;
    if (cardsToPlay.length === 0) return;

    const cardsObj = gameState.myHand.filter(c => cardsToPlay.includes(c.id));
    if (cardsObj.length > 0) {
      setSlidingCards(cardsObj);
      sounds.playCardWhoosh();
      setTimeout(() => {
        sounds.playCardSnap();
      }, 240);
      setTimeout(() => {
        setSlidingCards(null);
      }, 420);
    }

    onSendAction({
      type: 'PLAY_CARDS',
      cardIds: cardsToPlay
    });
    setSelectedCardIds([]);
  };

  const handlePassTurn = () => {
    onSendAction({ type: 'PASS_TURN' });
    setSelectedCardIds([]);
  };

  function getSuitIcon(suit: Suit) {
    switch (suit) {
      case 'spades': return '♠';
      case 'clubs': return '♣';
      case 'diamonds': return '♦';
      case 'hearts': return '♥';
    }
  }

  function getSuitColor(suit: Suit) {
    return suit === 'hearts' || suit === 'diamonds' ? 'text-rose-600' : 'text-slate-900';
  }

  const totalCards = orderedHand.length;

  return (
    <div className="absolute inset-0 select-none pointer-events-none">
      {/* Sâm Lốc: Báo Sâm Phase Modal */}
      {isBaoSamPhase && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-auto bg-slate-900/95 border-2 border-amber-400 p-5 rounded-3xl shadow-2xl flex flex-col items-center max-w-md text-center backdrop-blur-md animate-in fade-in zoom-in duration-300">
          <span className="text-3xl mb-1">🔔</span>
          <h4 className="text-base font-black text-amber-300 uppercase tracking-wide">
            Giai Đoạn Xin Sâm (Báo Sâm)
          </h4>
          <p className="text-xs text-slate-300 mt-1 mb-4 leading-relaxed">
            Bạn có bài đẹp và tự tin đánh hết mà không ai chặn được? Nếu bị chặn dù chỉ 1 quân, bạn sẽ bị phạt <strong className="text-rose-400">Đền Sâm</strong>!
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                sounds.playUnoShout();
                onSendAction({ type: 'BAO_SAM', baoSam: true });
              }}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-lg active:scale-95 transition-transform cursor-pointer"
            >
              👑 Xin Sâm (Báo Sâm)
            </button>
            <button
              onClick={() => {
                sounds.playCardSnap();
                onSendAction({ type: 'BAO_SAM', baoSam: false });
              }}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-600 transition-colors cursor-pointer"
            >
              Bỏ Qua
            </button>
          </div>
        </div>
      )}

      {/* Sâm Lốc: Active Sâm Caller Notification Banner */}
      {samCaller && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-600 via-rose-600 to-amber-600 border border-yellow-300 shadow-xl text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 animate-pulse">
          <span>🔥</span>
          <span>{samCaller.name} ĐÃ BÁO SÂM! HÃY TÌM CÁCH CHẶN BÀI!</span>
        </div>
      )}

      {/* Quick Hand Sorting Corner Widget (Góc Màn Hình) */}
      <div className="absolute right-6 top-8 flex flex-col items-end gap-1.5 z-30 pointer-events-auto">
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-xl backdrop-blur-md">
          <span className="text-[10px] font-black uppercase text-slate-400 px-2 hidden sm:inline">
            Xếp bài:
          </span>
          <button
            onClick={() => {
              sounds.playCardSnap();
              setSortBy('rank');
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              sortBy === 'rank'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Xếp bài từ 3 đến Heo (2)"
          >
            3 ➔ 2 (Điểm)
          </button>
          <button
            onClick={() => {
              sounds.playCardSnap();
              setSortBy('suit');
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              sortBy === 'suit'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Xếp bài theo chất Bích ➔ Tép ➔ Rô ➔ Cơ"
          >
            ♠ ➔ ♥ (Chất)
          </button>
          <button
            onClick={() => {
              sounds.playCardSnap();
              setSortBy('custom');
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              sortBy === 'custom'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Tự do kéo thả sắp xếp bằng chuột"
          >
            Tự Do ⇄
          </button>
        </div>
      </div>

      {/* Center Table Trick Display / Drop Zone: DEAD IN THE EXACT MIDDLE OF THE TABLE */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
        <div
          id="tienlen-drop-zone"
          className={`relative p-4 rounded-3xl transition-all duration-200 pointer-events-auto ${
            isDraggingCard
              ? 'ring-4 ring-emerald-400 ring-offset-4 ring-offset-slate-950 bg-emerald-500/20 scale-105'
              : ''
          }`}
        >
          {displayedTrick ? (
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                Bộ Bài Trên Bàn
              </span>

              {/* Trick Cards Display */}
              <div id="tienlen-trick-cards" className="flex -space-x-4 sm:-space-x-6">
                {displayedTrick.combo.cards.map((c: any, i: number) => (
                  <motion.div
                    key={c.id || i}
                    initial={{ scale: 0.88, y: -10, opacity: 0.7 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                    className={`w-20 sm:w-24 h-28 sm:h-36 rounded-2xl bg-white border-2 border-slate-300 shadow-2xl flex flex-col justify-between p-2 font-black ${getSuitColor(
                      c.suit
                    )}`}
                  >
                    <div className="text-sm self-start leading-none font-bold">
                      {c.value}
                      <span className="text-base">{getSuitIcon(c.suit)}</span>
                    </div>
                    <div className="text-3xl self-center leading-none">
                      {getSuitIcon(c.suit)}
                    </div>
                    <div className="text-sm self-end leading-none font-bold rotate-180">
                      {c.value}
                      <span className="text-base">{getSuitIcon(c.suit)}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-3 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs font-bold text-slate-300 shadow">
                {displayedTrick.combo.type === 'single' ? 'BÀI RÁC' :
                 displayedTrick.combo.type === 'pair' ? 'ĐÔI' :
                 displayedTrick.combo.type === 'triple' ? 'SÁM CÔ' :
                 displayedTrick.combo.type === 'four_of_a_kind' ? 'TỨ QUÝ' :
                 displayedTrick.combo.type === 'straight' ? 'SẢNH' :
                 displayedTrick.combo.type === 'consecutive_pairs' ? 'ĐÔI THÔNG' :
                 displayedTrick.combo.type.toUpperCase().replace(/_/g, ' ')}
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-3xl border-2 border-dashed border-emerald-500/30 bg-emerald-950/20 text-center">
              <span className="text-2xl block mb-1">🃏</span>
              <span className="text-sm font-bold text-emerald-300">Vòng Mới</span>
              <p className="text-xs text-slate-400 mt-1">Người bắt đầu có thể đánh bất kỳ tổ hợp nào! (Kéo hoặc bấm)</p>
            </div>
          )}

          {/* In-Flight Sliding Cards to Trick Area */}
          <AnimatePresence>
            {slidingCards && (
              <motion.div
                key="sliding-tl-cards"
                initial={{
                  y: 220,
                  scale: 0.9,
                  opacity: 1
                }}
                animate={{
                  y: 0,
                  scale: [0.9, 1.15, 1],
                  opacity: 1
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
              >
                <div className="flex -space-x-4 sm:-space-x-6">
                  {slidingCards.map((c, i) => (
                    <div
                      key={c.id || i}
                      className={`w-20 sm:w-24 h-28 sm:h-36 rounded-2xl bg-white border-2 border-slate-300 shadow-[0_25px_50px_rgba(0,0,0,0.8)] flex flex-col justify-between p-2 font-black ${getSuitColor(
                        c.suit
                      )}`}
                    >
                      <div className="text-sm self-start leading-none font-bold">
                        {c.value}
                        <span className="text-base">{getSuitIcon(c.suit)}</span>
                      </div>
                      <div className="text-3xl self-center leading-none">
                        {getSuitIcon(c.suit)}
                      </div>
                      <div className="text-sm self-end leading-none font-bold rotate-180">
                        {c.value}
                        <span className="text-base">{getSuitIcon(c.suit)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Drag Hint Overlay */}
        <AnimatePresence>
          {isDraggingCard && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute -top-4 px-4 py-1.5 rounded-full bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5 pointer-events-none"
            >
              <span>Thả bài vào giữa để đánh</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* PLAYER HAND & CONTROL BAR: ANCHORED AT THE BOTTOM OF THE TABLE */}
      <div className="absolute bottom-1 sm:bottom-2 left-0 right-0 flex flex-col items-center z-30 pointer-events-none">
        {/* Playable Combo Suggestions Bar */}
        {suggestedCombos.length > 0 && (
          <div className="w-full max-w-2xl px-4 mb-1.5 flex items-center gap-1.5 overflow-x-auto pointer-events-auto py-1">
            <span className="text-[11px] font-black text-amber-300 flex items-center gap-1 flex-shrink-0 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-amber-500/40 shadow">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Gợi ý đè bài:
            </span>
            {suggestedCombos.slice(0, 5).map((combo, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSelectedCardIds(combo.cards.map(c => c.id));
                  sounds.playCardSnap();
                }}
                className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shadow-md active:scale-95 ${
                  combo.isSpecialCut
                    ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white border border-rose-400 animate-pulse shadow-rose-600/30'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-indigo-200 hover:text-white border border-indigo-500/40'
                }`}
                title="Bấm để chọn nhanh các quân bài này trên tay"
              >
                <span>{combo.label}</span>
              </button>
            ))}
          </div>
        )}

        {isMyTurn && gameState.currentTrick && !hasPassed && suggestedCombos.length === 0 && (
          <div className="mb-1 pointer-events-auto">
            <span className="px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-400 text-xs font-medium">
              💡 Không có bài đè được trên bàn (Hãy bấm <strong className="text-amber-300">Bỏ Lượt</strong>)
            </span>
          </div>
        )}

        {/* Actions and Sorting Toolbar */}
        <div className="w-full max-w-2xl px-4 mb-1 flex items-center justify-between gap-3 pointer-events-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sounds.playCardSnap();
                if (sortBy === 'custom' || sortBy === 'suit') {
                  setSortBy('rank');
                } else {
                  setSortBy('suit');
                }
              }}
              className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold flex items-center gap-1.5 text-white transition-all cursor-pointer active:scale-95"
              title={sortBy === 'custom' ? 'Đang ở chế độ xếp tự do bằng chuột. Bấm để xếp tự động' : 'Bấm để đổi kiểu xếp bài'}
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-ps-cyan" />
              {sortBy === 'custom'
                ? 'Xếp bài: Tự do (Kéo thả ⇄)'
                : sortBy === 'rank'
                ? 'Xếp bài: Điểm (3➔2)'
                : 'Xếp bài: Chất (♠➔♥)'}
            </button>

            {/* Quick Toggle for Auto-Combo Selection */}
            <button
              onClick={() => {
                sounds.playCardSnap();
                setAutoSelectCombo(prev => !prev);
              }}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                autoSelectCombo
                  ? 'bg-ps-blue/25 border-ps-blue/60 text-ps-cyan shadow-ps-glow'
                  : 'bg-white/10 border-white/15 text-white/70 hover:text-white'
              }`}
              title={
                autoSelectCombo
                  ? 'Đang bật tự chọn cả bộ. Bấm để chuyển sang Chọn lẻ (tự do toggle từng lá bài).'
                  : 'Đang ở chế độ Chọn lẻ (tự do toggle từng lá bài, không tự chọn bộ). Bấm để chuyển sang Chọn cả bộ.'
              }
            >
              <span>{autoSelectCombo ? '⚡ Cả bộ' : '🖐 Chọn lẻ'}</span>
            </button>

            {comboPreview && (
              <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                comboPreview.includes('CHẶT')
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                  : 'bg-ps-blue/20 border-ps-blue/40 text-ps-cyan'
              }`}>
                {comboPreview}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Pass button */}
            <button
              onClick={handlePassTurn}
              disabled={!isMyTurn || !gameState.currentTrick || hasPassed}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white/80 disabled:opacity-40 transition-colors cursor-pointer"
            >
              Bỏ Lượt
            </button>

            {/* Play button */}
            <button
              onClick={() => handlePlayCards()}
              disabled={(!isMyTurn && !canCutOutOfTurn) || selectedCardIds.length === 0 || hasPassed}
              className={`px-6 py-2 rounded-full text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-40 transition-all active:scale-95 cursor-pointer ${
                canCutOutOfTurn && !isMyTurn
                  ? 'bg-gradient-to-r from-rose-600 to-amber-600 shadow-rose-600/40 animate-pulse border border-rose-300'
                  : 'bg-ps-blue hover:bg-ps-blue-hover text-white shadow-ps-glow'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {canCutOutOfTurn && !isMyTurn ? '🔥 Chặt Ngay!' : `Đánh bài (${selectedCardIds.length})`}
            </button>
          </div>
        </div>

        {/* Hand Cards with Arc Fan and Drag-to-Play */}
        <div className="w-full overflow-visible pb-1 pt-2 flex items-end justify-center min-h-[160px] px-4 pointer-events-auto">
          <div ref={handContainerRef} className={`flex ${totalCards <= 4 ? '-space-x-5 sm:-space-x-6' : totalCards <= 8 ? '-space-x-9 sm:-space-x-10' : totalCards <= 13 ? '-space-x-12 sm:-space-x-13' : '-space-x-14 sm:-space-x-15'}`}>
            {orderedHand.map((card, i) => {
              const isSelected = selectedCardIds.includes(card.id);
              const fan = calcFanTransform(i, totalCards);
              const isDirectlyHovered = hoveredCardId === card.id && !isDraggingCard;
              const isInHoveredCombo = hoveredComboIds.includes(card.id) && !isDraggingCard;

              return (
                <motion.div
                  key={card.id}
                  layout="position"
                  onMouseEnter={() => setHoveredCardId(card.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  initial={{ rotate: fan.rotate, y: fan.y, opacity: 0, scale: 0.9 }}
                  animate={{
                    rotate: isSelected ? 0 : (isInHoveredCombo ? 0 : fan.rotate),
                    y: isSelected ? (isInHoveredCombo ? fan.y - 36 : fan.y - 28) : (isInHoveredCombo ? -40 : fan.y),
                    opacity: 1,
                    scale: isSelected ? (isInHoveredCombo ? 1.12 : 1.08) : (isInHoveredCombo ? 1.15 : 1)
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                  drag={true}
                  dragSnapToOrigin={true}
                  dragElastic={0.15}
                  onDragStart={() => {
                    setIsDraggingCard(true);
                    setHoveredCardId(null);
                  }}
                  onDragEnd={(_, info) => {
                    setIsDraggingCard(false);
                    if (isDroppedInZone(info.point, 'tienlen-drop-zone')) {
                      if (!isMyTurn && !canCutOutOfTurn) return;
                      // If this card is part of selection, play selection; otherwise play single card
                      const cards = selectedCardIds.includes(card.id) ? selectedCardIds : [card.id];
                      handlePlayCards(cards);
                      return;
                    }

                    // Card was dropped inside the hand area -> check horizontal reorder
                    if (Math.abs(info.offset.x) >= 18) {
                      const newIdx = calcReorderIndex(
                        i,
                        info.offset.x,
                        totalCards,
                        handContainerRef.current?.getBoundingClientRect(),
                        info.point.x
                      );
                      if (newIdx !== i) {
                        setSortBy('custom');
                        setOrderedHand(prev => reorderHand(prev, i, newIdx));
                        sounds.playCardSnap();
                      }
                    }
                  }}
                  whileDrag={{
                    scale: 1.18,
                    zIndex: 150,
                    rotate: 0,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                  }}
                  onClick={() => handleCardClick(card)}
                  style={{ zIndex: isDirectlyHovered ? 100 : (isInHoveredCombo ? 95 : (isSelected ? 50 : fan.zIndex)) }}
                  className={`relative flex-shrink-0 w-20 sm:w-24 h-32 sm:h-36 rounded-2xl bg-white border-2 shadow-xl flex flex-col justify-between p-2.5 cursor-grab active:cursor-grabbing select-none transition-shadow ${
                    getSuitColor(card.suit)
                  } ${
                    isInHoveredCombo
                      ? 'ring-4 ring-amber-400 border-amber-300 shadow-2xl shadow-amber-500/40'
                      : isSelected
                      ? 'ring-4 ring-indigo-500 border-indigo-400'
                      : 'border-slate-300'
                  }`}
                >
                  {/* Badge when card is part of a multi-card hovered combo */}
                  {isInHoveredCombo && hoveredCombo && hoveredCombo.length > 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[9px] shadow-md uppercase tracking-wider whitespace-nowrap z-50 pointer-events-none flex items-center gap-0.5"
                    >
                      <span>✨</span>
                      <span>
                        {hoveredCombo.length === 4 && hoveredCombo[0].rankValue === hoveredCombo[1].rankValue
                          ? 'Tứ Quý'
                          : hoveredCombo.length >= 6 && isConsecutivePairs(hoveredCombo, hoveredCombo.length / 2)
                          ? `${hoveredCombo.length / 2} Đôi Thông`
                          : hoveredCombo.length >= 3 && hoveredCombo[0].rankValue !== hoveredCombo[1].rankValue
                          ? `Sảnh ${hoveredCombo.length}`
                          : hoveredCombo.length === 3
                          ? 'Sám'
                          : 'Đôi'}
                      </span>
                    </motion.div>
                  )}

                  <div className="text-sm self-start leading-none font-bold">
                    {card.value}
                    <span className="text-base">{getSuitIcon(card.suit)}</span>
                  </div>

                  <div className="text-3xl self-center leading-none">
                    {getSuitIcon(card.suit)}
                  </div>

                  <div className="text-sm self-end leading-none font-bold rotate-180">
                    {card.value}
                    <span className="text-base">{getSuitIcon(card.suit)}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

function isConsecutivePairs(sortedCards: TLCard[], sequenceLength: number): boolean {
  if (sortedCards.length !== sequenceLength * 2) return false;
  for (let i = 0; i < sequenceLength; i++) {
    const c1 = sortedCards[i * 2];
    const c2 = sortedCards[i * 2 + 1];
    if (c1.rankValue !== c2.rankValue) return false;
    if (c1.rankValue === 15) return false; // No 2s
    if (i > 0) {
      const prev = sortedCards[(i - 1) * 2];
      if (c1.rankValue !== prev.rankValue + 1) return false;
    }
  }
  return true;
}
