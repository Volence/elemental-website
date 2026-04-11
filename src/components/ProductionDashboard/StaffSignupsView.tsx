'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@payloadcms/ui'
import { toast } from '@payloadcms/ui'
import { AlertTriangle, Calendar, CheckCircle, Clapperboard, Clock, Eye, Globe, Lightbulb, Lock, Mic, Target, X } from 'lucide-react'

interface User {
  id: number
  name?: string
  email?: string
}

interface CasterSignup {
  user: User | number
  style?: string
}

interface Match {
  id: number
  title: string
  date: string
  team: any
  opponent: string
  region?: string
  faceitLobby?: string
  isTournamentSlot?: boolean
  productionWorkflow?: {
    observerSignups?: (User | number)[]
    producerSignups?: (User | number)[]
    casterSignups?: CasterSignup[]
    assignedObserver?: User | number
    assignedProducer?: User | number
    assignedCasters?: CasterSignup[]
    includeInSchedule?: boolean
    dateChanged?: boolean
    previousDate?: string
  }
}

interface SignupRoles {
  observer: boolean
  producer: boolean
  caster: boolean
  casterStyle?: string
}

interface MatchGroup {
  dateTime: string
  matches: Match[]
  formattedDate: string
}

// ─── Utility functions ───

const getUserId = (user: User | number | null | undefined): number | null => {
  if (!user) return null
  if (typeof user === 'number') return user
  return user.id
}

const getUserName = (user: User | number | null | undefined): string => {
  if (!user) return 'Unknown'
  if (typeof user === 'number') return `User #${user}`
  return user.name || user.email || 'Unknown'
}

const getGroupRoleCounts = (group: MatchGroup) => {
  const observers = new Set<number>()
  const producers = new Set<number>()
  const casters = new Set<number>()

  group.matches.forEach(m => {
    m.productionWorkflow?.observerSignups?.forEach(u => {
      const id = getUserId(u); if (id) observers.add(id)
    })
    m.productionWorkflow?.producerSignups?.forEach(u => {
      const id = getUserId(u); if (id) producers.add(id)
    })
    m.productionWorkflow?.casterSignups?.forEach(c => {
      const id = getUserId(c.user); if (id) casters.add(id)
    })
  })

  return { observers: observers.size, producers: producers.size, casters: casters.size }
}

// ─── Signup Modal Component ───

