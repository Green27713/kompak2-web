import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client';
import { join } from 'path';

// Prisma 7 requires a driver adapter for SQLite — the binary engine is deprecated.
// The adapter takes { url } directly; it opens the file itself.
function makeClient() {
  // Resolve the absolute path so Next.js and the CLI always hit the same file.
  const rawUrl = process.env.DATABASE_URL ?? `file:${join(process.cwd(), 'prisma', 'pixsnug.db')}`;
  // Strip the "file:" prefix that Prisma uses in the URL format.
  const url = rawUrl.startsWith('file:') ? rawUrl.slice(5) : rawUrl;
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

// Pin to globalThis so Next.js hot-reload and PM2 workers never open more
// than one SQLite file handle per process.
const g = globalThis as typeof globalThis & { _prisma?: PrismaClient };
export const db = g._prisma ?? makeClient();
if (process.env.NODE_ENV !== 'production') g._prisma = db;
