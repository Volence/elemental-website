'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { CalendarDays, Radio, Trophy, Plus, RefreshCw } from 'lucide-react'
import { localDateKey } from '@/utilities/taskDueDate'

export interface UpcomingItem {
  id: string
  kind: 'event' | 'match'
  title: string
  date: string
  subtitle: string
  suggestedPostType: string
  matchId?: number
}

export interface PromoPrefill {
  title: string
  description: string
  postType: string
  dueDate: string
}

interface UpcomingStripProps {
  onCreatePromo: (prefill: PromoPrefill) => void
  days?: number
}

/**
 * "Coming up" list under the content calendar: org calendar events plus matches
 * on the broadcast schedule, so the social team can see what needs a post.
 */
export function UpcomingStrip({ onCreatePromo, days = 14 }: UpcomingStripProps) {
  const [items, setItems] = useState<UpcomingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/social-media/upcoming?days=${days}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load upcoming events')
      const data = await res.json()
      setItems(data.items || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load upcoming events')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const handlePromo = (item: UpcomingItem) => {
    const when = new Date(item.date)
    onCreatePromo({
      title: `${item.kind === 'match' ? 'Promo' : 'Post'}: ${item.title}`,
      description: `${item.subtitle}\n${when.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
      postType: item.suggestedPostType,
      dueDate: localDateKey(when),
    })
  }

  return (
    <div className="upcoming-strip">
      <div className="upcoming-strip__header">
        <h4><CalendarDays size={14} /> Coming up (next {days} days)</h4>
        <div className="upcoming-strip__header-right">
          <span>Org calendar events and matches on the broadcast schedule</span>
          <button type="button" className="upcoming-strip__refresh" onClick={load} title="Refresh">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>
      {loading ? (
        <div className="upcoming-strip__empty">Loading...</div>
      ) : error ? (
        <div className="upcoming-strip__empty">{error}</div>
      ) : items.length === 0 ? (
        <div className="upcoming-strip__empty">Nothing on the org calendar or broadcast schedule in the next {days} days.</div>
      ) : (
        <ul className="upcoming-strip__list">
          {items.map((item) => {
            const when = new Date(item.date)
            return (
              <li key={item.id} className={`upcoming-item upcoming-item--${item.kind}`}>
                <span className="upcoming-item__icon">
                  {item.kind === 'match' ? <Radio size={14} /> : <Trophy size={14} />}
                </span>
                <span className="upcoming-item__when">
                  <strong>{when.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
                  <span>{when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                </span>
                <span className="upcoming-item__body">
                  <span className="upcoming-item__title">{item.title}</span>
                  <span className="upcoming-item__subtitle">{item.subtitle}</span>
                </span>
                <button type="button" className="upcoming-item__promo" onClick={() => handlePromo(item)} title="Create a post task for this">
                  <Plus size={12} /> Promo post
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default UpcomingStrip
