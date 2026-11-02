import { BaseGameState, BasePlayer } from '../BaseGame';

export type Suit = 'spades' | 'clubs' | 'diamonds' | 'hearts'; // 0: Bích, 1: Chuồn/Tép, 2: Rô, 3: Cơ
export type CardValue = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2';

export interface TLCard {
  id: string;
  suit: Suit;
  value: CardValue;
  rankValue: number; // 3=3, 4=4 ... A=14, 2=15
  suitValue: number; // spades=0, clubs=1, diamonds=2, hearts=3
  overallRank: number; // rankValue * 4 + suitValue
}

export type ComboType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'straight'
  | 'three_pair_sequence' // 3 Đôi thông
  | 'four_of_a_kind'      // Tứ quý
  | 'four_pair_sequence'  // 4 Đôi thông
  | 'invalid';

export interface CardCombo {
  type: ComboType;
  cards: TLCard[];
  highestCard: TLCard;
  length: number;
}

export type ToiTrangType =
  | 'dragon_straight'      // Sảnh rồng (3 to A or 3 to 2)
  | 'four_twos'            // Tứ quý 2
  | 'six_pairs'            // 6 đôi
  | 'five_pair_sequence'   // 5 đôi thông
  | 'same_color'           // Đồng màu
  | null;

export interface TLPlayer extends BasePlayer {
  cardCount: number;
  rank?: number; // 1st, 2nd, 3rd, 4th
  hasPassedCurrentRound: boolean;
  playedCardsCount: number;
  isCong?: boolean;
  penaltyPoints?: number;
}

export interface PlayedTrick {
  playerId: string;
  combo: CardCombo;
  timestamp: number;
}

export interface TienLenGameState extends BaseGameState {
  gameType: 'tien-len';
  players: TLPlayer[];
  currentTrick: PlayedTrick | null;
  trickHistory: PlayedTrick[];
  roundPassCount: number;
  firstTurnRule: boolean; // First turn must contain 3 of Spades (if first game)
  cutTwoOutOfTurnRule?: boolean; // Tứ quý và 3 Đôi thông chặt Heo không cần vòng
  finishedRanking: string[];
}

export interface MaskedTLPlayer {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  connected: boolean;
  cardCount: number;
  hasPassedCurrentRound: boolean;
  rank?: number;
  isCong?: boolean;
}

export interface MaskedTLGameState {
  gameType: 'tien-len';
  players: MaskedTLPlayer[];
  currentTurnIndex: number;
  direction: 1 | -1;
  turnTimeLimit: number;
  turnStartTime: number;
  isGameOver: boolean;
  winners: string[];
  myHand: TLCard[];
  currentTrick: PlayedTrick | null;
  trickHistory: PlayedTrick[];
  firstTurnRule: boolean;
  cutTwoOutOfTurnRule?: boolean;
  toiTrangWinner?: { playerId: string; type: ToiTrangType };
  logs: BaseGameState['logs'];
}

export type TLAction =
  | { type: 'PLAY_CARDS'; cardIds: string[] }
  | { type: 'PASS_TURN' };
