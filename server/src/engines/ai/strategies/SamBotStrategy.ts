import { SamCardEvaluator } from '../../sam/SamCardEvaluator';
import { SamCard, SamCardCombo } from '../../sam/types';
import { SamGame } from '../../sam/SamGame';

export class SamBotStrategy {
  public static decideAction(botId: string, game: SamGame) {
    const maskedState = game.getMaskedState(botId);
    const myHand = SamCardEvaluator.sortCards(maskedState.myHand);

    if (myHand.length === 0) return;

    // 1. Phase Báo Sâm
    if (maskedState.phase === 'bao_sam') {
      const myPlayer = maskedState.players.find(p => p.id === botId);
      if (myPlayer?.hasPassedCurrentRound || (myPlayer as any)?.hasBaoSamResponded) {
        return;
      }

      // Check if bot should call Sâm (Aggressive hand with at least 8 strong cards)
      const allCombos = this.generateAllValidCombos(myHand);
      const straights = allCombos.filter(c => c.type === 'straight' && c.length >= 7);
      const fourOfAKinds = allCombos.filter(c => c.type === 'four_of_a_kind');
      const twos = myHand.filter(c => c.rankValue === 15);

      const isVeryStrong = (straights.length > 0 && (twos.length >= 2 || fourOfAKinds.length > 0)) ||
                           (twos.length >= 3) ||
                           (fourOfAKinds.length >= 2);

      if (isVeryStrong && !maskedState.samCallerId) {
        game.handleAction(botId, { type: 'BAO_SAM', baoSam: true });
      } else {
        game.handleAction(botId, { type: 'BAO_SAM', baoSam: false });
      }
      return;
    }

    // 2. Phase Playing
    const currentTurnPlayer = maskedState.players[maskedState.currentTurnIndex];
    if (!currentTurnPlayer || currentTurnPlayer.id !== botId) {
      return;
    }

    const currentTrick = maskedState.currentTrick;

    // Leading the trick
    if (!currentTrick) {
      this.leadTrick(botId, game, myHand);
      return;
    }

    // Following the trick
    this.followTrick(botId, game, myHand, currentTrick.combo);
  }

  private static leadTrick(botId: string, game: SamGame, hand: SamCard[]) {
    const allCombos = this.generateAllValidCombos(hand);

    // Prefer playing straights first
    const straights = allCombos.filter(c => c.type === 'straight').sort((a, b) => a.highestCard.rankValue - b.highestCard.rankValue);
    if (straights.length > 0) {
      game.handleAction(botId, { type: 'PLAY_CARDS', cardIds: straights[0].cards.map(c => c.id) });
      return;
    }

    // Then triples
    const triples = allCombos.filter(c => c.type === 'triple').sort((a, b) => a.highestCard.rankValue - b.highestCard.rankValue);
    if (triples.length > 0) {
      game.handleAction(botId, { type: 'PLAY_CARDS', cardIds: triples[0].cards.map(c => c.id) });
      return;
    }

    // Then pairs (avoid leading with pair of 2s unless necessary)
    const pairs = allCombos.filter(c => c.type === 'pair').sort((a, b) => a.highestCard.rankValue - b.highestCard.rankValue);
    if (pairs.length > 0 && pairs[0].highestCard.rankValue < 15) {
      game.handleAction(botId, { type: 'PLAY_CARDS', cardIds: pairs[0].cards.map(c => c.id) });
      return;
    }

    // Play lowest single card (avoid playing 2 if it's the only remaining card)
    const nonTwos = hand.filter(c => c.rankValue < 15);
    const cardToLead = nonTwos.length > 0 ? nonTwos[0] : hand[0];
    game.handleAction(botId, { type: 'PLAY_CARDS', cardIds: [cardToLead.id] });
  }

  private static followTrick(botId: string, game: SamGame, hand: SamCard[], targetCombo: SamCardCombo) {
    const allCombos = this.generateAllValidCombos(hand);
    const validBeatingCombos = allCombos.filter(c => SamCardEvaluator.canBeat(c, targetCombo));

    if (validBeatingCombos.length === 0) {
      game.handleAction(botId, { type: 'PASS_TURN' });
      return;
    }

    // Sort valid combos ascending by highest card rankValue
    validBeatingCombos.sort((a, b) => {
      // Don't jump to Tứ Quý unless needed
      if (a.type === 'four_of_a_kind' && b.type !== 'four_of_a_kind') return 1;
      if (b.type === 'four_of_a_kind' && a.type !== 'four_of_a_kind') return -1;
      return a.highestCard.rankValue - b.highestCard.rankValue;
    });

    const chosen = validBeatingCombos[0];
    game.handleAction(botId, {
      type: 'PLAY_CARDS',
      cardIds: chosen.cards.map(c => c.id)
    });
  }

  private static generateAllValidCombos(hand: SamCard[]): SamCardCombo[] {
    const combos: SamCardCombo[] = [];
    const len = hand.length;

    // 1. Singles
    for (const card of hand) {
      combos.push({
        type: 'single',
        cards: [card],
        highestCard: card,
        length: 1
      });
    }

    // Group by rank
    const rankGroups: Map<number, SamCard[]> = new Map();
    for (const card of hand) {
      if (!rankGroups.has(card.rankValue)) {
        rankGroups.set(card.rankValue, []);
      }
      rankGroups.get(card.rankValue)!.push(card);
    }

    // 2. Pairs, Triples, Four-of-a-kinds
    for (const [, cards] of rankGroups.entries()) {
      if (cards.length >= 2) {
        combos.push({
          type: 'pair',
          cards: cards.slice(0, 2),
          highestCard: cards[1],
          length: 2
        });
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
          cards,
          highestCard: cards[3],
          length: 4
        });
      }
    }

    // 3. Straights (Sảnh 3 to 10)
    // Non-2 cards
    const nonTwos = hand.filter(c => c.rankValue < 15);
    const uniqueRanks = Array.from(new Set(nonTwos.map(c => c.rankValue))).sort((a, b) => a - b);

    for (let straightLen = 3; straightLen <= Math.min(10, uniqueRanks.length); straightLen++) {
      for (let i = 0; i <= uniqueRanks.length - straightLen; i++) {
        let isSeq = true;
        for (let j = 0; j < straightLen - 1; j++) {
          if (uniqueRanks[i + j + 1] !== uniqueRanks[i + j] + 1) {
            isSeq = false;
            break;
          }
        }
        if (isSeq) {
          const straightCards: SamCard[] = [];
          for (let j = 0; j < straightLen; j++) {
            const card = hand.find(c => c.rankValue === uniqueRanks[i + j])!;
            straightCards.push(card);
          }
          combos.push({
            type: 'straight',
            cards: straightCards,
            highestCard: straightCards[straightCards.length - 1],
            length: straightLen
          });
        }
      }
    }

    // A-2-3 Sảnh Hạ
    const hasA = hand.find(c => c.rankValue === 14);
    const has2 = hand.find(c => c.rankValue === 15);
    const has3 = hand.find(c => c.rankValue === 3);
    if (hasA && has2 && has3) {
      combos.push({
        type: 'straight',
        cards: [has3, hasA, has2],
        highestCard: has3,
        length: 3
      });
    }

    return combos;
  }
}
