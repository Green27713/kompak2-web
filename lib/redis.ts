import { createClient, RedisClientType } from 'redis';

// Pin to globalThis so Next.js hot-reload and PM2 cluster workers don't
// create duplicate connections on each module re-evaluation.
const g = globalThis as typeof globalThis & { _redisClient?: RedisClientType };

export async function getRedisClient(): Promise<RedisClientType> {
  if (!g._redisClient) {
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Max Redis reconnection attempts reached');
            return new Error('Max reconnection attempts');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    }) as RedisClientType;

    client.on('error', (err) => console.error('Redis Client Error', err));
    client.on('connect', () => console.log('Redis Client Connected'));

    await client.connect();
    g._redisClient = client;
  }

  return g._redisClient;
}

export async function checkRateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60 * 1000
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const client = await getRedisClient();
  const key = `ratelimit:${identifier}`;

  const current = await client.incr(key);
  if (current === 1) {
    await client.expire(key, Math.ceil(windowMs / 1000));
  }

  const ttl = await client.ttl(key);
  const remaining = Math.max(0, limit - current);

  return {
    allowed: current <= limit,
    remaining,
    resetIn: ttl > 0 ? ttl * 1000 : windowMs,
  };
}
