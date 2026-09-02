'use client'

import React, { useCallback, useEffect, useState } from 'react'

interface PersonHit { id: number; name: string; isInactive?: boolean }
interface MemberHit {
  id: string
  username: string
  displayName: string
  nickname: string | null
  avatar: string | null
  servers: string[]
  person: { id: number; name: string; teams: string[] } | null
}

interface Props {
  value: number | null
  onChange: (id: number | null, name: string) => void
  placeholder?: string
}

const avatarUrl = (m: MemberHit) =>
  m.avatar ? `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.png?size=32` : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(m.id) >> 22n) % 6}.png`

/**
 * One picker for every place a person is attached. Existing People rows are searched by name;
 * Discord members are searched across every registered server. Picking a Discord member with
 * no row creates one (Discord ID set server-side).
 */
export default function DiscordMemberPicker({ value, onChange, placeholder }: Props) {
  const [search, setSearch] = useState('')
  const [people, setPeople] = useState<PersonHit[]>([])
  const [members, setMembers] = useState<MemberHit[]>([])
  const [displayName, setDisplayName] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (value && !displayName) {
      fetch(`/api/people/${value}?depth=0`).then((r) => r.json()).then((d) => setDisplayName(d.name ?? '')).catch(() => {})
    }
  }, [value, displayName])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setPeople([]); setMembers([]); return }
    const isId = /^\d{17,19}$/.test(q)
    try {
      const [p, m] = await Promise.all([
        isId ? Promise.resolve(null) : fetch(`/api/people?where[name][contains]=${encodeURIComponent(q)}&where[isInactive][not_equals]=true&limit=8&depth=0`).then((r) => (r.ok ? r.json() : { docs: [] })),
        isId
          ? fetch(`/api/discord/members/${q}`).then(async (r) => (r.ok ? { results: [ { ...(await r.json()).profile, nickname: null, person: null } ] } : { results: [] }))
          : fetch(`/api/discord/members?q=${encodeURIComponent(q)}`).then((r) => (r.ok ? r.json() : { results: [] })),
      ])
      setPeople(p?.docs ?? [])
      setMembers(m?.results ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 250)
    return () => clearTimeout(t)
  }, [search, doSearch])

  const pickPerson = (id: number, name: string) => {
    onChange(id, name)
    setDisplayName(name)
    setSearch('')
    setOpen(false)
  }

  const pickMember = async (m: MemberHit) => {
    if (m.person) return pickPerson(m.person.id, m.person.name)
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/people/from-discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordId: m.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create person')
      pickPerson(data.person.id, data.person.name)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (value && displayName) return <span style={{ fontSize: 13, color: '#e2e8f0' }}>{displayName}</span>

  const row: React.CSSProperties = { padding: '8px 12px', fontSize: 13, color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.04)' }
  const heading: React.CSSProperties = { padding: '6px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)' }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="profile-input"
        style={{ fontSize: 13, padding: '6px 10px' }}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder ?? 'Search people or Discord members...'}
        disabled={busy}
      />
      {error && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{error}</div>}
      {open && (people.length > 0 || members.length > 0) && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, maxHeight: 320, overflowY: 'auto', zIndex: 50 }}>
          {people.length > 0 && <div style={heading}>People</div>}
          {people.map((p) => (
            <div key={`p-${p.id}`} style={row} onMouseDown={(e) => { e.preventDefault(); pickPerson(p.id, p.name) }}>
              {p.name}
            </div>
          ))}
          {members.length > 0 && <div style={heading}>Discord members</div>}
          {members.map((m) => (
            <div key={`m-${m.id}`} style={row} onMouseDown={(e) => { e.preventDefault(); void pickMember(m) }}>
              <img src={avatarUrl(m)} alt="" width={20} height={20} style={{ borderRadius: '50%' }} />
              <span style={{ flex: 1 }}>
                {m.displayName} <span style={{ opacity: 0.5 }}>@{m.username}</span>
                {m.nickname && <span style={{ opacity: 0.5 }}> ({m.nickname})</span>}
              </span>
              <span style={{ fontSize: 11, color: m.person ? '#34d399' : 'rgba(255,255,255,0.5)' }}>
                {m.person ? `In system: ${m.person.name}${m.person.teams.length ? ` (${m.person.teams.join(', ')})` : ''}` : 'New'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
