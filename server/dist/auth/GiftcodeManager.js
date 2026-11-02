"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftcodeManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const redisRest_1 = require("../storage/redisRest");
class GiftcodeManager {
    dataFilePath;
    giftcodes = new Map(); // UPPERCASE code -> Giftcode
    userManager;
    constructor(userManager, customPath) {
        this.userManager = userManager;
        this.dataFilePath = customPath || path_1.default.resolve(__dirname, '../../../data/giftcodes.json');
        this.ensureDataDir();
        this.loadGiftcodes();
    }
    ensureDataDir() {
        const dir = path_1.default.dirname(this.dataFilePath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
    }
    async initRemote() {
        if (!(0, redisRest_1.redisConfigured)()) {
            return;
        }
        try {
            const raw = await (0, redisRest_1.redisGet)(redisRest_1.PERSISTED_KEYS.KEY_GIFTCODES);
            if (raw) {
                const list = JSON.parse(raw);
                for (const item of list) {
                    this.giftcodes.set(item.code.toUpperCase(), item);
                }
                console.log(`[GiftcodeManager] Loaded ${list.length} giftcodes from Redis.`);
            }
            this.ensureDefaultCodes();
            this.saveGiftcodes();
        }
        catch (err) {
            console.warn('[GiftcodeManager] Redis init failed:', err instanceof Error ? err.message : err);
        }
    }
    loadGiftcodes() {
        if (!fs_1.default.existsSync(this.dataFilePath)) {
            this.ensureDefaultCodes();
            this.saveGiftcodes();
            return;
        }
        try {
            const raw = fs_1.default.readFileSync(this.dataFilePath, 'utf-8');
            const list = JSON.parse(raw);
            this.giftcodes.clear();
            for (const item of list) {
                this.giftcodes.set(item.code.toUpperCase(), item);
            }
            this.ensureDefaultCodes();
        }
        catch (err) {
            console.error('[GiftcodeManager] Error loading giftcodes:', err);
            this.ensureDefaultCodes();
        }
    }
    ensureDefaultCodes() {
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
    saveGiftcodes() {
        try {
            this.ensureDataDir();
            const list = Array.from(this.giftcodes.values());
            fs_1.default.writeFileSync(this.dataFilePath, JSON.stringify(list, null, 2), 'utf-8');
            (0, redisRest_1.scheduleRemoteSave)(redisRest_1.PERSISTED_KEYS.KEY_GIFTCODES, () => JSON.stringify(Array.from(this.giftcodes.values())));
        }
        catch (err) {
            console.error('[GiftcodeManager] Error saving giftcodes:', err);
        }
    }
    redeem(userId, codeInput) {
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
    getGiftcode(code) {
        return this.giftcodes.get(code.trim().toUpperCase());
    }
    getAllGiftcodes() {
        return Array.from(this.giftcodes.values());
    }
}
exports.GiftcodeManager = GiftcodeManager;
