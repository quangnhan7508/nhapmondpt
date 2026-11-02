import fs from 'fs';
import path from 'path';
import { UserManager } from './UserManager';
import { PERSISTED_KEYS, redisConfigured, redisGet, scheduleRemoteSave } from '../storage/redisRest';

export interface Giftcode {
  code: string; // Uppercase normalized
  reward: number; // Coin reward
  description: string;
  active: boolean;
  claimedBy: string[]; // List of user IDs who already redeemed
  /** true = dùng được nhiều lần (không giới hạn mỗi user) */
  repeatable?: boolean;
  maxClaims?: number;
  expiresAt?: number;
  createdAt: number;
}

export class GiftcodeManager {
  private dataFilePath: string;
  private giftcodes: Map<string, Giftcode> = new Map(); // UPPERCASE code -> Giftcode
  private userManager: UserManager;

  constructor(userManager: UserManager, customPath?: string) {
    this.userManager = userManager;
    this.dataFilePath = customPath || path.resolve(__dirname, '../../../data/giftcodes.json');
    this.ensureDataDir();
    this.loadGiftcodes();
  }

  private ensureDataDir() {
    const dir = path.dirname(this.dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  public async initRemote(): Promise<void> {
    if (!redisConfigured()) {
      return;
    }
    try {
      const raw = await redisGet(PERSISTED_KEYS.KEY_GIFTCODES);
      if (raw) {
        const list: Giftcode[] = JSON.parse(raw);
        for (const item of list) {
          this.giftcodes.set(item.code.toUpperCase(), item);
        }
        console.log(`[GiftcodeManager] Loaded ${list.length} giftcodes from Redis.`);
      }
      this.ensureDefaultCodes();
      this.saveGiftcodes();
    } catch (err) {
      console.warn('[GiftcodeManager] Redis init failed:', err instanceof Error ? err.message : err);
    }
  }

  private loadGiftcodes() {
    if (!fs.existsSync(this.dataFilePath)) {
      this.ensureDefaultCodes();
      this.saveGiftcodes();
      return;
    }

    try {
      const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
      const list: Giftcode[] = JSON.parse(raw);
      this.giftcodes.clear();
      for (const item of list) {
        this.giftcodes.set(item.code.toUpperCase(), item);
      }
      this.ensureDefaultCodes();
    } catch (err) {
      console.error('[GiftcodeManager] Error loading giftcodes:', err);
      this.ensureDefaultCodes();
    }
  }

  private ensureDefaultCodes() {
    // 1. dinhvantrinh (100,000 vàng)
    if (!this.giftcodes.has('DINHVANTRINH')) {
      this.giftcodes.set('DINHVANTRINH', {
        code: 'DINHVANTRINH',
        reward: 100000,
        description: 'Giftcode đặc biệt Đinh Văn Trinh (100,000 vàng)',
        active: true,
        claimedBy: [],
        createdAt: Date.now()
      });
    }

    // 2. Bonus codes for community
    if (!this.giftcodes.has('TANTHU')) {
      this.giftcodes.set('TANTHU', {
        code: 'TANTHU',
        reward: 10000,
        description: 'Giftcode Tân Thủ chào mừng người chơi mới (10,000 vàng)',
        active: true,
        claimedBy: [],
        createdAt: Date.now()
      });
    }

    if (!this.giftcodes.has('OMNIDECK')) {
      this.giftcodes.set('OMNIDECK', {
        code: 'OMNIDECK',
        reward: 20000,
        description: 'Giftcode OmniDeck Arena mừng phát hành (20,000 vàng)',
        active: true,
        claimedBy: [],
        createdAt: Date.now()
      });
    }

    // 4. Giftcode ZZZ (50 tỉ vàng, dùng nhiều lần) — luôn đồng bộ từ code
    const existingZzz = this.giftcodes.get('ZZZ');
    if (!existingZzz || !existingZzz.repeatable) {
      this.giftcodes.set('ZZZ', {
        code: 'ZZZ',
        reward: 50000000000,
        description: 'Giftcode ZZZ (50,000,000,000 vàng, dùng nhiều lần)',
        active: true,
        claimedBy: existingZzz?.claimedBy ?? [],
        repeatable: true,
        createdAt: existingZzz?.createdAt ?? Date.now()
      });
    }
  }

  private saveGiftcodes() {
    try {
      this.ensureDataDir();
      const list = Array.from(this.giftcodes.values());
      fs.writeFileSync(this.dataFilePath, JSON.stringify(list, null, 2), 'utf-8');
      scheduleRemoteSave(
        PERSISTED_KEYS.KEY_GIFTCODES,
        () => JSON.stringify(Array.from(this.giftcodes.values()))
      );
    } catch (err) {
      console.error('[GiftcodeManager] Error saving giftcodes:', err);
    }
  }

  public redeem(userId: string, codeInput: string): {
    success: boolean;
    message: string;
    reward?: number;
    newBalance?: number;
    code?: string;
  } {
    if (!userId) {
      return { success: false, message: 'Vui lòng đăng nhập để nhập giftcode.' };
    }

    const user = this.userManager.getUserById(userId);
    if (!user) {
      return { success: false, message: 'Tài khoản người dùng không tồn tại.' };
    }

    if (!codeInput || typeof codeInput !== 'string') {
      return { success: false, message: 'Vui lòng nhập mã giftcode.' };
    }

    const cleanCode = codeInput.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: 'Mã giftcode không hợp lệ.' };
    }

    const giftcode = this.giftcodes.get(cleanCode);
    if (!giftcode || !giftcode.active) {
      return { success: false, message: 'Mã giftcode không tồn tại hoặc đã hết hạn.' };
    }

    if (giftcode.expiresAt && Date.now() > giftcode.expiresAt) {
      return { success: false, message: 'Mã giftcode đã hết hạn sử dụng.' };
    }

    if (giftcode.maxClaims && giftcode.claimedBy.length >= giftcode.maxClaims) {
      return { success: false, message: 'Mã giftcode đã đạt giới hạn lượt sử dụng.' };
    }

    if (!giftcode.repeatable && giftcode.claimedBy.includes(userId)) {
      return { success: false, message: 'Bạn đã sử dụng mã giftcode này rồi!' };
    }

    // Award reward (mã repeatable không ghi nhận lượt dùng → dùng lại thoải mái)
    if (!giftcode.repeatable) {
      giftcode.claimedBy.push(userId);
      this.saveGiftcodes();
    }

    const addRes = this.userManager.addBalance(userId, giftcode.reward, `Giftcode: ${giftcode.code}`);
    console.log(`[Giftcode] User ${user.displayName} (${userId}) redeemed code ${giftcode.code} (+${giftcode.reward} coins)`);

    return {
      success: true,
      message: `Kích hoạt thành công giftcode ${giftcode.code}! Bạn nhận được +${giftcode.reward.toLocaleString('vi-VN')} 🪙`,
      reward: giftcode.reward,
      newBalance: addRes.newBalance,
      code: giftcode.code
    };
  }

  public getGiftcode(code: string): Giftcode | undefined {
    return this.giftcodes.get(code.trim().toUpperCase());
  }

  public getAllGiftcodes(): Giftcode[] {
    return Array.from(this.giftcodes.values());
  }
}
