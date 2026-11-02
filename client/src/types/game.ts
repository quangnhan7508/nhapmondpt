export type GameType = 'uno' | 'exploding-kittens' | 'tien-len' | 'sam' | 'co-ca-ngua' | 'co-vua' | 'co-tuong';
export type SoloGameType = 'tai-xiu' | 'mines' | 'goals';
export type AppView =
  | 'dashboard'
  | 'navigation-panel'
  | 'lobby'
  | 'play'
  | 'room'
  | 'game'
  | 'work'
  | 'hustle'
  | 'leaderboard'
  | 'tai-xiu'
  | 'mines'
  | 'goals'
  | 'cases'
  | 'upgrade'
  | 'inventory';
export type UnoMode = 'classic' | 'no-mercy' | 'flex';
export type UnoColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';

export type ItemRarity = 'white' | 'blue' | 'purple' | 'red' | 'gold';

export interface InventoryItem {
  id: string; // unique instance id
  itemId: string; // template id
  name: string;
  rarity: ItemRarity;
  value: number; // coin sell value
  icon: string;
  obtainedAt: number;
  caseType?: string;
}

export interface CaseItemTemplate {
  itemId: string;
  name: string;
  rarity: ItemRarity;
  value: number;
  icon: string;
  weaponType: string;
}

export interface CaseDefinition {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  badge: string;
  gradient: string;
  items: CaseItemTemplate[];
}

export interface CaseOpenResult {
  success: boolean;
  wonItem?: InventoryItem;
  tape?: CaseItemTemplate[];
  winningIndex?: number;
  newBalance?: number;
  message?: string;
}

export interface CaseSingleSpin {
  wonItem: InventoryItem;
  tape: CaseItemTemplate[];
  winningIndex: number;
}

export interface CaseOpenMultiResult {
  success: boolean;
  spins?: CaseSingleSpin[];
  totalSpent?: number;
  totalWonValue?: number;
  newBalance?: number;
  message?: string;
}

export interface UpgradeResult {
  success: boolean;
  isWin?: boolean;
  rollNumber?: number;
  rollDegree?: number;
  winChance?: number;
  multiplier?: number;
  betAmount?: number;
  targetValue?: number;
  rollDirection?: 'under' | 'over';
  winningRange?: [number, number];
  newBalance?: number;
  consumedItemName?: string;
  message?: string;
}

export interface UserStats {
  unoWins: number;
  explodingKittensWins: number;
  tienLenWins: number;
  samWins?: number;
  totalWins: number;
  totalGames: number;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  balance: number;
  inventory?: InventoryItem[];
  stats: UserStats;
}

export interface RoomPlayer {
  id: string;
  sessionId?: string;
  userId?: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isBot: boolean;
  isReady: boolean;
  connected: boolean;
  hasPaidBet?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface EKExpansions {
  implodingKittens: boolean;
  streakingKittens: boolean;
  barkingKittens: boolean;
  timebombMode: boolean;
}

export interface RoomSettings {
  gameType: GameType;
  turnTimeLimit: number;
  unoMode: UnoMode;
  unoRules: {
    freeStacking: boolean;
    jumpIn: boolean;
    sevenZero: boolean;
    unoPenalty: boolean;
    mercyLimit: number;
    drawToMatch: boolean;
  };
  tienLenFirstTurnRule: boolean;
  tienLenCutTwoRule: boolean;
  ekExpansions: EKExpansions;
  betAmount: number;
}

export interface RoomState {
  id: string;
  hostId: string;
  players: RoomPlayer[];
  settings: RoomSettings;
  inGame: boolean;
  chatMessages: ChatMessage[];
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'action' | 'warning' | 'win' | 'special';
  playerId?: string;
}

// UNO
export interface UnoCard {
  id: string;
  color: UnoColor;
  value: string;
  pointValue: number;
  flexColor?: UnoColor;
  flexValue?: string;
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
  rules: RoomSettings['unoRules'];
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
  canCatchUno: string[];
  logs: GameLogEntry[];
}

// Exploding Kittens
export type EKCardType =
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
  type: EKCardType;
  name: string;
  description: string;
  isFaceUp?: boolean;
}

