import { EKCard } from '../../exploding-kittens/types';
import { ExplodingKittensGame } from '../../exploding-kittens/ExplodingKittensGame';

export class ExplodingKittensBotStrategy {
  public static decideAction(botId: string, game: ExplodingKittensGame) {
    const maskedState = game.getMaskedState(botId);
    const myHand = maskedState.myHand;

    // 1. Defusal emergency!
    if (maskedState.pendingDefusal && maskedState.pendingDefusal.playerId === botId) {
      const defuse = myHand.find((c: EKCard) => c.type === 'defuse');
      if (defuse) {
        // Tactically insert Kitten at top or near top to pressure opponents
        game.handleAction(botId, {
          type: 'RESOLVE_DEFUSE',
          cardId: defuse.id,
          insertionMode: 'top'
        });
      }
      return;
    }

    // 2. Respond to Favor request
    if (maskedState.pendingFavor && maskedState.pendingFavor.fromPlayerId === botId) {
      // Give the least critical card (cat card or shuffle, keep defuse and nope!)
      const nonEssential = myHand.find((c: EKCard) => c.type !== 'defuse' && c.type !== 'nope');
      const cardToGive = nonEssential || myHand[0];
      if (cardToGive) {
        game.handleAction(botId, { type: 'GIVE_FAVOR_CARD', cardId: cardToGive.id });
      }
      return;
    }

    // 3. React during Nope window if another player's action hurts this bot
    if (maskedState.pendingAction) {
      const action = maskedState.pendingAction;
      const isTargeted = action.targetPlayerId === botId;
      const isAttack = action.card.type === 'attack';
      const isDirectHarm = isTargeted || isAttack;

      if (isDirectHarm && action.nopeCount % 2 === 0) {
        const nope = myHand.find((c: EKCard) => c.type === 'nope');
        if (nope) {
          game.handleAction(botId, { type: 'PLAY_NOPE', cardId: nope.id });
          return;
        }
      }
      return;
    }

    // 4. Normal turn logic
    const currentTurnPlayer = maskedState.players[maskedState.currentTurnIndex];
    if (!currentTurnPlayer || currentTurnPlayer.id !== botId) {
      return;
    }

    // 4a. If holding See The Future, play it to gain intel
    const seeFuture = myHand.find((c: EKCard) => c.type === 'see_the_future');
    if (seeFuture) {
      game.handleAction(botId, { type: 'PLAY_ACTION', cardId: seeFuture.id });
      return;
    }

    // 4b. Find opponents
    const opponents = maskedState.players.filter((p: any) => p.id !== botId && !p.eliminated);
    const primaryOpponent = opponents.sort((a: any, b: any) => b.cardCount - a.cardCount)[0];

    // 4c. If draw pile is dangerous (small deck) or Attack held, play Attack/Skip
    const attack = myHand.find((c: EKCard) => c.type === 'attack');
    if (attack && opponents.length > 0) {
      game.handleAction(botId, { type: 'PLAY_ACTION', cardId: attack.id });
      return;
    }

    const skip = myHand.find((c: EKCard) => c.type === 'skip');
    if (skip && maskedState.drawPileCount <= 10) {
      game.handleAction(botId, { type: 'PLAY_ACTION', cardId: skip.id });
      return;
    }

    // 4d. Play Favor if held
    const favor = myHand.find((c: EKCard) => c.type === 'favor');
    if (favor && primaryOpponent) {
      game.handleAction(botId, { type: 'PLAY_ACTION', cardId: favor.id, targetPlayerId: primaryOpponent.id });
      return;
    }

    // 4e. Check for Cat pair combos
    const catCounts = new Map<string, string[]>();
    for (const card of myHand) {
      if (card.type.endsWith('_cat') || card.type === 'cattermelon' || card.type === 'feral_cat') {
        const arr = catCounts.get(card.type) || [];
        arr.push(card.id);
        catCounts.set(card.type, arr);
      }
    }

    for (const [, cardIds] of catCounts.entries()) {
      if (cardIds.length >= 2 && primaryOpponent) {
        game.handleAction(botId, {
          type: 'PLAY_CAT_COMBO',
          cardIds: cardIds.slice(0, 2),
          targetPlayerId: primaryOpponent.id
        });
        return;
      }
    }

    // 4f. Draw card
    game.handleAction(botId, { type: 'DRAW_CARD' });
  }
}
