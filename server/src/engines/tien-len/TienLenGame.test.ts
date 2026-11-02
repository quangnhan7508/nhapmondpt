import assert from 'node:assert';
import test from 'node:test';
import { CardEvaluator } from './CardEvaluator';
import { TienLenGame } from './TienLenGame';
import { TLCard } from './types';

function makeCard(val: string, rank: number, suit: 'spades' | 'clubs' | 'diamonds' | 'hearts', suitVal: number): TLCard {
  return {
    id: `${val}_${suit}`,
    value: val as any,
    suit,
    rankValue: rank,
    suitValue: suitVal,
    overallRank: rank * 4 + suitVal
  };
}

test('TienLen CardEvaluator - Single, Pair, Triple, Straight', () => {
  const c3s = makeCard('3', 3, 'spades', 0);
  const c3h = makeCard('3', 3, 'hearts', 3);
  const c4s = makeCard('4', 4, 'spades', 0);
  const c5s = makeCard('5', 5, 'spades', 0);

  // Single
  const single = CardEvaluator.evaluateCombo([c3s]);
  assert.strictEqual(single.type, 'single');

  // Pair
  const pair = CardEvaluator.evaluateCombo([c3s, c3h]);
  assert.strictEqual(pair.type, 'pair');

  // Straight 3-4-5
  const straight = CardEvaluator.evaluateCombo([c3s, c4s, c5s]);
  assert.strictEqual(straight.type, 'straight');
  assert.strictEqual(straight.length, 3);
});

test('TienLen CardEvaluator - Chặt (Cutting) Rules', () => {
  // Single 2 (Heo cơ - 2 hearts)
  const twoHearts = makeCard('2', 15, 'hearts', 3);
  const singleTwo = CardEvaluator.evaluateCombo([twoHearts]);

  // 3 Đôi thông (4-4, 5-5, 6-6)
  const threePairs = CardEvaluator.evaluateCombo([
    makeCard('4', 4, 'spades', 0), makeCard('4', 4, 'hearts', 3),
    makeCard('5', 5, 'spades', 0), makeCard('5', 5, 'hearts', 3),
    makeCard('6', 6, 'spades', 0), makeCard('6', 6, 'hearts', 3)
  ]);
  assert.strictEqual(threePairs.type, 'three_pair_sequence');
  assert.strictEqual(CardEvaluator.canBeat(threePairs, singleTwo), true, '3 Đôi thông cuts single 2');

  // Tứ quý 9 (Four 9s)
  const fourOfAKind = CardEvaluator.evaluateCombo([
    makeCard('9', 9, 'spades', 0), makeCard('9', 9, 'clubs', 1),
    makeCard('9', 9, 'diamonds', 2), makeCard('9', 9, 'hearts', 3)
  ]);
  assert.strictEqual(fourOfAKind.type, 'four_of_a_kind');
  assert.strictEqual(CardEvaluator.canBeat(fourOfAKind, singleTwo), true, 'Tứ quý cuts single 2');
  assert.strictEqual(CardEvaluator.canBeat(fourOfAKind, threePairs), true, 'Tứ quý cuts 3 Đôi thông');

  // 4 Đôi thông (7-7, 8-8, 9-9, 10-10)
  const fourPairs = CardEvaluator.evaluateCombo([
    makeCard('7', 7, 'spades', 0), makeCard('7', 7, 'hearts', 3),
    makeCard('8', 8, 'spades', 0), makeCard('8', 8, 'hearts', 3),
    makeCard('9', 9, 'spades', 0), makeCard('9', 9, 'hearts', 3),
    makeCard('10', 10, 'spades', 0), makeCard('10', 10, 'hearts', 3)
  ]);
  assert.strictEqual(fourPairs.type, 'four_pair_sequence');
  assert.strictEqual(CardEvaluator.canBeat(fourPairs, fourOfAKind), true, '4 Đôi thông cuts Tứ quý');
});

test('TienLenGame - Setup and state masking', () => {
  const players = [
    { id: 'p1', name: 'Alice', avatar: 'av-1', isBot: false },
    { id: 'p2', name: 'Bob', avatar: 'av-2', isBot: true },
    { id: 'p3', name: 'Charlie', avatar: 'av-3', isBot: true },
    { id: 'p4', name: 'David', avatar: 'av-4', isBot: true }
  ];

  const game = new TienLenGame(players);
  game.start();

  const masked = game.getMaskedState('p1');
  assert.strictEqual(masked.myHand.length, 13, 'Player 1 gets 13 cards');
  assert.strictEqual(masked.players[1].cardCount, 13, 'Bob gets 13 cards');
  assert.strictEqual((masked.players[1] as any).myHand, undefined, 'Bob hand is strictly redacted');
  game.clearTurnTimer();
});

test('TienLenGame - Out-of-turn cut with Tứ Quý and 3 Đôi Thông on 2', () => {
  const players = [
    { id: 'p1', name: 'Alice', avatar: 'av-1', isBot: false },
    { id: 'p2', name: 'Bob', avatar: 'av-2', isBot: false },
    { id: 'p3', name: 'Charlie', avatar: 'av-3', isBot: false }
  ];

  const game = new TienLenGame(players, { firstTurnRule: false, cutTwoOutOfTurnRule: true });
  game.start();

  // Set Alice as current turn and give her a 2
  (game as any).state.currentTurnIndex = 0;
  const aliceHand = (game as any).hands.get('p1');
  const twoOfDiamonds = makeCard('2', 15, 'diamonds', 2);
  aliceHand[0] = twoOfDiamonds;

  // Alice plays 2 of Diamonds
  const playRes = game.handleAction('p1', { type: 'PLAY_CARDS', cardIds: [twoOfDiamonds.id] });
  assert.strictEqual(playRes.success, true, 'Alice plays 2 of Diamonds');

  // It is now Bob's turn (index 1), but Charlie (p3) has a Tứ Quý
  const charlieHand = (game as any).hands.get('p3');
  const fourKings = [
    makeCard('K', 13, 'spades', 0),
    makeCard('K', 13, 'clubs', 1),
    makeCard('K', 13, 'diamonds', 2),
    makeCard('K', 13, 'hearts', 3)
  ];
  charlieHand.splice(0, 4, ...fourKings);

  // Charlie cuts out-of-turn!
  const cutRes = game.handleAction('p3', { type: 'PLAY_CARDS', cardIds: fourKings.map(c => c.id) });
  assert.strictEqual(cutRes.success, true, 'Charlie cuts 2 of Diamonds out-of-turn with Tứ Quý');
  assert.strictEqual((game as any).state.currentTrick.combo.type, 'four_of_a_kind');
  game.clearTurnTimer();
});
