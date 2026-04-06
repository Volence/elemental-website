'use client'

import React, { useState, useEffect } from 'react'
import { toast } from '@payloadcms/ui'
import { AlertTriangle, CheckCircle, ClipboardList, Globe, XCircle, ChevronDown, ChevronRight, X } from 'lucide-react'

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
  matchType: string
  team: any
  team1Type?: 'internal' | 'external'
  team1Internal?: any
  team1External?: string
  team2Type?: 'internal' | 'external'
  team2Internal?: any
  team2External?: string
  isTournamentSlot?: boolean
  opponent: string
  date: string
  region: string
  league: string
  faceitLobby?: string
  productionWorkflow?: {
    priority: string
    coverageStatus: string
    observerSignups?: (User | number)[]
    producerSignups?: (User | number)[]
    casterSignups?: CasterSignup[]
    assignedObserver?: User | number | null
    assignedProducer?: User | number | null
    assignedCasters?: CasterSignup[]
    dateChanged?: boolean
    previousDate?: string
  }
}

interface MatchGroup {
  dateTime: string
  matches: Match[]
  formattedDate: string
}

// ─── Utility functions ───

const getUserId = (user: User | number | null | undefined): number | null => {
  if (!user) return null
  return typeof user === 'number' ? user : user.id
}

const getUserName = (user: User | number | null | undefined): string => {
  if (!user) return 'Not assigned'
  if (typeof user === 'number') return `User #${user}`
  return user.name || user.email || 'Unknown'
}

const getCoverageIcon = (status?: string): React.ReactNode => {
  switch (status) {
    case 'full': return <CheckCircle size={12} />
    case 'partial': return <AlertTriangle size={12} />
    default: return <XCircle size={12} />
  }
}

const getCoverageClass = (status?: string) => {
  switch (status) {
    case 'full': return 'coverage-badge--full'
    case 'partial': return 'coverage-badge--partial'
    default: return 'coverage-badge--none'
  }
}

// ─── Role Assignment Block ───

