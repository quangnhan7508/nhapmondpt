import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PERSISTED_KEYS, redisConfigured, redisGet, scheduleRemoteSave } from '../storage/redisRest';

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

export interface UserStats {
  unoWins: number;
  explodingKittensWins: number;
  tienLenWins: number;
  samWins?: number;
  totalWins: number;
  totalGames: number;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  avatar: string;
  createdAt: number;
  balance: number;
  inventory?: InventoryItem[];
  stats: UserStats;
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

export interface TransferTransaction {
  id: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  recipientId: string;
  recipientUsername: string;
  recipientDisplayName: string;
  amount: number;
  note?: string;
  timestamp: number;
}

export class UserManager {
  private dataFilePath: string;
  private sessionsFilePath: string;
  private transactionsFilePath: string;
  private users: Map<string, User> = new Map(); // id -> User
  private usernameIndex: Map<string, string> = new Map(); // lowercase username -> id
  private tokenToUserIdMap: Map<string, { userId: string; expiresAt: number }> = new Map(); // token -> session
  private transactions: TransferTransaction[] = [];
  // Ghi nhớ đăng nhập 30 ngày; không ghi nhớ 24 giờ
  private readonly REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  private readonly SESSION_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(customPath?: string) {
    this.dataFilePath = customPath || path.resolve(__dirname, '../../../data/users.json');
    this.sessionsFilePath = path.resolve(path.dirname(this.dataFilePath), 'sessions.json');
    this.transactionsFilePath = path.resolve(path.dirname(this.dataFilePath), 'transactions.json');
    this.ensureDataDir();
    this.loadUsers();
    this.loadSessions();
    this.loadTransactions();
  }

  /**
   * Pull authoritative state from Upstash Redis on boot (if configured).
   * Redis wins over the local file (files are ephemeral on Render);
   * on first boot (key missing) the current seeds are pushed up instead.
   */
  public async initRemote(): Promise<void> {
    if (!redisConfigured()) {
      console.log('[UserManager] Redis not configured — persisting to local files only.');
      return;
    }
    try {
      const rawUsers = await redisGet(PERSISTED_KEYS.KEY_USERS);
      if (rawUsers) {
        const data: User[] = JSON.parse(rawUsers); // parse before mutating state
        this.users.clear();
        this.usernameIndex.clear();
        for (const u of data) {
          this.users.set(u.id, u);
          this.usernameIndex.set(u.username.toLowerCase(), u.id);
        }
        console.log(`[UserManager] Loaded ${data.length} users from Redis.`);
      }

      const rawSessions = await redisGet(PERSISTED_KEYS.KEY_SESSIONS);
      if (rawSessions) {
        const data: Record<string, { userId: string; expiresAt: number }> = JSON.parse(rawSessions);
        const restored = new Map<string, { userId: string; expiresAt: number }>();
        const now = Date.now();
        for (const [token, s] of Object.entries(data)) {
          if (s && s.userId && s.expiresAt > now && this.users.has(s.userId)) {
            restored.set(token, s);
          }
        }
        this.tokenToUserIdMap = restored;
        console.log(`[UserManager] Restored ${restored.size} sessions from Redis.`);
      }

      const rawTx = await redisGet(PERSISTED_KEYS.KEY_TRANSACTIONS);
      if (rawTx) {
        try {
          this.transactions = JSON.parse(rawTx);
          console.log(`[UserManager] Loaded ${this.transactions.length} transactions from Redis.`);
        } catch {}
      }

      // Keep the local file cache in sync with the authoritative state
      this.saveUsers();
      this.saveSessions();
      this.saveTransactions();
    } catch (err) {
      console.warn('[UserManager] Redis init failed, keeping local/file state:', err instanceof Error ? err.message : err);
    }
  }

