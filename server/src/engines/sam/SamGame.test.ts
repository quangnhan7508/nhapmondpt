import test from 'node:test';
import assert from 'node:assert/strict';
import { SamCardEvaluator } from './SamCardEvaluator';
import { SamGame } from './SamGame';
import { SamCard } from './types';

test('SamCardEvaluator - suit-less comparison and combo types', () => {
  const card3S: SamCard = { id: '1', suit: 'spades', value: '3', rankValue: 3, suitValue: 0, overallRank: 12 };
  const card3H: SamCard = { id: '2', suit: 'hearts', value: '3', rankValue: 3, suitValue: 3, overallRank: 15 };
  const card4D: SamCard = { id: '3', suit: 'diamonds', value: '4', rankValue: 4, suitValue: 2, overallRank: 18 };
  const card2H: SamCard = { id: '4', suit: 'hearts', value: '2', rankValue: 15, suitValue: 3, overallRank: 63 };

  // Singles: suit does NOT matter in Sâm
  const combo3S = SamCardEvaluator.evaluateCombo([card3S]);
  const combo3H = SamCardEvaluator.evaluateCombo([card3H]);
  const combo4D = SamCardEvaluator.evaluateCombo([card4D]);
  const combo2H = SamCardEvaluator.evaluateCombo([card2H]);

  assert.equal(SamCardEvaluator.canBeat(combo3H, combo3S), false); // Same rank cannot beat
  assert.equal(SamCardEvaluator.canBeat(combo4D, combo3S), true); // 4 beats 3
  assert.equal(SamCardEvaluator.canBeat(combo2H, combo4D), true); // 2 beats 4

  // Tứ Quý chặt 2
  const tuQuyCards: SamCard[] = [
    { id: '10', suit: 'spades', value: '8', rankValue: 8, suitValue: 0, overallRank: 32 },
    { id: '11', suit: 'clubs', value: '8', rankValue: 8, suitValue: 1, overallRank: 33 },
    { id: '12', suit: 'diamonds', value: '8', rankValue: 8, suitValue: 2, overallRank: 34 },
    { id: '13', suit: 'hearts', value: '8', rankValue: 8, suitValue: 3, overallRank: 35 }
  ];
  const comboTuQuy = SamCardEvaluator.evaluateCombo(tuQuyCards);
  assert.equal(comboTuQuy.type, 'four_of_a_kind');
  assert.equal(SamCardEvaluator.canBeat(comboTuQuy, combo2H), true); // Tứ Quý chặt 2

  // A-2-3 Sảnh Hạ
  const cardA: SamCard = { id: 'a', suit: 'spades', value: 'A', rankValue: 14, suitValue: 0, overallRank: 56 };
  const card2: SamCard = { id: '2', suit: 'clubs', value: '2', rankValue: 15, suitValue: 1, overallRank: 61 };
  const card3: SamCard = { id: '3', suit: 'diamonds', value: '3', rankValue: 3, suitValue: 2, overallRank: 14 };
  const comboA23 = SamCardEvaluator.evaluateCombo([cardA, card2, card3]);
  assert.equal(comboA23.type, 'straight');

  const card4: SamCard = { id: '4', suit: 'spades', value: '4', rankValue: 4, suitValue: 0, overallRank: 16 };
  const card5: SamCard = { id: '5', suit: 'clubs', value: '5', rankValue: 5, suitValue: 1, overallRank: 21 };
  const combo345 = SamCardEvaluator.evaluateCombo([card3, card4, card5]);
  assert.equal(combo345.type, 'straight');
  // 3-4-5 beats A-2-3 (A-2-3 is smallest)
  assert.equal(SamCardEvaluator.canBeat(combo345, comboA23), true);
  assert.equal(SamCardEvaluator.canBeat(comboA23, combo345), false);
});

test('SamGame - setup 10 cards and Báo Sâm flow', () => {
  const players = [
    { id: 'p1', name: 'Alice', avatar: 'av-fox', isBot: false },
    { id: 'p2', name: 'Bob', avatar: 'av-cat', isBot: true }
  ];

  const game = new SamGame(players);
  game.start();

  assert.equal(game.state.phase, 'bao_sam');
  assert.equal(game.state.players.length, 2);
  assert.equal(game.state.players[0].cardCount, 10);
  assert.equal(game.state.players[1].cardCount, 10);

  const masked = game.getMaskedState('p1');
  assert.equal(masked.gameType, 'sam');
  assert.equal(masked.myHand.length, 10);
  assert.equal(masked.phase, 'bao_sam');

  // Player 1 calls Báo Sâm
  const res = game.handleAction('p1', { type: 'BAO_SAM', baoSam: true });
  assert.equal(res.success, true);
  assert.equal(game.state.phase, 'playing');
  assert.equal(game.state.samCallerId, 'p1');
  assert.equal(game.state.currentTurnIndex, 0); // Caller goes first!
});
