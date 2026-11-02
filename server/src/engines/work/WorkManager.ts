import crypto from 'crypto';
import { UserManager } from '../../auth/UserManager';

// Vietnamese word pool (có dấu)
const VI_WORDS: string[] = [
  'ngọn lửa', 'bầu trời', 'kỳ diệu', 'phiêu lưu', 'huyền thoại',
  'chiến thắng', 'bí mật', 'vũ trụ', 'ánh sáng', 'cầu vồng',
  'thác nước', 'hoa đào', 'rồng vàng', 'phượng hoàng', 'kim cương',
  'sấm sét', 'bão tố', 'ngân hà', 'hoàng hôn', 'bình minh',
  'đại dương', 'núi lửa', 'thiên đường', 'mặt trăng', 'ngôi sao',
  'gió mùa', 'sương mù', 'cánh đồng', 'dòng sông', 'đồi cát',
  'pháo hoa', 'pha lê', 'ngọc trai', 'hổ phách', 'san hô',
  'chim ưng', 'đại bàng', 'sư tử', 'báo đen', 'rắn hổ mang',
  'kiếm sĩ', 'ninja', 'samurai', 'chiến binh', 'hiệp sĩ',
  'ma thuật', 'phép màu', 'thần thoại', 'truyền thuyết', 'huyền bí',
  'thiên thạch', 'vệ tinh', 'tia chớp', 'sóng thần', 'cực quang',
  'hồ nước', 'thung lũng', 'hang động', 'thảo nguyên', 'rừng rậm',
  'bạch tuộc', 'cá heo', 'chim cánh cụt', 'gấu bắc cực', 'đom đóm',
  'lâu đài', 'pháo đài', 'vương quốc', 'đế chế', 'viên ngọc',
  'giải mã', 'khám phá', 'chinh phục', 'vượt qua', 'bùng cháy',
];

// English word pool
const EN_WORDS: string[] = [
  'butterfly', 'horizon', 'adventure', 'champion', 'discovery',
  'treasure', 'mystery', 'galaxy', 'lightning', 'paradise',
  'waterfall', 'volcano', 'diamond', 'crystal', 'phoenix',
  'warrior', 'guardian', 'fortress', 'kingdom', 'labyrinth',
  'nebula', 'symphony', 'cascade', 'tornado', 'avalanche',
  'emerald', 'sapphire', 'obsidian', 'titanium', 'platinum',
  'algorithm', 'spectrum', 'protocol', 'quantum', 'catalyst',
  'panorama', 'silhouette', 'chameleon', 'fibonacci', 'kaleidoscope',
  'serendipity', 'ephemeral', 'wanderlust', 'luminous', 'ethereal',
  'archipelago', 'constellation', 'renaissance', 'juggernaut',
  'thunderbolt', 'earthquake', 'whirlpool', 'dragonfly', 'moonlight',
  'stargazer', 'sunflower', 'snowflake', 'rainstorm', 'wildfire',
  'gladiator', 'centurion', 'berserker', 'alchemist', 'sorcerer'
];

export const WORD_COUNT = { vi: VI_WORDS.length, en: EN_WORDS.length };

interface PendingChallenge {
  word: string;
  issuedAt: number;
  expiresAt: number;
}

export class WorkManager {
  private userManager: UserManager;
  private pendingChallenges: Map<string, PendingChallenge> = new Map(); // userId -> challenge
  private lastCompletedAt: Map<string, number> = new Map(); // userId -> timestamp
  private readonly COOLDOWN_MS = 0; // không cooldown — làm liên tục
  private readonly EXPIRY_MS = 15000; // 15 seconds to type
  private readonly REWARD = 1000; // coins per successful work

  constructor(userManager: UserManager) {
    this.userManager = userManager;
  }

  public requestWord(userId: string, lang?: string): { success: boolean; word?: string; expiresAt?: number; cooldownRemaining?: number; message?: string; lang?: string } {
    // Check cooldown
    const lastCompleted = this.lastCompletedAt.get(userId) || 0;
    const now = Date.now();
    const cooldownRemaining = Math.max(0, this.COOLDOWN_MS - (now - lastCompleted));
    if (cooldownRemaining > 0) {
      return { success: false, cooldownRemaining, message: `Vui lòng đợi ${Math.ceil(cooldownRemaining / 1000)} giây` };
    }

    // Bank từ theo ngôn ngữ đang chọn trên toggle VI/EN
    const useEn = lang === 'en';
    const pool = useEn ? EN_WORDS : VI_WORDS;
    const word = pool[Math.floor(Math.random() * pool.length)];
    const expiresAt = now + this.EXPIRY_MS;
    this.pendingChallenges.set(userId, { word, issuedAt: now, expiresAt });

    return { success: true, word, expiresAt, lang: useEn ? 'en' : 'vi' };
  }

  public submitWord(userId: string, typedWord: string): { success: boolean; earned?: number; newBalance?: number; message?: string } {
    const challenge = this.pendingChallenges.get(userId);
    if (!challenge) {
      return { success: false, message: 'Chưa có từ nào được phát. Hãy bấm "Nhận Việc" trước.' };
    }

    const now = Date.now();
    if (now > challenge.expiresAt) {
      this.pendingChallenges.delete(userId);
      return { success: false, message: 'Hết thời gian! Từ đã hết hạn.' };
    }

    const trimmedInput = typedWord.trim().toLowerCase();
    const expected = challenge.word.toLowerCase();

    if (trimmedInput !== expected) {
      return { success: false, message: `Sai rồi! Từ đúng là "${challenge.word}"` };
    }

    // Success!
    this.pendingChallenges.delete(userId);
    this.lastCompletedAt.set(userId, now);
    const result = this.userManager.addBalance(userId, this.REWARD, 'work');

    return {
      success: true,
      earned: this.REWARD,
      newBalance: result.newBalance
    };
  }
}