  private ensureDataDir() {
    const dir = path.dirname(this.dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadUsers() {
    if (!fs.existsSync(this.dataFilePath)) {
      this.seedInitialUsers();
      this.saveUsers();
      return;
    }

    try {
      const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
      const data: User[] = JSON.parse(raw);
      this.users.clear();
      this.usernameIndex.clear();
      for (const u of data) {
        this.users.set(u.id, u);
        this.usernameIndex.set(u.username.toLowerCase(), u.id);
      }
    } catch (err) {
      console.error('[UserManager] Error loading users:', err);
      this.seedInitialUsers();
    }
  }

  private loadSessions() {
    // Session lưu file nên restart server / mở lại trình duyệt vẫn còn đăng nhập
    try {
      if (!fs.existsSync(this.sessionsFilePath)) return;
      const raw = fs.readFileSync(this.sessionsFilePath, 'utf-8');
      const data: Record<string, { userId: string; expiresAt: number }> = JSON.parse(raw);
      const now = Date.now();
      let pruned = false;
      for (const [token, s] of Object.entries(data)) {
        if (s && s.userId && s.expiresAt > now && this.users.has(s.userId)) {
          this.tokenToUserIdMap.set(token, s);
        } else {
          pruned = true;
        }
      }
      if (pruned) this.saveSessions();
    } catch (err) {
      console.error('[UserManager] Error loading sessions:', err);
    }
  }

  private saveSessions() {
    try {
      this.ensureDataDir();
      const obj: Record<string, { userId: string; expiresAt: number }> = {};
      for (const [token, s] of this.tokenToUserIdMap) {
        obj[token] = s;
      }
      fs.writeFileSync(this.sessionsFilePath, JSON.stringify(obj, null, 2), 'utf-8');
      scheduleRemoteSave(PERSISTED_KEYS.KEY_SESSIONS, () => {
        const fresh: Record<string, { userId: string; expiresAt: number }> = {};
        for (const [token, s] of this.tokenToUserIdMap) fresh[token] = s;
        return JSON.stringify(fresh);
      });
    } catch (err) {
      console.error('[UserManager] Error saving sessions:', err);
    }
  }

  private saveUsers() {
    try {
      this.ensureDataDir();
      const list = Array.from(this.users.values());
      fs.writeFileSync(this.dataFilePath, JSON.stringify(list, null, 2), 'utf-8');
      scheduleRemoteSave(
        PERSISTED_KEYS.KEY_USERS,
        () => JSON.stringify(Array.from(this.users.values()))
      );
    } catch (err) {
      console.error('[UserManager] Error saving users:', err);
    }
  }

  private loadTransactions() {
    try {
      if (!fs.existsSync(this.transactionsFilePath)) return;
      const raw = fs.readFileSync(this.transactionsFilePath, 'utf-8');
      this.transactions = JSON.parse(raw);
    } catch (err) {
      console.error('[UserManager] Error loading transactions:', err);
    }
  }

  private saveTransactions() {
    try {
      this.ensureDataDir();
      fs.writeFileSync(this.transactionsFilePath, JSON.stringify(this.transactions, null, 2), 'utf-8');
      scheduleRemoteSave(
        PERSISTED_KEYS.KEY_TRANSACTIONS,
        () => JSON.stringify(this.transactions)
      );
    } catch (err) {
      console.error('[UserManager] Error saving transactions:', err);
    }
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.createHash('sha256').update(password + salt).digest('hex');
  }

  private seedInitialUsers() {
    // Initial seeded champions for an engaging leaderboard
    const seeds: Array<Omit<User, 'id' | 'passwordHash' | 'salt'> & { password: string }> = [
      {
        username: 'pro_card_master',
        displayName: '🃏 Hoàng Thần Bài',
        password: 'password123',
        avatar: 'av-dragon',
        createdAt: Date.now() - 86400000 * 5,
        balance: 10000,
        stats: {
          unoWins: 18,
          explodingKittensWins: 14,
          tienLenWins: 22,
          totalWins: 54,
          totalGames: 68
        }
      },
      {
        username: 'kitten_bomb_expert',
        displayName: '💣 Mèo Nổ Sát Thủ',
        password: 'password123',
        avatar: 'av-cat',
        createdAt: Date.now() - 86400000 * 4,
        balance: 10000,
        stats: {
          unoWins: 12,
          explodingKittensWins: 25,
          tienLenWins: 9,
          totalWins: 46,
          totalGames: 59
        }
      },
      {
        username: 'tien_len_de_nhat',
        displayName: '♠️ Tiến Lên Đệ Nhất',
        password: 'password123',
        avatar: 'av-ninja',
        createdAt: Date.now() - 86400000 * 3,
        balance: 10000,
        stats: {
          unoWins: 8,
          explodingKittensWins: 11,
          tienLenWins: 24,
          totalWins: 43,
          totalGames: 52
        }
      },
      {
        username: 'uno_queen',
        displayName: '👑 Nữ Hoàng UNO',
        password: 'password123',
        avatar: 'av-fox',
        createdAt: Date.now() - 86400000 * 2,
        balance: 10000,
        stats: {
          unoWins: 26,
          explodingKittensWins: 6,
          tienLenWins: 7,
          totalWins: 39,
          totalGames: 50
        }
      }
    ];

    for (const s of seeds) {
      const salt = crypto.randomBytes(16).toString('hex');
      const user: User = {
        id: crypto.randomUUID(),
        username: s.username,
        displayName: s.displayName,
        passwordHash: this.hashPassword(s.password, salt),
        salt,
        avatar: s.avatar,
        createdAt: s.createdAt,
        balance: s.balance,
        stats: s.stats
      };
      this.users.set(user.id, user);
      this.usernameIndex.set(user.username.toLowerCase(), user.id);
    }
  }

  public register(
    username: string,
    password: string,
    displayName?: string,
    avatar?: string
  ): { success: boolean; user?: PublicUser; token?: string; message?: string } {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      return { success: false, message: 'Tên đăng nhập phải có ít nhất 3 ký tự.' };
    }
    if (!password || password.length < 4) {
      return { success: false, message: 'Mật khẩu phải có ít nhất 4 ký tự.' };
    }
    if (this.usernameIndex.has(cleanUsername)) {
      return { success: false, message: 'Tên đăng nhập đã được sử dụng.' };
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);
    const id = crypto.randomUUID();

    const newUser: User = {
      id,
      username: cleanUsername,
      displayName: displayName?.trim() || username.trim(),
      passwordHash,
      salt,
      avatar: avatar || 'av-fox',
      createdAt: Date.now(),
      balance: 500,
      stats: {
        unoWins: 0,
        explodingKittensWins: 0,
        tienLenWins: 0,
        totalWins: 0,
        totalGames: 0
      }
    };

    this.users.set(id, newUser);
    this.usernameIndex.set(cleanUsername, id);
    this.saveUsers();

    const token = this.generateToken(id, true);
    return {
      success: true,
      user: this.toPublicUser(newUser),
      token
    };
  }

  public login(
    username: string,
    password: string,
    remember?: boolean
  ): { success: boolean; user?: PublicUser; token?: string; message?: string } {
    const cleanUsername = username.trim().toLowerCase();
    const userId = this.usernameIndex.get(cleanUsername);
    if (!userId) {
      return { success: false, message: 'Tài khoản không tồn tại.' };
    }

    const user = this.users.get(userId);
    if (!user) {
      return { success: false, message: 'Tài khoản không tồn tại.' };
    }

    const hash = this.hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      return { success: false, message: 'Mật khẩu không chính xác.' };
    }

    const token = this.generateToken(user.id, remember);
    return {
      success: true,
      user: this.toPublicUser(user),
      token
    };
  }

