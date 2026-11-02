import crypto from 'crypto';
import { BaseGame } from '../BaseGame';
import { ExplodingKittensGame } from '../exploding-kittens/ExplodingKittensGame';
import { TienLenGame } from '../tien-len/TienLenGame';
import { UnoGame } from '../uno/UnoGame';
import { CoVuaGame } from '../co-vua/CoVuaGame';
import { CoTuongGame } from '../co-tuong/CoTuongGame';
import { SamGame } from '../sam/SamGame';
import { ExplodingKittensBotStrategy } from './strategies/ExplodingKittensBotStrategy';
import { TienLenBotStrategy } from './strategies/TienLenBotStrategy';
import { UnoBotStrategy } from './strategies/UnoBotStrategy';
import { SamBotStrategy } from './strategies/SamBotStrategy';

export class BotController {
  private game: BaseGame;
  private botIds: Set<string>;
  private pendingTimer: NodeJS.Timeout | null = null;
  private destroyed: boolean = false;

  constructor(game: BaseGame, botIds: string[]) {
    this.game = game;
    this.botIds = new Set(botIds);
  }

  public updateBotList(botIds: string[]) {
    this.botIds = new Set(botIds);
  }

  public notifyStateChange() {
    if (this.destroyed || this.game.state.isGameOver) {
      this.clearPendingAction();
      return;
    }

    // Clear any existing scheduled bot turn to debounce
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }

    // Check if any bot needs to act
    const botToAct = this.determineBotAction();
    if (!botToAct) return;

    // Simulate natural human reaction time: 1000ms - 1800ms
    const delay = crypto.randomInt(1000, 1800);

    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      if (this.destroyed || this.game.state.isGameOver) return;
      this.executeBotTurn(botToAct.botId, botToAct.actionType);
    }, delay);
  }

  private determineBotAction(): { botId: string; actionType: 'turn' | 'reaction' } | null {
    // 1. Exploding Kittens checks
    if (this.game instanceof ExplodingKittensGame) {
      const state = this.game.state;

      // Defusal emergency takes immediate priority
      if (state.pendingDefusal && this.botIds.has(state.pendingDefusal.playerId)) {
        return { botId: state.pendingDefusal.playerId, actionType: 'reaction' };
      }

      // Favor request pending
      if (state.pendingFavor && this.botIds.has(state.pendingFavor.fromPlayerId)) {
        return { botId: state.pendingFavor.fromPlayerId, actionType: 'reaction' };
      }

      // Nope window active: see if any bot wants to Nope
      if (state.pendingAction) {
        for (const botId of this.botIds) {
          if (state.pendingAction.initiatorId !== botId) {
            return { botId, actionType: 'reaction' };
          }
        }
      }
    }

    // 2. UNO checks
    if (this.game instanceof UnoGame) {
      // Uno catch opportunities
      for (const botId of this.botIds) {
        const masked = this.game.getMaskedState(botId);
        if (masked.canCatchUno && masked.canCatchUno.length > 0) {
          return { botId, actionType: 'reaction' };
        }
      }
    }

    // 3. Sâm checks
    if (this.game instanceof SamGame) {
      if (this.game.state.phase === 'bao_sam') {
        for (const botId of this.botIds) {
          const p = this.game.state.players.find(x => x.id === botId);
          if (p && !p.hasPassedCurrentRound && !(p as any).hasBaoSamResponded) {
            return { botId, actionType: 'reaction' };
          }
        }
      }
    }

    // 4. Regular active turn
    const currentPlayer = this.game.getCurrentPlayer();
    if (currentPlayer && this.botIds.has(currentPlayer.id) && !currentPlayer.eliminated) {
      return { botId: currentPlayer.id, actionType: 'turn' };
    }

    return null;
  }

  private executeBotTurn(botId: string, actionType: 'turn' | 'reaction') {
    try {
      if (this.game instanceof UnoGame) {
        UnoBotStrategy.decideAction(botId, this.game);
      } else if (this.game instanceof ExplodingKittensGame) {
        ExplodingKittensBotStrategy.decideAction(botId, this.game);
      } else if (this.game instanceof TienLenGame) {
        TienLenBotStrategy.decideAction(botId, this.game);
      } else if (this.game instanceof SamGame) {
        SamBotStrategy.decideAction(botId, this.game);
      } else if (this.game instanceof CoVuaGame) {
        const botPlayer = this.game.state.players.find(p => p.id === botId);
        if (botPlayer && botPlayer.color === this.game.state.activeColor) {
          const legalMoves = this.game.getAllLegalMoves(botPlayer.color);
          if (legalMoves.length > 0) {
            // Prioritize capturing opponent pieces
            const captures = legalMoves.filter(m => {
              const target = (this.game as CoVuaGame).state.board[m.to.r][m.to.c];
              return target && target.color !== botPlayer.color;
            });
            const selected = captures.length > 0
              ? captures[Math.floor(Math.random() * captures.length)]
              : legalMoves[Math.floor(Math.random() * legalMoves.length)];

            this.game.handleAction(botId, {
              type: 'MOVE_PIECE',
              from: selected.from,
              to: selected.to
            });
          }
        }
      } else if (this.game instanceof CoTuongGame) {
        const botPlayer = this.game.state.players.find(p => p.id === botId);
        if (botPlayer && botPlayer.color === this.game.state.activeColor) {
          const legalMoves = this.game.getAllLegalMoves(botPlayer.color);
          if (legalMoves.length > 0) {
            // Prioritize captures
            const captures = legalMoves.filter(m => {
              const target = (this.game as CoTuongGame).state.board[m.to.r][m.to.c];
              return target && target.color !== botPlayer.color;
            });
            const selected = captures.length > 0
              ? captures[Math.floor(Math.random() * captures.length)]
              : legalMoves[Math.floor(Math.random() * legalMoves.length)];

            this.game.handleAction(botId, {
              type: 'MOVE_PIECE',
              from: selected.from,
              to: selected.to
            });
          }
        }
      }
    } catch (err) {
      console.error(`[BotController] Error executing bot ${botId}:`, err);
    }
  }

  public clearPendingAction() {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }

  public destroy() {
    this.destroyed = true;
    this.clearPendingAction();
  }
}
