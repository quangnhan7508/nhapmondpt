import crypto from 'crypto';
import { BaseGame } from '../BaseGame';
import { UnoDeck } from './UnoDeck';
import {
  MaskedUnoGameState,
  MaskedUnoPlayer,
  UnoAction,
  UnoCard,
  UnoColor,
  UnoGameState,
  UnoPlayer,
  UnoRules,
  UnoValue
} from './types';

export class UnoGame extends BaseGame<UnoGameState, UnoAction, MaskedUnoGameState> {
  private drawPile: UnoCard[] = [];
  private discardPile: UnoCard[] = [];
  private hands: Map<string, UnoCard[]> = new Map();

  constructor(
    players: { id: string; name: string; avatar: string; isBot: boolean }[],
    options: {
      mode?: UnoGameState['mode'];
      rules?: Partial<UnoRules>;
      turnTimeLimit?: number;
    } = {}
  ) {
    const mode = options.mode || 'classic';
    const defaultRules: UnoRules = {
      freeStacking: true,
      jumpIn: true,
      sevenZero: true,
      unoPenalty: true,
      mercyLimit: mode === 'no-mercy' ? 25 : 999,
      drawToMatch: mode === 'no-mercy',
      ...(options.rules || {})
    };

    const unoPlayers: UnoPlayer[] = players.map(p => ({
      ...p,
      connected: true,
      cardCount: 0,
      hasCalledUno: false,
      flexPowerActive: true,
      eliminated: false,
      score: 0
    }));

    const initialState: UnoGameState = {
      gameType: 'uno',
      mode,
      rules: defaultRules,
      activeColor: 'red',
      topCard: { id: 'init', color: 'red', value: '0', pointValue: 0 },
      pendingDrawCount: 0,
      pendingDrawType: null,
      drawPileCount: 0,
      calledUnoMap: {},
      players: unoPlayers,
      currentTurnIndex: 0,
      direction: 1,
      turnTimeLimit: options.turnTimeLimit || 30,
      turnStartTime: Date.now(),
      isGameOver: false,
      winners: [],
      logs: [],
      lastPlayTimestamp: Date.now()
    };

    super(initialState);
  }

  public start(): void {
    this.drawPile = BaseGame.shuffleDeck(UnoDeck.createDeck(this.state.mode));
    this.discardPile = [];
    this.hands.clear();

    // Deal 7 cards to each player
    for (const player of this.state.players) {
      const hand = this.drawPile.splice(0, 7);
      this.hands.set(player.id, hand);
      player.cardCount = hand.length;
      player.hasCalledUno = false;
      player.flexPowerActive = true;
      player.eliminated = false;
      this.state.calledUnoMap[player.id] = false;
    }

    // Find initial non-wild card if possible
    let top = this.drawPile.pop()!;
    let attempts = 0;
    while (top.color === 'wild' && attempts < 10) {
      this.drawPile.unshift(top);
      top = this.drawPile.pop()!;
      attempts++;
    }

    this.discardPile.push(top);
    this.state.topCard = top;
    this.state.activeColor = top.color === 'wild' ? 'red' : top.color;
    this.state.drawPileCount = this.drawPile.length;
    this.state.currentTurnIndex = 0;
    this.state.direction = 1;
    this.state.pendingDrawCount = 0;
    this.state.isGameOver = false;

    this.addLog(`Game started! Top card is ${this.formatCard(top)}.`, 'info');
    this.resetTurnTimer();
    this.emitStateChange();
  }

  public handleAction(playerId: string, action: UnoAction): { success: boolean; message?: string } {
    if (this.state.isGameOver) {
      return { success: false, message: 'Game is already over.' };
    }

    const playerIndex = this.state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      return { success: false, message: 'Player not in game.' };
    }

    const player = this.state.players[playerIndex];
    if (player.eliminated) {
      return { success: false, message: 'Player is eliminated.' };
    }

