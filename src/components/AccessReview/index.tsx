'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import {
  AlertCircle, Check, ChevronDown, ChevronRight, Loader2, RefreshCw, Search,
  ShieldAlert, User as UserIcon, X,
} from 'lucide-react'

import { EDITOR_CSS } from '@/components/PersonEditor'
import type { AccessFlag, AccessPerson, AccessReport, TeamStanding } from '@/accessReview/types'
import { ALL_FLAGS, FLAG_LABELS, buildGroups, countFlags, type AccessGroup } from './grouping'
import { applyDelta, fetchReport, invertDelta, type AccessDelta } from './api'
import { GrantControl } from './GrantControl'

const VIEW_CSS = `
  .ar-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; margin-bottom: 12px; }
  .ar-group-head { display: flex; align-items: center; gap: 10px; width: 100%; padding: 14px 16px; }
  .ar-group-toggle { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; padding: 0; background: none; border: none; color: #e2e8f0; font-size: 14px; font-weight: 600; cursor: pointer; text-align: left; }
  .ar-band { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.35); margin: 22px 0 8px; }
  .ar-row { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid rgba(255,255,255,0.05); }
  .ar-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; font-size: 11px; border: 1px solid; }
  .ar-chip-warn { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.25); color: #f87171; }
  .ar-chip-ok { background: rgba(52,211,153,0.08); border-color: rgba(52,211,153,0.25); color: #34d399; }
  .ar-chip-mute { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); }
  .ar-stat { display: flex; flex-direction: column; gap: 2px; padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); cursor: pointer; min-width: 150px; text-align: left; color: #e2e8f0; }
  .ar-stat.active { border-color: rgba(52,211,153,0.4); background: rgba(52,211,153,0.06); }
  .ar-revoke { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #f87171; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; }
  .ar-revoke:hover { background: rgba(239,68,68,0.2); }
  .ar-revoke:disabled { opacity: 0.4; cursor: not-allowed; }
  .ar-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; gap: 14px; z-index: 60; }
  .ar-error-toast { position: fixed; top: 24px; left: 50%; transform: translateX(-50%); background: #0f172a; border: 1px solid rgba(239,68,68,0.35); border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; gap: 14px; z-index: 65; max-width: 640px; }
  .ar-modal-back { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 70; }
  .ar-modal { background: #0f172a; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 22px; max-width: 460px; width: 90%; }
  .ar-check { width: 15px; height: 15px; accent-color: #34d399; cursor: pointer; }
`

const STANDING_LABELS: Record<TeamStanding, string> = {
  manager: 'Manager',
  coach: 'Coach',
  captain: 'Captain',
  'co-captain': 'Co-captain',
  roster: 'Roster',
  sub: 'Sub',
}

