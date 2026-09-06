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

  // Per-flag: staff, or a lead of that flag's department, gets an editable toggle. Everyone
  // else (including a non-manager viewing their own profile) sees a read-only badge, but only
  // for a flag that is actually on - an inactive flag they can't edit isn't worth a row. The
  // whole card disappears when there's nothing to edit and nothing active to show.
  const rows = EXTRA_FLAGS.map((flag) => ({
    flag,
    editable: actor?.canManagePeople === true || (flag.department !== null && lead.has(flag.department)),
    active: Boolean(value[flag.key]),
  })).filter((r) => r.editable || r.active)

  if (rows.length === 0) return null

  return (
    <div className="profile-card" data-testid="extra-access-section">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Monitor size={16} /> Extra access</h3>
      <p style={{ fontSize: 12, opacity: 0.6 }}>Additive overrides. Titles already grant their departments; tick these only for access a title does not cover.</p>
      {rows.map(({ flag, editable, active }) => {
        const granter = grantingTitle(titles, flag.department)
        return (
          <div className="dept-toggle" key={flag.key} data-testid={`extra-flag-${flag.key}`}>
            <div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{flag.label}</span>
              {granter && (
                <p style={{ fontSize: 11, opacity: 0.5, margin: '2px 0 0' }}>Granted by {titleLabel(granter)}</p>
              )}
            </div>
            {editable ? (
              <button
                className={`toggle-switch ${active ? 'on' : 'off'}`}
                onClick={() => toggle(flag.key)}
                type="button"
                aria-label={flag.label}
                aria-pressed={active}
              />
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 8, fontSize: 12, background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399' }}>
                On
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