  public getUserByToken(token: string): PublicUser | null {
    const session = this.tokenToUserIdMap.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      // Token hết hạn → thu hồi
      this.tokenToUserIdMap.delete(token);
      this.saveSessions();
      return null;
    }
    const user = this.users.get(session.userId);
    return user ? this.toPublicUser(user) : null;
  }

  /** Thu hồi token khi đăng xuất. */
  public revokeToken(token: string): boolean {
    const existed = this.tokenToUserIdMap.delete(token);
    if (existed) this.saveSessions();
    return existed;
  }

  public getUserById(id: string): PublicUser | null {
    const user = this.users.get(id);
    return user ? this.toPublicUser(user) : null;
  }

  public recordGameResult(
    gameType: string,
    participantUserIds: string[],
    winnerUserIds: string[]
  ) {
    let modified = false;

    // Increment total games for all participating registered players
    for (const uid of participantUserIds) {
      const user = this.users.get(uid);
      if (user) {
        user.stats.totalGames += 1;
        modified = true;
      }
    }

    // Increment win count for winners
    for (const wid of winnerUserIds) {
      const user = this.users.get(wid);
      if (user) {
        user.stats.totalWins += 1;
        if (gameType === 'uno') {
          user.stats.unoWins += 1;
        } else if (gameType === 'exploding-kittens') {
          user.stats.explodingKittensWins += 1;
        } else if (gameType === 'tien-len') {
          user.stats.tienLenWins += 1;
        }
        modified = true;
      }
    }

    if (modified) {
      this.saveUsers();
    }
  }

