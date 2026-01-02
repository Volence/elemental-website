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
  productionWorkflow?: {
    observerSignups?: (User | number)[]
    producerSignups?: (User | number)[]
    casterSignups?: CasterSignup[]
    assignedObserver?: User | number
    assignedProducer?: User | number
    assignedCasters?: CasterSignup[]
    includeInSchedule?: boolean
  }
}

interface SignupModalProps {
  matchGroup: MatchGroup | null
  currentUserId: number | null
  onClose: () => void
  onSignup: (matchIds: number[], roles: SignupRoles) => Promise<void>
}

interface SignupRoles {
  observer: boolean
  producer: boolean
  caster: boolean
  casterStyle?: string
}

interface SignupTooltipProps {
  names: string[]
  count: number
  role: string
}

function SignupTooltip({ names, count, role }: SignupTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [mounted, setMounted] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const calculatedRef = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setShowTooltip(false)
        calculatedRef.current = false
      }
    }

    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showTooltip])

  const updatePosition = () => {
    if (!wrapperRef.current || calculatedRef.current) return
    
    calculatedRef.current = true
    
    const wrapperRect = wrapperRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const tooltipWidth = 250
    
    let left = wrapperRect.left + wrapperRect.width / 2
    let transform = 'translateX(-50%)'
    
    if (left + tooltipWidth / 2 > viewportWidth - 20) {
      left = wrapperRect.right - 10
      transform = 'translateX(-100%)'
    } else if (left - tooltipWidth / 2 < 20) {
      left = wrapperRect.left + 10
      transform = 'translateX(0)'
    }
    
    setTooltipStyle({
      position: 'fixed',
      top: `${wrapperRect.bottom + 8}px`,
      left: `${left}px`,
      transform: transform,
      zIndex: 10000,
    })
  }

  const handleMouseEnter = () => {
    calculatedRef.current = false
    setShowTooltip(true)
    setTimeout(updatePosition, 0)
  }

  const handleMouseLeave = () => {
    setShowTooltip(false)
    calculatedRef.current = false
  }

  if (count === 0) {
    return <span className="signup-count-number">0</span>
  }

  const tooltipContent = showTooltip && mounted ? (
    createPortal(
      <div 
        ref={tooltipRef}
        className="signup-tooltip"
        style={tooltipStyle}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={handleMouseLeave}
      >
        <div className="signup-tooltip__header">{role} Signups</div>
        <ul className="signup-tooltip__list">
          {names.map((name, idx) => (
            <li key={idx}>{name}</li>
          ))}
        </ul>
      </div>,
      document.body
    )
  ) : null

  return (
    <>
      <div 
        className="signup-count-wrapper" 
        ref={wrapperRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          if (!showTooltip) {
            calculatedRef.current = false
            setShowTooltip(true)
            setTimeout(updatePosition, 0)
          } else {
            setShowTooltip(false)
            calculatedRef.current = false
          }
        }}
      >
        <span className="signup-count-number has-signups">{count}</span>
      </div>
      {tooltipContent}
    </>
  )
}

