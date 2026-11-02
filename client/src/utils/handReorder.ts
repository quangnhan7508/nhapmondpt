import { UnoCard, EKCard, TLCard } from '../types/game';

/**
 * Synchronizes local user-arranged hand order with incoming server hand.
 * - Retains user-arranged relative order for all existing cards.
 * - Removes cards that were discarded/played.
 * - Appends newly drawn cards to the end of the hand.
 * - Updates card object properties (if any changed) while keeping their IDs in place.
 */
export function syncHandOrder<T extends { id: string }>(
  currentOrder: T[],
  serverHand: T[]
): T[] {
  if (!serverHand || serverHand.length === 0) return [];
  if (!currentOrder || currentOrder.length === 0) return [...serverHand];

  const serverMap = new Map<string, T>();
  serverHand.forEach(card => serverMap.set(card.id, card));

  // 1. Keep existing cards that are still in serverHand, in their user-arranged order
  const result: T[] = [];
  const seenIds = new Set<string>();

  for (const card of currentOrder) {
    const updated = serverMap.get(card.id);
    if (updated) {
      result.push(updated);
      seenIds.add(card.id);
    }
  }

  // 2. Add any new cards from serverHand that weren't in currentOrder (e.g. drawn cards)
  for (const card of serverHand) {
    if (!seenIds.has(card.id)) {
      result.push(card);
      seenIds.add(card.id);
    }
  }

  return result;
}

/**
 * Reorders a list by moving an element from fromIndex to toIndex.
 */
export function reorderHand<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return list;
  if (fromIndex < 0 || fromIndex >= list.length) return list;
  if (toIndex < 0 || toIndex >= list.length) return list;

  const result = [...list];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * Calculates the target index when a card is dragged and dropped horizontally.
 * @param currentIndex The original index of the dragged card
 * @param offsetX Horizontal pixel offset from start of drag
 * @param totalCards Total number of cards in hand
 * @param containerRect Bounding rect of the hand flex container (if available)
 * @param dropPointX Mouse X position at drop
 */
export function calcReorderIndex(
  currentIndex: number,
  offsetX: number,
  totalCards: number,
  containerRect?: DOMRect | null,
  dropPointX?: number
): number {
  if (totalCards <= 1) return 0;

  // Ignore accidental tiny drags (clicks)
  if (Math.abs(offsetX) < 18) {
    return currentIndex;
  }

  // If containerRect and dropPointX are available, calculate target slot from mouse position
  if (containerRect && dropPointX !== undefined && containerRect.width > 0) {
    // If dropped to the left of the hand container
    if (dropPointX <= containerRect.left + 15) {
      return 0;
    }
    // If dropped to the right of the hand container
    if (dropPointX >= containerRect.right - 15) {
      return totalCards - 1;
    }

    const relX = dropPointX - containerRect.left;
    const ratio = Math.max(0, Math.min(1, relX / containerRect.width));
    const target = Math.floor(ratio * totalCards);
    return Math.max(0, Math.min(totalCards - 1, target));
  }

  // Fallback: estimate step width based on typical card overlapping
  const estimatedStep = Math.max(28, Math.min(65, 450 / totalCards));
  const deltaSlots = Math.round(offsetX / estimatedStep);
  return Math.max(0, Math.min(totalCards - 1, currentIndex + deltaSlots));
}

/**
 * Quick sort helper for UNO cards: group by color, then by value.
 */
export function sortUnoCards(cards: UnoCard[]): UnoCard[] {
  const colorOrder: Record<string, number> = {
    red: 1,
    yellow: 2,
    green: 3,
    blue: 4,
    wild: 5
  };

  return [...cards].sort((a, b) => {
    const cA = colorOrder[a.color] ?? 99;
    const cB = colorOrder[b.color] ?? 99;
    if (cA !== cB) return cA - cB;

    // Special sort inside same color
    const isSpecialA = ['skip', 'reverse', 'draw2', 'wild', 'wild_draw4', 'target_draw4', 'custom'].includes(a.value);
    const isSpecialB = ['skip', 'reverse', 'draw2', 'wild', 'wild_draw4', 'target_draw4', 'custom'].includes(b.value);
    if (!isSpecialA && isSpecialB) return -1;
    if (isSpecialA && !isSpecialB) return 1;

    return a.value.localeCompare(b.value);
  });
}

/**
 * Quick sort helper for Exploding Kittens:
 * Group Defuse & Kitten cards first, then pairable cat cards together, then action cards.
 */
export function sortEKCards(cards: EKCard[]): EKCard[] {
  const typePriority: Record<string, number> = {
    defuse: 1,
    streaking_kitten: 2,
    exploding_kitten: 3,
    imploding_kitten: 4,
    feral_cat: 10,
    taco_cat: 11,
    rainbow_cat: 12,
    beard_cat: 13,
    cattermelon: 14,
    cat_potato: 15,
    attack: 20,
    targeted_attack: 21,
    skip: 22,
    super_skip: 23,
    favor: 24,
    see_the_future: 25,
    see_the_future_5x: 26,
    alter_the_future: 27,
    draw_from_bottom: 28,
    shuffle: 29,
    nope: 30
  };

  return [...cards].sort((a, b) => {
    const pA = typePriority[a.type] ?? 50;
    const pB = typePriority[b.type] ?? 50;
    if (pA !== pB) return pA - pB;
    return a.type.localeCompare(b.type);
  });
}

/**
 * Quick sort helper for Tiến Lên: sort by rank or suit.
 */
export function sortTLCards(cards: TLCard[], sortBy: 'rank' | 'suit'): TLCard[] {
  return [...cards].sort((a, b) => {
    if (sortBy === 'rank') {
      return a.overallRank - b.overallRank;
    } else {
      if (a.suitValue !== b.suitValue) return a.suitValue - b.suitValue;
      return a.rankValue - b.rankValue;
    }
  });
}
