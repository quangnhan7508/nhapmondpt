import { CardCombo, ComboType, TLCard, ToiTrangType } from './types';

export class CardEvaluator {
  /**
   * Sort cards by overall rank (value first, then suit: Spades < Clubs < Diamonds < Hearts)
   */
  public static sortCards(cards: TLCard[]): TLCard[] {
    return [...cards].sort((a, b) => a.overallRank - b.overallRank);
  }

  /**
   * Determine the combination type of a given set of cards
   */
  public static evaluateCombo(cards: TLCard[]): CardCombo {
    if (!cards || cards.length === 0) {
      return { type: 'invalid', cards: [], highestCard: {} as any, length: 0 };
    }

    const sorted = this.sortCards(cards);
    const len = sorted.length;
    const highest = sorted[len - 1];

    // Single
    if (len === 1) {
      return { type: 'single', cards: sorted, highestCard: highest, length: 1 };
    }

    // Pair
    if (len === 2 && sorted[0].rankValue === sorted[1].rankValue) {
      return { type: 'pair', cards: sorted, highestCard: highest, length: 2 };
    }

    // Triple
    if (len === 3 && sorted[0].rankValue === sorted[1].rankValue && sorted[1].rankValue === sorted[2].rankValue) {
      return { type: 'triple', cards: sorted, highestCard: highest, length: 3 };
    }

    // Four of a kind (Tứ quý)
    if (len === 4 &&
        sorted[0].rankValue === sorted[1].rankValue &&
        sorted[1].rankValue === sorted[2].rankValue &&
        sorted[2].rankValue === sorted[3].rankValue) {
      return { type: 'four_of_a_kind', cards: sorted, highestCard: highest, length: 4 };
    }

    // Straight (Sảnh): length >= 3, consecutive ranks, NO 2s allowed in straight!
    if (len >= 3) {
      let isStraight = true;
      for (let i = 0; i < len - 1; i++) {
        // 2 (rankValue 15) cannot be part of straight
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
        return { type: 'straight', cards: sorted, highestCard: highest, length: len };
      }
    }

    // 3 Consecutive Pairs (3 Đôi thông): 6 cards
    if (len === 6 && this.isPairSequence(sorted, 3)) {
      return { type: 'three_pair_sequence', cards: sorted, highestCard: highest, length: 6 };
    }

    // 4 Consecutive Pairs (4 Đôi thông): 8 cards
    if (len === 8 && this.isPairSequence(sorted, 4)) {
      return { type: 'four_pair_sequence', cards: sorted, highestCard: highest, length: 8 };
    }

    return { type: 'invalid', cards: sorted, highestCard: highest, length: len };
  }

  /**
   * Check if cards form N consecutive pairs (no 2s)
   */
  public static isPairSequence(sortedCards: TLCard[], sequenceLength: number): boolean {
    if (sortedCards.length !== sequenceLength * 2) return false;

    for (let i = 0; i < sequenceLength; i++) {
      const c1 = sortedCards[i * 2];
      const c2 = sortedCards[i * 2 + 1];

      // Each pair must match in rank
      if (c1.rankValue !== c2.rankValue) return false;
      // 2 is not allowed in doi thong
      if (c1.rankValue === 15) return false;

      // Pairs must be consecutive
      if (i > 0) {
        const prevC = sortedCards[(i - 1) * 2];
        if (c1.rankValue !== prevC.rankValue + 1) return false;
      }
    }
    return true;
  }

