'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@payloadcms/ui'
import { toast } from '@payloadcms/ui'

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

const getGroupSignupCount = (group: MatchGroup): number => {
  const uniqueUsers = new Set<number>()
  group.matches.forEach(m => {
    m.productionWorkflow?.observerSignups?.forEach(u => {
      const id = getUserId(u)
      if (id) uniqueUsers.add(id)
    })
    m.productionWorkflow?.producerSignups?.forEach(u => {
      const id = getUserId(u)
      if (id) uniqueUsers.add(id)
    })
    m.productionWorkflow?.casterSignups?.forEach(c => {
      const id = getUserId(c.user)
      if (id) uniqueUsers.add(id)
    })
  })
  return uniqueUsers.size
}

const getGroupRoleCounts = (group: MatchGroup) => {
  const observers = new Set<number>()
  const producers = new Set<number>()
  const casters = new Set<number>()
  const observerNames: string[] = []
  const producerNames: string[] = []
  const casterNames: string[] = []

  group.matches.forEach(m => {
    m.productionWorkflow?.observerSignups?.forEach(u => {
      const id = getUserId(u)
      if (id) {
        observers.add(id)
        const name = getUserName(u)
        if (!observerNames.includes(name)) observerNames.push(name)
      }
    })
    m.productionWorkflow?.producerSignups?.forEach(u => {
      const id = getUserId(u)
      if (id) {
        producers.add(id)
        const name = getUserName(u)
        if (!producerNames.includes(name)) producerNames.push(name)
      }
    })
    m.productionWorkflow?.casterSignups?.forEach(c => {
      const id = getUserId(c.user)
      if (id) {
        casters.add(id)
        const name = getUserName(c.user)
        const style = c.style ? ` (${c.style})` : ''
        const fullName = `${name}${style}`
        if (!casterNames.includes(fullName)) casterNames.push(fullName)
      }
    })
  })

  return {
    observers: observers.size,
    producers: producers.size,
    casters: casters.size,
    observerNames,
    producerNames,
    casterNames,
  }
}

const groupHasReschedule = (group: MatchGroup): boolean => {
  return group.matches.some(m => m.productionWorkflow?.dateChanged)
}

const getRescheduleInfo = (group: MatchGroup): string | null => {
  const rescheduled = group.matches.find(m => m.productionWorkflow?.dateChanged)
  if (!rescheduled?.productionWorkflow?.previousDate) return null
  return new Date(rescheduled.productionWorkflow.previousDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ─── Signup Tooltip Component ───

function SignupTooltip({ names, count, role }: { names: string[]; count: number; role: string }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [mounted, setMounted] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const calculatedRef = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setShowTooltip(false)
        calculatedRef.current = false
      }
    }
    if (showTooltip) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showTooltip])

  const updatePosition = () => {
    if (!wrapperRef.current || calculatedRef.current) return
    calculatedRef.current = true
    const rect = wrapperRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const tooltipWidth = 250
    let left = rect.left + rect.width / 2
    let transform = 'translateX(-50%)'
    if (left + tooltipWidth / 2 > viewportWidth - 20) {
      left = rect.right - 10
      transform = 'translateX(-100%)'
    } else if (left - tooltipWidth / 2 < 20) {
      left = rect.left + 10
      transform = 'translateX(0)'
    }
    setTooltipStyle({
      position: 'fixed',
      top: `${rect.bottom + 8}px`,
      left: `${left}px`,
      transform,
      zIndex: 10000,
    })
  }

  if (count === 0) return <span className="signup-count-number">0</span>

  const tooltipContent = showTooltip && mounted ? createPortal(
    <div ref={tooltipRef} className="signup-tooltip" style={tooltipStyle}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => { setShowTooltip(false); calculatedRef.current = false }}
    >
      <div className="signup-tooltip__header">{role} Signups</div>
      <ul className="signup-tooltip__list">
        {names.map((name, idx) => <li key={idx}>{name}</li>)}
      </ul>
    </div>,
    document.body
  ) : null

  return (
    <>
      <div className="signup-count-wrapper" ref={wrapperRef}
        onMouseEnter={() => { calculatedRef.current = false; setShowTooltip(true); setTimeout(updatePosition, 0) }}
        onMouseLeave={() => { setShowTooltip(false); calculatedRef.current = false }}
        onClick={() => {
          if (!showTooltip) { calculatedRef.current = false; setShowTooltip(true); setTimeout(updatePosition, 0) }
          else { setShowTooltip(false); calculatedRef.current = false }
        }}
      >
        <span className="signup-count-number has-signups">{count}</span>
      </div>
      {tooltipContent}
    </>
  )
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
          <button className="signup-modal__close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>
        <div className="signup-modal__body">
          <div className="signup-modal__match-info">
            <h4>📅 {matchGroup.formattedDate}</h4>
            <p className="signup-modal__match-count">
              {matchGroup.matches.length} match{matchGroup.matches.length > 1 ? 'es' : ''} at this time
            </p>
            <div className="signup-modal__match-list">
              {matchGroup.matches.map(match => (
                <div key={match.id} className="signup-modal__match-item">• {match.title}</div>
              ))}
            </div>
            <p className="signup-modal__note">
              💡 You'll be marked as available for all matches at this time. Staff managers will assign you to specific matches later.
            </p>
          </div>
          <div className="signup-modal__roles">
            <label className="signup-checkbox">
              <input type="checkbox" checked={roles.observer} onChange={e => setRoles({ ...roles, observer: e.target.checked })} />
              <span>👁️ I can observe</span>
            </label>
            <label className="signup-checkbox">
              <input type="checkbox" checked={roles.producer} onChange={e => setRoles({ ...roles, producer: e.target.checked })} />
              <span>🎬 I can produce</span>
            </label>
            <label className="signup-checkbox">
              <input type="checkbox" checked={roles.caster} onChange={e => setRoles({ ...roles, caster: e.target.checked })} />
              <span>🎙️ I can cast</span>
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

