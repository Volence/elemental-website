'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import type { User } from '@/payload-types'
import './InviteLinksListView.scss'

interface InviteLink {
  id: number
  token: string
  role: string
  status: string
  expiresAt?: string
  usedAt?: string
  usedBy?: any
  createdBy?: any
  assignedTeams?: any[]
  departments?: {
    isTeamManager?: boolean
    isProductionStaff?: boolean
    isSocialMedia?: boolean
    isGraphics?: boolean
    isScouting?: boolean
    isContentCreator?: boolean
  }
  createdAt: string
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'used', label: 'Used' },
  { value: 'expired', label: 'Expired' },
  { value: 'revoked', label: 'Revoked' },
]

function StatusDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const selected = STATUS_OPTIONS.find((o) => o.value === value)

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="invite-links-list__dropdown" ref={ref}>
      <button
        className="invite-links-list__dropdown-trigger"
        onClick={() => setOpen(!open)}
        type="button"
      >
        {selected?.label || 'All Statuses'}
        <span className="invite-links-list__dropdown-arrow">▾</span>
      </button>
      {open && (
        <div className="invite-links-list__dropdown-menu">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`invite-links-list__dropdown-item ${opt.value === value ? 'invite-links-list__dropdown-item--active' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function InviteLinksListView() {
  const { user } = useAuth<User>()
  const [invites, setInvites] = useState<InviteLink[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const role = (user?.role as string) ?? ''
  const canCreate = role === 'admin' || role === 'staff-manager' || role === 'team-manager'

  useEffect(() => {
    fetchInvites()
  }, [statusFilter])

  const fetchInvites = async () => {
    try {
      setLoading(true)
      let query = 'sort=-createdAt&limit=100&depth=1'

      if (statusFilter !== 'all') {
        query += `&where[status][equals]=${statusFilter}`
      }

      const res = await fetch(`/api/invite-links?${query}`)
      const data = await res.json()
      setInvites(data.docs || [])
    } catch (err) {
      console.error('Error fetching invite links:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredInvites = invites.filter((invite) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      invite.token.toLowerCase().includes(term) ||
      invite.role.toLowerCase().includes(term) ||
      getUserName(invite.usedBy).toLowerCase().includes(term) ||
      getUserName(invite.createdBy).toLowerCase().includes(term)
    )
  })

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'active': return 'invite-links-list__status--active'
      case 'used': return 'invite-links-list__status--used'
      case 'expired': return 'invite-links-list__status--expired'
      case 'revoked': return 'invite-links-list__status--revoked'
      default: return ''
    }
  }

  const getDepartmentBadges = (departments?: InviteLink['departments']) => {
    if (!departments) return []
    const badges = []
    if (departments.isProductionStaff) badges.push('Production')
    if ((departments as any).isSocialMediaStaff) badges.push('Social')
    if ((departments as any).isGraphicsStaff) badges.push('Graphics')
    if ((departments as any).isVideoStaff) badges.push('Video')
    if ((departments as any).isEventsStaff) badges.push('Events')
    if ((departments as any).isScoutingStaff) badges.push('Scouting')
    if (departments.isContentCreator) badges.push('Creator')
    return badges
  }

  const getUserName = (userRef: any): string => {
    if (!userRef) return '—'
    if (typeof userRef === 'number') return `#${userRef}`
    return userRef.name || userRef.email || `#${userRef.id}`
  }

  const copyToken = async (token: string) => {
    const inviteUrl = `${window.location.origin}/invite/${token}`
    try {
      await navigator.clipboard.writeText(inviteUrl)
    } catch {
      const el = document.createElement('textarea')
      el.value = inviteUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
  }

  if (loading) {
    return <div className="invite-links-list__loading">Loading invite links...</div>
  }

  return (
    <div className="invite-links-list">
      {/* Header matching Payload's collection header style */}
      <div className="invite-links-list__header">
        <div className="invite-links-list__header-left">
          <h1 className="invite-links-list__title">Invite Links</h1>
          {canCreate && (
            <Link href="/admin/collections/invite-links/create" className="invite-links-list__create-btn">
              Create New
            </Link>
          )}
        </div>
      </div>

      <p className="invite-links-list__description">
        Generate invite links for new users with pre-configured permissions.
      </p>

      {/* Search bar matching Payload's style - search full width, filter on right */}
      <div className="invite-links-list__controls">
        <div className="invite-links-list__search-wrap">
          <input
            type="text"
            placeholder="Search by name, role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="invite-links-list__search"
          />
        </div>
        <StatusDropdown value={statusFilter} onChange={setStatusFilter} />
      </div>

      {/* Table matching Payload's collection list */}
      {filteredInvites.length === 0 ? (
        <div className="invite-links-list__empty">No invite links found</div>
      ) : (
        <div className="invite-links-list__table-wrap">
          <table className="invite-links-list__table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Role</th>
                <th>Departments</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Used By</th>
                <th>Expires</th>
                <th>Used</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredInvites.map((invite) => {
                const deptBadges = getDepartmentBadges(invite.departments)
                return (
                  <tr key={invite.id}>
                    <td>
                      <Link
                        href={`/admin/collections/invite-links/${invite.id}`}
                        className="invite-links-list__token-link"
                      >
                        {invite.token.substring(0, 8)}...
                      </Link>
                    </td>
                    <td className="invite-links-list__role">{invite.role}</td>
                    <td>
                      {deptBadges.length > 0 ? (
                        <div className="invite-links-list__dept-tags">
                          {deptBadges.map((badge) => (
                            <span key={badge} className="invite-links-list__dept-tag">{badge}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="invite-links-list__muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`invite-links-list__status ${getStatusClass(invite.status)}`}>
                        {invite.status}
                      </span>
                    </td>
                    <td className="invite-links-list__user-cell">
                      {invite.createdBy && typeof invite.createdBy === 'object' ? (
                        <Link
                          href={`/admin/collections/users/${invite.createdBy.id}`}
                          className="invite-links-list__user-link"
                        >
                          {getUserName(invite.createdBy)}
                        </Link>
                      ) : (
                        <span className="invite-links-list__muted">{getUserName(invite.createdBy)}</span>
                      )}
                    </td>
                    <td className="invite-links-list__user-cell">
                      {invite.usedBy && typeof invite.usedBy === 'object' ? (
                        <Link
                          href={`/admin/collections/users/${invite.usedBy.id}`}
                          className="invite-links-list__user-link"
                        >
                          {getUserName(invite.usedBy)}
                        </Link>
                      ) : (
                        <span className="invite-links-list__muted">{getUserName(invite.usedBy)}</span>
                      )}
                    </td>
                    <td className="invite-links-list__date">{formatDate(invite.expiresAt)}</td>
                    <td className="invite-links-list__date">{formatDate(invite.usedAt)}</td>
                    <td>
                      {invite.status === 'active' && (
                        <button
                          className="invite-links-list__copy-btn"
                          onClick={() => copyToken(invite.token)}
                          title="Copy invite URL"
                        >
                          📋
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
