'use client'

import React, { useCallback, useEffect, useState } from 'react'
import DiscordMemberPicker from '@/components/DiscordMemberPicker'

interface Suggestion { discordId: string; username: string; displayName: string; nickname: string | null; servers: string[]; score: number }
interface Row { id: number; name: string; role: string; teams: string[]; hasPassword: boolean; lastLogin: string | null; suggestions: Suggestion[] }
interface Data { counts: { linked: number; unlinked: number; unlinkedWithLogin: number; unlinkedNoLogin: number }; rows: Row[] }

export default function UnlinkedTab({ onMerge }: { onMerge?: (targetId: number, sourceId: number) => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [manualFor, setManualFor] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError('')
    const res = await fetch('/api/identity/unlinked')
    if (!res.ok) { setError('Failed to load'); return }
    setData(await res.json())
  }, [])
  useEffect(() => { void load() }, [load])

  const link = async (personId: number, discordId: string) => {
    setBusyId(personId)
    setError('')
    try {
      const res = await fetch('/api/identity/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personId, discordId }) })
      const body = await res.json()
      if (res.status === 409) {
        if (onMerge) {
          if (confirm(`${body.otherName} (#${body.otherId}) already has that Discord ID. Open the merge tool?`)) onMerge(personId, body.otherId)
        } else {
          setError(`${body.otherName} (#${body.otherId}) already has that Discord ID. Ask an admin to merge the two records on the Identity page.`)
        }
        return
      }
      if (!res.ok) throw new Error(body.error ?? 'Link failed')
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const setInactive = async (personId: number) => {
    if (!confirm('Mark inactive? They disappear from pickers and this list. Nothing is deleted.')) return
    await fetch('/api/identity/inactive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personId, inactive: true }) })
    await load()
  }

  if (error) return <p style={{ color: '#f87171' }}>{error}</p>
  if (!data) return <p>Loading...</p>

  const cell: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', verticalAlign: 'top', fontSize: 13 }
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 13 }}>
        <span><b>{data.counts.linked}</b> linked</span>
        <span><b>{data.counts.unlinked}</b> unlinked</span>
        <span><b>{data.counts.unlinkedWithLogin}</b> unlinked with a password</span>
        <span><b>{data.counts.unlinkedNoLogin}</b> unlinked, no login</span>
      </div>
      <div className="kit-table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Name', 'Role', 'Teams', 'Password', 'Last login', 'Suggestions', ''].map((h) => <th key={h} style={{ ...cell, textAlign: 'left', opacity: 0.6 }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td style={cell}><a href={`/admin/edit-person?id=${r.id}`}>{r.name}</a></td>
                <td style={cell}>{r.role}</td>
                <td style={cell}>{r.teams.join(', ') || '-'}</td>
                <td style={cell}>{r.hasPassword ? 'yes' : '-'}</td>
                <td style={cell}>{r.lastLogin ? new Date(r.lastLogin).toLocaleDateString() : '-'}</td>
                <td style={cell}>
                  {r.suggestions.map((s) => (
                    <button key={s.discordId} type="button" disabled={busyId === r.id} onClick={() => link(r.id, s.discordId)} title={s.servers.join(', ')} style={{ display: 'block', marginBottom: 4, padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.08)', color: 'inherit', cursor: 'pointer', fontSize: 12 }}>
                      {s.displayName} @{s.username}{s.nickname ? ` (${s.nickname})` : ''} - {Math.round(s.score * 100)}%
                    </button>
                  ))}
                  {manualFor === r.id ? (
                    <DiscordMemberPicker value={null} onChange={() => {}} placeholder="Search Discord..." onPickDiscord={(discordId) => link(r.id, discordId)} />
                  ) : (
                    <button type="button" onClick={() => setManualFor(r.id)} style={{ fontSize: 12, background: 'transparent', border: 'none', color: '#93c5fd', cursor: 'pointer', padding: 0 }}>Search by hand</button>
                  )}
                </td>
                <td style={cell}>
                  <button type="button" onClick={() => setInactive(r.id)} style={{ fontSize: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: 'inherit', cursor: 'pointer', padding: '4px 8px' }}>Mark inactive</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
