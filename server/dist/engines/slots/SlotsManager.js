"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlotsManager = void 0;
const WildBountyEngine_1 = require("./WildBountyEngine");
const MahjongWays2Engine_1 = require("./MahjongWays2Engine");
const MahjongWaysEngine_1 = require("./MahjongWaysEngine");
const TreasuresOfAztecEngine_1 = require("./TreasuresOfAztecEngine");
const CaishenWinsEngine_1 = require("./CaishenWinsEngine");
const CocktailNightsEngine_1 = require("./CocktailNightsEngine");
class SlotsManager {
    userManager;
    wildBountyEngine;
    mahjong2Engine;
    mahjongEngine;
    aztecEngine;
    caishenEngine;
    cocktailEngine;
    games = [
        {
            id: 'wild-bounty-showdown',
            name: 'Wild Bounty Showdown',
            tagline: 'Nữ Thợ Săn Tiền Thưởng Viễn Tây - Nhân Đôi Hệ Số Lên Đến x1,024!',
            provider: 'Pocket Games Soft (PG Soft)',
            banner: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
            reels: [3, 4, 5, 5, 4, 3],
            rtp: '96.75%',
            maxWin: '5,000x',
            volatility: 'Cao',
            features: [
                '3,600 Cách Chiến Thắng',
                'Nổ Liên Hoàn (Cascading Reels)',
                'Biểu Tượng Viền Vàng Hóa WILD',
                'Nhân Đôi Hệ Số x1 ➔ x1,024',
                'Free Spins Khởi Điểm x8 Multiplier',
                'Tính Năng Mua Vòng Quay Miễn Phí (Feature Buy)'
            ]
        },
        {
            id: 'fortune-ox',
            name: 'Fortune Ox',
            tagline: 'Trâu Vàng May Mắn - Nhân Thập Bội x10 Toàn Màn Hình (Sắp Ra Mắt)',
            provider: 'Pocket Games Soft (PG Soft)',
            banner: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
            reels: [3, 4, 3],
            rtp: '96.75%',
            maxWin: '2,000x',
            volatility: 'Trung bình',
            features: ['Respin Khóa Cuộn May Mắn', 'Hệ Số Nhân x10 Toàn Bảng']
        },
        {
            id: 'mahjong-ways',
            name: 'Mahjong Ways',
            tagline: 'Mạt Chược Gốc PG Soft - 1,024 Ways, Top Phát 100x!',
            provider: 'Pocket Games Soft (PG Soft)',
            banner: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
            reels: [4, 4, 4, 4, 4],
            rtp: '96.92%',
            maxWin: '25,000x',
            volatility: 'Trung bình',
            features: [
                '1,024 Cách Chiến Thắng',
                'Nổ Liên Hoàn (Cascading Reels)',
                'Mạ Vàng Hóa WILD (cuộn 2-4)',
                'Hệ Số x1 ➔ x2 ➔ x3 ➔ x5',
                'Free Spins 10 lượt, hệ số x2 ➔ x10'
            ]
        },
        {
            id: 'mahjong-ways-2',
            name: 'Mahjong Ways 2',
            tagline: 'Mạt Chược PG Soft - 2,000 Ways, Nhân Hệ Số x5 & Free Spins x10!',
            provider: 'Pocket Games Soft (PG Soft)',
            banner: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
            reels: [4, 5, 5, 5, 4],
            rtp: '96.95%',
            maxWin: '25,000x',
            volatility: 'Trung bình',
            features: [
                '2,000 Cách Chiến Thắng',
                'Nổ Liên Hoàn (Cascading Reels)',
                'Mạ Vàng Hóa WILD (cuộn 2-4)',
                'Hệ Số x1 ➔ x2 ➔ x3 ➔ x5',
                'Free Spins 10 lượt, hệ số x2 ➔ x10'
            ]
        },
        {
            id: 'treasures-of-aztec',
            name: 'Treasures of Aztec',
            tagline: 'Kho Báu Maya Aztec - 32,400 Ways, Wilds-on-the-Way & Multiplier Tăng Không Giới Hạn!',
            provider: 'Pocket Games Soft (PG Soft)',
            banner: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
            reels: [5, 6, 6, 6, 6, 5],
            rtp: '96.71%',
            maxWin: '100,000x',
            volatility: 'Cao',
            features: [
                'Lên Đến 32,400 Cách Thắng',
                'Cơ Chế Wilds-on-the-Way (Khung Bạc ➔ Khung Vàng ➔ WILD)',
                'Hệ Số Tăng Không Giới Hạn (+1 Base, +2 Free Spins)',
                'Free Spins Khởi Điểm x2, Cộng Dồn Không Reset',
                'Tính Năng Mua Vòng Quay Miễn Phí (75x)'
            ]
        },
        {
            id: 'caishen-wins',
            name: 'Caishen Wins',
            tagline: 'Thần Tài Giàu Sang - 32,400 Ways, Wilds-on-the-Way & Free Spins x8 Khởi Điểm!',
            provider: 'Pocket Games Soft (PG Soft)',
            banner: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
            reels: [5, 6, 6, 6, 6, 5],
            rtp: '96.92%',
            maxWin: '100,000x',
            volatility: 'Cao',
            features: [
                '2,025 - 32,400 Cách Thắng (Top Reel + Stacked)',
                'Cơ Chế Wilds-on-the-Way (Khung Bạc ➔ Khung Vàng ➔ WILD)',
                'Success Caishen: Full Top Reel ➔ 4 WILD',
                'Free Spins 8 Lượt x8 + Gamble Lên 20 Lượt x20',
                'Tính Năng Mua Vòng Quay Miễn Phí (75x)'
            ]
        },
        {
            id: 'cocktail-nights',
            name: 'Cocktail Nights',
            tagline: 'Pha Chế Neon - 15,625 Ways, Wilds Nền Vàng & Multiplier Reel!',
            provider: 'Pocket Games Soft (PG Soft)',
            banner: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
            reels: [5, 5, 5, 5, 5, 5],
            rtp: '96.75%',
            maxWin: '100,000x',
            volatility: 'Trung bình',
            features: [
                '400 - 15,625 Ways (Stacked 2-4 Ô)',
                'Wilds-on-the-Way Nền Vàng ➔ WILD',
                'Multiplier Reel Dưới Cuộn 2-5',
                'Free Spins 10 Lượt, Mult Không Reset',
                'Tính Năng Mua Vòng Quay Miễn Phí (75x)'
            ]
        }
    ];
    constructor(userManager) {
        this.userManager = userManager;
        this.wildBountyEngine = new WildBountyEngine_1.WildBountyEngine(userManager);
        this.mahjong2Engine = new MahjongWays2Engine_1.MahjongWays2Engine(userManager);
        this.mahjongEngine = new MahjongWaysEngine_1.MahjongWaysEngine(userManager);
        this.aztecEngine = new TreasuresOfAztecEngine_1.TreasuresOfAztecEngine(userManager);
        this.caishenEngine = new CaishenWinsEngine_1.CaishenWinsEngine(userManager);
        this.cocktailEngine = new CocktailNightsEngine_1.CocktailNightsEngine(userManager);
    }
    getGames() {
        return this.games;
    }
    getGame(slotId) {
        return this.games.find(g => g.id === slotId);
    }
    getFreeSpins(slotId, userId) {
        if (slotId === 'wild-bounty-showdown') {
            return this.wildBountyEngine.getFreeSpins(userId);
        }
        if (slotId === 'mahjong-ways-2') {
            return this.mahjong2Engine.getFreeSpins(userId);
        }
        if (slotId === 'mahjong-ways') {
            return this.mahjongEngine.getFreeSpins(userId);
        }
        if (slotId === 'treasures-of-aztec') {
            return this.aztecEngine.getFreeSpins(userId);
        }
        if (slotId === 'caishen-wins') {
            return this.caishenEngine.getFreeSpins(userId);
        }
        if (slotId === 'cocktail-nights') {
            return this.cocktailEngine.getFreeSpins(userId);
        }
        return null;
    }
    spin(userId, slotId, betAmount, options) {
        if (slotId === 'wild-bounty-showdown') {
            return this.wildBountyEngine.spin(userId, betAmount, options);
        }
        if (slotId === 'mahjong-ways-2') {
            return this.mahjong2Engine.spin(userId, betAmount, options);
        }
        if (slotId === 'mahjong-ways') {
            return this.mahjongEngine.spin(userId, betAmount, options);
        }
        if (slotId === 'treasures-of-aztec') {
            return this.aztecEngine.spin(userId, betAmount, options);
        }
        if (slotId === 'caishen-wins') {
            return this.caishenEngine.spin(userId, betAmount, options);
        }
        if (slotId === 'cocktail-nights') {
            return this.cocktailEngine.spin(userId, betAmount, options);
        }
        return { success: false, message: 'Game slot chưa được hỗ trợ.' };
    }
    getMults(slotId, userId) {
        if (slotId === 'cocktail-nights') {
            return this.cocktailEngine.getMults(userId);
        }
        return null;
    }
    getOffer(slotId, userId) {
        if (slotId === 'caishen-wins') {
            return this.caishenEngine.getOffer(userId);
        }
        return null;
    }
    resolveOffer(slotId, userId, action) {
        if (slotId === 'caishen-wins') {
            return this.caishenEngine.resolveOffer(userId, action);
        }
        return { success: false, message: 'Game slot chưa được hỗ trợ.' };
    }
}
exports.SlotsManager = SlotsManager;
