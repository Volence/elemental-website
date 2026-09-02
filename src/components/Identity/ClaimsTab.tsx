'use client'

import React, { useCallback, useEffect, useState } from 'react'

interface Claim {
  id: number; status: string; createdAt: string; tier: 'admin' | 'manager'; canReview: boolean; note: string | null
  claimant: { id: number; name: string; discordId: string; discordUsername?: string | null; accountCreatedAt?: string; joinDates?: Array<{ label: string; joinedAt: string | null }> }
  target: { id: number; name: string; role: string; departments: Record<string, boolean>; teams: string[] }
}

export default function ClaimsTab() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'declined'>('pending')
  const [claims, setClaims] = useState<Claim[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/identity/claims?status=${status}`)
    if (!res.ok) { setError('Failed to load'); return }
    setClaims((await res.json()).claims)
  }, [status])
  useEffect(() => { void load() }, [load])

  const act = async (id: number, action: 'approve' | 'decline') => {
    const note = action === 'decline' ? prompt('Reason (optional)') ?? '' : ''
    if (action === 'approve' && !confirm('Approve and merge the new account into this person?')) return
    const res = await fetch(`/api/identity/claims/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, note }) })
    const body = await res.json()
    if (!res.ok) { setError(body.error ?? 'Failed'); return }
    await load()
  }

  const box: React.CSSProperties = { border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 16, marginBottom: 12 }
  const col: React.CSSProperties = { flex: 1, fontSize: 13 }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['pending', 'approved', 'declined'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: status === s ? 'rgba(88,101,242,0.25)' : 'transparent', color: 'inherit', cursor: 'pointer' }}>{s}</button>
        ))}
      </div>
      {error && <p style={{ color: '#f87171' }}>{error}</p>}
      {claims === null ? <p>Loading...</p> : claims.length === 0 ? <p style={{ opacity: 0.6 }}>No {status} claims.</p> : claims.map((c) => (
        <div key={c.id} style={box}>
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={col}>
              <div style={{ opacity: 0.6, marginBottom: 4 }}>Claimant (new Discord account)</div>
              <div><b>{c.claimant.name}</b> @{c.claimant.discordUsername ?? '?'}</div>
              <div>Discord ID {c.claimant.discordId}</div>
              {c.claimant.accountCreatedAt && <div>Discord account since {new Date(c.claimant.accountCreatedAt).toLocaleDateString()}</div>}
              {(c.claimant.joinDates ?? []).map((j) => <div key={j.label}>Joined {j.label}: {j.joinedAt ? new Date(j.joinedAt).toLocaleDateString() : '?'}</div>)}
            </div>
            <div style={col}>
              <div style={{ opacity: 0.6, marginBottom: 4 }}>Claims to be</div>
              <div><b><a href={`/admin/edit-person?id=${c.target.id}`}>{c.target.name}</a></b></div>
              <div>Role: {c.target.role}</div>
              <div>Teams: {c.target.teams.join(', ') || '-'}</div>
              <div>Departments: {Object.entries(c.target.departments).filter(([, v]) => v).map(([k]) => k).join(', ') || '-'}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: c.tier === 'admin' ? '#fbbf24' : '#34d399' }}>{c.tier === 'admin' ? 'Admin approval required' : 'Team manager or staff can approve'}</div>
            </div>
          </div>
          {c.status === 'pending' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" disabled={!c.canReview} onClick={() => act(c.id, 'approve')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#052e16', cursor: c.canReview ? 'pointer' : 'not-allowed', opacity: c.canReview ? 1 : 0.5 }}>Approve and merge</button>
              <button type="button" disabled={!c.canReview} onClick={() => act(c.id, 'decline')} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'inherit', cursor: c.canReview ? 'pointer' : 'not-allowed', opacity: c.canReview ? 1 : 0.5 }}>Decline</button>
            </div>
          )}
          {c.note && <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Note: {c.note}</div>}
        </div>
      ))}
    </div>
  )
}