export interface MaskedEKPlayer {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  connected: boolean;
  cardCount: number;
  eliminated?: boolean;
}

export interface PendingAction {
  id: string;
  initiatorId: string;
  card: EKCard;
  actionType: 'single_card' | 'cat_pair' | 'cat_triple';
  targetPlayerId?: string;
  requestedCardType?: EKCardType;
  nopeCount: number;
  expiresAt: number;
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
  logs: GameLogEntry[];
  topDrawCardIsFaceUp?: boolean;
  topDrawCardName?: string;
  ekExpansions?: EKExpansions;
  curseActive?: boolean;
}

// Tiến Lên
export type Suit = 'spades' | 'clubs' | 'diamonds' | 'hearts';
export type CardValue = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2';

export interface TLCard {
  id: string;
  suit: Suit;
  value: CardValue;
  rankValue: number;
  suitValue: number;
  overallRank: number;
}

export interface CardCombo {
  type: string;
  cards: TLCard[];
  highestCard: TLCard;
  length: number;
}

export interface PlayedTrick {
  playerId: string;
  combo: CardCombo;
  timestamp: number;
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
  eliminated?: boolean;
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
  logs: GameLogEntry[];
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
  myHand: TLCard[];
  currentTrick: PlayedTrick | null;
  trickHistory: PlayedTrick[];
  logs: GameLogEntry[];
}

export interface MaskedCoCaNguaGameState {
  gameType: 'co-ca-ngua';
  players: any[];
  currentTurnIndex: number;
  isGameOver: boolean;
  winners: string[];
  logs: GameLogEntry[];
  [key: string]: any;
}

export interface MaskedCoVuaGameState {
  gameType: 'co-vua';
  players: any[];
  currentTurnIndex: number;
  isGameOver: boolean;
  winners: string[];
  logs: GameLogEntry[];
  [key: string]: any;
}

export interface MaskedCoTuongGameState {
  gameType: 'co-tuong';
  players: any[];
  currentTurnIndex: number;
  isGameOver: boolean;
  winners: string[];
  logs: GameLogEntry[];
  [key: string]: any;
}

export type AnyMaskedGameState =
  | MaskedUnoGameState
  | MaskedEKGameState
  | MaskedTLGameState
  | MaskedSamGameState
  | MaskedCoCaNguaGameState
  | MaskedCoVuaGameState
  | MaskedCoTuongGameState;

// ========== CURRENCY & TRANSACTIONS ==========

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'work' | 'bet' | 'win' | 'room_bet' | 'room_win' | 'signup_bonus';
  details: string;
  timestamp: number;
  balanceAfter: number;
}

// ========== WORK SYSTEM ==========

export interface WorkChallenge {
  word: string;
  expiresAt: number;
}

export interface WorkResult {
  success: boolean;
  earned?: number;
  newBalance?: number;
  message?: string;
  nextAvailableAt?: number;
}

// ========== TÀI XỈU (DICE) ==========

export type TaiXiuPhase = 'betting' | 'shaking' | 'revealing' | 'settling';
/** Chỉ còn 2 cửa cược Tài / Xỉu (đã xóa cửa Bão). */
export type TaiXiuBetType = 'tai' | 'xiu';

/** Tỉ lệ trả thưởng: cược 1 ăn 1.95, 0.05 mỗi cược vào hũ jackpot (nổ khi bão 1-1-1 / 6-6-6). */
export const TAIXIU_PAYOUT_RATE = 1.95;

export interface TaiXiuDice {
  d1: number;
  d2: number;
  d3: number;
  total: number;
}

export interface TaiXiuBet {
  userId: string;
  displayName: string;
  betType: TaiXiuBetType;
  amount: number;
}