  public getLeaderboard(gameType: 'all' | 'uno' | 'exploding-kittens' | 'tien-len' | 'money' | 'items' = 'all'): PublicUser[] {
    const list = Array.from(this.users.values()).map(u => this.toPublicUser(u));

    if (gameType === 'items') {
      const bestItemValue = (u: PublicUser) => (u.inventory || []).reduce((m, it) => Math.max(m, it.value || 0), 0);
      const totalItemValue = (u: PublicUser) => (u.inventory || []).reduce((s, it) => s + (it.value || 0), 0);
      list.sort((a, b) => bestItemValue(b) - bestItemValue(a) || totalItemValue(b) - totalItemValue(a) || (b.balance || 0) - (a.balance || 0));
    } else if (gameType === 'money') {
      list.sort((a, b) => (b.balance || 0) - (a.balance || 0) || b.stats.totalWins - a.stats.totalWins);
    } else if (gameType === 'uno') {
      list.sort((a, b) => b.stats.unoWins - a.stats.unoWins || b.stats.totalWins - a.stats.totalWins);
    } else if (gameType === 'exploding-kittens') {
      list.sort((a, b) => b.stats.explodingKittensWins - a.stats.explodingKittensWins || b.stats.totalWins - a.stats.totalWins);
    } else if (gameType === 'tien-len') {
      list.sort((a, b) => b.stats.tienLenWins - a.stats.tienLenWins || b.stats.totalWins - a.stats.totalWins);
    } else {
      list.sort((a, b) => b.stats.totalWins - a.stats.totalWins || b.stats.totalGames - a.stats.totalGames);
    }

    return list.slice(0, 50);
  }

  private generateToken(userId: string, remember?: boolean): string {
    const token = 'tok_' + crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
    const ttl = remember ? this.REMEMBER_TTL_MS : this.SESSION_TTL_MS;
    this.tokenToUserIdMap.set(token, { userId, expiresAt: Date.now() + ttl });
    this.saveSessions();
    return token;
  }

  // ========== BALANCE MANAGEMENT ==========

  public addBalance(userId: string, amount: number, reason: string): { success: boolean; newBalance: number } {
    const user = this.users.get(userId);
    if (!user || amount <= 0) return { success: false, newBalance: 0 };

    user.balance = (user.balance || 0) + amount;
    this.saveUsers();
    console.log(`[Economy] +${amount} coins → ${user.displayName} (${reason}). Balance: ${user.balance}`);
    return { success: true, newBalance: user.balance };
  }

  public deductBalance(userId: string, amount: number, reason: string): { success: boolean; newBalance: number; message?: string } {
    const user = this.users.get(userId);
    if (!user) return { success: false, newBalance: 0, message: 'User not found' };
    if (amount <= 0) return { success: false, newBalance: user.balance || 0, message: 'Invalid amount' };

    const currentBalance = user.balance || 0;
    if (currentBalance < amount) {
      return { success: false, newBalance: currentBalance, message: `Không đủ tiền. Cần ${amount} 🪙, bạn có ${currentBalance} 🪙` };
    }

    user.balance = currentBalance - amount;
    this.saveUsers();
    console.log(`[Economy] -${amount} coins ← ${user.displayName} (${reason}). Balance: ${user.balance}`);
    return { success: true, newBalance: user.balance };
  }

