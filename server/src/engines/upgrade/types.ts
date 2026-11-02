export interface UpgradeRequest {
  userId: string;
  betType: 'coins' | 'item';
  betAmount?: number;
  itemInstanceId?: string;
  targetValue: number;
  rollDirection?: 'under' | 'over';
}

export interface UpgradeResult {
  success: boolean;
  isWin?: boolean;
  rollNumber?: number; // 0.00 to 99.99
  rollDegree?: number; // 0 to 360 degrees for wheel
  winChance?: number; // percentage, e.g. 47.50%
  multiplier?: number; // e.g. 2.0x
  betAmount?: number;
  targetValue?: number;
  rollDirection?: 'under' | 'over';
  winningRange?: [number, number]; // [startDeg, endDeg]
  newBalance?: number;
  consumedItemName?: string;
  message?: string;
}
