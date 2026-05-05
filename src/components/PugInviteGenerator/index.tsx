'use client'

import React, { useEffect, useState, useCallback } from 'react'

type InviteData = {
  id: number
  token: string
  role: string
  expiresAt: string
  usedAt: string | null
  usedBy: any
  createdBy: any
  pugInvite?: {
    isForPug: boolean
    approvedRoles?: string[]
    region?: string
  }
  departments?: {
    isPugAdmin?: boolean
  }
}

const PUG_ROLES = [
  { label: 'Tank', value: 'tank' },
  { label: 'Flex DPS', value: 'flex-dps' },
  { label: 'Hitscan DPS', value: 'hitscan-dps' },
  { label: 'Flex Support', value: 'flex-support' },
  { label: 'Main Support', value: 'main-support' },
]

const REGIONS = [
  { label: 'NA', value: 'na' },
  { label: 'EMEA', value: 'emea' },
  { label: 'Pacific', value: 'pacific' },
]

export const PugInviteGenerator: React.FC = () => {
  const [invites, setInvites] = useState<InviteData[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedRegion, setSelectedRegion] = useState('na')
  const [makePugAdmin, setMakePugAdmin] = useState(false)

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch('/api/invite-links?limit=50&sort=-createdAt&depth=1')
      if (!res.ok) throw new Error('Failed to load invites')
      const data = await res.json()
      // Filter to only PUG-related invites
      const pugInvites = (data.docs || []).filter(
        (inv: any) => inv.pugInvite?.isForPug || inv.departments?.isPugAdmin,
      )
      setInvites(pugInvites)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchInvites() }, [fetchInvites])

  async function createInvite() {
    if (selectedRoles.length === 0) {
      setError('Select at least one approved role')
      return
    }
    setCreating(true)
    setError(null)
    setSuccess(null)

    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const res = await fetch('/api/invite-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'player',
          pugInvite: {
            isForPug: true,
            approvedRoles: selectedRoles,
            region: selectedRegion,
          },
          departments: {
            isPugAdmin: makePugAdmin,
            isProductionStaff: false,
            isSocialMediaStaff: false,
            isGraphicsStaff: false,
            isVideoStaff: false,
            isEventsStaff: false,
            isScoutingStaff: false,
            isContentCreator: false,
          },
          expiresAt: expiresAt.toISOString(),
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.errors?.[0]?.message || 'Failed to create invite')
      }

      setSuccess('Invite link created!')
      setSelectedRoles([])
      setMakePugAdmin(false)
      await fetchInvites()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function copyLink(invite: InviteData) {
    const serverUrl = window.location.origin
    const url = `${serverUrl}/invite/${invite.token}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedId(invite.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }

  function getStatus(invite: InviteData): { label: string; color: string } {
    if (invite.usedAt) return { label: 'Used', color: 'text-green-400 bg-green-950/40 border-green-800' }
    if (new Date(invite.expiresAt) < new Date()) return { label: 'Expired', color: 'text-red-400 bg-red-950/40 border-red-800' }
    return { label: 'Active', color: 'text-cyan-400 bg-cyan-950/40 border-cyan-800' }
  }

  if (loading) {
    return <div className="settings-gen" style={{ padding: '2rem' }}>Loading invites...</div>
  }

  return (
    <div className="settings-gen">
      <h2 className="settings-gen__title">PUG Invite Links</h2>
      <p className="settings-gen__desc">
        Generate invite links for invite-tier PUG players. Each link grants access to the invite tier with the specified roles and region.
      </p>

      {error && (
        <div style={{ padding: '0.6rem 1rem', background: 'rgba(220, 38, 38, 0.1)', border: '1px solid rgba(220, 38, 38, 0.3)', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem', color: '#f87171' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '0.6rem 1rem', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem', color: '#4ade80' }}>
          {success}
        </div>
      )}

      {/* Create form */}
      <section className="settings-gen__section">
        <h3 className="settings-gen__label">Create New Invite</h3>

        <div className="settings-gen__role-group">
          <p className="settings-gen__role-label">APPROVED ROLES</p>
          <div className="settings-gen__chips">
            {PUG_ROLES.map((r) => (
              <button
                key={r.value}
                onClick={() => toggleRole(r.value)}
                className={`settings-gen__chip ${selectedRoles.includes(r.value) ? 'settings-gen__chip--active' : ''}`}
              >
                {selectedRoles.includes(r.value) && '✓ '}{r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-gen__role-group" style={{ marginTop: '0.75rem' }}>
          <p className="settings-gen__role-label">REGION</p>
          <div className="settings-gen__chips">
            {REGIONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setSelectedRegion(r.value)}
                className={`settings-gen__chip ${selectedRegion === r.value ? 'settings-gen__chip--active' : ''}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--theme-elevation-500)' }}>
            <input
              type="checkbox"
              checked={makePugAdmin}
              onChange={(e) => setMakePugAdmin(e.target.checked)}
              style={{ accentColor: '#00d4e8' }}
            />
            Also grant PUG Admin access
          </label>
        </div>

        <button
          onClick={createInvite}
          disabled={creating || selectedRoles.length === 0}
          className="settings-gen__generate"
          style={{ marginTop: '1rem', opacity: creating || selectedRoles.length === 0 ? 0.5 : 1 }}
        >
          {creating ? '⏳ Creating...' : '🔗 Generate Invite Link'}
        </button>
      </section>

      {/* Existing invites */}
      <section className="settings-gen__section" style={{ marginTop: '1.5rem' }}>
        <h3 className="settings-gen__label">
          Recent PUG Invites <span className="settings-gen__count">({invites.length})</span>
        </h3>

        {invites.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-400)' }}>No PUG invites yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {invites.map((inv) => {
              const status = getStatus(inv)
              const roles = inv.pugInvite?.approvedRoles ?? []
              const region = inv.pugInvite?.region?.toUpperCase() ?? '—'
              const usedByName = inv.usedBy && typeof inv.usedBy === 'object' ? (inv.usedBy.name || inv.usedBy.email) : null

              return (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '6px',
                    border: '1px solid var(--theme-elevation-150)',
                    background: 'var(--theme-elevation-50)',
                    fontSize: '0.78rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                    <span className={`settings-gen__chip ${status.color}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid' }}>
                      {status.label}
                    </span>
                    <span style={{ color: 'var(--theme-elevation-600)', fontWeight: 500 }}>{region}</span>
                    {roles.map((r) => (
                      <span key={r} style={{ fontSize: '0.7rem', color: 'var(--theme-elevation-400)' }}>{r}</span>
                    ))}
                    {inv.departments?.isPugAdmin && (
                      <span style={{ fontSize: '0.65rem', color: '#facc15', fontWeight: 600 }}>ADMIN</span>
                    )}
                    {usedByName && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--theme-elevation-400)' }}>→ {usedByName}</span>
                    )}
                  </div>
                  <button
                    onClick={() => copyLink(inv)}
                    disabled={!!inv.usedAt || new Date(inv.expiresAt) < new Date()}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '4px',
                      border: '1px solid var(--theme-elevation-200)',
                      background: copiedId === inv.id ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                      color: copiedId === inv.id ? '#4ade80' : 'var(--theme-elevation-500)',
                      cursor: inv.usedAt || new Date(inv.expiresAt) < new Date() ? 'not-allowed' : 'pointer',
                      fontSize: '0.72rem',
                      opacity: inv.usedAt || new Date(inv.expiresAt) < new Date() ? 0.4 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {copiedId === inv.id ? '✓ Copied' : '📋 Copy Link'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
