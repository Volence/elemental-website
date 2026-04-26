'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Lobby = {
  id: number
  lobbyNumber: number
  status: string
  players: Array<{ userId: number }>
}

type Props = {
  currentUser: { id: number; name?: string | null; email?: string } | null
  isRegistered: boolean
  isPugAdmin: boolean
  seasonId: number | null
  seasonName: string | null
}

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

export default function OpenPageContent({ currentUser, isRegistered, isPugAdmin, seasonId, seasonName }: Props) {
  const router = useRouter()
  const [lobbies, setLobbies] = useState<Lobby[]>([])
  const [loadingLobbies, setLoadingLobbies] = useState(true)
  const [creating, setCreating] = useState(false)
  const [joiningId, setJoiningId] = useState<number | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [roleError, setRoleError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchLobbies = useCallback(async () => {
    try {
      const res = await fetch('/api/pug/lobby?tier=open')
      if (res.ok) {
        const data = await res.json()
        setLobbies(data.lobbies ?? [])
      }
    } finally {
      setLoadingLobbies(false)
    }
  }, [])

  useEffect(() => {
    fetchLobbies()
    const interval = setInterval(fetchLobbies, 5000)
    return () => clearInterval(interval)
  }, [fetchLobbies])

  async function handleCreate() {
    if (!seasonId) return
    setCreating(true)
    setActionError(null)
    try {
      const res = await fetch('/api/pug/lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payloadSeasonId: seasonId }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/pugs/lobby/${data.lobby.id}`)
      } else {
        setActionError(data.error || 'Failed to create lobby')
      }
    } catch {
      setActionError('Failed to create lobby')
    } finally {
      setCreating(false)
    }
  }

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
    setRoleError(null)
  }

  async function handleJoin(lobbyId: number) {
    if (selectedRoles.length === 0) {
      setRoleError('Select at least one role')
      return
    }
    setActionError(null)
    try {
      const res = await fetch(`/api/pug/lobby/${lobbyId}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: selectedRoles }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/pugs/lobby/${lobbyId}`)
      } else {
        setActionError(data.error || 'Failed to join lobby')
      }
    } catch {
      setActionError('Failed to join lobby')
    }
  }

  const openLobbies = lobbies.filter((l) => l.status === 'OPEN')
  const activeLobbies = lobbies.filter((l) => l.status !== 'OPEN')
  const myLobbyId = lobbies.find((l) => l.players.some((p) => p.userId === currentUser?.id))?.id

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Open Tier PUGs</h1>
          {seasonName && <p className="text-sm text-gray-500 mt-0.5">{seasonName}</p>}
        </div>
        {currentUser && isRegistered && seasonId && (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {creating ? 'Creating…' : 'Create Lobby'}
          </button>
        )}
      </div>

      {!currentUser && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 mb-6 text-sm text-gray-400">
          <Link href="/pugs/register" className="text-blue-400 hover:underline">
            Sign in with Discord
          </Link>{' '}
          to create or join lobbies.
        </div>
      )}

      {currentUser && !isRegistered && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 mb-6 text-sm text-gray-400">
          You need to{' '}
          <Link href="/pugs/register" className="text-blue-400 hover:underline">
            register for Open Tier
          </Link>{' '}
          before joining or creating lobbies.
        </div>
      )}

      {!seasonId && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 mb-6 text-sm text-yellow-400">
          No active Open Tier season right now.
          {isPugAdmin && (
            <span>
              {' '}
              <a
                href="/admin/collections/pug-seasons/create"
                className="underline hover:text-yellow-200"
              >
                Create a season
              </a>{' '}
              to enable lobbies.
            </span>
          )}
        </div>
      )}

      {actionError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6 text-sm text-red-400">
          {actionError}
        </div>
      )}

      {myLobbyId && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3 mb-6 flex items-center justify-between">
          <span className="text-sm text-blue-300">You are in an active lobby.</span>
          <Link
            href={`/pugs/lobby/${myLobbyId}`}
            className="text-sm font-medium text-blue-400 hover:underline"
          >
            View Lobby →
          </Link>
        </div>
      )}

      {loadingLobbies ? (
        <p className="text-gray-500 text-sm">Loading lobbies…</p>
      ) : lobbies.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-1">No active lobbies right now.</p>
          {currentUser && isRegistered && seasonId && (
            <p className="text-sm">
              Be the first — hit{' '}
              <button
                onClick={handleCreate}
                disabled={creating}
                className="text-blue-400 hover:underline disabled:opacity-50"
              >
                Create Lobby
              </button>{' '}
              to start one.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {openLobbies.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Accepting Players
              </h2>
              <div className="space-y-3">
                {openLobbies.map((lobby) => (
                  <LobbyCard
                    key={lobby.id}
                    lobby={lobby}
                    currentUserId={currentUser?.id ?? null}
                    isRegistered={isRegistered}
                    isExpanded={joiningId === lobby.id}
                    selectedRoles={selectedRoles}
                    roleError={roleError}
                    onToggleJoin={() => {
                      setJoiningId(joiningId === lobby.id ? null : lobby.id)
                      setSelectedRoles([])
                      setRoleError(null)
                      setActionError(null)
                    }}
                    onToggleRole={toggleRole}
                    onJoin={() => handleJoin(lobby.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {activeLobbies.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-6">
                In Progress
              </h2>
              <div className="space-y-3">
                {activeLobbies.map((lobby) => (
                  <LobbyCard
                    key={lobby.id}
                    lobby={lobby}
                    currentUserId={currentUser?.id ?? null}
                    isRegistered={isRegistered}
                    isExpanded={false}
                    selectedRoles={[]}
                    roleError={null}
                    onToggleJoin={() => {}}
                    onToggleRole={() => {}}
                    onJoin={() => {}}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  )
}

type LobbyCardProps = {
  lobby: Lobby
  currentUserId: number | null
  isRegistered: boolean
  isExpanded: boolean
  selectedRoles: string[]
  roleError: string | null
  onToggleJoin: () => void
  onToggleRole: (role: string) => void
  onJoin: () => void
}

function LobbyCard({
  lobby,
  currentUserId,
  isRegistered,
  isExpanded,
  selectedRoles,
  roleError,
  onToggleJoin,
  onToggleRole,
  onJoin,
}: LobbyCardProps) {
  const meta = STATUS_META[lobby.status] ?? { label: lobby.status, color: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' }
  const playerCount = lobby.players.length
  const isInThisLobby = currentUserId !== null && lobby.players.some((p) => p.userId === currentUserId)
  const isOpen = lobby.status === 'OPEN'

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold">PUG #{lobby.lobbyNumber}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{playerCount}/10</span>
          {isInThisLobby ? (
            <Link
              href={`/pugs/lobby/${lobby.id}`}
              className="text-sm text-blue-400 hover:underline font-medium"
            >
              View →
            </Link>
          ) : isOpen && isRegistered ? (
            <button
              onClick={onToggleJoin}
              className="text-sm px-3 py-1 border border-gray-600 hover:border-blue-500 hover:text-blue-400 rounded transition-colors"
            >
              {isExpanded ? 'Cancel' : 'Join'}
            </button>
          ) : (
            <Link
              href={`/pugs/lobby/${lobby.id}`}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              View
            </Link>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-700 px-4 py-3 bg-gray-900/50">
          <p className="text-xs text-gray-400 mb-2 font-medium">Select your roles (pick all that apply)</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {ROLES.map((role) => (
              <button
                key={role.value}
                onClick={() => onToggleRole(role.value)}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                  selectedRoles.includes(role.value)
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
          {roleError && <p className="text-xs text-red-400 mb-2">{roleError}</p>}
          <button
            onClick={onJoin}
            disabled={selectedRoles.length === 0}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
          >
            Join Lobby
          </button>
        </div>
      )}
    </div>
  )
}
