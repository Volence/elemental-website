'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CreateLobbyButton({ seasonId, region }: { seasonId: number; region: string }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/pug/lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payloadSeasonId: seasonId, tier: 'invite', region }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create lobby')
        return
      }
      if (data.lobby?.id) {
        router.push(`/pugs/lobby/${data.lobby.id}`)
      } else {
        router.refresh()
      }
    } catch {
      setError('Failed to create lobby')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mb-4">
      <button
        onClick={handleCreate}
        disabled={creating}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {creating ? 'Creating...' : 'Create New Lobby'}
      </button>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  )
}
