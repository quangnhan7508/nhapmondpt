"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const socket_io_1 = require("socket.io");
const UserManager_1 = require("./auth/UserManager");
const RoomManager_1 = require("./rooms/RoomManager");
const WorkManager_1 = require("./engines/work/WorkManager");
const CaseEngine_1 = require("./engines/cases/CaseEngine");
const UpgradeEngine_1 = require("./engines/upgrade/UpgradeEngine");
const GiftcodeManager_1 = require("./auth/GiftcodeManager");
const gameHandlers_1 = require("./sockets/gameHandlers");
const redisRest_1 = require("./storage/redisRest");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const userManager = new UserManager_1.UserManager();
const roomManager = new RoomManager_1.RoomManager();
const workManager = new WorkManager_1.WorkManager(userManager);
const caseEngine = new CaseEngine_1.CaseEngine(userManager);
const upgradeEngine = new UpgradeEngine_1.UpgradeEngine(userManager);
const giftcodeManager = new GiftcodeManager_1.GiftcodeManager(userManager);
(0, gameHandlers_1.registerSocketHandlers)(io, roomManager, userManager, workManager, caseEngine, upgradeEngine, giftcodeManager);
// API health endpoint
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});
// Auth: Register
app.post('/api/auth/register', (req, res) => {
    const { username, password, displayName, avatar } = req.body;
    const result = userManager.register(username, password, displayName, avatar);
    if (!result.success) {
        return res.status(400).json(result);
    }
    return res.status(201).json(result);
});
// Auth: Login
app.post('/api/auth/login', (req, res) => {
    const { username, password, remember } = req.body;
    const result = userManager.login(username, password, remember !== false);
    if (!result.success) {
        return res.status(401).json(result);
    }
    return res.status(200).json(result);
});
// Auth: Logout (thu hồi token)
app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        userManager.revokeToken(authHeader.substring(7));
    }
    return res.json({ success: true });
});
// Auth: Get Current Profile (includes balance)
app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.substring(7);
    const user = userManager.getUserByToken(token);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
    }
    return res.json({ success: true, user });
});
// Leaderboard: Get Top Players by Game or Overall
app.get('/api/leaderboard', (req, res) => {
    const gameType = req.query.gameType || 'all';
    const list = userManager.getLeaderboard(gameType);
    res.json({ success: true, leaderboard: list });
});
// Rooms: Get open rooms list for matchmaking / room browser
app.get('/api/rooms', (_req, res) => {
    const rooms = roomManager.getPublicRooms();
    res.json({ success: true, rooms });
});
// Balance: Get user balance
app.get('/api/user/balance', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.substring(7);
    const user = userManager.getUserByToken(token);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid session' });
    }
    res.json({ success: true, balance: user.balance });
});
// Cases: Get all case definitions
app.get('/api/cases', (_req, res) => {
    res.json({ success: true, cases: caseEngine.getCases() });
});
// Inventory: Get user inventory
app.get('/api/inventory', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.substring(7);
    const user = userManager.getUserByToken(token);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid session' });
    }
    res.json({ success: true, inventory: userManager.getInventory(user.id) });
});
// Wallet: Transfer coins between users
app.post('/api/wallet/transfer', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập.' });
    }
    const token = authHeader.substring(7);
    const user = userManager.getUserByToken(token);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ.' });
    }
    const { recipient, amount, note } = req.body;
    const result = userManager.transferBalance(user.id, recipient, Number(amount), note);
    if (!result.success) {
        return res.status(400).json(result);
    }
    // Real-time broadcast balance update and notification
    if (result.recipientUser && result.transaction) {
        io.to(`user:${result.recipientUser.id}`).emit('balance_updated', {
            balance: result.recipientNewBalance
        });
        io.to(`user:${result.recipientUser.id}`).emit('wallet:received', {
            senderName: result.transaction.senderDisplayName,
            senderUsername: result.transaction.senderUsername,
            amount: result.transaction.amount,
            note: result.transaction.note,
            newBalance: result.recipientNewBalance,
            timestamp: result.transaction.timestamp
        });
        io.to(`user:${user.id}`).emit('balance_updated', {
            balance: result.senderNewBalance
        });
    }
    return res.json(result);
});
// Wallet: Get user transactions
app.get('/api/wallet/transactions', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập.' });
    }
    const token = authHeader.substring(7);
    const user = userManager.getUserByToken(token);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ.' });
    }
    const transactions = userManager.getUserTransactions(user.id);
    res.json({ success: true, transactions });
});
// Wallet: Search players for autocomplete
app.get('/api/wallet/search', (req, res) => {
    const query = req.query.q || '';
    const authHeader = req.headers.authorization;
    let excludeUserId;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const user = userManager.getUserByToken(authHeader.substring(7));
        if (user)
            excludeUserId = user.id;
    }
    const users = userManager.searchUsers(query, excludeUserId);
    res.json({ success: true, users });
});
// Giftcode: Redeem
app.post('/api/giftcode/redeem', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để nhập giftcode.' });
    }
    const token = authHeader.substring(7);
    const user = userManager.getUserByToken(token);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ.' });
    }
    const { code } = req.body;
    const result = giftcodeManager.redeem(user.id, code);
    if (!result.success) {
        return res.status(400).json(result);
    }
    io.to(`user:${user.id}`).emit('balance_updated', { balance: result.newBalance });
    return res.json(result);
});
// Serve client build in production
const clientDistPath = path_1.default.resolve(__dirname, '../../client/dist');
app.use(express_1.default.static(clientDistPath));
// Fallback all non-API routes to client index.html for SPA routing
app.get('*', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(path_1.default.join(clientDistPath, 'index.html'), (err) => {
        if (err) {
            res.status(200).send('OmniDeck Server is running. Client build will be served here once built.');
        }
    });
});
const PORT = process.env.PORT || 3000;
async function bootstrap() {
    // Restore player data from Redis (if configured) BEFORE accepting traffic
    await userManager.initRemote();
    await giftcodeManager.initRemote();
    server.listen(PORT, () => {
        console.log(`[OmniDeck Server] Running on http://localhost:${PORT}`);
    });
}
bootstrap().catch(err => {
    console.error('[OmniDeck] Fatal boot error:', err);
    process.exit(1);
});
// Flush pending debounced saves to Redis before Render stops the instance
for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, async () => {
        console.log(`[OmniDeck] ${signal} received — flushing remote saves...`);
        await (0, redisRest_1.flushRemoteSaves)();
        process.exit(0);
    });
}
process.on('uncaughtException', (err) => {
    console.error('[OmniDeck] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[OmniDeck] Unhandled Rejection at:', promise, 'reason:', reason);
});