  /**
   * Validates if `challenger` beats `currentTrick`
   */
  public static canBeat(challenger: CardCombo, current: CardCombo): boolean {
    if (challenger.type === 'invalid') return false;

    // --- Special Cutting (Chặt) Rules ---

    // 1. Board has a Single 2 (Heo đơn)
    if (current.type === 'single' && current.cards[0].rankValue === 15) {
      // Beaten by higher Single 2
      if (challenger.type === 'single' && challenger.cards[0].rankValue === 15) {
        return challenger.highestCard.overallRank > current.highestCard.overallRank;
      }
      // Cut by 3 Đôi thông, Tứ quý, or 4 Đôi thông
      if (challenger.type === 'three_pair_sequence' ||
          challenger.type === 'four_of_a_kind' ||
          challenger.type === 'four_pair_sequence') {
        return true;
      }
      return false;
    }

    // 2. Board has a Pair of 2s (Đôi Heo)
    if (current.type === 'pair' && current.cards[0].rankValue === 15) {
      // Beaten by higher Pair of 2s
      if (challenger.type === 'pair' && challenger.cards[0].rankValue === 15) {
        return challenger.highestCard.overallRank > current.highestCard.overallRank;
      }
      // Cut by Tứ quý or 4 Đôi thông
      if (challenger.type === 'four_of_a_kind' || challenger.type === 'four_pair_sequence') {
        return true;
      }
      return false;
    }

    // 3. Board has 3 Đôi thông
    if (current.type === 'three_pair_sequence') {
      // Beaten by higher 3 Đôi thông
      if (challenger.type === 'three_pair_sequence') {
        return challenger.highestCard.overallRank > current.highestCard.overallRank;
      }
      // Cut by Tứ quý or 4 Đôi thông
      if (challenger.type === 'four_of_a_kind' || challenger.type === 'four_pair_sequence') {
        return true;
      }
      return false;
    }

    // 4. Board has Tứ quý (Four of a Kind)
    if (current.type === 'four_of_a_kind') {
      // Beaten by higher Tứ quý
      if (challenger.type === 'four_of_a_kind') {
        return challenger.highestCard.overallRank > current.highestCard.overallRank;
      }
      // Cut by 4 Đôi thông
      if (challenger.type === 'four_pair_sequence') {
        return true;
      }
      return false;
    }

    // 5. Board has 4 Đôi thông
    if (current.type === 'four_pair_sequence') {
      // Only beaten by higher 4 Đôi thông
      if (challenger.type === 'four_pair_sequence') {
        return challenger.highestCard.overallRank > current.highestCard.overallRank;
      }
      return false;
    }

    // --- Standard Same-Type Matching ---
    if (challenger.type !== current.type) {
      return false;
    }

    // Straight must match length
    if (challenger.type === 'straight' && challenger.length !== current.length) {
      return false;
    }

    // Compare highest card
    return challenger.highestCard.overallRank > current.highestCard.overallRank;
  }

  /**
   * Check for Tới Trắng (Instant Win) in initial dealt hand (13 cards)
   */
  public static checkToiTrang(hand: TLCard[]): ToiTrangType {
    if (hand.length < 13) return null;

    const sorted = this.sortCards(hand);

    // 1. Tứ quý 2 (Four 2s)
    const twos = sorted.filter(c => c.rankValue === 15);
    if (twos.length === 4) return 'four_twos';

    // 2. Sảnh rồng (Dragon Straight: 3 to A or 3 to 2)
    const uniqueRanks = Array.from(new Set(sorted.map(c => c.rankValue)));
    if (uniqueRanks.length >= 12) {
      // Check 3 to A (ranks 3 to 14)
      const has3ToA = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].every(r => uniqueRanks.includes(r));
      if (has3ToA) return 'dragon_straight';
    }

    // 3. 6 Pairs (6 Đôi)
    const rankCounts = new Map<number, number>();
    for (const c of sorted) {
      rankCounts.set(c.rankValue, (rankCounts.get(c.rankValue) || 0) + 1);
    }
    let pairCount = 0;
    for (const count of rankCounts.values()) {
      pairCount += Math.floor(count / 2);
    }
    if (pairCount >= 6) return 'six_pairs';

    // 4. 5 Đôi thông (5 consecutive pairs)
    const pairedRanks = Array.from(rankCounts.entries())
      .filter(([r, count]) => count >= 2 && r < 15)
      .map(([r]) => r)
      .sort((a, b) => a - b);

    if (pairedRanks.length >= 5) {
      let maxConsecutive = 1;
      let curr = 1;
      for (let i = 0; i < pairedRanks.length - 1; i++) {
        if (pairedRanks[i + 1] === pairedRanks[i] + 1) {
          curr++;
          maxConsecutive = Math.max(maxConsecutive, curr);
        } else {
          curr = 1;
        }
      }
      if (maxConsecutive >= 5) return 'five_pair_sequence';
    }

    // 5. Đồng màu (12 or 13 cards of same color)
    const redCards = sorted.filter(c => c.suit === 'hearts' || c.suit === 'diamonds');
    const blackCards = sorted.filter(c => c.suit === 'spades' || c.suit === 'clubs');
    if (redCards.length >= 12 || blackCards.length >= 12) return 'same_color';

    return null;
  }
}
