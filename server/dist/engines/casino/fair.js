"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomHex = exports.sha256 = void 0;
exports.drawFloat = drawFloat;
exports.newSeeds = newSeeds;
const crypto_1 = __importDefault(require("crypto"));
const sha256 = (s) => crypto_1.default.createHash('sha256').update(s).digest('hex');
exports.sha256 = sha256;
const randomHex = (bytes = 16) => crypto_1.default.randomBytes(bytes).toString('hex');
exports.randomHex = randomHex;
/**
 * Rút số ngẫu nhiên float [0,1) từ bộ seed — minh bạch, kiểm chứng lại được.
 * Cùng (serverSeed, clientSeed, nonce, round) luôn cho cùng kết quả.
 */
function drawFloat(serverSeed, clientSeed, nonce, round) {
    const h = (0, exports.sha256)(`${serverSeed}:${clientSeed}:${nonce}:${round}`);
    return parseInt(h.slice(0, 13), 16) / 0x10000000000000;
}
function newSeeds(clientSeed, nonce = 1) {
    const serverSeed = (0, exports.randomHex)(32);
    return {
        serverSeed,
        clientSeed: clientSeed || (0, exports.randomHex)(16),
        nonce,
        seedHash: (0, exports.sha256)(serverSeed),
    };
}
