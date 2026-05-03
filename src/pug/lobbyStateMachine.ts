import prisma from '@/lib/prisma'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { findValidAssignment } from './roleAssignment'
import { selectCaptains } from './captainSelection'
import { DRAFT_PICK_ORDER, getNextPickTeam, isDraftComplete } from './draftEngine'
import { drawMapCandidates, resolveMapVote } from './mapVote'
import { applyBan, getNextBanTeam } from './banPhase'
import { calculateRatingUpdates } from './mmr'
import { applyEscalatingBan } from './cooldownBans'
import { registerTimer, cancelTimer, timerKey } from './timers'
import type { QueuedPlayer, PlayerRating, MatchResult, PugRole } from './types'
import {
  READY_CHECK_TIMEOUT_MS,
  DRAFT_PICK_TIMEOUT_MS,
  MAP_VOTE_TIMEOUT_MS,
  BAN_TIMEOUT_MS,
  RESULT_CONFIRM_TIMEOUT_MS,
  DISPUTE_AFTER_COMPLETE_MS,
  VOICE_CLEANUP_TIMEOUT_MS,
  INVITE_TIER_LATE_CANCEL_MS,
} from './constants'

async function getDiscordIdsForLobby(lobbyId: number, payloadInstance: any): Promise<string[]> {
  const players = await prisma.pugLobbyPlayer.findMany({ where: { lobbyId } })
  const userIds = players.map((p) => p.userId)
  if (userIds.length === 0) return []
  const users = await payloadInstance.find({
    collection: 'users',
    where: { id: { in: userIds } },
    overrideAccess: true,
    limit: userIds.length,
  })
  return (users.docs as any[]).map((u: any) => u.discordId).filter(Boolean)
}

function canAllBeAssigned(players: Array<{ queuedRoles: string[] }>): boolean {
  const slots: Record<string, number> = { tank: 0, flex_dps: 0, hitscan_dps: 0, flex_support: 0, main_support: 0 }
  function backtrack(i: number): boolean {
    if (i === players.length) return true
    for (const role of players[i].queuedRoles) {
      if ((slots[role] ?? 0) < 2) {
        slots[role]++
        if (backtrack(i + 1)) return true
        slots[role]--
      }
    }
    return false
  }
  return backtrack(0)
}

export async function createOpenLobby(createdByUserId: number, payloadSeasonId: number) {
  const lastLobby = await prisma.pugLobby.findFirst({
    where: { tier: 'open' },
    orderBy: { lobbyNumber: 'desc' },
  })
  const lobbyNumber = (lastLobby?.lobbyNumber ?? 0) + 1
  const lobby = await prisma.pugLobby.create({
    data: { lobbyNumber, tier: 'open', status: 'OPEN', createdByUserId, payloadSeasonId },
  })
  import('@/discord/services/pugFeed').then(({ updateLobbyFeed }) => {
    updateLobbyFeed(lobby.id).catch(console.error)
  })
  return lobby
}

export async function createInviteLobby(
  payloadSeasonId: number,
  region: string,
  windowEnd?: Date,
) {
  const lastLobby = await prisma.pugLobby.findFirst({
    where: { tier: 'invite' },
    orderBy: { lobbyNumber: 'desc' },
  })
  const lobbyNumber = (lastLobby?.lobbyNumber ?? 0) + 1

  const data: any = {
    lobbyNumber,
    tier: 'invite',
    status: 'OPEN',
    payloadSeasonId,
    region,
  }

  if (windowEnd) {
    const timeoutAt = new Date(windowEnd.getTime() + INVITE_TIER_LATE_CANCEL_MS)
    data.scheduledWindowEnd = windowEnd
    data.timeoutAt = timeoutAt
  }

  const lobby = await prisma.pugLobby.create({ data })

  if (windowEnd) {
    const timeoutMs = data.timeoutAt!.getTime() - Date.now()
    registerTimer(timerKey(lobby.id, 'timeout'), timeoutMs, () =>
      cancelExpiredLobby(lobby.id),
    )
  }

  import('@/discord/services/pugFeed').then(({ updateLobbyFeed }) => {
    updateLobbyFeed(lobby.id).catch(console.error)
  })
  return lobby
}

