import crypto from 'crypto';
import { BaseGame } from '../BaseGame';
import { SamCardEvaluator } from './SamCardEvaluator';
import {
  CardValue,
  MaskedSamGameState,
  MaskedSamPlayer,
  SamAction,
  SamCard,
  SamCardCombo,
  SamGameState,
  SamPlayer,
  Suit
} from './types';

const SUITS: { suit: Suit; value: number }[] = [
  { suit: 'spades', value: 0 },
  { suit: 'clubs', value: 1 },
  { suit: 'diamonds', value: 2 },
  { suit: 'hearts', value: 3 }
];

const VALUES: { val: CardValue; rank: number }[] = [
  { val: '3', rank: 3 },
  { val: '4', rank: 4 },
  { val: '5', rank: 5 },
  { val: '6', rank: 6 },
  { val: '7', rank: 7 },
  { val: '8', rank: 8 },
  { val: '9', rank: 9 },
  { val: '10', rank: 10 },
  { val: 'J', rank: 11 },
  { val: 'Q', rank: 12 },
  { val: 'K', rank: 13 },
  { val: 'A', rank: 14 },
  { val: '2', rank: 15 }
];

export class SamGame extends BaseGame<SamGameState, SamAction, MaskedSamGameState> {
  private hands: Map<string, SamCard[]> = new Map();
  private lastTrickWinnerId: string | null = null;
  private baoSamTimer: NodeJS.Timeout | null = null;

  constructor(
    players: { id: string; name: string; avatar: string; isBot: boolean }[],
    options: { turnTimeLimit?: number } = {}
  ) {
    const samPlayers: SamPlayer[] = players.map(p => ({
      ...p,
      connected: true,
      cardCount: 0,
      hasPassedCurrentRound: false,
      playedCardsCount: 0,
      isCong: false,
      isBaoSam: false,
      isBaoMot: false,
      isDenSam: false,
      hasBaoSamResponded: false,
      penaltyPoints: 0
    }));

    const initialState: SamGameState = {
      gameType: 'sam',
      phase: 'bao_sam',
      players: samPlayers,
      currentTurnIndex: 0,
      direction: 1,
      turnTimeLimit: options.turnTimeLimit || 20,
      turnStartTime: Date.now(),
      isGameOver: false,
      winners: [],
      logs: [],
      currentTrick: null,
      trickHistory: [],
      roundPassCount: 0,
      finishedRanking: []
    };

    super(initialState);
  }

  public start(): void {
    const deck = this.generateDeck();
    const shuffled = BaseGame.shuffleDeck(deck);
    this.hands.clear();

    const count = this.state.players.length;
    // Deal 10 cards each in Sâm Lốc
    for (let i = 0; i < count; i++) {
      const player = this.state.players[i];
      const hand = SamCardEvaluator.sortCards(shuffled.splice(0, 10));
      this.hands.set(player.id, hand);
      player.cardCount = hand.length;
      player.hasPassedCurrentRound = false;
      player.playedCardsCount = 0;
      player.isCong = false;
      player.isBaoSam = false;
      player.isBaoMot = false;
      player.isDenSam = false;
      player.hasBaoSamResponded = false;
      player.rank = undefined;
    }

    this.state.currentTrick = null;
    this.state.trickHistory = [];
    this.state.roundPassCount = 0;
    this.state.finishedRanking = [];
    this.state.isGameOver = false;

    // Check Tới Trắng immediately
    for (const player of this.state.players) {
      const hand = this.hands.get(player.id)!;
      const toiTrang = SamCardEvaluator.checkToiTrang(hand);
      if (toiTrang) {
        const toiTrangNames: Record<string, string> = {
          dragon_straight_10: 'SẢNH RỒNG 10 LÁ',
          four_twos: 'TỨ QUÝ 2',
          five_pairs: '5 ĐÔI',
          same_color: 'ĐỒNG MÀU (10 LÁ)'
        };
        const title = toiTrangNames[toiTrang] || toiTrang;
        this.addLog(`🌟 TỚI TRẮNG! ${player.name} thắng ngay lập tức với [${title}]!`, 'win', player.id);
        player.rank = 1;
        this.finishGameDirectly([player.id]);
        return;
      }
    }

    // Enter Báo Sâm (Xin Sâm) phase (10 seconds timeout)
    this.state.phase = 'bao_sam';
    this.state.baoSamDeadline = Date.now() + 10000;
    this.addLog(`🔔 GIAI ĐOẠN XIN SÂM: Bạn có 10 giây để quyết định Báo Sâm!`, 'special');

    if (this.baoSamTimer) clearTimeout(this.baoSamTimer);
    this.baoSamTimer = setTimeout(() => {
      this.finishBaoSamPhase();
    }, 10000);

    this.emitStateChange();
  }

