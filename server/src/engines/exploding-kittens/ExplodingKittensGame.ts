import crypto from 'crypto';
import { BaseGame } from '../BaseGame';
import {
  EKAction,
  EKCard,
  EKExpansions,
  EKPlayer,
  ExplodingKittensCardType,
  ExplodingKittensGameState,
  MaskedEKGameState,
  MaskedEKPlayer,
  PendingAction,
  PendingDefusal,
  PendingFavor
} from './types';

const BASE_CARD_DEFINITIONS: { type: ExplodingKittensCardType; name: string; description: string; count: number }[] = [
  { type: 'attack', name: 'Tấn Công (2X)', description: 'Kết thúc lượt không cần rút bài và ép người kế tiếp đánh 2 lượt.', count: 4 },
  { type: 'skip', name: 'Bỏ Qua', description: 'Kết thúc lượt ngay lập tức mà không cần rút bài.', count: 4 },
  { type: 'favor', name: 'Xin Xỏ', description: 'Ép một người chơi bất kỳ phải nộp cho bạn 1 lá bài họ chọn.', count: 4 },
  { type: 'shuffle', name: 'Xáo Bài', description: 'Xáo trộn lại toàn bộ chồng bài rút một cách ngẫu nhiên.', count: 4 },
  { type: 'see_the_future', name: 'Soi Tương Lai (3X)', description: 'Bí mật xem trước 3 lá bài trên cùng của chồng bài rút.', count: 5 },
  { type: 'nope', name: 'Chặn Nope!', description: 'Chặn đứng tác dụng của thẻ bài bất kỳ. Có thể bị chặn tiếp bởi Nope khác.', count: 5 },
  { type: 'taco_cat', name: 'Mèo Taco', description: 'Đánh cặp mèo giống nhau để cướp ngẫu nhiên 1 lá bài từ đối thủ.', count: 4 },
  { type: 'hairy_potato_cat', name: 'Mèo Khoai Tây', description: 'Đánh cặp mèo giống nhau để cướp ngẫu nhiên 1 lá bài từ đối thủ.', count: 4 },
  { type: 'rainbow_ralphing_cat', name: 'Mèo Cầu Vồng', description: 'Đánh cặp mèo giống nhau để cướp ngẫu nhiên 1 lá bài từ đối thủ.', count: 4 },
  { type: 'beard_cat', name: 'Mèo Râu Xù', description: 'Đánh cặp mèo giống nhau để cướp ngẫu nhiên 1 lá bài từ đối thủ.', count: 4 },
  { type: 'cattermelon', name: 'Mèo Dưa Hấu', description: 'Đánh cặp mèo giống nhau để cướp ngẫu nhiên 1 lá bài từ đối thủ.', count: 4 }
];

const IMPLODING_KITTENS_DEFINITIONS: { type: ExplodingKittensCardType; name: string; description: string; count: number }[] = [
  { type: 'targeted_attack', name: 'Tấn Công Mục Tiêu', description: 'Ép 1 người bạn chọn phải đánh 2 lượt liên tiếp. Kết thúc lượt của bạn.', count: 2 },
  { type: 'reverse', name: 'Đảo Chiều', description: 'Đảo ngược chiều vòng chơi và kết thúc lượt của bạn.', count: 2 },
  { type: 'draw_from_bottom', name: 'Rút Đáy', description: 'Rút 1 lá dưới đáy bộ bài rút và kết thúc lượt ngay lập tức.', count: 3 },
  { type: 'feral_cat', name: 'Mèo Hoang', description: 'Thẻ mèo vạn năng, có thể ghép đôi với bất kỳ lá mèo nào để cướp bài.', count: 4 },
  { type: 'alter_the_future_3x', name: 'Sửa Tương Lai (3X)', description: 'Xem và tự do sắp xếp lại 3 lá bài trên cùng của bộ bài rút.', count: 2 }
];

const STREAKING_KITTENS_DEFINITIONS: { type: ExplodingKittensCardType; name: string; description: string; count: number }[] = [
  { type: 'streaking_kitten', name: 'Mèo Đi Dạo', description: 'Giúp bạn bí mật giữ 1 lá Mèo Nổ trên tay. Kẻ nào cướp phải lá đó sẽ nổ tung!', count: 1 },
  { type: 'super_skip', name: 'Siêu Bỏ Qua', description: 'Kết thúc toàn bộ lượt chơi còn lại của bạn mà không cần rút bài.', count: 2 },
  { type: 'see_the_future_5x', name: 'Soi Tương Lai (5X)', description: 'Bí mật xem trước 5 lá bài trên cùng của bộ bài rút.', count: 2 },
  { type: 'alter_the_future_5x', name: 'Sửa Tương Lai (5X)', description: 'Xem và tự do sắp xếp lại 5 lá bài trên cùng của bộ bài rút.', count: 1 },
  { type: 'swap_top_and_bottom', name: 'Đổi Đỉnh Đáy', description: 'Hoán đổi vị trí lá bài trên cùng và dưới đáy của bộ bài rút.', count: 2 },
  { type: 'catomic_bomb', name: 'Bom Nguyên Tử', description: 'Gom toàn bộ Mèo Nổ, xáo phần còn lại rồi đặt các Mèo Nổ lên trên đỉnh!', count: 1 },
  { type: 'curse_of_cat_butt', name: 'Lời Nguyền Đít Mèo', description: 'Khiến mục tiêu bị mù (toàn bộ bài úp xuống) cho đến khi rút bài an toàn.', count: 1 }
];

const BARKING_KITTENS_DEFINITIONS: { type: ExplodingKittensCardType; name: string; description: string; count: number }[] = [
  { type: 'personal_attack', name: 'Tấn Công Bản Thân (3X)', description: 'Bạn phải tự đánh 3 lượt liên tiếp!', count: 2 },
  { type: 'bury', name: 'Chôn Bài', description: 'Chọn 1 lá trên tay nhét lại vào bộ bài rút và kết thúc lượt không cần rút.', count: 2 },
  { type: 'ill_take_that', name: 'Cái Đó Của Tôi', description: 'Mục tiêu phải nộp ngay lá bài đầu tiên họ rút được cho bạn.', count: 2 },
  { type: 'share_the_future', name: 'Chia Sẻ Tương Lai', description: 'Xem và sắp xếp lại 3 lá trên cùng, sau đó cho người kế tiếp xem.', count: 2 },
  { type: 'barking_kitten', name: 'Mèo Sủa', description: 'Nếu đối thủ có lá Mèo Sủa còn lại, họ phải nộp cho bạn 1 thẻ Gỡ Bom!', count: 2 }
];

export class ExplodingKittensGame extends BaseGame<ExplodingKittensGameState, EKAction, MaskedEKGameState> {
  private drawPile: EKCard[] = [];
  private discardPile: EKCard[] = [];
  private hands: Map<string, EKCard[]> = new Map();

  private nopeTimer: NodeJS.Timeout | null = null;
  private defusalTimer: NodeJS.Timeout | null = null;
  private pendingImplodingPlayerId: string | null = null;
  private pendingImplodingCard: EKCard | null = null;

