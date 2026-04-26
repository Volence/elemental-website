import { describe, it, expect } from 'vitest'
import prisma from '../../src/lib/prisma'

describe('PUG Prisma models', () => {
  it('can create and read a PugLobby record', async () => {
    const lobby = await prisma.pugLobby.create({
      data: {
        lobbyNumber: 9999,
        tier: 'open',
        status: 'OPEN',
      },
    })
    expect(lobby.id).toBeDefined()
    expect(lobby.status).toBe('OPEN')
    await prisma.pugLobby.delete({ where: { id: lobby.id } })
  })

  it('can create a PugLobbyPlayer linked to a lobby', async () => {
    const lobby = await prisma.pugLobby.create({
      data: { lobbyNumber: 9998, tier: 'open', status: 'OPEN' },
    })
    const player = await prisma.pugLobbyPlayer.create({
      data: { lobbyId: lobby.id, userId: 1, queuedRoles: ['tank'] },
    })
    expect(player.lobbyId).toBe(lobby.id)
    await prisma.pugLobby.delete({ where: { id: lobby.id } })
  })
})
