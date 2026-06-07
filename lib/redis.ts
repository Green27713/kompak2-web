import { createClient, RedisClientType } from 'redis';

// ─── Singleton client ─────────────────────────────────────────────────────────
const g = globalThis as typeof globalThis & { _redisClient?: RedisClientType };

export async function getRedisClient(): Promise<RedisClientType> {
  if (!g._redisClient) {
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) return new Error('Max Redis reconnection attempts');
          return Math.min(retries * 100, 3000);
        },
      },
    }) as RedisClientType;

    client.on('error', (err) => console.error('[redis] error:', err));
    client.on('connect', () => console.log('[redis] connected'));

    await client.connect();
    g._redisClient = client;
  }
  return g._redisClient;
}

// ─── Sliding window rate limiter ──────────────────────────────────────────────
// Uses a Redis sorted set where each member is a unique request token and
// its score is the request timestamp (ms). On every call we:
//   1. Evict tokens older than the window
//   2. Add a token for this request
//   3. Count remaining tokens
//
// Because step 2 always runs before step 3, a request is counted against the
// limit even when it's ultimately rejected — preventing burst-gaming.
export async function slidingWindowRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const client = await getRedisClient();
  const key = `rl:sw:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  // Unique member so two requests at the same millisecond don't collide.
  const member = `${now}-${Math.random().toString(36).slice(2, 9)}`;

  try {
    // Evict stale entries from outside the current window.
    await client.zRemRangeByScore(key, '-inf', windowStart);
    // Record this request.
    await client.zAdd(key, { score: now, value: member });
    // How many requests are now in the window (including this one)?
    const count = await client.zCard(key);
    // Auto-expire the key so idle keys don't sit in Redis forever.
    await client.expire(key, Math.ceil(windowMs / 1000) + 1);

    const remaining = Math.max(0, limit - count);
    return { allowed: count <= limit, remaining, resetIn: windowMs };
  } catch {
    // Redis unavailable — fail open so a Redis blip never takes down the site.
    console.warn('[redis] rate limit check failed, failing open');
    return { allowed: true, remaining: limit, resetIn: windowMs };
  }
}

// ─── Legacy alias ─────────────────────────────────────────────────────────────
// Kept so existing callers (compress route) don't break until Step 6
// replaces them with applyRateLimit().
export async function checkRateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60_000,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  return slidingWindowRateLimit(identifier, limit, windowMs);
}
