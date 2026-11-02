import { CardEvaluator } from '../../tien-len/CardEvaluator';
import { CardCombo, TLCard } from '../../tien-len/types';
import { TienLenGame } from '../../tien-len/TienLenGame';

export class TienLenBotStrategy {
  public static decideAction(botId: string, game: TienLenGame) {
    const maskedState = game.getMaskedState(botId);
    const myHand = CardEvaluator.sortCards(maskedState.myHand);

    if (myHand.length === 0) return;

    // 1. Check for 4 Đôi thông out-of-turn cut
    if (maskedState.currentTrick) {
      const fourPairs = this.findFourPairSequences(myHand);
      if (fourPairs.length > 0) {
        for (const fp of fourPairs) {
          if (CardEvaluator.canBeat(fp, maskedState.currentTrick.combo)) {
            game.handleAction(botId, {
              type: 'PLAY_CARDS',
              cardIds: fp.cards.map((c: TLCard) => c.id)
            });
            return;
          }
        }
      }
    }

    // Check if it's bot's turn
    const currentTurnPlayer = maskedState.players[maskedState.currentTurnIndex];
    if (!currentTurnPlayer || currentTurnPlayer.id !== botId) {
      return;
    }

    const currentTrick = maskedState.currentTrick;

    // 2. Leading the trick (currentTrick is null)
    if (!currentTrick) {
      this.leadTrick(botId, game, myHand, maskedState.firstTurnRule, maskedState.trickHistory.length === 0);
      return;
    }

    // 3. Following the trick (must beat currentTrick)
    this.followTrick(botId, game, myHand, currentTrick.combo);
  }

  private static leadTrick(
    botId: string,
    game: TienLenGame,
    hand: TLCard[],
    firstTurnRule: boolean,
    isFirstTrickOfGame: boolean
  ) {
    const allCombos = this.generateAllValidCombos(hand);

    // If first turn rule: must include 3 of spades
    if (firstTurnRule && isFirstTrickOfGame) {
      const threeSpadesCombos = allCombos.filter(c =>
        c.cards.some((card: TLCard) => card.value === '3' && card.suit === 'spades')
      );
      if (threeSpadesCombos.length > 0) {
        // Play straight first, then pair, then single
        threeSpadesCombos.sort((a, b) => b.length - a.length);
        game.handleAction(botId, {
          type: 'PLAY_CARDS',
          cardIds: threeSpadesCombos[0].cards.map((c: TLCard) => c.id)
        });
        return;
      }
    }

    // Normal lead: prefer shedding low straights, then pairs/triples, then lowest single
    const straights = allCombos.filter(c => c.type === 'straight').sort((a, b) => a.highestCard.overallRank - b.highestCard.overallRank);
    if (straights.length > 0) {
      game.handleAction(botId, { type: 'PLAY_CARDS', cardIds: straights[0].cards.map((c: TLCard) => c.id) });
      return;
    }

    const pairs = allCombos.filter(c => c.type === 'pair').sort((a, b) => a.highestCard.overallRank - b.highestCard.overallRank);
    if (pairs.length > 0 && pairs[0].highestCard.rankValue < 15) { // Don't lead with pair of 2s
      game.handleAction(botId, { type: 'PLAY_CARDS', cardIds: pairs[0].cards.map((c: TLCard) => c.id) });
      return;
    }

    // Otherwise play lowest single (non-2 if possible)
    const nonTwos = hand.filter(c => c.rankValue < 15);
    const cardToLead = nonTwos.length > 0 ? nonTwos[0] : hand[0];
    game.handleAction(botId, { type: 'PLAY_CARDS', cardIds: [cardToLead.id] });
  }

  private static followTrick(botId: string, game: TienLenGame, hand: TLCard[], targetCombo: CardCombo) {
    const allCombos = this.generateAllValidCombos(hand);
    const validBeatingCombos = allCombos.filter(c => CardEvaluator.canBeat(c, targetCombo));

    if (validBeatingCombos.length === 0) {
      // Cannot beat -> Pass
      game.handleAction(botId, { type: 'PASS_TURN' });
      return;
    }

    // Sort valid combos by highest card overall rank (ascending)
    validBeatingCombos.sort((a, b) => a.highestCard.overallRank - b.highestCard.overallRank);

    // Filter out wasting high '2' cards on low tricks unless necessary
    const bestCombo = validBeatingCombos[0];

    // If best combo uses a 2, but target is a low card (< 10), and bot has more cards, pass to save the 2
    if (bestCombo.type === 'single' && bestCombo.highestCard.rankValue === 15 && targetCombo.highestCard.rankValue < 10 && hand.length > 3) {
      game.handleAction(botId, { type: 'PASS_TURN' });
      return;
    }

    game.handleAction(botId, {
      type: 'PLAY_CARDS',
      cardIds: bestCombo.cards.map((c: TLCard) => c.id)
    });
  }