function SignupModal({ matchGroup, currentUserId, onClose, onSignup }: SignupModalProps) {
  const [roles, setRoles] = useState<SignupRoles>({
    observer: false,
    producer: false,
    caster: false,
    casterStyle: undefined,
  })
  const [submitting, setSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
    
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    if (!matchGroup || !currentUserId) return

    // Pre-check boxes if user is already signed up to ANY match in the group
    const anyMatch = matchGroup.matches[0]
    const pw = anyMatch.productionWorkflow
    if (pw) {
      const isObserverSignup = pw.observerSignups?.some(u => (typeof u === 'number' ? u : u.id) === currentUserId)
      const isProducerSignup = pw.producerSignups?.some(u => (typeof u === 'number' ? u : u.id) === currentUserId)
      const casterSignup = pw.casterSignups?.find(c => (typeof c.user === 'number' ? c.user : c.user.id) === currentUserId)

      setRoles({
        observer: !!isObserverSignup,
        producer: !!isProducerSignup,
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
      const matchIds = matchGroup.matches.map(m => m.id)
      await onSignup(matchIds, roles)
      toast.success(`Signed up for ${matchGroup.matches.length} match${matchGroup.matches.length > 1 ? 'es' : ''}!`)
      onClose()
    } catch (error) {
      toast.error('Failed to sign up')
    } finally {
      setSubmitting(false)
    }
  }

  const modalContent = (
    <div className="signup-modal-overlay" onClick={onClose}>
      <div className="signup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="signup-modal__header">
          <h3>Sign Up for Time Slot</h3>
          <button className="signup-modal__close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="signup-modal__body">
          <div className="signup-modal__match-info">
            <h4>📅 {matchGroup.formattedDate}</h4>
            <p className="signup-modal__match-count">
              {matchGroup.matches.length} match{matchGroup.matches.length > 1 ? 'es' : ''} at this time
            </p>
            <div className="signup-modal__match-list">
              {matchGroup.matches.map(match => (
                <div key={match.id} className="signup-modal__match-item">
                  • {match.title}
                </div>
              ))}
            </div>
            <p className="signup-modal__note">
              💡 You'll be marked as available for all matches at this time. 
              Staff managers will assign you to specific matches later.
            </p>
          </div>

          <div className="signup-modal__roles">
            <label className="signup-checkbox">
              <input
                type="checkbox"
                checked={roles.observer}
                onChange={(e) => setRoles({ ...roles, observer: e.target.checked })}
              />
              <span>👁️ I can observe</span>
            </label>

            <label className="signup-checkbox">
              <input
                type="checkbox"
                checked={roles.producer}
                onChange={(e) => setRoles({ ...roles, producer: e.target.checked })}
              />
              <span>🎬 I can produce</span>
            </label>

            <label className="signup-checkbox">
              <input
                type="checkbox"
                checked={roles.caster}
                onChange={(e) => setRoles({ ...roles, caster: e.target.checked })}
              />
              <span>🎙️ I can cast</span>
            </label>

            {roles.caster && (
              <div className="signup-caster-style">
                <label>Casting Style:</label>
                <select
                  value={roles.casterStyle || ''}
                  onChange={(e) => setRoles({ ...roles, casterStyle: e.target.value || undefined })}
                >
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
          <button className="signup-modal__cancel" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="signup-modal__submit" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Signing up...' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

interface MatchGroup {
  dateTime: string
  matches: Match[]
  formattedDate: string
}

export function StaffSignupsView() {
  const { user } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMatchGroup, setSelectedMatchGroup] = useState<MatchGroup | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchMatches()
  }, [])

  const fetchMatches = async () => {
    try {
      setLoading(true)
      
      // Use custom API endpoint that properly populates user data
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
    // Sign up for all matches in the group
    const promises = matchIds.map(matchId =>
      fetch('/api/production/staff-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, roles }),
      })
    )

    const results = await Promise.all(promises)
    
    if (results.some(r => !r.ok)) {
      throw new Error('Failed to sign up for some matches')
    }

    // Refresh matches
    await fetchMatches()
  }
  
  // Group matches by their exact date/time
  const groupMatchesByTime = (matchList: Match[]): MatchGroup[] => {
    const grouped = new Map<string, Match[]>()
    
    matchList.forEach(match => {
      const dateTime = new Date(match.date).toISOString()
      if (!grouped.has(dateTime)) {
        grouped.set(dateTime, [])
      }
      grouped.get(dateTime)!.push(match)
    })
    
    return Array.from(grouped.entries())
      .map(([dateTime, matches]) => ({
        dateTime,
        matches,
        formattedDate: new Date(dateTime).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      }))
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
  }
  
  const matchGroups = groupMatchesByTime(matches)
  
  const toggleGroup = (dateTime: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(dateTime)) {
        newSet.delete(dateTime)
      } else {
        newSet.add(dateTime)
      }
      return newSet
    })
  }

  const handleRemoveSignup = async (matchId: number, role: 'observer' | 'producer' | 'caster') => {
    try {
      const response = await fetch('/api/production/staff-signup', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, role }),
      })

      if (!response.ok) {
        throw new Error('Failed to remove signup')
      }

      toast.success('Signup removed')
      await fetchMatches()
    } catch (error) {
      toast.error('Failed to remove signup')
    }
  }

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

  const isUserSignedUp = (match: Match, currentUserId: number | null): boolean => {
    if (!currentUserId) return false
    const pw = match.productionWorkflow
    if (!pw) return false

    const isObserver = pw.observerSignups?.some(u => getUserId(u) === currentUserId)
    const isProducer = pw.producerSignups?.some(u => getUserId(u) === currentUserId)
    const isCaster = pw.casterSignups?.some(c => getUserId(c.user) === currentUserId)

    return !!(isObserver || isProducer || isCaster)
  }

  const isUserAssigned = (match: Match, currentUserId: number | null): boolean => {
    if (!currentUserId) return false
    const pw = match.productionWorkflow
    if (!pw) return false

    const isObserver = getUserId(pw.assignedObserver) === currentUserId
    const isProducer = getUserId(pw.assignedProducer) === currentUserId
    const isCaster = pw.assignedCasters?.some(c => getUserId(c.user) === currentUserId)

    return !!(isObserver || isProducer || isCaster)
  }

  const getMySignupRoles = (match: Match, currentUserId: number | null): string[] => {
    if (!currentUserId) return []
    const pw = match.productionWorkflow
    if (!pw) return []

    const roles: string[] = []

    if (pw.observerSignups?.some(u => getUserId(u) === currentUserId)) {
      roles.push('Observer')
    }
    if (pw.producerSignups?.some(u => getUserId(u) === currentUserId)) {
      roles.push('Producer')
    }
    const casterSignup = pw.casterSignups?.find(c => getUserId(c.user) === currentUserId)
    if (casterSignup) {
      roles.push(casterSignup.style ? `Caster (${casterSignup.style})` : 'Caster')
    }

    return roles
  }

  const getMyAssignedRoles = (match: Match, currentUserId: number | null): string[] => {
    if (!currentUserId) return []
    const pw = match.productionWorkflow
    if (!pw) return []

    const roles: string[] = []

    if (getUserId(pw.assignedObserver) === currentUserId) {
      roles.push('Observer')
    }
    if (getUserId(pw.assignedProducer) === currentUserId) {
      roles.push('Producer')
    }
    const assignedCaster = pw.assignedCasters?.find(c => getUserId(c.user) === currentUserId)
    if (assignedCaster) {
      roles.push(assignedCaster.style ? `Caster (${assignedCaster.style})` : 'Caster')
    }

    return roles
  }

  const isRoleAssigned = (match: Match, currentUserId: number | null, role: 'observer' | 'producer' | 'caster'): boolean => {
    if (!currentUserId) return false
    const pw = match.productionWorkflow
    if (!pw) return false

    if (role === 'observer') {
      return getUserId(pw.assignedObserver) === currentUserId
    } else if (role === 'producer') {
      return getUserId(pw.assignedProducer) === currentUserId
    } else if (role === 'caster') {
      return pw.assignedCasters?.some(c => getUserId(c.user) === currentUserId) || false
    }

    return false
  }

  const currentUserId = user?.id ? (typeof user.id === 'number' ? user.id : parseInt(user.id as string, 10)) : null
  const mySignups = matches.filter(m => isUserSignedUp(m, currentUserId))
  // Only show assigned matches that are included in the schedule
  const myAssignments = matches.filter(m => isUserAssigned(m, currentUserId) && m.productionWorkflow?.includeInSchedule === true)
  
  // Get all time slots where user is assigned
  const assignedTimeSlots = new Set(
    myAssignments.map(m => new Date(m.date).toISOString())
  )
  
  // Filter out signups for time slots where user is already assigned
  const myPendingSignups = mySignups.filter(m => {
    const isAssignedToThisMatch = isUserAssigned(m, currentUserId)
    const isAssignedToThisTimeSlot = assignedTimeSlots.has(new Date(m.date).toISOString())
    return !isAssignedToThisMatch && !isAssignedToThisTimeSlot
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

      {/* Section 1: Available Time Slots */}
      <div className="staff-signups-section">
        <h3>📋 Available Time Slots</h3>
        {matchGroups.length === 0 ? (
          <div className="production-dashboard__empty">
            <p>No upcoming time slots available for signup.</p>
          </div>
        ) : (
          <div className="time-slot-groups">
            {matchGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.dateTime)
              const isGroupSignedUp = group.matches.some(m => isUserSignedUp(m, currentUserId))
              const isGroupAssigned = group.matches.some(m => isUserAssigned(m, currentUserId))
              
              // Aggregate totals for the group - count UNIQUE users, not total signups
              const uniqueObservers = new Set<number>()
              const uniqueProducers = new Set<number>()
              const uniqueCasters = new Set<number>()
              const observerNames: string[] = []
              const producerNames: string[] = []
              const casterNames: string[] = []

              group.matches.forEach(m => {
                m.productionWorkflow?.observerSignups?.forEach(u => {
                  const userId = getUserId(u)
                  if (userId) {
                    uniqueObservers.add(userId)
                    const name = getUserName(u)
                    if (!observerNames.includes(name)) observerNames.push(name)
                  }
                })
                m.productionWorkflow?.producerSignups?.forEach(u => {
                  const userId = getUserId(u)
                  if (userId) {
                    uniqueProducers.add(userId)
                    const name = getUserName(u)
                    if (!producerNames.includes(name)) producerNames.push(name)
                  }
                })
                m.productionWorkflow?.casterSignups?.forEach(c => {
                  const userId = getUserId(c.user)
                  if (userId) {
                    uniqueCasters.add(userId)
                    const name = getUserName(c.user)
                    const style = c.style ? ` (${c.style})` : ''
                    const fullName = `${name}${style}`
                    if (!casterNames.includes(fullName)) casterNames.push(fullName)
                  }
                })
              })

              const totalObservers = uniqueObservers.size
              const totalProducers = uniqueProducers.size
              const totalCasters = uniqueCasters.size

              return (
                <div key={group.dateTime} className={`time-slot-group ${isGroupSignedUp ? 'time-slot-group--signed-up' : ''}`}>
                  <div className="time-slot-group__header">
                    <button
                      className="time-slot-group__toggle"
                      onClick={() => toggleGroup(group.dateTime)}
                    >
                      <span className="time-slot-group__icon">{isExpanded ? '▼' : '▶'}</span>
                      <div className="time-slot-group__info">
                        <h4 className="time-slot-group__datetime">{group.formattedDate}</h4>
                        <p className="time-slot-group__count">{group.matches.length} match{group.matches.length > 1 ? 'es' : ''}</p>
                      </div>
                    </button>
                    
                    <div className="time-slot-group__stats">
                      <span className="time-slot-group__stat">
                        👁️ <SignupTooltip names={observerNames} count={totalObservers} role="Observer" />
                      </span>
                      <span className="time-slot-group__stat">
                        🎬 <SignupTooltip names={producerNames} count={totalProducers} role="Producer" />
                      </span>
                      <span className="time-slot-group__stat">
                        🎙️ <SignupTooltip names={casterNames} count={totalCasters} role="Caster" />
                      </span>
                    </div>
                    
                    <button
                      className={`staff-signup-btn ${isGroupSignedUp ? 'staff-signup-btn--active' : ''}`}
                      onClick={() => {
                        setSelectedMatchGroup(group)
                        setShowModal(true)
                      }}
                    >
                      {isGroupSignedUp ? '✓ Signed Up' : 'Sign Up'}
                    </button>
                    {isGroupAssigned && <span className="assigned-badge">✅ Assigned</span>}
                  </div>
                  
                  {isExpanded && (
                    <div className="time-slot-group__matches">
                      {group.matches.map((match) => {
                        const pw = match.productionWorkflow || {}
                        const observerCount = pw.observerSignups?.length || 0
                        const producerCount = pw.producerSignups?.length || 0
                        const casterCount = pw.casterSignups?.length || 0
                        
                        // Get names for tooltips
                        const observerNames = (pw.observerSignups || []).map(u => 
                          typeof u === 'object' && u ? (u.name || u.email || 'Unknown User') : `User ID: ${u}`
                        )
                        const producerNames = (pw.producerSignups || []).map(u => 
                          typeof u === 'object' && u ? (u.name || u.email || 'Unknown User') : `User ID: ${u}`
                        )
                        const casterNames = (pw.casterSignups || []).map(c => {
                          const user = typeof c.user === 'object' && c.user ? c.user : null
                          const name = user ? (user.name || user.email || 'Unknown User') : `User ID: ${c.user}`
                          const style = c.style ? ` (${c.style})` : ''
                          return `${name}${style}`
                        })

                        return (
                          <div key={match.id} className="time-slot-match">
                            <div className="time-slot-match__title">{match.title}</div>
                            <div className="time-slot-match__stats">
                              <div className="time-slot-match__stat">
                                <span>👁️ Observers:</span>
                                <SignupTooltip names={observerNames} count={observerCount} role="Observer" />
                              </div>
                              <div className="time-slot-match__stat">
                                <span>🎬 Producers:</span>
                                <SignupTooltip names={producerNames} count={producerCount} role="Producer" />
                              </div>
                              <div className="time-slot-match__stat">
                                <span>🎙️ Casters:</span>
                                <SignupTooltip names={casterNames} count={casterCount} role="Caster" />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Section 2: My Assignments */}
      <div className="staff-signups-section staff-signups-section--assignments">
        <h3>✅ My Assignments (Confirmed)</h3>
        {myAssignments.length === 0 ? (
          <div className="production-dashboard__empty">
            <p>You haven't been assigned to any matches yet.</p>
          </div>
        ) : (
          <div className="my-signups-list">
            {myAssignments.map((match) => {
              const assignedRoles = getMyAssignedRoles(match, currentUserId)

              return (
                <div key={match.id} className="my-signup-card my-signup-card--assigned">
                  <div className="my-signup-card__header">
                    <div>
                      <h4>{match.title}</h4>
                      <p className="my-signup-card__date">
                        {new Date(match.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZoneName: 'short',
                        })}
                      </p>
                      {match.opponent && (
                        <p className="my-signup-card__opponent">
                          <strong>Opponent:</strong> {match.opponent}
                        </p>
                      )}
                      {match.faceitLobby && (
                        <p className="my-signup-card__lobby">
                          <a 
                            href={match.faceitLobby} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="my-signup-card__lobby-link"
                          >
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

      {/* Section 3: My Signups (Pending) */}
      <div className="staff-signups-section">
        <h3>⏳ My Signups (Pending Confirmation)</h3>
        {myPendingSignups.length === 0 ? (
          <div className="production-dashboard__empty">
            <p>No pending signups. All your signups have been confirmed!</p>
          </div>
        ) : (() => {
          // Group pending signups by date/time (time slot)
          const signupGroups = new Map<string, Match[]>()
          myPendingSignups.forEach(match => {
            const dateTime = new Date(match.date).toISOString()
            if (!signupGroups.has(dateTime)) {
              signupGroups.set(dateTime, [])
            }
            signupGroups.get(dateTime)!.push(match)
          })

          return (
            <div className="my-signups-list">
              {Array.from(signupGroups.entries()).map(([dateTime, groupMatches]) => {
                // Get all unique roles across all matches in this time slot
                const allRoles = new Set<string>()
                const roleToMatches = new Map<string, number[]>() // role -> matchIds

                groupMatches.forEach(match => {
                  const roles = getMySignupRoles(match, currentUserId)
                  roles.forEach(role => {
                    allRoles.add(role)
                    const roleKey = role.toLowerCase().split(' ')[0]
                    if (!roleToMatches.has(roleKey)) {
                      roleToMatches.set(roleKey, [])
                    }
                    roleToMatches.get(roleKey)!.push(match.id)
                  })
                })

                const formattedDate = new Date(dateTime).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZoneName: 'short',
                })

                return (
                  <div key={dateTime} className="my-signup-card">
                    <div className="my-signup-card__header">
                      <div>
                        <h4>{formattedDate}</h4>
                        <p className="my-signup-card__count">
                          {groupMatches.length} match{groupMatches.length > 1 ? 'es' : ''}
                        </p>
                      </div>
                      <div className="my-signup-card__status">
                        <span className="status-badge status-badge--pending">⏳ Pending</span>
                      </div>
                    </div>
                    <div className="my-signup-card__roles">
                      <strong>Signed up as:</strong>
                      <div className="my-signup-card__role-list">
                        {Array.from(allRoles).map((role, idx) => {
                          const roleKey = role.toLowerCase().split(' ')[0] as 'observer' | 'producer' | 'caster'
                          // Check if ANY match in this group has this role assigned
                          const isAnyRoleAssigned = groupMatches.some(m => isRoleAssigned(m, currentUserId, roleKey))
                          
                          return (
                            <div key={idx} className="my-signup-role">
                              <span>{role}</span>
                              {isAnyRoleAssigned ? (
                                <span className="my-signup-role__locked" title="Cannot remove - you've been assigned this role in some matches">🔒</span>
                              ) : (
                                <button
                                  className="my-signup-role__remove"
                                  onClick={async () => {
                                    // Remove signup for this role from ALL matches in this time slot
                                    const matchesToUpdate = roleToMatches.get(roleKey) || []
                                    await Promise.all(matchesToUpdate.map(matchId => handleRemoveSignup(matchId, roleKey)))
                                  }}
                                  title="Remove signup for this role from all matches in this time slot"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Signup Modal */}
      {showModal && (
        <SignupModal
          matchGroup={selectedMatchGroup}
          currentUserId={currentUserId}
          onClose={() => {
            setShowModal(false)
            setSelectedMatchGroup(null)
          }}
          onSignup={handleSignup}
        />
      )}
    </div>
  )
}