export async function joinLobby(lobbyId: number, userId: number, roles: string[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const lobby = await tx.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })
    if (lobby.status !== 'OPEN') throw new Error('Lobby is not accepting players')

    const existingMembership = await tx.pugLobbyPlayer.findFirst({
      where: {
        userId,
        lobbyId: { not: lobbyId },
        lobby: { status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS', 'REPORTING'] } },
      },
    })
    if (existingMembership) throw new Error('You are already in an active lobby')

    const allPlayers = await tx.pugLobbyPlayer.findMany({ where: { lobbyId } })
    const others = allPlayers.filter((p) => p.userId !== userId)
    const withNew = [...others.map((p) => ({ queuedRoles: p.queuedRoles as string[] })), { queuedRoles: roles }]
    if (!canAllBeAssigned(withNew)) {
      throw new Error('No valid role assignment is possible with your selected roles - some role slots are full')
    }

    await tx.pugLobbyPlayer.upsert({
      where: { lobbyId_userId: { lobbyId, userId } },
      create: { lobbyId, userId, queuedRoles: roles as any },
      update: { queuedRoles: roles as any },
    })
  }, { isolationLevel: 'Serializable' })

  await checkAndAdvanceToReady(lobbyId)
  import('@/discord/services/pugFeed').then(({ updateLobbyFeed }) => {
    updateLobbyFeed(lobbyId).catch(console.error)
  })
}

export async function leaveLobby(lobbyId: number, userId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })

  if (lobby.status === 'DRAFTING') {
    await cancelLobby(lobbyId, 'Player left during draft')
    const payload = await getPayload({ config: configPromise })
    const pugPlayer = await payload.find({
      collection: 'pug-players',
      where: { user: { equals: userId } },
      overrideAccess: true,
    })
    if (pugPlayer.docs[0]) {
      await applyEscalatingBan((pugPlayer.docs[0] as any).id, 'Left lobby during draft phase')
    }
    return
  }

  if (!['OPEN', 'READY'].includes(lobby.status)) {
    throw new Error('Cannot leave lobby in current state')
  }

  await prisma.pugLobbyPlayer.delete({
    where: { lobbyId_userId: { lobbyId, userId } },
  })

  if (lobby.status === 'READY') {
    await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'OPEN' } })
    cancelTimer(timerKey(lobbyId, 'ready'))
  }

  import('@/discord/services/pugFeed').then(({ updateLobbyFeed }) => {
    updateLobbyFeed(lobbyId).catch(console.error)
  })
}

async function checkAndAdvanceToReady(lobbyId: number): Promise<void> {
  const players = await prisma.pugLobbyPlayer.findMany({ where: { lobbyId } })
  const queued: QueuedPlayer[] = players.map((p) => ({
    userId: p.userId,
    queuedRoles: p.queuedRoles as PugRole[],
    rating: 1500, // actual ratings fetched in advanceToDrafting; 1500 only needed for role feasibility check
  }))

  const assignment = findValidAssignment(queued)
  if (!assignment) return

  await prisma.pugLobbyPlayer.updateMany({
    where: { lobbyId },
    data: { readyConfirmed: false },
  })
  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'READY', readyAt: new Date() } })
  registerTimer(timerKey(lobbyId, 'ready'), READY_CHECK_TIMEOUT_MS, () => expireReadyCheck(lobbyId))

  getDiscordIdsForLobby(lobbyId, await getPayload({ config: configPromise })).then(async (discordIds) => {
    const { postFeedNotification } = await import('@/discord/services/pugFeed')
    const { formatUserPings } = await import('@/discord/services/pugNotifications')
    const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
    if (!lobby) return
    await postFeedNotification(
      lobby.tier as 'open' | 'invite',
      `🔔 **PUG #${lobby.lobbyNumber}** queue is full! Ready up at: https://elmt.gg/pugs/lobby/${lobbyId}\n${formatUserPings(discordIds)}`,
    )
  }).catch(console.error)
}

export async function readyUp(lobbyId: number, userId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })
  if (lobby.status !== 'READY') throw new Error('Lobby is not in ready check')

  const player = await prisma.pugLobbyPlayer.findFirst({
    where: { lobbyId, userId },
  })
  if (!player) throw new Error('You are not in this lobby')
  if (player.readyConfirmed) throw new Error('Already readied up')

  await prisma.pugLobbyPlayer.update({
    where: { lobbyId_userId: { lobbyId, userId } },
    data: { readyConfirmed: true },
  })

  const allPlayers = await prisma.pugLobbyPlayer.findMany({ where: { lobbyId } })
  const allReady = allPlayers.every((p) => p.readyConfirmed)
  if (allReady) {
    cancelTimer(timerKey(lobbyId, 'ready'))
    await advanceToDrafting(lobbyId)
  }
}

export async function expireReadyCheck(lobbyId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby || lobby.status !== 'READY') return

  const players = await prisma.pugLobbyPlayer.findMany({ where: { lobbyId } })
  const notReady = players.filter((p) => !p.readyConfirmed)

  if (notReady.length === 0) {
    await advanceToDrafting(lobbyId)
    return
  }

  const payload = await getPayload({ config: configPromise })
  for (const p of notReady) {
    await prisma.pugLobbyPlayer.delete({
      where: { lobbyId_userId: { lobbyId, userId: p.userId } },
    })
    const pugPlayer = await payload.find({
      collection: 'pug-players',
      where: { user: { equals: p.userId } },
      overrideAccess: true,
      limit: 1,
    })
    if (pugPlayer.docs[0]) {
      await applyEscalatingBan((pugPlayer.docs[0] as any).id, 'Failed to ready up')
    }
  }

  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'OPEN' } })
  import('@/discord/services/pugFeed').then(({ updateLobbyFeed }) => {
    updateLobbyFeed(lobbyId).catch(console.error)
  })
}

