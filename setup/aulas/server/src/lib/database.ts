import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'

export function createDatabase(url = process.env.DATABASE_URL) {
  if (!url)
    throw new Error('Configure DATABASE_URL no arquivo .env. Execute npm run setup na raiz.')
  // Preserve the integer timestamp format used by the original SQLite migrations.
  const adapter = new PrismaBetterSqlite3({ url }, { timestampFormat: 'unixepoch-ms' })
  return new PrismaClient({ adapter })
}
