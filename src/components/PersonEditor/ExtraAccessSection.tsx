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

/** Departments retired from the public site; only shown when the flag is already on. */
const RETIRED_DEPARTMENTS: ReadonlySet<DepartmentKey> = new Set<DepartmentKey>(['scouting'])

export type ExtraAccessRow = {
  flag: (typeof EXTRA_FLAGS)[number]
  /** The title already granting this flag's department, if any. */
  granter: TitleEntry | undefined
  active: boolean
  /** 'toggle' = editable switch; 'granted' = locked pill, a title covers it; 'on' = read-only active badge. */
  control: 'toggle' | 'granted' | 'on'
}

/** Is this flag's department already granted (at any level) by one of the person's titles? Returns the granting entry, if any. */
function grantingTitle(titles: TitleEntry[], department: DepartmentKey | null): TitleEntry | undefined {
  if (!department) return undefined
  return titles.find((t) => TITLE_BY_VALUE[t.title].departments.includes(department))
}

/**
 * Which rows to show and how. Staff, or a lead of the flag's department, may edit it. A flag a
 * title already covers renders as a locked "Granted by" pill instead of an off toggle, so it
 * does not read as missing; if the redundant flag is also on, the toggle stays so it can be
 * cleared. Everyone else sees a read-only badge for active flags only. Retired departments
 * appear only while their flag is on.
 */
export function extraAccessRows(value: Record<string, boolean>, titles: TitleEntry[], actor: ResolvedAccess | null): ExtraAccessRow[] {
  const lead = new Set(actor?.leadDepartments ?? [])
  return EXTRA_FLAGS.flatMap((flag) => {
    const editable = actor?.canManagePeople === true || (flag.department !== null && lead.has(flag.department))
    const active = Boolean(value[flag.key])
    const granter = grantingTitle(titles, flag.department)
    if (flag.department && RETIRED_DEPARTMENTS.has(flag.department) && !active) return []
    if (!editable && !active) return []
    const control: ExtraAccessRow['control'] = !editable ? 'on' : granter && !active ? 'granted' : 'toggle'
    return [{ flag, granter, active, control }]
  })
}

const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }

export default function ExtraAccessSection({ value, onChange, titles, actor }: Props) {
  const toggle = (key: string) => onChange({ ...value, [key]: !value[key] })
  const rows = extraAccessRows(value, titles, actor)

  if (rows.length === 0) return null

  return (
    <div className="profile-card" data-testid="extra-access-section">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Monitor size={16} /> Extra access</h3>
      <p style={{ fontSize: 12, opacity: 0.6 }}>Additive overrides. Titles already grant their departments; tick these only for access a title does not cover.</p>
      {rows.map(({ flag, granter, active, control }) => (
        <div className="dept-toggle" key={flag.key} data-testid={`extra-flag-${flag.key}`}>
          <div>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{flag.label}</span>
            {granter && active && (
              <p style={{ fontSize: 11, opacity: 0.5, margin: '2px 0 0' }}>Redundant: already granted by {titleLabel(granter)}.</p>
            )}
          </div>
          {control === 'toggle' && (
            <button
              className={`toggle-switch ${active ? 'on' : 'off'}`}
              onClick={() => toggle(flag.key)}
              type="button"
              aria-label={flag.label}
              aria-pressed={active}
            />
          )}
          {control === 'granted' && granter && (
            <span style={{ ...pill, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }} title="Covered by a title. Remove the title to revoke.">
              Granted by {titleLabel(granter)}
            </span>
          )}
          {control === 'on' && (
            <span style={{ ...pill, background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399' }}>
              On
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