export async function advanceToDrafting(lobbyId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })
  if (lobby.status !== 'READY') return

  const lobbyPlayers = await prisma.pugLobbyPlayer.findMany({ where: { lobbyId } })
  const payload = await getPayload({ config: configPromise })

  const lbWhere: any[] = [
    { tier: { equals: lobby.tier } },
    { season: { equals: lobby.payloadSeasonId } },
  ]
  if (lobby.region) {
    lbWhere.push({ region: { equals: lobby.region } })
  }

  const lb = await payload.find({
    collection: 'pug-leaderboard',
    where: { and: lbWhere },
    overrideAccess: true,
    limit: 100,
  })

  const queued: QueuedPlayer[] = lobbyPlayers.map((p) => {
    const entry = (lb.docs as any[]).find(
      (d: any) => typeof d.player === 'object' ? d.player.user === p.userId : false,
    )
    return {
      userId: p.userId,
      queuedRoles: p.queuedRoles as PugRole[],
      rating: entry?.rating ?? 1500,
    }
  })

  const assignment = findValidAssignment(queued)
  if (!assignment) {
    await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'OPEN' } })
    return
  }

  for (const a of assignment) {
    await prisma.pugLobbyPlayer.update({
      where: { lobbyId_userId: { lobbyId, userId: a.userId } },
      data: { assignedRole: a.assignedRole },
    })
  }

  const { captain1Id, captain2Id, captainRole } = selectCaptains(assignment)

  await prisma.pugLobbyPlayer.update({
    where: { lobbyId_userId: { lobbyId, userId: captain1Id } },
    data: { isCaptain: true, team: 1 },
  })
  await prisma.pugLobbyPlayer.update({
    where: { lobbyId_userId: { lobbyId, userId: captain2Id } },
    data: { isCaptain: true, team: 2 },
  })

  const pickDeadline = new Date(Date.now() + DRAFT_PICK_TIMEOUT_MS)

  await prisma.pugDraftState.create({
    data: {
      lobbyId,
      captain1Id,
      captain2Id,
      captainRole: captainRole,
      currentPickTeam: DRAFT_PICK_ORDER[0],
      pickNumber: 0,
      pickDeadline,
      picks: [],
    },
  })

  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'DRAFTING' } })
  // Fire-and-forget: notify players and update feed (don't block timer registration)
  getDiscordIdsForLobby(lobbyId, payload).then(async (discordIds) => {
    const { postFeedNotification, updateLobbyFeed } = await import('@/discord/services/pugFeed')
    const { formatUserPings } = await import('@/discord/services/pugNotifications')
    await postFeedNotification(
      lobby.tier as 'open' | 'invite',
      `🎮 **PUG #${lobby.lobbyNumber}** draft is starting! Head to: https://elmt.gg/pugs/lobby/${lobbyId}\n${formatUserPings(discordIds)}`,
    )
    await updateLobbyFeed(lobbyId)
  }).catch(console.error)
  registerTimer(timerKey(lobbyId, 'draft'), DRAFT_PICK_TIMEOUT_MS, () => finalizeDraftPick(lobbyId))
}

