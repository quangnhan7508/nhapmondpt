import { TLCard, PlayedTrick, Suit } from '../types/game';

export type ComboType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'straight'
  | 'three_pair_sequence'
  | 'four_of_a_kind'
  | 'four_pair_sequence'
  | 'invalid';

export interface SuggestedCombo {
  label: string;
  cards: TLCard[];
  type: ComboType;
  isSpecialCut?: boolean;
}

function getSuitIcon(suit: Suit): string {
  switch (suit) {
    case 'spades': return '♠';
    case 'clubs': return '♣';
    case 'diamonds': return '♦';
    case 'hearts': return '♥';
  }
}

/**
 * Finds all pairs in hand (grouped by rank)
 */
export function findPairs(hand: TLCard[]): TLCard[][] {
  const groups = new Map<number, TLCard[]>();
  for (const c of hand) {
    const arr = groups.get(c.rankValue) || [];
    arr.push(c);
    groups.set(c.rankValue, arr);
  }

  const pairs: TLCard[][] = [];
  groups.forEach((cards) => {
    if (cards.length >= 2) {
      // Pick combinations or best 2
      const sorted = [...cards].sort((a, b) => a.overallRank - b.overallRank);
      pairs.push([sorted[sorted.length - 2], sorted[sorted.length - 1]]);
    }
  });

  return pairs.sort((a, b) => a[1].overallRank - b[1].overallRank);
}

/**
 * Finds all triples in hand
 */
export function findTriples(hand: TLCard[]): TLCard[][] {
  const groups = new Map<number, TLCard[]>();
  for (const c of hand) {
    const arr = groups.get(c.rankValue) || [];
    arr.push(c);
    groups.set(c.rankValue, arr);
  }

  const triples: TLCard[][] = [];
  groups.forEach((cards) => {
    if (cards.length >= 3) {
      const sorted = [...cards].sort((a, b) => a.overallRank - b.overallRank);
      triples.push(sorted.slice(-3));
    }
  });

  return triples.sort((a, b) => a[2].overallRank - b[2].overallRank);
}

/**
 * Finds all Four of a Kind (Tứ quý) in hand
 */
export function findFourOfAKind(hand: TLCard[]): TLCard[][] {
  const groups = new Map<number, TLCard[]>();
  for (const c of hand) {
    const arr = groups.get(c.rankValue) || [];
    arr.push(c);
    groups.set(c.rankValue, arr);
  }

  const fours: TLCard[][] = [];
  groups.forEach((cards) => {
    if (cards.length === 4) {
      const sorted = [...cards].sort((a, b) => a.overallRank - b.overallRank);
      fours.push(sorted);
    }
  });

  return fours.sort((a, b) => a[3].overallRank - b[3].overallRank);
}

/**
 * Finds all 3 consecutive pairs (3 Đôi thông) in hand
 */
export function findThreePairSequences(hand: TLCard[]): TLCard[][] {
  const groups = new Map<number, TLCard[]>();
  for (const c of hand) {
    if (c.rankValue === 15) continue; // No 2s
    const arr = groups.get(c.rankValue) || [];
    arr.push(c);
    groups.set(c.rankValue, arr);
  }

  const validRanks = Array.from(groups.keys()).filter(r => groups.get(r)!.length >= 2).sort((a, b) => a - b);
  const sequences: TLCard[][] = [];

  for (let i = 0; i <= validRanks.length - 3; i++) {
    const r1 = validRanks[i];
    const r2 = validRanks[i + 1];
    const r3 = validRanks[i + 2];
    if (r2 === r1 + 1 && r3 === r2 + 1) {
      const p1 = groups.get(r1)!.slice(-2);
      const p2 = groups.get(r2)!.slice(-2);
      const p3 = groups.get(r3)!.slice(-2);
      sequences.push([...p1, ...p2, ...p3]);
    }
  }

  return sequences;
}

/**
 * Finds all 4 consecutive pairs (4 Đôi thông) in hand
 */
