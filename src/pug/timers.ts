import prisma from '@/lib/prisma'
import { READY_CHECK_TIMEOUT_MS, RESULT_CONFIRM_TIMEOUT_MS, AFK_TIMEOUT_MS } from './constants'

type TimerCallback = () => Promise<void>

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function registerTimer(key: string, delayMs: number, callback: TimerCallback): void {
  cancelTimer(key)
  const handle = setTimeout(async () => {
    activeTimers.delete(key)
    try {
      await callback()
    } catch (err) {
      console.error(`[PUG Timer] ${key} callback failed:`, err)
    }
  }, delayMs)
  activeTimers.set(key, handle)
}

export function cancelTimer(key: string): void {
  const handle = activeTimers.get(key)
  if (handle) {
    clearTimeout(handle)
    activeTimers.delete(key)
  }
}

export function timerKey(lobbyId: number, phase: string): string {
  return `pug:${lobbyId}:${phase}`
}

export async function recoverTimers(): Promise<void> {
  const { expireReadyCheck, finalizeDraftPick, finalizeMapVote, finalizeBan, autoConfirmResult, cancelExpiredLobby, afkBootPlayer } =
    await import('./lobbyStateMachine')

  const activeLobbies = await prisma.pugLobby.findMany({
    where: {
      status: { in: ['READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'REPORTING', 'OPEN'] },
    },
    include: { draftState: true, banState: true, mapVote: true, players: true },
  })

  const now = Date.now()
  // Expired timers use a short delay instead of running immediately because
  // this runs inside onInit and the callbacks call getPayload() which waits
  // for onInit to finish, creating a deadlock if awaited directly.
  const EXPIRED_DELAY = 5000

  for (const lobby of activeLobbies) {
    if (lobby.status === 'DRAFTING') {
      const deadline = lobby.draftState?.pickDeadline
        ? new Date(lobby.draftState.pickDeadline).getTime() - now
        : -1
      registerTimer(timerKey(lobby.id, 'draft'), Math.max(deadline, EXPIRED_DELAY), () => finalizeDraftPick(lobby.id))
    }

    if (lobby.status === 'MAP_VOTE' && lobby.mapVote?.voteDeadline) {
      const delay = new Date(lobby.mapVote.voteDeadline).getTime() - now
      registerTimer(timerKey(lobby.id, 'mapvote'), Math.max(delay, EXPIRED_DELAY), () => finalizeMapVote(lobby.id))
    }

    if (lobby.status === 'BANNING' && lobby.banState?.banDeadline) {
      const delay = new Date(lobby.banState.banDeadline).getTime() - now
      registerTimer(timerKey(lobby.id, 'ban'), Math.max(delay, EXPIRED_DELAY), () => finalizeBan(lobby.id))
    }

    if (lobby.status === 'OPEN' && lobby.timeoutAt) {
      const delay = new Date(lobby.timeoutAt).getTime() - now
      registerTimer(timerKey(lobby.id, 'timeout'), Math.max(delay, EXPIRED_DELAY), () => cancelExpiredLobby(lobby.id))
    }

    if (lobby.status === 'OPEN') {
      for (const player of lobby.players) {
        const delay = player.joinedAt.getTime() + AFK_TIMEOUT_MS - now
        registerTimer(timerKey(lobby.id, `afk_${player.userId}`), Math.max(delay, EXPIRED_DELAY), () => afkBootPlayer(lobby.id, player.userId))
      }
    }

    if (lobby.status === 'READY') {
      const baseline = lobby.readyAt ?? lobby.updatedAt
      const delay = baseline.getTime() + READY_CHECK_TIMEOUT_MS - now
      registerTimer(timerKey(lobby.id, 'ready'), Math.max(delay, EXPIRED_DELAY), () => expireReadyCheck(lobby.id))
    }

    if (lobby.status === 'REPORTING') {
      const baseline = lobby.reportingAt ?? lobby.updatedAt
      const delay = baseline.getTime() + RESULT_CONFIRM_TIMEOUT_MS - now
      registerTimer(timerKey(lobby.id, 'confirm'), Math.max(delay, EXPIRED_DELAY), () => autoConfirmResult(lobby.id))
    }
  }
}
