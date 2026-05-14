import prisma from '@/lib/prisma'
import { joinLobby, createInviteLobby } from './lobbyStateMachine'
import type { PugTier } from './types'

const AFK_THRESHOLD_MS = 2 * 60 * 1000

export async function processQueue(
  tier: PugTier,
  region?: string | null,
): Promise<void> {
  await cleanupAfkEntries(tier, region)

  const entries = await prisma.pugQueueEntry.findMany({
    where: { tier, ...(region ? { region } : {}) },
    orderBy: { queuedAt: 'asc' },
  })

  if (entries.length === 0) return

  const whereClause: any = { tier, status: 'OPEN' }
  if (region) whereClause.region = region

  let openLobby = await prisma.pugLobby.findFirst({
    where: whereClause,
    orderBy: { createdAt: 'asc' },
  })

  if (!openLobby && tier === 'invite' && region) {
    const seasonId = entries[0].payloadSeasonId
    openLobby = await createInviteLobby(seasonId, region)
  }

  if (!openLobby) return

  for (const entry of entries) {
    const lobby = await prisma.pugLobby.findUnique({ where: { id: openLobby.id } })
    if (!lobby || lobby.status !== 'OPEN') break

    try {
      await joinLobby(openLobby.id, entry.userId, entry.roles as string[])
      await prisma.pugQueueEntry.delete({ where: { id: entry.id } })
    } catch {
      // Player can't be placed (role conflict, banned, already in lobby, etc.) - skip
    }
  }
}

async function cleanupAfkEntries(
  tier: PugTier,
  region?: string | null,
): Promise<void> {
  const threshold = new Date(Date.now() - AFK_THRESHOLD_MS)
  await prisma.pugQueueEntry.deleteMany({
    where: {
      tier,
      ...(region ? { region } : {}),
      lastPing: { lt: threshold },
    },
  })
}

export async function getQueuePosition(
  userId: number,
  tier: PugTier,
): Promise<{ position: number; total: number } | null> {
  const entry = await prisma.pugQueueEntry.findUnique({
    where: { userId_tier: { userId, tier } },
  })
  if (!entry) return null

  const ahead = await prisma.pugQueueEntry.count({
    where: {
      tier,
      ...(entry.region ? { region: entry.region } : {}),
      queuedAt: { lt: entry.queuedAt },
    },
  })

  const total = await prisma.pugQueueEntry.count({
    where: {
      tier,
      ...(entry.region ? { region: entry.region } : {}),
    },
  })

  return { position: ahead + 1, total }
}

export async function clearQueueForRegion(
  tier: PugTier,
  region: string,
): Promise<number> {
  const result = await prisma.pugQueueEntry.deleteMany({
    where: { tier, region },
  })
  return result.count
}