    // Handle JUMP_IN (can be played out of turn)
    if (action.type === 'JUMP_IN') {
      return this.handleJumpIn(playerId, action);
    }

    // Handle CATCH_UNO (can be played at any time)
    if (action.type === 'CATCH_UNO') {
      return this.handleCatchUno(playerId, action.targetPlayerId);
    }

    // Handle CALL_UNO
    if (action.type === 'CALL_UNO') {
      return this.handleCallUno(playerId);
    }

    // In-turn actions check
    if (this.state.currentTurnIndex !== playerIndex) {
      return { success: false, message: 'Not your turn.' };
    }

    if (action.type === 'DRAW_CARD') {
      return this.handleDrawCard(playerId);
    }

    if (action.type === 'PLAY_CARD') {
      return this.handlePlayCard(playerId, action);
    }

    return { success: false, message: 'Unknown action.' };
  }

  private handleJumpIn(playerId: string, action: Extract<UnoAction, { type: 'JUMP_IN' }>): { success: boolean; message?: string } {
    if (!this.state.rules.jumpIn) {
      return { success: false, message: 'Jump-In rule is disabled.' };
    }

    const hand = this.hands.get(playerId);
    if (!hand) return { success: false, message: 'Hand not found.' };

    const card = hand.find(c => c.id === action.cardId);
    if (!card) return { success: false, message: 'Card not found in hand.' };

    // Jump-in requirement: exact color AND exact value
    const top = this.state.topCard;
    const isExactMatch = (card.color === top.color && card.value === top.value) ||
      (card.color === 'wild' && card.value === top.value);

    if (!isExactMatch) {
      return { success: false, message: 'Jump-in requires an exact match of color and value!' };
    }

    // Jump-in is valid! Set turn directly to this player
    const playerIndex = this.state.players.findIndex(p => p.id === playerId);
    this.state.currentTurnIndex = playerIndex;
    this.addLog(`${this.state.players[playerIndex].name} JUMPED IN out of turn!`, 'special', playerId);

    return this.executePlayCard(playerId, card, action.chosenColor, action.isFlex, action.targetPlayerId);
  }

  private handlePlayCard(playerId: string, action: Extract<UnoAction, { type: 'PLAY_CARD' }>): { success: boolean; message?: string } {
    const hand = this.hands.get(playerId);
    if (!hand) return { success: false, message: 'Hand not found.' };

    const card = hand.find(c => c.id === action.cardId);
    if (!card) return { success: false, message: 'Card not found in hand.' };

    const isValid = this.isPlayValid(card, action.isFlex, playerId);
    if (!isValid) {
      return { success: false, message: 'Invalid card play.' };
    }

    return this.executePlayCard(playerId, card, action.chosenColor, action.isFlex, action.targetPlayerId);
  }

  public isPlayValid(card: UnoCard, isFlex: boolean = false, playerId: string): boolean {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return false;

    // Check flex permission
    if (isFlex && !player.flexPowerActive) {
      return false;
    }

    const effectiveColor = isFlex && card.flexColor ? card.flexColor : card.color;
    const effectiveValue = isFlex && card.flexValue ? card.flexValue : card.value;

    // Free Stacking check
    if (this.state.pendingDrawCount > 0) {
      const drawValues: Record<string, number> = {
        'draw_two': 2,
        'draw_four': 4,
        'wild_draw_four': 4,
        'wild_reverse_draw_four': 4,
        'wild_draw_six': 6,
        'wild_draw_eight': 8,
        'wild_draw_ten': 10
      };
      const cardDrawVal = drawValues[effectiveValue] || 0;

      if (cardDrawVal === 0) {
        return false;
      }

      if (this.state.rules.freeStacking) {
        // Universal Stacking: all draw cards can stack onto each other regardless of value!
        // Wild draw cards (+4, +6, +8, +10, wild reverse 4) can always stack.
        if (effectiveColor === 'wild') {
          return true;
        }
        // Colored draw cards can stack if matching active color, or matching same draw type
        if (effectiveColor === this.state.activeColor) {
          return true;
        }
        if (effectiveValue === this.state.topCard.value || effectiveValue === this.state.pendingDrawType) {
          return true;
        }
        return false;
      } else {
        // Strict mode: must match exact draw card type
        if (effectiveValue !== this.state.pendingDrawType) {
          return false;
        }
        if (effectiveColor === 'wild' || effectiveColor === this.state.activeColor) {
          return true;
        }
        return effectiveValue === this.state.topCard.value;
      }
    }

    // Normal play check
    if (effectiveColor === 'wild') return true;
    if (effectiveColor === this.state.activeColor) return true;
    if (effectiveValue === this.state.topCard.value) return true;

    return false;
  }

  private executePlayCard(
    playerId: string,
    card: UnoCard,
    chosenColor?: UnoColor,
    isFlex: boolean = false,
    targetPlayerId?: string
  ): { success: boolean; message?: string } {
    const hand = this.hands.get(playerId)!;
    const playerIndex = this.state.players.findIndex(p => p.id === playerId);
    const player = this.state.players[playerIndex];

    // Remove card from hand
    const cardIndex = hand.findIndex(c => c.id === card.id);
    hand.splice(cardIndex, 1);
    player.cardCount = hand.length;

    // Put on discard pile
    this.discardPile.push(card);
    this.state.topCard = card;
    this.state.lastPlayedBy = playerId;
    this.state.lastPlayedCard = card;
    this.state.lastPlayTimestamp = Date.now();

    // Consume flex power if flex action was used
    if (isFlex) {
      player.flexPowerActive = false;
      this.addLog(`${player.name} flipped their Flex Power to Red!`, 'special', playerId);
    }

    const effectiveColor = isFlex && card.flexColor ? card.flexColor : card.color;
    const effectiveValue = isFlex && card.flexValue ? card.flexValue : card.value;

    // Set active color
    if (effectiveColor === 'wild') {
      this.state.activeColor = chosenColor && chosenColor !== 'wild' ? chosenColor : 'red';
    } else {
      this.state.activeColor = effectiveColor;
    }

    this.addLog(
      `${player.name} played ${this.formatCard(card)}${isFlex ? ' (FLEX)' : ''}. Active color: ${this.state.activeColor.toUpperCase()}.`,
      'action',
      playerId
    );

    // Check Win condition
    if (hand.length === 0) {
      this.handlePlayerWon(playerId);
      return { success: true };
    }

    // Check Uno reminder
    if (hand.length === 1 && !this.state.calledUnoMap[playerId]) {
      this.addLog(`${player.name} has 1 card left! (UNO not called yet!)`, 'warning', playerId);
    }

    // Apply Card Special Actions
    this.applyCardEffects(player, effectiveValue, targetPlayerId);

    return { success: true };
  }

  private applyCardEffects(player: UnoPlayer, effectiveValue: UnoValue, targetPlayerId?: string) {
    let advanceStep = 1;

    switch (effectiveValue) {
      case 'skip':
        advanceStep = 2;
        this.addLog(`Next player was skipped!`, 'special');
        break;

      case 'reverse':
        this.state.direction = (this.state.direction * -1) as (1 | -1);
        this.addLog(`Play direction reversed!`, 'special');
        break;

      case 'draw_two':
        this.state.pendingDrawCount += 2;
        this.state.pendingDrawType = 'draw_two';
        this.addLog(`+2 Draw stacked! Total penalty: +${this.state.pendingDrawCount}`, 'special');
        if (!this.state.rules.freeStacking) {
          this.resolvePendingDrawOnNext();
          return;
        }
        break;

      case 'wild_draw_four':
        this.state.pendingDrawCount += 4;
        this.state.pendingDrawType = 'wild_draw_four';
        this.addLog(`+4 Draw stacked! Total penalty: +${this.state.pendingDrawCount}`, 'special');
        if (!this.state.rules.freeStacking) {
          this.resolvePendingDrawOnNext();
          return;
        }
        break;

      case 'wild_draw_six':
        this.state.pendingDrawCount += 6;
        this.state.pendingDrawType = 'wild_draw_six';
        this.addLog(`+6 Draw stacked! Total penalty: +${this.state.pendingDrawCount}`, 'special');
        if (!this.state.rules.freeStacking) {
          this.resolvePendingDrawOnNext();
          return;
        }
        break;

      case 'wild_draw_eight':
        this.state.pendingDrawCount += 8;
        this.state.pendingDrawType = 'wild_draw_eight';
        this.addLog(`BRUTAL +8 Draw stacked! Total penalty: +${this.state.pendingDrawCount}`, 'special');
        if (!this.state.rules.freeStacking) {
          this.resolvePendingDrawOnNext();
          return;
        }
        break;

      case 'wild_draw_ten':
        this.state.pendingDrawCount += 10;
        this.state.pendingDrawType = 'wild_draw_ten';
        this.addLog(`EXTREME +10 Draw stacked! Total penalty: +${this.state.pendingDrawCount}`, 'special');
        if (!this.state.rules.freeStacking) {
          this.resolvePendingDrawOnNext();
          return;
        }
        break;

      case 'draw_four':
        this.state.pendingDrawCount += 4;
        this.state.pendingDrawType = 'draw_four';
        this.addLog(`+4 Draw stacked! Total penalty: +${this.state.pendingDrawCount}`, 'special');
        if (!this.state.rules.freeStacking) {
          this.resolvePendingDrawOnNext();
          return;
        }
        break;

      case 'wild_reverse_draw_four':
        this.state.direction = (this.state.direction * -1) as (1 | -1);
        this.addLog(`Reverse Draw 4! Direction reversed & +4 stacked! Total: +${this.state.pendingDrawCount + 4}`, 'special');
        this.state.pendingDrawCount += 4;
        this.state.pendingDrawType = 'wild_reverse_draw_four';
        if (!this.state.rules.freeStacking) {
          this.resolvePendingDrawOnNext();
          return;
        }
        break;

      case 'skip_everyone':
        advanceStep = 0; // Current player gets another turn!
        this.addLog(`${player.name} skipped EVERYONE and plays again!`, 'special', player.id);
        break;

      case 'discard_all':
        this.handleDiscardAll(player.id, this.state.activeColor);
        break;

      case 'wild_color_roulette':
        this.handleColorRoulette();
        return;

      case 'flex_all_flip':
        // Flip all players' power cards
        for (const p of this.state.players) {
          p.flexPowerActive = !p.flexPowerActive;
        }
        this.addLog(`All players' Flex Powers flipped!`, 'special');
        break;

      case '7':
        if (this.state.rules.sevenZero && targetPlayerId) {
          this.handleSevenSwap(player.id, targetPlayerId);
        }
        break;

      case '0':
        if (this.state.rules.sevenZero) {
          this.handleZeroRotate();
        }
        break;
    }

    this.advanceTurn(advanceStep);
  }

  private handleDiscardAll(playerId: string, color: UnoColor) {
    const hand = this.hands.get(playerId);
    if (!hand) return;

    const cardsToDiscard = hand.filter(c => c.color === color);
    if (cardsToDiscard.length > 0) {
      this.hands.set(playerId, hand.filter(c => c.color !== color));
      const player = this.state.players.find(p => p.id === playerId)!;
      player.cardCount = this.hands.get(playerId)!.length;
      this.discardPile.push(...cardsToDiscard);
      this.addLog(`${player.name} discarded ALL ${cardsToDiscard.length} ${color.toUpperCase()} cards!`, 'special', playerId);

      if (player.cardCount === 0) {
        this.handlePlayerWon(playerId);
      }
    }
  }

  private handleColorRoulette() {
    const nextIndex = this.getNextPlayerIndex(1);
    const victim = this.state.players[nextIndex];
    const targetColor = this.state.activeColor;
    const drawn: UnoCard[] = [];

    this.addLog(`Color Roulette triggered on ${victim.name}! Drawing until ${targetColor.toUpperCase()}...`, 'warning', victim.id);

    let found = false;
    let count = 0;
    while (!found && count < 25) {
      const card = this.drawOneCardFromPile();
      if (!card) break;
      drawn.push(card);
      count++;
      if (card.color === targetColor || card.color === 'wild') {
        found = true;
      }
    }

    const victimHand = this.hands.get(victim.id)!;
    victimHand.push(...drawn);
    victim.cardCount = victimHand.length;

    this.addLog(`${victim.name} drew ${drawn.length} cards from Color Roulette!`, 'special', victim.id);
    this.checkMercyElimination(victim.id);

    this.advanceTurn(2); // Skip victim's turn
  }

  private handleSevenSwap(p1Id: string, p2Id: string) {
    const h1 = this.hands.get(p1Id);
    const h2 = this.hands.get(p2Id);
    if (!h1 || !h2) return;

    this.hands.set(p1Id, h2);
    this.hands.set(p2Id, h1);

    const player1 = this.state.players.find(p => p.id === p1Id)!;
    const player2 = this.state.players.find(p => p.id === p2Id)!;

    player1.cardCount = h2.length;
    player2.cardCount = h1.length;

    this.addLog(`7-Rule: ${player1.name} swapped hands with ${player2.name}!`, 'special', p1Id);
  }

  private handleZeroRotate() {
    const activePlayers = this.state.players.filter(p => !p.eliminated);
    if (activePlayers.length <= 1) return;

    const oldHands = new Map(this.hands);
    const total = activePlayers.length;

    for (let i = 0; i < total; i++) {
      const fromPlayer = activePlayers[i];
      const toIndex = (i + this.state.direction + total) % total;
      const toPlayer = activePlayers[toIndex];

      const handToGive = oldHands.get(fromPlayer.id)!;
      this.hands.set(toPlayer.id, handToGive);
      toPlayer.cardCount = handToGive.length;
    }

    this.addLog(`0-Rule: All players passed their hands ${this.state.direction === 1 ? 'clockwise' : 'counter-clockwise'}!`, 'special');
  }

  private handleDrawCard(playerId: string): { success: boolean; message?: string } {
    const player = this.state.players.find(p => p.id === playerId)!;
    const hand = this.hands.get(playerId)!;

    // If there is pending draw penalty, player takes all stacked cards
    if (this.state.pendingDrawCount > 0) {
      const count = this.state.pendingDrawCount;
      const drawnCards: UnoCard[] = [];
      for (let i = 0; i < count; i++) {
        const card = this.drawOneCardFromPile();
        if (card) drawnCards.push(card);
      }

      hand.push(...drawnCards);
      player.cardCount = hand.length;
      this.addLog(`${player.name} could not stack and drew ${count} cards!`, 'warning', playerId);

      this.state.pendingDrawCount = 0;
      this.state.pendingDrawType = null;

      this.checkMercyElimination(playerId);
      this.advanceTurn(1);
      return { success: true };
    }

    // Draw-to-match rule in No Mercy: keep drawing until a playable card is found
    if (this.state.rules.drawToMatch) {
      let foundPlayable = false;
      let drawCount = 0;
      while (!foundPlayable) {
        const drawn = this.drawOneCardFromPile();
        if (!drawn) break;
        hand.push(drawn);
        player.cardCount = hand.length;
        drawCount++;

        // Check mercy elimination after each card
        if (player.cardCount >= this.state.rules.mercyLimit) {
          this.addLog(`${player.name} drew ${drawCount} cards trying to find a match!`, 'warning', playerId);
          this.checkMercyElimination(playerId);
          if (player.eliminated) {
            this.advanceTurn(1);
            return { success: true };
          }
        }

        // Check if drawn card is playable
        if (this.isPlayValid(drawn, false, playerId)) {
          foundPlayable = true;
        }
      }
      this.addLog(`${player.name} drew ${drawCount} card${drawCount > 1 ? 's' : ''} (draw-to-match).`, 'action', playerId);
      this.checkMercyElimination(playerId);
      this.advanceTurn(1);
      return { success: true };
    }

    // Normal draw 1 card
    const drawn = this.drawOneCardFromPile();
    if (!drawn) {
      this.advanceTurn(1);
      return { success: false, message: 'Draw pile empty.' };
    }

    hand.push(drawn);
    player.cardCount = hand.length;
    this.addLog(`${player.name} drew a card.`, 'action', playerId);

    this.checkMercyElimination(playerId);
    this.advanceTurn(1);
    return { success: true };
  }

  private resolvePendingDrawOnNext() {
    const nextIndex = this.getNextPlayerIndex(1);
    const nextPlayer = this.state.players[nextIndex];
    const hand = this.hands.get(nextPlayer.id)!;

    const count = this.state.pendingDrawCount;
    for (let i = 0; i < count; i++) {
      const card = this.drawOneCardFromPile();
      if (card) hand.push(card);
    }
    nextPlayer.cardCount = hand.length;
    this.addLog(`${nextPlayer.name} drew ${count} cards and skipped their turn!`, 'warning', nextPlayer.id);

    this.state.pendingDrawCount = 0;
    this.state.pendingDrawType = null;

    this.checkMercyElimination(nextPlayer.id);
    this.advanceTurn(2); // Skip their turn
  }

  private handleCallUno(playerId: string): { success: boolean; message?: string } {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return { success: false, message: 'Player not found.' };

    this.state.calledUnoMap[playerId] = true;
    player.hasCalledUno = true;
    this.addLog(`${player.name} SHOUTED "UNO!" 🔥`, 'special', playerId);
    this.emitStateChange();
    return { success: true };
  }

  private handleCatchUno(catcherId: string, targetPlayerId: string): { success: boolean; message?: string } {
    const catcher = this.state.players.find(p => p.id === catcherId)!;
    const target = this.state.players.find(p => p.id === targetPlayerId);

    if (!target) return { success: false, message: 'Target not found.' };
    if (target.cardCount !== 1) {
      return { success: false, message: 'Target does not have 1 card.' };
    }

    if (this.state.calledUnoMap[targetPlayerId]) {
      return { success: false, message: 'Target already called UNO.' };
    }

    // Catch success! Target draws 2 penalty cards
    const targetHand = this.hands.get(targetPlayerId)!;
    const p1 = this.drawOneCardFromPile();
    const p2 = this.drawOneCardFromPile();
    if (p1) targetHand.push(p1);
    if (p2) targetHand.push(p2);
    target.cardCount = targetHand.length;

    this.addLog(`${catcher.name} CAUGHT ${target.name} failing to call UNO! +2 Cards penalty!`, 'warning', catcherId);
    this.checkMercyElimination(targetPlayerId);

    this.emitStateChange();
    return { success: true };
  }

  private checkMercyElimination(playerId: string) {
    if (this.state.mode !== 'no-mercy') return;

    const player = this.state.players.find(p => p.id === playerId);
    if (!player || player.eliminated) return;

    if (player.cardCount >= this.state.rules.mercyLimit) {
      player.eliminated = true;
      player.mercyEliminated = true;

      // Discard all their cards
      const hand = this.hands.get(playerId) || [];
      this.discardPile.push(...hand);
      this.hands.set(playerId, []);
      player.cardCount = 0;

      this.addLog(`💀 MERCY RULE: ${player.name} reached ${this.state.rules.mercyLimit} cards and was ELIMINATED!`, 'warning', playerId);

      // Check remaining players
      const remaining = this.state.players.filter(p => !p.eliminated);
      if (remaining.length === 1) {
        this.handlePlayerWon(remaining[0].id);
      }
    }
  }

  private drawOneCardFromPile(): UnoCard | null {
    if (this.drawPile.length === 0) {
      if (this.discardPile.length <= 1) {
        return null;
      }
      // Reshuffle discard pile except top card
      const top = this.discardPile.pop()!;
      this.drawPile = BaseGame.shuffleDeck(this.discardPile);
      this.discardPile = [top];
      this.addLog('Draw pile exhausted; reshuffled discard pile into draw deck.', 'info');
    }

    const card = this.drawPile.pop() || null;
    this.state.drawPileCount = this.drawPile.length;
    return card;
  }

  private advanceTurn(step: number = 1) {
    if (this.state.isGameOver) return;

    if (step > 0) {
      this.state.currentTurnIndex = this.getNextPlayerIndex(step);
    }

    const nextPlayer = this.getCurrentPlayer();
    if (nextPlayer) {
      this.addLog(`Turn passes to ${nextPlayer.name}.`, 'info');
    }

    this.resetTurnTimer();
    this.emitStateChange();
  }

  public handleTurnTimeout(): void {
    const current = this.getCurrentPlayer();
    if (!current || this.state.isGameOver) return;

    this.addLog(`${current.name} timed out! Auto-drawing card...`, 'warning', current.id);
    this.handleDrawCard(current.id);
  }

  private handlePlayerWon(playerId: string) {
    const winner = this.state.players.find(p => p.id === playerId);
    const winnerName = winner ? winner.name : 'Unknown';
    this.addLog(`🎉 ${winnerName} WON THE GAME!`, 'win', playerId);
    this.emitGameOver([playerId]);
  }

  public getMaskedState(playerId: string): MaskedUnoGameState {
    const myHand = this.hands.get(playerId) || [];
    const myPlayer = this.state.players.find(p => p.id === playerId);

    const maskedPlayers: MaskedUnoPlayer[] = this.state.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isBot: p.isBot,
      connected: p.connected,
      cardCount: p.cardCount,
      hasCalledUno: this.state.calledUnoMap[p.id] || false,
      flexPowerActive: p.flexPowerActive,
      eliminated: p.eliminated,
      score: p.score
    }));

    // Find opponents that can be caught
    const canCatchUno: string[] = [];
    for (const p of this.state.players) {
      if (p.id !== playerId && p.cardCount === 1 && !this.state.calledUnoMap[p.id] && !p.eliminated) {
        canCatchUno.push(p.id);
      }
    }

    return {
      gameType: 'uno',
      mode: this.state.mode,
      rules: this.state.rules,
      activeColor: this.state.activeColor,
      topCard: this.state.topCard,
      lastPlayedBy: this.state.lastPlayedBy,
      lastPlayedCard: this.state.lastPlayedCard,
      lastPlayTimestamp: this.state.lastPlayTimestamp,
      pendingDrawCount: this.state.pendingDrawCount,
      drawPileCount: this.drawPile.length,
      currentTurnIndex: this.state.currentTurnIndex,
      direction: this.state.direction,
      turnTimeLimit: this.state.turnTimeLimit,
      turnStartTime: this.state.turnStartTime,
      isGameOver: this.state.isGameOver,
      winners: this.state.winners,
      players: maskedPlayers,
      myHand,
      myFlexPower: myPlayer?.flexPowerActive ?? true,
      canCallUno: myHand.length <= 2 && !(this.state.calledUnoMap[playerId]),
      canCatchUno,
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

  private formatCard(card: UnoCard): string {
    const valStr = card.value.toUpperCase().replace(/_/g, ' ');
    const colStr = card.color.toUpperCase();
    return `[${colStr} ${valStr}]`;
  }
}
