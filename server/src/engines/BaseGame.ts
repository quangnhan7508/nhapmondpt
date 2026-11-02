import crypto from 'crypto';

export type GameType = 'uno' | 'exploding-kittens' | 'tien-len' | 'sam' | 'co-ca-ngua' | 'co-vua' | 'co-tuong';

export interface BasePlayer {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  connected: boolean;
  score?: number;
  eliminated?: boolean;
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'action' | 'warning' | 'win' | 'special';
  playerId?: string;
}

export interface BaseGameState {
  gameType: GameType;
  players: BasePlayer[];
  currentTurnIndex: number;
  direction: 1 | -1;
  turnTimeLimit: number;
  turnStartTime: number;
  isGameOver: boolean;
  winners: string[];
  logs: GameLogEntry[];
}

export abstract class BaseGame<
  TState extends BaseGameState = BaseGameState,
  TAction = any,
  TMaskedState = any
> {
  public state: TState;
  private turnTimer: NodeJS.Timeout | null = null;
  private onStateChangeCallback?: () => void;
  private onPrivateMessageCallback?: (playerId: string, event: string, payload: any) => void;
  private onGameOverCallback?: (winners: string[]) => void;

  constructor(state: TState) {
    this.state = state;
  }

  public setCallbacks(callbacks: {
    onStateChange: () => void;
    onPrivateMessage?: (playerId: string, event: string, payload: any) => void;
    onGameOver?: (winners: string[]) => void;
  }) {
    this.onStateChangeCallback = callbacks.onStateChange;
    this.onPrivateMessageCallback = callbacks.onPrivateMessage;
    this.onGameOverCallback = callbacks.onGameOver;
  }

  protected emitStateChange() {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback();
    }
  }

  protected emitPrivateMessage(playerId: string, event: string, payload: any) {
    if (this.onPrivateMessageCallback) {
      this.onPrivateMessageCallback(playerId, event, payload);
    }
  }

  protected emitGameOver(winners: string[]) {
    this.clearTurnTimer();
    this.state.isGameOver = true;
    this.state.winners = winners;
    if (this.onGameOverCallback) {
      this.onGameOverCallback(winners);
    }
    this.emitStateChange();
  }

  public addLog(message: string, type: GameLogEntry['type'] = 'info', playerId?: string) {
    const entry: GameLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      message,
      type,
      playerId
    };
    this.state.logs.push(entry);
    // Keep max 100 log entries
    if (this.state.logs.length > 100) {
      this.state.logs.shift();
    }
  }

  /**
   * Cryptographically secure Fisher-Yates shuffle
   */
  public static shuffleDeck<T>(deck: T[]): T[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Turn timer management
   */
  public resetTurnTimer() {
    this.clearTurnTimer();
    if (this.state.isGameOver) return;

    this.state.turnStartTime = Date.now();
    this.turnTimer = setTimeout(() => {
      this.handleTurnTimeout();
    }, this.state.turnTimeLimit * 1000);
    if (this.turnTimer && typeof this.turnTimer.unref === 'function') {
      this.turnTimer.unref();
    }
  }

  public clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  public getCurrentPlayer(): BasePlayer | undefined {
    return this.state.players[this.state.currentTurnIndex];
  }

  public getNextPlayerIndex(skipCount: number = 1): number {
    const activePlayers = this.state.players;
    const total = activePlayers.length;
    let index = this.state.currentTurnIndex;
    const steps = Math.max(1, Math.abs(skipCount));
    let count = 0;

    while (count < steps) {
      index = (index + this.state.direction + total) % total;
      // Skip eliminated players if any
      if (!activePlayers[index].eliminated) {
        count++;
      }
      // Safety guard against infinite loops
      if (count > total * 2) break;
    }
    return index;
  }

  public abstract start(): void;
  public abstract handleAction(playerId: string, action: TAction): { success: boolean; message?: string };
  public abstract handleTurnTimeout(): void;
  public abstract getMaskedState(playerId: string): TMaskedState;
  public abstract handleDisconnect(playerId: string): void;
  public abstract handleReconnect(playerId: string): void;
}
