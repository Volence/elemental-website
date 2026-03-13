import { PrismaClient } from '../../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Singleton pattern to prevent connection exhaustion in Next.js dev mode (HMR)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Prisma 7 requires a driver adapter — no more direct DB connections
function createPrismaClient(): PrismaClient {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URI })
  // Cast needed: @types/pg@8 Pool type is incompatible with @prisma/adapter-pg's bundled @types/pg
  const adapter = new PrismaPg(pool as any)
  return new PrismaClient({ adapter })
}

const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma

