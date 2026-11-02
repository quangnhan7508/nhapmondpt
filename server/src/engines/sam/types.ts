import { BaseGameState, BasePlayer } from '../BaseGame';

export type Suit = 'spades' | 'clubs' | 'diamonds' | 'hearts';
export type CardValue = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2';

export interface SamCard {
  id: string;
  suit: Suit;
  value: CardValue;
  rankValue: number; // 3=3, 4=4 ... A=14, 2=15
  suitValue: number; // spades=0, clubs=1, diamonds=2, hearts=3
  overallRank: number; // rankValue * 4 + suitValue (for sorting only, Sâm does not compare suits)
}

export type SamComboType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'straight'
  | 'four_of_a_kind' // Tứ quý (chặt 1 Heo)
  | 'invalid';

export interface SamCardCombo {
  type: SamComboType;
  cards: SamCard[];
  highestCard: SamCard;
  length: number;
}

export type SamToiTrangType =
  | 'dragon_straight_10' // Sảnh rồng 10 lá liên tiếp
  | 'four_twos'          // Tứ quý 2
  | 'five_pairs'         // 5 đôi
  | 'same_color'         // 10 lá đồng màu
  | null;

export interface SamPlayer extends BasePlayer {
  cardCount: number;
  rank?: number; // 1st, 2nd, 3rd, 4th, 5th
  hasPassedCurrentRound: boolean;
  playedCardsCount: number;
  isCong?: boolean;
  isBaoSam?: boolean;
  isBaoMot?: boolean;
  isDenSam?: boolean;
  hasBaoSamResponded?: boolean;
  penaltyPoints?: number;
}

export interface SamPlayedTrick {
  playerId: string;
  combo: SamCardCombo;
  timestamp: number;
}

export interface SamGameState extends BaseGameState {
  gameType: 'sam';
  phase: 'bao_sam' | 'playing' | 'ended';
  samCallerId?: string; // Player who called Sâm
  baoSamDeadline?: number;
  players: SamPlayer[];
  currentTrick: SamPlayedTrick | null;
  trickHistory: SamPlayedTrick[];
  roundPassCount: number;
  finishedRanking: string[];
}

export interface MaskedSamPlayer {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  connected: boolean;
  cardCount: number;
  hasPassedCurrentRound: boolean;
  rank?: number;
  isCong?: boolean;
  isBaoSam?: boolean;
  isBaoMot?: boolean;
  isDenSam?: boolean;
}

export interface MaskedSamGameState {
  gameType: 'sam';
  phase: 'bao_sam' | 'playing' | 'ended';
  samCallerId?: string;
  baoSamDeadline?: number;
  players: MaskedSamPlayer[];
  currentTurnIndex: number;
  direction: 1 | -1;
  turnTimeLimit: number;
  turnStartTime: number;
  isGameOver: boolean;
  winners: string[];
  myHand: SamCard[];
  currentTrick: SamPlayedTrick | null;
  trickHistory: SamPlayedTrick[];
  toiTrangWinner?: { playerId: string; type: SamToiTrangType };
  logs: BaseGameState['logs'];
}

export type SamAction =
  | { type: 'PLAY_CARDS'; cardIds: string[] }
  | { type: 'PASS_TURN' }
  | { type: 'BAO_SAM'; baoSam: boolean };
