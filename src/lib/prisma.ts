import { PrismaClient } from '../../generated/prisma/client'

// Singleton pattern to prevent connection exhaustion in Next.js dev mode (HMR)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Prisma 7 constructor requires options — use type assertion for the empty default case
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = globalForPrisma.prisma ?? new (PrismaClient as any)()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma as PrismaClient
