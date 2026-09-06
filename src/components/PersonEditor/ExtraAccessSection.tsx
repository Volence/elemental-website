'use client'
import React from 'react'
import { Monitor } from 'lucide-react'
import { EXTRA_FLAGS, TITLE_BY_VALUE, titleLabel, type DepartmentKey } from '@/access/titles'
import type { ResolvedAccess, TitleEntry } from '@/access/resolve'

interface Props {
  value: Record<string, boolean>
  onChange: (v: Record<string, boolean>) => void
  titles: TitleEntry[]
  actor: ResolvedAccess | null
}

/** Is this flag's department already granted (at any level) by one of the person's titles? Returns the granting entry, if any. */
function grantingTitle(titles: TitleEntry[], department: DepartmentKey | null): TitleEntry | undefined {
  if (!department) return undefined
  return titles.find((t) => TITLE_BY_VALUE[t.title].departments.includes(department))
}

export default function ExtraAccessSection({ value, onChange, titles, actor }: Props) {
  const lead = new Set(actor?.leadDepartments ?? [])
  const toggle = (key: string) => onChange({ ...value, [key]: !value[key] })

  return (
    <div className="profile-card" data-testid="extra-access-section">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Monitor size={16} /> Extra access</h3>
      <p style={{ fontSize: 12, opacity: 0.6 }}>Additive overrides. Titles already grant their departments; tick these only for access a title does not cover.</p>
      {EXTRA_FLAGS.map((flag) => {
        const editable = actor?.canManagePeople === true || (flag.department !== null && lead.has(flag.department))
        const granter = grantingTitle(titles, flag.department)
        return (
          <div className="dept-toggle" key={flag.key} data-testid={`extra-flag-${flag.key}`}>
            <div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{flag.label}</span>
              {granter && (
                <p style={{ fontSize: 11, opacity: 0.5, margin: '2px 0 0' }}>Granted by {titleLabel(granter)}</p>
              )}
            </div>
            <button
              className={`toggle-switch ${value[flag.key] ? 'on' : 'off'}`}
              onClick={editable ? () => toggle(flag.key) : undefined}
              disabled={!editable}
              type="button"
              aria-label={flag.label}
              aria-pressed={Boolean(value[flag.key])}
            />
          </div>
        )
      })}
    </div>
  )
}