  constructor(
    players: { id: string; name: string; avatar: string; isBot: boolean }[],
    turnTimeLimit: number = 30,
    expansions?: EKExpansions
  ) {
    const finalTurnLimit = expansions?.timebombMode ? 15 : turnTimeLimit;

    const ekPlayers: EKPlayer[] = players.map(p => ({
      ...p,
      connected: true,
      cardCount: 0,
      defuseCount: 1,
      eliminated: false,
      isExploded: false
    }));

    const initialState: ExplodingKittensGameState = {
      gameType: 'exploding-kittens',
      players: ekPlayers,
      currentTurnIndex: 0,
      direction: 1,
      turnTimeLimit: finalTurnLimit,
      turnStartTime: Date.now(),
      isGameOver: false,
      winners: [],
      logs: [],
      drawPileCount: 0,
      discardPile: [],
      pendingTurnsForCurrentPlayer: 1,
      pendingAction: null,
      pendingDefusal: null,
      pendingFavor: null,
      expansions: expansions || {
        implodingKittens: false,
        streakingKittens: false,
        barkingKittens: false,
        timebombMode: false
      }
    };

    super(initialState);
  }

  public start(): void {
    const playerCount = this.state.players.length;
    this.hands.clear();
    this.discardPile = [];

    // 1. Build starter non-exploding deck based on active expansions
    let generalDeck: EKCard[] = [];
    const activeDefs = [...BASE_CARD_DEFINITIONS];

    if (this.state.expansions?.implodingKittens) {
      activeDefs.push(...IMPLODING_KITTENS_DEFINITIONS);
    }
    if (this.state.expansions?.streakingKittens) {
      activeDefs.push(...STREAKING_KITTENS_DEFINITIONS);
    }
    if (this.state.expansions?.barkingKittens) {
      activeDefs.push(...BARKING_KITTENS_DEFINITIONS);
    }

    for (const def of activeDefs) {
      for (let i = 0; i < def.count; i++) {
        generalDeck.push({
          id: crypto.randomUUID(),
          type: def.type,
          name: def.name,
          description: def.description
        });
      }
    }

    // For larger games (> 5 players), duplicate base cards (Party Pack mechanics) to ensure plenty of cards
    if (playerCount > 5) {
      for (const def of BASE_CARD_DEFINITIONS) {
        for (let i = 0; i < def.count; i++) {
          generalDeck.push({
            id: crypto.randomUUID(),
            type: def.type,
            name: def.name,
            description: def.description
          });
        }
      }
    }

    generalDeck = BaseGame.shuffleDeck(generalDeck);

    // 2. Deal 1 Defuse and 4 cards to each player (total 5 cards each)
    for (const player of this.state.players) {
      const playerHand: EKCard[] = [
        {
          id: crypto.randomUUID(),
          type: 'defuse',
          name: 'Gỡ Bom',
          description: 'Tự cứu mình khỏi bị nổ tung. Bí mật nhét lại lá Mèo Nổ vào bộ bài.'
        },
        ...generalDeck.splice(0, 4)
      ];
      this.hands.set(player.id, playerHand);
      player.cardCount = playerHand.length;
      player.defuseCount = 1;
      player.eliminated = false;
      player.isExploded = false;
      player.isBlinded = false;
    }

    // 3. Add remaining Defuses (In >5 players, ensure at least 2 extra defuses in the draw pile)
    const extraDefuses = playerCount > 5 ? Math.max(2, 10 - playerCount) : Math.max(0, 6 - playerCount);
    for (let i = 0; i < extraDefuses; i++) {
      generalDeck.push({
        id: crypto.randomUUID(),
        type: 'defuse',
        name: 'Gỡ Bom',
        description: 'Tự cứu mình khỏi bị nổ tung. Bí mật nhét lại lá Mèo Nổ vào bộ bài.'
      });
    }

    // 4. Add Exploding Kittens
    // If Streaking Kittens expansion active, deck gets playerCount bombs (1 extra bomb)
    const kittenCount = this.state.expansions?.streakingKittens ? playerCount : Math.max(1, playerCount - 1);
    for (let i = 0; i < kittenCount; i++) {
      generalDeck.push({
        id: crypto.randomUUID(),
        type: 'exploding_kitten',
        name: 'Mèo Nổ',
        description: 'Rút phải lá này nếu không có thẻ Gỡ Bom, bạn sẽ bị nổ tung và thua cuộc!'
      });
    }

    // 5. Add Imploding Kitten (face-down) if expansion enabled
    if (this.state.expansions?.implodingKittens) {
      generalDeck.push({
        id: crypto.randomUUID(),
        type: 'imploding_kitten',
        name: 'Mèo Phát Nổ',
        description: 'Rút lần 1: Nhét ngửa mặt lại vào bộ bài. Rút lần 2: Nổ tung ngay lập tức!',
        isFaceUp: false
      });
    }

    // 6. Final deck shuffle
    this.drawPile = BaseGame.shuffleDeck(generalDeck);
    this.state.drawPileCount = this.drawPile.length;
    this.state.discardPile = [];
    this.state.currentTurnIndex = 0;
    this.state.direction = 1;
    this.state.pendingTurnsForCurrentPlayer = 1;
    this.state.pendingAction = null;
    this.state.pendingDefusal = null;
    this.state.pendingFavor = null;
    this.state.isGameOver = false;

    const activeExpansionsList: string[] = [];
    if (this.state.expansions?.implodingKittens) activeExpansionsList.push('Imploding Kittens');
    if (this.state.expansions?.streakingKittens) activeExpansionsList.push('Streaking Kittens');
    if (this.state.expansions?.barkingKittens) activeExpansionsList.push('Barking Kittens');
    if (this.state.expansions?.timebombMode) activeExpansionsList.push('Timebomb 15s');

    const expText = activeExpansionsList.length > 0 ? ` [Bản Mở Rộng: ${activeExpansionsList.join(', ')}]` : '';
    this.addLog(`Exploding Kittens bắt đầu với ${playerCount} người chơi! ${kittenCount} Mèo Nổ trong bộ bài.${expText}`, 'info');
    this.resetTurnTimer();
    this.emitStateChange();
  }