export function findFourPairSequences(hand: TLCard[]): TLCard[][] {
  const groups = new Map<number, TLCard[]>();
  for (const c of hand) {
    if (c.rankValue === 15) continue; // No 2s
    const arr = groups.get(c.rankValue) || [];
    arr.push(c);
    groups.set(c.rankValue, arr);
  }

  const validRanks = Array.from(groups.keys()).filter(r => groups.get(r)!.length >= 2).sort((a, b) => a - b);
  const sequences: TLCard[][] = [];

  for (let i = 0; i <= validRanks.length - 4; i++) {
    const r1 = validRanks[i];
    const r2 = validRanks[i + 1];
    const r3 = validRanks[i + 2];
    const r4 = validRanks[i + 3];
    if (r2 === r1 + 1 && r3 === r2 + 1 && r4 === r3 + 1) {
      const p1 = groups.get(r1)!.slice(-2);
      const p2 = groups.get(r2)!.slice(-2);
      const p3 = groups.get(r3)!.slice(-2);
      const p4 = groups.get(r4)!.slice(-2);
      sequences.push([...p1, ...p2, ...p3, ...p4]);
    }
  }

  return sequences;
}

/**
 * Finds all straights of length N in hand
 */
export function findStraights(hand: TLCard[], length: number): TLCard[][] {
  if (length < 3 || length > 12) return [];

  const nonTwos = hand.filter(c => c.rankValue !== 15);
  const byRank = new Map<number, TLCard[]>();
  for (const c of nonTwos) {
    const arr = byRank.get(c.rankValue) || [];
    arr.push(c);
    byRank.set(c.rankValue, arr);
  }

  const uniqueRanks = Array.from(byRank.keys()).sort((a, b) => a - b);
  const straights: TLCard[][] = [];

  for (let i = 0; i <= uniqueRanks.length - length; i++) {
    let consecutive = true;
    for (let k = 0; k < length - 1; k++) {
      if (uniqueRanks[i + k + 1] !== uniqueRanks[i + k] + 1) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) {
      // Build a straight picking the highest card for each rank
      const cards: TLCard[] = [];
      for (let k = 0; k < length; k++) {
        const rankCards = byRank.get(uniqueRanks[i + k])!;
        cards.push(rankCards[rankCards.length - 1]);
      }
      straights.push(cards);
    }
  }

  return straights;
}

/**
 * Generates all valid beating combinations from hand against currentTrick
 */
export function getSuggestedCombos(
  hand: TLCard[],
  currentTrick: PlayedTrick | null,
  isFirstTurnWithThreeSpades: boolean = false
): SuggestedCombo[] {
  if (!hand || hand.length === 0) return [];

  const suggestions: SuggestedCombo[] = [];

  // Special case: First play of the match requiring 3 of Spades
  if (isFirstTurnWithThreeSpades && currentTrick === null) {
    const threeSpades = hand.find(c => c.value === '3' && c.suit === 'spades');
    if (threeSpades) {
      suggestions.push({
        label: '3♠ Đơn',
        cards: [threeSpades],
        type: 'single'
      });

      // Pairs containing 3♠
      const otherThrees = hand.filter(c => c.value === '3' && c.id !== threeSpades.id);
      for (const t of otherThrees) {
        suggestions.push({
          label: `Đôi 3 [3♠ 3${getSuitIcon(t.suit)}]`,
          cards: [threeSpades, t],
          type: 'pair'
        });
      }

      // Straights containing 3♠
      const straights3 = findStraights(hand, 3).filter(s => s.some(c => c.id === threeSpades.id));
      for (const s of straights3) {
        suggestions.push({
          label: `Sảnh 3 lá (${s[0].value}➔${s[2].value})`,
          cards: s,
          type: 'straight'
        });
      }
    }
    return suggestions;
  }

  // Free play (Lead trick)
  if (!currentTrick) {
    const sorted = [...hand].sort((a, b) => a.overallRank - b.overallRank);
    
    // Lowest single
    suggestions.push({
      label: `Lá rác: ${sorted[0].value}${getSuitIcon(sorted[0].suit)}`,
      cards: [sorted[0]],
      type: 'single'
    });

    // Lowest pair
    const pairs = findPairs(hand);
    if (pairs.length > 0) {
      suggestions.push({
        label: `Đôi ${pairs[0][0].value}`,
        cards: pairs[0],
        type: 'pair'
      });
    }

    // Lowest triple
    const triples = findTriples(hand);
    if (triples.length > 0) {
      suggestions.push({
        label: `Sám ${triples[0][0].value}`,
        cards: triples[0],
        type: 'triple'
      });
    }

    // Suggest straights (from length 10 down to 3)
    for (let len = 10; len >= 3; len--) {
      const straights = findStraights(hand, len);
      if (straights.length > 0) {
        suggestions.push({
          label: `Sảnh ${len} lá (${straights[0][0].value}➔${straights[0][len - 1].value})`,
          cards: straights[0],
          type: 'straight'
        });
        break;
      }
    }

    return suggestions;
  }

  // Against active trick
  const curr = currentTrick.combo;

  // 1. Single
  if (curr.type === 'single') {
    const currCard = curr.cards[0];
    const isTwo = currCard.rankValue === 15;

    // Higher singles
    const higherSingles = hand
      .filter(c => c.overallRank > currCard.overallRank)
      .sort((a, b) => a.overallRank - b.overallRank);

    for (const c of higherSingles.slice(0, 3)) {
      suggestions.push({
        label: `${c.value}${getSuitIcon(c.suit)}`,
        cards: [c],
        type: 'single'
      });
    }

    // Chặt Heo
    if (isTwo) {
      const threePairs = findThreePairSequences(hand);
      for (const tp of threePairs) {
        suggestions.push({
          label: `⚡ 3 ĐÔI THÔNG CHẶT HEO!`,
          cards: tp,
          type: 'three_pair_sequence',
          isSpecialCut: true
        });
      }

      const fours = findFourOfAKind(hand);
      for (const f of fours) {
        suggestions.push({
          label: `🔥 TỨ QUÝ ${f[0].value} CHẶT HEO!`,
          cards: f,
          type: 'four_of_a_kind',
          isSpecialCut: true
        });
      }

      const fourPairs = findFourPairSequences(hand);
      for (const fp of fourPairs) {
        suggestions.push({
          label: `👑 4 ĐÔI THÔNG CHẶT HEO!`,
          cards: fp,
          type: 'four_pair_sequence',
          isSpecialCut: true
        });
      }
    }
  }

  // 2. Pair
  else if (curr.type === 'pair') {
    const isPairTwo = curr.cards[0].rankValue === 15;
    const pairs = findPairs(hand).filter(p => p[1].overallRank > curr.highestCard.overallRank);

    for (const p of pairs.slice(0, 3)) {
      suggestions.push({
        label: `Đôi ${p[0].value}`,
        cards: p,
        type: 'pair'
      });
    }

    // Chặt Đôi Heo
    if (isPairTwo) {
      const fours = findFourOfAKind(hand);
      for (const f of fours) {
        suggestions.push({
          label: `🔥 TỨ QUÝ ${f[0].value} CHẶT ĐÔI HEO!`,
          cards: f,
          type: 'four_of_a_kind',
          isSpecialCut: true
        });
      }

      const fourPairs = findFourPairSequences(hand);
      for (const fp of fourPairs) {
        suggestions.push({
          label: `👑 4 ĐÔI THÔNG CHẶT ĐÔI HEO!`,
          cards: fp,
          type: 'four_pair_sequence',
          isSpecialCut: true
        });
      }
    }
  }

  // 3. Triple
  else if (curr.type === 'triple') {
    const triples = findTriples(hand).filter(t => t[2].overallRank > curr.highestCard.overallRank);
    for (const t of triples.slice(0, 3)) {
      suggestions.push({
        label: `Sám ${t[0].value}`,
        cards: t,
        type: 'triple'
      });
    }
  }

  // 4. Straight
  else if (curr.type === 'straight') {
    const straights = findStraights(hand, curr.length).filter(
      s => s[s.length - 1].overallRank > curr.highestCard.overallRank
    );
    for (const s of straights.slice(0, 3)) {
      suggestions.push({
        label: `Sảnh (${s[0].value}➔${s[s.length - 1].value})`,
        cards: s,
        type: 'straight'
      });
    }
  }

  // 5. 3 Đôi thông
  else if (curr.type === 'three_pair_sequence') {
    const higherThreePairs = findThreePairSequences(hand).filter(
      tp => tp[tp.length - 1].overallRank > curr.highestCard.overallRank
    );
    for (const tp of higherThreePairs) {
      suggestions.push({
        label: `⚡ 3 Đôi Thông Lớn Hơn`,
        cards: tp,
        type: 'three_pair_sequence'
      });
    }

    const fours = findFourOfAKind(hand);
    for (const f of fours) {
      suggestions.push({
        label: `🔥 TỨ QUÝ ${f[0].value} CHẶT 3 ĐÔI THÔNG!`,
        cards: f,
        type: 'four_of_a_kind',
        isSpecialCut: true
      });
    }

    const fourPairs = findFourPairSequences(hand);
    for (const fp of fourPairs) {
      suggestions.push({
        label: `👑 4 ĐÔI THÔNG CHẶT 3 ĐÔI THÔNG!`,
        cards: fp,
        type: 'four_pair_sequence',
        isSpecialCut: true
      });
    }
  }

  // 6. Tứ quý
  else if (curr.type === 'four_of_a_kind') {
    const higherFours = findFourOfAKind(hand).filter(
      f => f[3].overallRank > curr.highestCard.overallRank
    );
    for (const f of higherFours) {
      suggestions.push({
        label: `🔥 Tứ Quý ${f[0].value} Lớn Hơn`,
        cards: f,
        type: 'four_of_a_kind'
      });
    }

    const fourPairs = findFourPairSequences(hand);
    for (const fp of fourPairs) {
      suggestions.push({
        label: `👑 4 ĐÔI THÔNG CHẶT TỨ QUÝ!`,
        cards: fp,
        type: 'four_pair_sequence',
        isSpecialCut: true
      });
    }
  }

  // 7. 4 Đôi thông
  else if (curr.type === 'four_pair_sequence') {
    const higherFourPairs = findFourPairSequences(hand).filter(
      fp => fp[fp.length - 1].overallRank > curr.highestCard.overallRank
    );
    for (const fp of higherFourPairs) {
      suggestions.push({
        label: `👑 4 Đôi Thông Lớn Hơn`,
        cards: fp,
        type: 'four_pair_sequence'
      });
    }
  }

  return suggestions;
}