function relativeDays(iso: string | null, now: number): string {
  if (!iso) return 'never'
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

/** The delta that revoking this group's permission from this person represents. */
function revokeDelta(group: AccessGroup, person: AccessPerson): AccessDelta {
  if (group.band === 'role') return { personId: person.id, kind: 'role', value: 'user' }
  if (group.band === 'department') {
    return { personId: person.id, kind: 'department', key: group.departmentKey, value: false }
  }
  return { personId: person.id, kind: 'team', teamId: group.teamId, value: false }
}

function revokeLabel(group: AccessGroup): string {
  if (group.band === 'role') return 'Set to User'
  if (group.band === 'department') return 'Remove access'
  return 'Remove team'
}

/** The people in this group who are currently selected. The single source of truth for both
 * the header badge and the confirm modal, so they can never disagree. */
function selectedPeopleFor(group: AccessGroup, selection: Record<string, number[]>): AccessPerson[] {
  const ids = selection[group.key] ?? []
  return group.people.filter((person) => ids.includes(person.id))
}

/**
 * @param embedded  Rendered inside the System Health hub, which supplies the page
 *                  shell and title; skip our own wrapper padding and h1.
 */
export function AccessReviewView({ embedded = false }: { embedded?: boolean } = {}) {
  const { user: currentUser } = useAuth() as { user: any }
  const [report, setReport] = useState<AccessReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [flag, setFlag] = useState<AccessFlag | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [undo, setUndo] = useState<{ text: string; delta: AccessDelta } | null>(null)
  const [selection, setSelection] = useState<Record<string, number[]>>({})
  const [confirming, setConfirming] = useState<AccessGroup | null>(null)

  const load = useCallback(async (refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      setReport(await fetchReport(refresh))
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!confirming) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirming(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [confirming])

  const now = report ? Date.parse(report.generatedAt) : Date.now()
  const counts = useMemo(() => (report ? countFlags(report) : null), [report])
  const groups = useMemo(
    () => (report ? buildGroups(report, { search, flag }) : []),
    [report, search, flag],
  )

  const runDelta = async (
    groupKey: string,
    delta: AccessDelta,
    undoText: string,
    previousRole: string | null,
    offerUndo = true,
  ) => {
    setBusy(`${groupKey}:${delta.personId}`)
    setError(null)
    try {
      await applyDelta(delta)
      // Undoing an undo would need the role from two states back, which we no longer hold,
      // so the undo action itself does not offer one.
      setUndo(offerUndo ? { text: undoText, delta: invertDelta(delta, previousRole) } : null)
      await load(true)
    } catch (err: any) {
      setError(err?.message ?? 'Change failed')
    } finally {
      setBusy(null)
    }
  }

  const runBulk = async (group: AccessGroup) => {
    const people = selectedPeopleFor(group, selection)
    setConfirming(null)
    setUndo(null)
    setBusy(`bulk:${group.key}`)
    const failures: string[] = []
    for (const person of people) {
      try {
        await applyDelta(revokeDelta(group, person))
      } catch (err: any) {
        failures.push(`${person.name}: ${err?.message ?? 'failed'}`)
      }
    }
    setSelection((prev) => ({ ...prev, [group.key]: [] }))
    setBusy(null)
    // Refresh first, then surface the failure text - otherwise load()'s own setError(null)
    // wipes it before it ever renders.
    await load(true)
    setError(failures.length ? failures.join(' | ') : null)
  }

  const toggleSelected = (groupKey: string, personId: number) => {
    setSelection((prev) => {
      const current = prev[groupKey] ?? []
      return {
        ...prev,
        [groupKey]: current.includes(personId)
          ? current.filter((id) => id !== personId)
          : [...current, personId],
      }
    })
  }

  const confirmingSelectedPeople = confirming ? selectedPeopleFor(confirming, selection) : []

  return (
    <div style={embedded ? undefined : { maxWidth: 1150, margin: '0 auto', padding: '24px 20px 80px' }}>
      <style>{EDITOR_CSS + VIEW_CSS}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        {embedded ? (
          <h2 className="ps-title" style={{ margin: 0 }}>Access Review</h2>
        ) : (
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
            <ShieldAlert size={22} style={{ verticalAlign: 'middle', marginRight: 10 }} />
            Access Review
          </h1>
        )}
        <button className="add-link-btn" style={{ width: 'auto' }} onClick={() => load(true)} disabled={loading}>
          <RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Refresh
        </button>
      </div>

      {report && !report.discord.available && (
        <div className="ar-card" style={{ padding: '12px 16px', color: '#fbbf24', fontSize: 13 }}>
          <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Discord membership could not be checked, so that column reads unknown for everyone. The
          bot may not be running yet.
        </div>
      )}

      {counts && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          {ALL_FLAGS.map((f) => (
            <button
              key={f}
              className={`ar-stat ${flag === f ? 'active' : ''}`}
              aria-pressed={flag === f}
              onClick={() => setFlag(flag === f ? null : f)}
            >
              <span style={{ fontSize: 20, fontWeight: 700 }}>{counts[f]}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{FLAG_LABELS[f]}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ position: 'relative', maxWidth: 380, marginBottom: 8 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
        <input
          className="profile-input"
          style={{ paddingLeft: 36 }}
          placeholder="Search name or email..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {loading && !report ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <Loader2 size={30} style={{ animation: 'spin 1s linear infinite', opacity: 0.4 }} />
        </div>
      ) : (
        ['role', 'department', 'team'].map((band) => {
          const bandGroups = groups.filter((group) => group.band === band)
          if (!bandGroups.length) return null
          return (
            <div key={band}>
              <div className="ar-band">{band === 'role' ? 'Roles' : band === 'department' ? 'Departments' : 'Team data access'}</div>
              {bandGroups.map((group) => {
                const isCollapsed = collapsed[group.key]
                const selectedPeople = selectedPeopleFor(group, selection)
                const bulkBusy = busy === `bulk:${group.key}`
                return (
                  <div className="ar-card" key={group.key}>
                    <div className="ar-group-head">
                      <button
                        type="button"
                        className="ar-group-toggle"
                        onClick={() => setCollapsed((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                      >
                        {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                        {group.label}
                        <span style={{ color: 'var(--elmt-text-disabled)', fontWeight: 400 }}>({group.people.length})</span>
                      </button>
                      {selectedPeople.length > 0 ? (
                        <button
                          type="button"
                          className="ar-revoke"
                          style={{ marginLeft: 'auto' }}
                          disabled={bulkBusy}
                          onClick={() => setConfirming(group)}
                        >
                          Revoke {selectedPeople.length} selected
                        </button>
                      ) : (
                        <GrantControl
                          group={group}
                          onGrant={(delta, personName) => runDelta(
                            group.key,
                            delta,
                            `${group.label} granted to ${personName}`,
                            null,
                          )}
                        />
                      )}
                    </div>

                    {!isCollapsed && group.people.map((person) => {
                      const team = group.band === 'team'
                        ? person.teams.find((entry) => entry.teamId === group.teamId)
                        : null
                      const rowBusy = busy === `${group.key}:${person.id}` || bulkBusy
                      const isSelfRoleChange = group.band === 'role' && currentUser?.id != null
                        && String(currentUser.id) === String(person.id)
                      return (
                        <div className="ar-row" key={person.id}>
                          <input
                            type="checkbox"
                            className="ar-check"
                            aria-label={`Select ${person.name}`}
                            checked={selection[group.key]?.includes(person.id) ?? false}
                            onChange={() => toggleSelected(group.key, person.id)}
                          />
                          {person.avatarUrl
                            ? <img loading="lazy" decoding="async" src={person.avatarUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                            : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={14} style={{ opacity: 0.3 }} /></div>}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <a href={`/admin/edit-user?id=${person.id}`} style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                              {person.name}
                            </a>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                              {team && (
                                <span className={`ar-chip ${team.standing ? 'ar-chip-ok' : 'ar-chip-warn'}`}>
                                  {team.standing ? STANDING_LABELS[team.standing] : 'not on roster'}
                                </span>
                              )}
                              {person.flags.filter((f) => !(group.band === 'team' && f === 'team-without-roster')).map((f) => (
                                <span className="ar-chip ar-chip-warn" key={f}>{FLAG_LABELS[f]}</span>
                              ))}
                              <span className="ar-chip ar-chip-mute">
                                seen {relativeDays(person.lastActivityAt ?? person.lastLoginAt, now)}
                              </span>
                              <span className="ar-chip ar-chip-mute">
                                {person.lastAccessChange
                                  ? `reviewed ${relativeDays(person.lastAccessChange.at, now)}${person.lastAccessChange.byName ? ` by ${person.lastAccessChange.byName}` : ''}`
                                  : 'no review record'}
                              </span>
                              {person.inDiscord === null && <span className="ar-chip ar-chip-mute">discord unknown</span>}
                            </div>
                          </div>

                          <button
                            className="ar-revoke"
                            disabled={rowBusy || isSelfRoleChange}
                            title={isSelfRoleChange ? 'You cannot change your own role here' : undefined}
                            onClick={() => runDelta(
                              group.key,
                              revokeDelta(group, person),
                              `${revokeLabel(group)} applied to ${person.name}`,
                              person.role,
                            )}
                          >
                            {rowBusy ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : revokeLabel(group)}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })
      )}

      {report && groups.length === 0 && !loading && (
        <div style={{ padding: 50, textAlign: 'center', opacity: 0.4 }}>Nothing matches this filter.</div>
      )}

      {error && (
        <div className="ar-error-toast" role="alert">
          <AlertCircle size={15} style={{ color: '#f87171', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#e2e8f0' }}>{error}</span>
          <button className="remove-btn" style={{ width: 26, height: 26, flexShrink: 0 }} onClick={() => setError(null)}>
            <X size={13} />
          </button>
        </div>
      )}

      {undo && (
        <div className="ar-toast">
          <Check size={15} style={{ color: '#34d399' }} />
          <span style={{ fontSize: 13, color: '#e2e8f0' }}>{undo.text}</span>
          <button
            className="add-link-btn"
            style={{ width: 'auto', padding: '4px 12px' }}
            onClick={async () => {
              const delta = undo.delta
              setUndo(null)
              await runDelta('undo', delta, 'Change undone', null, false)
            }}
          >
            Undo
          </button>
          <button className="remove-btn" style={{ width: 26, height: 26 }} onClick={() => setUndo(null)}>
            <X size={13} />
          </button>
        </div>
      )}

      {confirming && (
        <div className="ar-modal-back" onClick={() => setConfirming(null)}>
          <div
            className="ar-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ar-confirm-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="ar-confirm-heading" style={{ margin: '0 0 10px', color: '#e2e8f0', fontSize: 16 }}>
              {revokeLabel(confirming)} for {confirmingSelectedPeople.length} people
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '0 0 14px' }}>
              {confirming.label}. This applies one change per person and cannot be undone in bulk.
            </p>
            <ul style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, maxHeight: 180, overflowY: 'auto', margin: '0 0 18px', paddingLeft: 18 }}>
              {confirmingSelectedPeople.map((person) => <li key={person.id}>{person.name}</li>)}
            </ul>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="add-link-btn" style={{ width: 'auto' }} onClick={() => setConfirming(null)}>Cancel</button>
              <button className="ar-revoke" onClick={() => runBulk(confirming)}>Revoke</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccessReviewView
