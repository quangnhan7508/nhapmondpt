import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowLeft, ArrowRight, Eye, Flame, ShieldAlert, Sparkles, XCircle } from 'lucide-react';
import { EKCard, MaskedEKGameState } from '../../types/game';
import { sounds } from '../../utils/sound';
import { calcFanTransform, isDroppedInZone } from '../../utils/cardFan';
import { syncHandOrder, reorderHand, calcReorderIndex, sortEKCards } from '../../utils/handReorder';
import { EKCardView } from './EKCardView';

interface EKTableViewProps {
  gameState: MaskedEKGameState;
  myPlayerId: string;
  seeFutureCards: EKCard[] | null;
  onCloseSeeFuture: () => void;
  alterFutureCards?: EKCard[] | null;
  onCloseAlterFuture?: () => void;
  onSendAction: (action: any) => void;
}

const isCatCard = (type: string): boolean => {
  return type.endsWith('_cat') || type === 'cattermelon' || type === 'feral_cat';
};

export const ExplodingKittensTableView: React.FC<EKTableViewProps> = ({
  gameState,
  myPlayerId,
  seeFutureCards,
  onCloseSeeFuture,
  alterFutureCards,
  onCloseAlterFuture,
  onSendAction
}) => {
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [targetModalType, setTargetModalType] = useState<'favor' | 'cat_pair' | 'targeted_attack' | 'curse_of_cat_butt' | 'ill_take_that' | null>(null);
  const [pendingCardForAction, setPendingCardForAction] = useState<EKCard | null>(null);
  const [defuseInsertion, setDefuseInsertion] = useState<'top' | 'bottom' | 'random'>('top');
  const [isDraggingCard, setIsDraggingCard] = useState<boolean>(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [orderedHand, setOrderedHand] = useState<EKCard[]>(gameState.myHand);
  const handContainerRef = useRef<HTMLDivElement>(null);
  const [slidingPlayedCard, setSlidingPlayedCard] = useState<{
    card: EKCard;
    startX: number;
    startY: number;
  } | null>(null);
  const [displayedDiscardPile, setDisplayedDiscardPile] = useState<EKCard[]>(gameState.discardPile);
  const [reorderingCards, setReorderingCards] = useState<EKCard[]>([]);

  useEffect(() => {
    setOrderedHand(prev => syncHandOrder(prev, gameState.myHand));
  }, [gameState.myHand]);

  const prevDiscardLenRef = useRef<number>(gameState.discardPile.length);
  const ekUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (alterFutureCards && alterFutureCards.length > 0) {
      setReorderingCards([...alterFutureCards]);
    } else {
      setReorderingCards([]);
    }
  }, [alterFutureCards]);

  useEffect(() => {
    const newDiscard = gameState.discardPile;
    if (newDiscard.length !== prevDiscardLenRef.current) {
      const isPlayedByMe = (gameState as any).lastPlayedBy === myPlayerId;
      prevDiscardLenRef.current = newDiscard.length;

      if (isPlayedByMe || prevDiscardLenRef.current === 0) {
        setDisplayedDiscardPile(newDiscard);
      } else {
        if (ekUpdateTimerRef.current) clearTimeout(ekUpdateTimerRef.current);
        ekUpdateTimerRef.current = setTimeout(() => {
          setDisplayedDiscardPile(newDiscard);
        }, 300);
      }
    } else {
      setDisplayedDiscardPile(newDiscard);
    }

    return () => {
      if (ekUpdateTimerRef.current) clearTimeout(ekUpdateTimerRef.current);
    };
  }, [gameState.discardPile, (gameState as any).lastPlayedBy, myPlayerId]);

  const isMyTurn = gameState.players[gameState.currentTurnIndex]?.id === myPlayerId;
  const isDefusing = gameState.pendingDefusal?.playerId === myPlayerId;

  useEffect(() => {
    if (isDefusing) {
      sounds.playExplosion();
    }
  }, [isDefusing]);
  const isTargetOfFavor = gameState.pendingFavor?.fromPlayerId === myPlayerId;
  const hasNope = gameState.myHand.some(c => c.type === 'nope');
  const myDefuse = gameState.myHand.find(c => c.type === 'defuse');
  const totalCards = orderedHand.length;
  const hasDrawFromBottomInHand = gameState.myHand.some(c => c.type === 'draw_from_bottom');

  // Count cards by cat type to identify available pairs
  const catCounts = gameState.myHand.reduce((acc, c) => {
    if (isCatCard(c.type)) {
      acc[c.type] = (acc[c.type] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const feralCount = catCounts['feral_cat'] || 0;

  const triggerPlayAnimation = (card: EKCard, index: number) => {
    const startX = (index - (totalCards - 1) / 2) * 28;
    const startY = 220;
    setSlidingPlayedCard({ card, startX, startY });
    sounds.playCardWhoosh();
    setTimeout(() => {
      sounds.playCardSnap();
    }, 240);
    setTimeout(() => {
      setSlidingPlayedCard(null);
    }, 420);
  };

  const handleCardClick = (card: EKCard, index?: number) => {
    const idx = index !== undefined ? index : gameState.myHand.findIndex(c => c.id === card.id);

    // During an active Nope window, ONLY 'nope' cards are permitted for ANY player
    if (gameState.pendingAction) {
      if (card.type === 'nope') {
        triggerPlayAnimation(card, idx);
        onSendAction({ type: 'PLAY_NOPE', cardId: card.id });
      }
      return;
    }

    // If not player's turn, cannot play anything
    if (!isMyTurn) {
      return;
    }

    // Special cards that cannot be played directly
    if (card.type === 'defuse' || card.type === 'exploding_kitten' || card.type === 'imploding_kitten' || card.type === 'streaking_kitten') {
      return;
    }

    // 1. Cat combos (including feral cat and cattermelon)
    if (isCatCard(card.type)) {
      if (card.type === 'feral_cat') {
        // Feral cat can pair with any other cat card in hand
        const otherCat = gameState.myHand.find(c => c.id !== card.id && isCatCard(c.type));
        if (otherCat) {
          setSelectedCards([card.id, otherCat.id]);
          setPendingCardForAction(card);
          setTargetModalType('cat_pair');
          sounds.playCardWhoosh();
          return;
        }
      } else {
        const matchingRegularCats = gameState.myHand.filter(c => c.type === card.type);
        if (matchingRegularCats.length >= 2) {
          setSelectedCards([matchingRegularCats[0].id, matchingRegularCats[1].id]);
          setPendingCardForAction(card);
          setTargetModalType('cat_pair');
          sounds.playCardWhoosh();
          return;
        }
        // Check if player has a feral cat to form a pair
        const feralCat = gameState.myHand.find(c => c.type === 'feral_cat');
        if (feralCat) {
          setSelectedCards([card.id, feralCat.id]);
          setPendingCardForAction(card);
          setTargetModalType('cat_pair');
          sounds.playCardWhoosh();
          return;
        }
      }

      // If single cat card without match
      sounds.playCardSnap();
      if (selectedCards.includes(card.id)) {
        setSelectedCards(selectedCards.filter(id => id !== card.id));
      } else {
        setSelectedCards([card.id]);
      }
      return;
    }

    // 2. Targeted actions (require selecting an opponent)
    if (card.type === 'favor' || card.type === 'targeted_attack' || card.type === 'curse_of_cat_butt' || card.type === 'ill_take_that') {
      setPendingCardForAction(card);
      setTargetModalType(card.type as any);
      return;
    }

    // 3. Draw from bottom
    if (card.type === 'draw_from_bottom') {
      triggerPlayAnimation(card, idx);
      onSendAction({ type: 'DRAW_FROM_BOTTOM' });
      return;
    }

    // 4. Bury card
    if (card.type === 'bury') {
      triggerPlayAnimation(card, idx);
      onSendAction({ type: 'BURY_CARD', cardId: card.id, targetIndex: Math.floor(gameState.drawPileCount / 2) });
      return;
    }

    // 5. Direct Action cards
    const directActionCards = [
      'attack',
      'skip',
      'shuffle',
      'see_the_future',
      'reverse',
      'super_skip',
      'see_the_future_5x',
      'alter_the_future_3x',
      'alter_the_future_5x',
      'swap_top_and_bottom',
      'catomic_bomb',
      'personal_attack',
      'share_the_future',
      'barking_kitten'
    ];

    if (directActionCards.includes(card.type)) {
      triggerPlayAnimation(card, idx);
      onSendAction({ type: 'PLAY_ACTION', cardId: card.id });
      return;
    }

    if (card.type === 'nope') {
      triggerPlayAnimation(card, idx);
      onSendAction({ type: 'PLAY_NOPE', cardId: card.id });
      return;
    }
  };

  const handleSelectOpponent = (targetPlayerId: string) => {
    if (targetModalType === 'cat_pair') {
      let pairToPlay = selectedCards;
      if (pairToPlay.length < 2 && pendingCardForAction) {
        const matches = gameState.myHand.filter(c => c.type === pendingCardForAction.type || c.type === 'feral_cat');
        if (matches.length >= 2) {
          pairToPlay = [matches[0].id, matches[1].id];
        }
      }

      if (pairToPlay.length >= 2) {
        sounds.playCardWhoosh();
        onSendAction({
          type: 'PLAY_CAT_COMBO',
          cardIds: pairToPlay.slice(0, 2),
          targetPlayerId
        });
      }
    } else if (pendingCardForAction) {
      sounds.playCardWhoosh();
      onSendAction({
        type: 'PLAY_ACTION',
        cardId: pendingCardForAction.id,
        targetPlayerId
      });
    }

    setSelectedCards([]);
    setPendingCardForAction(null);
    setTargetModalType(null);
  };

  const handleConfirmDefuse = () => {
    const isImploding = gameState.pendingDefusal?.kittenCard.type === 'imploding_kitten';
    if (!isImploding && !myDefuse) return;
    sounds.playCardWhoosh();
    onSendAction({
      type: 'RESOLVE_DEFUSE',
      cardId: myDefuse ? myDefuse.id : 'imploding',
      insertionMode: defuseInsertion
    });
  };

  const handleGiveFavor = (card: EKCard) => {
    sounds.playCardWhoosh();
    onSendAction({
      type: 'GIVE_FAVOR_CARD',
      cardId: card.id
    });
  };

  const moveCardInAlterFuture = (index: number, direction: 'left' | 'right') => {
    const newCards = [...reorderingCards];
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newCards.length) return;
    const temp = newCards[index];
    newCards[index] = newCards[targetIdx];
    newCards[targetIdx] = temp;
    setReorderingCards(newCards);
    sounds.playCardSnap();
  };

  const handleConfirmAlterFuture = () => {
    sounds.playCardWhoosh();
    onSendAction({
      type: 'ALTER_FUTURE_REORDER',
      cards: reorderingCards
    });
    if (onCloseAlterFuture) onCloseAlterFuture();
  };

  const getTargetModalTitle = () => {
    switch (targetModalType) {
      case 'favor':
        return { title: 'Xin Xỏ: Chọn Người Chơi', desc: 'Chọn 1 người chơi phải giao nộp cho bạn 1 lá bài:' };
      case 'targeted_attack':
        return { title: 'Tấn Công Mục Tiêu: Chọn Đối Thủ', desc: 'Chọn 1 người chơi bị ép phải đánh 2 lượt liên tiếp:' };
      case 'curse_of_cat_butt':
        return { title: 'Lời Nguyền Đít Mèo: Chọn Nạn Nhân', desc: 'Chọn 1 người chơi bị mù (toàn bộ bài trên tay bị úp mặt):' };
      case 'ill_take_that':
        return { title: 'Cái Đó Của Tôi: Chọn Đối Thủ Bẫy', desc: 'Chọn 1 người chơi mà bạn sẽ cướp lấy lá bài đầu tiên họ rút:' };
      case 'cat_pair':
      default:
        return { title: 'Cướp Bài: Chọn Đối Thủ', desc: 'Cướp ngẫu nhiên 1 lá bài từ đối thủ:' };
    }
  };

  return (
    <div className="absolute inset-0 select-none pointer-events-none">
      {/* Curse of Cat Butt Alert Banner */}
      {gameState.curseActive && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-stone-900/95 border-2 border-amber-600/80 text-amber-200 text-xs font-black shadow-2xl flex items-center gap-2 animate-bounce pointer-events-auto">
          <span>💩</span>
          <span>BẠN ĐANG BỊ DÍNH LỜI NGUYỀN ĐÍT MÈO! Toàn bộ bài đang bị úp mặt cho đến khi bạn rút 1 lá bài an toàn!</span>
        </div>
      )}

      {/* Table Center Playing Zone */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        {/* Draw & Discard Piles */}
        <div className="flex items-center gap-8 z-10 pointer-events-auto">
          {/* Draw Pile */}
          <div className="flex flex-col items-center relative">
            <button
              onClick={() => {
                sounds.playCardSnap();
                onSendAction({ type: 'DRAW_CARD' });
              }}
              disabled={!isMyTurn || !!gameState.pendingAction || !!gameState.pendingDefusal}
              className={`relative group transition-transform ${
                isMyTurn ? 'hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-rose-500/40 rounded-2xl' : 'opacity-85'
              }`}
            >
              {/* Stack depth visual */}
              <div className="absolute -top-1.5 -left-1.5 w-full h-full rounded-2xl bg-black/80 border border-red-800/60 -z-10" />
              <div className="absolute -top-3 -left-3 w-full h-full rounded-2xl bg-black/60 border border-red-900/40 -z-20" />

              {/* Render face-up Imploding Kitten if top card is face-up */}
              {gameState.topDrawCardIsFaceUp ? (
                <EKCardView
                  card={{
                    id: 'faceup-top-card',
                    type: 'imploding_kitten',
                    name: 'Mèo Phát Nổ',
                    description: 'Ngửa mặt! Rút là chết ngay!',
                    isFaceUp: true
                  }}
                  className="!w-24 sm:!w-28 !h-36 sm:!h-40"
                />
              ) : (
                <EKCardView isBack={true} className="!w-24 sm:!w-28 !h-36 sm:!h-40" />
              )}

              {/* Hazard Warning if top card is Imploding */}
              {gameState.topDrawCardIsFaceUp && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-purple-950 text-[9px] font-black text-purple-200 border border-purple-400 shadow-lg animate-bounce whitespace-nowrap z-20">
                  ☣️ ĐỈNH BÀI: PHÁT NỔ!
                </span>
              )}

              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-slate-900 text-[10px] font-mono font-bold text-amber-300 border border-slate-700 shadow">
                Còn {gameState.drawPileCount} lá
              </span>
            </button>

            {/* Quick Draw From Bottom Action Button */}
            {isMyTurn && hasDrawFromBottomInHand && !gameState.pendingAction && !gameState.pendingDefusal && (
              <button
                onClick={() => {
                  sounds.playCardWhoosh();
                  onSendAction({ type: 'DRAW_FROM_BOTTOM' });
                }}
                className="mt-5 px-3 py-1 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-black shadow-lg flex items-center gap-1 cursor-pointer transition-transform hover:scale-105"
              >
                <span>⏬</span>
                <span>Rút Bài Dưới Đáy</span>
              </button>
            )}
          </div>

          {/* Discard Pile / Drop Zone */}
          <div
            id="ek-drop-zone"
            className={`flex flex-col items-center p-2 rounded-3xl transition-all duration-200 ${
              isDraggingCard ? 'ring-4 ring-rose-400 bg-rose-500/20 scale-105' : ''
            }`}
          >
            {displayedDiscardPile.length > 0 ? (
              <div className="relative">
                {displayedDiscardPile.length > 1 && (
                  <div className="absolute inset-0 transform rotate-6 translate-x-1 opacity-60 pointer-events-none">
                    <EKCardView
                      card={displayedDiscardPile[displayedDiscardPile.length - 2]}
                      className="!w-24 sm:!w-28 !h-36 sm:!h-40 shadow-md"
                    />
                  </div>
                )}
                <motion.div
                  id="ek-top-card"
                  key={displayedDiscardPile[displayedDiscardPile.length - 1].id}
                  initial={{ scale: 0.9, rotate: 6, opacity: 0.8 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                  className="relative z-10"
                >
                  <EKCardView
                    card={displayedDiscardPile[displayedDiscardPile.length - 1]}
                    className="!w-24 sm:!w-28 !h-36 sm:!h-40 shadow-2xl"
                  />
                </motion.div>
              </div>
            ) : (
              <div className="w-24 sm:w-28 h-36 sm:h-40 rounded-2xl border-2 border-dashed border-red-900/40 bg-slate-950/40 flex items-center justify-center text-slate-600 text-xs font-black">
                Chồng Bài Bỏ
              </div>
            )}

            {/* In-Flight Sliding Card to Discard Pile */}
            <AnimatePresence>
              {slidingPlayedCard && (
                <motion.div
                  key="sliding-ek-card"
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
                    rotate: [0, 8, 0],
                    opacity: 1
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
                  className="absolute z-30 pointer-events-none"
                >
                  <EKCardView
                    card={slidingPlayedCard.card}
                    className="!w-24 sm:!w-28 !h-36 sm:!h-40 shadow-[0_25px_50px_rgba(0,0,0,0.8)]"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Drag Over Drop Zone Prompt */}
        <AnimatePresence>
          {isDraggingCard && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-10 px-4 py-1.5 rounded-full bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5 pointer-events-none"
            >
              <span>Thả vào chồng bài để đánh</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending Turns Indicator */}
        {gameState.pendingTurns > 1 && (
          <div className="absolute top-8 px-4 py-1.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black flex items-center gap-2 shadow pointer-events-none">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>LƯỢT PHẢI ĐÁNH: {gameState.pendingTurns}</span>
          </div>
        )}
      </div>

      {/* 3-Second NOPE Notification in the Corner (Just like Uno Catch Notification) */}
      {gameState.pendingAction && (() => {
        const initiator = gameState.players.find(p => p.id === gameState.pendingAction?.initiatorId);
        const cardName = gameState.pendingAction.card.name;
        const isNoped = gameState.pendingAction.nopeCount % 2 === 1;

        return (
          <div className="absolute right-6 top-8 flex flex-col items-end gap-2 z-40 pointer-events-auto max-w-xs sm:max-w-sm">
            {/* Quick Nope Button if player holds a Nope card */}
            {hasNope && (
              <button
                onClick={() => {
                  const nopeCard = gameState.myHand.find(c => c.type === 'nope');
                  if (nopeCard) {
                    sounds.playNopeSlam();
                    onSendAction({ type: 'PLAY_NOPE', cardId: nopeCard.id });
                  }
                }}
                className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-2xl border-2 border-rose-400 animate-bounce cursor-pointer transition-all active:scale-95"
                title="Nhấn để đánh thẻ Nope chặn ngay lập tức!"
              >
                <XCircle className="w-5 h-5 text-amber-300" />
                <span>{isNoped ? '🚫 HỦY CHẶN (NOPE LẠI)!' : `🚫 CHẶN NOPE: ${cardName}!`}</span>
              </button>
            )}

            {/* Corner Status Badge */}
            <div className="px-3.5 py-2 rounded-2xl bg-slate-900/95 border border-rose-500/50 text-xs shadow-2xl backdrop-blur-md flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <div className="flex flex-col text-right">
                <span className="text-[11px] font-bold text-slate-300">
                  {initiator?.name || 'Đối thủ'} đánh: <strong className="text-white">{cardName}</strong>
                </span>
                <span className={`text-[10px] font-extrabold ${isNoped ? 'text-rose-400' : 'text-amber-400'}`}>
                  {isNoped ? '🚫 Đã bị chặn Nope!' : '⚡ Đang kích hoạt (Chờ Nope)...'}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 10-Second Defusal Emergency Modal (Exploding or Imploding Face-Down) */}
      {isDefusing && (
        <div className="fixed inset-0 z-50 bg-rose-950/85 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 animate-bounce">
              <AlertTriangle className="w-8 h-8" />
            </div>

            {gameState.pendingDefusal?.kittenCard.type === 'imploding_kitten' ? (
              <>
                <h2 className="text-2xl font-black text-purple-400 mb-1">BẠN ĐÃ RÚT MÈO PHÁT NỔ (ÚP MẶT)!</h2>
                <p className="text-xs text-slate-300 mb-6">
                  Lá bài này không làm bạn nổ ngay lúc này. Bạn phải lật ngửa nó và chọn vị trí để nhét lại vào bộ bài rút!
                </p>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'top', label: 'Đầu bộ bài (Rút là nổ!)' },
                      { id: 'bottom', label: 'Đáy bộ bài' },
                      { id: 'random', label: 'Ngẫu nhiên' }
                    ].map(pos => (
                      <button
                        key={pos.id}
                        onClick={() => setDefuseInsertion(pos.id as any)}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          defuseInsertion === pos.id
                            ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleConfirmDefuse}
                    className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm shadow-xl shadow-purple-600/30 transition-all uppercase tracking-wider cursor-pointer"
                  >
                    ☢️ Nhét Mèo Phát Nổ Ngửa Mặt Vào Bộ Bài
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-black text-rose-400 mb-1">BẠN ĐÃ RÚT PHẢI MÈO NỔ!</h2>
                <p className="text-xs text-slate-300 mb-6">
                  {myDefuse ? 'Bạn có thẻ Gỡ Bom! Hãy chọn vị trí để nhét lá Mèo Nổ trở lại vào bộ bài:' : 'Bạn không có thẻ Gỡ Bom! Chuẩn bị nổ tung...'}
                </p>

                {myDefuse ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'top', label: 'Đầu bộ bài' },
                        { id: 'bottom', label: 'Đáy bộ bài' },
                        { id: 'random', label: 'Ngẫu nhiên' }
                      ].map(pos => (
                        <button
                          key={pos.id}
                          onClick={() => setDefuseInsertion(pos.id as any)}
                          className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            defuseInsertion === pos.id
                              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                              : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleConfirmDefuse}
                      className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-600/30 transition-all uppercase tracking-wider cursor-pointer"
                    >
                      🛠️ Đánh Thẻ Gỡ Bom &amp; Tự Cứu Mình
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 py-2">
                    <div className="text-4xl animate-bounce">💥</div>
                    <p className="text-sm font-black text-rose-300">BẠN KHÔNG CÓ THẺ GỠ BOM!</p>
                    <p className="text-xs text-rose-400/80 animate-pulse">Đang phát nổ và rời trận đấu trong 2 giây...</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* "See The Future" Modal (3X or 5X) */}
      {seeFutureCards && (
        <div
          onClick={onCloseSeeFuture}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-slate-900 border border-fuchsia-500/40 rounded-3xl p-6 max-w-2xl w-full text-center shadow-2xl"
          >
            <button
              onClick={onCloseSeeFuture}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-base font-bold w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
            >
              ✕
            </button>
            <h3 className="text-lg font-black text-fuchsia-400 mb-2 flex items-center justify-center gap-2">
              <Eye className="w-5 h-5" />
              SOI TƯƠNG LAI ({seeFutureCards.length} Lá Trên Cùng)
            </h3>
            <p className="text-xs text-slate-400 mb-6">Đây là {seeFutureCards.length} lá bài tiếp theo trong chồng bài rút (từ trên xuống dưới):</p>

            <div className={`grid ${seeFutureCards.length === 5 ? 'grid-cols-5' : 'grid-cols-3'} gap-2 mb-6`}>
              {seeFutureCards.map((c, i) => (
                <div key={c.id || i} className="flex flex-col items-center">
                  <span className="text-[11px] font-bold text-slate-400 mb-1">#{i + 1} {i === 0 ? '(Trên cùng)' : ''}</span>
                  <EKCardView card={c} className="!w-20 sm:!w-24 !h-30 sm:!h-36 shadow-2xl" />
                </div>
              ))}
            </div>

            <button
              onClick={onCloseSeeFuture}
              className="py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
            >
              Đóng &amp; Giữ Bí Mật
            </button>
          </div>
        </div>
      )}

      {/* "Alter The Future" Interactive Reorder Modal */}
      {alterFutureCards && reorderingCards.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto">
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-slate-900 border-2 border-violet-500/60 rounded-3xl p-6 max-w-3xl w-full text-center shadow-2xl"
          >
            <h3 className="text-xl font-black text-violet-400 mb-2 flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-300" />
              SỬA TƯƠNG LAI ({reorderingCards.length} Lá)
            </h3>
            <p className="text-xs text-slate-300 mb-6">
              Dùng các nút mũi tên dưới mỗi lá bài để hoán đổi vị trí theo ý muốn của bạn:
            </p>

            <div className={`grid ${reorderingCards.length === 5 ? 'grid-cols-5' : 'grid-cols-3'} gap-2 sm:gap-4 mb-6`}>
              {reorderingCards.map((c, i) => (
                <div key={c.id || i} className="flex flex-col items-center bg-slate-950/60 p-2 rounded-2xl border border-slate-800">
                  <span className={`text-[11px] font-black mb-1.5 ${i === 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    #{i + 1} {i === 0 ? '(Sẽ rút đầu)' : ''}
                  </span>
                  <EKCardView card={c} className="!w-20 sm:!w-24 !h-30 sm:!h-36 shadow-xl" />

                  {/* Move Left / Right Controls */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      disabled={i === 0}
                      onClick={() => moveCardInAlterFuture(i, 'left')}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white cursor-pointer transition-colors"
                      title="Chuyển sang trái"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={i === reorderingCards.length - 1}
                      onClick={() => moveCardInAlterFuture(i, 'right')}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white cursor-pointer transition-colors"
                      title="Chuyển sang phải"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleConfirmAlterFuture}
              className="py-3.5 px-8 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-violet-600/30 transition-all uppercase tracking-wider cursor-pointer"
            >
              🌀 Xác Nhận &amp; Đặt Lại Vào Bộ Bài
            </button>
          </div>
        </div>
      )}

      {/* Favor Give Card Modal */}
      {isTargetOfFavor && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-6 max-w-md w-full text-center shadow-2xl">
            <h3 className="text-base font-black text-purple-300 mb-2">BẠN PHẢI GIAO NỘP 1 LÁ BÀI!</h3>
            <p className="text-xs text-slate-400 mb-4">Bấm chọn 1 lá bài trên tay bạn để trao cho đối thủ:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {gameState.myHand.map(c => (
                <div key={c.id} onClick={() => handleGiveFavor(c)} className="cursor-pointer hover:scale-105 transition-transform">
                  <EKCardView card={c} className="!w-20 !h-30" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Target Opponent Picker Modal (Favor / Targeted Attack / Curse / I'll Take That / Cat Combos) */}
      {targetModalType && (
        <div
          onClick={() => {
            setTargetModalType(null);
            setPendingCardForAction(null);
          }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
          >
            <button
              onClick={() => {
                setTargetModalType(null);
                setPendingCardForAction(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-base font-bold w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
            >
              ✕
            </button>
            <h3 className="text-base font-bold text-white mb-1">
              {getTargetModalTitle().title}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {getTargetModalTitle().desc}
            </p>
            <div className="space-y-2">
              {gameState.players
                .filter(p => p.id !== myPlayerId && !p.eliminated)
                .map(p => {
                  const canTarget = targetModalType === 'cat_pair' ? p.cardCount > 0 : true;
                  return (
                    <button
                      key={p.id}
                      onClick={() => canTarget && handleSelectOpponent(p.id)}
                      disabled={!canTarget}
                      className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-xs font-black transition-all ${
                        canTarget
                          ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 cursor-pointer text-white hover:border-purple-500 shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>👤</span>
                        <span>{p.name}</span>
                      </span>
                      <span className={canTarget ? 'text-amber-300 font-bold' : 'text-slate-500'}>
                        {p.cardCount > 0 ? `${p.cardCount} lá` : 'Hết bài'}
                      </span>
                    </button>
                  );
                })}
            </div>
            <button
              onClick={() => {
                setTargetModalType(null);
                setPendingCardForAction(null);
              }}
              className="mt-4 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white rounded-xl cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* PLAYER'S HAND CARDS: ANCHORED AT THE BOTTOM */}
      <div className="absolute bottom-1 sm:bottom-2 left-0 right-0 flex flex-col items-center z-30 pointer-events-none">
        {/* Cat Combo Pair Quick Action Bar */}
        {selectedCards.length === 2 && !targetModalType && (
          <div className="mb-2 flex items-center gap-2 pointer-events-auto animate-bounce">
            <button
              onClick={() => setTargetModalType('cat_pair')}
              className="px-4 py-2 rounded-full bg-ps-blue hover:bg-ps-blue-hover text-white font-semibold text-xs shadow-ps-glow flex items-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              <span>🐱🐾</span>
              <span>CƯỚP BÀI BẰNG CẶP MÈO!</span>
            </button>
            <button
              onClick={() => {
                setSelectedCards([]);
                setPendingCardForAction(null);
              }}
              className="px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-semibold border border-white/15 cursor-pointer"
            >
              Hủy
            </button>
          </div>
        )}

        <div className="mb-1 flex items-center gap-2.5 text-xs font-semibold text-white/70 pointer-events-auto">
          <span>Bài của bạn: <strong className="text-white">{totalCards} lá</strong></span>
          <span className="text-white/40 text-[11px] hidden sm:inline">• Kéo bài ra giữa để đánh, kéo ngang để xếp bài</span>
          
          <button
            onClick={() => {
              sounds.playCardSnap();
              setOrderedHand(prev => sortEKCards(prev));
            }}
            className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white flex items-center gap-1 transition-all cursor-pointer active:scale-95"
            title="Tự động gom nhóm mèo cùng loại, gỡ bom và bài chức năng"
          >
            <span>🐾 Gom bài</span>
          </button>

          {isMyTurn && (
            <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse font-semibold">
              Lượt Của Bạn!
            </span>
          )}
        </div>

        <div className="w-full overflow-visible pb-1 pt-2 flex items-end justify-center min-h-[160px] px-4 pointer-events-auto">
          <div ref={handContainerRef} className={`flex ${totalCards <= 3 ? '-space-x-4 sm:-space-x-5' : totalCards <= 6 ? '-space-x-7 sm:-space-x-8' : totalCards <= 10 ? '-space-x-10 sm:-space-x-11' : '-space-x-13 sm:-space-x-14'}`}>
            {orderedHand.map((card, i) => {
              const isSelected = selectedCards.includes(card.id);
              const fan = calcFanTransform(i, totalCards);
              const isHovered = hoveredCardId === card.id && !isDraggingCard;
              const isCat = isCatCard(card.type);
              const hasPairInHand = isCat && ((catCounts[card.type] || 0) >= 2 || (card.type !== 'feral_cat' && feralCount > 0) || (card.type === 'feral_cat' && totalCards >= 2));

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
                    const canNope = card.type === 'nope' && !!gameState.pendingAction;
                    
                    if (isDroppedInZone(info.point, 'ek-drop-zone')) {
                      // Only allow playing if it's my turn or valid Nope
                      if (!canNope && (!isMyTurn || !!gameState.pendingAction)) return;
                      handleCardClick(card, i);
                      return;
                    }

                    // Card was dropped inside hand area -> check horizontal reorder
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
                    const canNope = card.type === 'nope' && !!gameState.pendingAction;
                    if (!canNope && (!isMyTurn || !!gameState.pendingAction)) return;
                    handleCardClick(card, i);
                  }}
                  style={{ zIndex: isHovered ? 90 : (isSelected ? 50 : fan.zIndex) }}
                  className={`flex-shrink-0 w-24 sm:w-28 h-36 sm:h-40 cursor-grab active:cursor-grabbing select-none relative ${isSelected ? 'ring-4 ring-purple-500 rounded-2xl -translate-y-6 shadow-2xl' : ''}`}
                >
                  <EKCardView card={card} className="w-full h-full" />

                  {/* Pair indicator badge */}
                  {hasPairInHand && !isSelected && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-purple-600 text-white font-black text-[8px] tracking-tight shadow-lg border border-purple-300 whitespace-nowrap z-20 pointer-events-none animate-pulse">
                      CÓ ĐÔI 🐾
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-purple-500 text-white font-black text-[8.5px] tracking-tight shadow-xl border-2 border-white whitespace-nowrap z-20 pointer-events-none">
                      ✓ ĐÃ CHỌN ĐÔI
                    </div>
                  )}
                  {card.type === 'exploding_kitten' && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-red-600 text-white font-black text-[8px] tracking-tight shadow-xl border border-red-300 whitespace-nowrap z-20 pointer-events-none animate-bounce">
                      💣 ÔM BOM AN TOÀN
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