export async function makeDraftPick(
  lobbyId: number,
  captainUserId: number,
  pickedUserId: number,
): Promise<void> {
  const result = await prisma.$transaction(async (tx) => {
    const draft = await tx.pugDraftState.findUniqueOrThrow({ where: { lobbyId } })
    const currentCaptainId = draft.currentPickTeam === 1 ? draft.captain1Id : draft.captain2Id
    if (captainUserId !== currentCaptainId) throw new Error('Not your turn to pick')

    const pickedPlayer = await tx.pugLobbyPlayer.findFirst({
      where: { lobbyId, userId: pickedUserId, team: null, isCaptain: false },
    })
    if (!pickedPlayer) throw new Error('Picked player is not available in this lobby')

    if (pickedPlayer.assignedRole) {
      const roleAlreadyOnTeam = await tx.pugLobbyPlayer.findFirst({
        where: { lobbyId, team: draft.currentPickTeam, assignedRole: pickedPlayer.assignedRole },
      })
      if (roleAlreadyOnTeam) throw new Error(`Team ${draft.currentPickTeam} already has a ${pickedPlayer.assignedRole}`)
    }

    const picks = draft.picks as { userId: number; team: number; pickNumber: number }[]
    const nextPickNumber = draft.pickNumber + 1
    const nextTeam = getNextPickTeam(nextPickNumber)

    picks.push({ userId: pickedUserId, team: draft.currentPickTeam, pickNumber: draft.pickNumber })

    await tx.pugLobbyPlayer.update({
      where: { lobbyId_userId: { lobbyId, userId: pickedUserId } },
      data: { team: draft.currentPickTeam },
    })

    if (isDraftComplete(nextPickNumber)) {
      await tx.pugDraftState.update({
        where: { lobbyId },
        data: { picks, pickNumber: nextPickNumber, currentPickTeam: nextTeam ?? 1, pickDeadline: null },
      })
      return 'advance_map_vote' as const
    }

    const remaining = await tx.pugLobbyPlayer.findMany({
      where: { lobbyId, team: null, isCaptain: false },
    })
    if (remaining.length === 1) {
      const lastPlayer = remaining[0]
      picks.push({ userId: lastPlayer.userId, team: nextTeam!, pickNumber: nextPickNumber })
      await tx.pugLobbyPlayer.update({
        where: { lobbyId_userId: { lobbyId, userId: lastPlayer.userId } },
        data: { team: nextTeam! },
      })
      const finalPickNumber = nextPickNumber + 1
      await tx.pugDraftState.update({
        where: { lobbyId },
        data: { picks, pickNumber: finalPickNumber, currentPickTeam: getNextPickTeam(finalPickNumber) ?? 1, pickDeadline: null },
      })
      return 'advance_map_vote' as const
    }

    const newDeadline = new Date(Date.now() + DRAFT_PICK_TIMEOUT_MS)
    await tx.pugDraftState.update({
      where: { lobbyId },
      data: { picks, pickNumber: nextPickNumber, currentPickTeam: nextTeam!, pickDeadline: newDeadline },
    })
    return 'continue_draft' as const
  }, { isolationLevel: 'Serializable' })

  cancelTimer(timerKey(lobbyId, 'draft'))

  if (result === 'advance_map_vote') {
    await advanceToMapVote(lobbyId)
  } else {
    registerTimer(timerKey(lobbyId, 'draft'), DRAFT_PICK_TIMEOUT_MS, () => finalizeDraftPick(lobbyId))
  }
}

export async function finalizeDraftPick(lobbyId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby || lobby.status !== 'DRAFTING') return

  const draft = await prisma.pugDraftState.findUniqueOrThrow({ where: { lobbyId } })
  const undraftedPlayers = await prisma.pugLobbyPlayer.findMany({
    where: { lobbyId, team: null, isCaptain: false },
    orderBy: { joinedAt: 'asc' },
  })

  if (undraftedPlayers.length === 0) {
    await advanceToMapVote(lobbyId)
    return
  }

  const autoPickUserId = undraftedPlayers[0].userId
  const captainId = draft.currentPickTeam === 1 ? draft.captain1Id : draft.captain2Id
  await makeDraftPick(lobbyId, captainId, autoPickUserId)
}

async function advanceToMapVote(lobbyId: number): Promise<void> {
  const payload = await getPayload({ config: configPromise })

  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })
  const season = lobby.payloadSeasonId
    ? await payload.findByID({ collection: 'pug-seasons', id: lobby.payloadSeasonId, overrideAccess: true })
    : null
  const pool = (season as any)?.mapPool ?? {}
  const allEntries: Array<number | { id: number }> = [
    ...(pool.control ?? []),
    ...(pool.hybrid ?? []),
    ...(pool.push ?? []),
    ...(pool.escort ?? []),
    ...(pool.flashpoint ?? []),
  ]
  const eligibleIds: number[] = allEntries.map((m) => (typeof m === 'object' ? m.id : m))

  if (eligibleIds.length < 3) {
    await advanceToBanning(lobbyId)
    return
  }
  const candidates = drawMapCandidates(eligibleIds)
  const voteDeadline = new Date(Date.now() + MAP_VOTE_TIMEOUT_MS)

  await prisma.pugMapVote.create({ data: { lobbyId, candidates, votes: {}, voteDeadline } })
  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'MAP_VOTE' } })
  registerTimer(timerKey(lobbyId, 'mapvote'), MAP_VOTE_TIMEOUT_MS, () => finalizeMapVote(lobbyId))
}

export async function castMapVote(lobbyId: number, userId: number, mapId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })
  if (lobby.status !== 'MAP_VOTE') throw new Error('Lobby is not in map vote phase')
  const player = await prisma.pugLobbyPlayer.findUnique({ where: { lobbyId_userId: { lobbyId, userId } } })
  if (!player) throw new Error('User is not a player in this lobby')
  const mapVote = await prisma.pugMapVote.findUniqueOrThrow({ where: { lobbyId } })
  if (!mapVote.candidates.includes(mapId)) throw new Error('Map not in candidates')
  const votes = mapVote.votes as Record<string, number>
  votes[String(userId)] = mapId
  await prisma.pugMapVote.update({ where: { lobbyId }, data: { votes } })
}

export async function finalizeMapVote(lobbyId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby || lobby.status !== 'MAP_VOTE') return

  const mapVote = await prisma.pugMapVote.findUniqueOrThrow({ where: { lobbyId } })
  const votes: Record<number, number> = {}
  for (const [uid, mid] of Object.entries(mapVote.votes as Record<string, number>)) {
    votes[parseInt(uid)] = mid
  }
  const selectedMapId = resolveMapVote(mapVote.candidates, votes)
  await prisma.pugMapVote.update({ where: { lobbyId }, data: { selectedMapId } })

  await advanceToBanning(lobbyId)
}

async function advanceToBanning(lobbyId: number): Promise<void> {
  const banDeadline = new Date(Date.now() + BAN_TIMEOUT_MS)
  await prisma.pugBanState.create({
    data: { lobbyId, currentBanTeam: 2, banNumber: 1, banDeadline, bans: [] },
  })
  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'BANNING' } })
  registerTimer(timerKey(lobbyId, 'ban'), BAN_TIMEOUT_MS, () => finalizeBan(lobbyId))
}

export async function makeBan(
  lobbyId: number,
  captainUserId: number,
  heroId: number,
): Promise<void> {
  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })
  if (lobby.status !== 'BANNING') throw new Error('Lobby is not in ban phase')

  const draft = await prisma.pugDraftState.findUniqueOrThrow({ where: { lobbyId } })
  const banState = await prisma.pugBanState.findUniqueOrThrow({ where: { lobbyId } })

  const expectedCaptainId = banState.currentBanTeam === 1 ? draft.captain1Id : draft.captain2Id
  if (captainUserId !== expectedCaptainId) throw new Error('Not your turn to ban')

  cancelTimer(timerKey(lobbyId, 'ban'))

  const payload = await getPayload({ config: configPromise })
  const heroes = await payload.find({ collection: 'heroes', overrideAccess: true, limit: 200 })
  const heroRoles: Record<number, 'tank' | 'dps' | 'support'> = {}
  const heroNames: Record<number, string> = {}
  for (const h of heroes.docs as any[]) {
    heroRoles[h.id] = h.role === 'dps' ? 'dps' : h.role
    heroNames[h.id] = h.name
  }

  const existingBans = banState.bans as { heroId: number; team: number; banNumber: number }[]
  const newBans = applyBan(existingBans as any, heroId, banState.currentBanTeam as 1 | 2, heroRoles, heroNames)
  const newBanNumber = banState.banNumber + 1
  const nextTeam = getNextBanTeam(newBanNumber)

  if (!nextTeam) {
    await prisma.pugBanState.update({ where: { lobbyId }, data: { bans: newBans, banDeadline: null } })
    await advanceToInProgress(lobbyId)
    return
  }

  const newDeadline = new Date(Date.now() + BAN_TIMEOUT_MS)
  await prisma.pugBanState.update({
    where: { lobbyId },
    data: { bans: newBans, banNumber: newBanNumber, currentBanTeam: nextTeam, banDeadline: newDeadline },
  })
  registerTimer(timerKey(lobbyId, 'ban'), BAN_TIMEOUT_MS, () => finalizeBan(lobbyId))
}

export async function finalizeBan(lobbyId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby || lobby.status !== 'BANNING') return

  const banState = await prisma.pugBanState.findUniqueOrThrow({ where: { lobbyId } })
  const nextTeam = getNextBanTeam(banState.banNumber + 1)

  if (!nextTeam) {
    await advanceToInProgress(lobbyId)
    return
  }

  // Team forfeited their ban - advance without recording; bans array stays shorter than banNumber
  const newDeadline = new Date(Date.now() + BAN_TIMEOUT_MS)
  await prisma.pugBanState.update({
    where: { lobbyId },
    data: {
      banNumber: banState.banNumber + 1,
      currentBanTeam: nextTeam,
      banDeadline: newDeadline,
    },
  })
  registerTimer(timerKey(lobbyId, 'ban'), BAN_TIMEOUT_MS, () => finalizeBan(lobbyId))
}

