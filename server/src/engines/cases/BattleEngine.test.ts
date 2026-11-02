import { test, describe } from 'node:test';
import assert from 'node:assert';
import { UserManager } from '../../auth/UserManager';
import { CaseEngine } from './CaseEngine';
import { BattleEngine } from './BattleEngine';

describe('Case Battle Engine Tests', () => {
  const userManager = new UserManager();
  const caseEngine = new CaseEngine(userManager);
  const battleEngine = new BattleEngine(userManager, caseEngine);

  // Register test users with balance
  const runId = Date.now().toString(36);
  const u1 = userManager.register(`btl_1_${runId}`, 'pass1', 'Player One', 'av-fox');
  const u2 = userManager.register(`btl_2_${runId}`, 'pass2', 'Player Two', 'av-cat');
  userManager.addBalance(u1.user!.id, 5000, 'test');
  userManager.addBalance(u2.user!.id, 5000, 'test');

  test('Create a battle room and deduct total cost from creator', () => {
    const res = battleEngine.createBattle(u1.user!.id, ['case_bronze', 'case_bronze'], 2, 'standard');
    assert.strictEqual(res.success, true);
    assert.ok(res.battle);
    assert.strictEqual(res.battle.totalCost, 100); // 50 + 50
    assert.strictEqual(res.battle.players.length, 1);
    assert.strictEqual(res.battle.status, 'waiting');
    assert.strictEqual(userManager.getBalance(u1.user!.id), 5400);
  });

  test('Join battle room and deduct cost', () => {
    const battle = battleEngine.listBattles().find(b => b.status === 'waiting')!;
    assert.ok(battle);

    const joinRes = battleEngine.joinBattle(battle.id, u2.user!.id);
    assert.strictEqual(joinRes.success, true);
    assert.strictEqual(userManager.getBalance(u2.user!.id), 5400);
    assert.strictEqual(joinRes.battle!.players.length, 2);
    // Should transition to starting because 2/2 players
    assert.strictEqual(joinRes.battle!.status, 'starting');
  });

  test('Crazy Mode battle creation and bot filling', () => {
    const res = battleEngine.createBattle(u1.user!.id, ['case_silver'], 2, 'crazy');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.battle!.mode, 'crazy');

    // Add bot to fill slot
    const botRes = battleEngine.addBot(res.battle!.id, u1.user!.id);
    assert.strictEqual(botRes.success, true);
    assert.strictEqual(botRes.battle!.players.length, 2);
    assert.strictEqual(botRes.battle!.players[1].isBot, true);
    assert.strictEqual(botRes.battle!.status, 'starting');
  });

  test('Cancel battle refunds human players', () => {
    const res = battleEngine.createBattle(u1.user!.id, ['case_gold'], 2, 'standard');
    assert.ok(res.battle);
    const balanceBeforeCancel = userManager.getBalance(u1.user!.id);

    const cancelRes = battleEngine.cancelBattle(res.battle.id, u1.user!.id);
    assert.strictEqual(cancelRes.success, true);
    assert.strictEqual(userManager.getBalance(u1.user!.id), balanceBeforeCancel + 1000);
  });
});