  public handleAction(playerId: string, action: EKAction): { success: boolean; message?: string } {
    if (this.state.isGameOver) return { success: false, message: 'Game is over.' };

    const playerIndex = this.state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return { success: false, message: 'Player not found.' };
    const player = this.state.players[playerIndex];
    if (player.eliminated) return { success: false, message: 'Player is eliminated.' };

    // 1. NOPE can be played anytime during a pendingAction window
    if (action.type === 'PLAY_NOPE') {
      return this.handlePlayNope(playerId, action.cardId);
    }

    // 2. FAVOR response (if pending favor belongs to this player)
    if (action.type === 'GIVE_FAVOR_CARD') {
      return this.handleGiveFavorCard(playerId, action.cardId);
    }

    // 3. DEFUSE response (if player is currently defusing or placing face-down imploding)
    if (action.type === 'RESOLVE_DEFUSE') {
      return this.handleResolveDefuse(playerId, action);
    }

    // 4. Alter Future reorder
    if (action.type === 'ALTER_FUTURE_REORDER') {
      return this.handleAlterFutureReorder(playerId, action.cards);
    }

    // 5. Bury card
    if (action.type === 'BURY_CARD') {
      return this.handleBuryCard(playerId, action.cardId, action.targetIndex);
    }

    // If there is an active Nope window or pending Defusal, block other actions
    if (this.state.pendingAction) {
      return { success: false, message: 'Đang trong thời gian bấm Chặn Nope.' };
    }
    if (this.state.pendingDefusal) {
      return { success: false, message: 'Có người chơi đang trong quá trình gỡ bom!' };
    }
    if (this.state.pendingFavor) {
      return { success: false, message: 'Đang đợi người chơi chọn bài xin xỏ.' };
    }

    // Regular turn actions
    if (this.state.currentTurnIndex !== playerIndex) {
      return { success: false, message: 'Chưa đến lượt của bạn.' };
    }

    switch (action.type) {
      case 'DRAW_CARD':
        return this.handleDrawCard(playerId);
      case 'DRAW_FROM_BOTTOM':
        return this.handleDrawFromBottom(playerId);
      case 'PLAY_ACTION':
        return this.handlePlayActionCard(playerId, action.cardId, action.targetPlayerId);
      case 'PLAY_CAT_COMBO':
        return this.handlePlayCatCombo(playerId, action.cardIds, action.targetPlayerId, action.requestedType);
      default:
        return { success: false, message: 'Unsupported action.' };
    }
  }

  private handlePlayNope(playerId: string, cardId: string): { success: boolean; message?: string } {
    if (!this.state.pendingAction) {
      return { success: false, message: 'Hiện không có hành động nào để Chặn Nope!' };
    }

    const hand = this.hands.get(playerId);
    if (!hand) return { success: false, message: 'Hand not found.' };

    const cardIndex = hand.findIndex(c => c.id === cardId && c.type === 'nope');
    if (cardIndex === -1) {
      return { success: false, message: 'Bạn không có thẻ Chặn Nope.' };
    }

    // Consume Nope card
    const [nopeCard] = hand.splice(cardIndex, 1);
    this.discardPile.push(nopeCard);
    this.state.discardPile = [...this.discardPile];
    this.state.lastPlayedBy = playerId;
    this.state.lastPlayedCard = nopeCard;

    const player = this.state.players.find(p => p.id === playerId)!;
    player.cardCount = hand.length;

    // Increment Nope counter
    this.state.pendingAction.nopeCount++;
    const isNowNoped = this.state.pendingAction.nopeCount % 2 === 1;

    this.addLog(
      `${player.name} vừa tung thẻ CHẶN NOPE! 🚫 (Tổng Nope: ${this.state.pendingAction.nopeCount} -> ${isNowNoped ? 'HÀNH ĐỘNG BỊ HỦY' : 'HÀNH ĐỘNG ĐƯỢC PHỤC HỒI'})`,
      'special',
      playerId
    );

    // Reset reaction timer to give 3 more seconds for counter-nopes
    this.resetNopeTimer(3000);
    this.emitStateChange();
    return { success: true };
  }

  private startPendingAction(action: PendingAction) {
    this.state.pendingAction = action;
    this.resetNopeTimer(3000);
    this.emitStateChange();
  }

  private resetNopeTimer(durationMs: number = 3000) {
    if (this.nopeTimer) {
      clearTimeout(this.nopeTimer);
    }
    this.state.pendingAction!.expiresAt = Date.now() + durationMs;

    this.nopeTimer = setTimeout(() => {
      this.resolvePendingAction();
    }, durationMs);
    if (this.nopeTimer && typeof this.nopeTimer.unref === 'function') {
      this.nopeTimer.unref();
    }
  }

  private resolvePendingAction() {
    if (this.nopeTimer) {
      clearTimeout(this.nopeTimer);
      this.nopeTimer = null;
    }

    const pending = this.state.pendingAction;
    if (!pending) return;

    this.state.pendingAction = null;

    // If odd number of Nopes, the action is cancelled!
    if (pending.nopeCount % 2 === 1) {
      this.addLog(`Lá [${pending.card.name}] đã bị CHẶN NOPE thành công và bị hủy!`, 'warning');
      this.emitStateChange();
      return;
    }

    // Otherwise, action executes!
    this.addLog(`Lá [${pending.card.name}] kích hoạt hiệu ứng!`, 'info');

    if (pending.actionType === 'cat_pair') {
      this.executeCatPair(pending.initiatorId, pending.targetPlayerId!);
    } else if (pending.actionType === 'cat_triple') {
      this.executeCatTriple(pending.initiatorId, pending.targetPlayerId!, pending.requestedCardType);
    } else {
      this.executeCardAction(pending.initiatorId, pending.card.type, pending.targetPlayerId);
    }

    this.emitStateChange();
  }

  private handlePlayActionCard(playerId: string, cardId: string, targetPlayerId?: string): { success: boolean; message?: string } {
    const hand = this.hands.get(playerId)!;
    const cardIndex = hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return { success: false, message: 'Lá bài không có trên tay.' };

    const card = hand[cardIndex];
    if (card.type === 'nope' || card.type === 'defuse' || card.type === 'exploding_kitten' || card.type === 'imploding_kitten' || card.type === 'streaking_kitten') {
      return { success: false, message: 'Lá bài này không thể đánh như một hành động bình thường.' };
    }

    if (card.type.endsWith('_cat') || card.type === 'cattermelon' || card.type === 'feral_cat') {
      return { success: false, message: 'Thẻ mèo phải được đánh theo cặp để cướp bài.' };
    }

    if ((card.type === 'favor' || card.type === 'targeted_attack' || card.type === 'curse_of_cat_butt' || card.type === 'ill_take_that') && !targetPlayerId) {
      return { success: false, message: 'Bạn phải chọn 1 người chơi mục tiêu cho lá bài này.' };
    }

    // Remove card from hand and move to discard
    hand.splice(cardIndex, 1);
    this.discardPile.push(card);
    this.state.discardPile = [...this.discardPile];
    this.state.lastPlayedBy = playerId;
    this.state.lastPlayedCard = card;

    const player = this.state.players.find(p => p.id === playerId)!;
    player.cardCount = hand.length;

    this.addLog(`${player.name} muốn đánh [${card.name}]... (3 giây bấm Nope)`, 'action', playerId);

    // Trigger Nope window
    this.startPendingAction({
      id: crypto.randomUUID(),
      initiatorId: playerId,
      card,
      actionType: 'single_card',
      targetPlayerId,
      nopeCount: 0,
      expiresAt: Date.now() + 3000
    });

    return { success: true };
  }

