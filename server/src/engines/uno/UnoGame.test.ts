import assert from 'node:assert';
import test from 'node:test';
import { UnoGame } from './UnoGame';

test('UnoGame - Game initialization and state masking', () => {
  const players = [
    { id: 'p1', name: 'Alice', avatar: 'av-1', isBot: false },
    { id: 'p2', name: 'Bob', avatar: 'av-2', isBot: true },
    { id: 'p3', name: 'Charlie', avatar: 'av-3', isBot: true }
  ];

  const game = new UnoGame(players, { mode: 'classic' });
  game.start();

  const p1Masked = game.getMaskedState('p1');
  assert.strictEqual(p1Masked.myHand.length, 7, 'Player 1 should have 7 cards');
  assert.strictEqual(p1Masked.players[1].cardCount, 7, 'Bob card count is 7');
  assert.strictEqual((p1Masked.players[1] as any).myHand, undefined, 'Bob hand cards must be hidden from Alice');
  assert.ok(p1Masked.topCard, 'Top card must be public');
  game.clearTurnTimer();
});

test('UnoGame - Free Stacking penalty accumulation', () => {
  const players = [
    { id: 'p1', name: 'Alice', avatar: 'av-1', isBot: false },
    { id: 'p2', name: 'Bob', avatar: 'av-2', isBot: false }
  ];

  const game = new UnoGame(players, {
    mode: 'no-mercy',
    rules: { freeStacking: true }
  });
  game.start();

  // Test state has pending draw
  game.state.pendingDrawCount = 2;
  game.state.pendingDrawType = 'draw_two';

  // Check valid stack plays
  const cardDrawTwo = { id: 'c1', color: 'red', value: 'draw_two' as const, pointValue: 20 };
  const cardWildFour = { id: 'c2', color: 'wild', value: 'wild_draw_four' as const, pointValue: 50 };
  const cardNormal = { id: 'c3', color: 'red', value: '5' as const, pointValue: 5 };

  assert.strictEqual(game.isPlayValid(cardDrawTwo, false, 'p1'), true, '+2 can stack on +2');
  assert.strictEqual(game.isPlayValid(cardWildFour, false, 'p1'), true, '+4 can stack on +2 with freeStacking');
  assert.strictEqual(game.isPlayValid(cardNormal, false, 'p1'), false, 'Normal card cannot be played when pending draw > 0');
  game.clearTurnTimer();
});

test('UnoGame - No Mercy 25-card elimination', () => {
  const players = [
    { id: 'p1', name: 'Alice', avatar: 'av-1', isBot: false },
    { id: 'p2', name: 'Bob', avatar: 'av-2', isBot: false }
  ];

  const game = new UnoGame(players, {
    mode: 'no-mercy',
    rules: { mercyLimit: 25 }
  });
  game.start();

  const alice = game.state.players.find(p => p.id === 'p1')!;
  alice.cardCount = 25;
  (game as any).checkMercyElimination('p1');

  assert.strictEqual(alice.eliminated, true, 'Alice should be eliminated under Mercy Rule');
  assert.strictEqual(game.state.isGameOver, true, 'Game should end if only Bob remains');
  assert.deepStrictEqual(game.state.winners, ['p2'], 'Bob should be the winner');
  game.clearTurnTimer();
});

