'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const ROLES = [
  { value: 'tank', label: 'Tank' },
  { value: 'flex_dps', label: 'Flex DPS' },
  { value: 'hitscan_dps', label: 'Hitscan DPS' },
  { value: 'flex_support', label: 'Flex Support' },
  { value: 'main_support', label: 'Main Support' },
]

const STATUS_META: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Open', color: 'bg-green-500/20 text-green-400 border border-green-500/30' },
  READY: { label: 'Ready', color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
  DRAFTING: { label: 'Drafting', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  MAP_VOTE: { label: 'Map Vote', color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
  BANNING: { label: 'Banning', color: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' },
  REPORTING: { label: 'Reporting', color: 'bg-pink-500/20 text-pink-400 border border-pink-500/30' },
}

type LobbyData = {
  id: number
  lobbyNumber: number
  status: string
  players: Array<{ userId: number; name?: string; avatarUrl?: string | null }>
  neededSlots: Record<string, number> | null
  spotsAvailable: Record<string, number>
}

type QueueStatus = {
  inQueue: boolean
  placed?: boolean
  lobbyId?: number
  position?: number
  total?: number
  roles?: string[]
  currentUserId?: number
  registeredForTier?: boolean
  registeredForRegion?: boolean
  approvedRoles?: string[]
}

type Props = {
  region: string
  queueActive: boolean
}

export function InviteQueuePanel({ region, queueActive }: Props) {
  const router = useRouter()
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [lobbies, setLobbies] = useState<LobbyData[]>([])
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRoles, setShowRoles] = useState(false)

  const fetchState = useCallback(async () => {
    try {
      const [lobbyRes, queueRes] = await Promise.all([
        fetch(`/api/pug/lobby?tier=invite&region=${region}`),
        fetch(`/api/pug/queue?tier=invite&region=${region}`),
      ])
      if (lobbyRes.ok) {
        const data = await lobbyRes.json()
        setLobbies(data.lobbies ?? [])
      }
      if (queueRes.ok) {
        const data = await queueRes.json()
        setQueueStatus(data)
        if (data.placed && data.lobbyId) {
          router.push(`/pugs/lobby/${data.lobbyId}`)
        }
      }
    } catch {
      // Silently retry on next interval
    }
  }, [region, router])

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 5000)
    return () => clearInterval(interval)
  }, [fetchState])

  const currentUserId = queueStatus?.currentUserId as number | undefined
  const myLobbyId = queueStatus?.placed ? queueStatus.lobbyId :
    lobbies.find((l) => currentUserId && l.players.some((p) => p.userId === currentUserId))?.id

  async function handleJoinQueue() {
    if (selectedRoles.length === 0) {
      setError('Select at least one role')
      return
    }
    setJoining(true)
    setError(null)
    try {
      const res = await fetch('/api/pug/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: selectedRoles, region, tier: 'invite' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to join queue')
        return
      }
      if (data.placed && data.lobbyId) {
        router.push(`/pugs/lobby/${data.lobbyId}`)
        return
      }
      setQueueStatus({ inQueue: true, position: data.position, total: data.total, roles: selectedRoles })
      setShowRoles(false)
    } catch {
      setError('Failed to join queue')
    } finally {
      setJoining(false)
    }
  }

  async function handleLeaveQueue() {
    try {
      await fetch('/api/pug/queue?tier=invite', { method: 'DELETE' })
      setQueueStatus({ inQueue: false })
      setShowRoles(false)
      setSelectedRoles([])
    } catch {
      setError('Failed to leave queue')
    }
  }

  const approvedRoles = queueStatus?.approvedRoles ?? null
  const canQueue = queueStatus?.registeredForTier && queueStatus?.registeredForRegion

  function toggleRole(role: string) {
    if (approvedRoles && !approvedRoles.includes(role)) return
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
    setError(null)
  }

  const openLobby = lobbies.find((l) => l.status === 'OPEN')
  const activeLobbies = lobbies.filter((l) => l.status !== 'OPEN')

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Active lobby banner - if user is in a lobby */}
      {myLobbyId && (
        <Link
          href={`/pugs/lobby/${myLobbyId}`}
          className="bg-purple-600/15 border border-purple-500/30 rounded-xl px-4 py-3 flex items-center justify-between hover:bg-purple-600/20 transition-colors group"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-sm text-purple-300 font-medium">You are in an active lobby</span>
          </div>
          <span className="text-sm font-semibold text-purple-400 group-hover:text-purple-300 transition-colors">
            View Lobby &rarr;
          </span>
        </Link>
      )}

      {/* Not registered message */}
      {queueActive && !myLobbyId && queueStatus && !canQueue && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 text-sm text-yellow-400">
          {!queueStatus.registeredForTier
            ? 'You are not registered for Invite Tier PUGs.'
            : `You are not registered for the ${region.toUpperCase()} region.`}
        </div>
      )}

      {/* Queue interface */}
      {queueActive && !myLobbyId && canQueue && (
        <div className="border border-gray-700/80 rounded-xl p-5 bg-gradient-to-b from-gray-900/80 to-gray-950/80">
          {queueStatus?.inQueue ? (
            // In queue state
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-purple-500/15 border border-purple-500/30 rounded-full px-4 py-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-sm font-medium text-purple-300">
                  In Queue - Position #{queueStatus.position ?? '?'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-1">
                {(queueStatus.total ?? 1) > 1
                  ? `${queueStatus.total} players in queue`
                  : 'Waiting for more players...'}
              </p>
              {queueStatus.roles && (
                <p className="text-xs text-gray-600 mb-4">
                  Roles: {queueStatus.roles.map((r) => ROLES.find((rl) => rl.value === r)?.label ?? r).join(', ')}
                </p>
              )}
              <button
                onClick={handleLeaveQueue}
                className="px-4 py-2 border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400 text-sm rounded-lg transition-colors"
              >
                Leave Queue
              </button>
            </div>
          ) : showRoles ? (
            // Role selection state
            <div>
              <p className="text-sm text-gray-400 mb-3 font-medium">Select your roles (pick all you can play)</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {ROLES.map((role) => {
                  const blocked = approvedRoles !== null && !approvedRoles.includes(role.value)
                  return (
                    <button
                      key={role.value}
                      onClick={() => toggleRole(role.value)}
                      disabled={blocked}
                      title={blocked ? 'Not approved for this role' : undefined}
                      className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                        blocked
                          ? 'border-gray-800 text-gray-600 cursor-not-allowed'
                          : selectedRoles.includes(role.value)
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400'
                      }`}
                    >
                      {role.label}{blocked ? ' (N/A)' : ''}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleJoinQueue}
                  disabled={joining || selectedRoles.length === 0}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {joining ? 'Joining...' : 'Join Queue'}
                </button>
                <button
                  onClick={() => { setShowRoles(false); setSelectedRoles([]) }}
                  className="px-4 py-2.5 border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400 text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // Default state - show join button
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-3">
                Join the queue and we will place you in a lobby automatically.
              </p>
              <button
                onClick={() => setShowRoles(true)}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Join Queue
              </button>
            </div>
          )}
        </div>
      )}

      {/* Current lobby status */}
      {openLobby && (
        <div className="border border-gray-700/80 rounded-xl p-4 bg-gradient-to-b from-gray-900/80 to-gray-950/80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-gray-100">PUG #{openLobby.lobbyNumber}</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_META.OPEN.color}`}>
                Filling
              </span>
            </div>
            <span className="text-xs text-gray-400 font-medium tabular-nums">
              {openLobby.players.length}/10
            </span>
          </div>
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                openLobby.players.length >= 10 ? 'bg-green-500' : 'bg-purple-500/70'
              }`}
              style={{ width: `${(openLobby.players.length / 10) * 100}%` }}
            />
          </div>
          {openLobby.players.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex -space-x-2">
                {openLobby.players.slice(0, 10).map((p) => (
                  <div
                    key={p.userId}
                    title={p.name || `Player #${p.userId}`}
                    className="w-6 h-6 rounded-full border-2 border-gray-900 bg-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-300 uppercase overflow-hidden shrink-0"
                  >
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (p.name || '?')[0]
                    )}
                  </div>
                ))}
              </div>
              {openLobby.players.length < 10 && (
                <span className="text-xs text-gray-500">{10 - openLobby.players.length} more needed</span>
              )}
            </div>
          )}
          {openLobby.spotsAvailable && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ROLES.filter((r) => (openLobby.spotsAvailable[r.value] ?? 0) > 0).map((r) => (
                <span key={r.value} className="text-[11px] px-2 py-0.5 rounded-full border border-gray-600 text-gray-400">
                  {openLobby.spotsAvailable[r.value]}x {r.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active lobbies (beyond OPEN) */}
      {activeLobbies.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">In Progress</h3>
          <div className="space-y-2">
            {activeLobbies.map((lobby) => {
              const meta = STATUS_META[lobby.status] ?? { label: lobby.status, color: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' }
              return (
                <Link
                  key={lobby.id}
                  href={`/pugs/lobby/${lobby.id}`}
                  className="block border border-gray-700/80 rounded-xl p-3 bg-gradient-to-b from-gray-900/80 to-gray-950/80 hover:border-gray-600 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-100">PUG #{lobby.lobbyNumber}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
                    </div>
                    <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors">View &rarr;</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
