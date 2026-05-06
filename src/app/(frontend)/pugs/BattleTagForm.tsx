'use client'

import { useState } from 'react'

export function BattleTagForm({ playerId, initialTag }: { playerId: number; initialTag: string | null }) {
  const [tag, setTag] = useState(initialTag || '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleSave() {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch(`/api/people/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pugBattleTag: tag }),
      })
      if (res.ok) {
        setMsg('Saved!')
        setTimeout(() => setMsg(''), 3000)
      } else {
        setMsg('Error saving')
      }
    } catch {
      setMsg('Error saving')
    }
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-3 bg-gray-800/50 p-4 rounded-lg border border-gray-700 w-full max-w-md mb-6">
      <div className="flex-1">
        <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase">Your Overwatch BattleTag</label>
        <input 
          type="text" 
          value={tag} 
          onChange={e => setTag(e.target.value)}
          placeholder="e.g. Player#1234"
          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none transition-colors"
        />
      </div>
      <button 
        onClick={handleSave} 
        disabled={saving}
        className="mt-5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
      {msg && <span className={`mt-5 text-xs ${msg === 'Saved!' ? 'text-green-400' : 'text-red-400'}`}>{msg}</span>}
    </div>
  )
}
