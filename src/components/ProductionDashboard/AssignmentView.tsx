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
      ) : (
        <div className="assignment-matches">
          {matches.map((match) => {
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
}