  private finishBaoSamPhase(): void {
    if (this.baoSamTimer) {
      clearTimeout(this.baoSamTimer);
      this.baoSamTimer = null;
    }

    if (this.state.phase !== 'bao_sam' || this.state.isGameOver) return;

    this.state.phase = 'playing';

    if (this.state.samCallerId) {
      const callerIndex = this.state.players.findIndex(p => p.id === this.state.samCallerId);
      const caller = this.state.players[callerIndex];
      this.state.currentTurnIndex = callerIndex >= 0 ? callerIndex : 0;
      this.addLog(`🔥 ${caller?.name || 'Người chơi'} đã BÁO SÂM thành công và được quyền đánh trước!`, 'special', this.state.samCallerId);
    } else {
      // Find starter: player with lowest card (rankValue, then suitValue)
      let starterIndex = 0;
      let minCardScore = 9999;
      for (let i = 0; i < this.state.players.length; i++) {
        const hand = this.hands.get(this.state.players[i].id) || [];
        if (hand.length > 0) {
          const lowest = hand[0]; // Already sorted
          const score = lowest.rankValue * 4 + lowest.suitValue;
          if (score < minCardScore) {
            minCardScore = score;
            starterIndex = i;
          }
        }
      }
      this.state.currentTurnIndex = starterIndex;
      const starter = this.state.players[starterIndex];
      this.addLog(`Không ai Xin Sâm. ${starter.name} sở hữu quân bài nhỏ nhất và đi đầu!`, 'info', starter.id);
    }

    this.resetTurnTimer();
    this.emitStateChange();
  }

  private generateDeck(): SamCard[] {
    const deck: SamCard[] = [];
    for (const v of VALUES) {
      for (const s of SUITS) {
        deck.push({
          id: crypto.randomUUID(),
          value: v.val,
          suit: s.suit,
          rankValue: v.rank,
          suitValue: s.value,
          overallRank: v.rank * 4 + s.value
        });
      }
    }
    return deck;
  }

  public handleAction(playerId: string, action: SamAction): { success: boolean; message?: string } {
    if (this.state.isGameOver) return { success: false, message: 'Game is already finished.' };

    const playerIndex = this.state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return { success: false, message: 'Player not found.' };
    const player = this.state.players[playerIndex];

    // Handle Báo Sâm action
    if (action.type === 'BAO_SAM') {
      if (this.state.phase !== 'bao_sam') {
        return { success: false, message: 'Báo Sâm phase is already over.' };
      }
      player.hasBaoSamResponded = true;
      if (action.baoSam && !this.state.samCallerId) {
        player.isBaoSam = true;
        this.state.samCallerId = playerId;
        this.addLog(`📢 ${player.name} XIN SÂM! Cả làng chuẩn bị chặn Sâm!`, 'special', playerId);
        // End phase early since someone claimed Sâm!
        this.finishBaoSamPhase();
        return { success: true };
      }

      // Check if all players responded
      const allResponded = this.state.players.every(p => p.hasBaoSamResponded);
      if (allResponded) {
        this.finishBaoSamPhase();
      } else {
        this.emitStateChange();
      }
      return { success: true };
    }

    if (this.state.phase !== 'playing') {
      return { success: false, message: 'Vui lòng chờ giai đoạn Xin Sâm kết thúc.' };
    }

    if (player.cardCount === 0) {
      return { success: false, message: 'You have already finished your hand!' };
    }

    // Check turn
    if (this.state.currentTurnIndex !== playerIndex) {
      return { success: false, message: 'Chưa đến lượt của bạn.' };
    }

    if (action.type === 'PASS_TURN') {
      return this.handlePassTurn(playerId);
    }

    if (action.type === 'PLAY_CARDS') {
      return this.handlePlayCards(playerId, action.cardIds);
    }

    return { success: false, message: 'Unknown action.' };
  }

  private handlePlayCards(playerId: string, cardIds: string[]): { success: boolean; message?: string } {
    const player = this.state.players.find(p => p.id === playerId)!;
    if (player.hasPassedCurrentRound) {
      return { success: false, message: 'Bạn đã bỏ lượt trong vòng này.' };
    }

    const hand = this.hands.get(playerId)!;
    const playedCards = hand.filter(c => cardIds.includes(c.id));
    if (playedCards.length !== cardIds.length) {
      return { success: false, message: 'Một số quân bài không có trên tay bạn.' };
    }

    const combo = SamCardEvaluator.evaluateCombo(playedCards);
    if (combo.type === 'invalid') {
      return { success: false, message: 'Tổ hợp bài không hợp lệ trong Sâm Lốc!' };
    }

    // If active trick on board, must beat it
    if (this.state.currentTrick) {
      const canBeat = SamCardEvaluator.canBeat(combo, this.state.currentTrick.combo);
      if (!canBeat) {
        return { success: false, message: 'Bài không đè được tổ hợp trên bàn!' };
      }
    }

    return this.executePlay(playerId, playedCards, combo);
  }

  private executePlay(playerId: string, cards: SamCard[], combo: SamCardCombo): { success: boolean; message?: string } {
    const hand = this.hands.get(playerId)!;
    const playerIndex = this.state.players.findIndex(p => p.id === playerId);
    const player = this.state.players[playerIndex];

    // Remove cards from hand
    for (const card of cards) {
      const idx = hand.findIndex(c => c.id === card.id);
      if (idx !== -1) hand.splice(idx, 1);
    }
    player.cardCount = hand.length;
    player.playedCardsCount += cards.length;

    // Detect cutting (Chặt Heo bằng Tứ Quý)
    let isCutting = false;
    if (this.state.currentTrick) {
      const curr = this.state.currentTrick.combo;
      if (curr.type === 'single' && curr.cards[0].rankValue === 15 && combo.type === 'four_of_a_kind') {
        isCutting = true;
      } else if (curr.type === 'four_of_a_kind' && combo.type === 'four_of_a_kind') {
        isCutting = true;
      }
    }

    // Record trick
    const trickRecord = {
      playerId,
      combo,
      timestamp: Date.now()
    };
    this.state.currentTrick = trickRecord;
    this.state.trickHistory.push(trickRecord);
    this.lastTrickWinnerId = playerId;

    const comboName = this.formatComboName(combo);
    if (isCutting) {
      this.addLog(`💥 CHẶT! ${player.name} chặt bằng ${comboName}!`, 'special', playerId);
    } else {
      this.addLog(`${player.name} đánh ${comboName}.`, 'action', playerId);
    }

    // Báo 1 lá (Báo làng)
    if (hand.length === 1 && !player.isBaoMot) {
      player.isBaoMot = true;
      this.addLog(`⚠️ BÁO LÀNG! ${player.name} CHỈ CÒN ĐÚNG 1 LÁ BÀI! Cửa trên phải đánh con to nhất!`, 'warning', playerId);
    }

    // Check Sâm mechanics
    if (this.state.samCallerId) {
      // If someone other than Sâm caller played a beating card -> ĐỀN SÂM!
      if (playerId !== this.state.samCallerId) {
        const caller = this.state.players.find(p => p.id === this.state.samCallerId)!;
        caller.isDenSam = true;
        this.addLog(`⚡ BẮT SÂM THÀNH CÔNG! ${player.name} đã chặn được bài của ${caller.name}! ${caller.name} PHẢI ĐỀN SÂM!`, 'warning', caller.id);
        this.finishGameWithDenSam(playerId, this.state.samCallerId);
        return { success: true };
      }

      // If Sâm caller emptied hand -> ĂN SÂM!
      if (playerId === this.state.samCallerId && hand.length === 0) {
        this.addLog(`🎉 ĂN SÂM! ${player.name} đánh hết 10 lá bài mà không ai chặn được! Thắng Sâm rực rỡ!`, 'win', playerId);
        player.rank = 1;
        this.finishGameDirectly([playerId]);
        return { success: true };
      }
    }

    // Normal win condition: First player to empty hand wins
    if (hand.length === 0) {
      // Check Thối 2: In Sâm Lốc, you cannot finish on 2!
      if (combo.type === 'single' && combo.cards[0].rankValue === 15) {
        this.addLog(`❌ THỐI 2 (VỀ CHÓT): ${player.name} đánh quân 2 cuối cùng nên bị xử thua!`, 'warning', playerId);
        player.rank = this.state.players.length;
        // Remaining player with least cards wins
        const others = this.state.players.filter(p => p.id !== playerId);
        others.sort((a, b) => a.cardCount - b.cardCount);
        this.finishGameDirectly(others.map(o => o.id));
        return { success: true };
      }

      player.rank = 1;
      this.addLog(`🏆 ${player.name} ĐÃ HẾT BÀI VÀ VỀ NHẤT!`, 'win', playerId);
      this.finishNormalGame(playerId);
      return { success: true };
    }

    // Advance turn
    this.advanceTurnInTrick();
    return { success: true };
  }

