'use client'

import React, { useState, useEffect } from 'react'
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
  productionWorkflow?: {
    observerSignups?: (User | number)[]
    producerSignups?: (User | number)[]
    casterSignups?: CasterSignup[]
    assignedObserver?: User | number
    assignedProducer?: User | number
    assignedCasters?: CasterSignup[]
  }
}

interface SignupModalProps {
  match: Match | null
  currentUserId: number | null
  onClose: () => void
  onSignup: (matchId: number, roles: SignupRoles) => Promise<void>
}

interface SignupRoles {
  observer: boolean
  producer: boolean
  caster: boolean
  casterStyle?: string
}

function SignupModal({ match, currentUserId, onClose, onSignup }: SignupModalProps) {
  const [roles, setRoles] = useState<SignupRoles>({
    observer: false,
    producer: false,
    caster: false,
    casterStyle: undefined,
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!match || !currentUserId) return

    // Pre-check boxes if user is already signed up
    const pw = match.productionWorkflow
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
  }, [match, currentUserId])

  if (!match) return null

  const handleSubmit = async () => {
    if (!roles.observer && !roles.producer && !roles.caster) {
      toast.error('Please select at least one role')
      return
    }

    setSubmitting(true)
    try {
      await onSignup(match.id, roles)
      toast.success('Signed up successfully!')
      onClose()
    } catch (error) {
      toast.error('Failed to sign up')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="signup-modal-overlay" onClick={onClose}>
      <div className="signup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="signup-modal__header">
          <h3>Sign Up for Match</h3>
          <button className="signup-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="signup-modal__body">
          <div className="signup-modal__match-info">
            <h4>{match.title}</h4>
            <p>
              {new Date(match.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
              })}
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
}

export function StaffSignupsView() {
  const { user } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [showModal, setShowModal] = useState(false)

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
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (matchId: number, roles: SignupRoles) => {
    const response = await fetch('/api/production/staff-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, roles }),
    })

    if (!response.ok) {
      throw new Error('Failed to sign up')
    }

    // Refresh matches
    await fetchMatches()
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
  const myAssignments = matches.filter(m => isUserAssigned(m, currentUserId))
  const myPendingSignups = mySignups.filter(m => !isUserAssigned(m, currentUserId))

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
      </div>

      {/* Section 1: Available Matches */}
      <div className="staff-signups-section">
        <h3>📋 Available Matches</h3>
        {matches.length === 0 ? (
          <div className="production-dashboard__empty">
            <p>No upcoming matches available for signup.</p>
          </div>
        ) : (
          <div className="staff-signups-table-wrapper">
            <table className="staff-signups-table">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Date/Time</th>
                  <th>Region</th>
                  <th>Observer Signups</th>
                  <th>Producer Signups</th>
                  <th>Caster Signups</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => {
                  const pw = match.productionWorkflow || {}
                  const observerCount = pw.observerSignups?.length || 0
                  const producerCount = pw.producerSignups?.length || 0
                  const casterCount = pw.casterSignups?.length || 0
                  const isSignedUp = isUserSignedUp(match, currentUserId)
                  const isAssigned = isUserAssigned(match, currentUserId)

                  return (
                    <tr key={match.id} className={isSignedUp ? 'signed-up' : ''}>
                      <td>
                        <strong>{match.title}</strong>
                      </td>
                      <td>
                        {new Date(match.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>{match.region || 'N/A'}</td>
                      <td className="signup-count">{observerCount}</td>
                      <td className="signup-count">{producerCount}</td>
                      <td className="signup-count">{casterCount}</td>
                      <td>
                        <button
                          className={`staff-signup-btn ${isSignedUp ? 'staff-signup-btn--active' : ''}`}
                          onClick={() => {
                            setSelectedMatch(match)
                            setShowModal(true)
                          }}
                        >
                          {isSignedUp ? '✓ Signed Up' : 'Sign Up'}
                        </button>
                        {isAssigned && <span className="assigned-badge">✅ Assigned</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: My Assignments */}
      <div className="staff-signups-section">
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
        ) : (
          <div className="my-signups-list">
            {myPendingSignups.map((match) => {
              const roles = getMySignupRoles(match, currentUserId)

              return (
                <div key={match.id} className="my-signup-card">
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
                    </div>
                    <div className="my-signup-card__status">
                      <span className="status-badge status-badge--pending">⏳ Pending</span>
                    </div>
                  </div>
                  <div className="my-signup-card__roles">
                    <strong>Signed up as:</strong>
                    <div className="my-signup-card__role-list">
                      {roles.map((role, idx) => {
                        const roleKey = role.toLowerCase().split(' ')[0] as 'observer' | 'producer' | 'caster'
                        const isThisRoleAssigned = isRoleAssigned(match, currentUserId, roleKey)
                        
                        return (
                          <div key={idx} className="my-signup-role">
                            <span>{role}</span>
                            {isThisRoleAssigned ? (
                              <span className="my-signup-role__locked" title="Cannot remove - you've been assigned this role">🔒</span>
                            ) : (
                              <button
                                className="my-signup-role__remove"
                                onClick={() => handleRemoveSignup(match.id, roleKey)}
                                title="Remove this signup"
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
        )}
      </div>

      {/* Signup Modal */}
      {showModal && (
        <SignupModal
          match={selectedMatch}
          currentUserId={currentUserId}
          onClose={() => {
            setShowModal(false)
            setSelectedMatch(null)
          }}
          onSignup={handleSignup}
        />
      )}
    </div>
  )
}
