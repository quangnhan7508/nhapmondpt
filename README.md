# OmniDeck Arena 🃏💣♠️
### Production-Ready Multiplayer Card & Board Game Platform

[![Tests](https://img.shields.io/badge/tests-8%20passed-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)]()
[![React](https://img.shields.io/badge/React-18.2-cyan.svg)]()
[![Socket.io](https://img.shields.io/badge/Socket.io-4.7-black.svg)]()
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)]()

OmniDeck Arena is a full-stack, server-authoritative online multiplayer card and board game platform supporting 2 to 8 players, built with anti-cheat state masking, heuristic AI bot integration, and responsive visual design.

---

## 1. Supported Games & Specifications

### 🂡 A. UNO (Classic, Show 'Em No Mercy, and Flex Modes) [2 - 8 Players]
- **Classic Mode**: Standard 108 cards (0-9, Skip, Reverse, Draw Two, Wild, Wild Draw Four).
- **Show 'Em No Mercy Mode**:
  - Extreme action cards: Wild Draw 6, Wild Draw 10, Skip Everyone, Discard All, Wild Color Roulette.
  - **Mercy Rule Knockout**: Any player who accumulates 25 or more cards in hand is instantly knocked out and eliminated!
- **Flex Mode**:
  - Dual-action/dual-color cards with regular face and flex face.
  - Interactive **Flex Power Card** tracker (Green check / Red X) allowing players to switch between regular effects and powered flex effects.
- **House Rules (Host Toggles)**:
  - **Free Stacking (Cộng dồn tự do)**: Chain penalty draw cards (+2 on +2; +4 on +2; in No Mercy, stack +2, +4, +6, +10 freely). Accumulates until a player cannot match and must draw the total penalty!
  - **Jump-In (Cướp lượt)**: Play out of turn if holding an exact matching card (same color and value).
  - **7-0 Rule**: Playing a '7' triggers an interactive hand swap modal; playing a '0' shifts all hands in current play direction.
  - **UNO Shout / Catch**: Call UNO when holding 1 card; opponents can click "Catch UNO!" to penalize uncalled players with +2 cards.

---

### 💣 B. Exploding Kittens (Mèo Nổ) [2 - 5 Players]
- **Complete Deck Engine**: Exploding Kittens ($Players - 1$), Defuses, Attacks, Skips, Favors, Shuffles, See the Future (3x), Nopes, and Cat combo cards (Taco Cat, Hairy Potato Cat, Rainbow Ralphing Cat, Beard Cat, Cattermelon).
- **Interactive 3-Second Nope Reaction Window**:
  - Whenever an action card or cat combo is played, an animated 3-second global reaction window triggers.
  - Any player with a "Nope" card can interrupt and slam "NOPE!" to cancel the action.
  - Chained Nopes ("Nope the Nope!") are supported; an odd number cancels the action, an even number restores it.
- **10-Second Defusal Emergency Window**:
  - Drawing an Exploding Kitten gives the player 10 seconds to play a Defuse card.
  - An interactive modal lets the player choose where to secretly re-insert the Kitten back into the draw deck (Top, Bottom, or Random).
  - Failure to defuse leads to immediate explosion and elimination. Last survivor wins!
- **Private See the Future**: Top 3 cards are transmitted only to the requesting player's client.

---

### ♠️ C. Tiến Lên Miền Nam (Vietnamese Thirteen) [2 - 4 Players]
- **Deck & Rank System**:
  - Standard 52-card deck dealt 13 cards each.
  - Rank value hierarchy: $3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2$ (2/Heo is highest).
  - Suit hierarchy: Spades ($\spadesuit$) < Clubs ($\clubsuit$) < Diamonds ($\diamondsuit$) < Hearts ($\heartsuit$).
- **Combinations**:
  - Rác (Single), Đôi (Pair), Sám cô (Triple), Sảnh (Straight min 3 cards, 2 excluded).
- **Special Chặt (Cutting) Rules**:
  - **3 Đôi thông (3 Consecutive Pairs)**: Cuts a single 2, or smaller 3 Đôi thông.
  - **Tứ quý (Four of a Kind)**: Cuts a single 2, pair of 2s, 3 Đôi thông, or smaller Tứ quý.
  - **4 Đôi thông (4 Consecutive Pairs)**: Cuts single 2, pair of 2s, 3 Đôi thông, Tứ quý, or smaller 4 Đôi thông.
  - **Chặt không cần vòng**: 4 Đôi thông can cut out-of-turn even if the player already passed!
- **Special Outcomes**:
  - **Tới Trắng (Instant Win)**: Dealt immediately at match start (Dragon straight 3-A, four 2s, 6 pairs, 5 đôi thông, same color).
  - **Cóng (Cháy bài)**: Penalty if a player played 0 cards when the winner finishes.
  - **Thối 2 / Hàng**: Extra penalty points calculated for holding 2s (Black 2 vs Red 2) or hàng at the end of the round.

---

## 2. Server-Authoritative Anti-Cheat & Bot AI Architecture

### Anti-Cheat State Masking
- The server stores the authoritative game state and secret draw deck.
- Deck shuffling uses Node.js `crypto.randomInt` (cryptographically secure Fisher-Yates shuffle).
- **State Masking**:
  - Clients only receive their own hand cards (`myHand`).
  - Opponents' hands are redacted to metadata: `{ cardCount: number, hasCalledUno, connected, rank }`.
  - Draw deck card identities are completely secret; only the remaining count is broadcast.
  - Private actions ("See the Future", Defuse placement) are routed exclusively to the targeted socket.

### AI Bot Controller (`BotController.ts`)
- Room host can add or kick AI Bots to fill empty slots (2 to 8 players).
- Realistic heuristics with simulated human delay (1000ms - 1800ms):
  - **UNO**: Prioritizes shedding high-point cards, attacks opponents with action cards, handles draw stacking challenges, shouts UNO at 1 card, and catches opponents who fail to call UNO.
  - **Exploding Kittens**: Uses "See the Future" to detect danger, plays Skip/Attack to avoid hot decks, tactically reinserts defused kittens at the top, and uses Nope to counter opponent attacks.
  - **Tiến Lên**: Sheds junk singles and short straights early, holds '2's for critical tricks, cuts 2s with 3 Đôi thông / Tứ quý, and executes out-of-turn 4 Đôi thông cuts.

---

## 3. Project Directory Structure

```text
├── server/
│   ├── src/
│   │   ├── engines/
│   │   │   ├── BaseGame.ts                # Abstract game engine & CSPRNG shuffle
│   │   │   ├── uno/
│   │   │   │   ├── UnoGame.ts             # UNO engine (Classic, No Mercy, Flex)
│   │   │   │   ├── UnoDeck.ts             # Deck generators
│   │   │   │   ├── types.ts               # Card types & house rules
│   │   │   │   └── UnoGame.test.ts        # Unit tests
│   │   │   ├── exploding-kittens/
│   │   │   │   ├── ExplodingKittensGame.ts # Mèo Nổ engine (3s Nope, 10s Defuse)
│   │   │   │   ├── types.ts
│   │   │   │   └── ExplodingKittensGame.test.ts
│   │   │   ├── tien-len/
│   │   │   │   ├── TienLenGame.ts         # Tiến Lên engine (Tricks, Cóng, Thối 2)
│   │   │   │   ├── CardEvaluator.ts       # Combo detection & Chặt logic
│   │   │   │   ├── types.ts
│   │   │   │   └── TienLenGame.test.ts
│   │   │   └── ai/
│   │   │       ├── BotController.ts       # Autonomous bot coordinator
│   │   │       └── strategies/
│   │   │           ├── UnoBotStrategy.ts
│   │   │           ├── ExplodingKittensBotStrategy.ts
│   │   │           └── TienLenBotStrategy.ts
│   │   ├── rooms/
│   │   │   └── RoomManager.ts             # 6-char room codes, sessions, chat
│   │   ├── sockets/
│   │   │   └── gameHandlers.ts            # Socket.io masked state distribution
│   │   └── server.ts                      # Express + Socket.io + Static SPA host
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── lobby/
│   │   │   │   └── LobbyView.tsx          # 2-8 player lobby & game customizers
│   │   │   ├── table/
│   │   │   │   ├── TableView.tsx          # Circular casino felt table layout
│   │   │   │   └── VictoryModal.tsx       # Winner podium & rankings
│   │   │   ├── uno/
│   │   │   │   └── UnoTableView.tsx       # Fan-out hand, wild & swap modals
│   │   │   ├── exploding-kittens/
│   │   │   │   └── ExplodingKittensTableView.tsx # 3s Nope overlay, Defuse modal
│   │   │   └── tien-len/
│   │   │       └── TienLenTableView.tsx   # Multi-card selector, combo badges
│   │   ├── hooks/
│   │   │   └── useGameSocket.ts           # Reconnection resilience & socket sync
│   │   ├── utils/
│   │   │   └── sound.ts                   # Web Audio API synthesizer
│   │   ├── types/
│   │   │   └── game.ts
│   │   ├── App.tsx
│   │   └── main.tsx
├── Dockerfile                             # Multi-stage production container
├── docker-compose.yml                     # Docker compose configuration
└── README.md
```

---

## 4. Quickstart: Running Locally

### Prerequisites
- Node.js LTS (v20+)
- npm (v10+)

### 1. Build and Run Server & Client
```bash
# In the root directory:
npm run build

# Start the server (serves both API, WebSockets, and static client on port 3000):
npm start
```
Open `http://localhost:3000` in your browser!

### 2. Run in Development Mode
```bash
# Terminal 1: Run Server with live reload
npm run dev:server

# Terminal 2: Run Client with Vite HMR
npm run dev:client
```
Client dev server runs on `http://localhost:5173` (proxied to server on port 3000).

### 3. Run Automated Engine Unit Tests
```bash
npm run test:server
```

---

## 5. Running with Docker

Deploy the single containerized monorepo with `docker-compose`:

```bash
docker-compose up -d --build
```
The game will be live at `http://localhost:3000`.

To view container logs:
```bash
docker-compose logs -f
```

To stop:
```bash
docker-compose down
```
