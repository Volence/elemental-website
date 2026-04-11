'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Calendar, Save, Check, AlertCircle, Loader2, ArrowLeft, Plus, Trash2,
  Link as LinkIcon, Globe, Trophy, Users, Star, Clock, ChevronRight,
  Search, MessageSquare,
} from 'lucide-react'
import { EDITOR_CSS, styles as editorStyles } from '@/components/PersonEditor'

// ── Types ──

type CalendarEvent = {
  id: number
  title: string
  eventType: string
  internalEventType?: string
  region?: string
  dateStart: string
  dateEnd?: string
  description?: string
  links?: Array<{ label: string; url: string; id?: string }>
  publishToDiscord?: boolean
  createdAt?: string
  updatedAt?: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const EVENT_TYPES = [
  { value: 'faceit', label: 'FACEIT', icon: '🏆', color: '#f97316' },
  { value: 'owcs', label: 'OWCS', icon: '⚔️', color: '#ef4444' },
  { value: 'community', label: 'Community', icon: '🎉', color: '#8b5cf6' },
  { value: 'internal', label: 'Internal', icon: '🏠', color: '#06b6d4' },
]

const INTERNAL_TYPES = [
  { value: 'seminar', label: 'Seminar', icon: '🎓' },
  { value: 'pugs', label: 'Pugs', icon: '🎮' },
  { value: 'internal-tournament', label: 'Internal Tournament', icon: '🏅' },
  { value: 'other', label: 'Other', icon: '📋' },
]

const REGIONS = [
  { value: 'NA', label: 'NA' }, { value: 'EU', label: 'EU' }, { value: 'EMEA', label: 'EMEA' },
  { value: 'SA', label: 'SA' }, { value: 'OCE', label: 'OCE' }, { value: 'SEA', label: 'SEA' },
  { value: 'APAC', label: 'APAC' }, { value: 'China', label: 'China' }, { value: 'global', label: 'Global' },
]

const getEventTypeConfig = (type: string) => EVENT_TYPES.find(t => t.value === type) ?? EVENT_TYPES[0]

// ── Events List ──

export function CalendarEventsListView() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/global-calendar-events?limit=200&sort=-dateStart&depth=0')
      if (!res.ok) throw new Error('Failed to load events')
      const data = await res.json()
      setEvents(data.docs ?? [])
    } catch (err) {
      console.error('Events load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // Highlight sidebar nav for Calendar Events
  useEffect(() => {
    const links = document.querySelectorAll('aside nav a')
    links.forEach(link => {
      const href = link.getAttribute('href') ?? ''
      if (href.includes('/collections/global-calendar-events')) {
        link.closest('[class*="nav-"]')?.classList.add('active')
        ;(link as HTMLElement).style.opacity = '1'
        ;(link as HTMLElement).style.color = '#34d399'
      }
    })
  }, [])

  const filtered = events.filter(e => {
    if (typeFilter !== 'all' && e.eventType !== typeFilter) return false
    if (search) return e.title?.toLowerCase().includes(search.toLowerCase())
    return true
  })

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    catch { return d }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 60px' }}>
      <style>{EDITOR_CSS + `
        .ev-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; cursor: pointer; transition: background 0.1s; text-decoration: none; color: inherit; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .ev-row:hover { background: rgba(255,255,255,0.03); }
        .ev-row:first-child { border-top: 1px solid rgba(255,255,255,0.04); }
        .ev-type-dot { width: 6px; height: 6px; border-radius: 2px; flex-shrink: 0; }
        .ev-region { display: inline-flex; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 500; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.45); }
        .ev-date { font-size: 12px; color: rgba(255,255,255,0.35); white-space: nowrap; }
        .filter-pill { background: none; border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.1s; }
        .filter-pill:hover { background: rgba(255,255,255,0.04); }
        .filter-pill.active { background: rgba(52, 211, 153, 0.08); border-color: rgba(52, 211, 153, 0.3); color: #34d399; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
          Calendar Events
          <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>({events.length})</span>
        </h1>
        <a href="/admin/edit-event" className="profile-save-btn" style={{ fontSize: 12, padding: '6px 14px', textDecoration: 'none' }}>
          <Plus size={13} /> New Event
        </a>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={`filter-pill ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => setTypeFilter('all')}>All</button>
        {EVENT_TYPES.map(t => (
          <button key={t.value} className={`filter-pill ${typeFilter === t.value ? 'active' : ''}`} onClick={() => setTypeFilter(typeFilter === t.value ? 'all' : t.value)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', maxWidth: 360, marginBottom: 12 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
        <input className="profile-input" style={{ paddingLeft: 32, fontSize: 13, padding: '6px 10px 6px 32px' }} placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div style={editorStyles.emptyState}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
      ) : (
        <div>
          {filtered.map(ev => {
            const conf = getEventTypeConfig(ev.eventType)
            return (
              <a key={ev.id} href={`/admin/edit-event?id=${ev.id}`} className="ev-row">
                <div className="ev-type-dot" style={{ background: conf.color }} />
                <span style={{ fontWeight: 500, color: '#e2e8f0', fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                {ev.region && <span className="ev-region">{ev.region}</span>}
                <span className="ev-date">{formatDate(ev.dateStart)}{ev.dateEnd ? ` → ${formatDate(ev.dateEnd)}` : ''}</span>
              </a>
            )
          })}
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No events found.</div>}
        </div>
      )}
    </div>
  )
}

// ── Event Editor ──

export function CalendarEventEditorView() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get('id')
  const isNew = !eventId

  const [loading, setLoading] = useState(!isNew)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState('community')
  const [internalEventType, setInternalEventType] = useState('other')
  const [region, setRegion] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [description, setDescription] = useState('')
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>([])
  const [publishToDiscord, setPublishToDiscord] = useState(true)

  const fetchEvent = useCallback(async () => {
    if (!eventId) return
    try {
      const res = await fetch(`/api/global-calendar-events/${eventId}?depth=0`)
      if (res.ok) {
        const ev = await res.json()
        setTitle(ev.title ?? '')
        setEventType(ev.eventType ?? 'community')
        setInternalEventType(ev.internalEventType ?? 'other')
        setRegion(ev.region ?? '')
        setDateStart(ev.dateStart ? ev.dateStart.slice(0, 16) : '')
        setDateEnd(ev.dateEnd ? ev.dateEnd.slice(0, 16) : '')
        setDescription(ev.description ?? '')
        setLinks(ev.links ?? [])
        setPublishToDiscord(ev.publishToDiscord ?? true)
      }
    } catch (err) {
      console.error('Event load error:', err)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { fetchEvent() }, [fetchEvent])

  const handleSave = async () => {
    if (!title.trim()) {
      setErrorMsg('Title is required')
      setSaveStatus('error')
      return
    }
    setSaveStatus('saving')
    setErrorMsg('')

    try {
      const payload: Record<string, any> = {
        title,
        eventType,
        region: region || null,
        dateStart: dateStart ? new Date(dateStart).toISOString() : new Date().toISOString(),
        dateEnd: dateEnd ? new Date(dateEnd).toISOString() : null,
        description: description || null,
        links: links.filter(l => l.label.trim() && l.url.trim()),
        publishToDiscord,
      }
      if (eventType === 'internal') payload.internalEventType = internalEventType

      const url = eventId ? `/api/global-calendar-events/${eventId}` : '/api/global-calendar-events'
      const method = eventId ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.errors?.[0]?.message ?? 'Failed to save')
      }

      setSaveStatus('saved')
      if (isNew) {
        const doc = await res.json()
        setTimeout(() => { window.location.href = `/admin/edit-event?id=${doc.doc?.id ?? doc.id}` }, 500)
      } else {
        setTimeout(() => setSaveStatus('idle'), 2500)
      }
    } catch (err: any) {
      setSaveStatus('error')
      setErrorMsg(err.message ?? 'Failed to save')
    }
  }

  const handleDelete = async () => {
    if (!eventId || !confirm('Delete this event?')) return
    try {
      await fetch(`/api/global-calendar-events/${eventId}`, { method: 'DELETE' })
      window.location.href = '/admin/collections/global-calendar-events'
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const addLink = () => setLinks(prev => [...prev, { label: '', url: '' }])
  const removeLink = (i: number) => setLinks(prev => prev.filter((_, idx) => idx !== i))
  const updateLink = (i: number, field: 'label' | 'url', value: string) => {
    setLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  const conf = getEventTypeConfig(eventType)

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px 60px' }}>
        <style>{EDITOR_CSS}</style>
        <div style={editorStyles.emptyState}><Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} /></div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px 60px' }}>
      <style>{EDITOR_CSS + `
        .type-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; cursor: pointer; transition: all 0.15s; border: 2px solid transparent; }
        .type-option:hover { background: rgba(255,255,255,0.03); }
        .type-option.selected { border-color: currentColor; background: rgba(255,255,255,0.02); }
        .region-chip { display: inline-flex; padding: 6px 12px; border-radius: 8px; font-size: 13px; cursor: pointer; transition: all 0.15s; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); }
        .region-chip:hover { background: rgba(255,255,255,0.06); }
        .region-chip.selected { background: rgba(52, 211, 153, 0.08); border-color: rgba(52, 211, 153, 0.3); color: #34d399; }
      `}</style>

      <a href="/admin/collections/global-calendar-events" className="back-link"><ArrowLeft size={14} /> Back to Events</a>

      {/* Header */}
      <div style={editorStyles.header}>
        <div style={editorStyles.headerLeft}>
          <div style={{ width: 50, height: 50, borderRadius: 12, background: `${conf.color}15`, border: `2px solid ${conf.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
            {conf.icon}
          </div>
          <div>
            <input className="profile-input" style={{ ...editorStyles.nameInput, fontSize: 22 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title..." />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {eventId && <button className="remove-btn" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }} onClick={handleDelete}><Trash2 size={14} /></button>}
          <button className="profile-save-btn" onClick={handleSave} disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
              : saveStatus === 'saved' ? <><Check size={16} /> Saved!</>
              : saveStatus === 'error' ? <><AlertCircle size={16} /> Error</>
              : <><Save size={16} /> {isNew ? 'Create Event' : 'Save Changes'}</>}
          </button>
        </div>
      </div>
      {saveStatus === 'error' && errorMsg && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{errorMsg}</p>}

      <div style={editorStyles.grid}>
        <div style={editorStyles.leftColumn}>
          {/* Event Type */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Trophy size={16} /> Event Type</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {EVENT_TYPES.map(t => (
                <div key={t.value} className={`type-option ${eventType === t.value ? 'selected' : ''}`} style={{ color: t.color }} onClick={() => setEventType(t.value)}>
                  <span style={{ fontSize: 18 }}>{t.icon}</span>
                  <span style={{ fontWeight: eventType === t.value ? 600 : 400 }}>{t.label}</span>
                </div>
              ))}
            </div>
            {eventType === 'internal' && (
              <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Internal Event Type</p>
                {INTERNAL_TYPES.map(t => (
                  <div key={t.value} className={`type-option ${internalEventType === t.value ? 'selected' : ''}`} style={{ color: '#06b6d4', padding: '6px 10px' }} onClick={() => setInternalEventType(t.value)}>
                    <span>{t.icon}</span><span>{t.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><MessageSquare size={16} /> Description</h3>
            <textarea className="profile-input profile-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Event details..." style={{ minHeight: 100 }} />
          </div>

          {/* Links */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><LinkIcon size={16} /> Links</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {links.map((link, i) => (
                <div className="custom-link-row" key={i}>
                  <input className="profile-input" value={link.label} onChange={(e) => updateLink(i, 'label', e.target.value)} placeholder="Label" />
                  <input className="profile-input" value={link.url} onChange={(e) => updateLink(i, 'url', e.target.value)} placeholder="https://..." />
                  <button className="remove-btn" onClick={() => removeLink(i)}>✕</button>
                </div>
              ))}
              <button className="add-link-btn" onClick={addLink}>+ Add Link</button>
            </div>
          </div>
        </div>

        <div style={editorStyles.rightColumn}>
          {/* Date & Time */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Clock size={16} /> Date & Time</h3>
            <div style={editorStyles.editableField}>
              <label style={editorStyles.fieldLabel}>Start</label>
              <input className="profile-input" type="datetime-local" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
            </div>
            <div style={editorStyles.editableField}>
              <label style={editorStyles.fieldLabel}>End (optional)</label>
              <input className="profile-input" type="datetime-local" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
            </div>
          </div>

          {/* Region */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><Globe size={16} /> Region</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button className={`region-chip ${!region ? 'selected' : ''}`} onClick={() => setRegion('')}>Any</button>
              {REGIONS.map(r => (
                <button key={r.value} className={`region-chip ${region === r.value ? 'selected' : ''}`} onClick={() => setRegion(region === r.value ? '' : r.value)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Discord */}
          <div className="profile-card" style={editorStyles.card}>
            <h3 style={editorStyles.cardTitle}><MessageSquare size={16} /> Discord</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Publish to Discord Calendar</span>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>Show this event in the Discord calendar channel</p>
              </div>
              <button className={`toggle-switch ${publishToDiscord ? 'on' : 'off'}`} onClick={() => setPublishToDiscord(!publishToDiscord)} type="button" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
