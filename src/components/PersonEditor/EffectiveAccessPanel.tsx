'use client'
import React, { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { resolveAccess, type AccessTeamInput, type TitleEntry } from '@/access/resolve'
import { DEPARTMENT_KEYS, DEPARTMENT_LABELS, ROLE_LABELS, TITLE_BY_VALUE, titleLabel, isRoleValue } from '@/access/titles'

interface PersonInput {
  id: number
  role: string
  titles: TitleEntry[]
  departments: Record<string, boolean>
  teamAccess: number[]
}

interface Props {
  person: PersonInput
  teamNames: Record<number, string>
}

const TEAMS_URL = '/api/teams?limit=0&depth=0&select[region]=true&select[manager]=true&select[coaches]=true&select[captain]=true&select[name]=true'

export default function EffectiveAccessPanel({ person, teamNames }: Props) {
  const [teams, setTeams] = useState<AccessTeamInput[] | null>(null)

  useEffect(() => {
    let live = true
    fetch(TEAMS_URL)
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then((data) => { if (live) setTeams(data.docs ?? []) })
      .catch(() => { if (live) setTeams([]) })
    return () => { live = false }
  }, [])

  if (!teams) {
    return (
      <div className="profile-card" data-testid="effective-access">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={16} /> Effective access</h3>
        <p style={{ fontSize: 12, opacity: 0.6 }}>Loading...</p>
      </div>
    )
  }

  const access = resolveAccess(person, teams)
  const storedRole = isRoleValue(person.role) ? person.role : 'user'
  const raisedBy = access.role !== storedRole
    ? access.titles.find((t) => TITLE_BY_VALUE[t.title].impliesRole === access.role)
    : undefined
  const teamEntries = [...access.teamIds].sort((a, b) => a - b)

  return (
    <div className="profile-card" data-testid="effective-access">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={16} /> Effective access</h3>
      <p style={{ fontSize: 12, opacity: 0.6 }}>What their titles, extra access, and team access add up to.</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Role</span>
        <span style={{ fontWeight: 600 }}>{ROLE_LABELS[access.role]}</span>
        {raisedBy && <span style={{ fontSize: 11, opacity: 0.6 }}>(raised by {titleLabel(raisedBy)})</span>}
      </div>

      <div style={{ marginTop: 8 }}>
        {DEPARTMENT_KEYS.map((k) => {
          const level = access.departments[k]
          return (
            <div key={k} data-testid={`effective-department-${k}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
              <span style={{ opacity: 0.7 }}>{`${DEPARTMENT_LABELS[k]}: ${level.charAt(0).toUpperCase()}${level.slice(1)}`}</span>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Teams</span>
        {access.canManagePeople ? (
          <p style={{ fontSize: 13, marginTop: 4 }}>Every team (staff)</p>
        ) : teamEntries.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.4, marginTop: 4 }}>No team access</p>
        ) : (
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {teamEntries.map((id) => (
              <li key={id} style={{ fontSize: 13 }}>
                {teamNames[id] ?? `Team ${id}`}
                <span style={{ opacity: 0.5 }}> ({(access.teamReasons[id] ?? []).join(', ')})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