/**
 * Given a hovered cardId and the current hand + table trick,
 * finds a playable combo that includes this card and beats the current trick (or forms a natural combo in free play).
 */
export function findMatchingComboForCard(
  cardId: string,
  hand: TLCard[],
  currentTrick: PlayedTrick | null,
  isFirstTurnWithThreeSpades: boolean = false
): TLCard[] | null {
  if (!hand || hand.length === 0 || !cardId) return null;
  const targetCard = hand.find(c => c.id === cardId);
  if (!targetCard) return null;

  // Case 1: First turn with 3 of Spades required
  if (isFirstTurnWithThreeSpades && currentTrick === null) {
    const threeSpades = hand.find(c => c.value === '3' && c.suit === 'spades');
    if (!threeSpades) return [targetCard];

    // If targetCard is 3 of Spades itself
    if (targetCard.id === threeSpades.id) {
      // Check if there's a straight with 3S
      const straights = findStraights(hand, 3).filter(s => s.some(c => c.id === threeSpades.id));
      if (straights.length > 0) return straights[0];

      // Check if there's a pair with 3S
      const otherThrees = hand.filter(c => c.value === '3' && c.id !== threeSpades.id);
      if (otherThrees.length > 0) return [threeSpades, otherThrees[0]];

      return [threeSpades];
    }

    // If target is another card: does it form a combo with 3S?
    if (targetCard.value === '3') {
      return [threeSpades, targetCard];
    }
    const straightWithBoth = findStraights(hand, 3).find(
      s => s.some(c => c.id === threeSpades.id) && s.some(c => c.id === targetCard.id)
    );
    if (straightWithBoth) return straightWithBoth;

    return null; // Not playable on first turn if it doesn't include 3S
  }

  // Case 2: An active trick is on the table
  if (currentTrick) {
    const curr = currentTrick.combo;
    const isSingleTwo = curr.type === 'single' && curr.cards[0].rankValue === 15;
    const isPairTwo = curr.type === 'pair' && curr.cards[0].rankValue === 15;

    // 4 Đôi thông can cut: 1 Heo, Đôi Heo, 3 Đôi thông, Tứ Quý, 4 Đôi thông nhỏ hơn
    const allFourPairs = findFourPairSequences(hand);
    const fourPairWithCard = allFourPairs.find(fp => fp.some(c => c.id === targetCard.id));
    if (fourPairWithCard) {
      if (isSingleTwo || isPairTwo || curr.type === 'three_pair_sequence' || curr.type === 'four_of_a_kind') {
        return fourPairWithCard;
      }
      if (
        curr.type === 'four_pair_sequence' &&
        fourPairWithCard[fourPairWithCard.length - 1].overallRank > curr.highestCard.overallRank
      ) {
        return fourPairWithCard;
      }
    }

    // Tứ quý can cut: 1 Heo, Đôi Heo, 3 Đôi thông, Tứ Quý nhỏ hơn
    const allFours = findFourOfAKind(hand);
    const fourWithCard = allFours.find(f => f.some(c => c.id === targetCard.id));
    if (fourWithCard) {
      if (isSingleTwo || isPairTwo || curr.type === 'three_pair_sequence') {
        return fourWithCard;
      }
      if (curr.type === 'four_of_a_kind' && fourWithCard[3].overallRank > curr.highestCard.overallRank) {
        return fourWithCard;
      }
    }

    // 3 Đôi thông can cut: 1 Heo, 3 Đôi thông nhỏ hơn
    const allThreePairs = findThreePairSequences(hand);
    const threePairWithCard = allThreePairs.find(tp => tp.some(c => c.id === targetCard.id));
    if (threePairWithCard) {
      if (isSingleTwo) {
        return threePairWithCard;
      }
      if (
        curr.type === 'three_pair_sequence' &&
        threePairWithCard[threePairWithCard.length - 1].overallRank > curr.highestCard.overallRank
      ) {
        return threePairWithCard;
      }
    }

    // Normal matching combo types:
    if (curr.type === 'single') {
      if (targetCard.overallRank > curr.highestCard.overallRank) {
        return [targetCard];
      }
      return null;
    }

    if (curr.type === 'pair') {
      const sameRank = hand.filter(c => c.rankValue === targetCard.rankValue);
      if (sameRank.length >= 2) {
        const candidates = sameRank.filter(c => c.id !== targetCard.id);
        for (const partner of candidates) {
          const pair = [targetCard, partner].sort((a, b) => a.overallRank - b.overallRank);
          if (pair[1].overallRank > curr.highestCard.overallRank) {
            return pair;
          }
        }
      }
      return null;
    }

    if (curr.type === 'triple') {
      const sameRank = hand.filter(c => c.rankValue === targetCard.rankValue);
      if (sameRank.length >= 3) {
        const others = sameRank.filter(c => c.id !== targetCard.id);
        const triple = [targetCard, others[0], others[1]].sort((a, b) => a.overallRank - b.overallRank);
        if (triple[2].overallRank > curr.highestCard.overallRank) {
          return triple;
        }
      }
      return null;
    }

    if (curr.type === 'straight') {
      const targetLen = curr.length;
      const nonTwos = hand.filter(c => c.rankValue !== 15);
      const byRank = new Map<number, TLCard[]>();
      for (const c of nonTwos) {
        const arr = byRank.get(c.rankValue) || [];
        arr.push(c);
        byRank.set(c.rankValue, arr);
      }
      const uniqueRanks = Array.from(byRank.keys()).sort((a, b) => a - b);

      const validStraights: TLCard[][] = [];
      for (let i = 0; i <= uniqueRanks.length - targetLen; i++) {
        let isConsecutive = true;
        for (let k = 0; k < targetLen - 1; k++) {
          if (uniqueRanks[i + k + 1] !== uniqueRanks[i + k] + 1) {
            isConsecutive = false;
            break;
          }
        }
        if (isConsecutive) {
          const runRanks = uniqueRanks.slice(i, i + targetLen);
          if (runRanks.includes(targetCard.rankValue)) {
            const straightCards: TLCard[] = [];
            for (const r of runRanks) {
              if (r === targetCard.rankValue) {
                straightCards.push(targetCard);
              } else {
                const rCards = byRank.get(r)!;
                straightCards.push(rCards[rCards.length - 1]);
              }
            }
            const highestInStraight = straightCards[straightCards.length - 1];
            if (highestInStraight.overallRank > curr.highestCard.overallRank) {
              validStraights.push(straightCards);
            }
          }
        }
      }
      if (validStraights.length > 0) {
        return validStraights[0];
      }
      return null;
    }

    return null;
  }

  // Case 3: Free play (no active trick on table)
  const allFourPairs = findFourPairSequences(hand);
  const fp = allFourPairs.find(seq => seq.some(c => c.id === targetCard.id));
  if (fp) return fp;

  const allFours = findFourOfAKind(hand);
  const f = allFours.find(seq => seq.some(c => c.id === targetCard.id));
  if (f) return f;

  const allThreePairs = findThreePairSequences(hand);
  const tp = allThreePairs.find(seq => seq.some(c => c.id === targetCard.id));
  if (tp) return tp;

  const sameRank = hand.filter(c => c.rankValue === targetCard.rankValue);
  if (sameRank.length === 3) {
    return [...sameRank].sort((a, b) => a.overallRank - b.overallRank);
  }

  // Expand straight suggestion to include 6, 7, 8, 9, 10, 11, 12 cards
  for (let len = 12; len >= 3; len--) {
    const straights = findStraights(hand, len).filter(s => s.some(c => c.id === targetCard.id));
    if (straights.length > 0) return straights[0];
  }

  if (sameRank.length === 2) {
    return [...sameRank].sort((a, b) => a.overallRank - b.overallRank);
  }

  return [targetCard];
}
