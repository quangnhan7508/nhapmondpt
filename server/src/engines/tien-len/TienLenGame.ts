import crypto from 'crypto';
import { BaseGame } from '../BaseGame';
import { CardEvaluator } from './CardEvaluator';
import {
  CardCombo,
  CardValue,
  MaskedTLGameState,
  MaskedTLPlayer,
  Suit,
  TLAction,
  TLCard,
  TLPlayer,
  TienLenGameState
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

export class TienLenGame extends BaseGame<TienLenGameState, TLAction, MaskedTLGameState> {
  private hands: Map<string, TLCard[]> = new Map();
  private lastTrickWinnerId: string | null = null;

  constructor(
    players: { id: string; name: string; avatar: string; isBot: boolean }[],
    options: { turnTimeLimit?: number; firstTurnRule?: boolean; cutTwoOutOfTurnRule?: boolean } = {}
  ) {
    const tlPlayers: TLPlayer[] = players.map(p => ({
      ...p,
      connected: true,
      cardCount: 0,
      hasPassedCurrentRound: false,
      playedCardsCount: 0,
      eliminated: false,
      isCong: false,
      penaltyPoints: 0
    }));

    const initialState: TienLenGameState = {
      gameType: 'tien-len',
      players: tlPlayers,
      currentTurnIndex: 0,
      direction: 1,
      turnTimeLimit: options.turnTimeLimit || 30,
      turnStartTime: Date.now(),
      isGameOver: false,
      winners: [],
      logs: [],
      currentTrick: null,
      trickHistory: [],
      roundPassCount: 0,
      firstTurnRule: options.firstTurnRule ?? true,
      cutTwoOutOfTurnRule: options.cutTwoOutOfTurnRule ?? true,
      finishedRanking: []
    };

    super(initialState);
  }

  public start(): void {
    const deck = this.generateDeck();
    const shuffled = BaseGame.shuffleDeck(deck);
    this.hands.clear();

    const count = this.state.players.length;
    // Deal 13 cards each
    for (let i = 0; i < count; i++) {
      const player = this.state.players[i];
      const hand = CardEvaluator.sortCards(shuffled.splice(0, 13));
      this.hands.set(player.id, hand);
      player.cardCount = hand.length;
      player.hasPassedCurrentRound = false;
      player.playedCardsCount = 0;
      player.eliminated = false;
      player.isCong = false;
      player.rank = undefined;
    }

    this.state.currentTrick = null;
    this.state.trickHistory = [];
    this.state.roundPassCount = 0;
    this.state.finishedRanking = [];
    this.state.isGameOver = false;

    // Check Tới Trắng right after dealing
    for (const player of this.state.players) {
      const hand = this.hands.get(player.id)!;
      const toiTrang = CardEvaluator.checkToiTrang(hand);
      if (toiTrang) {
        this.addLog(`🌟 TỚI TRẮNG! ${player.name} wins instantly with [${toiTrang.replace(/_/g, ' ').toUpperCase()}]!`, 'win', player.id);
        player.rank = 1;
        this.emitGameOver([player.id]);
        return;
      }
    }

    // Determine starter (holder of 3 of Spades if first turn rule is active)
    let starterIndex = 0;
    if (this.state.firstTurnRule) {
      for (let i = 0; i < count; i++) {
        const hand = this.hands.get(this.state.players[i].id)!;
        if (hand.some(c => c.value === '3' && c.suit === 'spades')) {
          starterIndex = i;
          break;
        }
      }
    }

    this.state.currentTurnIndex = starterIndex;
    const starter = this.state.players[starterIndex];
    this.addLog(`Match started! ${starter.name} leads the first trick${this.state.firstTurnRule ? ' (must include 3♠)' : ''}.`, 'info', starter.id);

    this.resetTurnTimer();
    this.emitStateChange();
  }

  private generateDeck(): TLCard[] {
    const deck: TLCard[] = [];
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

  public handleAction(playerId: string, action: TLAction): { success: boolean; message?: string } {
    if (this.state.isGameOver) return { success: false, message: 'Game is already finished.' };

    const playerIndex = this.state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return { success: false, message: 'Player not found.' };
    const player = this.state.players[playerIndex];

    if (player.cardCount === 0 || player.eliminated) {
      return { success: false, message: 'You have already finished!' };
    }

    // Check for out-of-turn cut (4 Đôi Thông, hoặc Tứ Quý / 3 Đôi Thông chặt Heo)
    if (action.type === 'PLAY_CARDS' && this.state.currentTurnIndex !== playerIndex) {
      return this.handleOutOfTurnCut(playerId, action.cardIds);
    }

    // Check turn
    if (this.state.currentTurnIndex !== playerIndex) {
      return { success: false, message: 'Not your turn.' };
    }

    if (action.type === 'PASS_TURN') {
      return this.handlePassTurn(playerId);
    }

    if (action.type === 'PLAY_CARDS') {
      return this.handlePlayCards(playerId, action.cardIds);
    }

    return { success: false, message: 'Unknown action.' };
  }

  private handleOutOfTurnCut(playerId: string, cardIds: string[]): { success: boolean; message?: string } {
    if (!this.state.currentTrick) {
      return { success: false, message: 'Không có bài trên bàn để chặt.' };
    }

    const hand = this.hands.get(playerId)!;
    const playedCards = hand.filter(c => cardIds.includes(c.id));
    const combo = CardEvaluator.evaluateCombo(playedCards);

    const isFourPair = combo.type === 'four_pair_sequence';
    const canCutTwoOutOfTurn = this.state.cutTwoOutOfTurnRule ?? true;
    const isSpecialCutTwo = canCutTwoOutOfTurn && (
      combo.type === 'three_pair_sequence' || combo.type === 'four_of_a_kind'
    );

    if (!isFourPair && !isSpecialCutTwo) {
      return { success: false, message: 'Chỉ có 4 Đôi Thông hoặc Tứ Quý / 3 Đôi Thông chặt Heo mới được đánh ngoài lượt!' };
    }

    const canCut = CardEvaluator.canBeat(combo, this.state.currentTrick.combo);
    if (!canCut) {
      return { success: false, message: 'Bộ bài này không chặt được bài trên bàn.' };
    }

    // Execute out-of-turn cut!
    const playerName = this.state.players.find(p => p.id === playerId)?.name;
    const comboName = this.formatComboName(combo);
    this.addLog(`🔥 CHẶT NGOÀI LƯỢT! ${playerName} đã chặt bằng ${comboName}!`, 'special', playerId);
    return this.executePlay(playerId, playedCards, combo);
  }

  private handlePlayCards(playerId: string, cardIds: string[]): { success: boolean; message?: string } {
    const player = this.state.players.find(p => p.id === playerId)!;
    if (player.hasPassedCurrentRound) {
      return { success: false, message: 'You have passed this trick.' };
    }

    const hand = this.hands.get(playerId)!;
    const playedCards = hand.filter(c => cardIds.includes(c.id));
    if (playedCards.length !== cardIds.length) {
      return { success: false, message: 'Some cards are not in your hand.' };
    }

    // First turn 3 of Spades check
    if (this.state.firstTurnRule && this.state.trickHistory.length === 0 && this.state.currentTrick === null) {
      const hasThreeSpades = playedCards.some(c => c.value === '3' && c.suit === 'spades');
      if (!hasThreeSpades) {
        return { success: false, message: 'The first play of the game must include the 3 of Spades (3♠)!' };
      }
    }

    const combo = CardEvaluator.evaluateCombo(playedCards);
    if (combo.type === 'invalid') {
      return { success: false, message: 'Invalid card combination.' };
    }

    // If there is an active trick, must beat it
    if (this.state.currentTrick) {
      const canBeat = CardEvaluator.canBeat(combo, this.state.currentTrick.combo);
      if (!canBeat) {
        return { success: false, message: 'Cards cannot beat the current trick.' };
      }
    }

    return this.executePlay(playerId, playedCards, combo);
  }

  private executePlay(playerId: string, cards: TLCard[], combo: CardCombo): { success: boolean; message?: string } {
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

    // Detect cutting (Chặt)
    let isCutting = false;
    if (this.state.currentTrick) {
      const curr = this.state.currentTrick.combo;
      if (
        (curr.type === 'single' && curr.cards[0].rankValue === 15 && combo.type !== 'single') ||
        (curr.type === 'pair' && curr.cards[0].rankValue === 15 && combo.type !== 'pair') ||
        combo.type === 'four_of_a_kind' ||
        combo.type === 'four_pair_sequence' ||
        combo.type === 'three_pair_sequence'
      ) {
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
      this.addLog(`💥 CHẶT! ${player.name} cut with ${comboName}!`, 'special', playerId);
    } else {
      this.addLog(`${player.name} played ${comboName}.`, 'action', playerId);
    }

    // Check if player finished hand
    if (hand.length === 0) {
      this.handlePlayerFinished(playerId);
      if (this.state.isGameOver) return { success: true };
    }

    // Advance turn to next active player in trick
    this.advanceTurnInTrick();
    return { success: true };
  }

  private handlePassTurn(playerId: string): { success: boolean; message?: string } {
    if (!this.state.currentTrick) {
      return { success: false, message: 'You lead the trick and cannot pass!' };
    }

    const player = this.state.players.find(p => p.id === playerId)!;
    player.hasPassedCurrentRound = true;
    this.addLog(`${player.name} passed.`, 'info', playerId);

    this.advanceTurnInTrick();
    return { success: true };
  }

  private advanceTurnInTrick() {
    if (this.state.isGameOver) return;

    const activeInMatch = this.state.players.filter(p => p.cardCount > 0 && !p.eliminated);
    if (activeInMatch.length <= 1) {
      this.finishGame();
      return;
    }

    // Check who is still active in current trick (has not passed and has cards)
    const activeInTrick = this.state.players.filter(p => p.cardCount > 0 && !p.hasPassedCurrentRound && !p.eliminated);

    // If only 1 player or 0 players left in trick: Trick is won!
    if (activeInTrick.length <= 1) {
      let trickWinnerId = this.lastTrickWinnerId;
      // If trick winner just finished, trick goes to next active player
      const winnerPlayer = this.state.players.find(p => p.id === trickWinnerId);
      let nextLeaderIndex: number;

      if (winnerPlayer && winnerPlayer.cardCount > 0) {
        nextLeaderIndex = this.state.players.findIndex(p => p.id === trickWinnerId);
      } else {
        // Winner finished, find next active player clockwise
        const oldIndex = this.state.players.findIndex(p => p.id === trickWinnerId);
        nextLeaderIndex = (oldIndex + 1) % this.state.players.length;
        while (this.state.players[nextLeaderIndex].cardCount === 0 || this.state.players[nextLeaderIndex].eliminated) {
          nextLeaderIndex = (nextLeaderIndex + 1) % this.state.players.length;
        }
      }

      const leader = this.state.players[nextLeaderIndex];
      this.addLog(`Trick cleared! ${leader.name} wins the trick and leads a new round!`, 'info');

      // Clear trick & reset passes
      this.state.currentTrick = null;
      for (const p of this.state.players) {
        p.hasPassedCurrentRound = false;
      }

      this.state.currentTurnIndex = nextLeaderIndex;
      this.resetTurnTimer();
      this.emitStateChange();
      return;
    }

    // Otherwise, advance to next player who hasn't passed and hasn't finished
    let nextIndex = this.state.currentTurnIndex;
    const total = this.state.players.length;
    let attempts = 0;

    do {
      nextIndex = (nextIndex + 1) % total;
      const candidate = this.state.players[nextIndex];
      if (candidate.cardCount > 0 && !candidate.hasPassedCurrentRound && !candidate.eliminated) {
        break;
      }
      attempts++;
    } while (attempts < total * 2);

    this.state.currentTurnIndex = nextIndex;
    this.resetTurnTimer();
    this.emitStateChange();
  }

  private handlePlayerFinished(playerId: string) {
    const player = this.state.players.find(p => p.id === playerId)!;
    this.state.finishedRanking.push(playerId);
    const rank = this.state.finishedRanking.length;
    player.rank = rank;

    const rankTitles = ['NHẤT (1st)', 'NHÌ (2nd)', 'BA (3rd)', 'BÉT (4th)'];
    this.addLog(`🏆 ${player.name} finished all cards! Rank: ${rankTitles[rank - 1] || rank}!`, 'win', playerId);

    const remaining = this.state.players.filter(p => p.cardCount > 0 && !p.eliminated);
    if (remaining.length <= 1) {
      this.finishGame();
    }
  }

  private finishGame() {
    // Add any remaining player to final rank
    const remaining = this.state.players.filter(p => p.cardCount > 0 && !p.eliminated);
    for (const rem of remaining) {
      if (!this.state.finishedRanking.includes(rem.id)) {
        this.state.finishedRanking.push(rem.id);
        rem.rank = this.state.finishedRanking.length;
      }
    }

    // Check Cóng (Cháy bài) and Thối 2 / Hàng
    for (const player of this.state.players) {
      if (player.playedCardsCount === 0 && player.rank !== 1) {
        player.isCong = true;
        this.addLog(`⚠️ CÓNG (CHÁY BÀI): ${player.name} could not play any card!`, 'warning', player.id);
      }

      // Calculate Thối 2 & special combinations penalty
      const hand = this.hands.get(player.id) || [];
      let penalty = 0;
      for (const card of hand) {
        if (card.value === '2') {
          if (card.suit === 'spades' || card.suit === 'clubs') {
            penalty += 1; // Black 2
          } else {
            penalty += 2; // Red 2
          }
        }
      }
      player.penaltyPoints = penalty;
      if (penalty > 0) {
        this.addLog(`Thối ${penalty} điểm: ${player.name} held penalty cards at the end.`, 'info', player.id);
      }
    }

    this.emitGameOver(this.state.finishedRanking);
  }

  public handleTurnTimeout(): void {
    const current = this.getCurrentPlayer();
    if (!current || this.state.isGameOver) return;

    if (this.state.currentTrick) {
      this.addLog(`${current.name} timed out! Auto-passing turn...`, 'warning', current.id);
      this.handlePassTurn(current.id);
    } else {
      // Must lead trick; play lowest single card
      const hand = this.hands.get(current.id) || [];
      if (hand.length > 0) {
        this.addLog(`${current.name} timed out! Auto-playing lowest card...`, 'warning', current.id);
        this.handlePlayCards(current.id, [hand[0].id]);
      }
    }
  }

  public getMaskedState(playerId: string): MaskedTLGameState {
    const myHand = this.hands.get(playerId) || [];

    const maskedPlayers: MaskedTLPlayer[] = this.state.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isBot: p.isBot,
      connected: p.connected,
      cardCount: p.cardCount,
      hasPassedCurrentRound: p.hasPassedCurrentRound,
      rank: p.rank,
      isCong: p.isCong
    }));

    return {
      gameType: 'tien-len',
      players: maskedPlayers,
      currentTurnIndex: this.state.currentTurnIndex,
      direction: this.state.direction,
      turnTimeLimit: this.state.turnTimeLimit,
      turnStartTime: this.state.turnStartTime,
      isGameOver: this.state.isGameOver,
      winners: this.state.finishedRanking,
      myHand,
      currentTrick: this.state.currentTrick,
      trickHistory: this.state.trickHistory.slice(-5), // Last 5 tricks
      firstTurnRule: this.state.firstTurnRule,
      cutTwoOutOfTurnRule: this.state.cutTwoOutOfTurnRule,
      logs: this.state.logs
    };
  }

  public handleDisconnect(playerId: string): void {
    const player = this.state.players.find(p => p.id === playerId);
    if (player) {
      player.connected = false;
      this.addLog(`${player.name} disconnected.`, 'warning', playerId);
      this.emitStateChange();
    }
  }

  public handleReconnect(playerId: string): void {
    const player = this.state.players.find(p => p.id === playerId);
    if (player) {
      player.connected = true;
      this.addLog(`${player.name} reconnected!`, 'info', playerId);
      this.emitStateChange();
    }
  }

  private formatComboName(combo: CardCombo): string {
    switch (combo.type) {
      case 'single':
        return `[${combo.highestCard.value}${this.formatSuit(combo.highestCard.suit)}]`;
      case 'pair':
        return `Đôi [${combo.highestCard.value}]`;
      case 'triple':
        return `Sám cô [${combo.highestCard.value}]`;
      case 'straight':
        return `Sảnh ${combo.length} lá (đến ${combo.highestCard.value}${this.formatSuit(combo.highestCard.suit)})`;
      case 'three_pair_sequence':
        return `3 Đôi thông (đến ${combo.highestCard.value})`;
      case 'four_of_a_kind':
        return `Tứ quý [${combo.highestCard.value}]`;
      case 'four_pair_sequence':
        return `4 Đôi thông (đến ${combo.highestCard.value})`;
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
