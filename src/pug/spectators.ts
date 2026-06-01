import prisma from '@/lib/prisma'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { inviteSpectator, botConfigured } from './botClient'

export type SpectatorInviteAction = 'INVITE_NOW' | 'PENDING_IN_GAME' | 'KEEP_PENDING'

const INVITABLE_STATUSES = ['lobby_created', 'invites_sent', 'players_joining']
const IN_GAME_STATUSES = ['game_started', 'game_ended']

// Decide what to do with a spectator given the bot's current state.
// INVITE_NOW: OW lobby is up and match not started, and we have an instance to call.
// PENDING_IN_GAME: match is live/ended - bot cannot invite without in-game OCR (out of scope).
// KEEP_PENDING: no lobby yet, or still setting up - invite later when it becomes invitable.
export function decideSpectatorInvite(
  botStatus: string | null,
  botInstanceId: string | null,
): SpectatorInviteAction {
  if (botStatus && IN_GAME_STATUSES.includes(botStatus)) return 'PENDING_IN_GAME'
  if (botInstanceId && botStatus && INVITABLE_STATUSES.includes(botStatus)) return 'INVITE_NOW'
  return 'KEEP_PENDING'
}

export { INVITABLE_STATUSES }

export type EnrichedSpectator = {
  id: number
  battleTag: string
  personId: number | null
  displayName: string
  status: string
  note: string | null
}

const TAG_RE = /^[^#]{1,32}#\d{3,}$/

export function normalizeBattleTag(raw: string): string | null {
  const tag = raw.trim()
  return TAG_RE.test(tag) ? tag : null
}

// Resolve a personId to their stored pugBattleTag. Returns null if no tag on file.
async function tagForPerson(personId: number): Promise<string | null> {
  const payload = await getPayload({ config: configPromise })
  const person = (await payload.findByID({
    collection: 'people',
    id: personId,
    overrideAccess: true,
  })) as any
  return person?.pugBattleTag ?? null
}

export async function enrichSpectators(lobbyId: number): Promise<EnrichedSpectator[]> {
  const rows = await prisma.pugLobbySpectator.findMany({
    where: { lobbyId },
    orderBy: { addedAt: 'asc' },
  })
  const personIds = rows.map((r) => r.personId).filter((x): x is number => x != null)
  const nameMap: Record<number, string> = {}
  if (personIds.length > 0) {
    const payload = await getPayload({ config: configPromise })
    const people = await payload.find({
      collection: 'people',
      where: { id: { in: personIds } },
      limit: personIds.length,
      overrideAccess: true,
    })
    for (const p of people.docs as any[]) nameMap[p.id] = p.name || 'Anonymous'
  }
  return rows.map((r) => ({
    id: r.id,
    battleTag: r.battleTag,
    personId: r.personId,
    displayName: r.personId ? (nameMap[r.personId] ?? r.battleTag) : r.battleTag,
    status: r.status,
    note: r.note,
  }))
}

// Invite all PENDING spectators for a lobby (used by the status webhook and after add).
export async function invitePendingSpectators(lobbyId: number): Promise<void> {
  if (!botConfigured()) return
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby?.botInstanceId) return
  const pending = await prisma.pugLobbySpectator.findMany({ where: { lobbyId, status: 'PENDING' } })
  for (const s of pending) {
    try {
      const res = await inviteSpectator(lobby.botInstanceId, s.battleTag)
      if (res.ok) {
        await prisma.pugLobbySpectator.update({
          where: { id: s.id },
          data: { status: 'INVITED', invitedAt: new Date(), note: null },
        })
      } else {
        const text = await res.text().catch(() => '')
        await prisma.pugLobbySpectator.update({
          where: { id: s.id },
          data: { status: 'FAILED', note: `Bot error: ${text}`.slice(0, 300) },
        })
      }
    } catch (err: any) {
      await prisma.pugLobbySpectator.update({
        where: { id: s.id },
        data: { status: 'FAILED', note: (err?.message ?? 'invite failed').slice(0, 300) },
      })
    }
  }
}

export type AddSpectatorInput = { battleTag?: string; personId?: number; addedByUserId?: number }
export type AddSpectatorResult =
  | { ok: true; spectators: EnrichedSpectator[] }
  | { ok: false; error: string; status: number }

export async function addSpectator(
  lobbyId: number,
  input: AddSpectatorInput,
): Promise<AddSpectatorResult> {
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby) return { ok: false, error: 'Lobby not found', status: 404 }

  // Resolve the BattleTag.
  let rawTag = input.battleTag ?? null
  let personId: number | null = input.personId ?? null
  if (personId != null && !rawTag) {
    rawTag = await tagForPerson(personId)
    if (!rawTag) {
      return { ok: false, error: 'This person has no Battle Tag on file - enter one manually', status: 400 }
    }
  }
  const tag = rawTag ? normalizeBattleTag(rawTag) : null
  if (!tag) return { ok: false, error: 'A valid BattleTag (Name#1234) is required', status: 400 }

  // Read the prior status before upserting so a re-add of an already-INVITED spectator
  // does not re-fire the bot call (a duplicate invite the bot may reject would wrongly
  // flip the row to FAILED). A duplicate is otherwise a no-op refresh.
  const existing = await prisma.pugLobbySpectator.findUnique({
    where: { lobbyId_battleTag: { lobbyId, battleTag: tag } },
    select: { status: true },
  })
  await prisma.pugLobbySpectator.upsert({
    where: { lobbyId_battleTag: { lobbyId, battleTag: tag } },
    create: { lobbyId, battleTag: tag, personId, addedByUserId: input.addedByUserId, status: 'PENDING' },
    update: {},
  })

  // Decide and act.
  const action = decideSpectatorInvite(lobby.botStatus, lobby.botInstanceId)
  if (action === 'INVITE_NOW' && lobby.botInstanceId && existing?.status !== 'INVITED') {
    try {
      const res = await inviteSpectator(lobby.botInstanceId, tag)
      if (res.ok) {
        await prisma.pugLobbySpectator.update({
          where: { lobbyId_battleTag: { lobbyId, battleTag: tag } },
          data: { status: 'INVITED', invitedAt: new Date(), note: null },
        })
      } else {
        const text = await res.text().catch(() => '')
        await prisma.pugLobbySpectator.update({
          where: { lobbyId_battleTag: { lobbyId, battleTag: tag } },
          data: { status: 'FAILED', note: `Bot error: ${text}`.slice(0, 300) },
        })
      }
    } catch (err: any) {
      await prisma.pugLobbySpectator.update({
        where: { lobbyId_battleTag: { lobbyId, battleTag: tag } },
        data: { status: 'FAILED', note: (err?.message ?? 'invite failed').slice(0, 300) },
      })
    }
  } else if (action === 'PENDING_IN_GAME') {
    await prisma.pugLobbySpectator.update({
      where: { lobbyId_battleTag: { lobbyId, battleTag: tag } },
      data: { note: 'Match is live - in-game spectator invite needs OCR (not yet supported). Will stay pending.' },
    })
  }

  return { ok: true, spectators: await enrichSpectators(lobbyId) }
}

export async function removeSpectator(
  lobbyId: number,
  by: { id?: number; battleTag?: string },
): Promise<EnrichedSpectator[]> {
  if (by.id != null) {
    await prisma.pugLobbySpectator.deleteMany({ where: { lobbyId, id: by.id } })
  } else if (by.battleTag) {
    await prisma.pugLobbySpectator.deleteMany({ where: { lobbyId, battleTag: by.battleTag } })
  }
  return enrichSpectators(lobbyId)
}
