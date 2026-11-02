import { ItemRarity, InventoryItem } from '../../auth/UserManager';

export interface CaseItemTemplate {
  itemId: string;
  name: string;
  rarity: ItemRarity;
  value: number; // coin sell value
  icon: string; // weapon icon emoji / badge
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
  tape?: CaseItemTemplate[]; // list of 35-40 items for CS2 horizontal roulette animation
  winningIndex?: number; // target item index in the tape (e.g. 30)
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