  private static generateAllValidCombos(hand: TLCard[]): CardCombo[] {
    const combos: CardCombo[] = [];

    // Singles
    for (const card of hand) {
      combos.push({ type: 'single', cards: [card], highestCard: card, length: 1 });
    }

    // Pairs & Triples & Four of a Kind
    const rankGroups = new Map<number, TLCard[]>();
    for (const card of hand) {
      const arr = rankGroups.get(card.rankValue) || [];
      arr.push(card);
      rankGroups.set(card.rankValue, arr);
    }

    for (const [, cards] of rankGroups.entries()) {
      if (cards.length >= 2) {
        for (let i = 0; i < cards.length - 1; i++) {
          for (let j = i + 1; j < cards.length; j++) {
            const pairCards = [cards[i], cards[j]];
            combos.push({
              type: 'pair',
              cards: pairCards,
              highestCard: pairCards[1],
              length: 2
            });
          }
        }
      }
      if (cards.length >= 3) {
        combos.push({
          type: 'triple',
          cards: cards.slice(0, 3),
          highestCard: cards[2],
          length: 3
        });
      }
      if (cards.length === 4) {
        combos.push({
          type: 'four_of_a_kind',
          cards: cards,
          highestCard: cards[3],
          length: 4
        });
      }
    }

    // Straights (lengths 3 to 12, no 2s)
    const nonTwos = hand.filter(c => c.rankValue < 15);
    const uniqueRanks = Array.from(new Set(nonTwos.map(c => c.rankValue))).sort((a, b) => a - b);

    for (let i = 0; i < uniqueRanks.length; i++) {
      const straightRanks: number[] = [uniqueRanks[i]];
      for (let j = i + 1; j < uniqueRanks.length; j++) {
        if (uniqueRanks[j] === straightRanks[straightRanks.length - 1] + 1) {
          straightRanks.push(uniqueRanks[j]);
          if (straightRanks.length >= 3) {
            // Build straight combinations
            const straightCards = straightRanks.map(r => nonTwos.find(c => c.rankValue === r)!);
            combos.push({
              type: 'straight',
              cards: straightCards,
              highestCard: straightCards[straightCards.length - 1],
              length: straightCards.length
            });
          }
        } else {
          break;
        }
      }
    }

    // 3 Đôi thông & 4 Đôi thông
    combos.push(...this.findThreePairSequences(hand));
    combos.push(...this.findFourPairSequences(hand));

    return combos;
  }

  private static findThreePairSequences(hand: TLCard[]): CardCombo[] {
    const res: CardCombo[] = [];
    const rankPairs = new Map<number, TLCard[]>();
    for (const c of hand.filter(c => c.rankValue < 15)) {
      const arr = rankPairs.get(c.rankValue) || [];
      arr.push(c);
      rankPairs.set(c.rankValue, arr);
    }

    const availableRanks = Array.from(rankPairs.entries())
      .filter(([, cards]) => cards.length >= 2)
      .map(([rank]) => rank)
      .sort((a, b) => a - b);

    for (let i = 0; i <= availableRanks.length - 3; i++) {
      if (availableRanks[i + 1] === availableRanks[i] + 1 &&
          availableRanks[i + 2] === availableRanks[i] + 2) {
        const cards = [
          ...rankPairs.get(availableRanks[i])!.slice(0, 2),
          ...rankPairs.get(availableRanks[i + 1])!.slice(0, 2),
          ...rankPairs.get(availableRanks[i + 2])!.slice(0, 2)
        ];
        res.push({
          type: 'three_pair_sequence',
          cards,
          highestCard: cards[cards.length - 1],
          length: 6
        });
      }
    }
    return res;
  }

  private static findFourPairSequences(hand: TLCard[]): CardCombo[] {
    const res: CardCombo[] = [];
    const rankPairs = new Map<number, TLCard[]>();
    for (const c of hand.filter(c => c.rankValue < 15)) {
      const arr = rankPairs.get(c.rankValue) || [];
      arr.push(c);
      rankPairs.set(c.rankValue, arr);
    }

    const availableRanks = Array.from(rankPairs.entries())
      .filter(([, cards]) => cards.length >= 2)
      .map(([rank]) => rank)
      .sort((a, b) => a - b);

    for (let i = 0; i <= availableRanks.length - 4; i++) {
      if (availableRanks[i + 1] === availableRanks[i] + 1 &&
          availableRanks[i + 2] === availableRanks[i] + 2 &&
          availableRanks[i + 3] === availableRanks[i] + 3) {
        const cards = [
          ...rankPairs.get(availableRanks[i])!.slice(0, 2),
          ...rankPairs.get(availableRanks[i + 1])!.slice(0, 2),
          ...rankPairs.get(availableRanks[i + 2])!.slice(0, 2),
          ...rankPairs.get(availableRanks[i + 3])!.slice(0, 2)
        ];
        res.push({
          type: 'four_pair_sequence',
          cards,
          highestCard: cards[cards.length - 1],
          length: 8
        });
      }
    }
    return res;
  }
}
