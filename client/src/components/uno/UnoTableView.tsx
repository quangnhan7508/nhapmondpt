import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Flame, Zap } from 'lucide-react';
import { MaskedUnoGameState, UnoCard, UnoColor } from '../../types/game';
import { sounds } from '../../utils/sound';
import { calcFanTransform, isDroppedInZone } from '../../utils/cardFan';
import { syncHandOrder, reorderHand, calcReorderIndex, sortUnoCards } from '../../utils/handReorder';
import { UnoCardView } from './UnoCardView';

interface UnoTableViewProps {
  gameState: MaskedUnoGameState;
  myPlayerId: string;
  onSendAction: (action: any) => void;
}

export const UnoTableView: React.FC<UnoTableViewProps> = ({
  gameState,
  myPlayerId,
  onSendAction
}) => {
  const [selectedCardForWild, setSelectedCardForWild] = useState<{ card: UnoCard; index: number } | null>(null);
  const [selectedCardForSwap, setSelectedCardForSwap] = useState<{ card: UnoCard; index: number } | null>(null);
  const [isFlexPlay, setIsFlexPlay] = useState<boolean>(false);
  const [flipCount, setFlipCount] = useState<number>(0);
  const [isDraggingCard, setIsDraggingCard] = useState<boolean>(false);

  const handleToggleFlex = () => {
    sounds.playCardWhoosh();
    setFlipCount(c => c + 1);
    setIsFlexPlay(prev => !prev);
  };
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [orderedHand, setOrderedHand] = useState<UnoCard[]>(gameState.myHand);
  const handContainerRef = useRef<HTMLDivElement>(null);
  const [slidingPlayedCard, setSlidingPlayedCard] = useState<{
    card: UnoCard;
    startX: number;
    startY: number;
    chosenColor?: UnoColor;
  } | null>(null);
  const [displayedTopCard, setDisplayedTopCard] = useState<UnoCard>(gameState.topCard);
  const [displayedColor, setDisplayedColor] = useState<UnoColor>(gameState.activeColor);
  const [underneathCard, setUnderneathCard] = useState<UnoCard | null>(null);

  const prevTopIdRef = useRef<string>(gameState.topCard?.id);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setOrderedHand(prev => syncHandOrder(prev, gameState.myHand));
  }, [gameState.myHand]);

  useEffect(() => {
    const currentTop = gameState.topCard;
    if (!currentTop) return;

    if (currentTop.id !== prevTopIdRef.current) {
      const oldCard = displayedTopCard;
      prevTopIdRef.current = currentTop.id;

      const isPlayedByMe = (gameState as any).lastPlayedBy === myPlayerId;

      if (isPlayedByMe) {
        setUnderneathCard(oldCard);
        setDisplayedTopCard(currentTop);
        setDisplayedColor(gameState.activeColor);
      } else {
        // Card was played by opponent: keep old card on table while flying card travels!
        setUnderneathCard(oldCard);
        if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
        updateTimerRef.current = setTimeout(() => {
          setDisplayedTopCard(currentTop);
          setDisplayedColor(gameState.activeColor);
        }, 300);
      }
    } else {
      setDisplayedColor(gameState.activeColor);
    }

    return () => {
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
    };
  }, [gameState.topCard?.id, gameState.activeColor, (gameState as any).lastPlayedBy, myPlayerId]);

  const isMyTurn = gameState.players[gameState.currentTurnIndex]?.id === myPlayerId;
  const myPlayer = gameState.players.find(p => p.id === myPlayerId);
  const totalCards = orderedHand.length;

  const triggerPlayAnimation = (card: UnoCard, index: number, chosenColor?: UnoColor) => {
    const startX = (index - (totalCards - 1) / 2) * 28;
    const startY = 220;
    setSlidingPlayedCard({
      card,
      startX,
      startY,
      chosenColor
    });
    sounds.playCardWhoosh();
    setTimeout(() => {
      sounds.playCardSnap();
    }, 240);
    setTimeout(() => {
      setSlidingPlayedCard(null);
    }, 420);
  };

  const handleCardClick = (card: UnoCard, index: number) => {
    // If not player's turn, ONLY Jump-In is permitted
    if (!isMyTurn) {
      const canJumpIn = gameState.rules.jumpIn && (card.color === gameState.topCard.color && card.value === gameState.topCard.value);
      if (canJumpIn) {
        handleJumpIn(card, index);
      }
      return;
    }

    const effectiveColor = isFlexPlay && card.flexColor ? card.flexColor : card.color;
    const effectiveValue = isFlexPlay && card.flexValue ? card.flexValue : card.value;

    if (effectiveColor === 'wild') {
      setSelectedCardForWild({ card, index });
      return;
    }

    if (effectiveValue === '7' && gameState.rules.sevenZero) {
      setSelectedCardForSwap({ card, index });
      return;
    }

    triggerPlayAnimation(card, index);
    onSendAction({
      type: 'PLAY_CARD',
      cardId: card.id,
      isFlex: isFlexPlay
    });
  };

  const handleSelectWildColor = (color: UnoColor) => {
    if (!selectedCardForWild) return;
    const { card, index } = selectedCardForWild;
    setSelectedCardForWild(null);

    if (card.value === '7' && gameState.rules.sevenZero) {
      setSelectedCardForSwap({ card, index });
      return;
    }

    triggerPlayAnimation(card, index, color);
    onSendAction({
      type: 'PLAY_CARD',
      cardId: card.id,
      chosenColor: color,
      isFlex: isFlexPlay
    });
  };

  const handleSelectSwapTarget = (targetPlayerId: string) => {
    if (!selectedCardForSwap) return;
    const { card, index } = selectedCardForSwap;
    setSelectedCardForSwap(null);

    triggerPlayAnimation(card, index);
    onSendAction({
      type: 'PLAY_CARD',
      cardId: card.id,
      targetPlayerId,
      isFlex: isFlexPlay
    });
  };

  const handleJumpIn = (card: UnoCard, index: number) => {
    if (card.color === 'wild') {
      setSelectedCardForWild({ card, index });
      return;
    }
    triggerPlayAnimation(card, index);
    onSendAction({
      type: 'JUMP_IN',
      cardId: card.id,
      isFlex: isFlexPlay
    });
  };

  const getHandSpacing = (count: number) => {
    if (count <= 2) return '-space-x-2 sm:-space-x-3';
    if (count <= 5) return '-space-x-6 sm:-space-x-7';
    if (count <= 8) return '-space-x-9 sm:-space-x-10';
    if (count <= 12) return '-space-x-11 sm:-space-x-12';
    if (count <= 16) return '-space-x-13 sm:-space-x-14';
    return '-space-x-15 sm:-space-x-16';
  };

  return (
    <div className="absolute inset-0 select-none pointer-events-none">
      {/* PLAYING ZONE: DEAD CENTER IN THE MIDDLE OF THE TABLE */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="flex items-center justify-center gap-6 sm:gap-12 pointer-events-auto">
          {/* 3D Stacked Draw Deck (Like in the screenshot!) */}
          <div
            onClick={() => {
              if (!isMyTurn) return;
              sounds.playCardSnap();
              onSendAction({ type: 'DRAW_CARD' });
            }}
            className={`relative group select-none transition-transform ${
              isMyTurn ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-not-allowed opacity-85'
            }`}
            title={isMyTurn ? 'Bấm để rút 1 lá bài' : `Chồng bài rút (Còn ${gameState.drawPileCount} lá)`}
          >
            {/* Deck Depth Stacking Illusion */}
            <div className="absolute -bottom-2.5 -right-2 w-20 sm:w-24 h-28 sm:h-36 rounded-2xl bg-neutral-900 border border-neutral-700 shadow-md" />
            <div className="absolute -bottom-1.5 -right-1 w-20 sm:w-24 h-28 sm:h-36 rounded-2xl bg-neutral-800 border border-neutral-600 shadow-md" />

            {/* Top Face-Down Official UNO Card */}
            <div className="relative">
              <UnoCardView isBack={true} className="!w-20 sm:!w-24 !h-28 sm:!h-36 shadow-2xl" />

              {/* Deck Card Count Pill */}
              <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-slate-950 border border-amber-400 text-[10px] font-black text-amber-300 shadow">
                {gameState.drawPileCount}
              </div>

              {/* "DRAW" indicator when it's player's turn */}
              {isMyTurn && (
                <div className="absolute inset-0 bg-amber-400/15 rounded-2xl ring-2 ring-amber-400 flex items-center justify-center pointer-events-none animate-pulse">
                  <span className="px-2 py-0.5 rounded bg-black/85 text-amber-300 font-black text-[10px] uppercase tracking-wider shadow">
                    RÚT BÀI
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Center Discard Pile (Playing side always showing + smooth sliding card!) */}
          <div
            id="uno-drop-zone"
            className={`relative flex items-center justify-center p-6 rounded-full transition-all duration-300 ${
              isDraggingCard ? 'scale-110 ring-4 ring-amber-400 bg-amber-400/20' : ''
            }`}
          >
            {/* Previous top card underneath for realistic tabletop depth */}
            {underneathCard && underneathCard.id !== displayedTopCard.id && (
              <div className="absolute transform -rotate-12 translate-x-1.5 translate-y-1 opacity-70 pointer-events-none">
                <UnoCardView
                  card={underneathCard}
                  className="!w-24 sm:!w-28 !h-36 sm:!h-40 shadow-lg"
                />
              </div>
            )}

            {/* Active Top Card (Playing side 100% visible) */}
            <motion.div
              id="uno-top-card"
              key={displayedTopCard.id}
              initial={{ scale: 0.9, rotate: -8, opacity: 0.8 }}
              animate={{ scale: 1, rotate: -3, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 24 }}
              className="z-10 cursor-pointer"
            >
              <UnoCardView
                card={displayedTopCard}
                chosenColor={displayedColor}
                className="!w-24 sm:!w-28 !h-36 sm:!h-40 shadow-2xl"
              />
            </motion.div>

            {/* Animated Sliding Card to Playing Zone */}
            <AnimatePresence>
              {slidingPlayedCard && (
                <motion.div
                  key="sliding-played-card"
                  initial={{
                    x: slidingPlayedCard.startX,
                    y: slidingPlayedCard.startY,
                    scale: 0.9,
                    rotate: 0,
                    opacity: 1
                  }}
                  animate={{
                    x: 0,
                    y: 0,
                    scale: [0.9, 1.15, 1],
                    rotate: [0, -10, -3],
                    opacity: 1
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
                  className="absolute z-30 pointer-events-none"
                >
                  <UnoCardView
                    card={slidingPlayedCard.card}
                    chosenColor={slidingPlayedCard.chosenColor}
                    isFlex={isFlexPlay}
                    className="!w-24 sm:!w-28 !h-36 sm:!h-40 shadow-[0_25px_50px_rgba(0,0,0,0.8)]"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Active Color Badge */}
            <div className="absolute -bottom-5 z-20 flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-950/90 border-2 border-slate-700 text-xs shadow-xl">
              <span className="text-slate-400 font-bold text-[11px]">MÀU HIỆN TẠI:</span>
              <span
                className={`w-3.5 h-3.5 rounded-full ${
                  displayedColor === 'red' ? 'bg-rose-500' :
                  displayedColor === 'blue' ? 'bg-sky-500' :
                  displayedColor === 'green' ? 'bg-emerald-500' :
                  'bg-amber-400'
                }`}
              />
              <span className="font-black uppercase text-[11px] text-white tracking-wide">
                {displayedColor === 'red' ? 'ĐỎ' :
                 displayedColor === 'blue' ? 'XANH DƯƠNG' :
                 displayedColor === 'green' ? 'XANH LÁ' :
                 displayedColor === 'yellow' ? 'VÀNG' : displayedColor}
              </span>
            </div>
          </div>
        </div>

        {/* Drop Release Prompt */}
        <AnimatePresence>
          {isDraggingCard && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-10 px-5 py-2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-2xl pointer-events-none"
            >
              Thả bài vào giữa để đánh!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Catch UNO on opponents buttons */}
      {gameState.canCatchUno.length > 0 && (
        <div className="absolute right-6 top-8 flex flex-col gap-2 z-30 pointer-events-auto">
          {gameState.canCatchUno.map(targetId => {
            const target = gameState.players.find(p => p.id === targetId);
            return (
              <button
                key={targetId}
                onClick={() => onSendAction({ type: 'CATCH_UNO', targetPlayerId: targetId })}
                className="px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow-xl border border-rose-400 animate-bounce"
              >
                <AlertCircle className="w-4 h-4" />
                Bắt phạt {target?.name}! (+2)
              </button>
            );
          })}
        </div>
      )}

      {/* Flex Power Indicator: Placed in top-left screen corner to avoid overlapping any player seats */}
      {gameState.mode === 'flex' && (
        <div className="absolute left-4 sm:left-6 top-4 sm:top-6 z-30 pointer-events-auto">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleFlex}
            className={`px-3.5 py-2 rounded-2xl border-2 flex items-center gap-2.5 shadow-2xl backdrop-blur-md transition-all cursor-pointer ${
              isFlexPlay
                ? 'bg-gradient-to-r from-amber-500/90 to-yellow-500/90 border-yellow-300 text-slate-950 shadow-amber-500/40 ring-4 ring-amber-400/30'
                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
            title="Bấm để bật/tắt lật mặt Flex của bài"
          >
            <div className={`p-1.5 rounded-xl ${isFlexPlay ? 'bg-slate-950/20 text-slate-950' : 'bg-amber-500/20 text-amber-400'}`}>
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div className="flex flex-col items-start leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider">
                  Flex Power
                </span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                  isFlexPlay ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {isFlexPlay ? 'BẬT' : 'TẮT'}
                </span>
              </div>
              <span className={`text-[10px] font-bold ${
                myPlayer?.flexPowerActive ? (isFlexPlay ? 'text-slate-900 font-extrabold' : 'text-emerald-400') : 'text-rose-400'
              }`}>
                {myPlayer?.flexPowerActive ? '● Sẵn sàng lật bài' : '○ Đã dùng quyền'}
              </span>
            </div>
          </motion.button>
        </div>
      )}

      {/* PLAYER'S HAND CARDS: ANCHORED AT THE BOTTOM OF THE TABLE */}
      <div className="absolute bottom-1 sm:bottom-2 left-0 right-0 flex flex-col items-center z-30 pointer-events-none">
        {/* Stacking Penalty Badge: Positioned Down Here, Easily Visible & Never Overlapping Opponents */}
        {gameState.pendingDrawCount > 0 && (
          <motion.div
            initial={{ scale: 0.9, y: 8, opacity: 0 }}
            animate={{ scale: [1, 1.04, 1], y: 0, opacity: 1 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            className="mb-1.5 px-4 py-1.5 rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-2xl shadow-rose-600/60 border-2 border-amber-300 pointer-events-auto"
          >
            <Flame className="w-4 h-4 text-amber-300 fill-amber-300 animate-bounce" />
            <span className="tracking-wide">+{gameState.pendingDrawCount} LÁ BÀI CỘNG DỒN!</span>
            <span className="text-[10px] font-bold bg-black/40 px-2 py-0.5 rounded-lg border border-white/20 hidden sm:inline">
              Đè lá phạt tương đương hoặc rút bài
            </span>
          </motion.div>
        )}

        {/* Hand Status Bar & Sorting */}
        <div className="mb-1 flex items-center gap-2.5 text-xs font-semibold text-white/70 pointer-events-auto">
          <span>Bài của bạn: <strong className="text-white">{totalCards} lá</strong></span>
          <span className="text-white/40 text-[11px] hidden sm:inline">• Kéo bài ra giữa để đánh, kéo ngang để xếp bài</span>
          
          <button
            onClick={() => {
              sounds.playCardSnap();
              setOrderedHand(prev => sortUnoCards(prev));
            }}
            className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white flex items-center gap-1 transition-all cursor-pointer active:scale-95"
            title="Tự động gom nhóm bài theo màu và số"
          >
            <span>🎨 Gom màu</span>
          </button>

          {isMyTurn && (
            <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse font-semibold">
              Lượt Của Bạn!
            </span>
          )}
        </div>

        {/* Hand Fanned Arc Container */}
        <div className="w-full overflow-visible pb-1 pt-2 flex items-end justify-center min-h-[160px] px-4 pointer-events-auto">
          <div ref={handContainerRef} className={`flex ${getHandSpacing(totalCards)}`}>
            {orderedHand.map((card, i) => {
              const fan = calcFanTransform(i, totalCards);
              const isHovered = hoveredCardId === card.id && !isDraggingCard;

              return (
                <motion.div
                  key={card.id}
                  layout="position"
                  onMouseEnter={() => setHoveredCardId(card.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  initial={{ rotate: fan.rotate, y: fan.y + 30, opacity: 0, scale: 0.9 }}
                  animate={{
                    rotate: isHovered ? 0 : fan.rotate,
                    y: isHovered ? -42 : fan.y,
                    opacity: 1,
                    scale: isHovered ? 1.15 : 1
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 380,
                    damping: 24
                  }}
                  drag={true}
                  dragSnapToOrigin={true}
                  dragElastic={0.15}
                  onDragStart={() => {
                    setIsDraggingCard(true);
                    setHoveredCardId(null);
                  }}
                  onDragEnd={(_, info) => {
                    setIsDraggingCard(false);
                    const canJumpIn = gameState.rules.jumpIn && card.color === gameState.topCard.color && card.value === gameState.topCard.value;
                    
                    if (isDroppedInZone(info.point, 'uno-drop-zone')) {
                      // Guard: only allow play action if it's my turn or valid jump-in
                      if (!isMyTurn && !canJumpIn) return;
                      handleCardClick(card, i);
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
                  onClick={() => {
                    // Guard: only allow click if it's my turn or valid jump-in
                    const canJumpIn = gameState.rules.jumpIn && card.color === gameState.topCard.color && card.value === gameState.topCard.value;
                    if (!isMyTurn && !canJumpIn) return;
                    handleCardClick(card, i);
                  }}
                  style={{ zIndex: isHovered ? 90 : fan.zIndex, perspective: 1000 }}
                  className="flex-shrink-0 w-20 sm:w-24 h-28 sm:h-36 cursor-grab active:cursor-grabbing select-none"
                >
                  <motion.div
                    key={`card-flip-${card.id}-${flipCount}`}
                    initial={flipCount > 0 && (card.flexColor || card.flexValue) ? { rotateY: 90, scale: 0.92 } : false}
                    animate={{ rotateY: 0, scale: 1 }}
                    transition={{
                      duration: 0.32,
                      ease: [0.22, 1, 0.36, 1],
                      delay: (card.flexColor || card.flexValue) ? (i % 7) * 0.04 : 0
                    }}
                    style={{ transformStyle: 'preserve-3d' }}
                    className="w-full h-full"
                  >
                    <UnoCardView
                      card={card}
                      isFlex={isFlexPlay}
                      className="w-full h-full shadow-2xl"
                    />
                  </motion.div>

                  {/* Jump-in button overlay if valid and not turn */}
                  {!isMyTurn && gameState.rules.jumpIn && (card.color === gameState.topCard.color && card.value === gameState.topCard.value) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpIn(card, i);
                      }}
                      className="absolute inset-0 bg-amber-500/90 rounded-2xl flex flex-col items-center justify-center text-slate-950 font-black text-xs shadow-xl"
                    >
                      <Zap className="w-5 h-5 mb-1" />
                      CƯỚP LƯỢT!
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Wild Color Picker Modal */}
      {selectedCardForWild && (
        <div
          onClick={() => setSelectedCardForWild(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-[#141517] border border-white/15 rounded-3xl p-6 max-w-xs w-full text-center shadow-2xl"
          >
            <button
              onClick={() => setSelectedCardForWild(null)}
              className="absolute top-4 right-4 text-white/50 hover:text-white text-sm font-bold w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10 hover:border-white/30 transition-colors"
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold text-white mb-1">CHỌN MÀU MỚI</h3>
            <p className="text-xs text-white/50 mb-6">Chọn màu sắc kế tiếp cho vòng chơi:</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { color: 'red', label: 'ĐỎ', bg: 'bg-[#E71D36] text-white' },
                { color: 'blue', label: 'XANH DƯƠNG', bg: 'bg-[#0070d1] text-white shadow-ps-glow' },
                { color: 'green', label: 'XANH LÁ', bg: 'bg-[#00C853] text-white' },
                { color: 'yellow', label: 'VÀNG', bg: 'bg-[#FFD166] text-slate-950' }
              ].map(c => (
                <button
                  key={c.color}
                  onClick={() => handleSelectWildColor(c.color as UnoColor)}
                  className={`h-24 rounded-2xl font-bold text-sm uppercase border border-white/20 shadow-xl hover:scale-105 active:scale-95 transition-transform ${c.bg}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSelectedCardForWild(null)}
              className="mt-4 w-full py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold text-white/80 border border-white/10 transition-colors"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      )}

      {/* 7-Swap Target Modal */}
      {selectedCardForSwap && (
        <div
          onClick={() => setSelectedCardForSwap(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-[#141517] border border-white/15 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
          >
            <button
              onClick={() => setSelectedCardForSwap(null)}
              className="absolute top-4 right-4 text-white/50 hover:text-white text-sm font-bold w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10 hover:border-white/30 transition-colors"
            >
              ✕
            </button>
            <h3 className="text-base font-semibold text-white mb-1">Luật 7: Đổi Toàn Bộ Bài!</h3>
            <p className="text-xs text-white/50 mb-4">Chọn người chơi bạn muốn hoán đổi toàn bộ bài:</p>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {gameState.players
                .filter(p => p.id !== myPlayerId && !p.eliminated)
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectSwapTarget(p.id)}
                    className="w-full p-3.5 rounded-2xl bg-[#1e2024] hover:bg-ps-blue/20 hover:border-ps-blue/40 border border-white/10 flex items-center justify-between text-xs font-semibold text-white transition-all cursor-pointer"
                  >
                    <span>{p.name}</span>
                    <span className="text-amber-300 font-bold">{p.cardCount} lá</span>
                  </button>
                ))}
            </div>
            <button
              onClick={() => setSelectedCardForSwap(null)}
              className="mt-4 w-full py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold text-white/80 border border-white/10 transition-colors"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
