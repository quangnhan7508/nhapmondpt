import { BaseGameState, BasePlayer } from '../BaseGame';

export interface EKExpansions {
  implodingKittens: boolean;
  streakingKittens: boolean;
  barkingKittens: boolean;
  timebombMode: boolean;
}

export type ExplodingKittensCardType =
  | 'exploding_kitten'
  | 'defuse'
  | 'attack'
  | 'skip'
  | 'favor'
  | 'shuffle'
  | 'see_the_future'
  | 'nope'
  | 'taco_cat'
  | 'hairy_potato_cat'
  | 'rainbow_ralphing_cat'
  | 'beard_cat'
  | 'cattermelon'
  // Imploding Kittens
  | 'imploding_kitten'
  | 'targeted_attack'
  | 'reverse'
  | 'draw_from_bottom'
  | 'feral_cat'
  | 'alter_the_future_3x'
  // Streaking Kittens
  | 'streaking_kitten'
  | 'super_skip'
  | 'see_the_future_5x'
  | 'alter_the_future_5x'
  | 'swap_top_and_bottom'
  | 'catomic_bomb'
  | 'garbage_collection'
  | 'curse_of_cat_butt'
  // Barking Kittens
  | 'barking_kitten'
  | 'personal_attack'
  | 'bury'
  | 'ill_take_that'
  | 'share_the_future';

export interface EKCard {
  id: string;
  type: ExplodingKittensCardType;
  name: string;
  description: string;
  isFaceUp?: boolean;
}

export interface EKPlayer extends BasePlayer {
  cardCount: number;
  defuseCount: number;
  isExploded?: boolean;
  isBlinded?: boolean; // For Curse of Cat Butt
  markedCardId?: string; // For Mark
  illTakeThatFromPlayerId?: string; // For I'll Take That
}

export interface PendingAction {
  id: string;
  initiatorId: string;
  card: EKCard;
  actionType: 'single_card' | 'cat_pair' | 'cat_triple';
  targetPlayerId?: string;
  requestedCardType?: ExplodingKittensCardType;
  additionalCardIds?: string[];
  nopeCount: number; // 0 = not noped, 1 = noped, 2 = nope-noped, etc.
  expiresAt: number; // Unix timestamp
}

export interface PendingDefusal {
  playerId: string;
  kittenCard: EKCard;
  expiresAt: number;
}

export interface PendingFavor {
  fromPlayerId: string;
  toPlayerId: string;
}

export interface PendingGarbageCollection {
  pendingPlayerIds: string[];
}

export interface ExplodingKittensGameState extends BaseGameState {
  gameType: 'exploding-kittens';
  drawPileCount: number;
  discardPile: EKCard[];
  lastPlayedBy?: string;
  lastPlayedCard?: EKCard;
  players: EKPlayer[];
  pendingTurnsForCurrentPlayer: number; // For Attack accumulation
  pendingAction: PendingAction | null;
  pendingDefusal: PendingDefusal | null;
  pendingFavor: PendingFavor | null;
  pendingGarbageCollection?: PendingGarbageCollection | null;
  activeBarkingKitten?: { playedBy: string; card: EKCard } | null;
  expansions?: EKExpansions;
}

export interface MaskedEKPlayer {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  connected: boolean;
  cardCount: number;
  eliminated?: boolean;
  isBlinded?: boolean;
}

export interface MaskedEKGameState {
  gameType: 'exploding-kittens';
  drawPileCount: number;
  discardPile: EKCard[];
  lastPlayedBy?: string;
  lastPlayedCard?: EKCard;
  currentTurnIndex: number;
  direction: 1 | -1;
  turnTimeLimit: number;
  turnStartTime: number;
  isGameOver: boolean;
  winners: string[];
  players: MaskedEKPlayer[];
  myHand: EKCard[];
  pendingTurns: number;
  pendingAction: PendingAction | null;
  pendingDefusal: PendingDefusal | null;
  pendingFavor: PendingFavor | null;
  logs: BaseGameState['logs'];
  topDrawCardIsFaceUp?: boolean;
  topDrawCardName?: string;
  ekExpansions?: EKExpansions;
  curseActive?: boolean;
  pendingGarbage?: boolean;
}

export type EKAction =
  | { type: 'DRAW_CARD' }
  | { type: 'DRAW_FROM_BOTTOM' }
  | { type: 'PLAY_ACTION'; cardId: string; targetPlayerId?: string }
  | { type: 'PLAY_CAT_COMBO'; cardIds: string[]; targetPlayerId: string; requestedType?: ExplodingKittensCardType }
  | { type: 'PLAY_NOPE'; cardId: string }
  | { type: 'RESOLVE_DEFUSE'; cardId: string; insertionMode: 'top' | 'bottom' | 'random' | 'index'; targetIndex?: number }
  | { type: 'GIVE_FAVOR_CARD'; cardId: string }
  | { type: 'ALTER_FUTURE_REORDER'; cards: EKCard[] }
  | { type: 'GARBAGE_COLLECTION_SUBMIT'; cardId: string }
  | { type: 'BURY_CARD'; cardId: string; targetIndex: number };
