'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

type LobbyData = {
  lobby: any
  selectedMap: { id: number; name: string } | null
  mapCandidates: Array<{ id: number; name: string }>
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
    const json = await res.json()
    setData(json)
  }, [id])

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 2000)
    return () => clearInterval(interval)
  }, [fetchState])

  async function apiAction(path: string, body: object) {
    setActionError(null)
    const res = await fetch(`/api/pug/lobby/${id}${path}`, {
      method: 'POST',
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

  if (error) return <p className="container mx-auto p-8 text-red-500">{error}</p>
  if (!data) return <p className="container mx-auto p-8 text-gray-500">Loading...</p>

  const { lobby, selectedMap, mapCandidates } = data

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">PUG #{lobby.lobbyNumber}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {lobby.tier === 'invite' ? 'Invite Tier' : 'Open Tier'} · {lobby.status}
      </p>

      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {actionError}
        </div>
      )}

      {lobby.status === 'OPEN' && (
        <div>
          <h2 className="font-semibold mb-3">Players ({lobby.players.length}/10)</h2>
          <ul className="space-y-1 mb-4">
            {lobby.players.map((p: any) => (
              <li key={p.userId} className="text-sm">
                User #{p.userId} — {p.queuedRoles.join(', ')}
              </li>
            ))}
          </ul>
          <QueueForm lobbyId={id} onQueue={() => fetchState()} onLeave={leaveQueue} apiAction={apiAction} />
        </div>
      )}

      {lobby.status === 'READY' && (
        <div className="text-center py-8">
          <p className="text-xl font-semibold mb-2">Match found!</p>
          <p className="text-gray-600">Starting in 30 seconds...</p>
          <button
            onClick={leaveQueue}
            className="mt-4 px-4 py-2 border rounded text-red-600 hover:bg-red-50"
          >
            Leave
          </button>
        </div>
      )}

      {lobby.status === 'DRAFTING' && lobby.draftState && (
        <DraftUI
          players={lobby.players}
          draftState={lobby.draftState}
          onPick={(pickedUserId) => apiAction('/draft/pick', { pickedUserId })}
        />
      )}

      {lobby.status === 'MAP_VOTE' && (
        <div>
          <h2 className="font-semibold mb-3">Vote for a map</h2>
          <div className="grid grid-cols-3 gap-3">
            {mapCandidates.map((m) => (
              <button
                key={m.id}
                onClick={() => apiAction('/map-vote', { mapId: m.id })}
                className="p-4 border rounded hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {lobby.status === 'BANNING' && lobby.banState && (
        <BanUI
          banState={lobby.banState}
          draftState={lobby.draftState}
          onBan={(heroId) => apiAction('/ban', { heroId })}
        />
      )}

      {lobby.status === 'IN_PROGRESS' && (
        <div>
          <h2 className="font-semibold mb-3">Match in progress</h2>
          {selectedMap && <p className="text-sm mb-2">Map: <strong>{selectedMap.name}</strong></p>}
          <Teams players={lobby.players} />
          <div className="mt-6">
            <h3 className="font-medium mb-2">Submit result (captains only)</h3>
            <div className="flex gap-3">
              {(['team1', 'team2', 'draw'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => apiAction('/report', { result: r })}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  {r === 'team1' ? 'Team 1 Won' : r === 'team2' ? 'Team 2 Won' : 'Draw'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {lobby.status === 'REPORTING' && (
        <div>
          <h2 className="font-semibold mb-3">Confirm result</h2>
          <p className="text-sm text-gray-600 mb-4">
            A result has been submitted. Confirm or dispute it. Auto-confirms in 10 minutes.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => apiAction('/confirm', { action: 'confirm' })}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Confirm
            </button>
            <button
              onClick={() => apiAction('/confirm', { action: 'dispute' })}
              className="px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50"
            >
              Dispute
            </button>
          </div>
        </div>
      )}

      {(['COMPLETED', 'CANCELLED', 'DISPUTED'] as const).includes(lobby.status) && (
        <div className="text-center py-8">
          <p className="text-xl font-semibold">
            {lobby.status === 'COMPLETED' && 'Match complete!'}
            {lobby.status === 'CANCELLED' && 'Lobby cancelled.'}
            {lobby.status === 'DISPUTED' && 'Result disputed — awaiting admin review.'}
          </p>
        </div>
      )}
    </main>
  )
}

function QueueForm({
  lobbyId,
  onQueue,
  onLeave,
  apiAction,
}: {
  lobbyId: string
  onQueue: () => void
  onLeave: () => void
  apiAction: (path: string, body: object) => Promise<void>
}) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const roles = ['tank', 'flex-dps', 'hitscan-dps', 'flex-support', 'main-support']

  function toggle(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }

  async function handleQueue() {
    await apiAction('/queue', { roles: selectedRoles })
    onQueue()
  }

  return (
    <div>
      <p className="text-sm font-medium mb-2">Select your roles:</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {roles.map((role) => (
          <button
            key={role}
            onClick={() => toggle(role)}
            className={`px-3 py-1 text-sm rounded border transition-colors ${
              selectedRoles.includes(role)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            {role}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleQueue}
          disabled={selectedRoles.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Queue
        </button>
        <button onClick={onLeave} className="px-4 py-2 border rounded text-red-600 hover:bg-red-50">
          Leave
        </button>
      </div>
    </div>
  )
}

function DraftUI({ players, draftState, onPick }: { players: any[]; draftState: any; onPick: (id: number) => void }) {
  const undrafted = players.filter((p: any) => p.team === null && !p.isCaptain)
  return (
    <div>
      <h2 className="font-semibold mb-3">Draft — Team {draftState.currentPickTeam} picking</h2>
      <p className="text-sm text-gray-500 mb-4">Pick {draftState.pickNumber + 1} of 8</p>
      <div className="space-y-2">
        {undrafted.map((p: any) => (
          <div key={p.userId} className="flex items-center justify-between border rounded p-3">
            <span className="text-sm">User #{p.userId} — {p.assignedRole}</span>
            <button
              onClick={() => onPick(p.userId)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Pick
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function BanUI({ banState, draftState, onBan }: { banState: any; draftState: any; onBan: (id: number) => void }) {
  return (
    <div>
      <h2 className="font-semibold mb-3">
        Ban phase — Team {banState.currentBanTeam} bans ({banState.banNumber}/4)
      </h2>
      <p className="text-sm text-gray-500 mb-4">Enter a hero ID to ban</p>
      <HeroBanInput onBan={onBan} />
    </div>
  )
}

function HeroBanInput({ onBan }: { onBan: (id: number) => void }) {
  const [heroId, setHeroId] = useState('')
  return (
    <div className="flex gap-2">
      <input
        type="number"
        value={heroId}
        onChange={(e) => setHeroId(e.target.value)}
        placeholder="Hero ID"
        className="border rounded px-3 py-2 text-sm w-32"
      />
      <button
        onClick={() => heroId && onBan(parseInt(heroId, 10))}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
      >
        Ban
      </button>
    </div>
  )
}

function Teams({ players }: { players: any[] }) {
  const team1 = players.filter((p: any) => p.team === 1)
  const team2 = players.filter((p: any) => p.team === 2)
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h3 className="font-medium mb-2">Team 1</h3>
        {team1.map((p: any) => (
          <p key={p.userId} className="text-sm">User #{p.userId} — {p.assignedRole}</p>
        ))}
      </div>
      <div>
        <h3 className="font-medium mb-2">Team 2</h3>
        {team2.map((p: any) => (
          <p key={p.userId} className="text-sm">User #{p.userId} — {p.assignedRole}</p>
        ))}
      </div>
    </div>
  )
}
