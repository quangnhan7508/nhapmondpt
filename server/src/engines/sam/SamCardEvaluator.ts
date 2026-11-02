import { SamCard, SamCardCombo, SamComboType, SamToiTrangType } from './types';

export class SamCardEvaluator {
  /**
   * Sorts cards by rank (3=3 ... K=13, A=14, 2=15), then by suit for deterministic display
   */
  public static sortCards(cards: SamCard[]): SamCard[] {
    return [...cards].sort((a, b) => {
      if (a.rankValue !== b.rankValue) {
        return a.rankValue - b.rankValue;
      }
      return a.suitValue - b.suitValue;
    });
  }

  /**
   * Evaluates if a set of cards is a valid Sâm combination
   */
  public static evaluateCombo(cards: SamCard[]): SamCardCombo {
    const len = cards.length;
    if (len === 0) {
      return { type: 'invalid', cards, highestCard: cards[0], length: 0 };
    }

    const sorted = this.sortCards(cards);

    // 1. Single card
    if (len === 1) {
      return {
        type: 'single',
        cards: sorted,
        highestCard: sorted[0],
        length: 1
      };
    }

    // 2. Pair
    if (len === 2 && sorted[0].rankValue === sorted[1].rankValue) {
      return {
        type: 'pair',
        cards: sorted,
        highestCard: sorted[1],
        length: 2
      };
    }

    // 3. Triple (Sám cô)
    if (len === 3 && sorted[0].rankValue === sorted[1].rankValue && sorted[1].rankValue === sorted[2].rankValue) {
      return {
        type: 'triple',
        cards: sorted,
        highestCard: sorted[2],
        length: 3
      };
    }

    // 4. Four of a kind (Tứ quý)
    if (
      len === 4 &&
      sorted[0].rankValue === sorted[1].rankValue &&
      sorted[1].rankValue === sorted[2].rankValue &&
      sorted[2].rankValue === sorted[3].rankValue
    ) {
      return {
        type: 'four_of_a_kind',
        cards: sorted,
        highestCard: sorted[3],
        length: 4
      };
    }

    // 5. Straight (Sảnh 3 đến 10 lá)
    if (len >= 3 && len <= 10) {
      // Special Sâm Straight: A-2-3 (Sảnh hạ nhỏ nhất)
      if (len === 3) {
        const ranks = sorted.map(c => c.rankValue);
        // Sorted: [3, 14, 15] (3, A, 2)
        if (ranks[0] === 3 && ranks[1] === 14 && ranks[2] === 15) {
          return {
            type: 'straight',
            cards: sorted,
            highestCard: sorted[0], // Represented with lowest rank 3 as top in A-2-3
            length: 3
          };
        }
      }

      // Standard Straight (no 2s, consecutive ranks)
      let isStraight = true;
      for (let i = 0; i < len - 1; i++) {
        // In standard straights, 2 (rankValue 15) is never allowed
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
        return {
          type: 'straight',
          cards: sorted,
          highestCard: sorted[len - 1],
          length: len
        };
      }
    }

    return {
      type: 'invalid',
      cards: sorted,
      highestCard: sorted[len - 1],
      length: len
    };
  }

  /**
   * Determines if a candidate combo beats the target trick combo.
   * In Sâm Lốc:
   * - SUITS DO NOT MATTER! Only compare rankValue.
   * - 1 Tứ Quý cuts 1 Heo (single 2).
   * - Higher Tứ Quý cuts lower Tứ Quý.
   */
  public static canBeat(candidate: SamCardCombo, target: SamCardCombo): boolean {
    if (candidate.type === 'invalid') return false;

    // Special Cut 1: Tứ Quý cuts 1 Heo (single 2)
    if (target.type === 'single' && target.cards[0].rankValue === 15) {
      if (candidate.type === 'four_of_a_kind') {
        return true;
      }
    }

    // Special Cut 2: Tứ Quý cuts smaller Tứ Quý
    if (target.type === 'four_of_a_kind' && candidate.type === 'four_of_a_kind') {
      return candidate.highestCard.rankValue > target.highestCard.rankValue;
    }

    // Standard play: must match combo type and card count
    if (candidate.type !== target.type || candidate.length !== target.length) {
      return false;
    }

    // Single: rank must be strictly higher (Suits are ignored in Sâm!)
    if (candidate.type === 'single') {
      return candidate.cards[0].rankValue > target.cards[0].rankValue;
    }

    // Pair: rank must be strictly higher
    if (candidate.type === 'pair') {
      return candidate.highestCard.rankValue > target.highestCard.rankValue;
    }

    // Triple: rank must be strictly higher
    if (candidate.type === 'triple') {
      return candidate.highestCard.rankValue > target.highestCard.rankValue;
    }

    // Straight: same length, higher ending card rank
    if (candidate.type === 'straight') {
      const isTargetA23 = target.length === 3 && target.cards.some(c => c.rankValue === 14) && target.cards.some(c => c.rankValue === 15);
      const isCandidateA23 = candidate.length === 3 && candidate.cards.some(c => c.rankValue === 14) && candidate.cards.some(c => c.rankValue === 15);

      if (isCandidateA23) {
        // A-2-3 is lowest straight, cannot beat any other straight
        return false;
      }
      if (isTargetA23) {
        // Any regular 3-card straight (e.g. 3-4-5) beats A-2-3
        return true;
      }

      // Normal comparison by highest rank card in straight
      return candidate.highestCard.rankValue > target.highestCard.rankValue;
    }

    return false;
  }

  /**
   * Checks Instant Win (Tới Trắng) in Sâm Lốc (10 cards)
   */
  public static checkToiTrang(hand: SamCard[]): SamToiTrangType {
    if (hand.length !== 10) return null;
    const sorted = this.sortCards(hand);

    // 1. Tứ quý 2 (4 con Heo)
    const twos = sorted.filter(c => c.rankValue === 15);
    if (twos.length === 4) {
      return 'four_twos';
    }

    // 2. 5 đôi (10 cards form 5 pairs)
    let isFivePairs = true;
    for (let i = 0; i < 10; i += 2) {
      if (sorted[i].rankValue !== sorted[i + 1].rankValue) {
        isFivePairs = false;
        break;
      }
    }
    if (isFivePairs) {
      return 'five_pairs';
    }

    // 3. Sảnh rồng 10 lá liên tiếp
    const uniqueRanks = Array.from(new Set(sorted.map(c => c.rankValue))).sort((a, b) => a - b);
    if (uniqueRanks.length === 10) {
      let isDragon = true;
      for (let i = 0; i < 9; i++) {
        if (uniqueRanks[i + 1] !== uniqueRanks[i] + 1) {
          isDragon = false;
          break;
        }
      }
      if (isDragon) {
        return 'dragon_straight_10';
      }
    }

    // 4. 10 lá đồng màu (toàn đỏ hoặc toàn đen)
    const redSuits = ['hearts', 'diamonds'];
    const blackSuits = ['spades', 'clubs'];
    const allRed = sorted.every(c => redSuits.includes(c.suit));
    const allBlack = sorted.every(c => blackSuits.includes(c.suit));
    if (allRed || allBlack) {
      return 'same_color';
    }

    return null;
  }
}
