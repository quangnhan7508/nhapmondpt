"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpgradeEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
class UpgradeEngine {
    userManager;
    RTP = 0.95; // 95% RTP
    MIN_CHANCE = 1.0; // 1%
    MAX_CHANCE = 85.0; // 85%
    constructor(userManager) {
        this.userManager = userManager;
    }
    calculateWinChance(betAmount, targetValue) {
        if (betAmount <= 0 || targetValue <= betAmount)
            return 0;
        const rawChance = (betAmount / targetValue) * this.RTP * 100;
        const clamped = Math.max(this.MIN_CHANCE, Math.min(this.MAX_CHANCE, rawChance));
        return Math.round(clamped * 100) / 100;
    }
    playUpgrade(req) {
        const { userId, betType, targetValue } = req;
        const rollDirection = req.rollDirection || 'under';
        let actualBetAmount = 0;
        let consumedItemName;
        // 1. Validate and consume bet
        if (betType === 'item') {
            if (!req.itemInstanceId) {
                return { success: false, message: 'Chưa chọn vật phẩm để nâng cấp.' };
            }
            const consumeRes = this.userManager.consumeItem(userId, req.itemInstanceId);
            if (!consumeRes.success || !consumeRes.item) {
                return { success: false, message: consumeRes.message || 'Không thể sử dụng vật phẩm này.' };
            }
            actualBetAmount = consumeRes.item.value;
            consumedItemName = consumeRes.item.name;
        }
        else {
            // Coins bet (không giới hạn trần — hỗ trợ ALL IN toàn bộ số dư)
            const amt = Math.floor(Number(req.betAmount || 0));
            if (amt < 10) {
                return { success: false, message: 'Cược tối thiểu là 10 🪙.' };
            }
            const bal = this.userManager.getBalance(userId);
            if (bal < amt) {
                return { success: false, message: `Không đủ số dư: Cần ${amt.toLocaleString('vi-VN')} 🪙, bạn có ${bal.toLocaleString('vi-VN')} 🪙.` };
            }
            const deductRes = this.userManager.deductBalance(userId, amt, 'SkinClub Upgrade Bet');
            if (!deductRes.success) {
                return { success: false, message: deductRes.message || 'Lỗi trừ tiền cược.' };
            }
            actualBetAmount = amt;
        }
        // 2. Validate target value
        const targetAmt = Math.floor(Number(targetValue));
        if (targetAmt <= actualBetAmount) {
            // Refund if invalid
            if (betType === 'coins') {
                this.userManager.addBalance(userId, actualBetAmount, 'Refund invalid upgrade target');
            }
            return { success: false, message: 'Giá trị mục tiêu phải lớn hơn số tiền cược.' };
        }
        const multiplier = Math.round((targetAmt / actualBetAmount) * 100) / 100;
        if (multiplier > 100) {
            if (betType === 'coins') {
                this.userManager.addBalance(userId, actualBetAmount, 'Refund invalid upgrade multiplier');
            }
            return { success: false, message: 'Hệ số nâng cấp tối đa là 100x.' };
        }
        // 3. Compute win chance
        const winChance = this.calculateWinChance(actualBetAmount, targetAmt);
        // 4. Provably secure RNG roll: 0.00 to 99.99
        const rollNumber = crypto_1.default.randomInt(0, 10000) / 100;
        const rollDegree = Math.round((rollNumber / 100) * 360 * 100) / 100;
        let isWin = false;
        let winningRange;
        if (rollDirection === 'under') {
            isWin = rollNumber < winChance;
            winningRange = [0, Math.round((winChance / 100) * 360 * 100) / 100];
        }
        else {
            isWin = rollNumber >= (100 - winChance);
            winningRange = [Math.round(((100 - winChance) / 100) * 360 * 100) / 100, 360];
        }
        // 5. If WIN, credit the reward!
        if (isWin) {
            this.userManager.addBalance(userId, targetAmt, `SkinClub Upgrade Win (${multiplier}x)`);
        }
        const newBalance = this.userManager.getBalance(userId);
        return {
            success: true,
            isWin,
            rollNumber,
            rollDegree,
            winChance,
            multiplier,
            betAmount: actualBetAmount,
            targetValue: targetAmt,
            rollDirection,
            winningRange,
            newBalance,
            consumedItemName
        };
    }
}
exports.UpgradeEngine = UpgradeEngine;
