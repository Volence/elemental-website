'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Check, GitMerge, Loader2, X } from 'lucide-react'

interface Suggestion {
  id: number
  newPerson: { id: number; name: string | null }
  existingPerson: { id: number; name: string | null }
  similarity: number
  source: string
  createdAt: string
}

const SOURCE_LABELS: Record<string, string> = {
  'pug-signup': 'PUG Signup',
  'public-signup': 'Public Signup',
  'auto-login': 'Auto Login',
}

export default function MergeSuggestionsView() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingOn, setActingOn] = useState<number | null>(null)

  const fetchSuggestions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/merge-suggestions')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setSuggestions(data.suggestions)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSuggestions() }, [fetchSuggestions])

  const dismiss = async (id: number) => {
    setActingOn(id)
    try {
      const res = await fetch('/api/merge-suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'dismissed' }),
      })
      if (!res.ok) throw new Error('Failed to dismiss')
      setSuggestions(prev => prev.filter(s => s.id !== id))
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActingOn(null)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 20, color: 'rgba(255,255,255,0.4)' }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading suggestions...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', color: '#f87171', fontSize: 13 }}>
        <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{error}
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 20, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
        <Check size={16} style={{ color: '#34d399' }} /> No pending merge suggestions. New flags will appear here when someone signs up with a name similar to an existing person.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
        These are flagged when someone signs up and their name closely matches an existing person. Review each and either merge them or dismiss if they are different people.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {suggestions.map((s) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 500 }}>
                  {s.newPerson.name ?? `#${s.newPerson.id}`}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>~</span>
                <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 500 }}>
                  {s.existingPerson.name ?? `#${s.existingPerson.id}`}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                {s.similarity}% match - {SOURCE_LABELS[s.source] || s.source} - {new Date(s.createdAt).toLocaleDateString()}
              </div>
            </div>

            <a
              href={`/admin/globals/system-health?tab=merge&targetId=${s.existingPerson.id}&sourceId=${s.newPerson.id}`}
              onClick={(e) => {
                e.preventDefault()
                window.location.href = `/admin/globals/system-health?tab=merge&targetId=${s.existingPerson.id}&sourceId=${s.newPerson.id}`
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(99, 102, 241, 0.4)', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', cursor: 'pointer', fontSize: 12, fontWeight: 500, textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              <GitMerge size={12} /> Merge
            </a>

            <button
              onClick={() => dismiss(s.id)}
              disabled={actingOn === s.id}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
            >
              {actingOn === s.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <X size={12} />} Dismiss
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
