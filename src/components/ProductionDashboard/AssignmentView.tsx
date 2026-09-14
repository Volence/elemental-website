'use client'

import React, { useState, useEffect } from 'react'
import { toast } from '@payloadcms/ui'
import { AlertTriangle, CheckCircle, Globe, XCircle, ChevronDown, ChevronRight, X, Eye, Clapperboard, Focus, Mic, Users } from 'lucide-react'
import { slotSignups, assignedElsewhere, type SlotSignups } from '@/utilities/productionSignups'

interface User {
  id: number
  name?: string
  email?: string
}

interface CasterSignup {
  user: User | number
  style?: string | null
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
    assignedObservers?: (User | number)[]
    assignedProducers?: (User | number)[]
    assignedDirectors?: (User | number)[]
    assignedCasters?: CasterSignup[]
    dateChanged?: boolean
    previousDate?: string
  }
}

/** Every production role is a list. Director has no signup list of its own - it draws from the
 * producer signups, because producer and director are both off-game jobs. */
type RoleKey = 'observer' | 'producer' | 'director' | 'caster'

type AssignFn = (matchId: number, role: RoleKey, userId: number, style?: string | null) => void
type UnassignFn = (matchId: number, role: RoleKey, userId: number) => void

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

const assignedIds = (list: (User | number)[] | null | undefined): number[] =>
  (list ?? []).map(getUserId).filter((id): id is number => id !== null)

const getUserName = (user: User | number | null | undefined): string => {
  if (!user) return '-'
  if (typeof user === 'number') return `User #${user}`
  return user.name || user.email || 'Unknown'
}

/** "ELMT Stellar vs ThreeTwoOne" -> "Stellar", for the short "on ..." hint. */
const shortMatchLabel = (title: string): string => title.replace(/^ELMT\s+/, '').split(' vs ')[0].trim() || title

// ─── Compact Role Row ───

function RoleRow({ matchId, roleName, roleKey, roleIcon, minSlots, signups, assigned, blockedIds = [], busyElsewhere, onAssign, onUnassign }: {
  matchId: number
  roleName: string
  roleKey: RoleKey
  roleIcon: React.ReactNode
  /** How many this role needs for full coverage. There is no maximum - a match can carry as
   * many observers as sign up - so the count reads "2/2" only as a target, never as a cap. */
  minSlots: number
  signups: (User | number)[] | CasterSignup[]
  assigned: (User | number)[] | CasterSignup[]
  /** People who cannot take this role on this match because they already hold the paired one
   * (producer and director run at the same time, so nobody may hold both). */
  blockedIds?: number[]
  /** People already working another match in this time slot, with that match's title. They stay
   * clickable - the lead decides - but are marked so nobody is double-booked by accident. */
  busyElsewhere?: Map<number, string>
  onAssign: AssignFn
  onUnassign: UnassignFn
}) {
  const isCaster = roleKey === 'caster'
  const assignedList: { user: User | number | null; style?: string | null }[] = isCaster
    ? ((assigned as CasterSignup[]) || []).map(c => ({ user: c.user, style: c.style }))
    : ((assigned as (User | number)[]) || []).map(u => ({ user: u }))
  const slotsFilled = assignedList.length

  return (
    <div className="assignment-v2__role-row">
      <div className="assignment-v2__role-label">
        {roleIcon}
        <span>{roleName}</span>
        <span className={`assignment-v2__slot-count ${slotsFilled >= minSlots ? 'assignment-v2__slot-count--full' : ''}`}>
          {slotsFilled >= minSlots ? slotsFilled : `${slotsFilled}/${minSlots}`}
        </span>
      </div>

      <div className="assignment-v2__role-people">
        {/* Assigned */}
        {assignedList.map((item, idx) => {
          const userId = getUserId(item.user)
          return (
            <span key={`a-${idx}`} className="assignment-v2__person-pill assignment-v2__person-pill--assigned">
              <CheckCircle size={10} />
              {getUserName(item.user)}
              {item.style && <em>({item.style})</em>}
              <button
                onClick={() => userId !== null && onUnassign(matchId, roleKey, userId)}
                className="assignment-v2__person-remove"
                title="Unassign"
              ><X size={10} /></button>
            </span>
          )
        })}

        {/* Available (not yet assigned) */}
        {signups.map((signup, idx) => {
          const user = isCaster ? (signup as CasterSignup).user : signup
          const userId = getUserId(user as User | number)
          const name = getUserName(user as User | number)
          const style = isCaster ? (signup as CasterSignup).style : undefined
          const isAlreadyAssigned = assignedList.some(a => getUserId(a.user) === userId)
          if (isAlreadyAssigned) return null
          // Hidden rather than disabled: a producer is not a candidate for director at all.
          if (userId !== null && blockedIds.includes(userId)) return null
          const busyOn = userId !== null ? busyElsewhere?.get(userId) : undefined

          return (
            <button
              key={`s-${idx}`}
              onClick={() => userId && onAssign(matchId, roleKey, userId, style)}
              className={`assignment-v2__person-pill assignment-v2__person-pill--available${busyOn ? ' assignment-v2__person-pill--busy' : ''}`}
              title={busyOn ? `Assign ${name} (already on ${busyOn})` : `Assign ${name}`}
            >
              {name}
              {style && <em>({style})</em>}
              {busyOn && <em>· on {shortMatchLabel(busyOn)}</em>}
            </button>
          )
        })}

        {signups.length === 0 && assignedList.length === 0 && (
          <span className="assignment-v2__no-signups">No signups</span>
        )}
      </div>
    </div>
  )
}