export interface TaiXiuJackpotWin {
  roundId: string;
  dice: TaiXiuDice;
  side: 'tai' | 'xiu';
  sharedPool: number;
  winnerCount: number;
  shareEach: number;
  timestamp: number;
}

export interface TaiXiuRoundResult {
  roundId: string;
  dice: TaiXiuDice;
  result: 'tai' | 'xiu' | 'bao';
  md5Hash: string;
  rawString: string;
  timestamp: number;
  jackpotShared?: number;
}

export interface TaiXiuState {
  phase: TaiXiuPhase;
  roundId: string;
  md5Hash: string;
  phaseEndsAt: number;
  bets: TaiXiuBet[];
  currentBets?: TaiXiuBet[];
  myBets?: TaiXiuBet[];
  totalTai: number;
  totalXiu: number;
  totalBao: number;
  dice?: TaiXiuDice;
  result?: 'tai' | 'xiu' | 'bao';
  rawString?: string;
  history: TaiXiuRoundResult[];
  onlineCount: number;
  jackpotPool?: number;
  lastJackpot?: TaiXiuJackpotWin | null;
}

// ========== MINES ==========

export type MinesTileState = 'hidden' | 'star' | 'mine';

export interface MinesGameState {
  gameId: string;
  seedHash: string;
  mineCount: number;
  betAmount: number;
  grid: MinesTileState[];
  revealedCount: number;
  currentMultiplier: number;
  currentPayout: number;
  nextMultiplier: number;
  isGameOver: boolean;
  isWin: boolean;
  serverSeed?: string;
  clientSeed?: string;
  nonce?: number;
}

export interface MinesMultiplierTable {
  mineCount: number;
  multipliers: number[];
}

// ========== GOALS ==========

export type GoalsFieldSize = 'small' | 'medium' | 'big';
export type GoalsTileState = 'hidden' | 'safe' | 'bomb';

export interface GoalsGameState {
  gameId: string;
  seedHash: string;
  fieldSize: GoalsFieldSize;
  rows: number;
  columns: number;
  betAmount: number;
  grid: GoalsTileState[][];
  currentColumn: number;
  currentMultiplier: number;
  currentPayout: number;
  nextMultiplier: number;
  isGameOver: boolean;
  isWin: boolean;
  serverSeed?: string;
  clientSeed?: string;
  nonce?: number;
}

// ========== ROOM BETTING ==========

export interface RoomBetInfo {
  betAmount: number;
  potTotal: number;
  winMultiplier: number;
}

// ========== CS2 CASE BATTLES ==========

export type BattleMode = 'standard' | 'crazy';
export type BattleStatus = 'waiting' | 'starting' | 'spinning' | 'round_ended' | 'finished';

export interface BattlePlayer {
  id: string;
  displayName: string;
  avatar: string;
  isBot: boolean;
  totalValue: number;
  drops: InventoryItem[];
}

export interface PlayerRoundTape {
  tape: CaseItemTemplate[];
  winningIndex: number;
  wonItem: CaseItemTemplate;
}

export interface BattleRoundData {
  roundIndex: number;
  caseId: string;
  caseName: string;
  casePrice: number;
  caseIcon: string;
  playerTapes: Record<string, PlayerRoundTape>;
}

export interface BattleRoom {
  id: string;
  creatorId: string;
  maxPlayers: 2 | 3 | 4;
  mode: BattleMode;
  caseIds: string[];
  totalCost: number;
  players: BattlePlayer[];
  status: BattleStatus;
  currentRound: number;
  totalRounds: number;
  roundsHistory: BattleRoundData[];
  winnerId: string | null;
  winnerName?: string;
  allPrizes: InventoryItem[];
  createdAt: number;
}