  public getBalance(userId: string): number {
    const user = this.users.get(userId);
    return user?.balance ?? 0;
  }

  // ========== TRANSFER MANAGEMENT ==========

  public transferBalance(
    senderId: string,
    recipientQuery: string,
    amount: number,
    note?: string
  ): {
    success: boolean;
    message: string;
    senderNewBalance?: number;
    recipientNewBalance?: number;
    recipientUser?: PublicUser;
    transaction?: TransferTransaction;
  } {
    if (!senderId) {
      return { success: false, message: 'Vui lòng đăng nhập để thực hiện chuyển tiền.' };
    }

    const sender = this.users.get(senderId);
    if (!sender) {
      return { success: false, message: 'Tài khoản người gửi không tồn tại.' };
    }

    const cleanAmount = Math.floor(Number(amount));
    if (isNaN(cleanAmount) || cleanAmount < 1) {
      return { success: false, message: 'Số tiền chuyển tối thiểu là 1 🪙.' };
    }

    if ((sender.balance || 0) < cleanAmount) {
      return {
        success: false,
        message: `Số dư không đủ. Bạn có ${(sender.balance || 0).toLocaleString('vi-VN')} 🪙, cần ${cleanAmount.toLocaleString('vi-VN')} 🪙.`
      };
    }

    if (!recipientQuery || typeof recipientQuery !== 'string') {
      return { success: false, message: 'Vui lòng nhập tên tài khoản hoặc ID người nhận.' };
    }

    const cleanQuery = recipientQuery.trim();
    let recipient: User | undefined;

    // 1. Search by exact user ID
    if (this.users.has(cleanQuery)) {
      recipient = this.users.get(cleanQuery);
    }
    // 2. Search by lowercase username
    if (!recipient) {
      const recipientId = this.usernameIndex.get(cleanQuery.toLowerCase());
      if (recipientId) {
        recipient = this.users.get(recipientId);
      }
    }
    // 3. Search by exact displayName
    if (!recipient) {
      for (const u of this.users.values()) {
        if (u.displayName.toLowerCase() === cleanQuery.toLowerCase()) {
          recipient = u;
          break;
        }
      }
    }

    if (!recipient) {
      return { success: false, message: `Không tìm thấy người nhận "${cleanQuery}". Vui lòng kiểm tra lại tên đăng nhập.` };
    }

    if (recipient.id === sender.id) {
      return { success: false, message: 'Bạn không thể tự chuyển tiền cho chính mình!' };
    }

    // Execute transfer
    sender.balance = (sender.balance || 0) - cleanAmount;
    recipient.balance = (recipient.balance || 0) + cleanAmount;

    const tx: TransferTransaction = {
      id: 'tx_' + crypto.randomUUID().slice(0, 8),
      senderId: sender.id,
      senderUsername: sender.username,
      senderDisplayName: sender.displayName,
      recipientId: recipient.id,
      recipientUsername: recipient.username,
      recipientDisplayName: recipient.displayName,
      amount: cleanAmount,
      note: (note || '').trim().slice(0, 100),
      timestamp: Date.now()
    };

    this.transactions.unshift(tx);
    if (this.transactions.length > 500) {
      this.transactions.pop();
    }

    this.saveUsers();
    this.saveTransactions();

    console.log(`[Transfer] ${sender.displayName} (@${sender.username}) transferred ${cleanAmount} coins to ${recipient.displayName} (@${recipient.username}). Note: "${tx.note}"`);

    return {
      success: true,
      message: `Chuyển thành công ${cleanAmount.toLocaleString('vi-VN')} 🪙 cho ${recipient.displayName}!`,
      senderNewBalance: sender.balance,
      recipientNewBalance: recipient.balance,
      recipientUser: this.toPublicUser(recipient),
      transaction: tx
    };
  }

  public getUserTransactions(userId: string): TransferTransaction[] {
    return this.transactions
      .filter(tx => tx.senderId === userId || tx.recipientId === userId)
      .slice(0, 50);
  }

