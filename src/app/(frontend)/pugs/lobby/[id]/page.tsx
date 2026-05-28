'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useConfirm } from '@/components/ConfirmDialog'
import { PugNav } from '../../PugNav'

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

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-green-500/20 text-green-400 border border-green-500/30',
  READY: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  DRAFTING: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  MAP_VOTE: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  BANNING: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  IN_PROGRESS: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  REPORTING: 'bg-pink-500/20 text-pink-400 border border-pink-500/30',
  COMPLETED: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border border-red-500/30',
  DISPUTED: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${ROLE_COLORS[role] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

type Hero = { id: number; name: string; role: string; imageUrl?: string | null }
type Player = {
  userId: number
  name: string
  avatarUrl: string | null
  team: number | null
  isCaptain: boolean
  readyConfirmed: boolean
  assignedRole: string | null
  queuedRoles: string[]
}

function PlayerAvatar({ player, size = 24 }: { player: Player; size?: number }) {
  if (player.avatarUrl) {
    return (
      <img
        src={player.avatarUrl}
        alt=""
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  const initials = (player.name ?? '?').charAt(0).toUpperCase()
  return (
    <div
      className="rounded-full bg-gray-700 flex items-center justify-center shrink-0 text-gray-400 font-medium select-none"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initials}
    </div>
  )
}
type LobbyData = {
  lobby: any
  selectedMap: { id: number; name: string; type?: string; settingsMapEntry?: string; imageUrl?: string | null } | null
  mapCandidates: Array<{ id: number; name: string; imageUrl?: string | null }>
  heroes: Hero[]
  currentUserId: number | null
  isPugAdmin: boolean
  guildId: string | null
  blockedRoles: string[]
  neededSlots: Record<string, number> | null
  spotsAvailable: Record<string, number>
  approvedRoles: string[] | null
  regionAllowed: boolean
  hostInfo: {
    hostUserId: number | null
    hostName: string | null
    settingsText: string | null
    battleTags: Record<number, string | null>
  } | null
  linkedScrimId: number | null
  botEnabled: boolean
}

function playNotificationSound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
    setTimeout(() => ctx.close(), 500)
  } catch {}
}