  private handlePlayCatCombo(
    playerId: string,
    cardIds: string[],
    targetPlayerId: string,
    requestedType?: ExplodingKittensCardType
  ): { success: boolean; message?: string } {
    if (!targetPlayerId || targetPlayerId === playerId) {
      return { success: false, message: 'Vui lòng chọn 1 đối thủ hợp lệ.' };
    }

    const hand = this.hands.get(playerId)!;
    const selectedCards = hand.filter(c => cardIds.includes(c.id));

    if (selectedCards.length !== 2 && selectedCards.length !== 3) {
      return { success: false, message: 'Đánh combo mèo yêu cầu đúng 2 hoặc 3 lá.' };
    }

    // Check validity including feral_cat (wild) and cattermelon
    const isCat = (t: ExplodingKittensCardType) => t.endsWith('_cat') || t === 'cattermelon' || t === 'feral_cat';
    if (!selectedCards.every(c => isCat(c.type))) {
      return { success: false, message: 'Chỉ các thẻ mèo hoặc Mèo Hoang mới có thể ghép combo.' };
    }

    if (selectedCards.length === 2) {
      const nonFeral = selectedCards.filter(c => c.type !== 'feral_cat');
      if (nonFeral.length === 2 && nonFeral[0].type !== nonFeral[1].type) {
        return { success: false, message: 'Hai lá mèo phải cùng loại (hoặc dùng kèm Mèo Hoang).' };
      }
    } else if (selectedCards.length === 3) {
      const nonFeral = selectedCards.filter(c => c.type !== 'feral_cat');
      if (nonFeral.length >= 2 && !nonFeral.every(c => c.type === nonFeral[0].type)) {
        return { success: false, message: 'Bộ 3 mèo phải cùng loại (hoặc dùng kèm Mèo Hoang).' };
      }
    }

    // Remove cards from hand
    for (const card of selectedCards) {
      const idx = hand.findIndex(c => c.id === card.id);
      if (idx !== -1) hand.splice(idx, 1);
      this.discardPile.push(card);
    }
    this.state.discardPile = [...this.discardPile];
    this.state.lastPlayedBy = playerId;
    this.state.lastPlayedCard = selectedCards[0];

    const player = this.state.players.find(p => p.id === playerId)!;
    player.cardCount = hand.length;

    const comboType = selectedCards.length === 2 ? 'cat_pair' : 'cat_triple';
    this.addLog(`${player.name} vừa đánh combo ${selectedCards.map(c => c.name).join(' + ')}! (3 giây bấm Nope)`, 'special', playerId);

    this.startPendingAction({
      id: crypto.randomUUID(),
      initiatorId: playerId,
      card: selectedCards[0],
      actionType: comboType,
      targetPlayerId,
      requestedCardType: requestedType,
      additionalCardIds: cardIds,
      nopeCount: 0,
      expiresAt: Date.now() + 3000
    });

    return { success: true };
  }

  private executeCardAction(playerId: string, cardType: ExplodingKittensCardType, targetPlayerId?: string) {
    const player = this.state.players.find(p => p.id === playerId)!;

    switch (cardType) {
      case 'attack': {
        this.addLog(`${player.name} tấn công! Người kế tiếp phải đánh 2 lượt!`, 'action', playerId);
        this.state.pendingTurnsForCurrentPlayer = 0;
        this.advanceTurn(1, 2);
        break;
      }

      case 'targeted_attack': {
        if (!targetPlayerId) break;
        const target = this.state.players.find(p => p.id === targetPlayerId);
        if (!target) break;

        this.addLog(`${player.name} Tấn Công Mục Tiêu vào ${target.name}! ${target.name} phải đánh 2 lượt!`, 'action', playerId);
        this.state.pendingTurnsForCurrentPlayer = 0;
        const targetIdx = this.state.players.findIndex(p => p.id === targetPlayerId);
        this.state.currentTurnIndex = targetIdx;
        this.state.pendingTurnsForCurrentPlayer = 2;
        this.resetTurnTimer();
        this.emitStateChange();
        break;
      }

      case 'reverse': {
        this.state.direction = (this.state.direction === 1 ? -1 : 1) as (1 | -1);
        this.addLog(`${player.name} đánh lá ĐẢO CHIỀU! Vòng chơi đổi hướng (${this.state.direction === 1 ? 'Thuận' : 'Ngược'}).`, 'action', playerId);
        this.state.pendingTurnsForCurrentPlayer--;
        if (this.state.pendingTurnsForCurrentPlayer <= 0) {
          this.advanceTurn(1, 1);
        } else {
          this.resetTurnTimer();
        }
        break;
      }

      case 'skip': {
        this.addLog(`${player.name} bỏ qua lượt này mà không cần rút bài!`, 'action', playerId);
        this.state.pendingTurnsForCurrentPlayer--;
        if (this.state.pendingTurnsForCurrentPlayer <= 0) {
          this.advanceTurn(1, 1);
        } else {
          this.addLog(`${player.name} còn lại ${this.state.pendingTurnsForCurrentPlayer} lượt phải đánh.`, 'info', playerId);
          this.resetTurnTimer();
        }
        break;
      }

      case 'super_skip': {
        this.addLog(`${player.name} kích hoạt SIÊU BỎ QUA! Kết thúc toàn bộ các lượt phải đánh!`, 'special', playerId);
        this.state.pendingTurnsForCurrentPlayer = 0;
        this.advanceTurn(1, 1);
        break;
      }

      case 'shuffle': {
        this.drawPile = BaseGame.shuffleDeck(this.drawPile);
        this.addLog(`${player.name} đã xáo trộn lại toàn bộ Chồng Bài Rút!`, 'action', playerId);
        break;
      }

      case 'see_the_future': {
        const top3 = this.drawPile.slice(-3).reverse();
        this.emitPrivateMessage(playerId, 'ek_see_future', { cards: top3 });
        this.addLog(`${player.name} đang bí mật soi 3 lá tương lai... 🔮`, 'action', playerId);
        break;
      }

      case 'see_the_future_5x': {
        const top5 = this.drawPile.slice(-5).reverse();
        this.emitPrivateMessage(playerId, 'ek_see_future', { cards: top5 });
        this.addLog(`${player.name} soi thấy trước 5 lá bài tương lai! 🔮✨`, 'action', playerId);
        break;
      }

      case 'alter_the_future_3x': {
        const top3 = this.drawPile.slice(-3).reverse();
        this.emitPrivateMessage(playerId, 'ek_alter_future', { cards: top3 });
        this.addLog(`${player.name} đang xem và sắp xếp lại 3 lá tương lai... 🌀`, 'action', playerId);
        break;
      }

      case 'alter_the_future_5x': {
        const top5 = this.drawPile.slice(-5).reverse();
        this.emitPrivateMessage(playerId, 'ek_alter_future', { cards: top5 });
        this.addLog(`${player.name} đang thao túng sắp xếp lại 5 lá tương lai! 🌀✨`, 'action', playerId);
        break;
      }

      case 'swap_top_and_bottom': {
        if (this.drawPile.length >= 2) {
          const top = this.drawPile.pop()!;
          const bottom = this.drawPile.shift()!;
          this.drawPile.push(bottom);
          this.drawPile.unshift(top);
          this.addLog(`${player.name} đã tráo đổi vị trí giữa đỉnh và đáy của chồng bài! 🔃`, 'action', playerId);
        }
        break;
      }

      case 'draw_from_bottom': {
        this.addLog(`${player.name} rút 1 lá dưới đáy bộ bài!`, 'action', playerId);
        if (this.drawPile.length > 0) {
          const drawn = this.drawPile.shift()!;
          this.processDrawnCard(playerId, drawn, 'dưới đáy');
        }
        break;
      }

      case 'catomic_bomb': {
        // Extract all exploding kittens
        const kittens: EKCard[] = [];
        const nonKittens: EKCard[] = [];
        for (const card of this.drawPile) {
          if (card.type === 'exploding_kitten') {
            kittens.push(card);
          } else {
            nonKittens.push(card);
          }
        }
        const shuffledDeck = BaseGame.shuffleDeck(nonKittens);
        // Kittens go on top of the draw pile (at the end of the array)
        this.drawPile = [...shuffledDeck, ...kittens];
        this.state.drawPileCount = this.drawPile.length;
        this.addLog(`☣️ CATOMIC BOMB! Toàn bộ ${kittens.length} Mèo Nổ đã được gom lên trên cùng của bộ bài!`, 'warning', playerId);
        // Catomic ends turn without drawing
        this.state.pendingTurnsForCurrentPlayer = 0;
        this.advanceTurn(1, 1);
        break;
      }

      case 'curse_of_cat_butt': {
        if (!targetPlayerId) break;
        const target = this.state.players.find(p => p.id === targetPlayerId);
        if (target) {
          target.isBlinded = true;
          this.addLog(`💩 ${player.name} ếm LỜI NGUYỀN ĐÍT MÈO lên ${target.name}! Tất cả bài của ${target.name} bị úp mặt!`, 'warning', playerId);
        }
        break;
      }

      case 'personal_attack': {
        this.state.pendingTurnsForCurrentPlayer = (this.state.pendingTurnsForCurrentPlayer || 1) + 2;
        this.addLog(`${player.name} tự đánh TẤN CÔNG BẢN THÂN! Phải đánh tiếp ${this.state.pendingTurnsForCurrentPlayer} lượt!`, 'special', playerId);
        this.resetTurnTimer();
        break;
      }

      case 'ill_take_that': {
        if (!targetPlayerId) break;
        const target = this.state.players.find(p => p.id === targetPlayerId);
        if (target) {
          target.illTakeThatFromPlayerId = playerId;
          this.addLog(`🫳 ${player.name} đặt bẫy "Cái Đó Của Tôi" lên ${target.name}! Lá bài tiếp theo ${target.name} rút sẽ bị cướp!`, 'action', playerId);
        }
        break;
      }

      case 'share_the_future': {
        const top3 = this.drawPile.slice(-3).reverse();
        this.emitPrivateMessage(playerId, 'ek_alter_future', { cards: top3 });
        const nextPlayer = this.state.players[this.getNextPlayerIndex(1)];
        if (nextPlayer) {
          this.emitPrivateMessage(nextPlayer.id, 'ek_see_future', { cards: top3 });
        }
        this.addLog(`${player.name} chia sẻ tương lai cho ${nextPlayer ? nextPlayer.name : 'người tiếp theo'}! 🤝`, 'action', playerId);
        break;
      }

      case 'barking_kitten': {
        // Find if anyone else holds a barking_kitten
        let partnerId: string | null = null;
        for (const [pId, pHand] of this.hands.entries()) {
          if (pId !== playerId && pHand.some(c => c.type === 'barking_kitten')) {
            partnerId = pId;
            break;
          }
        }
        if (partnerId) {
          const partner = this.state.players.find(p => p.id === partnerId)!;
          const partnerHand = this.hands.get(partnerId)!;
          const bIdx = partnerHand.findIndex(c => c.type === 'barking_kitten');
          if (bIdx !== -1) {
            const [bCard] = partnerHand.splice(bIdx, 1);
            this.discardPile.push(bCard);
            partner.cardCount = partnerHand.length;
          }
          this.addLog(`🐶 GÂU GÂU! ${partner.name} cũng giữ Mèo Sủa và bị lộ diện! Phải nộp 1 thẻ Gỡ Bom cho ${player.name}!`, 'special');

          // Partner gives defuse to player if they have one
          const defIdx = partnerHand.findIndex(c => c.type === 'defuse');
          if (defIdx !== -1) {
            const [givenDefuse] = partnerHand.splice(defIdx, 1);
            const playerHand = this.hands.get(playerId)!;
            playerHand.push(givenDefuse);
            partner.cardCount = partnerHand.length;
            partner.defuseCount = partnerHand.filter(c => c.type === 'defuse').length;
            player.cardCount = playerHand.length;
            player.defuseCount = playerHand.filter(c => c.type === 'defuse').length;
            this.addLog(`${partner.name} đã phải nộp thẻ Gỡ Bom cho ${player.name}!`, 'action');
          } else {
            this.addLog(`${partner.name} không có thẻ Gỡ Bom nào để nộp!`, 'info');
          }
        } else {
          this.addLog(`🐶 ${player.name} vừa đánh Mèo Sủa nhưng chưa có ai giữ lá Mèo Sủa còn lại!`, 'info');
        }
        break;
      }

      case 'favor': {
        if (!targetPlayerId) break;
        const target = this.state.players.find(p => p.id === targetPlayerId);
        if (!target) break;

        this.state.pendingFavor = {
          fromPlayerId: targetPlayerId,
          toPlayerId: playerId
        };
        this.addLog(`${player.name} dùng lá XIN XỎ đối với ${target.name}!`, 'action', playerId);
        break;
      }
    }
  }

  private handleAlterFutureReorder(playerId: string, reorderedCards: EKCard[]): { success: boolean; message?: string } {
    if (!reorderedCards || reorderedCards.length === 0) return { success: false, message: 'Invalid reorder data.' };

    const count = reorderedCards.length;
    // Replace the top 'count' cards of drawPile with reorderedCards
    // In drawPile, top is at the end: drawPile[drawPile.length - 1] is top (index 0 of reorderedCards)
    this.drawPile.splice(this.drawPile.length - count, count, ...[...reorderedCards].reverse());
    this.state.drawPileCount = this.drawPile.length;

    const player = this.state.players.find(p => p.id === playerId);
    const pName = player ? player.name : 'Người chơi';
    this.addLog(`${pName} đã sắp xếp lại các lá bài tương lai trong bí mật! 🔮`, 'action', playerId);
    this.emitStateChange();
    return { success: true };
  }

  private handleBuryCard(playerId: string, cardId: string, targetIndex: number): { success: boolean; message?: string } {
    const hand = this.hands.get(playerId);
    if (!hand) return { success: false, message: 'Hand not found.' };

    const idx = hand.findIndex(c => c.id === cardId);
    if (idx === -1) return { success: false, message: 'Card not in hand.' };

    const [buried] = hand.splice(idx, 1);
    const player = this.state.players.find(p => p.id === playerId)!;
    player.cardCount = hand.length;

    const clampedIdx = Math.max(0, Math.min(this.drawPile.length, targetIndex));
    this.drawPile.splice(clampedIdx, 0, buried);
    this.state.drawPileCount = this.drawPile.length;

    this.addLog(`${player.name} đã chôn một lá bài vào chồng bài rút và kết thúc lượt! 🕳️`, 'action', playerId);

    this.state.pendingTurnsForCurrentPlayer--;
    if (this.state.pendingTurnsForCurrentPlayer <= 0) {
      this.advanceTurn(1, 1);
    } else {
      this.resetTurnTimer();
      this.emitStateChange();
    }
    return { success: true };
  }

  private executeCatPair(initiatorId: string, targetId: string) {
    const initiator = this.state.players.find(p => p.id === initiatorId)!;
    const target = this.state.players.find(p => p.id === targetId)!;
    const targetHand = this.hands.get(targetId);
    const initiatorHand = this.hands.get(initiatorId)!;

    if (!targetHand || targetHand.length === 0) {
      this.addLog(`${target.name} không còn lá bài nào để cướp!`, 'warning');
      return;
    }

    // Steal random card
    const randIdx = crypto.randomInt(0, targetHand.length);
    const [stolen] = targetHand.splice(randIdx, 1);
    initiatorHand.push(stolen);

    initiator.cardCount = initiatorHand.length;
    target.cardCount = targetHand.length;
    initiator.defuseCount = initiatorHand.filter(c => c.type === 'defuse').length;
    target.defuseCount = targetHand.filter(c => c.type === 'defuse').length;

    this.addLog(`${initiator.name} đã cướp ngẫu nhiên 1 lá bài từ ${target.name}!`, 'special', initiatorId);

    // Streaking Kitten bomb-holding rule checks
    this.checkBombTheft(initiatorId, targetId, stolen);
  }

  private executeCatTriple(initiatorId: string, targetId: string, requestedType?: ExplodingKittensCardType) {
    const initiator = this.state.players.find(p => p.id === initiatorId)!;
    const target = this.state.players.find(p => p.id === targetId)!;
    const targetHand = this.hands.get(targetId);
    const initiatorHand = this.hands.get(initiatorId)!;

    if (!targetHand || !requestedType) return;

    const matchIdx = targetHand.findIndex(c => c.type === requestedType);
    if (matchIdx !== -1) {
      const [stolen] = targetHand.splice(matchIdx, 1);
      initiatorHand.push(stolen);

      initiator.cardCount = initiatorHand.length;
      target.cardCount = targetHand.length;
      initiator.defuseCount = initiatorHand.filter(c => c.type === 'defuse').length;
      target.defuseCount = targetHand.filter(c => c.type === 'defuse').length;

      this.addLog(`${initiator.name} yêu cầu [${stolen.name}] từ ${target.name} và ĐÃ CƯỚP ĐƯỢC!`, 'special', initiatorId);
      this.checkBombTheft(initiatorId, targetId, stolen);
    } else {
      this.addLog(`${initiator.name} yêu cầu [${requestedType}] từ ${target.name}, nhưng đối thủ không có!`, 'info', initiatorId);
    }
  }

  private checkBombTheft(stealerId: string, victimId: string, stolenCard: EKCard) {
    const stealer = this.state.players.find(p => p.id === stealerId)!;
    const victim = this.state.players.find(p => p.id === victimId)!;
    const stealerHand = this.hands.get(stealerId)!;
    const victimHand = this.hands.get(victimId)!;

    // Case 1: Stealer stole an Exploding Kitten
    if (stolenCard.type === 'exploding_kitten') {
      const hasStreaking = stealerHand.some(c => c.type === 'streaking_kitten');
      const bombCount = stealerHand.filter(c => c.type === 'exploding_kitten').length;
      if (!hasStreaking || bombCount > 1) {
        this.addLog(`💥 ${stealer.name} ĐÃ CƯỚP PHẢI MÈO NỔ CỦA ${victim.name} VÀ BỊ NỔ TUNG!`, 'warning', stealerId);
        // Remove from hand to defuse
        const bIdx = stealerHand.findIndex(c => c.id === stolenCard.id);
        if (bIdx !== -1) stealerHand.splice(bIdx, 1);
        stealer.cardCount = stealerHand.length;
        this.triggerDefusalEmergency(stealerId, stolenCard);
        return;
      }
    }

    // Case 2: Stealer stole Streaking Kitten and victim still holds Exploding Kitten
    if (stolenCard.type === 'streaking_kitten') {
      const victimBombIdx = victimHand.findIndex(c => c.type === 'exploding_kitten');
      if (victimBombIdx !== -1) {
        const [bomb] = victimHand.splice(victimBombIdx, 1);
        victim.cardCount = victimHand.length;
        this.addLog(`💥 ${victim.name} bị cướp mất Mèo Đi Dạo trong khi đang ôm Mèo Nổ!`, 'warning', victimId);
        this.triggerDefusalEmergency(victimId, bomb);
      }
    }
  }

  private handleGiveFavorCard(playerId: string, cardId: string): { success: boolean; message?: string } {
    const favor = this.state.pendingFavor;
    if (!favor || favor.fromPlayerId !== playerId) {
      return { success: false, message: 'Bạn không nằm trong danh sách phải nộp bài.' };
    }

    const giverHand = this.hands.get(playerId);
    if (!giverHand) return { success: false, message: 'Hand not found.' };

    const cardIdx = giverHand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return { success: false, message: 'Lá bài không có trên tay.' };

    const [card] = giverHand.splice(cardIdx, 1);
    const receiverHand = this.hands.get(favor.toPlayerId)!;
    receiverHand.push(card);

    const giver = this.state.players.find(p => p.id === playerId)!;
    const receiver = this.state.players.find(p => p.id === favor.toPlayerId)!;

    giver.cardCount = giverHand.length;
    receiver.cardCount = receiverHand.length;
    giver.defuseCount = giverHand.filter(c => c.type === 'defuse').length;
    receiver.defuseCount = receiverHand.filter(c => c.type === 'defuse').length;

    this.addLog(`${giver.name} đã giao nộp 1 lá bài cho ${receiver.name}.`, 'special', playerId);
    this.state.pendingFavor = null;

    this.checkBombTheft(favor.toPlayerId, playerId, card);

    this.emitStateChange();
    return { success: true };
  }

  private handleDrawFromBottom(playerId: string): { success: boolean; message?: string } {
    if (this.drawPile.length === 0) {
      return { success: false, message: 'Chồng bài rút đã hết.' };
    }

    const hand = this.hands.get(playerId);
    if (!hand) return { success: false, message: 'Hand not found.' };

    const cardIndex = hand.findIndex(c => c.type === 'draw_from_bottom');
    if (cardIndex === -1) {
      return { success: false, message: 'Bạn không có thẻ Rút Đáy trên tay.' };
    }

    // 1. Consume the draw_from_bottom card
    const [card] = hand.splice(cardIndex, 1);
    this.discardPile.push(card);
    this.state.discardPile = [...this.discardPile];
    this.state.lastPlayedBy = playerId;
    this.state.lastPlayedCard = card;

    const player = this.state.players.find(p => p.id === playerId)!;
    player.cardCount = hand.length;

    this.addLog(`${player.name} đã đánh thẻ [Rút Đáy] và rút 1 lá dưới đáy bộ bài!`, 'action', playerId);

    // 2. Bottom card is at index 0 of drawPile
    const drawn = this.drawPile.shift()!;
    return this.processDrawnCard(playerId, drawn, 'dưới đáy');
  }

  private handleDrawCard(playerId: string): { success: boolean; message?: string } {
    if (this.drawPile.length === 0) {
      return { success: false, message: 'Chồng bài rút đã hết.' };
    }
    const drawn = this.drawPile.pop()!;
    return this.processDrawnCard(playerId, drawn, 'trên cùng');
  }

  private processDrawnCard(playerId: string, drawn: EKCard, source: string): { success: boolean; message?: string } {
    this.state.drawPileCount = this.drawPile.length;
    const player = this.state.players.find(p => p.id === playerId)!;

    // Check if player had Curse of Cat Butt (lifts on safe draw or explosion)
    if (player.isBlinded) {
      player.isBlinded = false;
      this.addLog(`✨ Lời nguyền Đít Mèo lên ${player.name} đã được hóa giải!`, 'info', playerId);
    }

    // 1. Imploding Kitten drawn
    if (drawn.type === 'imploding_kitten') {
      if (drawn.isFaceUp) {
        // Instant elimination! Cannot defuse!
        this.addLog(`💀💀💀 ${player.name} RÚT TRÚNG MÈO PHÁT NỔ NGỬA MẶT VÀ BỊ NỔ TUNG NGAY LẬP TỨC!`, 'warning', playerId);
        this.eliminatePlayer(playerId);
        return { success: true };
      } else {
        // Face down draw: Must be placed back face-up
        this.addLog(`⚠️ ${player.name} vừa rút trúng MÈO PHÁT NỔ ÚP MẶT! Lá này sẽ được lật ngửa và nhét lại vào bộ bài!`, 'warning', playerId);
        drawn.isFaceUp = true;
        this.triggerDefusalEmergency(playerId, drawn, true);
        return { success: true };
      }
    }

    // 2. Exploding Kitten drawn
    if (drawn.type === 'exploding_kitten') {
      const hand = this.hands.get(playerId)!;
      const holdsStreaking = hand.some(c => c.type === 'streaking_kitten');
      const holdsBomb = hand.some(c => c.type === 'exploding_kitten');

      if (holdsStreaking && !holdsBomb) {
        // Streaking Kitten saves the player! Bomb is held secretly in hand
        hand.push(drawn);
        player.cardCount = hand.length;
        this.addLog(
          `🩲 THẦN HỘ MỆNH: MÈO ĐI DẠO! ${player.name} đã bí mật ôm lá Mèo Nổ trên tay mà không bị nổ tung! (Kẻ nào cướp phải sẽ nổ tung!)`,
          'special',
          playerId
        );

        this.finishTurnAfterSafeDraw(player);
        return { success: true };
      }

      // Normal exploding kitten emergency
      this.addLog(`💥 ${player.name} RÚT PHẢI MÈO NỔ! 💣`, 'warning', playerId);
      this.triggerDefusalEmergency(playerId, drawn);
      return { success: true };
    }

    // 3. Normal safe card drawn
    // Check if another player used "I'll Take That" on this player
    if (player.illTakeThatFromPlayerId) {
      const thiefId = player.illTakeThatFromPlayerId;
      const thief = this.state.players.find(p => p.id === thiefId);
      const thiefHand = this.hands.get(thiefId);
      player.illTakeThatFromPlayerId = undefined;

      if (thief && thiefHand) {
        thiefHand.push(drawn);
        thief.cardCount = thiefHand.length;
        if (drawn.type === 'defuse') thief.defuseCount++;
        this.addLog(`🫳 Bẫy kích hoạt! Lá bài ${player.name} vừa rút đã bị ${thief.name} nẫng tay trên!`, 'special', thiefId);
        this.finishTurnAfterSafeDraw(player);
        return { success: true };
      }
    }

    const hand = this.hands.get(playerId)!;
    hand.push(drawn);
    player.cardCount = hand.length;
    if (drawn.type === 'defuse') {
      player.defuseCount++;
    }

    this.addLog(`${player.name} rút 1 lá bài an toàn (${source}).`, 'info', playerId);
    this.finishTurnAfterSafeDraw(player);
    return { success: true };
  }

  private finishTurnAfterSafeDraw(player: EKPlayer) {
    this.state.pendingTurnsForCurrentPlayer--;
    if (this.state.pendingTurnsForCurrentPlayer <= 0) {
      this.advanceTurn(1, 1);
    } else {
      this.addLog(`${player.name} vẫn còn ${this.state.pendingTurnsForCurrentPlayer} lượt phải đánh!`, 'info', player.id);
      this.resetTurnTimer();
      this.emitStateChange();
    }
  }

  private triggerDefusalEmergency(playerId: string, kittenCard: EKCard, isImplodingFirstDraw: boolean = false) {
    this.clearTurnTimer();

    const player = this.state.players.find(p => p.id === playerId)!;
    const hand = this.hands.get(playerId) || [];
    const hasDefuse = hand.some(c => c.type === 'defuse');

    this.state.pendingDefusal = {
      playerId,
      kittenCard,
      expiresAt: Date.now() + 10000
    };

    if (isImplodingFirstDraw) {
      this.addLog(`🌀 ${player.name} có 10 giây để chọn vị trí nhét Mèo Phát Nổ (ngửa mặt) trở lại vào bộ bài!`, 'warning', playerId);
    } else if (hasDefuse) {
      this.addLog(`🚨 ${player.name} có 10 giây để đánh thẻ GỠ BOM!`, 'warning', playerId);
    } else {
      this.addLog(`💀 ${player.name} KHÔNG CÓ thẻ Gỡ Bom! Đang đếm ngược để nổ tung...`, 'warning', playerId);
    }

    const waitTimeMs = (!hasDefuse && !isImplodingFirstDraw) ? 2000 : 10000;
    this.defusalTimer = setTimeout(() => {
      this.handleDefusalTimeout();
    }, waitTimeMs);
    if (this.defusalTimer && typeof this.defusalTimer.unref === 'function') {
      this.defusalTimer.unref();
    }

    this.emitStateChange();
  }

  private handleResolveDefuse(
    playerId: string,
    action: Extract<EKAction, { type: 'RESOLVE_DEFUSE' }>
  ): { success: boolean; message?: string } {
    if (!this.state.pendingDefusal || this.state.pendingDefusal.playerId !== playerId) {
      return { success: false, message: 'Bạn không trong tình trạng gỡ bom khẩn cấp.' };
    }

    const kitten = this.state.pendingDefusal.kittenCard;
    const isImploding = kitten.type === 'imploding_kitten';
    const hand = this.hands.get(playerId);
    if (!hand) return { success: false, message: 'Hand not found.' };

    const player = this.state.players.find(p => p.id === playerId)!;

    if (!isImploding) {
      // Exploding Kitten requires a Defuse card
      const defuseIdx = hand.findIndex(c => c.type === 'defuse');
      if (defuseIdx === -1) {
        return { success: false, message: 'Bạn không có thẻ Gỡ Bom!' };
      }

      // Consume Defuse card to discard pile
      const [defuseCard] = hand.splice(defuseIdx, 1);
      this.discardPile.push(defuseCard);
      this.state.discardPile = [...this.discardPile];
      this.state.lastPlayedBy = playerId;
      this.state.lastPlayedCard = defuseCard;

      player.cardCount = hand.length;
      player.defuseCount = hand.filter(c => c.type === 'defuse').length;
    }

    // Clear defusal timer
    if (this.defusalTimer) {
      clearTimeout(this.defusalTimer);
      this.defusalTimer = null;
    }

    // Insert the Kitten back into draw deck
    const deckLen = this.drawPile.length;
    if (action.insertionMode === 'top') {
      this.drawPile.push(kitten);
    } else if (action.insertionMode === 'bottom') {
      this.drawPile.unshift(kitten);
    } else if (action.insertionMode === 'random') {
      const idx = crypto.randomInt(0, deckLen + 1);
      this.drawPile.splice(idx, 0, kitten);
    } else if (action.insertionMode === 'index' && typeof action.targetIndex === 'number') {
      const clampedIdx = Math.max(0, Math.min(deckLen, action.targetIndex));
      this.drawPile.splice(clampedIdx, 0, kitten);
    }

    this.addLog(
      isImploding
        ? `${player.name} đã nhét Mèo Phát Nổ NGỬA MẶT trở lại vào bộ bài!`
        : `${player.name} đã bí mật gỡ bom và nhét lá Mèo Nổ trở lại vào bộ bài!`,
      'special',
      playerId
    );

    this.state.drawPileCount = this.drawPile.length;
    this.state.pendingDefusal = null;

    // Turn completes
    this.state.pendingTurnsForCurrentPlayer--;
    if (this.state.pendingTurnsForCurrentPlayer <= 0) {
      this.advanceTurn(1, 1);
    } else {
      this.resetTurnTimer();
      this.emitStateChange();
    }

    return { success: true };
  }