  private handlePassTurn(playerId: string): { success: boolean; message?: string } {
    if (!this.state.currentTrick) {
      return { success: false, message: 'Bạn đang dẫn đầu vòng nên không thể bỏ lượt!' };
    }

    const player = this.state.players.find(p => p.id === playerId)!;
    player.hasPassedCurrentRound = true;
    this.addLog(`${player.name} bỏ lượt.`, 'info', playerId);

    this.advanceTurnInTrick();
    return { success: true };
  }

  private advanceTurnInTrick() {
    if (this.state.isGameOver) return;

    const activeInMatch = this.state.players.filter(p => p.cardCount > 0);
    if (activeInMatch.length <= 1) {
      this.finishNormalGame(activeInMatch[0]?.id || this.lastTrickWinnerId || this.state.players[0].id);
      return;
    }

    const activeInTrick = this.state.players.filter(p => p.cardCount > 0 && !p.hasPassedCurrentRound);

    // Trick cleared!
    if (activeInTrick.length <= 1) {
      const trickWinnerId = this.lastTrickWinnerId;
      const winnerPlayer = this.state.players.find(p => p.id === trickWinnerId);
      let nextLeaderIndex: number;

      if (winnerPlayer && winnerPlayer.cardCount > 0) {
        nextLeaderIndex = this.state.players.findIndex(p => p.id === trickWinnerId);
      } else {
        const oldIndex = this.state.players.findIndex(p => p.id === trickWinnerId);
        nextLeaderIndex = (oldIndex + 1) % this.state.players.length;
        while (this.state.players[nextLeaderIndex].cardCount === 0) {
          nextLeaderIndex = (nextLeaderIndex + 1) % this.state.players.length;
        }
      }

      const leader = this.state.players[nextLeaderIndex];
      this.addLog(`Qua vòng mới! ${leader.name} thắng vòng và dẫn đầu lượt mới!`, 'info');

      this.state.currentTrick = null;
      for (const p of this.state.players) {
        p.hasPassedCurrentRound = false;
      }

      this.state.currentTurnIndex = nextLeaderIndex;
      this.resetTurnTimer();
      this.emitStateChange();
      return;
    }

    // Advance clockwise
    let nextIndex = this.state.currentTurnIndex;
    const total = this.state.players.length;
    let attempts = 0;

    do {
      nextIndex = (nextIndex + 1) % total;
      const candidate = this.state.players[nextIndex];
      if (candidate.cardCount > 0 && !candidate.hasPassedCurrentRound) {
        break;
      }
      attempts++;
    } while (attempts < total * 2);

    this.state.currentTurnIndex = nextIndex;
    this.resetTurnTimer();
    this.emitStateChange();
  }

  private finishNormalGame(winnerId: string) {
    const winner = this.state.players.find(p => p.id === winnerId)!;
    winner.rank = 1;
    const rankings = [winnerId];

    // Check Cóng & Thối 2 for remaining players
    const others = this.state.players.filter(p => p.id !== winnerId);
    others.sort((a, b) => a.cardCount - b.cardCount);

    for (let i = 0; i < others.length; i++) {
      const p = others[i];
      p.rank = i + 2;
      rankings.push(p.id);

      if (p.playedCardsCount === 0) {
        p.isCong = true;
        this.addLog(`⚠️ CÓNG (CHÁY BÀI): ${p.name} không đánh được lá nào suốt cả ván!`, 'warning', p.id);
      }

      // Check penalty (Thối 2, Thối Tứ Quý)
      const hand = this.hands.get(p.id) || [];
      let penalty = hand.length; // 1 point per remaining card
      for (const c of hand) {
        if (c.rankValue === 15) penalty += 2; // Thối 2
      }
      p.penaltyPoints = penalty;
    }

    this.finishGameDirectly(rankings);
  }

