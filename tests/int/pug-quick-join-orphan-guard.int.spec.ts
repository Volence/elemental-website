import { describe, it, expect } from 'vitest'
import { blocksNewLobby } from '@/pug/lobbyStateMachine'

/**
 * Regression guard for 2026-09-05: two players clicked Join Queue while their previous
 * lobby was still active. Quick-join swallowed the "already in an active lobby" error
 * from every open lobby, concluded none was joinable, and minted a fresh lobby per click
 * - 17 empty lobbies in two bursts. The player who already sits in an active lobby must
 * never reach the create path.
 */
describe('blocksNewLobby', () => {
  it('allows a create when the player is in no lobby', () => {
    expect(blocksNewLobby(null)).toBe(false)
  })

  it('blocks a create while the player sits in an OPEN lobby', () => {
    expect(blocksNewLobby({ lobbyNumber: 80, status: 'OPEN', pendingResult: null })).toBe(true)
  })

  it('blocks a create while the player is mid-game', () => {
    expect(blocksNewLobby({ lobbyNumber: 80, status: 'IN_PROGRESS', pendingResult: null })).toBe(true)
  })

  it('blocks a create while a finished game still awaits its result', () => {
    expect(blocksNewLobby({ lobbyNumber: 80, status: 'REPORTING', pendingResult: null })).toBe(true)
  })

  // The window Blue and koopa01 were stuck in. Once someone reports the score the game is
  // over bar the confirmation, so queuing for the next one must work - joinLobby has always
  // allowed this and the create guard must not be stricter than the join guard.
  it('allows a create once the result is reported and only confirmation is pending', () => {
    expect(
      blocksNewLobby({ lobbyNumber: 80, status: 'REPORTING', pendingResult: { reportedBy: 42 } }),
    ).toBe(false)
  })

  // 2026-09-24, PUG #129: a disputed game had ended, but the Open page counted the
  // DISPUTED lobby as the player's current one and hid Quick Join for all ten players.
  it('allows a create while the previous game is disputed', () => {
    expect(
      blocksNewLobby({ lobbyNumber: 129, status: 'DISPUTED', pendingResult: { result: 'team1', reportedBy: 42 } }),
    ).toBe(false)
  })

  it('allows a create once the previous game is completed or cancelled', () => {
    expect(blocksNewLobby({ lobbyNumber: 80, status: 'COMPLETED', pendingResult: null })).toBe(false)
    expect(blocksNewLobby({ lobbyNumber: 80, status: 'CANCELLED', pendingResult: null })).toBe(false)
  })
})