function SignupModal({ matchGroup, currentUserId, onClose, onSignup }: {
  matchGroup: MatchGroup | null
  currentUserId: number | null
  onClose: () => void
  onSignup: (matchIds: number[], roles: SignupRoles) => Promise<void>
}) {
  const [roles, setRoles] = useState<SignupRoles>({ observer: false, producer: false, caster: false })
  const [submitting, setSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    if (!matchGroup || !currentUserId) return
    const anyMatch = matchGroup.matches[0]
    const pw = anyMatch.productionWorkflow
    if (pw) {
      const isObserver = pw.observerSignups?.some(u => getUserId(u) === currentUserId)
      const isProducer = pw.producerSignups?.some(u => getUserId(u) === currentUserId)
      const casterSignup = pw.casterSignups?.find(c => getUserId(c.user) === currentUserId)
      setRoles({
        observer: !!isObserver,
        producer: !!isProducer,
        caster: !!casterSignup,
        casterStyle: casterSignup?.style,
      })
    }
  }, [matchGroup, currentUserId])

  if (!matchGroup || !mounted) return null

  const handleSubmit = async () => {
    if (!roles.observer && !roles.producer && !roles.caster) {
      toast.error('Please select at least one role')
      return
    }
    setSubmitting(true)
    try {
      await onSignup(matchGroup.matches.map(m => m.id), roles)
      toast.success(`Signed up for ${matchGroup.matches.length} match${matchGroup.matches.length > 1 ? 'es' : ''}!`)
      onClose()
    } catch { toast.error('Failed to sign up') }
    finally { setSubmitting(false) }
  }

  return createPortal(
    <div className="signup-modal-overlay" onClick={onClose}>
      <div className="signup-modal" onClick={e => e.stopPropagation()}>
        <div className="signup-modal__header">
          <h3>Sign Up for Time Slot</h3>
          <button className="signup-modal__close" onClick={onClose} aria-label="Close modal"><X size={16} /></button>
        </div>
        <div className="signup-modal__body">
          <div className="signup-modal__match-info">
            <h4><Calendar size={14} /> {matchGroup.formattedDate}</h4>
            <p className="signup-modal__match-count">
              {matchGroup.matches.length} match{matchGroup.matches.length > 1 ? 'es' : ''} at this time
            </p>
            <div className="signup-modal__match-list">
              {matchGroup.matches.map(match => (
                <div key={match.id} className="signup-modal__match-item">• {match.title}</div>
              ))}
            </div>
            <p className="signup-modal__note">
              <Lightbulb size={14} /> You'll be marked as available for all matches at this time. Staff managers will assign you to specific matches later.
            </p>
          </div>
          <div className="signup-modal__roles">
            <label className="signup-checkbox">
              <input type="checkbox" checked={roles.observer} onChange={e => setRoles({ ...roles, observer: e.target.checked })} />
              <span><Eye size={14} /> I can observe</span>
            </label>
            <label className="signup-checkbox">
              <input type="checkbox" checked={roles.producer} onChange={e => setRoles({ ...roles, producer: e.target.checked })} />
              <span><Clapperboard size={14} /> I can produce</span>
            </label>
            <label className="signup-checkbox">
              <input type="checkbox" checked={roles.caster} onChange={e => setRoles({ ...roles, caster: e.target.checked })} />
              <span><Mic size={14} /> I can cast</span>
            </label>
            {roles.caster && (
              <div className="signup-caster-style">
                <label>Casting Style:</label>
                <select value={roles.casterStyle || ''} onChange={e => setRoles({ ...roles, casterStyle: e.target.value || undefined })}>
                  <option value="">Not specified</option>
                  <option value="play-by-play">Play-by-Play</option>
                  <option value="color">Color</option>
                  <option value="both">Both</option>
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="signup-modal__footer">
          <button className="signup-modal__cancel" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="signup-modal__submit" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Signing up...' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Main StaffSignupsView ───

export function StaffSignupsView() {
  const { user } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMatchGroup, setSelectedMatchGroup] = useState<MatchGroup | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { fetchMatches() }, [])

  const fetchMatches = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/production/matches-with-signups')
      const data = await response.json()
      setMatches(data.docs || [])
    } catch (error) {
      console.error('Error fetching matches:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (matchIds: number[], roles: SignupRoles) => {
    const promises = matchIds.map(matchId =>
      fetch('/api/production/staff-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, roles }),
      })
    )
    const results = await Promise.all(promises)
    if (results.some(r => !r.ok)) throw new Error('Failed to sign up for some matches')
    await fetchMatches()
  }

  const handleRemoveSignup = async (matchId: number, role: 'observer' | 'producer' | 'caster') => {
    try {
      const response = await fetch('/api/production/staff-signup', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, role }),
      })
      if (!response.ok) throw new Error('Failed to remove signup')
      toast.success('Signup removed')
      await fetchMatches()
    } catch { toast.error('Failed to remove signup') }
  }

  // ─── Grouping & filtering logic ───

  const currentUserId = user?.id ? (typeof user.id === 'number' ? user.id : parseInt(user.id as string, 10)) : null

  const isUserSignedUp = (match: Match, userId: number | null): boolean => {
    if (!userId) return false
    const pw = match.productionWorkflow
    if (!pw) return false
    return !!(
      pw.observerSignups?.some(u => getUserId(u) === userId) ||
      pw.producerSignups?.some(u => getUserId(u) === userId) ||
      pw.casterSignups?.some(c => getUserId(c.user) === userId)
    )
  }

  const isUserAssigned = (match: Match, userId: number | null): boolean => {
    if (!userId) return false
    const pw = match.productionWorkflow
    if (!pw) return false
    return !!(
      getUserId(pw.assignedObserver) === userId ||
      getUserId(pw.assignedProducer) === userId ||
      pw.assignedCasters?.some(c => getUserId(c.user) === userId)
    )
  }

  const isRoleAssigned = (match: Match, userId: number | null, role: 'observer' | 'producer' | 'caster'): boolean => {
    if (!userId) return false
    const pw = match.productionWorkflow
    if (!pw) return false
    if (role === 'observer') return getUserId(pw.assignedObserver) === userId
    if (role === 'producer') return getUserId(pw.assignedProducer) === userId
    if (role === 'caster') return pw.assignedCasters?.some(c => getUserId(c.user) === userId) || false
    return false
  }

  const getMySignupRoles = (match: Match, userId: number | null): { role: string; key: 'observer' | 'producer' | 'caster' }[] => {
    if (!userId) return []
    const pw = match.productionWorkflow
    if (!pw) return []
    const roles: { role: string; key: 'observer' | 'producer' | 'caster' }[] = []
    if (pw.observerSignups?.some(u => getUserId(u) === userId)) roles.push({ role: 'Observer', key: 'observer' })
    if (pw.producerSignups?.some(u => getUserId(u) === userId)) roles.push({ role: 'Producer', key: 'producer' })
    const caster = pw.casterSignups?.find(c => getUserId(c.user) === userId)
    if (caster) roles.push({ role: caster.style ? `Caster (${caster.style})` : 'Caster', key: 'caster' })
    return roles
  }

  const getMyAssignedRoles = (match: Match, userId: number | null): string[] => {
    if (!userId) return []
    const pw = match.productionWorkflow
    if (!pw) return []
    const roles: string[] = []
    if (getUserId(pw.assignedObserver) === userId) roles.push('Observer')
    if (getUserId(pw.assignedProducer) === userId) roles.push('Producer')
    const caster = pw.assignedCasters?.find(c => getUserId(c.user) === userId)
    if (caster) roles.push(caster.style ? `Caster (${caster.style})` : 'Caster')
    return roles
  }

  // Group matches by time
  const groupMatchesByTime = (matchList: Match[]): MatchGroup[] => {
    const grouped = new Map<string, Match[]>()
    matchList.forEach(match => {
      const dt = new Date(match.date).toISOString()
      if (!grouped.has(dt)) grouped.set(dt, [])
      grouped.get(dt)!.push(match)
    })
    return Array.from(grouped.entries())
      .map(([dateTime, matches]) => ({
        dateTime,
        matches,
        formattedDate: new Date(dateTime).toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        }),
      }))
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
  }

  const matchGroups = groupMatchesByTime(matches)

  // My signups and assignments
  const myAssignments = matches.filter(m => isUserAssigned(m, currentUserId) && m.productionWorkflow?.includeInSchedule === true)
  const assignedTimeSlots = new Set(myAssignments.map(m => new Date(m.date).toISOString()))
  const myPendingSignups = matches.filter(m =>
    isUserSignedUp(m, currentUserId) &&
    !isUserAssigned(m, currentUserId) &&
    !assignedTimeSlots.has(new Date(m.date).toISOString())
  )

  // Group pending signups by time
  const pendingGroupMap = new Map<string, Match[]>()
  myPendingSignups.forEach(match => {
    const dt = new Date(match.date).toISOString()
    if (!pendingGroupMap.has(dt)) pendingGroupMap.set(dt, [])
    pendingGroupMap.get(dt)!.push(match)
  })

  if (loading) {
    return <div className="production-dashboard__loading">Loading matches...</div>
  }

  return (
    <div className="staff-signups-v2">
      {/* Header */}
      <div className="staff-signups-v2__header">
        <h2>Staff Signups</h2>
        <p>Sign up for upcoming matches and track your assignments</p>
        <div className="staff-signups-v2__tz">
          <Globe size={12} /> Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </div>
      </div>

      {/* ── My Assignments (compact pills) ── */}
      {myAssignments.length > 0 && (
        <div className="staff-signups-v2__section">
          <h3 className="staff-signups-v2__section-title staff-signups-v2__section-title--confirmed">
            <CheckCircle size={14} /> My Assignments ({myAssignments.length})
          </h3>
          <div className="staff-signups-v2__assignments">
            {myAssignments.map(match => {
              const assignedRoles = getMyAssignedRoles(match, currentUserId)
              return (
                <div key={match.id} className="staff-signups-v2__assignment-row">
                  <span className="staff-signups-v2__assignment-date">
                    {new Date(match.date).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                  <span className="staff-signups-v2__assignment-title">{match.title}</span>
                  <div className="staff-signups-v2__assignment-roles">
                    {assignedRoles.map((role, idx) => (
                      <span key={idx} className="staff-signups-v2__role-pill staff-signups-v2__role-pill--confirmed">
                        <Lock size={10} /> {role}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── My Pending Signups (compact pills with remove) ── */}
      {pendingGroupMap.size > 0 && (
        <div className="staff-signups-v2__section">
          <h3 className="staff-signups-v2__section-title staff-signups-v2__section-title--pending">
            <Clock size={14} /> Pending Signups ({myPendingSignups.length})
          </h3>
          <div className="staff-signups-v2__pending">
            {Array.from(pendingGroupMap.entries()).map(([dateTime, groupMatches]) => {
              const allRoles = new Map<string, { key: 'observer' | 'producer' | 'caster'; matchIds: number[] }>()
              groupMatches.forEach(match => {
                const roles = getMySignupRoles(match, currentUserId)
                roles.forEach(r => {
                  if (!allRoles.has(r.role)) allRoles.set(r.role, { key: r.key, matchIds: [] })
                  allRoles.get(r.role)!.matchIds.push(match.id)
                })
              })

              return (
                <div key={dateTime} className="staff-signups-v2__pending-row">
                  <span className="staff-signups-v2__pending-date">
                    {new Date(dateTime).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                  <span className="staff-signups-v2__pending-matches">
                    {groupMatches.length} match{groupMatches.length > 1 ? 'es' : ''}
                  </span>
                  <div className="staff-signups-v2__pending-roles">
                    {Array.from(allRoles.entries()).map(([roleName, { key, matchIds }]) => {
                      const isLocked = groupMatches.some(m => isRoleAssigned(m, currentUserId, key))
                      return (
                        <span key={roleName} className={`staff-signups-v2__role-pill staff-signups-v2__role-pill--pending staff-signups-v2__role-pill--${key}`}>
                          {roleName}
                          {isLocked ? (
                            <Lock size={10} className="staff-signups-v2__role-lock" />
                          ) : (
                            <button
                              className="staff-signups-v2__role-remove"
                              onClick={async () => {
                                await Promise.all(matchIds.map(id => handleRemoveSignup(id, key)))
                              }}
                              title="Remove signup"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Available Time Slots (compact table) ── */}
      <div className="staff-signups-v2__section">
        <h3 className="staff-signups-v2__section-title">
          Available Time Slots ({matchGroups.length})
        </h3>
        {matchGroups.length === 0 ? (
          <div className="staff-signups-v2__empty">No upcoming time slots available for signup.</div>
        ) : (
          <div className="collection-list-tab__table-wrap">
            <table className="collection-list-tab__table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Matches</th>
                  <th style={{ textAlign: 'center' }}><Eye size={12} /> Obs</th>
                  <th style={{ textAlign: 'center' }}><Clapperboard size={12} /> Prod</th>
                  <th style={{ textAlign: 'center' }}><Mic size={12} /> Cast</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {matchGroups.map(group => {
                  const counts = getGroupRoleCounts(group)
                  const userSignedUp = group.matches.some(m => isUserSignedUp(m, currentUserId))
                  const userAssigned = group.matches.some(m => isUserAssigned(m, currentUserId))
                  const hasReschedule = group.matches.some(m => m.productionWorkflow?.dateChanged)
                  const totalSignups = counts.observers + counts.producers + counts.casters

                  return (
                    <tr key={group.dateTime} className={`collection-list-tab__row ${hasReschedule ? 'collection-list-tab__row--warning' : ''}`}>
                      <td className="staff-signups-v2__td-date">
                        {group.formattedDate}
                        {hasReschedule && (
                          <span className="staff-signups-v2__reschedule-icon" title="Rescheduled — signups were reset">
                            <AlertTriangle size={12} />
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="staff-signups-v2__match-tags">
                          {group.matches.map(m => (
                            <span key={m.id} className="staff-signups-v2__match-tag">
                              {m.title}
                              {m.isTournamentSlot && <Target size={10} className="staff-signups-v2__slot-icon" />}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="staff-signups-v2__td-count">
                        <span className={counts.observers > 0 ? 'staff-signups-v2__count--has' : 'staff-signups-v2__count--none'}>
                          {counts.observers}
                        </span>
                      </td>
                      <td className="staff-signups-v2__td-count">
                        <span className={counts.producers > 0 ? 'staff-signups-v2__count--has' : 'staff-signups-v2__count--none'}>
                          {counts.producers}
                        </span>
                      </td>
                      <td className="staff-signups-v2__td-count">
                        <span className={counts.casters > 0 ? 'staff-signups-v2__count--has' : 'staff-signups-v2__count--none'}>
                          {counts.casters}
                        </span>
                      </td>
                      <td>
                        {userAssigned ? (
                          <span className="collection-list-tab__badge collection-list-tab__badge--complete">Assigned</span>
                        ) : userSignedUp ? (
                          <span className="collection-list-tab__badge collection-list-tab__badge--scheduled">Signed Up</span>
                        ) : totalSignups === 0 ? (
                          <span className="collection-list-tab__badge collection-list-tab__badge--cancelled">Needs Staff</span>
                        ) : (
                          <span className="collection-list-tab__badge">Open</span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`staff-signups-v2__action-btn ${userSignedUp ? 'staff-signups-v2__action-btn--active' : ''}`}
                          onClick={() => { setSelectedMatchGroup(group); setShowModal(true) }}
                        >
                          {userSignedUp ? '✓ Edit' : 'Sign Up'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Signup Modal */}
      {showModal && (
        <SignupModal
          matchGroup={selectedMatchGroup}
          currentUserId={currentUserId}
          onClose={() => { setShowModal(false); setSelectedMatchGroup(null) }}
          onSignup={handleSignup}
        />
      )}
    </div>
  )
}