  private finishGameWithDenSam(catcherId: string, samCallerId: string) {
    const catcher = this.state.players.find(p => p.id === catcherId)!;
    catcher.rank = 1;
    const caller = this.state.players.find(p => p.id === samCallerId)!;
    caller.rank = this.state.players.length;

    const rankings = [catcherId];
    for (const p of this.state.players) {
      if (p.id !== catcherId && p.id !== samCallerId) {
        rankings.push(p.id);
      }
    }
    rankings.push(samCallerId);

    this.finishGameDirectly(rankings);
  }

  private finishGameDirectly(rankings: string[]) {
    this.state.finishedRanking = rankings;
    this.clearTurnTimer();
    if (this.baoSamTimer) {
      clearTimeout(this.baoSamTimer);
      this.baoSamTimer = null;
    }
    this.emitGameOver(rankings);
  }

  public handleTurnTimeout(): void {
    if (this.state.isGameOver) return;

    if (this.state.phase === 'bao_sam') {
      this.finishBaoSamPhase();
      return;
    }

    const current = this.getCurrentPlayer();
    if (!current) return;

    if (this.state.currentTrick) {
      this.addLog(`${current.name} hết thời gian! Tự động bỏ lượt...`, 'warning', current.id);
      this.handlePassTurn(current.id);
    } else {
      const hand = this.hands.get(current.id) || [];
      if (hand.length > 0) {
        // Find lowest non-2 card if possible to avoid ending on 2
        const nonTwos = hand.filter(c => c.rankValue < 15);
        const cardToPlay = nonTwos.length > 0 ? nonTwos[0] : hand[0];
        this.addLog(`${current.name} hết thời gian! Tự động đánh bài nhỏ nhất...`, 'warning', current.id);
        this.handlePlayCards(current.id, [cardToPlay.id]);
      }
    }
  }

  public getMaskedState(playerId: string): MaskedSamGameState {
    const myHand = this.hands.get(playerId) || [];

    const maskedPlayers: MaskedSamPlayer[] = this.state.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isBot: p.isBot,
      connected: p.connected,
      cardCount: p.cardCount,
      hasPassedCurrentRound: p.hasPassedCurrentRound,
      rank: p.rank,
      isCong: p.isCong,
      isBaoSam: p.isBaoSam,
      isBaoMot: p.isBaoMot,
      isDenSam: p.isDenSam
    }));

    return {
      gameType: 'sam',
      phase: this.state.phase,
      samCallerId: this.state.samCallerId,
      baoSamDeadline: this.state.baoSamDeadline,
      players: maskedPlayers,
      currentTurnIndex: this.state.currentTurnIndex,
      direction: this.state.direction,
      turnTimeLimit: this.state.turnTimeLimit,
      turnStartTime: this.state.turnStartTime,
      isGameOver: this.state.isGameOver,
      winners: this.state.finishedRanking,
      myHand,
      currentTrick: this.state.currentTrick,
      trickHistory: this.state.trickHistory.slice(-5),
      logs: this.state.logs
    };
  }

  public handleDisconnect(playerId: string): void {
    const player = this.state.players.find(p => p.id === playerId);
    if (player) {
      player.connected = false;
      this.addLog(`${player.name} mất kết nối.`, 'warning', playerId);
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

  private formatComboName(combo: SamCardCombo): string {
    switch (combo.type) {
      case 'single':
        return `[${combo.highestCard.value}${this.formatSuit(combo.highestCard.suit)}]`;
      case 'pair':
        return `Đôi [${combo.highestCard.value}]`;
      case 'triple':
        return `Sám cô [${combo.highestCard.value}]`;
      case 'straight':
        return `Sảnh ${combo.length} lá (đến ${combo.highestCard.value})`;
      case 'four_of_a_kind':
        return `Tứ quý [${combo.highestCard.value}]`;
      default:
        return 'Bài';
    }
  }

  private formatSuit(suit: Suit): string {
    switch (suit) {
      case 'spades': return '♠';
      case 'clubs': return '♣';
      case 'diamonds': return '♦';
      case 'hearts': return '♥';
    }
  }
}