// ─── Match Card (compact) ───

function MatchCard({ match, signups, busyElsewhere, onAssign, onUnassign }: {
  match: Match
  /** The time slot's signups: a signup covers every match at that time, so each match offers them all. */
  signups: SlotSignups<User | number>
  busyElsewhere: Map<number, string>
  onAssign: AssignFn
  onUnassign: UnassignFn
}) {
  const pw = match.productionWorkflow || {} as NonNullable<Match['productionWorkflow']>
  const totalSignups = signups.observers.length + signups.producers.length + signups.casters.length
  const isFullyCovered = pw.coverageStatus === 'full'

  return (
    <div className={`assignment-v2__match ${isFullyCovered ? 'assignment-v2__match--covered' : ''}`}>
      <div className="assignment-v2__match-header">
        <span className="assignment-v2__match-title">{match.title}</span>
        {match.region && <span className="assignment-v2__match-region">{match.region}</span>}
        <span className={`assignment-v2__coverage assignment-v2__coverage--${pw.coverageStatus || 'none'}`}>
          {pw.coverageStatus === 'full' ? <CheckCircle size={10} /> : pw.coverageStatus === 'partial' ? <AlertTriangle size={10} /> : <XCircle size={10} />}
          {pw.coverageStatus || 'none'}
        </span>
        {totalSignups > 0 && (
          <span className={`assignment-v2__signup-count assignment-v2__signup-count--${totalSignups >= 4 ? 'full' : 'partial'}`}>
            <Users size={10} /> {totalSignups}
          </span>
        )}
        <a href={`/admin/collections/matches/${match.id}`} target="_blank" rel="noopener noreferrer" className="assignment-v2__edit-link">
          Edit →
        </a>
      </div>

      <div className="assignment-v2__roles">
        <RoleRow
          matchId={match.id} roleName="Observer" roleKey="observer" roleIcon={<Eye size={12} />}
          minSlots={1} signups={signups.observers} assigned={pw.assignedObservers || []}
          busyElsewhere={busyElsewhere}
          onAssign={onAssign} onUnassign={onUnassign}
        />
        <RoleRow
          matchId={match.id} roleName="Producer" roleKey="producer" roleIcon={<Clapperboard size={12} />}
          minSlots={1} signups={signups.producers} assigned={pw.assignedProducers || []}
          blockedIds={assignedIds(pw.assignedDirectors)} busyElsewhere={busyElsewhere}
          onAssign={onAssign} onUnassign={onUnassign}
        />
        <RoleRow
          matchId={match.id} roleName="Director" roleKey="director" roleIcon={<Focus size={12} />}
          minSlots={0} signups={signups.producers} assigned={pw.assignedDirectors || []}
          blockedIds={assignedIds(pw.assignedProducers)} busyElsewhere={busyElsewhere}
          onAssign={onAssign} onUnassign={onUnassign}
        />
        <RoleRow
          matchId={match.id} roleName="Casters" roleKey="caster" roleIcon={<Mic size={12} />}
          minSlots={2} signups={signups.casters as CasterSignup[]} assigned={pw.assignedCasters || []}
          busyElsewhere={busyElsewhere}
          onAssign={onAssign} onUnassign={onUnassign}
        />
      </div>
    </div>
  )
}