test('UnoGame - No Mercy +4 +6 +8 +10 Black Cards Stacking & Deck Composition', () => {
  const { UnoDeck } = require('./UnoDeck');
  const noMercyDeck = UnoDeck.createNoMercyDeck();

  const wildFours = noMercyDeck.filter((c: any) => c.value === 'wild_draw_four');
  const wildReverseFours = noMercyDeck.filter((c: any) => c.value === 'wild_reverse_draw_four');
  const wildSixes = noMercyDeck.filter((c: any) => c.value === 'wild_draw_six');
  const wildEights = noMercyDeck.filter((c: any) => c.value === 'wild_draw_eight');
  const wildTens = noMercyDeck.filter((c: any) => c.value === 'wild_draw_ten');

  assert.strictEqual(wildFours.length, 8, 'Should have 8 Wild Draw 4');
  assert.strictEqual(wildReverseFours.length, 8, 'Should have 8 Wild Reverse Draw 4');
  assert.strictEqual(wildSixes.length, 8, 'Should have 8 Wild Draw 6');
  assert.strictEqual(wildEights.length, 8, 'Should have 8 Wild Draw 8');
  assert.strictEqual(wildTens.length, 8, 'Should have 8 Wild Draw 10');

  const players = [
    { id: 'p1', name: 'Alice', avatar: 'av-1', isBot: false },
    { id: 'p2', name: 'Bob', avatar: 'av-2', isBot: false }
  ];

  const game = new UnoGame(players, {
    mode: 'no-mercy',
    rules: { freeStacking: true }
  });
  game.start();

  game.state.pendingDrawCount = 6;
  game.state.pendingDrawType = 'wild_draw_six';
  game.state.activeColor = 'red';

  const cardEight = { id: 'c8', color: 'wild' as const, value: 'wild_draw_eight' as const, pointValue: 80 };
  const cardFour = { id: 'c4', color: 'wild' as const, value: 'wild_draw_four' as const, pointValue: 50 };
  const redDrawTwo = { id: 'c2-red', color: 'red' as const, value: 'draw_two' as const, pointValue: 20 };
  const blueDrawTwo = { id: 'c2-blue', color: 'blue' as const, value: 'draw_two' as const, pointValue: 20 };
  const redDrawFour = { id: 'c4-red', color: 'red' as const, value: 'draw_four' as const, pointValue: 40 };

  // All draw cards can stack:
  // Wild +8 can stack
  assert.strictEqual(game.isPlayValid(cardEight, false, 'p1'), true, 'Wild +8 can stack on +6');
  // Wild +4 can stack (no longer blocked by lower value!)
  assert.strictEqual(game.isPlayValid(cardFour, false, 'p1'), true, 'Wild +4 can stack on +6');
  // Red +2 can stack because active color is Red!
  assert.strictEqual(game.isPlayValid(redDrawTwo, false, 'p1'), true, 'Red +2 can stack on Red +6');
  // Red +4 can stack because active color is Red!
  assert.strictEqual(game.isPlayValid(redDrawFour, false, 'p1'), true, 'Red +4 can stack on Red +6');
  // Blue +2 cannot stack because active color is Red and value does not match +6
  assert.strictEqual(game.isPlayValid(blueDrawTwo, false, 'p1'), false, 'Blue +2 cannot stack on Red +6');

  // Now test user scenario: Wild +8 Red, stack +2 and +4
  game.state.pendingDrawCount = 8;
  game.state.pendingDrawType = 'wild_draw_eight';
  game.state.activeColor = 'red';
  game.state.topCard = cardEight;

  assert.strictEqual(game.isPlayValid(redDrawTwo, false, 'p1'), true, 'Red +2 can stack on Wild +8 Red');
  assert.strictEqual(game.isPlayValid(redDrawFour, false, 'p1'), true, 'Red +4 can stack on Wild +8 Red');
  assert.strictEqual(game.isPlayValid(cardFour, false, 'p1'), true, 'Wild +4 can stack on Wild +8 Red');

  game.clearTurnTimer();
});

test('UnoGame - 2-player game Reverse alternates turn to opponent instead of giving infinite turns', () => {
  const players = [
    { id: 'p1', name: 'Alice', avatar: 'av-1', isBot: false },
    { id: 'p2', name: 'Bob', avatar: 'av-2', isBot: false }
  ];

  const game = new UnoGame(players, {
    mode: 'classic',
    rules: { freeStacking: true }
  });
  game.start();

  game.state.currentTurnIndex = 0; // Alice starts
  game.state.activeColor = 'red';
  game.state.topCard = { id: 'top', color: 'red', value: '1', pointValue: 1 };

  const aliceHand: any[] = (game as any).hands.get('p1');
  const reverseCard = { id: 'rev-red', color: 'red' as const, value: 'reverse' as const, pointValue: 20 };
  aliceHand.push(reverseCard);

  // Alice plays reverse card
  const res = game.handleAction('p1', { type: 'PLAY_CARD', cardId: 'rev-red' });
  assert.strictEqual(res.success, true);

  // Turn MUST advance to Bob (index 1), NOT stay with Alice!
  assert.strictEqual(game.state.currentTurnIndex, 1, 'Turn must pass to Bob when Alice plays Reverse in 2-player game');
  assert.strictEqual(game.state.direction, -1, 'Direction must be reversed');

  game.clearTurnTimer();
});

