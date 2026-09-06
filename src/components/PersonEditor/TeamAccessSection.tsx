'use client'
import React from 'react'
import { Check, Gamepad2 } from 'lucide-react'
import type { ResolvedAccess } from '@/access/resolve'

interface Props {
  value: number[]
  onChange: (v: number[]) => void
  allTeams: Array<{ id: number; name: string }>
  actor: ResolvedAccess | null
}

export default function TeamAccessSection({ value, onChange, allTeams, actor }: Props) {
  const editable = actor?.canManagePeople === true
  const toggle = (teamId: number) => {
    onChange(value.includes(teamId) ? value.filter((t) => t !== teamId) : [...value, teamId])
  }

  return (
    <div className="profile-card" data-testid="team-access-section">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Gamepad2 size={16} /> Access-only teams</h3>
      <p style={{ fontSize: 12, opacity: 0.6 }}>Grants manager rights on the team. Not shown on the site. Team membership is set on the team page.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {allTeams.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`team-chip ${value.includes(t.id) ? 'selected' : ''}`}
            onClick={editable ? () => toggle(t.id) : undefined}
            style={{ cursor: editable ? 'pointer' : 'default' }}
          >
            {value.includes(t.id) && <Check size={12} />}
            {t.name}
          </button>
        ))}
      </div>
    </div>
  )
}
