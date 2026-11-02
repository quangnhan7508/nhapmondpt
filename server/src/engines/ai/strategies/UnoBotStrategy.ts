import { UnoCard, UnoColor } from '../../uno/types';
import { UnoGame } from '../../uno/UnoGame';

export class UnoBotStrategy {
  public static decideAction(botId: string, game: UnoGame) {
    const maskedState = game.getMaskedState(botId);
    const myHand = maskedState.myHand;

    // 1. Proactively catch any opponent who forgot to call UNO!
    if (maskedState.canCatchUno && maskedState.canCatchUno.length > 0) {
      const targetId = maskedState.canCatchUno[0];
      game.handleAction(botId, { type: 'CATCH_UNO', targetPlayerId: targetId });
      return;
    }

    // 2. Proactively call UNO if holding 1 or 2 cards
    if (maskedState.canCallUno) {
      game.handleAction(botId, { type: 'CALL_UNO' });
    }

    // Check if it's the bot's turn
    const currentTurnPlayer = maskedState.players[maskedState.currentTurnIndex];
    if (!currentTurnPlayer || currentTurnPlayer.id !== botId) {
      return;
    }

    // 3. Stacking situation: pending draw count > 0
    if (maskedState.pendingDrawCount > 0) {
      const drawCards = myHand.filter((c: UnoCard) => game.isPlayValid(c, false, botId));
      if (drawCards.length > 0) {
        // Stack the highest draw card (+10 > +6 > +4 > +2)
        drawCards.sort((a: UnoCard, b: UnoCard) => b.pointValue - a.pointValue);
        const cardToPlay = drawCards[0];
        const chosenColor = cardToPlay.color === 'wild' ? this.getMostFrequentColor(myHand) : undefined;
        game.handleAction(botId, { type: 'PLAY_CARD', cardId: cardToPlay.id, chosenColor });
        return;
      }
      // Cannot stack; must draw
      game.handleAction(botId, { type: 'DRAW_CARD' });
      return;
    }

    // 4. Normal turn: find all valid cards
    const validPlays: { card: UnoCard; isFlex: boolean }[] = [];

    for (const card of myHand) {
      if (game.isPlayValid(card, false, botId)) {
        validPlays.push({ card, isFlex: false });
      }
      // Check flex play if flex power is active
      if (maskedState.myFlexPower && game.isPlayValid(card, true, botId)) {
        validPlays.push({ card, isFlex: true });
      }
    }

    if (validPlays.length === 0) {
      // No valid card -> Draw
      game.handleAction(botId, { type: 'DRAW_CARD' });
      return;
    }

    // 5. Prioritize plays: Action cards > High numbers > Wilds
    validPlays.sort((a, b) => {
      const aIsAction = isAction(a.card.value);
      const bIsAction = isAction(b.card.value);
      if (aIsAction && !bIsAction) return -1;
      if (!aIsAction && bIsAction) return 1;
      return b.card.pointValue - a.card.pointValue;
    });

    const chosenPlay = validPlays[0];
    const chosenColor = chosenPlay.card.color === 'wild' ? this.getMostFrequentColor(myHand) : undefined;

    // Target selection for 7 swap rule: target opponent with least cards
    let targetPlayerId: string | undefined;
    if (chosenPlay.card.value === '7' && maskedState.rules.sevenZero) {
      const opponents = maskedState.players
        .filter((p: any) => p.id !== botId && !p.eliminated)
        .sort((a: any, b: any) => a.cardCount - b.cardCount);
      if (opponents.length > 0) {
        targetPlayerId = opponents[0].id;
      }
    }

    game.handleAction(botId, {
      type: 'PLAY_CARD',
      cardId: chosenPlay.card.id,
      chosenColor,
      isFlex: chosenPlay.isFlex,
      targetPlayerId
    });
  }

  private static getMostFrequentColor(hand: UnoCard[]): UnoColor {
    const counts: Record<UnoColor, number> = { red: 0, blue: 0, green: 0, yellow: 0, wild: 0 };
    for (const c of hand) {
      if (c.color !== 'wild') {
        counts[c.color]++;
      }
    }
    const colors: UnoColor[] = ['red', 'blue', 'green', 'yellow'];
    colors.sort((a, b) => counts[b] - counts[a]);
    return colors[0];
  }
}

function isAction(val: string): boolean {
  return ['skip', 'reverse', 'draw_two', 'draw_four', 'wild_draw_four', 'wild_reverse_draw_four', 'wild_draw_six', 'wild_draw_ten', 'skip_everyone', 'discard_all', 'wild_color_roulette'].includes(val);
}
