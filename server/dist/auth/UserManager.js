"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserManager = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const redisRest_1 = require("../storage/redisRest");
class UserManager {
    dataFilePath;
    sessionsFilePath;
    transactionsFilePath;
    users = new Map(); // id -> User
    usernameIndex = new Map(); // lowercase username -> id
    tokenToUserIdMap = new Map(); // token -> session
    transactions = [];
    // Ghi nhớ đăng nhập 30 ngày; không ghi nhớ 24 giờ
    REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
    SESSION_TTL_MS = 24 * 60 * 60 * 1000;
    constructor(customPath) {
        this.dataFilePath = customPath || path_1.default.resolve(__dirname, '../../../data/users.json');
        this.sessionsFilePath = path_1.default.resolve(path_1.default.dirname(this.dataFilePath), 'sessions.json');
        this.transactionsFilePath = path_1.default.resolve(path_1.default.dirname(this.dataFilePath), 'transactions.json');
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
    async initRemote() {
        if (!(0, redisRest_1.redisConfigured)()) {
            console.log('[UserManager] Redis not configured — persisting to local files only.');
            return;
        }
        try {
            const rawUsers = await (0, redisRest_1.redisGet)(redisRest_1.PERSISTED_KEYS.KEY_USERS);
            if (rawUsers) {
                const data = JSON.parse(rawUsers); // parse before mutating state
                this.users.clear();
                this.usernameIndex.clear();
                for (const u of data) {
                    this.users.set(u.id, u);
                    this.usernameIndex.set(u.username.toLowerCase(), u.id);
                }
                console.log(`[UserManager] Loaded ${data.length} users from Redis.`);
            }
            const rawSessions = await (0, redisRest_1.redisGet)(redisRest_1.PERSISTED_KEYS.KEY_SESSIONS);
            if (rawSessions) {
                const data = JSON.parse(rawSessions);
                const restored = new Map();
                const now = Date.now();
                for (const [token, s] of Object.entries(data)) {
                    if (s && s.userId && s.expiresAt > now && this.users.has(s.userId)) {
                        restored.set(token, s);
                    }
                }
                this.tokenToUserIdMap = restored;
                console.log(`[UserManager] Restored ${restored.size} sessions from Redis.`);
            }
            const rawTx = await (0, redisRest_1.redisGet)(redisRest_1.PERSISTED_KEYS.KEY_TRANSACTIONS);
            if (rawTx) {
                try {
                    this.transactions = JSON.parse(rawTx);
                    console.log(`[UserManager] Loaded ${this.transactions.length} transactions from Redis.`);
                }
                catch { }
            }
            // Keep the local file cache in sync with the authoritative state
            this.saveUsers();
            this.saveSessions();
            this.saveTransactions();
        }
        catch (err) {
            console.warn('[UserManager] Redis init failed, keeping local/file state:', err instanceof Error ? err.message : err);
        }
    }
    ensureDataDir() {
        const dir = path_1.default.dirname(this.dataFilePath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
    }
    loadUsers() {
        if (!fs_1.default.existsSync(this.dataFilePath)) {
            this.seedInitialUsers();
            this.saveUsers();
            return;
        }
        try {
            const raw = fs_1.default.readFileSync(this.dataFilePath, 'utf-8');
            const data = JSON.parse(raw);
            this.users.clear();
            this.usernameIndex.clear();
            for (const u of data) {
                this.users.set(u.id, u);
                this.usernameIndex.set(u.username.toLowerCase(), u.id);
            }
        }
        catch (err) {
            console.error('[UserManager] Error loading users:', err);
            this.seedInitialUsers();
        }
    }
    loadSessions() {
        // Session lưu file nên restart server / mở lại trình duyệt vẫn còn đăng nhập
        try {
            if (!fs_1.default.existsSync(this.sessionsFilePath))
                return;
            const raw = fs_1.default.readFileSync(this.sessionsFilePath, 'utf-8');
            const data = JSON.parse(raw);
            const now = Date.now();
            let pruned = false;
            for (const [token, s] of Object.entries(data)) {
                if (s && s.userId && s.expiresAt > now && this.users.has(s.userId)) {
                    this.tokenToUserIdMap.set(token, s);
                }
                else {
                    pruned = true;
                }
            }
            if (pruned)
                this.saveSessions();
        }
        catch (err) {
            console.error('[UserManager] Error loading sessions:', err);
        }
    }
    saveSessions() {
        try {
            this.ensureDataDir();
            const obj = {};
            for (const [token, s] of this.tokenToUserIdMap) {
                obj[token] = s;
            }
            fs_1.default.writeFileSync(this.sessionsFilePath, JSON.stringify(obj, null, 2), 'utf-8');
            (0, redisRest_1.scheduleRemoteSave)(redisRest_1.PERSISTED_KEYS.KEY_SESSIONS, () => {
                const fresh = {};
                for (const [token, s] of this.tokenToUserIdMap)
                    fresh[token] = s;
                return JSON.stringify(fresh);
            });
        }
        catch (err) {
            console.error('[UserManager] Error saving sessions:', err);
        }
    }
    saveUsers() {
        try {
            this.ensureDataDir();
            const list = Array.from(this.users.values());
            fs_1.default.writeFileSync(this.dataFilePath, JSON.stringify(list, null, 2), 'utf-8');
            (0, redisRest_1.scheduleRemoteSave)(redisRest_1.PERSISTED_KEYS.KEY_USERS, () => JSON.stringify(Array.from(this.users.values())));
        }
        catch (err) {
            console.error('[UserManager] Error saving users:', err);
        }
    }
    loadTransactions() {
        try {
            if (!fs_1.default.existsSync(this.transactionsFilePath))
                return;
            const raw = fs_1.default.readFileSync(this.transactionsFilePath, 'utf-8');
            this.transactions = JSON.parse(raw);
        }
        catch (err) {
            console.error('[UserManager] Error loading transactions:', err);
        }
    }
    saveTransactions() {
        try {
            this.ensureDataDir();
            fs_1.default.writeFileSync(this.transactionsFilePath, JSON.stringify(this.transactions, null, 2), 'utf-8');
            (0, redisRest_1.scheduleRemoteSave)(redisRest_1.PERSISTED_KEYS.KEY_TRANSACTIONS, () => JSON.stringify(this.transactions));
        }
        catch (err) {
            console.error('[UserManager] Error saving transactions:', err);
        }
    }
    hashPassword(password, salt) {
        return crypto_1.default.createHash('sha256').update(password + salt).digest('hex');
    }
    seedInitialUsers() {
        // Initial seeded champions for an engaging leaderboard
        const seeds = [
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
            const salt = crypto_1.default.randomBytes(16).toString('hex');
            const user = {
                id: crypto_1.default.randomUUID(),
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
    register(username, password, displayName, avatar) {
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
        const salt = crypto_1.default.randomBytes(16).toString('hex');
        const passwordHash = this.hashPassword(password, salt);
        const id = crypto_1.default.randomUUID();
        const newUser = {
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
    login(username, password, remember) {
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
    getUserByToken(token) {
        const session = this.tokenToUserIdMap.get(token);
        if (!session)
            return null;
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
    revokeToken(token) {
        const existed = this.tokenToUserIdMap.delete(token);
        if (existed)
            this.saveSessions();
        return existed;
    }
    getUserById(id) {
        const user = this.users.get(id);
        return user ? this.toPublicUser(user) : null;
    }
    recordGameResult(gameType, participantUserIds, winnerUserIds) {
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
                }
                else if (gameType === 'exploding-kittens') {
                    user.stats.explodingKittensWins += 1;
                }
                else if (gameType === 'tien-len') {
                    user.stats.tienLenWins += 1;
                }
                modified = true;
            }
        }
        if (modified) {
            this.saveUsers();
        }
    }
    getLeaderboard(gameType = 'all') {
        const list = Array.from(this.users.values()).map(u => this.toPublicUser(u));
        if (gameType === 'items') {
            const bestItemValue = (u) => (u.inventory || []).reduce((m, it) => Math.max(m, it.value || 0), 0);
            const totalItemValue = (u) => (u.inventory || []).reduce((s, it) => s + (it.value || 0), 0);
            list.sort((a, b) => bestItemValue(b) - bestItemValue(a) || totalItemValue(b) - totalItemValue(a) || (b.balance || 0) - (a.balance || 0));
        }
        else if (gameType === 'money') {
            list.sort((a, b) => (b.balance || 0) - (a.balance || 0) || b.stats.totalWins - a.stats.totalWins);
        }
        else if (gameType === 'uno') {
            list.sort((a, b) => b.stats.unoWins - a.stats.unoWins || b.stats.totalWins - a.stats.totalWins);
        }
        else if (gameType === 'exploding-kittens') {
            list.sort((a, b) => b.stats.explodingKittensWins - a.stats.explodingKittensWins || b.stats.totalWins - a.stats.totalWins);
        }
        else if (gameType === 'tien-len') {
            list.sort((a, b) => b.stats.tienLenWins - a.stats.tienLenWins || b.stats.totalWins - a.stats.totalWins);
        }
        else {
            list.sort((a, b) => b.stats.totalWins - a.stats.totalWins || b.stats.totalGames - a.stats.totalGames);
        }
        return list.slice(0, 50);
    }
    generateToken(userId, remember) {
        const token = 'tok_' + crypto_1.default.randomUUID().replace(/-/g, '') + Date.now().toString(36);
        const ttl = remember ? this.REMEMBER_TTL_MS : this.SESSION_TTL_MS;
        this.tokenToUserIdMap.set(token, { userId, expiresAt: Date.now() + ttl });
        this.saveSessions();
        return token;
    }
    // ========== BALANCE MANAGEMENT ==========
    addBalance(userId, amount, reason) {
        const user = this.users.get(userId);
        if (!user || amount <= 0)
            return { success: false, newBalance: 0 };
        user.balance = (user.balance || 0) + amount;
        this.saveUsers();
        console.log(`[Economy] +${amount} coins → ${user.displayName} (${reason}). Balance: ${user.balance}`);
        return { success: true, newBalance: user.balance };
    }
    deductBalance(userId, amount, reason) {
        const user = this.users.get(userId);
        if (!user)
            return { success: false, newBalance: 0, message: 'User not found' };
        if (amount <= 0)
            return { success: false, newBalance: user.balance || 0, message: 'Invalid amount' };
        const currentBalance = user.balance || 0;
        if (currentBalance < amount) {
            return { success: false, newBalance: currentBalance, message: `Không đủ tiền. Cần ${amount} 🪙, bạn có ${currentBalance} 🪙` };
        }
        user.balance = currentBalance - amount;
        this.saveUsers();
        console.log(`[Economy] -${amount} coins ← ${user.displayName} (${reason}). Balance: ${user.balance}`);
        return { success: true, newBalance: user.balance };
    }
    getBalance(userId) {
        const user = this.users.get(userId);
        return user?.balance ?? 0;
    }
    // ========== TRANSFER MANAGEMENT ==========
    transferBalance(senderId, recipientQuery, amount, note) {
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
        let recipient;
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
        const tx = {
            id: 'tx_' + crypto_1.default.randomUUID().slice(0, 8),
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
    getUserTransactions(userId) {
        return this.transactions
            .filter(tx => tx.senderId === userId || tx.recipientId === userId)
            .slice(0, 50);
    }
    searchUsers(query, excludeUserId) {
        const q = query.trim().toLowerCase();
        if (!q)
            return [];
        const results = [];
        for (const u of this.users.values()) {
            if (excludeUserId && u.id === excludeUserId)
                continue;
            if (u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)) {
                results.push(this.toPublicUser(u));
                if (results.length >= 8)
                    break;
            }
        }
        return results;
    }
    // ========== INVENTORY MANAGEMENT ==========
    getInventory(userId) {
        const user = this.users.get(userId);
        return user?.inventory ? [...user.inventory] : [];
    }
    addItemToInventory(userId, itemData) {
        const user = this.users.get(userId);
        if (!user)
            return { success: false, message: 'User not found' };
        if (!user.inventory) {
            user.inventory = [];
        }
        const newItem = {
            ...itemData,
            id: crypto_1.default.randomUUID(),
            obtainedAt: Date.now()
        };
        user.inventory.push(newItem);
        this.saveUsers();
        console.log(`[Inventory] Added ${newItem.name} (${newItem.rarity}, ${newItem.value} 🪙) to ${user.displayName}'s inventory.`);
        return { success: true, item: newItem };
    }
    sellItem(userId, itemInstanceId) {
        const user = this.users.get(userId);
        if (!user)
            return { success: false, message: 'User not found' };
        if (!user.inventory || user.inventory.length === 0)
            return { success: false, message: 'Kho đồ trống' };
        const idx = user.inventory.findIndex(it => it.id === itemInstanceId);
        if (idx === -1)
            return { success: false, message: 'Không tìm thấy vật phẩm' };
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
    sellAllItems(userId) {
        const user = this.users.get(userId);
        if (!user)
            return { success: false, message: 'User not found' };
        if (!user.inventory || user.inventory.length === 0)
            return { success: false, message: 'Kho đồ trống' };
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
    consumeItem(userId, itemInstanceId) {
        const user = this.users.get(userId);
        if (!user)
            return { success: false, message: 'User not found' };
        if (!user.inventory || user.inventory.length === 0)
            return { success: false, message: 'Kho đồ trống' };
        const idx = user.inventory.findIndex(it => it.id === itemInstanceId);
        if (idx === -1)
            return { success: false, message: 'Không tìm thấy vật phẩm' };
        const [consumed] = user.inventory.splice(idx, 1);
        this.saveUsers();
        return { success: true, item: consumed };
    }
    // Migrate old users without balance field
    migrateUserBalance(user) {
        if (user.balance === undefined || user.balance === null) {
            user.balance = 500;
        }
        if (!user.inventory) {
            user.inventory = [];
        }
    }
    toPublicUser(user) {
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
exports.UserManager = UserManager;