// ─── Time Slot Group ───

function TimeSlotGroup({ group, defaultOpen, onAssign, onUnassign }: {
  group: MatchGroup
  defaultOpen: boolean
  onAssign: AssignFn
  onUnassign: UnassignFn
}) {
  const [expanded, setExpanded] = useState(defaultOpen)

  const signups = slotSignups<User | number>(group.matches)
  const totalSignups = new Set<number>()
  const totalAssigned = new Set<number>()
  signups.observers.forEach(u => { const id = getUserId(u); if (id) totalSignups.add(id) })
  signups.producers.forEach(u => { const id = getUserId(u); if (id) totalSignups.add(id) })
  signups.casters.forEach(c => { const id = getUserId(c.user); if (id) totalSignups.add(id) })
  group.matches.forEach(m => {
    const pw = m.productionWorkflow
    if (!pw) return
    assignedIds(pw.assignedObservers).forEach(id => totalAssigned.add(id))
    assignedIds(pw.assignedProducers).forEach(id => totalAssigned.add(id))
    assignedIds(pw.assignedDirectors).forEach(id => totalAssigned.add(id))
    pw.assignedCasters?.forEach((c: any) => { const id = getUserId(c.user); if (id) totalAssigned.add(id) })
  })

  const hasReschedule = group.matches.some(m => m.productionWorkflow?.dateChanged)
  const hasSignups = totalSignups.size > 0

  return (
    <div className={`assignment-v2__slot ${hasReschedule ? 'assignment-v2__slot--rescheduled' : ''} ${hasSignups && totalAssigned.size === 0 ? 'assignment-v2__slot--has-signups' : ''}`}>
      <button className="assignment-v2__slot-toggle" onClick={() => setExpanded(!expanded)}>
        <span className="assignment-v2__slot-chevron">{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
        <div className="assignment-v2__slot-info">
          <strong>{group.formattedDate}</strong>
          <span className="assignment-v2__slot-meta">
            {group.matches.length} match{group.matches.length > 1 ? 'es' : ''}
            {' · '}{totalSignups.size} signup{totalSignups.size !== 1 ? 's' : ''}
            {' · '}{totalAssigned.size} assigned
          </span>
        </div>
        {hasSignups && totalAssigned.size === 0 && (
          <span className={`assignment-v2__slot-signup-indicator assignment-v2__slot-signup-indicator--${totalSignups.size >= 4 ? 'full' : 'partial'}`}>
            <Users size={10} /> {totalSignups.size} ready
          </span>
        )}
        {hasReschedule && <AlertTriangle size={12} className="assignment-v2__slot-reschedule" />}
      </button>
      {expanded && (
        <div className="assignment-v2__slot-matches">
          {group.matches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              signups={signups}
              busyElsewhere={assignedElsewhere<User | number>(group.matches, match.id)}
              onAssign={onAssign}
              onUnassign={onUnassign}
            />
          ))}
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

  /**
   * One role change on one match. The server reads the match fresh and changes only that role's
   * list, so signups that arrived after this page loaded are kept.
   */
  const changeAssignment = async (
    action: 'assign' | 'unassign',
    matchId: number,
    role: RoleKey,
    userId: number,
    style?: string | null,
  ) => {
    try {
      const response = await fetch('/api/production/assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, matchId, role, userId, style }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(data.message || (action === 'assign' ? 'Failed to assign staff' : 'Failed to unassign'))
        return
      }
      setMatches(prev => prev.map(m => m.id === matchId ? data : m))
      toast.success(action === 'assign' ? 'Staff assigned!' : 'Staff unassigned!')
    } catch (error) {
      console.error(`Error (${action}) staff:`, error)
      toast.error(action === 'assign' ? 'Error assigning staff' : 'Error unassigning staff')
    }
  }

  const assignStaff: AssignFn = (matchId, role, userId, style) =>
    changeAssignment('assign', matchId, role, userId, style)
  const unassignStaff: UnassignFn = (matchId, role, userId) =>
    changeAssignment('unassign', matchId, role, userId)

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

  // Categorize
  const isSlotFullyBooked = (g: MatchGroup) => {
    const counted = { obs: new Set<number>(), prod: new Set<number>(), cast: new Set<number>() }
    g.matches.forEach(m => {
      const pw = m.productionWorkflow
      if (!pw) return
      assignedIds(pw.assignedObservers).forEach(id => counted.obs.add(id))
      assignedIds(pw.assignedProducers).forEach(id => counted.prod.add(id))
      assignedIds(pw.assignedDirectors).forEach(id => counted.prod.add(id))
      pw.assignedCasters?.forEach(c => { const id = getUserId(c.user); if (id) counted.cast.add(id) })
    })
    return counted.obs.size >= 1 && counted.prod.size >= 1 && counted.cast.size >= 2
  }

  const groupHasSignup = (g: MatchGroup) =>
    g.matches.some(m => {
      const pw = m.productionWorkflow
      if (!pw) return false
      return (pw.observerSignups?.length || 0) + (pw.producerSignups?.length || 0) + (pw.casterSignups?.length || 0) > 0
    })

  const fullyBooked = matchGroups.filter(g => isSlotFullyBooked(g))
  const needsWork = matchGroups.filter(g => !isSlotFullyBooked(g))

  return (
    <div className="assignment-v2">
      <div className="assignment-v2__header">
        <h2>Staff Assignment</h2>
        <p>Click a name to assign them. Click ✕ to unassign. Coverage updates automatically.</p>
        <div className="assignment-v2__tz">
          <Globe size={12} /> Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="staff-signups-v2__empty">No upcoming matches found.</div>
      ) : (
        <>
          {/* Needs work */}
          {needsWork.length > 0 && (
            <div className="assignment-v2__section">
              <h3 className="assignment-v2__section-title">
                <AlertTriangle size={14} /> Needs Assignment ({needsWork.length} time slot{needsWork.length > 1 ? 's' : ''})
              </h3>
              {needsWork.map(group => (
                <TimeSlotGroup
                  key={group.dateTime}
                  group={group}
                  defaultOpen={groupHasSignup(group)}
                  onAssign={assignStaff}
                  onUnassign={unassignStaff}
                />
              ))}
            </div>
          )}

          {/* Fully Booked */}
          {fullyBooked.length > 0 && (
            <div className="assignment-v2__section">
              <h3 className="assignment-v2__section-title assignment-v2__section-title--complete">
                <CheckCircle size={14} /> Fully Booked ({fullyBooked.length})
              </h3>
              {fullyBooked.map(group => (
                <TimeSlotGroup
                  key={group.dateTime}
                  group={group}
                  defaultOpen={false}
                  onAssign={assignStaff}
                  onUnassign={unassignStaff}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