export interface BattleRoomSummary {
  id: string;
  creatorId: string;
  maxPlayers: 2 | 3 | 4;
  mode: BattleMode;
  caseIds: string[];
  totalCost: number;
  playersCount: number;
  players: { id: string; displayName: string; avatar: string; isBot: boolean }[];
  status: BattleStatus;
  currentRound: number;
  totalRounds: number;
  winnerName?: string;
  createdAt: number;
}

// Slots Types
export type SlotSymbolId =
  | 'cowgirl'
  | 'whiskey'
  | 'hat'
  | 'holster'
  | 'A'
  | 'K'
  | 'Q'
  | 'J'
  | 'mj_green'
  | 'mj_red'
  | 'mj_white'
  | 'mj_char8'
  | 'mj_dots5'
  | 'mj_bamboo5'
  | 'mj_dots3'
  | 'mj_bamboo2'
  | 'aztec_mask'
  | 'aztec_chief'
  | 'aztec_statue'
  | 'aztec_snake'
  | 'aztec_carving_blue'
  | 'aztec_carving_green'
  | 'caishen_lion'
  | 'caishen_toad'
  | 'caishen_koi'
  | 'caishen_angpao'
  | 'caishen_cymbal'
  | 'caishen_firecracker'
  | 'caishen_god'
  | 'cocktail_bottle'
  | 'cocktail_whiskey'
  | 'cocktail_blue'
  | 'cocktail_green'
  | 'cocktail_lemon'
  | 'cocktail_shot'
  | '10'
  | 'wild'
  | 'scatter';

export interface SlotTile {
  id: string;
  symbol: SlotSymbolId;
  isGold: boolean;
  isSilver?: boolean;
  frame?: 'none' | 'silver' | 'gold';
  isWinning?: boolean;
  transformedToWild?: boolean;
  /** Stacked block (PG Soft: 1 symbol chiếm 2-4 ô, tính 1 ways). Chỉ ô đầu có span. */
  span?: number;
  /** Ô nối của stacked block (không tính ways riêng). */
  spanCont?: boolean;
  /** Id khối block để transform đồng bộ cả khối. */
  block?: string;
  /** Ô thuộc hàng top reel (hàng phụ trên cuộn 2-5). */
  isTopReel?: boolean;
}

export interface WinningWay {
  symbol: SlotSymbolId;
  reelCount: number;
  symbolCountsPerReel: number[];
  ways: number;
  basePayout: number;
  payout: number;
  winningTileIds: string[];
}

export interface CascadeStep {
  stepIndex: number;
  grid: SlotTile[][];
  multiplier: number;
  winningWays: WinningWay[];
  stepWin: number;
  totalWinSoFar: number;
  hasWins: boolean;
  scattersCount: number;
  transformedWildIds: string[];
}

export interface FreeSpinsState {
  userId: string;
  slotId: string;
  remaining: number;
  total: number;
  betAmount: number;
  totalWon: number;
}

export interface SpinResult {
  spinId: string;
  slotId: string;
  betAmount: number;
  isFreeSpin: boolean;
  freeSpinsState?: {
    remaining: number;
    total: number;
    totalWon: number;
  };
  /** Offer chờ nhận khi trigger Free Spins Caishen (chọn Nhận hoặc Gamble). */
  freeSpinsOffer?: {
    spins: number;
    mult: number;
    gamblesLeft: number;
  } | null;
  /** Multiplier reel Cocktail Nights: giá trị khởi đầu + từng bước cascade. */
  multReel?: {
    start: number[];
    steps: { mults: number[]; used: number[]; total: number }[];
  } | null;
  cascades: CascadeStep[];
  totalWin: number;
  scattersCount: number;
  triggeredFreeSpins: number;
  newBalance: number;
}

export interface SlotGameInfo {
  id: string;
  name: string;
  tagline: string;
  provider: string;
  banner: string;
  reels: number[];
  rtp: string;
  maxWin: string;
  volatility: 'Thấp' | 'Trung bình' | 'Cao' | 'Siêu cao';
  features: string[];
}

