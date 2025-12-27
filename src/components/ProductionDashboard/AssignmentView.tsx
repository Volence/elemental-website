'use client'

import React, { useState, useEffect } from 'react'
import { Button, toast } from '@payloadcms/ui'

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
  opponent: string
  date: string
  region: string
  league: string
  productionWorkflow?: {
    priority: string
    coverageStatus: string
    observerSignups?: (User | number)[]
    producerSignups?: (User | number)[]
    casterSignups?: CasterSignup[]
    assignedObserver?: User | number | null
    assignedProducer?: User | number | null
    assignedCasters?: CasterSignup[]
  }
}

export function AssignmentView() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchMatches()
  }, [])

  const fetchMatches = async () => {
    try {
      setLoading(true)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const query = `/api/matches?where[date][greater_than_equal]=${today.toISOString()}&where[productionWorkflow.isArchived][not_equals]=true&sort=date&limit=100&depth=2`

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
        updateData.productionWorkflow = {
          ...pw,
          assignedObserver: userId
        }
      } else if (role === 'producer') {
        updateData.productionWorkflow = {
          ...pw,
          assignedProducer: userId
        }
      } else if (role === 'caster') {
        const existingCasters = pw.assignedCasters || []
        updateData.productionWorkflow = {
          ...pw,
          assignedCasters: [
            ...existingCasters,
            { user: userId, style: casterStyle || 'both' }
          ]
        }
      }

      const response = await fetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        // Update local state instead of refetching
        setMatches(matches.map(m => {
          if (m.id === matchId) {
            return {
              ...m,
              productionWorkflow: {
                ...m.productionWorkflow,
                ...updateData.productionWorkflow
              }
            }
          }
          return m
        }))
        toast.success('Staff assigned successfully!')
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
        updateData.productionWorkflow = {
          ...pw,
          assignedObserver: null
        }
      } else if (role === 'producer') {
        updateData.productionWorkflow = {
          ...pw,
          assignedProducer: null
        }
      } else if (role === 'caster' && casterIndex !== undefined) {
        const existingCasters = pw.assignedCasters || []
        updateData.productionWorkflow = {
          ...pw,
          assignedCasters: existingCasters.filter((_: CasterSignup, idx: number) => idx !== casterIndex)
        }
      }

      const response = await fetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        // Update local state instead of refetching
        setMatches(matches.map(m => {
          if (m.id === matchId) {
            return {
              ...m,
              productionWorkflow: {
                ...m.productionWorkflow,
                ...updateData.productionWorkflow
              }
            }
          }
          return m
        }))
        toast.success('Staff unassigned successfully!')
      } else {
        toast.error('Failed to unassign staff')
      }
    } catch (error) {
      console.error('Error unassigning staff:', error)
      toast.error('Error unassigning staff')
    }
  }

  const getUserName = (user: User | number | null | undefined): string => {
    if (!user) return 'Not assigned'
    if (typeof user === 'number') return `User #${user}`
    return user.name || user.email || 'Unknown'
  }

  const getCoverageClass = (status?: string) => {
    switch (status) {
      case 'full': return 'coverage-badge--full'
      case 'partial': return 'coverage-badge--partial'
      default: return 'coverage-badge--none'
    }
  }

  const getCoverageIcon = (status?: string) => {
    switch (status) {
      case 'full': return '✅'
      case 'partial': return '⚠️'
      default: return '❌'
    }
  }

  const toggleGroup = (dateTime: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(dateTime)) {
      newExpanded.delete(dateTime)
    } else {
      newExpanded.add(dateTime)
    }
    setExpandedGroups(newExpanded)
  }

  if (loading) {
    return <div className="production-dashboard__loading">Loading matches...</div>
  }

  return (
    <div className="production-dashboard__assignment">
      <div className="production-dashboard__header">
        <div>
          <h2>Staff Assignment</h2>
          <p className="production-dashboard__subtitle">
            Click on a signup button to assign that person to the match. Coverage updates automatically.
          </p>
          <div className="production-dashboard__timezone-notice">
            🌍 <strong>Timezone Info:</strong> All times are automatically shown in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone})
          </div>
          <div className="production-dashboard__instructions">
            <strong>How it works:</strong>
            <ol>
              <li>Find a match that has signups</li>
              <li>Click a name under "Signups" to assign them</li>
              <li>Click the ✕ button under "Assigned" to unassign</li>
              <li>Coverage badge updates when all roles are filled</li>
            </ol>
          </div>
        </div>
      </div>

      {matches.length === 0 ? (
        <p className="production-dashboard__empty">No upcoming matches found.</p>
      ) : (() => {
        // Group matches by date/time (time slot)
        const matchGroups = new Map<string, Match[]>()
        matches.forEach(match => {
          const dateTime = new Date(match.date).toISOString()
          if (!matchGroups.has(dateTime)) {
            matchGroups.set(dateTime, [])
          }
          matchGroups.get(dateTime)!.push(match)
        })

        return (
          <div className="assignment-time-slots">
            {Array.from(matchGroups.entries()).map(([dateTime, groupMatches]) => {
              const isExpanded = expandedGroups.has(dateTime)
              
              // Calculate aggregate stats for the group - count UNIQUE users, not total signups
              const uniqueSignupUsers = new Set<number>()
              const uniqueAssignedUsers = new Set<number>()

              groupMatches.forEach(m => {
                const pw = m.productionWorkflow
                if (!pw) return
                
                // Count unique signups
                pw.observerSignups?.forEach((u: any) => {
                  const userId = typeof u === 'number' ? u : u?.id
                  if (userId) uniqueSignupUsers.add(userId)
                })
                pw.producerSignups?.forEach((u: any) => {
                  const userId = typeof u === 'number' ? u : u?.id
                  if (userId) uniqueSignupUsers.add(userId)
                })
                pw.casterSignups?.forEach((c: any) => {
                  const userId = typeof c.user === 'number' ? c.user : c.user?.id
                  if (userId) uniqueSignupUsers.add(userId)
                })
                
                // Count unique assignments
                if (pw.assignedObserver) {
                  const userId = typeof pw.assignedObserver === 'number' ? pw.assignedObserver : (pw.assignedObserver as any)?.id
                  if (userId) uniqueAssignedUsers.add(userId)
                }
                if (pw.assignedProducer) {
                  const userId = typeof pw.assignedProducer === 'number' ? pw.assignedProducer : (pw.assignedProducer as any)?.id
                  if (userId) uniqueAssignedUsers.add(userId)
                }
                pw.assignedCasters?.forEach((c: any) => {
                  const userId = typeof c.user === 'number' ? c.user : c.user?.id
                  if (userId) uniqueAssignedUsers.add(userId)
                })
              })
              
              const totalSignups = uniqueSignupUsers.size
              const totalAssigned = uniqueAssignedUsers.size

              const allFullCoverage = groupMatches.every(m => m.productionWorkflow?.coverageStatus === 'full')
              const someFullCoverage = groupMatches.some(m => m.productionWorkflow?.coverageStatus === 'full')

              const formattedDate = new Date(dateTime).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
              })

              return (
                <div key={dateTime} className={`assignment-time-slot ${allFullCoverage ? 'assignment-time-slot--complete' : ''}`}>
                  <div className="assignment-time-slot__header">
                    <button
                      className="assignment-time-slot__toggle"
                      onClick={() => toggleGroup(dateTime)}
                    >
                      <span className="assignment-time-slot__icon">{isExpanded ? '▼' : '▶'}</span>
                      <div className="assignment-time-slot__info">
                        <h3 className="assignment-time-slot__datetime">{formattedDate}</h3>
                        <p className="assignment-time-slot__count">{groupMatches.length} match{groupMatches.length > 1 ? 'es' : ''}</p>
                      </div>
                    </button>
                    
                    <div className="assignment-time-slot__stats">
                      <span className="assignment-time-slot__stat">
                        👥 {totalSignups} signup{totalSignups !== 1 ? 's' : ''}
                      </span>
                      <span className="assignment-time-slot__stat">
                        ✓ {totalAssigned} assigned
                      </span>
                      {allFullCoverage && (
                        <span className="assignment-time-slot__badge assignment-time-slot__badge--complete">
                          ✅ Full Coverage
                        </span>
                      )}
                      {!allFullCoverage && someFullCoverage && (
                        <span className="assignment-time-slot__badge assignment-time-slot__badge--partial">
                          ⚠️ Partial
                        </span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="assignment-time-slot__matches">
                      {groupMatches.map((match) => {
            const pw = match.productionWorkflow || {} as NonNullable<Match['productionWorkflow']>
            const observerSignups = pw.observerSignups || []
            const producerSignups = pw.producerSignups || []
            const casterSignups = pw.casterSignups || []
            const assignedObserver = pw.assignedObserver
            const assignedProducer = pw.assignedProducer
            const assignedCasters = pw.assignedCasters || []

            return (
              <div key={match.id} className="assignment-match">
                <div className="assignment-match__header">
                  <div className="assignment-match__info">
                    <h3>{match.title}</h3>
                    <div className="assignment-match__meta">
                      <span>{new Date(match.date).toLocaleString()}</span>
                      <span className={`coverage-badge ${getCoverageClass(pw.coverageStatus)}`}>
                        {getCoverageIcon(pw.coverageStatus)} {pw.coverageStatus}
                      </span>
                    </div>
                  </div>
                  <a href={`/admin/collections/matches/${match.id}`} target="_blank" rel="noopener noreferrer" className="assignment-match__link">
                    Full Edit →
                  </a>
                </div>

                <div className="assignment-roles">
                  {/* Observer */}
                  <div className="assignment-role">
                    <h4>Observer (1)</h4>
                    <div className="assignment-role__content">
                      <div className="assignment-role__signups">
                        <strong>Signups ({observerSignups.length}):</strong>
                        {observerSignups.length === 0 ? (
                          <p className="assignment-empty">No signups</p>
                        ) : (
                          <div className="assignment-signup-list">
                            {observerSignups.map((user: User | number, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => assignStaff(match.id, 'observer', typeof user === 'number' ? user : user.id)}
                                className="assignment-signup-btn"
                                disabled={!!assignedObserver}
                              >
                                {getUserName(user as User)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="assignment-role__assigned">
                        <strong>Assigned:</strong>
                        {assignedObserver ? (
                          <div className="assignment-assigned-item">
                            <span>{getUserName(assignedObserver as User)}</span>
                            <button
                              onClick={() => unassignStaff(match.id, 'observer')}
                              className="assignment-unassign-btn"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <p className="assignment-empty">None</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Producer */}
                  <div className="assignment-role">
                    <h4>Producer (1)</h4>
                    <div className="assignment-role__content">
                      <div className="assignment-role__signups">
                        <strong>Signups ({producerSignups.length}):</strong>
                        {producerSignups.length === 0 ? (
                          <p className="assignment-empty">No signups</p>
                        ) : (
                          <div className="assignment-signup-list">
                            {producerSignups.map((user: User | number, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => assignStaff(match.id, 'producer', typeof user === 'number' ? user : user.id)}
                                className="assignment-signup-btn"
                                disabled={!!assignedProducer}
                              >
                                {getUserName(user as User)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="assignment-role__assigned">
                        <strong>Assigned:</strong>
                        {assignedProducer ? (
                          <div className="assignment-assigned-item">
                            <span>{getUserName(assignedProducer as User)}</span>
                            <button
                              onClick={() => unassignStaff(match.id, 'producer')}
                              className="assignment-unassign-btn"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <p className="assignment-empty">None</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Casters */}
                  <div className="assignment-role">
                    <h4>Casters (2 max)</h4>
                    <div className="assignment-role__content">
                      <div className="assignment-role__signups">
                        <strong>Signups ({casterSignups.length}):</strong>
                        {casterSignups.length === 0 ? (
                          <p className="assignment-empty">No signups</p>
                        ) : (
                          <div className="assignment-signup-list">
                            {casterSignups.map((signup: CasterSignup, idx: number) => {
                              const user = typeof signup.user === 'number' ? null : signup.user
                              const userId = typeof signup.user === 'number' ? signup.user : signup.user?.id
                              return (
                                <button
                                  key={idx}
                                  onClick={() => assignStaff(match.id, 'caster', userId, signup.style)}
                                  className="assignment-signup-btn"
                                  disabled={assignedCasters.length >= 2}
                                  title={signup.style ? `Style: ${signup.style}` : undefined}
                                >
                                  {getUserName(user as User)} {signup.style && `(${signup.style})`}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <div className="assignment-role__assigned">
                        <strong>Assigned ({assignedCasters.length}/2):</strong>
                        {assignedCasters.length === 0 ? (
                          <p className="assignment-empty">None</p>
                        ) : (
                          <div className="assignment-assigned-list">
                            {assignedCasters.map((caster: CasterSignup, idx: number) => {
                              const user = typeof caster.user === 'number' ? null : caster.user
                              return (
                                <div key={idx} className="assignment-assigned-item">
                                  <span>
                                    {getUserName(user as User)} {caster.style && `(${caster.style})`}
                                  </span>
                                  <button
                                    onClick={() => unassignStaff(match.id, 'caster', idx)}
                                    className="assignment-unassign-btn"
                                  >
                                    ✕
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
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
        )
      })()}
    </div>
  )
}
