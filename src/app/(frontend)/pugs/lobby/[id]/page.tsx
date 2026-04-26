'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const ROLE_LABELS: Record<string, string> = {
  tank: 'Tank',
  flex_dps: 'Flex DPS',
  hitscan_dps: 'Hitscan DPS',
  flex_support: 'Flex Support',
  main_support: 'Main Support',
}

const ROLE_COLORS: Record<string, string> = {
  tank: 'bg-blue-900/50 text-blue-300 border-blue-700',
  flex_dps: 'bg-red-900/50 text-red-300 border-red-700',
  hitscan_dps: 'bg-orange-900/50 text-orange-300 border-orange-700',
  flex_support: 'bg-green-900/50 text-green-300 border-green-700',
  main_support: 'bg-teal-900/50 text-teal-300 border-teal-700',
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${ROLE_COLORS[role] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

type Hero = { id: number; name: string; role: string }
type Player = {
  userId: number
  name: string
  team: number | null
  isCaptain: boolean
  assignedRole: string | null
  queuedRoles: string[]
}
type LobbyData = {
  lobby: any
  selectedMap: { id: number; name: string } | null
  mapCandidates: Array<{ id: number; name: string }>
  heroes: Hero[]
  currentUserId: number
  isPugAdmin: boolean
  guildId: string | null
}

export default function LobbyPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<LobbyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/pug/lobby/${id}`)
    if (!res.ok) {
      setError(res.status === 404 ? 'Lobby not found' : 'Failed to load lobby')
      return
    }
    setData(await res.json())
  }, [id])

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 3000)
    return () => clearInterval(interval)
  }, [fetchState])

  async function apiAction(path: string, body: object, method = 'POST') {
    setActionError(null)
    const res = await fetch(`/api/pug/lobby/${id}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const json = await res.json()
      setActionError(json.error ?? 'Action failed')
    } else {
      await fetchState()
    }
  }

  async function leaveQueue() {
    setActionError(null)
    const res = await fetch(`/api/pug/lobby/${id}/queue`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      setActionError(json.error ?? 'Failed to leave')
    } else {
      await fetchState()
    }
  }

  if (error) return <main className="container mx-auto p-8 text-red-400">{error}</main>
  if (!data) return <main className="container mx-auto p-8 text-gray-500">Loading...</main>

  const { lobby, selectedMap, mapCandidates, heroes, currentUserId, isPugAdmin, guildId } = data
  const players: Player[] = lobby.players
  const me = players.find((p) => p.userId === currentUserId)
  const inLobby = !!me
  const isCaptain = me?.isCaptain ?? false

  const statusLabel: Record<string, string> = {
    OPEN: 'Open - Filling Queue',
    READY: 'Ready - Starting Soon',
    DRAFTING: 'Drafting',
    MAP_VOTE: 'Map Vote',
    BANNING: 'Hero Bans',
    IN_PROGRESS: 'In Progress',
    REPORTING: 'Reporting Result',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    DISPUTED: 'Disputed',
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/pugs/open" className="text-gray-500 hover:text-gray-300 text-sm">← Open Tier</Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-xl font-bold">PUG #{lobby.lobbyNumber}</h1>
        <span className="text-sm px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
          {statusLabel[lobby.status] ?? lobby.status}
        </span>
      </div>

      {actionError && (
        <div className="mb-4 p-3 bg-red-950 border border-red-800 rounded text-red-400 text-sm">
          {actionError}
        </div>
      )}

      {/* ── OPEN: queue ── */}
      {lobby.status === 'OPEN' && (
        <div className="space-y-4">
          <div className="border border-gray-800 rounded-lg p-4">
            <h2 className="font-semibold mb-3 text-sm text-gray-400 uppercase tracking-wide">
              Queue - {players.length}/10 players
            </h2>
            {players.length === 0 ? (
              <p className="text-gray-600 text-sm">No one queued yet. Be the first!</p>
            ) : (
              <ul className="space-y-2">
                {players.map((p) => (
                  <li key={p.userId} className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${p.userId === currentUserId ? 'text-blue-300' : 'text-gray-200'}`}>
                      {p.name}{p.userId === currentUserId && ' (you)'}
                    </span>
                    <div className="flex gap-1 flex-wrap">
                      {p.queuedRoles.map((r) => <RoleBadge key={r} role={r} />)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {inLobby ? (
            <div className="flex items-center justify-between border border-gray-800 rounded-lg p-4">
              <div>
                <p className="text-sm font-medium text-gray-200">You're queued</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {me!.queuedRoles.map((r) => <RoleBadge key={r} role={r} />)}
                </div>
              </div>
              <button
                onClick={leaveQueue}
                className="px-3 py-1.5 text-sm border border-red-800 text-red-400 rounded hover:bg-red-950 transition-colors"
              >
                Leave Queue
              </button>
            </div>
          ) : (
            <QueueForm onJoin={(roles) => apiAction('/queue', { roles })} />
          )}

          {isPugAdmin && (
            <TestAddDummy lobbyId={id} onAdded={fetchState} />
          )}
        </div>
      )}

      {/* ── READY: countdown ── */}
      {lobby.status === 'READY' && (
        <div className="text-center py-12 border border-gray-800 rounded-lg">
          <p className="text-2xl font-bold mb-2">Match Found!</p>
          <p className="text-gray-400 mb-6">Draft starting in 30 seconds…</p>
          {inLobby && (
            <button
              onClick={leaveQueue}
              className="px-4 py-2 border border-red-800 text-red-400 rounded hover:bg-red-950 transition-colors text-sm"
            >
              Leave (penalised)
            </button>
          )}
        </div>
      )}

      {/* ── DRAFTING ── */}
      {lobby.status === 'DRAFTING' && lobby.draftState && (
        <DraftUI
          players={players}
          draftState={lobby.draftState}
          currentUserId={currentUserId}
          isCaptain={isCaptain}
          onPick={(pickedUserId) => apiAction('/draft/pick', { pickedUserId })}
        />
      )}

      {/* ── MAP VOTE ── */}
      {lobby.status === 'MAP_VOTE' && (
        <div>
          <h2 className="font-semibold mb-4">Vote for a Map</h2>
          {!inLobby && <p className="text-gray-500 text-sm mb-4">Spectating - only players can vote.</p>}
          <div className="grid grid-cols-3 gap-3">
            {mapCandidates.map((m) => {
              const myVote = lobby.mapVote?.votes?.[String(currentUserId)]
              const voted = myVote === m.id
              const count = Object.values(lobby.mapVote?.votes ?? {}).filter((v) => v === m.id).length
              return (
                <button
                  key={m.id}
                  onClick={() => inLobby && apiAction('/map-vote', { mapId: m.id })}
                  disabled={!inLobby}
                  className={`p-4 border rounded-lg transition-colors text-center ${
                    voted
                      ? 'bg-blue-900/50 border-blue-600 text-blue-200'
                      : 'border-gray-700 hover:bg-gray-800 disabled:opacity-50'
                  }`}
                >
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{count} vote{count !== 1 ? 's' : ''}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── BANNING ── */}
      {lobby.status === 'BANNING' && lobby.banState && (
        <BanUI
          banState={lobby.banState}
          draftState={lobby.draftState}
          heroes={heroes}
          currentUserId={currentUserId}
          isCaptain={isCaptain}
          onBan={(heroId) => apiAction('/ban', { heroId })}
        />
      )}

      {/* ── IN PROGRESS ── */}
      {lobby.status === 'IN_PROGRESS' && (
        <div className="space-y-6">
          {selectedMap && (
            <p className="text-sm text-gray-400">
              Map: <span className="text-white font-medium">{selectedMap.name}</span>
            </p>
          )}
          <VoiceChannelLinks
            myTeam={me?.team ?? null}
            voiceChannel1Id={lobby.voiceChannel1Id ?? null}
            voiceChannel2Id={lobby.voiceChannel2Id ?? null}
            guildId={guildId}
          />
          <TeamsDisplay players={players} currentUserId={currentUserId} />
          {isCaptain && (
            <div className="border border-gray-800 rounded-lg p-4">
              <h3 className="font-medium mb-3 text-sm text-gray-400 uppercase tracking-wide">
                Submit Result (Captain Only)
              </h3>
              <div className="flex gap-3">
                {(['team1', 'team2', 'draw'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => apiAction('/report', { result: r })}
                    className="px-4 py-2 border border-gray-700 rounded hover:bg-gray-800 text-sm transition-colors"
                  >
                    {r === 'team1' ? 'Team 1 Won' : r === 'team2' ? 'Team 2 Won' : 'Draw'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REPORTING ── */}
      {lobby.status === 'REPORTING' && (
        <div className="space-y-4">
          <TeamsDisplay players={players} currentUserId={currentUserId} />
          {(() => {
            const pending = lobby.pendingResult as any
            return pending ? (
              <div className="border border-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-4">
                  Result submitted:{' '}
                  <strong className="text-white">
                    {pending.result === 'team1' ? 'Team 1 Won' : pending.result === 'team2' ? 'Team 2 Won' : 'Draw'}
                  </strong>
                  {' '}- auto-confirms in 10 minutes.
                </p>
                {isCaptain && me?.team !== players.find((p) => p.userId === pending.reportedBy)?.team && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => apiAction('/confirm', { action: 'confirm' })}
                      className="px-4 py-2 bg-green-800 text-green-100 rounded hover:bg-green-700 text-sm transition-colors"
                    >
                      Confirm Result
                    </button>
                    <button
                      onClick={() => apiAction('/confirm', { action: 'dispute' })}
                      className="px-4 py-2 border border-red-800 text-red-400 rounded hover:bg-red-950 text-sm transition-colors"
                    >
                      Dispute
                    </button>
                  </div>
                )}
              </div>
            ) : null
          })()}
        </div>
      )}

      {/* ── TERMINAL STATES ── */}
      {lobby.status === 'COMPLETED' && (
        <div className="text-center py-12">
          <p className="text-2xl font-bold mb-2">Match Complete</p>
          {selectedMap && <p className="text-gray-400 text-sm">Map: {selectedMap.name}</p>}
          <TeamsDisplay players={players} currentUserId={currentUserId} />
          <Link href="/pugs/open" className="mt-6 inline-block text-blue-400 hover:underline text-sm">
            Back to Open Tier →
          </Link>
        </div>
      )}

      {lobby.status === 'CANCELLED' && (
        <div className="text-center py-12">
          <p className="text-xl font-semibold text-gray-400">Lobby cancelled.</p>
          <Link href="/pugs/open" className="mt-4 inline-block text-blue-400 hover:underline text-sm">
            Back to Open Tier →
          </Link>
        </div>
      )}

      {lobby.status === 'DISPUTED' && (
        <div className="text-center py-12">
          <p className="text-xl font-semibold text-yellow-400">Result disputed</p>
          <p className="text-gray-500 text-sm mt-2">An admin will review and resolve this match.</p>
          <TeamsDisplay players={players} currentUserId={currentUserId} />
        </div>
      )}
    </main>
  )
}

// ── Queue join form ──

function QueueForm({ onJoin }: { onJoin: (roles: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([])
  const roles = ['tank', 'flex_dps', 'hitscan_dps', 'flex_support', 'main_support']

  function toggle(role: string) {
    setSelected((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role])
  }

  return (
    <div className="border border-gray-800 rounded-lg p-4">
      <p className="text-sm font-medium text-gray-300 mb-3">Select your roles to queue:</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {roles.map((role) => (
          <button
            key={role}
            onClick={() => toggle(role)}
            className={`px-3 py-1.5 text-sm rounded border transition-colors ${
              selected.includes(role)
                ? ROLE_COLORS[role] + ' font-medium'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            {ROLE_LABELS[role]}
          </button>
        ))}
      </div>
      <button
        onClick={() => selected.length > 0 && onJoin(selected)}
        disabled={selected.length === 0}
        className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-600 disabled:opacity-40 text-sm font-medium transition-colors"
      >
        Join Queue
      </button>
    </div>
  )
}

// ── Draft UI ──

function DraftUI({
  players, draftState, currentUserId, isCaptain, onPick,
}: {
  players: Player[]
  draftState: any
  currentUserId: number
  isCaptain: boolean
  onPick: (id: number) => void
}) {
  const myTeam = players.find((p) => p.userId === currentUserId)?.team
  const isMyTurn = isCaptain && draftState.currentPickTeam === myTeam

  const team1 = players.filter((p) => p.team === 1)
  const team2 = players.filter((p) => p.team === 2)
  const undrafted = players.filter((p) => p.team === null && !p.isCaptain)
  const captains = players.filter((p) => p.isCaptain)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Draft</h2>
        <span className="text-sm text-gray-400">
          Pick {draftState.pickNumber + 1}/8 - Team {draftState.currentPickTeam} choosing
        </span>
      </div>

      {isMyTurn && (
        <div className="p-3 bg-blue-950 border border-blue-700 rounded text-blue-300 text-sm font-medium">
          Your turn to pick!
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm">
        {[1, 2].map((t) => {
          const teamPlayers = t === 1 ? team1 : team2
          const cap = captains.find((c) => c.team === t)
          return (
            <div key={t} className="border border-gray-800 rounded-lg p-3">
              <p className="font-medium mb-2 text-gray-300">
                Team {t} {cap && <span className="text-xs text-gray-500">(C: {cap.name})</span>}
              </p>
              <ul className="space-y-1">
                {teamPlayers.map((p) => (
                  <li key={p.userId} className={p.userId === currentUserId ? 'text-blue-300' : 'text-gray-300'}>
                    {p.name}{p.isCaptain && ' ★'}{p.userId === currentUserId && ' (you)'}
                    {p.assignedRole && <span className="ml-1"><RoleBadge role={p.assignedRole} /></span>}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="border border-gray-800 rounded-lg p-3">
        <p className="text-sm text-gray-400 mb-2">Available players</p>
        <div className="space-y-2">
          {undrafted.map((p) => (
            <div key={p.userId} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-200">{p.name}</span>
                {p.assignedRole && <RoleBadge role={p.assignedRole} />}
              </div>
              {isMyTurn && (
                <button
                  onClick={() => onPick(p.userId)}
                  className="px-3 py-1 text-xs bg-blue-700 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  Pick
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Ban UI ──

function BanUI({
  banState, draftState, heroes, currentUserId, isCaptain, onBan,
}: {
  banState: any
  draftState: any
  heroes: Hero[]
  currentUserId: number
  isCaptain: boolean
  onBan: (id: number) => void
}) {
  const [filter, setFilter] = useState('')
  const existingBans: number[] = (banState.bans ?? []).map((b: any) => b.heroId ?? b)

  // Determine if it's the current user's turn to ban
  // The captain whose team matches currentBanTeam should ban
  const isMyTurn = isCaptain && (() => {
    if (!draftState) return false
    const cap1 = draftState.captain1Id
    const cap2 = draftState.captain2Id
    if (banState.currentBanTeam === 1 && cap1 === currentUserId) return true
    if (banState.currentBanTeam === 2 && cap2 === currentUserId) return true
    return false
  })()

  const filtered = heroes.filter(
    (h) =>
      !existingBans.includes(h.id) &&
      h.name.toLowerCase().includes(filter.toLowerCase()),
  )

  const grouped = filtered.reduce<Record<string, Hero[]>>((acc, h) => {
    ;(acc[h.role] ??= []).push(h)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Hero Bans</h2>
        <span className="text-sm text-gray-400">
          Ban {banState.banNumber}/4 - Team {banState.currentBanTeam} banning
        </span>
      </div>

      {existingBans.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Banned:</span>
          {existingBans.map((id) => {
            const h = heroes.find((h) => h.id === id)
            return (
              <span key={id} className="text-xs px-2 py-0.5 rounded bg-red-950 border border-red-800 text-red-400 line-through">
                {h?.name ?? `#${id}`}
              </span>
            )
          })}
        </div>
      )}

      {isMyTurn ? (
        <div className="border border-gray-800 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-300 mb-3">Your turn to ban a hero</p>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search heroes…"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:border-gray-500"
          />
          {Object.entries(grouped).map(([role, hs]) => (
            <div key={role} className="mb-3">
              <p className="text-xs text-gray-500 uppercase mb-1">{role}</p>
              <div className="flex flex-wrap gap-2">
                {hs.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => onBan(h.id)}
                    className="px-3 py-1 text-sm border border-red-900 text-red-300 rounded hover:bg-red-950 transition-colors"
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">
          {isCaptain ? `Waiting for Team ${banState.currentBanTeam} to ban…` : `Team ${banState.currentBanTeam} is banning…`}
        </p>
      )}
    </div>
  )
}

// ── Teams display ──

function TeamsDisplay({ players, currentUserId }: { players: Player[]; currentUserId: number }) {
  const team1 = players.filter((p) => p.team === 1)
  const team2 = players.filter((p) => p.team === 2)
  return (
    <div className="grid grid-cols-2 gap-4">
      {[
        { label: 'Team 1', list: team1 },
        { label: 'Team 2', list: team2 },
      ].map(({ label, list }) => (
        <div key={label} className="border border-gray-800 rounded-lg p-3">
          <p className="font-medium text-sm text-gray-400 mb-2">{label}</p>
          <ul className="space-y-1.5">
            {list.map((p) => (
              <li key={p.userId} className="flex items-center gap-2 text-sm">
                <span className={p.userId === currentUserId ? 'text-blue-300 font-medium' : 'text-gray-200'}>
                  {p.name}{p.isCaptain && ' ★'}{p.userId === currentUserId && ' (you)'}
                </span>
                {p.assignedRole && <RoleBadge role={p.assignedRole} />}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ── Voice channel links ──

function VoiceChannelLinks({
  myTeam,
  voiceChannel1Id,
  voiceChannel2Id,
  guildId,
}: {
  myTeam: number | null
  voiceChannel1Id: string | null
  voiceChannel2Id: string | null
  guildId: string | null
}) {
  if (!guildId || (!voiceChannel1Id && !voiceChannel2Id)) return null

  const channelUrl = (id: string) => `https://discord.com/channels/${guildId}/${id}`

  return (
    <div className="border border-gray-800 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">Voice Channels</p>
      <div className="flex gap-3 flex-wrap">
        {voiceChannel1Id && (
          <a
            href={channelUrl(voiceChannel1Id)}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors ${
              myTeam === 1
                ? 'border-blue-600 bg-blue-950 text-blue-200 font-medium'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="opacity-70">
              <path d="M11.998 2.005C6.476 2.005 2 6.481 2 12.002a9.994 9.994 0 0 0 6.837 9.48c.5.091.683-.217.683-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.532 1.032 1.532 1.032.891 1.529 2.341 1.087 2.912.832.091-.647.349-1.086.635-1.337-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.682-.103-.254-.447-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.338c1.909-1.294 2.747-1.025 2.747-1.025.548 1.377.204 2.393.1 2.647.64.698 1.028 1.59 1.028 2.682 0 3.841-2.337 4.687-4.565 4.935.359.307.679.917.679 1.852 0 1.335-.012 2.415-.012 2.741 0 .267.18.578.688.479A9.997 9.997 0 0 0 22 12.002C22 6.481 17.523 2.005 12 2.005h-.002z"/>
            </svg>
            Team 1 Voice{myTeam === 1 ? ' (your team)' : ''}
          </a>
        )}
        {voiceChannel2Id && (
          <a
            href={channelUrl(voiceChannel2Id)}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors ${
              myTeam === 2
                ? 'border-blue-600 bg-blue-950 text-blue-200 font-medium'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="opacity-70">
              <path d="M11.998 2.005C6.476 2.005 2 6.481 2 12.002a9.994 9.994 0 0 0 6.837 9.48c.5.091.683-.217.683-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.532 1.032 1.532 1.032.891 1.529 2.341 1.087 2.912.832.091-.647.349-1.086.635-1.337-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.682-.103-.254-.447-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.338c1.909-1.294 2.747-1.025 2.747-1.025.548 1.377.204 2.393.1 2.647.64.698 1.028 1.59 1.028 2.682 0 3.841-2.337 4.687-4.565 4.935.359.307.679.917.679 1.852 0 1.335-.012 2.415-.012 2.741 0 .267.18.578.688.479A9.997 9.997 0 0 0 22 12.002C22 6.481 17.523 2.005 12 2.005h-.002z"/>
            </svg>
            Team 2 Voice{myTeam === 2 ? ' (your team)' : ''}
          </a>
        )}
      </div>
    </div>
  )
}

// ── Admin test: add dummy player ──

function TestAddDummy({ lobbyId, onAdded }: { lobbyId: string; onAdded: () => void }) {
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const roles = ['tank', 'flex_dps', 'hitscan_dps', 'flex_support', 'main_support']

  function toggle(role: string) {
    setSelected((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role])
  }

  async function add() {
    if (selected.length === 0) { setMsg('Pick at least one role'); return }
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/pug/lobby/${lobbyId}/test-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: selected }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`Added ${data.dummyName}`)
        setSelected([])
        onAdded()
      } else {
        setMsg(data.error || 'Failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-dashed border-gray-700 rounded-lg p-4 mt-2">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">Admin - Add Dummy Player</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {roles.map((role) => (
          <button
            key={role}
            onClick={() => toggle(role)}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              selected.includes(role)
                ? ROLE_COLORS[role] + ' font-medium'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            {ROLE_LABELS[role]}
          </button>
        ))}
      </div>
      {msg && <p className="text-xs text-gray-400 mb-2">{msg}</p>}
      <button
        onClick={add}
        disabled={loading || selected.length === 0}
        className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded transition-colors"
      >
        {loading ? 'Adding...' : 'Add Dummy'}
      </button>
    </div>
  )
}