// ─── Time Slot Card (used in Available section) ───

function TimeSlotCard({ group, currentUserId, isSignedUp, isAssigned, onOpenSignup }: {
  group: MatchGroup
  currentUserId: number | null
  isSignedUp: boolean
  isAssigned: boolean
  onOpenSignup: (group: MatchGroup) => void
}) {
  const roleCounts = getGroupRoleCounts(group)
  const hasReschedule = groupHasReschedule(group)
  const rescheduleFromDate = getRescheduleInfo(group)

  return (
    <div className={`time-slot-group ${isSignedUp ? 'time-slot-group--signed-up' : ''} ${hasReschedule ? 'time-slot-group--rescheduled' : ''}`}>
      <div className="time-slot-group__header">
        <div className="time-slot-group__info">
          <h4 className="time-slot-group__datetime">{group.formattedDate}</h4>
          <div className="time-slot-group__match-preview">
            {group.matches.map(m => (
              <span key={m.id} className="time-slot-group__match-tag">
                {m.title}
                {m.region && <span className="time-slot-group__region-badge">{m.region}</span>}
              </span>
            ))}
          </div>
        </div>

        <div className="time-slot-group__stats">
          <span className="time-slot-group__stat">👁️ <SignupTooltip names={roleCounts.observerNames} count={roleCounts.observers} role="Observer" /></span>
          <span className="time-slot-group__stat">🎬 <SignupTooltip names={roleCounts.producerNames} count={roleCounts.producers} role="Producer" /></span>
          <span className="time-slot-group__stat">🎙️ <SignupTooltip names={roleCounts.casterNames} count={roleCounts.casters} role="Caster" /></span>
        </div>

        <button
          className={`staff-signup-btn ${isSignedUp ? 'staff-signup-btn--active' : ''}`}
          onClick={() => onOpenSignup(group)}
        >
          {isSignedUp ? '✓ Signed Up' : 'Sign Up'}
        </button>
        {isAssigned && <span className="assigned-badge">✅ Assigned</span>}
      </div>

      {hasReschedule && rescheduleFromDate && (
        <div className="time-slot-group__reschedule-warning">
          ⚠️ Rescheduled from {rescheduleFromDate} — signups were reset
        </div>
      )}
    </div>
  )
}

// ─── Pending Signup Card ───

