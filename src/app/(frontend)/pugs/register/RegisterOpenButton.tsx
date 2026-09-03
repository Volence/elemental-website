'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterOpenButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [battleTag, setBattleTag] = useState('')
  const router = useRouter()

  async function handleRegister() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pug/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleTag: battleTag.trim() || undefined }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Registration failed. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="battle-tag" className="block text-sm font-medium text-foreground/90 mb-1.5">
          BattleTag <span className="text-muted-foreground/70 font-normal">(optional)</span>
        </label>
        <input
          id="battle-tag"
          type="text"
          value={battleTag}
          onChange={(e) => setBattleTag(e.target.value)}
          placeholder="e.g., Player#1234"
          className="w-full px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:border-blue-600 transition-colors"
        />
        <p className="text-xs text-muted-foreground/70 mt-1">
          Helps the match host invite you in-game. You can add it later in your profile.
        </p>
      </div>
      <button
        onClick={handleRegister}
        disabled={loading}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
      >
        {loading ? 'Registering…' : 'Register for Open Tier PUGs'}
      </button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
