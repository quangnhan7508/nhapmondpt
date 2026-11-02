/**
 * Upstash Redis persistence (optional).
 *
 * Uses the Upstash REST API via plain fetch — no npm dependency.
 * Configured via env vars:
 *   UPSTASH_REDIS_REST_URL   e.g. https://xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * If the env vars are missing (local dev), every function no-ops and the app
 * falls back to local JSON files exactly as before.
 *
 * Writes are debounced (10s) to stay well inside the free plan's
 * 10.000 commands/day, serialized per key, and flushed on SIGTERM.
 */

const KEY_USERS = 'omnideck:users';
const KEY_SESSIONS = 'omnideck:sessions';
const KEY_TAIXIU_JACKPOT = 'omnideck:taixiu-jackpot';
const KEY_GIFTCODES = 'omnideck:giftcodes';
const KEY_TRANSACTIONS = 'omnideck:transactions';

export const PERSISTED_KEYS = { KEY_USERS, KEY_SESSIONS, KEY_TAIXIU_JACKPOT, KEY_GIFTCODES, KEY_TRANSACTIONS };

const SAVE_DEBOUNCE_MS = 10_000;
const FETCH_TIMEOUT_MS = 8_000;

export function redisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function runCommand(args: string[], timeoutMs = FETCH_TIMEOUT_MS): Promise<string | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args),
      signal: controller.signal
    });
    if (!res.ok) {
      console.warn(`[Redis] Command ${args[0]} failed: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { result?: string | null };
    return data.result ?? null;
  } catch (err) {
    console.warn(`[Redis] Command ${args[0]} error:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** GET a key; returns null when missing or on any error. */
export async function redisGet(key: string): Promise<string | null> {
  if (!redisConfigured()) return null;
  return runCommand(['GET', key]);
}

/** SET a key; returns false on failure (caller keeps local file as source of truth). */
export async function redisSet(key: string, value: string): Promise<boolean> {
  if (!redisConfigured()) return false;
  const result = await runCommand(['SET', key, value]);
  return result === 'OK';
}

// ---------------------------------------------------------------------------
// Debounced save queue
// ---------------------------------------------------------------------------

interface PendingSave {
  timer: ReturnType<typeof setTimeout>;
  produce: () => string;
}

const pendingSaves = new Map<string, PendingSave>();
// Per-key promise chain → writes never overlap, always last-write-wins in order.
const saveChains = new Map<string, Promise<void>>();

function enqueueSave(key: string, produce: () => string): void {
  const prev = saveChains.get(key) ?? Promise.resolve();
  const next = prev
    .then(async () => {
      // Produce at flush time so we always push the freshest state.
      const ok = await redisSet(key, produce());
      if (!ok) console.warn(`[Redis] Failed to persist ${key} (local file still updated)`);
    })
    .catch(err => {
      console.warn(`[Redis] Save chain error for ${key}:`, err instanceof Error ? err.message : err);
    });
  saveChains.set(key, next);
}

/**
 * Schedule a debounced remote save. Safe to call on every mutation —
 * only the last state within the debounce window is written (1 command).
 */
export function scheduleRemoteSave(key: string, produce: () => string): void {
  if (!redisConfigured()) return;
  const existing = pendingSaves.get(key);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    pendingSaves.delete(key);
    enqueueSave(key, produce);
  }, SAVE_DEBOUNCE_MS);
  timer.unref?.();
  pendingSaves.set(key, { timer, produce });
}

/** Flush all pending saves immediately (called on SIGTERM before shutdown). */
export async function flushRemoteSaves(): Promise<void> {
  for (const [key, entry] of Array.from(pendingSaves.entries())) {
    clearTimeout(entry.timer);
    pendingSaves.delete(key);
    enqueueSave(key, entry.produce);
  }
  await Promise.all(Array.from(saveChains.values()));
}
