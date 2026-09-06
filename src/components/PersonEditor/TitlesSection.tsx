'use client'
import React, { useState } from 'react'
import { Plus, X, Star } from 'lucide-react'
import { TITLES, TITLE_BY_VALUE, TITLE_GROUP_LABELS, REGIONS, titleLabel, type TitleValue } from '@/access/titles'
import type { ResolvedAccess, TitleEntry } from '@/access/resolve'

interface Props { value: TitleEntry[]; onChange: (v: TitleEntry[]) => void; actor: ResolvedAccess | null }

/** Which titles may this actor add or remove? Staff: all. Lead: member titles inside their lead departments. */
export function grantableTitles(actor: ResolvedAccess | null): TitleValue[] {
  if (!actor) return []
  if (actor.canManagePeople) return TITLES.map((t) => t.value)
  const lead = new Set(actor.leadDepartments)
  return TITLES.filter((t) => !t.impliesRole && t.value !== 'region-lead' && t.departments.length > 0 && t.departments.every((d) => lead.has(d))).map((t) => t.value)
}

export default function TitlesSection({ value, onChange, actor }: Props) {
  const [adding, setAdding] = useState(false)
  const grantable = new Set(grantableTitles(actor))
  const canSetLead = actor?.canManagePeople === true
  const available = TITLES.filter((t) => grantable.has(t.value) && !value.some((v) => v.title === t.value))

  const update = (i: number, patch: Partial<TitleEntry>) => onChange(value.map((v, j) => (j === i ? { ...v, ...patch } : v)))
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="profile-card" data-testid="titles-section">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Star size={16} /> Titles</h3>
      <p style={{ fontSize: 12, opacity: 0.6 }}>Each title grants its department. Lead grants lead level and a badge on the site. Order is display order.</p>
      {value.length === 0 && <p style={{ fontSize: 13, opacity: 0.6 }}>No titles.</p>}
      {value.map((entry, i) => {
        const def = TITLE_BY_VALUE[entry.title]
        const editable = grantable.has(entry.title)
        return (
          <div key={entry.title} data-testid={`title-row-${entry.title}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ flex: 1, fontWeight: 600 }}>{titleLabel(entry)} <span style={{ opacity: 0.5, fontWeight: 400, fontSize: 12 }}>{TITLE_GROUP_LABELS[def.group]}</span></span>
            {def.leadLabel && (
              <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" aria-label={`Lead: ${def.leadLabel}`} checked={Boolean(entry.isLead)} disabled={!canSetLead} onChange={(e) => update(i, { isLead: e.target.checked })} />
                Lead
              </label>
            )}
            {entry.title === 'region-lead' && (
              <select multiple aria-label="Regions" disabled={!canSetLead} value={entry.regions ?? []} onChange={(e) => update(i, { regions: [...e.target.selectedOptions].map((o) => o.value) })} style={{ minWidth: 120 }}>
                {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            )}
            {canSetLead && <><button type="button" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>↑</button><button type="button" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === value.length - 1}>↓</button></>}
            {editable && <button type="button" aria-label={`Remove ${def.label}`} onClick={() => remove(i)}><X size={14} /></button>}
          </div>
        )
      })}
      {available.length > 0 && (
        adding ? (
          <select autoFocus data-testid="add-title-select" aria-label="Choose a title" onBlur={() => setAdding(false)} onChange={(e) => { const v = e.target.value as TitleValue; if (v) onChange([...value, { title: v, isLead: false, regions: v === 'region-lead' ? [] : undefined }]); setAdding(false) }} defaultValue="">
            <option value="" disabled>Choose a title</option>
            {available.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        ) : (
          <button type="button" onClick={() => setAdding(true)} style={{ marginTop: 8 }}><Plus size={13} /> Add title</button>
        )
      )}
    </div>
  )
}