function PendingSignupCard({ dateTime, groupMatches, currentUserId, onRemoveSignup, isRoleAssigned, getMySignupRoles }: {
  dateTime: string
  groupMatches: Match[]
  currentUserId: number | null
  onRemoveSignup: (matchId: number, role: 'observer' | 'producer' | 'caster') => Promise<void>
  isRoleAssigned: (match: Match, userId: number | null, role: 'observer' | 'producer' | 'caster') => boolean
  getMySignupRoles: (match: Match, userId: number | null) => string[]
}) {
  const allRoles = new Set<string>()
  const roleToMatches = new Map<string, number[]>()

  groupMatches.forEach(match => {
    const roles = getMySignupRoles(match, currentUserId)
    roles.forEach(role => {
      allRoles.add(role)
      const roleKey = role.toLowerCase().split(' ')[0]
      if (!roleToMatches.has(roleKey)) roleToMatches.set(roleKey, [])
      roleToMatches.get(roleKey)!.push(match.id)
    })
  })

  const formattedDate = new Date(dateTime).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })

  const matchTitles = groupMatches.map(m => m.title).join(', ')

  return (
    <div className="pending-signup-row">
      <div className="pending-signup-row__left">
        <h4 className="pending-signup-row__date">{formattedDate}</h4>
        <span className="pending-signup-row__match-count">
          {groupMatches.length} match{groupMatches.length > 1 ? 'es' : ''}
        </span>
      </div>
      <div className="pending-signup-row__roles">
        {Array.from(allRoles).map((role, idx) => {
          const roleKey = role.toLowerCase().split(' ')[0] as 'observer' | 'producer' | 'caster'
          const isAnyAssigned = groupMatches.some(m => isRoleAssigned(m, currentUserId, roleKey))
          return (
            <span key={idx} className="pending-signup-row__role-pill">
              {role}
              {isAnyAssigned ? (
                <span className="pending-signup-row__locked" title="Assigned — cannot remove">🔒</span>
              ) : (
                <button
                  className="pending-signup-row__remove"
                  onClick={async () => {
                    const matchIds = roleToMatches.get(roleKey) || []
                    await Promise.all(matchIds.map(id => onRemoveSignup(id, roleKey)))
                  }}
                  title="Remove signup"
                >✕</button>
              )}
            </span>
          )
        })}
      </div>
      <span className="pending-signup-row__badge">⏳ Pending</span>
      <div className="pending-signup-row__matches" title={matchTitles}>
        {matchTitles}
      </div>
    </div>
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

  const getMySignupRoles = (match: Match, userId: number | null): string[] => {
    if (!userId) return []
    const pw = match.productionWorkflow
    if (!pw) return []
    const roles: string[] = []
    if (pw.observerSignups?.some(u => getUserId(u) === userId)) roles.push('Observer')
    if (pw.producerSignups?.some(u => getUserId(u) === userId)) roles.push('Producer')
    const caster = pw.casterSignups?.find(c => getUserId(c.user) === userId)
    if (caster) roles.push(caster.style ? `Caster (${caster.style})` : 'Caster')
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

  // Split into priority sections
  const needsStaffGroups = matchGroups.filter(g => getGroupSignupCount(g) === 0)
  const hasStaffGroups = matchGroups.filter(g => getGroupSignupCount(g) > 0)

  // My signups and assignments
  const mySignups = matches.filter(m => isUserSignedUp(m, currentUserId))
  const myAssignments = matches.filter(m => isUserAssigned(m, currentUserId) && m.productionWorkflow?.includeInSchedule === true)
  const assignedTimeSlots = new Set(myAssignments.map(m => new Date(m.date).toISOString()))
  const myPendingSignups = mySignups.filter(m => {
    return !isUserAssigned(m, currentUserId) && !assignedTimeSlots.has(new Date(m.date).toISOString())
  })

  // Group pending signups by time
  const pendingSignupGroups = new Map<string, Match[]>()
  myPendingSignups.forEach(match => {
    const dt = new Date(match.date).toISOString()
    if (!pendingSignupGroups.has(dt)) pendingSignupGroups.set(dt, [])
    pendingSignupGroups.get(dt)!.push(match)
  })

  if (loading) {
    return <div className="production-dashboard__loading">Loading matches...</div>
  }

  return (
    <div className="production-dashboard__staff-signups">
      <div className="production-dashboard__header">
        <h2>Staff Signups</h2>
        <p className="production-dashboard__subtitle">
          Sign up for upcoming matches and track your assignments
        </p>
        <div className="production-dashboard__timezone-notice">
          🌍 <strong>Timezone Info:</strong> All times are automatically shown in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone})
        </div>
      </div>

      {/* Section 1: Staff Signed Up — some coverage but may still need more */}
      <div className="staff-signups-section">
        <h3>✅ Staff Signed Up{hasStaffGroups.length > 0 ? ` (${hasStaffGroups.length})` : ''}</h3>
        <p className="production-dashboard__subtitle">
          Some staff have signed up, but more may still be needed. Don't hesitate to sign up even if others already have!
        </p>
        {hasStaffGroups.length === 0 && needsStaffGroups.length === 0 ? (
          <div className="production-dashboard__empty">
            <p>No upcoming time slots available for signup.</p>
          </div>
        ) : hasStaffGroups.length === 0 ? (
          <div className="production-dashboard__empty">
            <p>No time slots have signups yet. Be the first!</p>
          </div>
        ) : (
          <div className="time-slot-groups">
            {hasStaffGroups.map(group => (
              <TimeSlotCard
                key={group.dateTime}
                group={group}
                currentUserId={currentUserId}
                isSignedUp={group.matches.some(m => isUserSignedUp(m, currentUserId))}
                isAssigned={group.matches.some(m => isUserAssigned(m, currentUserId))}
                onOpenSignup={g => { setSelectedMatchGroup(g); setShowModal(true) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Needs Staff (0 signups) */}
      {needsStaffGroups.length > 0 && (
        <div className="staff-signups-section staff-signups-section--urgent">
          <h3>🔴 Needs Staff — No Signups Yet</h3>
          <div className="time-slot-groups">
            {needsStaffGroups.map(group => (
              <TimeSlotCard
                key={group.dateTime}
                group={group}
                currentUserId={currentUserId}
                isSignedUp={group.matches.some(m => isUserSignedUp(m, currentUserId))}
                isAssigned={group.matches.some(m => isUserAssigned(m, currentUserId))}
                onOpenSignup={g => { setSelectedMatchGroup(g); setShowModal(true) }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Section 3: My Assignments */}
      <div className="staff-signups-section staff-signups-section--assignments">
        <h3>✅ My Assignments (Confirmed)</h3>
        {myAssignments.length === 0 ? (
          <div className="production-dashboard__empty">
            <p>You haven't been assigned to any matches yet.</p>
          </div>
        ) : (
          <div className="my-signups-list">
            {myAssignments.map(match => {
              const assignedRoles = getMyAssignedRoles(match, currentUserId)
              return (
                <div key={match.id} className={`my-signup-card my-signup-card--assigned ${match.isTournamentSlot ? 'my-signup-card--tournament-slot' : ''}`}>
                  <div className="my-signup-card__header">
                    <div>
                      <h4>
                        {match.title}
                        {match.isTournamentSlot && <span className="time-slot-match__slot-badge">🎯 Slot</span>}
                      </h4>
                      <p className="my-signup-card__date">
                        {new Date(match.date).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric',
                          hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
                        })}
                      </p>
                      {match.opponent && (
                        <p className="my-signup-card__opponent"><strong>Opponent:</strong> {match.opponent}</p>
                      )}
                      {match.faceitLobby && (
                        <p className="my-signup-card__lobby">
                          <a href={match.faceitLobby} target="_blank" rel="noopener noreferrer" className="my-signup-card__lobby-link">
                            🎮 Join Lobby →
                          </a>
                        </p>
                      )}
                    </div>
                    <div className="my-signup-card__status">
                      <span className="status-badge status-badge--assigned">✅ Confirmed</span>
                    </div>
                  </div>
                  <div className="my-signup-card__roles">
                    <strong>Assigned as:</strong>
                    <div className="my-signup-card__role-list">
                      {assignedRoles.map((role, idx) => (
                        <div key={idx} className="my-signup-role my-signup-role--assigned">
                          <span>{role}</span>
                          <span className="my-signup-role__locked" title="Cannot remove - you've been assigned">🔒</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Section 4: My Pending Signups */}
      <div className="staff-signups-section">
        <h3>⏳ My Signups (Pending Confirmation)</h3>
        {pendingSignupGroups.size === 0 ? (
          <div className="production-dashboard__empty">
            <p>No pending signups. All your signups have been confirmed!</p>
          </div>
        ) : (
          <div className="my-signups-list">
            {Array.from(pendingSignupGroups.entries()).map(([dateTime, groupMatches]) => (
              <PendingSignupCard
                key={dateTime}
                dateTime={dateTime}
                groupMatches={groupMatches}
                currentUserId={currentUserId}
                onRemoveSignup={handleRemoveSignup}
                isRoleAssigned={isRoleAssigned}
                getMySignupRoles={getMySignupRoles}
              />
            ))}
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