async function advanceToInProgress(lobbyId: number): Promise<void> {
  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'IN_PROGRESS' } })

  const players = await prisma.pugLobbyPlayer.findMany({ where: { lobbyId } })
  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })
  const payloadInst = await getPayload({ config: configPromise })

  const allUserIds = players.map((p) => p.userId)
  const allUsers = allUserIds.length > 0
    ? await payloadInst.find({
        collection: 'users',
        where: { id: { in: allUserIds } },
        overrideAccess: true,
        limit: allUserIds.length,
      })
    : { docs: [] }
  const discordIdByUserId = new Map(
    (allUsers.docs as any[]).map((u: any) => [u.id, u.discordId ?? '']),
  )

  const team1Ids = players.filter((p) => p.team === 1).map((p) => discordIdByUserId.get(p.userId) ?? '').filter(Boolean)
  const team2Ids = players.filter((p) => p.team === 2).map((p) => discordIdByUserId.get(p.userId) ?? '').filter(Boolean)

  const { createMatchVoiceChannels } = await import('@/discord/services/pugVoice')
  const { team1ChannelId, team2ChannelId } = await createMatchVoiceChannels(
    lobby.lobbyNumber,
    team1Ids,
    team2Ids,
  )

  if (team1ChannelId || team2ChannelId) {
    await prisma.pugLobby.update({
      where: { id: lobbyId },
      data: { voiceChannel1Id: team1ChannelId || null, voiceChannel2Id: team2ChannelId || null },
    })
  }

  const { updateLobbyFeed } = await import('@/discord/services/pugFeed')
  await updateLobbyFeed(lobbyId).catch(console.error)

  if (team1ChannelId || team2ChannelId) {
    const { sendDm } = await import('@/discord/services/pugNotifications')
    const guildId = process.env.DISCORD_GUILD_ID ?? ''
    const lobbyUrl = `https://elmt.gg/pugs/lobby/${lobbyId}`
    const channelUrl = (id: string) => `https://discord.com/channels/${guildId}/${id}`

    const notifyTeam = async (teamNum: 1 | 2, channelId: string | null) => {
      const voiceLine = channelId ? `\nVoice channel: ${channelUrl(channelId)}` : ''
      const msg = `Your PUG #${lobby.lobbyNumber} match is starting! You're on Team ${teamNum}.${voiceLine}\nLobby: ${lobbyUrl}`
      const teamPlayers = players.filter((p) => p.team === teamNum)
      for (const p of teamPlayers) {
        const discordId = discordIdByUserId.get(p.userId)
        if (discordId) await sendDm(discordId, msg).catch(console.error)
      }
    }

    await Promise.all([
      notifyTeam(1, team1ChannelId),
      notifyTeam(2, team2ChannelId),
    ]).catch(console.error)
  }

  registerTimer(timerKey(lobbyId, 'voice_cleanup'), VOICE_CLEANUP_TIMEOUT_MS, async () => {
    const updatedLobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
    if (updatedLobby?.voiceChannel1Id || updatedLobby?.voiceChannel2Id) {
      const { deleteMatchVoiceChannels } = await import('@/discord/services/pugVoice')
      await deleteMatchVoiceChannels(
        updatedLobby.voiceChannel1Id ?? '',
        updatedLobby.voiceChannel2Id ?? '',
      ).catch(console.error)
    }
  })
}

export async function reportResult(
  lobbyId: number,
  captainUserId: number,
  result: 'team1' | 'team2' | 'draw',
): Promise<void> {
  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })
  if (lobby.status !== 'IN_PROGRESS') throw new Error('Match is not in progress')

  const captain = await prisma.pugLobbyPlayer.findFirst({
    where: { lobbyId, userId: captainUserId, isCaptain: true },
  })
  if (!captain) throw new Error('Only captains can report results')

  const updated = await prisma.pugLobby.updateMany({
    where: { id: lobbyId, status: 'IN_PROGRESS' },
    data: {
      status: 'REPORTING',
      reportingAt: new Date(),
      pendingResult: { result, reportedBy: captainUserId },
    },
  })
  if (updated.count === 0) throw new Error('Match is not in progress or was already reported')

  registerTimer(timerKey(lobbyId, 'confirm'), RESULT_CONFIRM_TIMEOUT_MS, () =>
    autoConfirmResult(lobbyId),
  )

  const otherCaptain = await prisma.pugLobbyPlayer.findFirst({
    where: { lobbyId, isCaptain: true, userId: { not: captainUserId } },
  })
  if (otherCaptain) {
    const payload = await getPayload({ config: configPromise })
    const otherUser = await payload.findByID({ collection: 'users', id: otherCaptain.userId, overrideAccess: true }) as any
    if (otherUser?.discordId) {
      const resultText = result === 'team1' ? 'Team 1 Won' : result === 'team2' ? 'Team 2 Won' : 'Draw'
      const { sendDm } = await import('@/discord/services/pugNotifications')
      sendDm(otherUser.discordId, `PUG #${lobby.lobbyNumber} result reported: **${resultText}**. Confirm or dispute at: https://elmt.gg/pugs/lobby/${lobbyId}\nAuto-confirms in 2 minutes.`).catch(console.error)
    }
  }
}

export async function confirmResult(lobbyId: number, captainUserId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })
  if (lobby.status !== 'REPORTING') throw new Error('No pending result')

  const captain = await prisma.pugLobbyPlayer.findFirst({
    where: { lobbyId, userId: captainUserId, isCaptain: true },
  })
  if (!captain) throw new Error('Only captains can confirm results')

  const pending = (lobby.pendingResult ?? {}) as { result: MatchResult; reportedBy: number }
  if (pending.reportedBy === captainUserId) {
    throw new Error('The reporting captain cannot confirm their own result - the opposing captain must confirm')
  }

  cancelTimer(timerKey(lobbyId, 'confirm'))
  await completeMatch(lobbyId, pending.result)
}

