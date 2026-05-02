import prisma from '@/lib/prisma'
import { READY_CHECK_TIMEOUT_MS, RESULT_CONFIRM_TIMEOUT_MS } from './constants'

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
  const { expireReadyCheck, finalizeDraftPick, finalizeMapVote, finalizeBan, autoConfirmResult, cancelExpiredLobby } =
    await import('./lobbyStateMachine')

  const activeLobbies = await prisma.pugLobby.findMany({
    where: {
      status: { in: ['READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'REPORTING', 'OPEN'] },
    },
    include: { draftState: true, banState: true, mapVote: true },
  })

  const now = Date.now()

  for (const lobby of activeLobbies) {
    if (lobby.status === 'DRAFTING') {
      if (lobby.draftState?.pickDeadline) {
        const delay = new Date(lobby.draftState.pickDeadline).getTime() - now
        if (delay > 0) {
          registerTimer(timerKey(lobby.id, 'draft'), delay, () => finalizeDraftPick(lobby.id))
        } else {
          await finalizeDraftPick(lobby.id).catch(console.error)
        }
      } else {
        // No active pick deadline: last pick was processed but MAP_VOTE transition didn't complete before restart
        await finalizeDraftPick(lobby.id).catch(console.error)
      }
    }

    if (lobby.status === 'MAP_VOTE' && lobby.mapVote?.voteDeadline) {
      const delay = new Date(lobby.mapVote.voteDeadline).getTime() - now
      if (delay > 0) {
        registerTimer(timerKey(lobby.id, 'mapvote'), delay, () => finalizeMapVote(lobby.id))
      } else {
        await finalizeMapVote(lobby.id).catch(console.error)
      }
    }

    if (lobby.status === 'BANNING' && lobby.banState?.banDeadline) {
      const delay = new Date(lobby.banState.banDeadline).getTime() - now
      if (delay > 0) {
        registerTimer(timerKey(lobby.id, 'ban'), delay, () => finalizeBan(lobby.id))
      } else {
        await finalizeBan(lobby.id).catch(console.error)
      }
    }

    if (lobby.status === 'OPEN' && lobby.timeoutAt) {
      const delay = new Date(lobby.timeoutAt).getTime() - now
      if (delay > 0) {
        registerTimer(timerKey(lobby.id, 'timeout'), delay, () => cancelExpiredLobby(lobby.id))
      } else {
        await cancelExpiredLobby(lobby.id).catch(console.error)
      }
    }

    if (lobby.status === 'READY') {
      const baseline = lobby.readyAt ?? lobby.updatedAt
      const readyDelay = baseline.getTime() + READY_CHECK_TIMEOUT_MS - now
      if (readyDelay > 0) {
        registerTimer(timerKey(lobby.id, 'ready'), readyDelay, () => expireReadyCheck(lobby.id))
      } else {
        await expireReadyCheck(lobby.id).catch(console.error)
      }
    }

    if (lobby.status === 'REPORTING') {
      const baseline = lobby.reportingAt ?? lobby.updatedAt
      const confirmDelay = baseline.getTime() + RESULT_CONFIRM_TIMEOUT_MS - now
      if (confirmDelay > 0) {
        registerTimer(timerKey(lobby.id, 'confirm'), confirmDelay, () => autoConfirmResult(lobby.id))
      } else {
        await autoConfirmResult(lobby.id).catch(console.error)
      }
    }
  }
}
