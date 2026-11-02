import { BaseGameState, BasePlayer } from '../BaseGame';

export type UnoColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';

export type UnoValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip'
  | 'reverse'
  | 'draw_two'
  | 'wild'
  | 'wild_draw_four'
  // No Mercy extensions
  | 'draw_four'
  | 'wild_draw_six'
  | 'wild_draw_eight'
  | 'wild_draw_ten'
  | 'skip_everyone'
  | 'discard_all'
  | 'wild_color_roulette'
  | 'wild_reverse_draw_four'
  // Flex extensions
  | 'flex_all_flip';

export type UnoMode = 'classic' | 'no-mercy' | 'flex';

export interface UnoCard {
  id: string;
  color: UnoColor;
  value: UnoValue;
  pointValue: number;
  // Flex mode secondary side
  flexColor?: UnoColor;
  flexValue?: UnoValue;
}

export interface UnoRules {
  freeStacking: boolean;      // Can stack +2, +4, +6, +10 on top of each other
  jumpIn: boolean;            // Can play out of turn on exact match (color + value)
  sevenZero: boolean;         // 7 = swap hands, 0 = pass hands in direction
  unoPenalty: boolean;        // Catch uncalled UNO
  mercyLimit: number;         // Hand size limit before instant knockout (default 25 in No Mercy)
  drawToMatch: boolean;       // Draw until playable or draw 1
}

export interface UnoPlayer extends BasePlayer {
  cardCount: number;
  hasCalledUno: boolean;
  flexPowerActive: boolean;   // true: Green, false: Red
  mercyEliminated?: boolean;
}

export interface UnoGameState extends BaseGameState {
  gameType: 'uno';
  mode: UnoMode;
  rules: UnoRules;
  activeColor: UnoColor;
  topCard: UnoCard;
  pendingDrawCount: number;
  pendingDrawType: UnoValue | null;
  drawPileCount: number;
  calledUnoMap: Record<string, boolean>;
  players: UnoPlayer[];
  lastPlayedBy?: string;
  lastPlayedCard?: UnoCard;
  lastPlayTimestamp: number;
}

export interface MaskedUnoPlayer {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  connected: boolean;
  cardCount: number;
  hasCalledUno: boolean;
  flexPowerActive: boolean;
  eliminated?: boolean;
  score?: number;
}

export interface MaskedUnoGameState {
  gameType: 'uno';
  mode: UnoMode;
  rules: UnoRules;
  activeColor: UnoColor;
  topCard: UnoCard;
  lastPlayedBy?: string;
  lastPlayedCard?: UnoCard;
  lastPlayTimestamp?: number;
  pendingDrawCount: number;
  drawPileCount: number;
  currentTurnIndex: number;
  direction: 1 | -1;
  turnTimeLimit: number;
  turnStartTime: number;
  isGameOver: boolean;
  winners: string[];
  players: MaskedUnoPlayer[];
  myHand: UnoCard[];
  myFlexPower: boolean;
  canCallUno: boolean;
  canCatchUno: string[]; // Player IDs that can be caught
  logs: BaseGameState['logs'];
}

export type UnoAction =
  | { type: 'PLAY_CARD'; cardId: string; chosenColor?: UnoColor; isFlex?: boolean; targetPlayerId?: string }
  | { type: 'DRAW_CARD' }
  | { type: 'CALL_UNO' }
  | { type: 'CATCH_UNO'; targetPlayerId: string }
  | { type: 'JUMP_IN'; cardId: string; chosenColor?: UnoColor; isFlex?: boolean; targetPlayerId?: string };