export async function disputeResult(lobbyId: number, captainUserId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })

  const canDisputeCompleted =
    lobby.status === 'COMPLETED' &&
    lobby.completedAt &&
    Date.now() - lobby.completedAt.getTime() < DISPUTE_AFTER_COMPLETE_MS

  if (lobby.status !== 'REPORTING' && !canDisputeCompleted) {
    throw new Error('No pending result to dispute')
  }

  const captain = await prisma.pugLobbyPlayer.findFirst({
    where: { lobbyId, userId: captainUserId, isCaptain: true },
  })
  if (!captain) throw new Error('Only captains can dispute results')
  const pending = (lobby.pendingResult ?? {}) as { result: string; reportedBy: number }
  if (pending.reportedBy === captainUserId) {
    throw new Error('The reporting captain cannot dispute their own result - only the opposing captain can dispute')
  }

  if (canDisputeCompleted) {
    const snapshots = (lobby.ratingChanges ?? []) as { leaderboardId: number; before: { rating: number; ratingDeviation: number; volatility: number; wins: number; losses: number; draws: number; gamesPlayed: number } }[]
    if (snapshots.length > 0) {
      const payload = await getPayload({ config: configPromise })
      for (const snap of snapshots) {
        await payload.update({
          collection: 'pug-leaderboard',
          id: snap.leaderboardId,
          data: snap.before,
          overrideAccess: true,
        })
      }
    }
  } else {
    cancelTimer(timerKey(lobbyId, 'confirm'))
  }

  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'DISPUTED' } })
  import('@/discord/services/pugFeed').then(({ updateLobbyFeed }) => {
    updateLobbyFeed(lobbyId).catch(console.error)
  })
}

export async function autoConfirmResult(lobbyId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby || lobby.status !== 'REPORTING') return
  const pending = (lobby.pendingResult ?? {}) as { result: MatchResult }
  await completeMatch(lobbyId, pending.result)
}

