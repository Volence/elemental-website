'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Search, ArrowRight, Check, AlertTriangle, Loader2, User, Trash2, Shield } from 'lucide-react'

type PersonResult = { id: number; name: string; email?: string; discordId?: string; role?: string; photoUrl?: string | null }
type MergeField = { field: string; targetValue: any; sourceValue: any; willCopy: boolean }
type TeamRef = { teamId: number; teamName: string; roles: string[] }
type PreviewData = { target: PersonResult; source: PersonResult; fieldsToMerge: MergeField[]; targetTeamRefs: TeamRef[]; sourceTeamRefs: TeamRef[] }

function PersonSearchBox({ label, selected, onSelect }: {
  label: string
  selected: PersonResult | null
  onSelect: (p: PersonResult | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PersonResult[]>([])
  const [searching, setSearching] = useState(false)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/people?where[name][like]=${encodeURIComponent(q)}&limit=10&depth=1`)
      if (res.ok) {
        const data = await res.json()
        setResults((data.docs ?? []).map((d: any) => ({
          id: d.id, name: d.name, email: d.email, discordId: d.discordId, role: d.role,
          photoUrl: d.photo?.url ?? d.avatar?.url ?? null,
        })))
      }
    } finally { setSearching(false) }
  }, [])

  if (selected) {
    return (
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(52, 211, 153, 0.3)', background: 'rgba(52, 211, 153, 0.05)' }}>
          {selected.photoUrl ? (
            <img src={selected.photoUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={14} style={{ opacity: 0.4 }} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{selected.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              #{selected.id} {selected.email && `- ${selected.email}`} {selected.role && `- ${selected.role}`}
              {selected.discordId && ` - Discord: ${selected.discordId}`}
            </div>
          </div>
          <button
            onClick={() => { onSelect(null); setQuery(''); setResults([]) }}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4 }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
        <Search size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value) }}
          placeholder="Search by name..."
          style={{ flex: 1, background: 'none', border: 'none', color: '#e2e8f0', fontSize: 14, outline: 'none' }}
        />
        {searching && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', opacity: 0.4 }} />}
      </div>
      {results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#1e1e2e', maxHeight: 240, overflow: 'auto' }}>
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); setResults([]) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}
            >
              {p.photoUrl ? (
                <img src={p.photoUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={10} style={{ opacity: 0.4 }} />
                </div>
              )}
              <span style={{ flex: 1 }}>{p.name}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>#{p.id} {p.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function formatValue(val: any): string {
  if (val == null || val === '') return '-'
  if (Array.isArray(val)) return val.length === 0 ? '-' : val.map((v: any) => typeof v === 'object' ? JSON.stringify(v) : v).join(', ')
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

export default function MergePeopleView({ initialTargetId, initialSourceId }: { initialTargetId?: number | null; initialSourceId?: number | null } = {}) {
  const [target, setTarget] = useState<PersonResult | null>(null)
  const [source, setSource] = useState<PersonResult | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [merging, setMerging] = useState(false)
  const [mergeResult, setMergeResult] = useState<{ success: boolean; message: string; log?: string[] } | null>(null)

  useEffect(() => {
    const loadInitial = async () => {
      if (!initialTargetId && !initialSourceId) return
      try {
        const fetches: Promise<any>[] = []
        if (initialTargetId) fetches.push(fetch(`/api/people/${initialTargetId}?depth=1`).then(r => r.ok ? r.json() : null))
        else fetches.push(Promise.resolve(null))
        if (initialSourceId) fetches.push(fetch(`/api/people/${initialSourceId}?depth=1`).then(r => r.ok ? r.json() : null))
        else fetches.push(Promise.resolve(null))
        const [tData, sData] = await Promise.all(fetches)
        if (tData) setTarget({ id: tData.id, name: tData.name, email: tData.email, discordId: tData.discordId, role: tData.role, photoUrl: tData.photo?.url ?? tData.avatar?.url ?? null })
        if (sData) setSource({ id: sData.id, name: sData.name, email: sData.email, discordId: sData.discordId, role: sData.role, photoUrl: sData.photo?.url ?? sData.avatar?.url ?? null })
      } catch {}
    }
    loadInitial()
  }, [initialTargetId, initialSourceId])

  const loadPreview = async () => {
    if (!target || !source) return
    setPreviewLoading(true)
    setPreviewError(null)
    setPreview(null)
    setMergeResult(null)
    try {
      const res = await fetch(`/api/merge-people?targetId=${target.id}&sourceId=${source.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPreview(data)
    } catch (e: any) {
      setPreviewError(e.message)
    } finally { setPreviewLoading(false) }
  }

  const executeMerge = async () => {
    if (!target || !source) return
    if (!confirm(`This will merge "${source.name}" (#${source.id}) into "${target.name}" (#${target.id}) and DELETE person #${source.id}. This cannot be undone. Continue?`)) return
    setMerging(true)
    try {
      const res = await fetch('/api/merge-people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: target.id, sourceId: source.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMergeResult({ success: true, message: data.message, log: data.log })
      setPreview(null)
      setSource(null)
    } catch (e: any) {
      setMergeResult({ success: false, message: e.message })
    } finally { setMerging(false) }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
        Merge two person records into one. The <strong style={{ color: '#34d399' }}>target</strong> is kept, the <strong style={{ color: '#f87171' }}>source</strong> is merged in and deleted. Fields only copy if the target's field is empty.
        All references (teams, matches, lobbies, etc.) are repointed automatically.
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
        <PersonSearchBox label="Target (keep)" selected={target} onSelect={setTarget} />
        <div style={{ display: 'flex', alignItems: 'center', paddingTop: 24 }}>
          <ArrowRight size={20} style={{ color: 'rgba(255,255,255,0.2)' }} />
        </div>
        <PersonSearchBox label="Source (merge in & delete)" selected={source} onSelect={setSource} />
      </div>

      {target && source && (
        <button
          onClick={loadPreview}
          disabled={previewLoading}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(99, 102, 241, 0.4)', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', cursor: 'pointer', fontSize: 13, fontWeight: 500, marginBottom: 16 }}
        >
          {previewLoading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading preview...</> : <><Search size={14} /> Preview merge</>}
        </button>
      )}

      {previewError && (
        <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', color: '#f87171', fontSize: 13, marginBottom: 16 }}>
          <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{previewError}
        </div>
      )}

      {preview && (preview.targetTeamRefs.length > 0 || preview.sourceTeamRefs.length > 0) && (
        <div style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Shield size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
            Team connections
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            <div style={{ padding: '10px 14px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 11, color: '#34d399', fontWeight: 600, marginBottom: 6 }}>Target - {preview.target.name}</div>
              {preview.targetTeamRefs.length === 0 ? (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No team connections</div>
              ) : (
                preview.targetTeamRefs.map((ref) => (
                  <div key={ref.teamId} style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
                    <span style={{ color: '#e2e8f0' }}>{ref.teamName}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}> - {ref.roles.join(', ')}</span>
                  </div>
                ))
              )}
            </div>
            <div style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#f87171', fontWeight: 600, marginBottom: 6 }}>Source - {preview.source.name}</div>
              {preview.sourceTeamRefs.length === 0 ? (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No team connections</div>
              ) : (
                preview.sourceTeamRefs.map((ref) => (
                  <div key={ref.teamId} style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
                    <span style={{ color: '#e2e8f0' }}>{ref.teamName}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}> - {ref.roles.join(', ')}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            All source team connections will be repointed to the target after merge.
          </div>
        </div>
      )}

      {preview && (
        <div style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Field merge preview
          </div>
          {preview.fieldsToMerge.length === 0 ? (
            <div style={{ padding: '16px 14px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              No fields to merge - source has no data the target is missing.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Field</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', color: '#34d399', fontWeight: 500 }}>Target</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', color: '#f87171', fontWeight: 500 }}>Source</th>
                  <th style={{ padding: '8px 14px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {preview.fieldsToMerge.map((f) => (
                  <tr key={f.field} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '6px 14px', color: '#e2e8f0', fontWeight: 500 }}>{f.field}</td>
                    <td style={{ padding: '6px 14px', color: 'rgba(255,255,255,0.5)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatValue(f.targetValue)}</td>
                    <td style={{ padding: '6px 14px', color: 'rgba(255,255,255,0.5)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatValue(f.sourceValue)}</td>
                    <td style={{ padding: '6px 14px', textAlign: 'center' }}>
                      {f.willCopy ? (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399' }}>Copy</span>
                      ) : (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>Keep target</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ padding: '12px 14px', background: 'rgba(239, 68, 68, 0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              All references to <strong style={{ color: '#f87171' }}>#{source?.id}</strong> will be repointed to <strong style={{ color: '#34d399' }}>#{target?.id}</strong>, then <strong style={{ color: '#f87171' }}>#{source?.id}</strong> will be deleted.
            </div>
            <button
              onClick={executeMerge}
              disabled={merging}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}
            >
              {merging ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Merging...</> : <><Trash2 size={14} /> Merge & delete source</>}
            </button>
          </div>
        </div>
      )}

      {mergeResult && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, fontSize: 13,
          border: `1px solid ${mergeResult.success ? 'rgba(52, 211, 153, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          background: mergeResult.success ? 'rgba(52, 211, 153, 0.05)' : 'rgba(239, 68, 68, 0.05)',
          color: mergeResult.success ? '#34d399' : '#f87171',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: mergeResult.log ? 8 : 0 }}>
            {mergeResult.success ? <Check size={14} /> : <AlertTriangle size={14} />}
            {mergeResult.message}
          </div>
          {mergeResult.log && (
            <details style={{ marginTop: 4 }}>
              <summary style={{ cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Operation log ({mergeResult.log.length} steps)</summary>
              <pre style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                {mergeResult.log.join('\n')}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
