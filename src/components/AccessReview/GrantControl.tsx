'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, UserPlus } from 'lucide-react'

import type { AccessPerson } from '@/accessReview/types'
import type { AccessGroup } from './grouping'
import type { AccessDelta } from './api'

const GRANT_CSS = `
  .ar-grant-wrap { position: relative; margin-left: auto; }
  .ar-grant-panel { position: absolute; right: 0; top: calc(100% + 6px); width: 280px; background: #0f172a; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 10px; z-index: 20; box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
  .ar-grant-list { max-height: 220px; overflow-y: auto; margin-top: 8px; display: flex; flex-direction: column; gap: 2px; }
  .ar-grant-candidate { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; width: 100%; padding: 7px 9px; background: none; border: none; border-radius: 6px; color: #e2e8f0; font-size: 13px; text-align: left; cursor: pointer; }
  .ar-grant-candidate:hover, .ar-grant-candidate:focus-visible { background: rgba(255,255,255,0.06); }
  .ar-grant-candidate .ar-grant-email { font-size: 11px; color: rgba(255,255,255,0.4); }
  .ar-grant-empty { padding: 10px 9px; font-size: 12px; color: rgba(255,255,255,0.4); }
  .ar-grant-error { padding: 10px 9px; font-size: 12px; color: #f87171; display: flex; align-items: center; gap: 6px; }
`

const MAX_RESULTS = 8

/** The delta that granting this group's permission to this person represents - the mirror of
 * revokeDelta in index.tsx. */
export function grantDelta(group: AccessGroup, personId: number): AccessDelta {
  if (group.band === 'role') return { personId, kind: 'role', value: group.role }
  if (group.band === 'department') {
    return { personId, kind: 'department', key: group.departmentKey, value: true }
  }
  return { personId, kind: 'team', teamId: group.teamId, value: true }
}

interface GrantControlProps {
  group: AccessGroup
  onGrant: (delta: AccessDelta, personName: string) => void
}

export function GrantControl({ group, onGrant }: GrantControlProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<AccessPerson[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const loadCandidates = async () => {
    if (candidates !== null || loading) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/people?limit=500&sort=name&depth=0', { credentials: 'include' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? `Failed to load people (${res.status})`)
      const docs = Array.isArray(body?.docs) ? body.docs : []
      setCandidates(docs.map((doc: any) => ({
        id: doc.id,
        name: doc.name ?? doc.email ?? `#${doc.id}`,
        email: doc.email ?? null,
      })))
    } catch (err: any) {
      setLoadError(err?.message ?? 'Failed to load people')
    } finally {
      setLoading(false)
    }
  }

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev
      if (next) void loadCandidates()
      return next
    })
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onMouseDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [open])

  const existingIds = new Set(group.people.map((person) => person.id))
  const needle = query.trim().toLowerCase()
  const filtered = (candidates ?? [])
    .filter((person: any) => !existingIds.has(person.id))
    .filter((person: any) => {
      if (!needle) return true
      return (
        (person.name ?? '').toLowerCase().includes(needle) ||
        (person.email ?? '').toLowerCase().includes(needle)
      )
    })
    .slice(0, MAX_RESULTS)

  const pick = (person: { id: number; name: string }) => {
    onGrant(grantDelta(group, person.id), person.name)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="ar-grant-wrap" ref={wrapRef}>
      <style>{GRANT_CSS}</style>
      <button
        type="button"
        className="add-link-btn"
        style={{ width: 'auto' }}
        aria-expanded={open}
        onClick={toggleOpen}
      >
        <UserPlus size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Add person
      </button>

      {open && (
        <div className="ar-grant-panel" role="dialog" aria-label={`Add person to ${group.label}`}>
          <input
            className="profile-input"
            placeholder="Search name or email..."
            value={query}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="ar-grant-list">
            {loading && (
              <div className="ar-grant-empty">
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', verticalAlign: 'middle', marginRight: 6 }} />
                Loading people...
              </div>
            )}
            {!loading && loadError && (
              <div className="ar-grant-error">
                <AlertCircle size={13} />
                {loadError}
              </div>
            )}
            {!loading && !loadError && filtered.length === 0 && (
              <div className="ar-grant-empty">No matching people.</div>
            )}
            {!loading && !loadError && filtered.map((person: any) => (
              <button
                type="button"
                key={person.id}
                className="ar-grant-candidate"
                onClick={() => pick(person)}
              >
                <span>{person.name}</span>
                {person.email && <span className="ar-grant-email">{person.email}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default GrantControl