export async function completeMatch(lobbyId: number, result: MatchResult): Promise<void> {
  const lobby = await prisma.pugLobby.findUniqueOrThrow({
    where: { id: lobbyId },
    include: { players: true, banState: true, mapVote: true, draftState: true },
  })

  const team1Players = lobby.players.filter((p) => p.team === 1)
  const team2Players = lobby.players.filter((p) => p.team === 2)

  if (result !== 'cancelled') {
    const payload = await getPayload({ config: configPromise })

    const fetchOrCreateLeaderboardEntry = async (userId: number): Promise<PlayerRating | null> => {
      const pugPlayerResult = await payload.find({
        collection: 'pug-players',
        where: { user: { equals: userId } },
        overrideAccess: true,
      })
      const pugPlayer = (pugPlayerResult.docs[0] as any)
      if (!pugPlayer) return null

      const lbWhere: any[] = [
        { player: { equals: pugPlayer.id } },
        { season: { equals: lobby.payloadSeasonId } },
        { tier: { equals: lobby.tier } },
      ]
      if (lobby.region) {
        lbWhere.push({ region: { equals: lobby.region } })
      }

      const lbResult = await payload.find({
        collection: 'pug-leaderboard',
        where: { and: lbWhere },
        overrideAccess: true,
      })

      if (lbResult.docs.length === 0) {
        const entry = await payload.create({
          collection: 'pug-leaderboard',
          data: {
            player: pugPlayer.id,
            season: lobby.payloadSeasonId!,
            tier: lobby.tier,
            region: (lobby.region as 'na' | 'emea' | 'pacific' | undefined) ?? undefined,
            rating: 1500,
            ratingDeviation: 350,
            volatility: 0.06,
            wins: 0,
            losses: 0,
            draws: 0,
            gamesPlayed: 0,
          },
          overrideAccess: true,
        })
        return { payloadPlayerId: (entry as any).id, rating: 1500, ratingDeviation: 350, volatility: 0.06 }
      }

      const entry = lbResult.docs[0] as any
      return {
        payloadPlayerId: entry.id,
        rating: entry.rating ?? 1500,
        ratingDeviation: entry.ratingDeviation ?? 350,
        volatility: entry.volatility ?? 0.06,
      }
    }

    const team1Ratings = (await Promise.all(team1Players.map((p) => fetchOrCreateLeaderboardEntry(p.userId)))).filter(Boolean) as PlayerRating[]
    const team2Ratings = (await Promise.all(team2Players.map((p) => fetchOrCreateLeaderboardEntry(p.userId)))).filter(Boolean) as PlayerRating[]

    const updates = calculateRatingUpdates(team1Ratings, team2Ratings, result)

    const ratingSnapshots: { leaderboardId: number; before: { rating: number; ratingDeviation: number; volatility: number; wins: number; losses: number; draws: number; gamesPlayed: number } }[] = []

    for (const update of updates) {
      const isWinner =
        (result === 'team1' && team1Ratings.some((r) => r.payloadPlayerId === update.payloadPlayerId)) ||
        (result === 'team2' && team2Ratings.some((r) => r.payloadPlayerId === update.payloadPlayerId))
      const isDraw = result === 'draw'

      const current = await payload.findByID({
        collection: 'pug-leaderboard',
        id: update.payloadPlayerId,
        overrideAccess: true,
      }) as any

      ratingSnapshots.push({
        leaderboardId: update.payloadPlayerId,
        before: {
          rating: current.rating ?? 1500,
          ratingDeviation: current.ratingDeviation ?? 350,
          volatility: current.volatility ?? 0.06,
          wins: current.wins ?? 0,
          losses: current.losses ?? 0,
          draws: current.draws ?? 0,
          gamesPlayed: current.gamesPlayed ?? 0,
        },
      })

      await payload.update({
        collection: 'pug-leaderboard',
        id: update.payloadPlayerId,
        data: {
          rating: update.rating,
          ratingDeviation: update.ratingDeviation,
          volatility: update.volatility,
          wins: (current.wins ?? 0) + (isWinner && !isDraw ? 1 : 0),
          losses: (current.losses ?? 0) + (!isWinner && !isDraw ? 1 : 0),
          draws: (current.draws ?? 0) + (isDraw ? 1 : 0),
          gamesPlayed: (current.gamesPlayed ?? 0) + 1,
        },
        overrideAccess: true,
      })
    }

    await prisma.pugLobby.update({
      where: { id: lobbyId },
      data: { ratingChanges: ratingSnapshots },
    })
  }

  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'COMPLETED', completedAt: new Date() } })
  cancelTimer(timerKey(lobbyId, 'voice_cleanup'))

  const { updateLobbyFeed, postMatchResult } = await import('@/discord/services/pugFeed')
  await updateLobbyFeed(lobbyId).catch(console.error)

  if (result !== 'cancelled') {
    const payloadInst = await getPayload({ config: configPromise })
    const allUserIds = lobby.players.map((p) => p.userId)
    const usersResult = allUserIds.length > 0
      ? await payloadInst.find({ collection: 'users', where: { id: { in: allUserIds } }, overrideAccess: true, limit: 20 })
      : { docs: [] }
    const nameMap = new Map((usersResult.docs as any[]).map((u) => [u.id, u.name || u.email]))
    const playersWithNames = lobby.players.map((p) => ({
      userId: p.userId,
      team: p.team,
      name: nameMap.get(p.userId) ?? `Player #${p.userId}`,
    }))
    await postMatchResult(lobby.tier as 'open' | 'invite', lobby.lobbyNumber, lobbyId, result, playersWithNames).catch(console.error)
  }

  // Clean up voice channels if still active
  const completedLobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (completedLobby?.voiceChannel1Id || completedLobby?.voiceChannel2Id) {
    const { deleteMatchVoiceChannels } = await import('@/discord/services/pugVoice')
    await deleteMatchVoiceChannels(
      completedLobby.voiceChannel1Id ?? '',
      completedLobby.voiceChannel2Id ?? '',
    ).catch(console.error)
    await prisma.pugLobby.update({
      where: { id: lobbyId },
      data: { voiceChannel1Id: null, voiceChannel2Id: null },
    }).catch(console.error)
  }
}

export async function cancelLobby(lobbyId: number, reason?: string): Promise<void> {
  await prisma.pugLobby.update({ where: { id: lobbyId }, data: { status: 'CANCELLED' } })
  ;['ready', 'draft', 'mapvote', 'ban', 'confirm', 'timeout', 'voice_cleanup'].forEach((phase) =>
    cancelTimer(timerKey(lobbyId, phase)),
  )

  const { updateLobbyFeed } = await import('@/discord/services/pugFeed')
  await updateLobbyFeed(lobbyId).catch(console.error)

  const cancelledLobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (cancelledLobby?.voiceChannel1Id || cancelledLobby?.voiceChannel2Id) {
    const { deleteMatchVoiceChannels } = await import('@/discord/services/pugVoice')
    await deleteMatchVoiceChannels(
      cancelledLobby.voiceChannel1Id ?? '',
      cancelledLobby.voiceChannel2Id ?? '',
    ).catch(console.error)
    await prisma.pugLobby.update({
      where: { id: lobbyId },
      data: { voiceChannel1Id: null, voiceChannel2Id: null },
    }).catch(console.error)
  }
}

export async function cancelExpiredLobby(lobbyId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby || lobby.status !== 'OPEN') return
  await cancelLobby(lobbyId, 'Time window expired without enough players')
}
