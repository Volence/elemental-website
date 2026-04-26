import { describe, it, expect, afterEach } from 'vitest'
import prisma from '../../src/lib/prisma'

describe('PUG Prisma models', () => {
  let lobbyId: number | undefined

  afterEach(async () => {
    if (lobbyId) {
      await prisma.pugLobby.delete({ where: { id: lobbyId } }).catch(() => {})
      lobbyId = undefined
    }
  })

  it('can create and read a PugLobby record', async () => {
    const lobby = await prisma.pugLobby.create({
      data: {
        lobbyNumber: 9999,
        tier: 'open',
        status: 'OPEN',
      },
    })
    lobbyId = lobby.id
    expect(lobby.id).toBeDefined()
    expect(lobby.status).toBe('OPEN')
  })

  it('can create a PugLobbyPlayer linked to a lobby', async () => {
    const lobby = await prisma.pugLobby.create({
      data: { lobbyNumber: 9998, tier: 'open', status: 'OPEN' },
    })
    lobbyId = lobby.id
    const player = await prisma.pugLobbyPlayer.create({
      data: { lobbyId: lobby.id, userId: 1, queuedRoles: ['tank'] },
    })
    expect(player.lobbyId).toBe(lobby.id)
  })

  it('can create a PugDraftState linked to a lobby', async () => {
    const lobby = await prisma.pugLobby.create({
      data: { lobbyNumber: 9997, tier: 'open', status: 'DRAFTING' },
    })
    lobbyId = lobby.id
    const draft = await prisma.pugDraftState.create({
      data: {
        lobbyId: lobby.id,
        captain1Id: 1,
        captain2Id: 2,
        captainRole: 'tank',
      },
    })
    expect(draft.lobbyId).toBe(lobby.id)
    expect(draft.picks).toEqual([])
    expect(draft.currentPickTeam).toBe(1)
  })

  it('can create a PugBanState linked to a lobby', async () => {
    const lobby = await prisma.pugLobby.create({
      data: { lobbyNumber: 9996, tier: 'open', status: 'BANNING' },
    })
    lobbyId = lobby.id
    const ban = await prisma.pugBanState.create({
      data: { lobbyId: lobby.id },
    })
    expect(ban.lobbyId).toBe(lobby.id)
    expect(ban.bans).toEqual([])
    expect(ban.currentBanTeam).toBe(2)
  })

  it('can create a PugMapVote linked to a lobby', async () => {
    const lobby = await prisma.pugLobby.create({
      data: { lobbyNumber: 9995, tier: 'open', status: 'MAP_VOTE' },
    })
    lobbyId = lobby.id
    const mapVote = await prisma.pugMapVote.create({
      data: {
        lobbyId: lobby.id,
        candidates: [1, 2, 3],
        voteDeadline: new Date(Date.now() + 60000),
      },
    })
    expect(mapVote.lobbyId).toBe(lobby.id)
    expect(mapVote.votes).toEqual({})
    expect(mapVote.candidates).toEqual([1, 2, 3])
  })
})

describe('PUG Payload API routes', () => {
  it('GET /api/pug-seasons returns 401 without auth', async () => {
    const res = await fetch('http://localhost:3000/api/pug-seasons')
    // Payload 3.x returns 403 for access-denied (unauthenticated read on authenticated-only collection)
    expect([401, 403]).toContain(res.status)
  })

  it('GET /api/pug-players returns 401 without auth', async () => {
    const res = await fetch('http://localhost:3000/api/pug-players')
    expect([401, 403]).toContain(res.status)
  })
})
