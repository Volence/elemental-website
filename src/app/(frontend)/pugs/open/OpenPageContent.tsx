'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type LobbyPlayer = {
  userId: number
  name?: string
  avatarUrl?: string | null
  team?: number | null
  assignedRole?: string | null
  queuedRoles?: string[]
  isCaptain?: boolean
}

type Lobby = {
  id: number
  lobbyNumber: number
  status: string
  region?: string | null
  players: LobbyPlayer[]
  neededSlots: Record<string, number> | null
  blockedRoles: string[]
  spotsAvailable: Record<string, number>
  pendingResult?: any
  mapVote?: { selectedMapId?: number | null } | null
  selectedMapName?: string | null
}

type Props = {
  currentUser: { id: number; name?: string | null; email?: string; battleTag?: string | null } | null
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

const REGIONS = [
  { value: 'na', label: 'NA' },
  { value: 'emea', label: 'EMEA' },
  { value: 'pacific', label: 'Pacific' },
] as const

const REGION_LABELS: Record<string, string> = { na: 'NA', emea: 'EMEA', pacific: 'Pacific' }

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
  const [quickJoinOpen, setQuickJoinOpen] = useState(false)
  const [quickJoinRoles, setQuickJoinRoles] = useState<string[]>([])
  const [quickJoining, setQuickJoining] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState<string>('na')

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
        body: JSON.stringify({ payloadSeasonId: seasonId, region: selectedRegion }),
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

  function toggleRole(role: string, blocked: boolean) {
    if (blocked) return
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
    setRoleError(null)
  }

  async function handleQuickJoin() {
    if (quickJoinRoles.length === 0) {
      setActionError('Select at least one role')
      return
    }
    setQuickJoining(true)
    setActionError(null)
    try {
      const res = await fetch('/api/pug/lobby/quick-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: quickJoinRoles, region: selectedRegion }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/pugs/lobby/${data.lobbyId}`)
      } else {
        setActionError(data.error || 'No available lobbies')
      }
    } catch {
      setActionError('Failed to quick join')
    } finally {
      setQuickJoining(false)
    }
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

  const needsBattleTag = !!currentUser && isRegistered && !(currentUser.battleTag && currentUser.battleTag.includes('#'))

  const openLobbies = lobbies.filter((l) => l.status === 'OPEN' && l.region === selectedRegion)
  const activeLobbies = lobbies.filter((l) => l.status !== 'OPEN' && l.region === selectedRegion)
  const myLobbyId = lobbies.find((l) => {
    if (!l.players.some((p) => p.userId === currentUser?.id)) return false
    if (l.status === 'REPORTING') {
      const pr = l.pendingResult as any
      if (pr && pr.reportedBy) {
        return false // Ignore this lobby, player is free to join another
      }
    }
    return true
  })?.id

  const hasJoinableLobbies = openLobbies.length > 0

  return (
    <>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Open Tier PUGs</h1>
          {seasonName && <p className="text-sm text-gray-500 mt-0.5">{seasonName}</p>}
        </div>
        <div className="flex items-center gap-2">
          {currentUser && isRegistered && seasonId && hasJoinableLobbies && !myLobbyId && (
            <button
              onClick={() => { setQuickJoinOpen(!quickJoinOpen); setQuickJoinRoles([]); setActionError(null) }}
              disabled={needsBattleTag}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                quickJoinOpen
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
            >
              {quickJoinOpen ? 'Cancel' : 'Quick Join'}
            </button>
          )}
          {currentUser && isRegistered && seasonId && (
            <button
              onClick={handleCreate}
              disabled={creating || needsBattleTag}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {creating ? 'Creating…' : 'Create Lobby'}
            </button>
          )}
        </div>
      </div>

      {/* Region tabs - always visible */}
      <div className="flex gap-1 mb-6 p-1 bg-gray-900/50 border border-gray-800 rounded-xl w-fit">
        {REGIONS.map((r) => (
          <button
            key={r.value}
            onClick={() => setSelectedRegion(r.value)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              selectedRegion === r.value
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Quick Join role picker */}
      {quickJoinOpen && (
        <div className="border border-gray-700/80 rounded-xl p-4 mb-6 bg-gradient-to-b from-gray-900/80 to-gray-950/80">
          <p className="text-sm text-gray-400 mb-3 font-medium">Select your roles and we will place you in the best lobby</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {ROLES.map((role) => (
              <button
                key={role.value}
                onClick={() => {
                  setQuickJoinRoles((prev) =>
                    prev.includes(role.value) ? prev.filter((r) => r !== role.value) : [...prev, role.value],
                  )
                  setActionError(null)
                }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  quickJoinRoles.includes(role.value)
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleQuickJoin}
            disabled={quickJoining || quickJoinRoles.length === 0}
            className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {quickJoining ? 'Joining...' : 'Join Best Lobby'}
          </button>
        </div>
      )}

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

      {needsBattleTag && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 mb-6 text-sm text-amber-400">
          Add your Battle.net BattleTag to join lobbies.{' '}
          <Link href="/pugs" className="underline hover:text-amber-200">
            Update your profile
          </Link>{' '}
          to continue.
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
        <Link
          href={`/pugs/lobby/${myLobbyId}`}
          className="bg-blue-600/15 border border-blue-500/30 rounded-xl px-4 py-3 mb-6 flex items-center justify-between hover:bg-blue-600/20 transition-colors group"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-sm text-blue-300 font-medium">You are in an active lobby</span>
          </div>
          <span className="text-sm font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">
            View Lobby →
          </span>
        </Link>
      )}

      {loadingLobbies ? (
        <p className="text-gray-500 text-sm">Loading lobbies…</p>
      ) : lobbies.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3 opacity-30">🎮</div>
          <p className="text-lg mb-1 text-gray-400">No active lobbies</p>
          {currentUser && isRegistered && seasonId && (
            <p className="text-sm text-gray-500">
              Be the first -{' '}
              <button
                onClick={handleCreate}
                disabled={creating}
                className="text-blue-400 hover:text-blue-300 disabled:opacity-50 font-medium"
              >
                create a lobby
              </button>{' '}
              to get started.
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
                    needsBattleTag={needsBattleTag}
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
    </>
  )
}

type LobbyCardProps = {
  lobby: Lobby
  currentUserId: number | null
  isRegistered: boolean
  needsBattleTag?: boolean
  isExpanded: boolean
  selectedRoles: string[]
  roleError: string | null
  onToggleJoin: () => void
  onToggleRole: (role: string, blocked: boolean) => void
  onJoin: () => void
}

const ROLE_COLORS_OPEN: Record<string, string> = {
  tank: 'border-blue-700 text-blue-400',
  flex_dps: 'border-red-700 text-red-400',
  hitscan_dps: 'border-orange-700 text-orange-400',
  flex_support: 'border-green-700 text-green-400',
  main_support: 'border-teal-700 text-teal-400',
}
const ROLE_BG: Record<string, string> = {
  tank: 'bg-blue-500',
  flex_dps: 'bg-red-500',
  hitscan_dps: 'bg-orange-500',
  flex_support: 'bg-green-500',
  main_support: 'bg-teal-500',
}
const ROLE_LABELS_OPEN: Record<string, string> = {
  tank: 'Tank', flex_dps: 'Flex DPS', hitscan_dps: 'Hitscan', flex_support: 'Flex Sup', main_support: 'Main Sup',
}

function PlayerAvatarStack({ players, max = 10 }: { players: LobbyPlayer[]; max?: number }) {
  const shown = players.slice(0, max)
  const extra = players.length - max
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p) => (
        <div
          key={p.userId}
          title={p.name || `Player #${p.userId}`}
          className="w-7 h-7 rounded-full border-2 border-gray-900 bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-300 uppercase overflow-hidden shrink-0"
        >
          {p.avatarUrl ? (
            <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            (p.name || '?')[0]
          )}
        </div>
      ))}
      {extra > 0 && (
        <div className="w-7 h-7 rounded-full border-2 border-gray-900 bg-gray-800 flex items-center justify-center text-[10px] text-gray-400 shrink-0">
          +{extra}
        </div>
      )}
    </div>
  )
}

function FillBar({ current, total }: { current: number; total: number }) {
  const pct = Math.min((current / total) * 100, 100)
  return (
    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          current >= total ? 'bg-green-500' : current >= total / 2 ? 'bg-blue-500' : 'bg-blue-500/60'
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function MiniTeams({ players }: { players: LobbyPlayer[] }) {
  const team1 = players.filter((p) => p.team === 1)
  const team2 = players.filter((p) => p.team === 2)
  if (team1.length === 0 && team2.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-2">
      {[{ label: 'Team 1', list: team1, color: 'border-blue-800/60' }, { label: 'Team 2', list: team2, color: 'border-orange-800/60' }].map(({ label, list, color }) => (
        <div key={label} className={`border ${color} rounded-lg px-3 py-2`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${label === 'Team 1' ? 'text-blue-400' : 'text-orange-400'}`}>{label}</p>
          <div className="space-y-1">
            {list.map((p) => (
              <div key={p.userId} className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-gray-700 overflow-hidden shrink-0">
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-400 font-bold">{(p.name || '?')[0]}</div>
                  )}
                </div>
                <span className="text-xs text-gray-300 truncate">{p.name}{p.isCaptain ? ' ★' : ''}</span>
                {p.assignedRole && (
                  <span className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${ROLE_BG[p.assignedRole] ?? 'bg-gray-500'}`} title={ROLE_LABELS_OPEN[p.assignedRole] ?? p.assignedRole} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SpotsNeededBadges({ neededSlots, spotsAvailable }: { neededSlots: Record<string, number> | null; spotsAvailable: Record<string, number> }) {
  const roles = ['tank', 'flex_dps', 'hitscan_dps', 'flex_support', 'main_support']
  if (!neededSlots) return <span className="text-xs text-red-500">Role conflict</span>
  const open = roles.filter((r) => (spotsAvailable[r] ?? 0) > 0)
  if (open.length === 0) return <span className="text-xs text-gray-600">All roles covered</span>
  return (
    <>
      {open.map((role) => (
        <span key={role} className={`text-xs px-1.5 py-0.5 rounded border ${ROLE_COLORS_OPEN[role]}`}>
          {spotsAvailable[role]}× {ROLE_LABELS_OPEN[role]}
        </span>
      ))}
    </>
  )
}

function LobbyCard({
  lobby,
  currentUserId,
  isRegistered,
  needsBattleTag = false,
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
  const blockedRoles = lobby.blockedRoles ?? []
  const hasTeams = lobby.players.some((p) => p.team)

  return (
    <div className="border border-gray-700/80 rounded-xl overflow-hidden bg-gradient-to-b from-gray-900/80 to-gray-950/80">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-lg text-gray-100">PUG #{lobby.lobbyNumber}</span>
            {lobby.region && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-700/60 text-gray-300 border border-gray-600">
                {REGION_LABELS[lobby.region] ?? lobby.region.toUpperCase()}
              </span>
            )}
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
          </div>
          <div className="flex items-center gap-3">
            {isInThisLobby ? (
              <Link
                href={`/pugs/lobby/${lobby.id}`}
                className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
              >
                View Lobby
              </Link>
            ) : isOpen && isRegistered ? (
              <button
                onClick={onToggleJoin}
                disabled={needsBattleTag}
                title={needsBattleTag ? 'Add your BattleTag to join' : undefined}
                className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  isExpanded
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {isExpanded ? 'Cancel' : 'Join Queue'}
              </button>
            ) : (
              <Link
                href={`/pugs/lobby/${lobby.id}`}
                className="text-sm px-3 py-1.5 border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 rounded-lg transition-colors"
              >
                Spectate
              </Link>
            )}
          </div>
        </div>

        {/* Fill bar + count */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1">
            <FillBar current={playerCount} total={10} />
          </div>
          <span className="text-xs text-gray-400 font-medium tabular-nums shrink-0">{playerCount}/10</span>
        </div>

        {/* Player avatars */}
        {playerCount > 0 && !hasTeams && (
          <div className="flex items-center gap-3">
            <PlayerAvatarStack players={lobby.players} />
            {isOpen && playerCount < 10 && (
              <span className="text-xs text-gray-500">{10 - playerCount} more needed</span>
            )}
          </div>
        )}
      </div>

      {/* Role needs for open lobbies */}
      {isOpen && (
        <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5">
          <SpotsNeededBadges neededSlots={lobby.neededSlots ?? null} spotsAvailable={lobby.spotsAvailable ?? {}} />
        </div>
      )}

      {/* Mini team preview for in-progress lobbies */}
      {hasTeams && (
        <div className="px-4 pb-3">
          <MiniTeams players={lobby.players} />
        </div>
      )}

      {/* Join role picker */}
      {isExpanded && (
        <div className="border-t border-gray-700/80 px-4 py-3 bg-gray-900/60">
          <p className="text-xs text-gray-400 mb-2 font-medium">Select your roles (pick all you can play)</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {ROLES.map((role) => {
              const blocked = blockedRoles.includes(role.value)
              return (
                <button
                  key={role.value}
                  onClick={() => onToggleRole(role.value, blocked)}
                  disabled={blocked}
                  title={blocked ? 'Role slots full' : undefined}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    blocked
                      ? 'border-gray-800 text-gray-600 cursor-not-allowed'
                      : selectedRoles.includes(role.value)
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400'
                  }`}
                >
                  {role.label}{blocked ? ' (Full)' : ''}
                </button>
              )
            })}
          </div>
          {roleError && <p className="text-xs text-red-400 mb-2">{roleError}</p>}
          <button
            onClick={onJoin}
            disabled={selectedRoles.length === 0}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Join Lobby
          </button>
        </div>
      )}
    </div>
  )
}