  public searchUsers(query: string, excludeUserId?: string): PublicUser[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: PublicUser[] = [];
    for (const u of this.users.values()) {
      if (excludeUserId && u.id === excludeUserId) continue;
      if (u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)) {
        results.push(this.toPublicUser(u));
        if (results.length >= 8) break;
      }
    }
    return results;
  }

  // ========== INVENTORY MANAGEMENT ==========

  public getInventory(userId: string): InventoryItem[] {
    const user = this.users.get(userId);
    return user?.inventory ? [...user.inventory] : [];
  }

  public addItemToInventory(userId: string, itemData: Omit<InventoryItem, 'id' | 'obtainedAt'>): { success: boolean; item?: InventoryItem; message?: string } {
    const user = this.users.get(userId);
    if (!user) return { success: false, message: 'User not found' };

    if (!user.inventory) {
      user.inventory = [];
    }

    const newItem: InventoryItem = {
      ...itemData,
      id: crypto.randomUUID(),
      obtainedAt: Date.now()
    };

    user.inventory.push(newItem);
    this.saveUsers();
    console.log(`[Inventory] Added ${newItem.name} (${newItem.rarity}, ${newItem.value} 🪙) to ${user.displayName}'s inventory.`);
    return { success: true, item: newItem };
  }

  public sellItem(userId: string, itemInstanceId: string): { success: boolean; earned?: number; newBalance?: number; item?: InventoryItem; message?: string } {
    const user = this.users.get(userId);
    if (!user) return { success: false, message: 'User not found' };
    if (!user.inventory || user.inventory.length === 0) return { success: false, message: 'Kho đồ trống' };

    const idx = user.inventory.findIndex(it => it.id === itemInstanceId);
    if (idx === -1) return { success: false, message: 'Không tìm thấy vật phẩm' };

    const [removed] = user.inventory.splice(idx, 1);
    const earned = removed.value || 0;
    user.balance = (user.balance || 0) + earned;
    this.saveUsers();
    console.log(`[Inventory] Sold ${removed.name} for +${earned} 🪙 by ${user.displayName}. New balance: ${user.balance}`);

    return {
      success: true,
      earned,
      newBalance: user.balance,
      item: removed
    };
  }

  public sellAllItems(userId: string): { success: boolean; count?: number; earned?: number; newBalance?: number; message?: string } {
    const user = this.users.get(userId);
    if (!user) return { success: false, message: 'User not found' };
    if (!user.inventory || user.inventory.length === 0) return { success: false, message: 'Kho đồ trống' };

    const count = user.inventory.length;
    const earned = user.inventory.reduce((sum, it) => sum + (it.value || 0), 0);
    user.inventory = [];
    user.balance = (user.balance || 0) + earned;
    this.saveUsers();
    console.log(`[Inventory] Sold all ${count} items for +${earned} 🪙 by ${user.displayName}. New balance: ${user.balance}`);

    return {
      success: true,
      count,
      earned,
      newBalance: user.balance
    };
  }

  public consumeItem(userId: string, itemInstanceId: string): { success: boolean; item?: InventoryItem; message?: string } {
    const user = this.users.get(userId);
    if (!user) return { success: false, message: 'User not found' };
    if (!user.inventory || user.inventory.length === 0) return { success: false, message: 'Kho đồ trống' };

    const idx = user.inventory.findIndex(it => it.id === itemInstanceId);
    if (idx === -1) return { success: false, message: 'Không tìm thấy vật phẩm' };

    const [consumed] = user.inventory.splice(idx, 1);
    this.saveUsers();
    return { success: true, item: consumed };
  }

  // Migrate old users without balance field
  private migrateUserBalance(user: User): void {
    if (user.balance === undefined || user.balance === null) {
      user.balance = 500;
    }
    if (!user.inventory) {
      user.inventory = [];
    }
  }

  private toPublicUser(user: User): PublicUser {
    this.migrateUserBalance(user);
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      balance: user.balance ?? 500,
      inventory: user.inventory ? [...user.inventory] : [],
      stats: { ...user.stats }
    };
  }
}