function Countdown({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    function update() {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) { setRemaining('0s'); return }
      const secs = Math.ceil(diff / 1000)
      setRemaining(`${secs}s`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [deadline])

  const diff = new Date(deadline).getTime() - Date.now()
  const urgent = diff > 0 && diff < 15000

  return (
    <span className={`font-mono text-xs ${urgent ? 'text-red-400' : 'text-yellow-500'}`}>
      {remaining}
    </span>
  )
}



export default function LobbyPage() {
  const { id } = useParams<{ id: string }>()
  const confirm = useConfirm()
  const [data, setData] = useState<LobbyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const prevStatusRef = useRef<string | null>(null)

  const isInitialLoad = useRef(true)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/pug/lobby/${id}`)
      if (!res.ok) {
        if (isInitialLoad.current) setError(res.status === 404 ? 'Lobby not found' : 'Failed to load lobby')
        return
      }
      setError(null)
      isInitialLoad.current = false
      const newData = await res.json()
      const newStatus = newData.lobby?.status
      const prevStatus = prevStatusRef.current
      if (prevStatus && newStatus !== prevStatus) {
        playNotificationSound()
      }
      prevStatusRef.current = newStatus
      setData(newData)
    } catch {
      if (isInitialLoad.current) setError('Failed to load lobby')
    }
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

  const { lobby, selectedMap, mapCandidates, heroes, currentUserId, isPugAdmin, guildId, blockedRoles, neededSlots, spotsAvailable, approvedRoles, regionAllowed, hostInfo, linkedScrimId, botEnabled } = data
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
      <PugNav active={lobby.tier === 'invite' ? 'invite' : 'open'} />
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">PUG #{lobby.lobbyNumber}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            (STATUS_BADGE[lobby.status] ?? 'bg-gray-500/20 text-gray-400 border border-gray-500/30')
          }`}>
            {statusLabel[lobby.status] ?? lobby.status}
          </span>
        </div>
      </div>

      {currentUserId === null && lobby.status === 'OPEN' && (
        <div className="mb-4 flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-3">
          <span className="text-sm text-gray-400">Sign in to join this lobby.</span>
          <a
            href={`/api/auth/discord?returnUrl=/pugs/lobby/${id}`}
            className="text-sm font-semibold text-blue-400 hover:underline"
          >
            Sign in with Discord →
          </a>
        </div>
      )}

      {actionError && (
        <div className="mb-4 p-3 bg-red-950 border border-red-800 rounded text-red-400 text-sm">
          {actionError}
        </div>
      )}

      {/* ── OPEN: queue ── */}
      {lobby.status === 'OPEN' && (
        <div className="space-y-4">
          <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950/50">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-900/80 to-gray-900/40 border-b border-gray-800">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Queue</h2>
                <span className="text-sm font-bold text-white">{players.length}<span className="text-gray-600 font-normal">/10</span></span>
              </div>
              {isPugAdmin && players.length > 0 && (
                <button
                  onClick={async () => {
                    const res = await fetch(`/api/pug/lobby/${id}/clear`, { method: 'POST' })
                    if (res.ok) fetchState()
                    else { const j = await res.json(); setActionError(j.error ?? 'Failed to clear queue') }
                  }}
                  className="text-xs px-2.5 py-1 border border-red-900 text-red-500 rounded-lg hover:bg-red-950 hover:border-red-800 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  Clear Queue
                </button>
              )}
            </div>

            {/* Fill bar */}
            <div className="px-4 pt-3 pb-1">
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${players.length >= 10 ? 'bg-green-500' : players.length >= 7 ? 'bg-yellow-500' : 'bg-blue-500/70'}`}
                  style={{ width: `${(players.length / 10) * 100}%` }}
                />
              </div>
            </div>

            {/* Spots needed */}
            <div className="px-4 py-2.5">
              <SpotsNeeded neededSlots={neededSlots} spotsAvailable={spotsAvailable ?? {}} totalPlayers={players.length} />
            </div>

            <div className="border-t border-gray-800/60">
              {/* Player rows */}
              {players.length === 0 ? (
                <p className="px-4 py-6 text-gray-600 text-sm text-center">No one queued yet. Be the first!</p>
              ) : (
                <div className="divide-y divide-gray-800/50">
                  {players.map((p) => (
                    <div key={p.userId} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]">
                      <PlayerAvatar player={p} size={28} />
                      <Link href={`/pugs/profile/${p.userId}`} className={`text-sm font-medium shrink-0 w-36 truncate hover:underline ${p.userId === currentUserId ? 'text-blue-300' : 'text-gray-200 hover:text-white'}`}>
                        {p.name}{p.userId === currentUserId && <span className="text-blue-500 font-normal"> (you)</span>}
                      </Link>
                      <div className="flex gap-1.5 flex-wrap flex-1">
                        {p.queuedRoles.map((r) => <RoleBadge key={r} role={r} />)}
                      </div>
                      {isPugAdmin && p.userId !== currentUserId && (
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/pug/lobby/${id}/queue/${p.userId}`, { method: 'DELETE' })
                            if (res.ok) fetchState()
                            else { const j = await res.json(); setActionError(j.error ?? 'Failed to remove player') }
                          }}
                          className="shrink-0 text-xs px-2.5 py-1 border border-red-900/60 text-red-600 rounded-lg hover:bg-red-950 hover:border-red-800 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {inLobby ? (
            <div className="flex items-center justify-between border border-green-800/40 rounded-xl p-4 bg-gradient-to-r from-green-950/20 to-gray-950/80">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <div>
                  <p className="text-sm font-medium text-green-200">You're in the queue</p>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {me!.queuedRoles.map((r) => <RoleBadge key={r} role={r} />)}
                  </div>
                </div>
              </div>
              <button
                onClick={leaveQueue}
                className="px-3 py-1.5 text-sm border border-red-800 text-red-400 rounded-lg hover:bg-red-950 hover:border-red-700 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                Leave Queue
              </button>
            </div>
          ) : !regionAllowed ? (
            <div className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
              <p className="text-sm text-gray-500">You don't have access to this region. Contact a PUG admin to get added.</p>
            </div>
          ) : (
            <QueueForm onJoin={(roles) => apiAction('/queue', { roles })} blockedRoles={blockedRoles ?? []} approvedRoles={approvedRoles} />
          )}

          {isPugAdmin && (
            <TestAddDummy lobbyId={id} onAdded={fetchState} />
          )}
        </div>
      )}

      {/* ── READY: ready check ── */}
      {lobby.status === 'READY' && (() => {
        const readyCount = players.filter((p) => p.readyConfirmed).length
        return (
          <div className="space-y-4">
            <div className="border border-green-800/40 rounded-xl overflow-hidden bg-gradient-to-b from-green-950/30 to-gray-950/80">
              <div className="text-center py-8 px-4">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-green-400">Match Found</p>
                </div>
                <p className="text-gray-400 text-sm mb-2">All players must ready up to start the draft.</p>
                {lobby.readyAt && (
                  <p className="text-sm mb-6 text-gray-500">
                    Time remaining: <Countdown deadline={new Date(new Date(lobby.readyAt).getTime() + 120000).toISOString()} />
                  </p>
                )}
                {inLobby && !me?.readyConfirmed && (
                  <button
                    onClick={() => apiAction('/ready', {})}
                    className="px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/25 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 text-base font-bold"
                  >
                    Ready Up
                  </button>
                )}
                {inLobby && me?.readyConfirmed && (
                  <div className="flex justify-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-900/30 border border-green-800/40">
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-green-300 font-semibold text-sm">You're ready!</span>
                    </div>
                  </div>
                )}
                {isPugAdmin && (
                  <div className="mt-4">
                    <button
                      onClick={() => apiAction('/force-ready', {})}
                      className="px-4 py-2 bg-red-600/15 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-sm font-semibold"
                    >
                      Force Ready All (Admin)
                    </button>
                  </div>
                )}
              </div>
              {/* Ready progress bar */}
              <div className="px-4 pb-3">
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all duration-500"
                    style={{ width: `${(readyCount / players.length) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 text-center mt-1.5">{readyCount}/{players.length} ready</p>
              </div>
            </div>

            <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950/50">
              <div className="px-4 py-2.5 bg-gradient-to-r from-gray-900/80 to-gray-900/40 border-b border-gray-800">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Players</span>
              </div>
              <div className="divide-y divide-gray-800/50">
                {players.map((p) => (
                  <div key={p.userId} className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.03] ${p.readyConfirmed ? 'bg-green-950/10' : ''}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlayerAvatar player={p} size={28} />
                      <Link href={`/pugs/profile/${p.userId}`} className={`text-sm truncate hover:underline ${p.userId === currentUserId ? 'text-blue-300 font-medium' : 'text-gray-200 hover:text-white'}`}>
                        {p.name}{p.userId === currentUserId && ' (you)'}
                      </Link>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-lg shrink-0 font-medium transition-colors ${
                      p.readyConfirmed
                        ? 'bg-green-900/40 text-green-400 border border-green-800/50'
                        : 'bg-gray-800/50 text-gray-500 border border-gray-700/50'
                    }`}>
                      {p.readyConfirmed ? 'Ready' : 'Not ready'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {inLobby && (
              <button
                onClick={leaveQueue}
                className="px-4 py-2 border border-red-800 text-red-400 rounded-xl hover:bg-red-950 hover:border-red-700 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-sm"
              >
                Leave (penalised)
              </button>
            )}
          </div>
        )
      })()}

      {/* ── DRAFTING ── */}
      {lobby.status === 'DRAFTING' && lobby.draftState && (
        <DraftUI
          players={players}
          draftState={lobby.draftState}
          currentUserId={currentUserId}
          isCaptain={isCaptain}
          isPugAdmin={isPugAdmin}
          onPick={(pickedUserId) => apiAction('/draft/pick', { pickedUserId })}
        />
      )}

      {/* ── MAP VOTE ── */}
      {lobby.status === 'MAP_VOTE' && (
        <div className="space-y-4">
          <TeamsDisplay players={players} currentUserId={currentUserId} heroes={heroes} />
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Vote for a Map</h2>
              {lobby.mapVote?.voteDeadline && <Countdown deadline={lobby.mapVote.voteDeadline} />}
            </div>
            {!inLobby && !isPugAdmin && <p className="text-gray-500 text-sm mb-4">Spectating - only players can vote.</p>}
            {isPugAdmin && <p className="text-yellow-600 text-xs mb-4">Admin: clicking a map selects it for all players immediately.</p>}
            <div className="grid grid-cols-3 gap-3">
              {mapCandidates.map((m) => {
                const myVote = lobby.mapVote?.votes?.[String(currentUserId)]
                const voted = myVote === m.id
                const count = Object.values(lobby.mapVote?.votes ?? {}).filter((v) => v === m.id).length
                const canVote = inLobby || isPugAdmin
                return (
                  <button
                    key={m.id}
                    onClick={() => canVote && apiAction('/map-vote', { mapId: m.id })}
                    disabled={!canVote}
                    className={`relative overflow-hidden border rounded-xl transition-all duration-200 text-center group ${
                      voted
                        ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/10'
                        : 'border-gray-700 hover:border-gray-500 hover:scale-[1.03] hover:shadow-lg hover:shadow-black/20 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100'
                    }`}
                  >
                    {m.imageUrl ? (
                      <div className="relative h-24">
                        <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                        <div className={`absolute inset-0 ${voted ? 'bg-blue-900/60' : 'bg-black/40 group-hover:bg-black/30'} transition-colors`} />
                      </div>
                    ) : (
                      <div className={`h-24 ${voted ? 'bg-blue-900/30' : 'bg-gray-800/50'}`} />
                    )}
                    <div className={`px-3 py-2 ${voted ? 'bg-blue-950/80' : 'bg-gray-900/80'}`}>
                      <p className={`font-medium text-sm ${voted ? 'text-blue-200' : 'text-gray-200'}`}>{m.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{count} vote{count !== 1 ? 's' : ''}</p>
                    </div>
                  </button>
                )
              })}
            </div>
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
          isPugAdmin={isPugAdmin}
          onBan={(heroId) => apiAction('/ban', { heroId })}
          players={players}
          selectedMap={selectedMap}
        />
      )}

      {/* ── IN PROGRESS ── */}
      {lobby.status === 'IN_PROGRESS' && (
        <div className="space-y-4">
          {/* Lobby Setup Assistant */}
          <LobbySetupAssistant
            lobby={lobby}
            hostInfo={hostInfo}
            currentUserId={currentUserId}
            isPugAdmin={isPugAdmin}
            selectedMap={selectedMap}
            players={players}
            heroes={heroes}
            botEnabled={botEnabled}
            onHost={() => apiAction('/host', {})}
          />

          {lobby.botInstanceId && (
            <LiveScoreboard lobbyId={lobby.id} botStatus={lobby.botStatus ?? ''} />
          )}

          <TeamsDisplay players={players} currentUserId={currentUserId} heroes={heroes} banState={lobby.banState} />
          <VoiceChannelLinks
            myTeam={me?.team ?? null}
            voiceChannel1Id={lobby.voiceChannel1Id ?? null}
            voiceChannel2Id={lobby.voiceChannel2Id ?? null}
            guildId={guildId}
          />
          {(isCaptain || isPugAdmin) && (
            <div className="border border-gray-800/60 rounded-xl overflow-hidden bg-gray-900/40">
              <div className="px-4 py-2.5 border-b border-gray-800/60">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {isPugAdmin && !isCaptain ? 'Admin - Submit Result' : 'Submit Result (Captain Only)'}
                </span>
              </div>
              <div className="px-4 py-3 grid grid-cols-3 gap-3">
                <button onClick={() => apiAction(isPugAdmin && !isCaptain ? '/resolve' : '/report', { result: 'team1' })} className="px-4 py-2.5 bg-blue-600/15 border border-blue-500/30 text-blue-300 rounded-xl hover:bg-blue-600/25 hover:shadow-lg hover:shadow-blue-500/10 hover:scale-[1.02] active:scale-[0.98] text-sm transition-all duration-200 font-semibold">Team 1 Won</button>
                <button onClick={() => apiAction(isPugAdmin && !isCaptain ? '/resolve' : '/report', { result: 'team2' })} className="px-4 py-2.5 bg-orange-600/15 border border-orange-500/30 text-orange-300 rounded-xl hover:bg-orange-600/25 hover:shadow-lg hover:shadow-orange-500/10 hover:scale-[1.02] active:scale-[0.98] text-sm transition-all duration-200 font-semibold">Team 2 Won</button>
                <button onClick={() => apiAction(isPugAdmin && !isCaptain ? '/resolve' : '/report', { result: 'draw' })} className="px-4 py-2.5 border border-gray-700 text-gray-400 rounded-xl hover:bg-gray-800 hover:border-gray-600 hover:scale-[1.02] active:scale-[0.98] text-sm transition-all duration-200">Draw</button>
              </div>
            </div>
          )}
          {inLobby && me && <RequeueButton lobby={lobby} me={me} />}
        </div>
      )}

      {/* ── REPORTING ── */}
      {lobby.status === 'REPORTING' && (
        <div className="space-y-4">
          {(() => {
            const pending = lobby.pendingResult as any
            const resultColor = pending?.result === 'team1' ? 'blue' : pending?.result === 'team2' ? 'orange' : 'gray'
            const resultLabel = pending?.result === 'team1' ? 'Team 1 Won' : pending?.result === 'team2' ? 'Team 2 Won' : 'Draw'
            const reporter = pending ? players.find((p) => p.userId === pending.reportedBy) : null
            const isOpposingCaptain = isCaptain && me?.team !== reporter?.team
            return pending ? (
              <div className={`border rounded-xl overflow-hidden ${
                resultColor === 'blue' ? 'border-blue-800/60 bg-gradient-to-b from-blue-950/30 to-gray-950/80'
                : resultColor === 'orange' ? 'border-orange-800/60 bg-gradient-to-b from-orange-950/30 to-gray-950/80'
                : 'border-gray-700/60 bg-gradient-to-b from-gray-900/50 to-gray-950/80'
              }`}>
                <div className="px-5 py-4 text-center space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                      resultColor === 'blue' ? 'bg-blue-400' : resultColor === 'orange' ? 'bg-orange-400' : 'bg-gray-400'
                    }`} />
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Awaiting Confirmation</p>
                  </div>
                  <p className="text-lg font-bold text-white">{resultLabel}</p>
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                    <span>Reported by {reporter?.name ?? 'Unknown'}</span>
                    <span className="text-gray-700">-</span>
                    <span>auto-confirms in {lobby.reportingAt ? <Countdown deadline={new Date(new Date(lobby.reportingAt).getTime() + 120000).toISOString()} /> : '2 min'}</span>
                  </div>
                  {isOpposingCaptain && (
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <button
                        onClick={() => apiAction('/confirm', { action: 'confirm' })}
                        className="px-5 py-2.5 bg-green-700/80 text-green-100 rounded-xl hover:bg-green-600 hover:shadow-lg hover:shadow-green-600/20 hover:scale-[1.02] active:scale-[0.98] text-sm font-semibold transition-all duration-200"
                      >
                        Confirm Result
                      </button>
                      <button
                        onClick={() => apiAction('/confirm', { action: 'dispute' })}
                        className="px-5 py-2.5 border border-red-800 text-red-400 rounded-xl hover:bg-red-950 hover:border-red-700 hover:scale-[1.02] active:scale-[0.98] text-sm font-medium transition-all duration-200"
                      >
                        Dispute
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null
          })()}
          <TeamsDisplay players={players} currentUserId={currentUserId} heroes={heroes} banState={lobby.banState} />
          {inLobby && me && <RequeueButton lobby={lobby} me={me} />}
        </div>
      )}

      {/* ── TERMINAL STATES ── */}
      {lobby.status === 'COMPLETED' && (() => {
        const pending = lobby.pendingResult as any
        const resultColor = pending?.result === 'team1' ? 'blue' : pending?.result === 'team2' ? 'orange' : 'gray'
        const resultLabel = pending?.result === 'team1' ? 'Team 1 Won' : pending?.result === 'team2' ? 'Team 2 Won' : 'Draw'
        const disputeDeadline = lobby.completedAt
          ? new Date(new Date(lobby.completedAt).getTime() + 600000).toISOString()
          : null
        const canDispute = disputeDeadline && new Date(disputeDeadline).getTime() > Date.now()
        const isOpposingCaptain = isCaptain && pending && me?.team !== players.find((p: Player) => p.userId === pending.reportedBy)?.team
        return (
          <div className="space-y-4">
            <div className={`border rounded-xl overflow-hidden text-center py-8 ${
              resultColor === 'blue' ? 'border-blue-800/40 bg-gradient-to-b from-blue-950/20 to-gray-950/80'
              : resultColor === 'orange' ? 'border-orange-800/40 bg-gradient-to-b from-orange-950/20 to-gray-950/80'
              : 'border-gray-700/40 bg-gradient-to-b from-gray-900/30 to-gray-950/80'
            }`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Match Complete</p>
              {pending && <p className="text-2xl font-bold text-white mb-2">{resultLabel}</p>}
              {selectedMap && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/60 border border-gray-800/60">
                  {selectedMap.imageUrl && <img src={selectedMap.imageUrl} alt="" className="w-6 h-6 rounded object-cover" />}
                  <span className="text-sm text-gray-300">{selectedMap.name}</span>
                </div>
              )}
            </div>
            <TeamsDisplay players={players} currentUserId={currentUserId} heroes={heroes} banState={lobby.banState} />
            {linkedScrimId && (
              <div className="text-center">
                <Link
                  href={`/scrims/${linkedScrimId}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600/15 border border-cyan-500/30 text-cyan-300 rounded-xl hover:bg-cyan-600/25 hover:shadow-lg hover:shadow-cyan-500/10 hover:scale-[1.02] active:scale-[0.98] text-sm font-semibold transition-all duration-200"
                >
                  View Match Stats
                </Link>
              </div>
            )}
            {canDispute && isOpposingCaptain && (
              <div className="border border-yellow-900/50 rounded-xl p-4 text-center bg-yellow-950/10">
                <p className="text-sm text-yellow-400 mb-3">
                  Dispute window closes in {disputeDeadline && <Countdown deadline={disputeDeadline} />}
                </p>
                <button
                  onClick={() => apiAction('/confirm', { action: 'dispute' })}
                  className="px-5 py-2.5 border border-red-800 text-red-400 rounded-xl hover:bg-red-950 hover:border-red-700 hover:scale-[1.02] active:scale-[0.98] text-sm font-medium transition-all duration-200"
                >
                  Dispute Result
                </button>
              </div>
            )}
            {inLobby && me && <RequeueButton lobby={lobby} me={me} />}
            <div className="text-center pt-2">
              <Link href={lobby.tier === 'invite' ? '/pugs/invite' : '/pugs/open'} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                Back to {lobby.tier === 'invite' ? 'Invite' : 'Open'} Tier
              </Link>
            </div>
          </div>
        )
      })()}

      {lobby.status === 'CANCELLED' && (
        <div className="space-y-4">
          <div className="border border-red-900/30 rounded-xl text-center py-10 bg-gradient-to-b from-red-950/10 to-gray-950/80">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Match Cancelled</p>
            <p className="text-lg text-gray-400">This lobby has been cancelled.</p>
          </div>
          <div className="text-center">
            <Link href={lobby.tier === 'invite' ? '/pugs/invite' : '/pugs/open'} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
              Back to {lobby.tier === 'invite' ? 'Invite' : 'Open'} Tier
            </Link>
          </div>
        </div>
      )}

      {lobby.status === 'DISPUTED' && (
        <div className="space-y-4">
          <div className="border border-yellow-800/40 rounded-xl text-center py-8 bg-gradient-to-b from-yellow-950/20 to-gray-950/80">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" />
              <p className="text-xs font-semibold uppercase tracking-wider text-yellow-500">Result Disputed</p>
            </div>
            <p className="text-gray-400 text-sm mt-1">
              {isPugAdmin ? 'Resolve this dispute by selecting the correct result below.' : 'An admin will review and resolve this match.'}
            </p>
          </div>
          <TeamsDisplay players={players} currentUserId={currentUserId} heroes={heroes} banState={lobby.banState} />
          {isPugAdmin && (
            <div className="border border-red-900/40 rounded-xl overflow-hidden bg-gray-900/40">
              <div className="px-4 py-2.5 bg-red-950/30 border-b border-red-900/40">
                <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Admin - Resolve Dispute</span>
              </div>
              <div className="px-4 py-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button onClick={() => apiAction('/resolve', { result: 'team1' })} className="px-4 py-2.5 bg-blue-600/15 border border-blue-500/30 text-blue-300 rounded-xl hover:bg-blue-600/25 hover:shadow-lg hover:shadow-blue-500/10 hover:scale-[1.02] active:scale-[0.98] text-sm transition-all duration-200 font-semibold">Team 1 Won</button>
                <button onClick={() => apiAction('/resolve', { result: 'team2' })} className="px-4 py-2.5 bg-orange-600/15 border border-orange-500/30 text-orange-300 rounded-xl hover:bg-orange-600/25 hover:shadow-lg hover:shadow-orange-500/10 hover:scale-[1.02] active:scale-[0.98] text-sm transition-all duration-200 font-semibold">Team 2 Won</button>
                <button onClick={() => apiAction('/resolve', { result: 'draw' })} className="px-4 py-2.5 border border-gray-700 text-gray-400 rounded-xl hover:bg-gray-800 hover:border-gray-600 hover:scale-[1.02] active:scale-[0.98] text-sm transition-all duration-200">Draw</button>
                <button
                  onClick={async () => { if (await confirm({ message: 'Cancel this match? No rating changes will be applied.', variant: 'danger' })) apiAction('/resolve', { result: 'cancel' }) }}
                  className="px-4 py-2.5 border border-red-800 text-red-400 rounded-xl hover:bg-red-950 hover:border-red-700 hover:scale-[1.02] active:scale-[0.98] text-sm transition-all duration-200"
                >Cancel Match</button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

// ── Queue join form ──

function SpotsNeeded({ neededSlots, spotsAvailable, totalPlayers }: { neededSlots: Record<string, number> | null; spotsAvailable: Record<string, number>; totalPlayers: number }) {
  const roles = ['tank', 'flex_dps', 'hitscan_dps', 'flex_support', 'main_support']
  const spotsLeft = 10 - totalPlayers

  if (!neededSlots) {
    return (
      <p className="text-xs text-red-500">
        Role conflict - remove a player to restore a valid state.
      </p>
    )
  }

  const open = roles.filter((r) => (spotsAvailable[r] ?? 0) > 0)
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 shrink-0">{spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} needed:</span>
      {open.length === 0 ? (
        <span className="text-xs text-green-600">All roles filled</span>
      ) : (
        open.map((role) => (
          <span key={role} className={`text-xs px-2 py-0.5 rounded border ${ROLE_COLORS[role]}`}>
            {spotsAvailable[role]}× {ROLE_LABELS[role]}
          </span>
        ))
      )}
    </div>
  )
}

function QueueForm({ onJoin, blockedRoles, approvedRoles }: { onJoin: (roles: string[]) => void; blockedRoles: string[]; approvedRoles: string[] | null }) {
  const [selected, setSelected] = useState<string[]>([])
  const allRoles = ['tank', 'flex_dps', 'hitscan_dps', 'flex_support', 'main_support']
  const roles = approvedRoles !== null
    ? allRoles.filter((r) => approvedRoles.includes(r))
    : allRoles

  function toggle(role: string) {
    if (blockedRoles.includes(role)) return
    setSelected((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role])
  }

  if (roles.length === 0) {
    return (
      <div className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
        <p className="text-sm text-gray-500">You have no approved roles for this lobby. Contact a PUG admin to get roles assigned.</p>
      </div>
    )
  }

  return (
    <div className="border border-gray-800 rounded-xl p-5 bg-gradient-to-b from-gray-900/60 to-gray-950/60">
      <p className="text-sm font-medium text-gray-300 mb-3">Select your roles to queue:</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {roles.map((role) => {
          const blocked = blockedRoles.includes(role)
          return (
            <button
              key={role}
              onClick={() => toggle(role)}
              disabled={blocked}
              title={blocked ? 'Role slots full' : undefined}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-all duration-200 ${
                blocked
                  ? 'border-gray-800 text-gray-600 cursor-not-allowed'
                  : selected.includes(role)
                    ? ROLE_COLORS[role] + ' font-medium shadow-md'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:scale-[1.03] active:scale-[0.97]'
              }`}
            >
              {ROLE_LABELS[role]}{blocked ? ' (Full)' : ''}
            </button>
          )
        })}
      </div>
      <button
        onClick={() => selected.length > 0 && onJoin(selected)}
        disabled={selected.length === 0}
        className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none text-sm font-medium transition-all duration-200"
      >
        Join Queue
      </button>
    </div>
  )
}

// ── Draft UI ──

function DraftUI({
  players, draftState, currentUserId, isCaptain, isPugAdmin, onPick,
}: {
  players: Player[]
  draftState: any
  currentUserId: number | null
  isCaptain: boolean
  isPugAdmin: boolean
  onPick: (id: number) => void
}) {
  const myTeam = players.find((p) => p.userId === currentUserId)?.team
  const isMyTurn = isPugAdmin || (isCaptain && draftState.currentPickTeam === myTeam)

  const team1 = players.filter((p) => p.team === 1)
  const team2 = players.filter((p) => p.team === 2)
  const undrafted = players.filter((p) => p.team === null && !p.isCaptain)
  const captains = players.filter((p) => p.isCaptain)
  const pickingTeam = draftState.currentPickTeam as 1 | 2

  const TEAM_BORDER = { 1: 'border-blue-800/50', 2: 'border-orange-800/50' } as const
  const TEAM_HEADER = { 1: 'from-blue-950/50 to-blue-950/20', 2: 'from-orange-950/50 to-orange-950/20' } as const
  const TEAM_TEXT = { 1: 'text-blue-300', 2: 'text-orange-300' } as const
  const TEAM_ACCENT = { 1: 'bg-blue-500', 2: 'bg-orange-500' } as const

  return (
    <div className="space-y-4">
      {/* Turn banner */}
      <div className={`flex items-center justify-between px-5 py-3.5 rounded-xl border ${
        isMyTurn
          ? 'bg-gradient-to-r from-blue-950/60 to-blue-950/30 border-blue-700/60 text-blue-200'
          : 'bg-gray-900/60 border-gray-700/60 text-gray-400'
      }`}>
        <div className="flex items-center gap-2.5">
          {(isCaptain && draftState.currentPickTeam === myTeam) && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
          <span className="font-semibold text-sm">
            {isCaptain && draftState.currentPickTeam === myTeam
              ? "Your turn to pick!"
              : isPugAdmin
                ? `Admin - Team ${pickingTeam} is picking`
                : `Waiting for Team ${pickingTeam}...`}
          </span>
        </div>
        <span className="flex items-center gap-2 text-xs text-gray-400">
          Pick {draftState.pickNumber + 1}/8
          {draftState.pickDeadline && <Countdown deadline={draftState.pickDeadline} />}
        </span>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-2 gap-3">
        {([1, 2] as const).map((t) => {
          const teamPlayers = t === 1 ? team1 : team2
          const cap = captains.find((c) => c.team === t)
          const isPicking = pickingTeam === t
          return (
            <div key={t} className={`rounded-xl border overflow-hidden bg-gray-950/50 transition-all duration-200 ${TEAM_BORDER[t]} ${isPicking ? 'ring-1 ring-offset-1 ring-offset-black ' + (t === 1 ? 'ring-blue-600/50' : 'ring-orange-600/50') : ''}`}>
              <div className={`px-4 py-2.5 bg-gradient-to-r ${TEAM_HEADER[t]} border-b ${TEAM_BORDER[t]}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${TEAM_ACCENT[t]} ${isPicking ? 'animate-pulse' : ''}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${TEAM_TEXT[t]}`}>Team {t}</span>
                  {cap && <span className="text-xs text-gray-500 ml-1">C: {cap.name}</span>}
                  {isPicking && <span className={`ml-auto text-xs font-medium ${TEAM_TEXT[t]}`}>picking</span>}
                </div>
              </div>
              <ul>
                {teamPlayers.map((p, i) => (
                  <li key={p.userId} className={`flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-white/[0.03] ${i < teamPlayers.length - 1 ? 'border-b border-gray-800/30' : ''}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlayerAvatar player={p} size={26} />
                      <Link href={`/pugs/profile/${p.userId}`} className={`text-sm truncate min-w-0 hover:underline ${p.userId === currentUserId ? TEAM_TEXT[t] + ' font-semibold' : 'text-gray-200 hover:text-white'}`}>
                        {p.name}{p.isCaptain && ' ★'}{p.userId === currentUserId && ' (you)'}
                      </Link>
                    </div>
                    {p.assignedRole && <span className="shrink-0"><RoleBadge role={p.assignedRole} /></span>}
                  </li>
                ))}
                {teamPlayers.length === 0 && (
                  <li className="px-4 py-4 text-xs text-gray-600 text-center">No players yet</li>
                )}
              </ul>
            </div>
          )
        })}
      </div>

      {/* Available pool */}
      <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950/50">
        <div className="px-4 py-2.5 bg-gradient-to-r from-gray-900/80 to-gray-900/40 border-b border-gray-800">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Available players</span>
        </div>
        <div className="divide-y divide-gray-800/40">
          {undrafted.map((p) => {
            const teamPlayers = pickingTeam === 1 ? team1 : team2
            const takenRoles = new Set(teamPlayers.map((tp) => tp.assignedRole).filter(Boolean))
            const roleBlocked = p.assignedRole ? takenRoles.has(p.assignedRole) : false
            return (
              <div key={p.userId} className={`flex items-center gap-3 px-4 py-3 transition-all duration-200 ${roleBlocked ? 'opacity-30' : 'hover:bg-white/[0.03]'}`}>
                <PlayerAvatar player={p} size={28} />
                <Link href={`/pugs/profile/${p.userId}`} className="text-sm text-gray-200 hover:text-white hover:underline flex-1 font-medium">{p.name}</Link>
                {p.assignedRole && <RoleBadge role={p.assignedRole} />}
                {roleBlocked && <span className="text-xs text-gray-600 italic">role taken</span>}
                {isMyTurn && (
                  <button
                    onClick={() => !roleBlocked && onPick(p.userId)}
                    disabled={roleBlocked}
                    className="px-3.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 hover:shadow-md hover:shadow-blue-500/20 hover:scale-[1.05] active:scale-[0.95] transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none shrink-0"
                  >
                    Pick
                  </button>
                )}
              </div>
            )
          })}
          {undrafted.length === 0 && (
            <p className="px-4 py-5 text-sm text-gray-600 text-center">All players drafted</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Ban UI ──

function BanUI({
  banState, draftState, heroes, currentUserId, isCaptain, isPugAdmin, onBan, players, selectedMap,
}: {
  banState: any
  draftState: any
  heroes: Hero[]
  currentUserId: number | null
  isCaptain: boolean
  isPugAdmin: boolean
  onBan: (id: number) => void
  players?: Player[]
  selectedMap?: { id: number; name: string; type?: string; imageUrl?: string | null } | null
}) {
  const [filter, setFilter] = useState('')
  const existingBans: Array<{ heroId: number; team: number; banNumber: number }> = banState.bans ?? []

  const isMyTurn = isPugAdmin || (isCaptain && (() => {
    if (!draftState) return false
    if (banState.currentBanTeam === 1 && draftState.captain1Id === currentUserId) return true
    if (banState.currentBanTeam === 2 && draftState.captain2Id === currentUserId) return true
    return false
  })())

  const bannedIds = new Set(existingBans.map((b) => b.heroId))
  const filtered = heroes.filter(
    (h) => !bannedIds.has(h.id) && h.name.toLowerCase().includes(filter.toLowerCase()),
  )
  const roleOrder = ['tank', 'damage', 'support']
  const ungrouped = filtered.reduce<Record<string, Hero[]>>((acc, h) => {
    ;(acc[h.role] ??= []).push(h)
    return acc
  }, {})
  const grouped: Record<string, Hero[]> = {}
  for (const role of roleOrder) {
    if (ungrouped[role]) {
      grouped[role] = ungrouped[role].sort((a, b) => a.name.localeCompare(b.name))
    }
  }
  for (const [role, hs] of Object.entries(ungrouped)) {
    if (!grouped[role]) {
      grouped[role] = hs.sort((a, b) => a.name.localeCompare(b.name))
    }
  }

  const bansByTeam = [1, 2].map((t) => ({
    team: t,
    bans: existingBans.filter((b) => b.team === t).sort((a, b) => a.banNumber - b.banNumber),
  }))

  const TEAM_BADGE = {
    1: 'bg-blue-950 border-blue-800 text-blue-300',
    2: 'bg-orange-950 border-orange-800 text-orange-300',
  } as const

  return (
    <div className="space-y-4">
      {/* Turn banner */}
      <div className={`flex items-center justify-between px-5 py-3.5 rounded-xl border ${
        isMyTurn
          ? 'bg-gradient-to-r from-blue-950/60 to-blue-950/30 border-blue-700/60 text-blue-200'
          : 'bg-gray-900/60 border-gray-700/60 text-gray-400'
      }`}>
        <div className="flex items-center gap-2.5">
          {isMyTurn && !isPugAdmin && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
          <span className="font-semibold text-sm">
            {isMyTurn
              ? isPugAdmin && !isCaptain
                ? `Admin - Team ${banState.currentBanTeam} is banning`
                : "Your turn to ban!"
              : `Team ${banState.currentBanTeam} is banning...`}
          </span>
        </div>
        <span className="flex items-center gap-2 text-xs text-gray-400">
          Ban {banState.banNumber}/2
          {banState.banDeadline && <Countdown deadline={banState.banDeadline} />}
        </span>
      </div>

      {/* Bans so far */}
      {existingBans.length > 0 && (
        <div className="border border-gray-800/60 rounded-xl p-4 bg-gray-900/40 space-y-2.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bans</p>
          {bansByTeam.map(({ team, bans }) => bans.length > 0 && (
            <div key={team} className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border shrink-0 ${TEAM_BADGE[team as 1 | 2]}`}>
                Team {team}
              </span>
              {bans.map((b) => {
                const hero = heroes.find((h) => h.id === b.heroId)
                return (
                  <span key={b.heroId} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-red-950/40 border border-red-900/50 text-red-400">
                    {hero?.imageUrl && <img src={hero.imageUrl} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-red-900/50" />}
                    <span className="line-through">{hero?.name ?? `#${b.heroId}`}</span>
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Teams & map context */}
      {players && players.length > 0 && (
        <TeamsDisplay players={players} currentUserId={currentUserId} heroes={heroes} />
      )}
      {selectedMap && (
        <div className="border border-gray-800/60 rounded-xl overflow-hidden flex items-center bg-gray-900/40">
          {selectedMap.imageUrl && (
            <img src={selectedMap.imageUrl} alt={selectedMap.name} className="w-20 h-14 object-cover shrink-0" />
          )}
          <div className="px-4 py-2.5">
            <span className="text-sm font-medium text-gray-200">{selectedMap.name}</span>
            <span className="text-xs text-gray-500 ml-2">({selectedMap.type})</span>
          </div>
        </div>
      )}

      {/* Ban picker */}
      {isMyTurn ? (
        <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950/50">
          <div className="px-4 py-3 bg-gradient-to-r from-gray-900/80 to-gray-900/40 border-b border-gray-800">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search heroes..."
              className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none"
            />
          </div>
          <div className="p-4 space-y-5">
            {Object.entries(grouped).map(([role, hs]) => {
              const roleStyle: Record<string, string> = {
                tank: 'border-blue-800/40 text-blue-300 hover:bg-blue-950/40 hover:border-blue-700/60',
                damage: 'border-orange-800/40 text-orange-300 hover:bg-orange-950/40 hover:border-orange-700/60',
                dps: 'border-orange-800/40 text-orange-300 hover:bg-orange-950/40 hover:border-orange-700/60',
                support: 'border-green-800/40 text-green-300 hover:bg-green-950/40 hover:border-green-700/60',
              }
              const style = roleStyle[role] ?? 'border-gray-700 text-gray-300 hover:bg-gray-800/40'
              return (
                <div key={role}>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2.5">{role}</p>
                  <div className="flex flex-wrap gap-2">
                    {hs.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => onBan(h.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:scale-[1.03] active:scale-[0.97] transition-all duration-150 ${style}`}
                      >
                        {h.imageUrl && <img src={h.imageUrl} alt="" className="w-6 h-6 rounded-full object-cover" />}
                        {h.name}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            {Object.keys(grouped).length === 0 && (
              <p className="text-sm text-gray-600 text-center py-2">No heroes match your search</p>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-gray-800 rounded-xl px-4 py-8 text-center text-gray-500 text-sm bg-gray-950/50">
          Waiting for Team {banState.currentBanTeam} to ban...
        </div>
      )}
    </div>
  )
}

// ── Teams display ──

function TeamsDisplay({ players, currentUserId, heroes, banState }: { players: Player[]; currentUserId: number | null; heroes?: Hero[]; banState?: any }) {
  const team1 = players.filter((p) => p.team === 1)
  const team2 = players.filter((p) => p.team === 2)

  const bansByTeam = banState?.bans
    ? [1, 2].map((t) => ({
        team: t,
        bans: (banState.bans as Array<{ heroId: number; team: number; banNumber: number }>)
          .filter((b) => b.team === t)
          .sort((a, b) => a.banNumber - b.banNumber),
      }))
    : []

  const TEAM_CONFIG = {
    1: {
      border: 'border-blue-800/50',
      header: 'from-blue-950/50 to-blue-950/20',
      headerText: 'text-blue-300',
      highlight: 'text-blue-300',
      accent: 'bg-blue-500',
    },
    2: {
      border: 'border-orange-800/50',
      header: 'from-orange-950/50 to-orange-950/20',
      headerText: 'text-orange-300',
      highlight: 'text-orange-300',
      accent: 'bg-orange-500',
    },
  } as const

  return (
    <div className="space-y-3">
      {bansByTeam.some((t) => t.bans.length > 0) && (
        <div className="border border-gray-800/60 rounded-xl p-3 bg-gray-900/40 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hero Bans</p>
          <div className="flex gap-4 flex-wrap">
            {bansByTeam.map(({ team, bans }) => bans.length > 0 && (
              <div key={team} className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border shrink-0 ${team === 1 ? 'bg-blue-950/60 border-blue-800/60 text-blue-400' : 'bg-orange-950/60 border-orange-800/60 text-orange-400'}`}>
                  Team {team}
                </span>
                {bans.map((b) => {
                  const hero = heroes?.find((h) => h.id === b.heroId)
                  return (
                    <span key={b.heroId} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-red-950/40 border border-red-900/50 text-red-400">
                      {hero?.imageUrl ? (
                        <img src={hero.imageUrl} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-red-900/50" />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-red-900/40 flex items-center justify-center text-[9px] font-bold">X</span>
                      )}
                      <span className="line-through">{hero?.name ?? `#${b.heroId}`}</span>
                    </span>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {([{ label: 'Team 1', t: 1, list: team1 }, { label: 'Team 2', t: 2, list: team2 }] as const).map(({ label, t, list }) => {
          const cfg = TEAM_CONFIG[t]
          return (
            <div key={label} className={`border rounded-xl overflow-hidden ${cfg.border} bg-gray-950/50`}>
              <div className={`px-4 py-2.5 bg-gradient-to-r ${cfg.header} border-b ${cfg.border}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cfg.accent}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${cfg.headerText}`}>{label}</span>
                  <span className="text-xs text-gray-500 ml-auto">{list.length} players</span>
                </div>
              </div>
              <ul>
                {list.map((p, i) => (
                  <li key={p.userId} className={`flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-white/[0.03] ${i < list.length - 1 ? 'border-b border-gray-800/30' : ''}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlayerAvatar player={p} size={28} />
                      <div className="min-w-0">
                        <Link href={`/pugs/profile/${p.userId}`} className={`text-sm truncate block hover:underline ${p.userId === currentUserId ? cfg.highlight + ' font-semibold' : 'text-gray-200 hover:text-white'}`}>
                          {p.name}{p.isCaptain && ' ★'}{p.userId === currentUserId && ' (you)'}
                        </Link>
                      </div>
                    </div>
                    {p.assignedRole && <span className="shrink-0"><RoleBadge role={p.assignedRole} /></span>}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
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
  const discordIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z"/>
    </svg>
  )

  return (
    <div className="border border-gray-800/60 rounded-xl p-4 bg-gray-900/40">
      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Voice Channels</p>
      <div className="grid grid-cols-2 gap-3">
        {voiceChannel1Id && (
          <a
            href={channelUrl(voiceChannel1Id)}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
              myTeam === 1
                ? 'bg-blue-600/20 border-2 border-blue-500/50 text-blue-200 hover:bg-blue-600/30 hover:shadow-lg hover:shadow-blue-500/10'
                : 'bg-gray-800/50 border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
            }`}
          >
            {discordIcon}
            Team 1 Voice{myTeam === 1 ? ' (yours)' : ''}
          </a>
        )}
        {voiceChannel2Id && (
          <a
            href={channelUrl(voiceChannel2Id)}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
              myTeam === 2
                ? 'bg-orange-600/20 border-2 border-orange-500/50 text-orange-200 hover:bg-orange-600/30 hover:shadow-lg hover:shadow-orange-500/10'
                : 'bg-gray-800/50 border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
            }`}
          >
            {discordIcon}
            Team 2 Voice{myTeam === 2 ? ' (yours)' : ''}
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
    <div className="border border-dashed border-gray-700/60 rounded-xl p-4 mt-2 bg-gray-900/30">
      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Admin - Add Dummy Player</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {roles.map((role) => (
          <button
            key={role}
            onClick={() => toggle(role)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 ${
              selected.includes(role)
                ? ROLE_COLORS[role] + ' font-medium shadow-md'
                : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:scale-[1.03] active:scale-[0.97]'
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
        className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 text-white rounded-lg transition-all duration-200"
      >
        {loading ? 'Adding...' : 'Add Dummy'}
      </button>
    </div>
  )
}

// ── Copy button ──

function CopyButton({ text, label, className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors ${
        copied
          ? 'bg-green-900/50 border-green-700 text-green-400'
          : 'border-gray-700 text-gray-400 hover:bg-gray-800 hover:border-gray-600'
      } ${className ?? ''}`}
    >
      {copied ? '✓ Copied' : label ?? '📋 Copy'}
    </button>
  )
}

// ── Requeue button ──

function RequeueButton({ lobby, me }: { lobby: any; me: Player }) {
  const [status, setStatus] = useState<'idle' | 'queued' | 'placed'>('idle')
  const [placedLobbyId, setPlacedLobbyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const timerStarted = useRef(false)

  useEffect(() => {
    if (['REPORTING', 'COMPLETED'].includes(lobby.status)) {
      setVisible(true)
      return
    }
    if (lobby.status === 'IN_PROGRESS' && !timerStarted.current) {
      timerStarted.current = true
      const timer = setTimeout(() => setVisible(true), 120_000)
      return () => clearTimeout(timer)
    }
  }, [lobby.status])

  async function handleRequeue() {
    setError(null)
    const res = await fetch('/api/pug/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles: me.queuedRoles, tier: lobby.tier, region: lobby.region }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to queue')
      return
    }
    if (data.placed) {
      setStatus('placed')
      setPlacedLobbyId(data.lobbyId)
    } else {
      setStatus('queued')
    }
  }

  async function handleCancel() {
    await fetch(`/api/pug/queue?tier=${lobby.tier}`, { method: 'DELETE' })
    setStatus('idle')
    setError(null)
  }

  if (!visible) return null

  if (status === 'placed' && placedLobbyId) {
    return (
      <div className="border border-green-700/50 rounded-xl p-4 bg-gradient-to-r from-green-950/30 to-gray-950/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-semibold text-green-200">Placed in next game!</span>
          </div>
          <Link
            href={`/pugs/lobby/${placedLobbyId}`}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            Go to Lobby
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'queued') {
    return (
      <div className="flex items-center justify-between border border-cyan-800/40 rounded-xl p-4 bg-gradient-to-r from-cyan-950/20 to-gray-950/80">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-sm font-medium text-cyan-200">Queued for next game</span>
        </div>
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 text-sm border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800 hover:border-gray-600 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      <button
        onClick={handleRequeue}
        className="w-full px-4 py-3 border border-cyan-800/50 text-cyan-300 rounded-xl bg-cyan-950/15 hover:bg-cyan-950/30 hover:border-cyan-700/60 hover:shadow-lg hover:shadow-cyan-500/10 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 text-sm font-semibold"
      >
        Requeue for Next Game
      </button>
    </div>
  )
}

// ── Live Scoreboard ──

type LivePlayerStats = {
  team: string
  hero: string
  finalBlows: number
  deaths: number
  damageDelt: number
  healingDealt: number
}

type LiveStats = {
  map: string | null
  mapType: string | null
  team1: { name: string; score: number; players: Record<string, LivePlayerStats> }
  team2: { name: string; score: number; players: Record<string, LivePlayerStats> }
  round: number
  matchTime: number
  matchEnded: boolean
  matchResult: string | null
  eventCount: number
}

function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function fmtStat(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function LiveScoreboard({ lobbyId, botStatus }: { lobbyId: number; botStatus: string }) {
  const [stats, setStats] = useState<LiveStats | null>(null)

  useEffect(() => {
    if (!['game_started', 'players_joining'].includes(botStatus)) {
      setStats(null)
      return
    }

    let active = true
    async function poll() {
      try {
        const res = await fetch(`/api/pug/lobby/${lobbyId}/live-stats`)
        if (res.ok && active) {
          const data = await res.json()
          if (data.liveStats) setStats(data.liveStats)
        }
      } catch { /* ignore */ }
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => { active = false; clearInterval(interval) }
  }, [lobbyId, botStatus])

  if (!stats || stats.eventCount === 0) return null

  const t1 = Object.entries(stats.team1.players)
  const t2 = Object.entries(stats.team2.players)
  if (t1.length === 0 && t2.length === 0) return null

  const renderTeam = (
    entries: [string, LivePlayerStats][],
    teamColor: 'blue' | 'orange',
    teamName: string,
  ) => {
    const colors = teamColor === 'blue'
      ? { header: 'text-blue-400', row: 'hover:bg-blue-950/20', border: 'border-blue-800/30' }
      : { header: 'text-orange-400', row: 'hover:bg-orange-950/20', border: 'border-orange-800/30' }

    return (
      <div>
        <div className={`text-[10px] font-bold uppercase tracking-wider ${colors.header} px-3 py-1.5`}>
          {teamName}
        </div>
        {entries.map(([name, p]) => (
          <div
            key={name}
            className={`grid grid-cols-[1fr_72px_32px_32px_48px_48px] gap-1 px-3 py-1.5 text-xs border-t ${colors.border} ${colors.row} transition-colors`}
          >
            <span className="text-gray-200 truncate">{name}</span>
            <span className="text-gray-500 truncate text-[11px]">{p.hero}</span>
            <span className="text-green-400 text-right font-medium">{p.finalBlows}</span>
            <span className="text-red-400 text-right font-medium">{p.deaths}</span>
            <span className="text-amber-400 text-right text-[11px]">{fmtStat(p.damageDelt)}</span>
            <span className="text-emerald-400 text-right text-[11px]">{fmtStat(p.healingDealt)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="border border-cyan-800/40 bg-gradient-to-b from-cyan-950/20 to-gray-950/80 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-cyan-950/30 border-b border-cyan-800/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Live Scoreboard</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {stats.map && (
            <span className="text-gray-400">
              {stats.map}
              {stats.mapType && <span className="text-gray-600"> · {stats.mapType}</span>}
            </span>
          )}
          {stats.round > 0 && <span>R{stats.round}</span>}
          <span className="font-mono">{fmtTime(stats.matchTime)}</span>
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center justify-center gap-6 py-3 border-b border-gray-800/40">
        <span className="text-sm font-bold text-blue-400">{stats.team1.name}</span>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-blue-300">{stats.team1.score}</span>
          <span className="text-gray-600 text-lg">—</span>
          <span className="text-2xl font-black text-orange-300">{stats.team2.score}</span>
        </div>
        <span className="text-sm font-bold text-orange-400">{stats.team2.name}</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_72px_32px_32px_48px_48px] gap-1 px-3 py-1.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-800/30">
        <span>Player</span>
        <span>Hero</span>
        <span className="text-right">K</span>
        <span className="text-right">D</span>
        <span className="text-right">Dmg</span>
        <span className="text-right">Heal</span>
      </div>

      {/* Teams */}
      {t1.length > 0 && renderTeam(t1, 'blue', stats.team1.name)}
      {t2.length > 0 && (
        <div className="border-t border-gray-700/50">
          {renderTeam(t2, 'orange', stats.team2.name)}
        </div>
      )}

      {/* Match result */}
      {stats.matchEnded && stats.matchResult && (
        <div className={`text-center py-2 text-xs font-bold border-t ${
          stats.matchResult === 'team1' ? 'bg-blue-950/30 border-blue-800/40 text-blue-300'
          : stats.matchResult === 'team2' ? 'bg-orange-950/30 border-orange-800/40 text-orange-300'
          : 'bg-gray-900/50 border-gray-700/40 text-gray-400'
        }`}>
          {stats.matchResult === 'team1' ? `${stats.team1.name} Wins!`
          : stats.matchResult === 'team2' ? `${stats.team2.name} Wins!`
          : 'Draw'}
        </div>
      )}
    </div>
  )
}

// ── Bot Hosting Panel ──

const BOT_STATUS_DISPLAY: Record<string, { label: string; color: string; pulse?: boolean; description: string; step: number }> = {
  warming_up: {
    label: 'Starting Up',
    color: 'text-cyan-400',
    pulse: true,
    step: 0,
    description: 'The bot is launching Overwatch. This usually takes about 30 seconds.',
  },
  preparing: {
    label: 'Creating Lobby',
    color: 'text-cyan-400',
    pulse: true,
    step: 0,
    description: 'Setting up the custom game lobby while teams pick maps and bans.',
  },
  lobby_ready: {
    label: 'Lobby Ready',
    color: 'text-cyan-400',
    step: 0,
    description: 'Lobby is created and waiting for match settings.',
  },
  creating: {
    label: 'Importing Settings',
    color: 'text-cyan-400',
    pulse: true,
    step: 0,
    description: 'Importing match settings with your map, bans, and workshop code.',
  },
  lobby_created: {
    label: 'Sending Invites',
    color: 'text-cyan-400',
    pulse: true,
    step: 1,
    description: 'Lobby ready! Sending invites to all 10 players now.',
  },
  invites_sent: {
    label: 'Invites Sent',
    color: 'text-blue-400',
    step: 1,
    description: 'All invites sent! Accept your invite in Overwatch to join the match.',
  },
  players_joining: {
    label: 'Players Joining',
    color: 'text-blue-400',
    pulse: true,
    step: 2,
    description: 'Players are joining the lobby. The game will start once everyone is in.',
  },
  game_started: {
    label: 'Match Live',
    color: 'text-green-400',
    step: 3,
    description: 'The match is live! Good luck, have fun.',
  },
  game_ended: {
    label: 'Game Ended',
    color: 'text-gray-400',
    step: 3,
    description: 'Match complete. Results are being processed...',
  },
  error: {
    label: 'Retrying...',
    color: 'text-yellow-400',
    pulse: true,
    step: 0,
    description: 'The bot ran into an issue and is recovering. It will retry automatically.',
  },
}

function BotHostingPanel({
  lobby, isPugAdmin, selectedMap, bannedHeroObjects, myTeam,
}: {
  lobby: any
  isPugAdmin: boolean
  selectedMap: LobbyData['selectedMap']
  bannedHeroObjects: Hero[]
  myTeam: number | null
}) {
  const [cmdLoading, setCmdLoading] = useState<string | null>(null)
  const [cmdError, setCmdError] = useState<string | null>(null)

  const botStatus = (lobby.botStatus as string) ?? 'warming_up'
  const defaultStatus = { label: botStatus, color: 'text-gray-400', description: '' }
  const statusInfo = BOT_STATUS_DISPLAY[botStatus] ?? defaultStatus

  async function sendBotCommand(command: string) {
    setCmdLoading(command)
    setCmdError(null)
    try {
      const res = await fetch('/api/pug/bot/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pugLobbyId: lobby.id, command }),
      })
      if (!res.ok) {
        const data = await res.json()
        setCmdError(data.error ?? 'Command failed')
      }
    } catch {
      setCmdError('Failed to send command')
    } finally {
      setCmdLoading(null)
    }
  }

  const gameActive = ['game_started', 'players_joining'].includes(botStatus)

  // Step progress tracking
  const steps = [
    { key: 'setup', label: 'Import Settings' },
    { key: 'invite', label: 'Send Invites' },
    { key: 'join', label: 'Players Join' },
    { key: 'play', label: 'Match Live' },
  ]
  const currentStep = statusInfo.step ?? 0
  const getStepState = (i: number) => {
    if (botStatus === 'error') return i === currentStep ? 'error' : i < currentStep ? 'done' : 'pending'
    if (botStatus === 'game_ended') return 'done'
    if (i < currentStep) return 'done'
    if (i === currentStep) return 'active'
    return 'pending'
  }

  return (
    <div className="border border-cyan-800/60 bg-cyan-950/15 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-cyan-950/30 border-b border-cyan-800/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🤖</span>
            <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider">Automated Lobby</h3>
          </div>
          <div className="flex items-center gap-2">
            {statusInfo.pulse && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
              </span>
            )}
            <span className={`text-xs font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Step progress bar */}
        <div className="flex items-center gap-1">
          {steps.map((step, i) => {
            const state = getStepState(i)
            return (
              <div key={step.key} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <div className={`w-full h-1.5 rounded-full transition-all duration-500 ${
                    state === 'done' ? 'bg-cyan-500' :
                    state === 'active' ? 'bg-cyan-400 animate-pulse' :
                    state === 'error' ? 'bg-yellow-500 animate-pulse' :
                    'bg-gray-700'
                  }`} />
                  <span className={`text-[10px] mt-1 truncate ${
                    state === 'done' ? 'text-cyan-500' :
                    state === 'active' ? 'text-cyan-300 font-semibold' :
                    state === 'error' ? 'text-yellow-400' :
                    'text-gray-600'
                  }`}>{step.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-sm text-gray-400">
          {statusInfo.description}
        </p>

        <div className="flex flex-wrap gap-3">
          {myTeam && (
            <span className={`text-xs px-2.5 py-1 rounded border font-medium ${
              myTeam === 1 ? 'bg-blue-950/40 border-blue-800 text-blue-300' : 'bg-orange-950/40 border-orange-800 text-orange-300'
            }`}>
              Your team: Team {myTeam}
            </span>
          )}
          {selectedMap && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-300">
              {selectedMap.imageUrl && <img src={selectedMap.imageUrl} alt="" className="w-5 h-5 rounded object-cover" />}
              Map: {selectedMap.name}
            </span>
          )}
        </div>

        {bannedHeroObjects.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 shrink-0">Bans:</span>
            {bannedHeroObjects.map((h) => (
              <span key={h.id} className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded bg-red-950/60 border border-red-900 text-red-400">
                {h.imageUrl && <img src={h.imageUrl} alt="" className="w-5 h-5 rounded-full object-cover" />}
                {h.name}
              </span>
            ))}
          </div>
        )}

        {isPugAdmin && gameActive && (
          <div className="border-t border-cyan-800/30 pt-3 mt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Admin Controls</p>
            <div className="flex gap-2">
              <button
                onClick={() => sendBotCommand('pause')}
                disabled={cmdLoading !== null}
                className="px-3 py-1.5 text-xs font-medium bg-yellow-600/15 border border-yellow-500/30 text-yellow-300 rounded-lg hover:bg-yellow-600/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {cmdLoading === 'pause' ? 'Sending...' : 'Pause'}
              </button>
              <button
                onClick={() => sendBotCommand('unpause')}
                disabled={cmdLoading !== null}
                className="px-3 py-1.5 text-xs font-medium bg-green-600/15 border border-green-500/30 text-green-300 rounded-lg hover:bg-green-600/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {cmdLoading === 'unpause' ? 'Sending...' : 'Unpause'}
              </button>
              <button
                onClick={() => sendBotCommand('end_game')}
                disabled={cmdLoading !== null}
                className="px-3 py-1.5 text-xs font-medium bg-red-600/15 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-600/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {cmdLoading === 'end_game' ? 'Sending...' : 'End Game'}
              </button>
            </div>
            {cmdError && <p className="text-xs text-red-400 mt-2">{cmdError}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Lobby Setup Assistant ──

function LobbySetupAssistant({
  lobby, hostInfo, currentUserId, isPugAdmin, selectedMap, players, heroes, botEnabled, onHost,
}: {
  lobby: any
  hostInfo: LobbyData['hostInfo']
  currentUserId: number | null
  isPugAdmin: boolean
  selectedMap: LobbyData['selectedMap']
  players: Player[]
  heroes: Hero[]
  botEnabled: boolean
  onHost: () => void
}) {
  if (!hostInfo) return null

  const isHost = hostInfo.hostUserId === currentUserId
  const hasHost = hostInfo.hostUserId !== null
  const isBotHosting = hostInfo.hostUserId === -1 || (botEnabled && !hasHost)
  const isPlayer = players.some((p) => p.userId === currentUserId)

  // Get banned hero names from banState
  const banRecords = (lobby.banState?.bans ?? []) as Array<{ heroId: number; team: number }>
  const bannedHeroObjects = banRecords
    .map((b) => heroes.find((h) => h.id === b.heroId))
    .filter(Boolean) as Hero[]
  const bannedHeroes = bannedHeroObjects.map((h) => h.name)

  const team1 = players.filter((p) => p.team === 1)
  const team2 = players.filter((p) => p.team === 2)
  const myTeam = players.find((p) => p.userId === currentUserId)?.team

  // Bot is hosting — show automated status
  if (isBotHosting) {
    return (
      <BotHostingPanel
        lobby={lobby}
        isPugAdmin={isPugAdmin}
        selectedMap={selectedMap}
        bannedHeroObjects={bannedHeroObjects}
        myTeam={myTeam ?? null}
      />
    )
  }

  // No host yet — show volunteer button
  if (!hasHost) {
    return (
      <div className="border border-yellow-800/60 bg-yellow-950/20 rounded-lg p-5 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-lg">⚙️</span>
          <h3 className="text-base font-semibold text-yellow-300">Lobby Setup Needed</h3>
        </div>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          Someone needs to host this match in Overwatch — create the custom game, import settings, and invite all players.
        </p>
        {(isPlayer || isPugAdmin) && (
          <button
            onClick={onHost}
            className="px-5 py-2.5 bg-yellow-700/80 text-yellow-100 rounded-lg hover:bg-yellow-600 hover:shadow-lg hover:shadow-yellow-600/20 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 text-sm font-semibold"
          >
            🎮 I&apos;ll Host This Match
          </button>
        )}
      </div>
    )
  }

  // Current user is the host — show full setup guide
  if (isHost) {
    return (
      <div className="border border-cyan-800/60 bg-cyan-950/15 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-cyan-950/30 border-b border-cyan-800/40">
          <div className="flex items-center gap-2">
            <span className="text-base">⚙️</span>
            <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider">You&apos;re Hosting — Follow These Steps</h3>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Step 1-3: Create and import */}
          <div className="space-y-2">
            <p className="text-sm text-gray-300">
              <span className="text-cyan-400 font-semibold">1.</span> Create a <strong>Custom Game</strong> in Overwatch
            </p>
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-300">
                <span className="text-cyan-400 font-semibold">2.</span> Copy the settings code:
              </p>
              {hostInfo.settingsText && (
                <CopyButton text={hostInfo.settingsText} label="📋 Copy Settings" />
              )}
            </div>
            <p className="text-sm text-gray-300">
              <span className="text-cyan-400 font-semibold">3.</span> In Overwatch, go to <strong>Settings</strong> and click the orange <strong>Import Settings</strong> icon on the right
            </p>
          </div>

          {/* Map & Bans summary */}
          <div className="flex flex-wrap gap-3">
            {selectedMap && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/60 border border-gray-800 rounded-lg overflow-hidden">
                {selectedMap.imageUrl && <img src={selectedMap.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />}
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Map</span>
                <span className="text-white font-semibold text-sm">{selectedMap.name}</span>
              </div>
            )}
            {bannedHeroObjects.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/60 border border-gray-800 rounded-lg flex-wrap">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold shrink-0">Bans</span>
                {bannedHeroObjects.map((h) => (
                  <span key={h.id} className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded bg-red-950/60 border border-red-900 text-red-400">
                    {h.imageUrl && <img src={h.imageUrl} alt="" className="w-5 h-5 rounded-full object-cover" />}
                    {h.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Step 4: Invite players */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-300">
                <span className="text-cyan-400 font-semibold">4.</span> Invite players &amp; assign teams:
              </p>
              {(() => {
                const allTags = players
                  .map((p) => hostInfo.battleTags[p.userId])
                  .filter(Boolean) as string[]
                return allTags.length > 0 ? (
                  <CopyButton text={allTags.join('\n')} label="📋 Copy All BattleTags" />
                ) : null
              })()}
            </div>

            {/* Team BattleTag lists */}
            <div className="grid grid-cols-2 gap-3">
              {([1, 2] as const).map((t) => {
                const teamPlayers = t === 1 ? team1 : team2
                const borderColor = t === 1 ? 'border-blue-800' : 'border-orange-800'
                const headerBg = t === 1 ? 'bg-blue-950/40' : 'bg-orange-950/40'
                const textColor = t === 1 ? 'text-blue-300' : 'text-orange-300'
                return (
                  <div key={t} className={`rounded-lg border overflow-hidden ${borderColor}`}>
                    <div className={`px-3 py-1.5 border-b ${borderColor} ${headerBg}`}>
                      <span className={`text-xs font-bold uppercase tracking-wider ${textColor}`}>Team {t}</span>
                    </div>
                    <ul className="divide-y divide-gray-800/50">
                      {teamPlayers.map((p) => {
                        const tag = hostInfo.battleTags[p.userId]
                        return (
                          <li key={p.userId} className="flex items-center justify-between gap-2 px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <PlayerAvatar player={p} size={22} />
                              <div className="min-w-0">
                                <Link href={`/pugs/profile/${p.userId}`} className="text-sm text-gray-200 hover:text-white hover:underline block truncate">{p.name}</Link>
                                {tag ? (
                                  <span className="text-xs text-gray-500">{tag}</span>
                                ) : (
                                  <span className="text-xs text-gray-600 italic">No BattleTag set</span>
                                )}
                              </div>
                            </div>
                            {tag && <CopyButton text={tag} label="📋" />}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Steps 5-6 */}
          <div className="space-y-2">
            <p className="text-sm text-gray-300">
              <span className="text-cyan-400 font-semibold">5.</span> Move players to the correct teams in the lobby
            </p>
            <p className="text-sm text-gray-300">
              <span className="text-cyan-400 font-semibold">6.</span> Start the match!
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Other player view — someone else is hosting
  return (
    <div className="border border-gray-800 bg-gray-900/30 rounded-lg p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">⚙️</span>
        <h3 className="text-sm font-semibold text-gray-200">
          {hostInfo.hostName ?? 'A player'} is setting up the lobby
        </h3>
      </div>
      <p className="text-sm text-gray-500">
        Wait for an invite in Overwatch. Make sure you&apos;re online and ready.
      </p>
      <div className="flex flex-wrap gap-3">
        {myTeam && (
          <span className={`text-xs px-2.5 py-1 rounded border font-medium ${
            myTeam === 1 ? 'bg-blue-950/40 border-blue-800 text-blue-300' : 'bg-orange-950/40 border-orange-800 text-orange-300'
          }`}>
            Your team: Team {myTeam}
          </span>
        )}
        {selectedMap && (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-300">
            {selectedMap.imageUrl && <img src={selectedMap.imageUrl} alt="" className="w-5 h-5 rounded object-cover" />}
            Map: {selectedMap.name}
          </span>
        )}
      </div>
      {bannedHeroObjects.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 shrink-0">Bans:</span>
          {bannedHeroObjects.map((h) => (
            <span key={h.id} className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded bg-red-950/60 border border-red-900 text-red-400">
              {h.imageUrl && <img src={h.imageUrl} alt="" className="w-5 h-5 rounded-full object-cover" />}
              {h.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