function RoleAssignmentBlock({ matchId, roleName, roleKey, maxSlots, signups, assigned, onAssign, onUnassign }: {
  matchId: number
  roleName: string
  roleKey: 'observer' | 'producer' | 'caster'
  maxSlots: number
  signups: (User | number)[] | CasterSignup[]
  assigned: (User | number | null) | CasterSignup[]
  onAssign: (matchId: number, role: 'observer' | 'producer' | 'caster', userId: number, style?: string) => void
  onUnassign: (matchId: number, role: 'observer' | 'producer' | 'caster', idx?: number) => void
}) {
  const isCaster = roleKey === 'caster'
  const assignedList: { user: User | number | null; style?: string }[] = isCaster
    ? (assigned as CasterSignup[] || []).map(c => ({ user: c.user, style: c.style }))
    : assigned ? [{ user: assigned as User | number }] : []
  const slotsFilled = assignedList.length
  const slotsAvailable = maxSlots - slotsFilled

  return (
    <div className="assignment-role">
      <div className="assignment-role__header">
        <h4>{roleName}</h4>
        <span className={`assignment-role__slots ${slotsFilled >= maxSlots ? 'assignment-role__slots--full' : ''}`}>
          {slotsFilled}/{maxSlots}
        </span>
      </div>
      <div className="assignment-role__content">
        <div className="assignment-role__signups">
          <span className="assignment-role__label">Available:</span>
          {signups.length === 0 ? (
            <span className="assignment-empty">No signups</span>
          ) : (
            <div className="assignment-signup-list">
              {signups.map((signup, idx) => {
                const user = isCaster ? (signup as CasterSignup).user : signup
                const userId = getUserId(user as User | number)
                const name = getUserName(user as User | number)
                const style = isCaster ? (signup as CasterSignup).style : undefined
                const isAlreadyAssigned = assignedList.some(a => getUserId(a.user) === userId)

                return (
                  <button
                    key={idx}
                    onClick={() => userId && onAssign(matchId, roleKey, userId, style)}
                    className={`assignment-signup-btn ${isAlreadyAssigned ? 'assignment-signup-btn--assigned' : ''}`}
                    disabled={slotsAvailable <= 0 || isAlreadyAssigned}
                    title={isAlreadyAssigned ? 'Already assigned' : slotsAvailable <= 0 ? 'All slots filled' : `Assign ${name}`}
                  >
                    {name}
                    {style && <span className="assignment-signup-btn__style">{style}</span>}
                    {isAlreadyAssigned && <span className="assignment-signup-btn__check">✓</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="assignment-role__assigned">
          <span className="assignment-role__label">Assigned:</span>
          {assignedList.length === 0 ? (
            <span className="assignment-empty">None</span>
          ) : (
            <div className="assignment-assigned-list">
              {assignedList.map((item, idx) => (
                <div key={idx} className="assignment-assigned-item">
                  <span className="assignment-assigned-item__name">
                    {getUserName(item.user)}
                    {item.style && <span className="assignment-assigned-item__style">{item.style}</span>}
                  </span>
                  <button
                    onClick={() => onUnassign(matchId, roleKey, isCaster ? idx : undefined)}
                    className="assignment-unassign-btn"
                    title="Unassign"
                  ><X size={10} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Match Assignment Card ───

function MatchAssignmentCard({ match, onAssign, onUnassign }: {
  match: Match
  onAssign: (matchId: number, role: 'observer' | 'producer' | 'caster', userId: number, style?: string) => void
  onUnassign: (matchId: number, role: 'observer' | 'producer' | 'caster', idx?: number) => void
}) {
  const pw = match.productionWorkflow || {} as NonNullable<Match['productionWorkflow']>
  const hasReschedule = pw.dateChanged
  const totalSignups = (pw.observerSignups?.length || 0) + (pw.producerSignups?.length || 0) + (pw.casterSignups?.length || 0)
  const isFullyCovered = pw.coverageStatus === 'full'
  const [expanded, setExpanded] = useState(totalSignups > 0 && !isFullyCovered)

  return (
    <div className={`assignment-match ${hasReschedule ? 'assignment-match--rescheduled' : ''}`}>
      <div className="assignment-match__header" onClick={() => setExpanded(!expanded)}>
        <div className="assignment-match__header-left">
          <span className="assignment-time-slot__icon">{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
          <div className="assignment-match__info">
            <h3>{match.title}</h3>
            <div className="assignment-match__meta">
              {match.region && <span className="assignment-match__region">{match.region}</span>}
              <span className={`coverage-badge ${getCoverageClass(pw.coverageStatus)}`}>
                {getCoverageIcon(pw.coverageStatus)} {pw.coverageStatus || 'none'}
              </span>
              {totalSignups > 0 && (
                <span className="assignment-match__signup-count">
                  {totalSignups} signup{totalSignups !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        <a href={`/admin/collections/matches/${match.id}`} target="_blank" rel="noopener noreferrer" className="assignment-match__link"
          onClick={e => e.stopPropagation()}>
          Edit →
        </a>
      </div>

      {hasReschedule && pw.previousDate && (
        <div className="assignment-match__reschedule-warning">
          <AlertTriangle size={12} /> Rescheduled from {new Date(pw.previousDate).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          })} — signups were reset
        </div>
      )}

      {expanded && (
        <div className="assignment-roles">
          <RoleAssignmentBlock
            matchId={match.id}
            roleName="Observer"
            roleKey="observer"
            maxSlots={1}
            signups={pw.observerSignups || []}
            assigned={pw.assignedObserver ?? null}
            onAssign={onAssign}
            onUnassign={onUnassign}
          />
          <RoleAssignmentBlock
            matchId={match.id}
            roleName="Producer"
            roleKey="producer"
            maxSlots={1}
            signups={pw.producerSignups || []}
            assigned={pw.assignedProducer ?? null}
            onAssign={onAssign}
            onUnassign={onUnassign}
          />
          <RoleAssignmentBlock
            matchId={match.id}
            roleName="Casters"
            roleKey="caster"
            maxSlots={2}
            signups={pw.casterSignups || []}
            assigned={pw.assignedCasters || []}
            onAssign={onAssign}
            onUnassign={onUnassign}
          />
        </div>
      )}
    </div>
  )
}

// ─── Main AssignmentView ───

export function AssignmentView() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchMatches() }, [])

  const fetchMatches = async () => {
    try {
      setLoading(true)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const query = `/api/matches?where[date][greater_than_equal]=${today.toISOString()}&where[productionWorkflow.isArchived][not_equals]=true&where[status][not_equals]=complete&sort=date&limit=100&depth=2`
      const response = await fetch(query)
      const data = await response.json()
      setMatches(data.docs || [])
    } catch (error) {
      console.error('Error fetching matches:', error)
      toast.error('Error fetching matches')
    } finally {
      setLoading(false)
    }
  }

  const assignStaff = async (matchId: number, role: 'observer' | 'producer' | 'caster', userId: number, casterStyle?: string) => {
    try {
      const match = matches.find(m => m.id === matchId)
      if (!match) return
      const pw = match.productionWorkflow || {} as NonNullable<Match['productionWorkflow']>
      let updateData: any = {}

      if (role === 'observer') {
        updateData.productionWorkflow = { ...pw, assignedObserver: userId }
      } else if (role === 'producer') {
        updateData.productionWorkflow = { ...pw, assignedProducer: userId }
      } else if (role === 'caster') {
        updateData.productionWorkflow = {
          ...pw,
          assignedCasters: [...(pw.assignedCasters || []), { user: userId, style: casterStyle || 'both' }],
        }
      }

      const response = await fetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        const matchResponse = await fetch(`/api/matches/${matchId}?depth=2`)
        const matchData = await matchResponse.json()
        setMatches(matches.map(m => m.id === matchId ? matchData : m))
        toast.success('Staff assigned!')
      } else {
        toast.error('Failed to assign staff')
      }
    } catch (error) {
      console.error('Error assigning staff:', error)
      toast.error('Error assigning staff')
    }
  }

  const unassignStaff = async (matchId: number, role: 'observer' | 'producer' | 'caster', casterIndex?: number) => {
    try {
      const match = matches.find(m => m.id === matchId)
      if (!match) return
      const pw = match.productionWorkflow || {} as NonNullable<Match['productionWorkflow']>
      let updateData: any = {}

      if (role === 'observer') {
        updateData.productionWorkflow = { ...pw, assignedObserver: null }
      } else if (role === 'producer') {
        updateData.productionWorkflow = { ...pw, assignedProducer: null }
      } else if (role === 'caster' && casterIndex !== undefined) {
        updateData.productionWorkflow = {
          ...pw,
          assignedCasters: (pw.assignedCasters || []).filter((_: CasterSignup, idx: number) => idx !== casterIndex),
        }
      }

      const response = await fetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        const matchResponse = await fetch(`/api/matches/${matchId}?depth=2`)
        const matchData = await matchResponse.json()
        setMatches(matches.map(m => m.id === matchId ? matchData : m))
        toast.success('Staff unassigned!')
      } else {
        toast.error('Failed to unassign')
      }
    } catch (error) {
      console.error('Error unassigning staff:', error)
      toast.error('Error unassigning staff')
    }
  }

  if (loading) {
    return <div className="production-dashboard__loading">Loading matches...</div>
  }

  // Group matches by time
  const matchGroupsMap = new Map<string, Match[]>()
  matches.forEach(match => {
    const dt = new Date(match.date).toISOString()
    if (!matchGroupsMap.has(dt)) matchGroupsMap.set(dt, [])
    matchGroupsMap.get(dt)!.push(match)
  })

  const matchGroups: MatchGroup[] = Array.from(matchGroupsMap.entries())
    .map(([dateTime, matches]) => ({
      dateTime,
      matches,
      formattedDate: new Date(dateTime).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      }),
    }))
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())

  // Helper: get slot-level assignment counts (since only 1 stream per time slot)
  const getSlotAssignments = (g: MatchGroup) => {
    let observers = 0, producers = 0, casters = 0
    const countedObservers = new Set<number>()
    const countedProducers = new Set<number>()
    const countedCasters = new Set<number>()

    g.matches.forEach(m => {
      const pw = m.productionWorkflow
      if (!pw) return
      if (pw.assignedObserver) {
        const id = getUserId(pw.assignedObserver)
        if (id && !countedObservers.has(id)) { countedObservers.add(id); observers++ }
      }
      if (pw.assignedProducer) {
        const id = getUserId(pw.assignedProducer)
        if (id && !countedProducers.has(id)) { countedProducers.add(id); producers++ }
      }
      pw.assignedCasters?.forEach(c => {
        const id = getUserId(c.user)
        if (id && !countedCasters.has(id)) { countedCasters.add(id); casters++ }
      })
    })
    return { observers, producers, casters }
  }

  const isSlotFullyBooked = (g: MatchGroup) => {
    const a = getSlotAssignments(g)
    return a.observers >= 1 && a.producers >= 1 && a.casters >= 2
  }

  const isSlotPartiallyAssigned = (g: MatchGroup) => {
    const a = getSlotAssignments(g)
    const hasAny = a.observers > 0 || a.producers > 0 || a.casters > 0
    return hasAny && !isSlotFullyBooked(g)
  }

  const groupHasSignup = (g: MatchGroup) =>
    g.matches.some(m => {
      const pw = m.productionWorkflow
      if (!pw) return false
      return (pw.observerSignups?.length || 0) + (pw.producerSignups?.length || 0) + (pw.casterSignups?.length || 0) > 0
    })

  // Split into 4 sections based on slot-level status
  const fullyBooked = matchGroups.filter(g => isSlotFullyBooked(g))
  const partiallyAssigned = matchGroups.filter(g => isSlotPartiallyAssigned(g))
  const hasSignups = matchGroups.filter(g => !isSlotFullyBooked(g) && !isSlotPartiallyAssigned(g) && groupHasSignup(g))
  const noSignups = matchGroups.filter(g => !isSlotFullyBooked(g) && !isSlotPartiallyAssigned(g) && !groupHasSignup(g))


  return (
    <div className="production-dashboard__assignment">
      <div className="production-dashboard__header">
        <div>
          <h2>Staff Assignment</h2>
          <p className="production-dashboard__subtitle">
            Click a name under "Available" to assign them. Click the X to unassign. Coverage updates automatically.
          </p>
          <div className="production-dashboard__timezone-notice">
            <Globe size={14} /> <strong>Timezone Info:</strong> All times shown in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone})
          </div>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="production-dashboard__empty">No upcoming matches found.</div>
      ) : (
        <>
          {/* Section 1: Fully Booked */}
          {fullyBooked.length > 0 && (
            <div className="staff-signups-section staff-signups-section--assignments">
              <h3><CheckCircle size={12} /> Fully Booked ({fullyBooked.length} time slot{fullyBooked.length > 1 ? 's' : ''})</h3>
              <div className="assignment-time-slots">
                {fullyBooked.map(group => (
                  <FullyCoveredGroup key={group.dateTime} group={group} onAssign={assignStaff} onUnassign={unassignStaff} />
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Partially Assigned */}
          {partiallyAssigned.length > 0 && (
            <div className="staff-signups-section staff-signups-section--assignments">
              <h3><AlertTriangle size={12} /> Partially Assigned ({partiallyAssigned.length} time slot{partiallyAssigned.length > 1 ? 's' : ''})</h3>
              <div className="assignment-time-slots">
                {partiallyAssigned.map(group => (
                  <NeedsAssignmentGroup key={group.dateTime} group={group} onAssign={assignStaff} onUnassign={unassignStaff} />
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Has Signups — ready to assign */}
          {hasSignups.length > 0 && (
            <div className="staff-signups-section">
              <h3><ClipboardList size={14} /> Has Signups — Ready to Assign ({hasSignups.length} time slot{hasSignups.length > 1 ? 's' : ''})</h3>
              <div className="assignment-time-slots">
                {hasSignups.map(group => (
                  <NeedsAssignmentGroup key={group.dateTime} group={group} onAssign={assignStaff} onUnassign={unassignStaff} />
                ))}
              </div>
            </div>
          )}

          {/* Section 4: No Signups yet */}
          {noSignups.length > 0 && (
            <div className="staff-signups-section staff-signups-section--urgent">
              <h3><XCircle size={12} /> No Signups Yet ({noSignups.length} time slot{noSignups.length > 1 ? 's' : ''})</h3>
              <div className="assignment-time-slots">
                {noSignups.map(group => (
                  <NeedsAssignmentGroup key={group.dateTime} group={group} onAssign={assignStaff} onUnassign={unassignStaff} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Collapsible group for needs assignment slots ───

function NeedsAssignmentGroup({ group, onAssign, onUnassign }: {
  group: MatchGroup
  onAssign: (matchId: number, role: 'observer' | 'producer' | 'caster', userId: number, style?: string) => void
  onUnassign: (matchId: number, role: 'observer' | 'producer' | 'caster', idx?: number) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const totalSignups = new Set<number>()
  const totalAssigned = new Set<number>()
  group.matches.forEach(m => {
    const pw = m.productionWorkflow
    if (!pw) return
    pw.observerSignups?.forEach((u: any) => { const id = getUserId(u); if (id) totalSignups.add(id) })
    pw.producerSignups?.forEach((u: any) => { const id = getUserId(u); if (id) totalSignups.add(id) })
    pw.casterSignups?.forEach((c: any) => { const id = getUserId(c.user); if (id) totalSignups.add(id) })
    if (pw.assignedObserver) { const id = getUserId(pw.assignedObserver); if (id) totalAssigned.add(id) }
    if (pw.assignedProducer) { const id = getUserId(pw.assignedProducer); if (id) totalAssigned.add(id) }
    pw.assignedCasters?.forEach((c: any) => { const id = getUserId(c.user); if (id) totalAssigned.add(id) })
  })

  return (
    <div className="assignment-time-slot">
      <div className="assignment-time-slot__header">
        <button className="assignment-time-slot__toggle" onClick={() => setExpanded(!expanded)}>
          <span className="assignment-time-slot__icon">{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
          <div className="assignment-time-slot__info">
            <h3 className="assignment-time-slot__datetime">{group.formattedDate}</h3>
            <p className="assignment-time-slot__count">
              {group.matches.length} match{group.matches.length > 1 ? 'es' : ''}
              {' · '}{totalSignups.size} signup{totalSignups.size !== 1 ? 's' : ''}
              {' · '}{totalAssigned.size} assigned
            </p>
          </div>
        </button>
      </div>
      {expanded && (
        <div className="assignment-time-slot__matches">
          {group.matches.map(match => (
            <MatchAssignmentCard key={match.id} match={match} onAssign={onAssign} onUnassign={onUnassign} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Collapsed group for fully covered slots ───

function FullyCoveredGroup({ group, onAssign, onUnassign }: {
  group: MatchGroup
  onAssign: (matchId: number, role: 'observer' | 'producer' | 'caster', userId: number, style?: string) => void
  onUnassign: (matchId: number, role: 'observer' | 'producer' | 'caster', idx?: number) => void
}) {
  const [expanded, setExpanded] = useState(false)

  // Summarize assigned staff
  const assignedNames = new Set<string>()
  group.matches.forEach(m => {
    const pw = m.productionWorkflow
    if (!pw) return
    if (pw.assignedObserver) assignedNames.add(getUserName(pw.assignedObserver))
    if (pw.assignedProducer) assignedNames.add(getUserName(pw.assignedProducer))
    pw.assignedCasters?.forEach(c => assignedNames.add(getUserName(c.user)))
  })

  return (
    <div className="assignment-time-slot assignment-time-slot--complete">
      <div className="assignment-time-slot__header">
        <button className="assignment-time-slot__toggle" onClick={() => setExpanded(!expanded)}>
          <span className="assignment-time-slot__icon">{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
          <div className="assignment-time-slot__info">
            <h3 className="assignment-time-slot__datetime">{group.formattedDate}</h3>
            <p className="assignment-time-slot__count">
              {group.matches.length} match{group.matches.length > 1 ? 'es' : ''}
              {assignedNames.size > 0 && ` · Staff: ${Array.from(assignedNames).join(', ')}`}
            </p>
          </div>
        </button>
        <span className="assignment-time-slot__badge assignment-time-slot__badge--complete"><CheckCircle size={12} /> Full Coverage</span>
      </div>
      {expanded && (
        <div className="assignment-time-slot__matches">
          {group.matches.map(match => (
            <MatchAssignmentCard key={match.id} match={match} onAssign={onAssign} onUnassign={onUnassign} />
          ))}
        </div>
      )}
    </div>
  )
}
