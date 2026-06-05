'use client'

import { useState } from 'react'

export function BattleTagForm({ playerId, initialTag }: { playerId: number; initialTag: string | null }) {
  const [tag, setTag] = useState(initialTag || '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const valid = tag.trim() !== '' && tag.includes('#')

  async function handleSave() {
    if (!valid) {
      setMsg('Enter a valid BattleTag (e.g. Player#1234)')
      return
    }
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch(`/api/people/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pugBattleTag: tag.trim() }),
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

  const changed = tag !== (initialTag || '')

  return (
    <div className="mb-6 border border-gray-800 rounded-xl bg-gray-900/50 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-800/60">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Overwatch BattleTag</span>
      </div>
      <div className="px-4 py-3 flex items-center gap-3">
        <input
          type="text"
          value={tag}
          onChange={e => setTag(e.target.value)}
          placeholder="e.g. Player#1234"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-all placeholder-gray-600 appearance-none"
        />
        <button
          onClick={handleSave}
          disabled={saving || !changed || !valid}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 hover:shadow-md hover:shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none text-white text-sm font-medium rounded-lg transition-all duration-200"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {msg && (
          <span className={`text-xs font-medium ${msg === 'Saved!' ? 'text-green-400' : 'text-red-400'}`}>{msg}</span>
        )}
        {!msg && changed && !valid && (
          <span className="text-xs font-medium text-amber-400">Can&apos;t be empty - use Name#1234</span>
        )}
      </div>
    </div>
  )
}