  private handleDefusalTimeout() {
    if (this.defusalTimer) {
      clearTimeout(this.defusalTimer);
      this.defusalTimer = null;
    }

    if (!this.state.pendingDefusal) return;

    const playerId = this.state.pendingDefusal.playerId;
    const kitten = this.state.pendingDefusal.kittenCard;

    if (kitten.type === 'imploding_kitten') {
      // If timed out placing imploding kitten, auto-place it randomly face-up
      const idx = crypto.randomInt(0, this.drawPile.length + 1);
      this.drawPile.splice(idx, 0, kitten);
      this.state.drawPileCount = this.drawPile.length;
      this.state.pendingDefusal = null;
      this.addLog(`Mèo Phát Nổ đã tự động được nhét ngẫu nhiên vào bộ bài.`, 'info');

      this.state.pendingTurnsForCurrentPlayer--;
      if (this.state.pendingTurnsForCurrentPlayer <= 0) {
        this.advanceTurn(1, 1);
      } else {
        this.resetTurnTimer();
        this.emitStateChange();
      }
      return;
    }

    this.state.pendingDefusal = null;
    this.eliminatePlayer(playerId);
  }

  private eliminatePlayer(playerId: string) {
    const player = this.state.players.find(p => p.id === playerId)!;
    player.eliminated = true;
    player.isExploded = true;

    // Discard all player's cards
    const hand = this.hands.get(playerId) || [];
    this.discardPile.push(...hand);
    this.state.discardPile = [...this.discardPile];
    this.hands.set(playerId, []);
    player.cardCount = 0;
    player.defuseCount = 0;

    this.addLog(`💥💥💥 BÙM! ${player.name} đã BỊ NỔ TUNG và rời khỏi trận đấu!`, 'warning', playerId);

    // Check remaining survivors
    const survivors = this.state.players.filter(p => !p.eliminated);
    if (survivors.length === 1) {
      this.handlePlayerWon(survivors[0].id);
      return;
    }

    // Advance turn to next survivor
    this.state.pendingTurnsForCurrentPlayer = 1;
    this.advanceTurn(1, 1);
  }

  private advanceTurn(step: number = 1, newPendingTurns: number = 1) {
    if (this.state.isGameOver) return;

    this.state.currentTurnIndex = this.getNextPlayerIndex(step);
    this.state.pendingTurnsForCurrentPlayer = newPendingTurns;

    const next = this.getCurrentPlayer();
    if (next) {
      this.addLog(`Đến lượt của ${next.name} (${this.state.pendingTurnsForCurrentPlayer} lượt phải đánh).`, 'info');
    }

    this.resetTurnTimer();
    this.emitStateChange();
  }

  public handleTurnTimeout(): void {
    const current = this.getCurrentPlayer();
    if (!current || this.state.isGameOver) return;

    this.addLog(`${current.name} đã hết thời gian lượt! Tự động rút bài...`, 'warning', current.id);
    this.handleDrawCard(current.id);
  }

  private handlePlayerWon(playerId: string) {
    const winner = this.state.players.find(p => p.id === playerId);
    const name = winner ? winner.name : 'Unknown';
    this.addLog(`👑 ${name} LÀ NGƯỜI DUY NHẤT SỐNG SÓT VÀ CHIẾN THẮNG TRẬN ĐẤU!`, 'win', playerId);
    this.emitGameOver([playerId]);
  }

  public getMaskedState(playerId: string): MaskedEKGameState {
    const rawHand = this.hands.get(playerId) || [];
    const requestingPlayer = this.state.players.find(p => p.id === playerId);

    // If player is blinded by Curse of Cat Butt, hand cards are masked except id
    const isBlinded = requestingPlayer?.isBlinded || false;
    const myHand: EKCard[] = isBlinded
      ? rawHand.map(c => ({
          id: c.id,
          type: 'taco_cat' as any, // placeholder type
          name: '??? (Bị Mù)',
          description: 'Lá bài này đang bị úp mặt do Lời Nguyền Đít Mèo.'
        }))
      : rawHand;

    const maskedPlayers: MaskedEKPlayer[] = this.state.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isBot: p.isBot,
      connected: p.connected,
      cardCount: p.cardCount,
      eliminated: p.eliminated,
      isBlinded: p.isBlinded
    }));

    const topCard = this.drawPile.length > 0 ? this.drawPile[this.drawPile.length - 1] : null;
    const isTopCardFaceUp = !!(topCard && topCard.isFaceUp);

    return {
      gameType: 'exploding-kittens',
      drawPileCount: this.drawPile.length,
      discardPile: this.state.discardPile,
      lastPlayedBy: this.state.lastPlayedBy,
      lastPlayedCard: this.state.lastPlayedCard,
      currentTurnIndex: this.state.currentTurnIndex,
      direction: this.state.direction,
      turnTimeLimit: this.state.turnTimeLimit,
      turnStartTime: this.state.turnStartTime,
      isGameOver: this.state.isGameOver,
      winners: this.state.winners,
      players: maskedPlayers,
      myHand,
      pendingTurns: this.state.pendingTurnsForCurrentPlayer,
      pendingAction: this.state.pendingAction,
      pendingDefusal: this.state.pendingDefusal,
      pendingFavor: this.state.pendingFavor,
      logs: this.state.logs,
      topDrawCardIsFaceUp: isTopCardFaceUp,
      topDrawCardName: isTopCardFaceUp ? topCard?.name : undefined,
      ekExpansions: this.state.expansions,
      curseActive: isBlinded
    };
  }

  public handleDisconnect(playerId: string): void {
    const player = this.state.players.find(p => p.id === playerId);
    if (player) {
      player.connected = false;
      this.addLog(`${player.name} bị mất kết nối.`, 'warning', playerId);
      this.emitStateChange();
    }
  }

  public handleReconnect(playerId: string): void {
    const player = this.state.players.find(p => p.id === playerId);
    if (player) {
      player.connected = true;
      this.addLog(`${player.name} đã kết nối lại!`, 'info', playerId);
      this.emitStateChange();
    }
  }
}
