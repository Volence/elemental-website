'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Check, GitMerge, Loader2, X, User, ChevronDown, ChevronRight } from 'lucide-react'

interface PersonRecord {
  id: number
  name: string
  email?: string
  discordId?: string
  role?: string
  slug?: string
  photoUrl?: string | null
}

interface DuplicateGroup {
  anchor: PersonRecord
  matches: Array<PersonRecord & { similarity: number }>
}

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  if (longer.length === 0) return 1.0

  const matrix: number[][] = []
  for (let i = 0; i <= shorter.length; i++) matrix[i] = [i]
  for (let j = 0; j <= longer.length; j++) matrix[0][j] = j
  for (let i = 1; i <= shorter.length; i++) {
    for (let j = 1; j <= longer.length; j++) {
      if (shorter.charAt(i - 1) === longer.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
      }
    }
  }
  return (longer.length - matrix[shorter.length][longer.length]) / longer.length
}

function isPlaceholder(person: PersonRecord): boolean {
  return !!person.email?.includes('@elmt.placeholder')
}

function pickTargetAndSource(a: PersonRecord, b: PersonRecord): { target: PersonRecord; source: PersonRecord } {
  const aPlaceholder = isPlaceholder(a)
  const bPlaceholder = isPlaceholder(b)
  if (aPlaceholder && !bPlaceholder) return { target: b, source: a }
  if (bPlaceholder && !aPlaceholder) return { target: a, source: b }

  const ROLE_PRIORITY = ['admin', 'staff-manager', 'team-manager', 'player', 'user']
  const aIdx = ROLE_PRIORITY.indexOf(a.role ?? 'user')
  const bIdx = ROLE_PRIORITY.indexOf(b.role ?? 'user')
  if (aIdx !== bIdx) return aIdx < bIdx ? { target: a, source: b } : { target: b, source: a }

  return a.id < b.id ? { target: a, source: b } : { target: b, source: a }
}

export default function MergeSuggestionsView() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mergingPair, setMergingPair] = useState<string | null>(null)
  const [mergeResults, setMergeResults] = useState<Record<string, { success: boolean; message: string }>>({})
  const [ignoringPair, setIgnoringPair] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())

  const fetchDuplicates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [peopleRes, ignoredRes] = await Promise.all([
        fetch('/api/people?limit=1000&depth=0'),
        fetch('/api/ignored-duplicates?limit=1000&depth=0').catch(() => null),
      ])

      if (!peopleRes.ok) throw new Error('Failed to fetch people')
      const peopleData = await peopleRes.json()
      const people: PersonRecord[] = (peopleData.docs ?? []).map((d: any) => ({
        id: d.id,
        name: d.name,
        email: d.email,
        discordId: d.discordId,
        role: d.role,
        slug: d.slug,
        photoUrl: d.photo?.url ?? d.avatar?.url ?? null,
      }))

      const ignoredPairs = new Set<string>()
      if (ignoredRes?.ok) {
        const ignoredData = await ignoredRes.json()
        ignoredData.docs?.forEach((ignored: any) => {
          const id1 = typeof ignored.person1 === 'object' ? ignored.person1.id : ignored.person1
          const id2 = typeof ignored.person2 === 'object' ? ignored.person2.id : ignored.person2
          ignoredPairs.add([id1, id2].sort().join('-'))
        })
      }

      const groupMap = new Map<number, DuplicateGroup>()
      const seen = new Set<string>()

      for (let i = 0; i < people.length; i++) {
        for (let j = i + 1; j < people.length; j++) {
          const p1 = people[i]
          const p2 = people[j]
          if (!p1.name || !p2.name) continue

          const pairKey = [p1.id, p2.id].sort().join('-')
          if (ignoredPairs.has(pairKey)) continue
          if (seen.has(pairKey)) continue

          const similarity = calculateSimilarity(p1.name, p2.name)
          if (similarity < 0.8) continue

          seen.add(pairKey)
          const simPct = Math.round(similarity * 100)

          if (!groupMap.has(p1.id)) {
            groupMap.set(p1.id, { anchor: p1, matches: [] })
          }
          groupMap.get(p1.id)!.matches.push({ ...p2, similarity: simPct })
        }
      }

      const result = Array.from(groupMap.values())
        .filter(g => g.matches.length > 0)
        .sort((a, b) => {
          const aMax = Math.max(...a.matches.map(m => m.similarity))
          const bMax = Math.max(...b.matches.map(m => m.similarity))
          return bMax - aMax
        })

      setGroups(result)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDuplicates() }, [fetchDuplicates])

  const executeMerge = async (personA: PersonRecord, personB: PersonRecord) => {
    const { target, source } = pickTargetAndSource(personA, personB)
    const pairKey = [personA.id, personB.id].sort().join('-')

    if (!confirm(`Merge "${source.name}" (#${source.id}) into "${target.name}" (#${target.id}) and DELETE #${source.id}? This cannot be undone.`)) return

    setMergingPair(pairKey)
    try {
      const res = await fetch('/api/merge-people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: target.id, sourceId: source.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        const detailStr = data.details ? ` (${JSON.stringify(data.details)})` : ''
        throw new Error(`${data.error}${detailStr}`)
      }

      setMergeResults(prev => ({ ...prev, [pairKey]: { success: true, message: `Merged into "${target.name}" (#${target.id})` } }))

      setGroups(prev => prev.map(g => ({
        ...g,
        matches: g.matches.filter(m => m.id !== source.id),
      })).filter(g => g.anchor.id !== source.id && g.matches.length > 0))
    } catch (e: any) {
      setMergeResults(prev => ({ ...prev, [pairKey]: { success: false, message: e.message } }))
    } finally {
      setMergingPair(null)
    }
  }

  const ignorePair = async (person1: PersonRecord, person2: PersonRecord) => {
    const pairKey = [person1.id, person2.id].sort().join('-')
    setIgnoringPair(pairKey)
    try {
      const res = await fetch('/api/ignored-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person1: person1.id, person2: person2.id }),
      })
      if (!res.ok) throw new Error('Failed to ignore')

      setGroups(prev => prev.map(g => ({
        ...g,
        matches: g.matches.filter(m => {
          const k = [g.anchor.id, m.id].sort().join('-')
          return k !== pairKey
        }),
      })).filter(g => g.matches.length > 0))
    } catch (e: any) {
      alert(`Failed to ignore: ${e.message}`)
    } finally {
      setIgnoringPair(null)
    }
  }

  const toggleGroup = (id: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalPairs = groups.reduce((sum, g) => sum + g.matches.length, 0)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 20, color: 'rgba(255,255,255,0.4)' }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Scanning for duplicates...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', color: '#f87171', fontSize: 13 }}>
        <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{error}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 20, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
        <Check size={16} style={{ color: '#34d399' }} /> No potential duplicates found.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          Found <strong style={{ color: '#e2e8f0' }}>{totalPairs}</strong> potential duplicate pairs across <strong style={{ color: '#e2e8f0' }}>{groups.length}</strong> people.
          Merge combines records and deletes the source. Ignore hides the pair permanently.
        </p>
        <button
          onClick={fetchDuplicates}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', marginLeft: 16 }}
        >
          Refresh
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.anchor.id) || group.matches.length === 1
          const singleMatch = group.matches.length === 1

          return (
            <div key={group.anchor.id} style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
              {!singleMatch && (
                <button
                  onClick={() => toggleGroup(group.anchor.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none', color: '#e2e8f0', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span style={{ fontWeight: 600 }}>{group.anchor.name}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>#{group.anchor.id}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>{group.matches.length} potential matches</span>
                </button>
              )}

              {(isExpanded || singleMatch) && group.matches.map((match) => {
                const pairKey = [group.anchor.id, match.id].sort().join('-')
                const result = mergeResults[pairKey]
                const isMerging = mergingPair === pairKey
                const isIgnoring = ignoringPair === pairKey
                const { target, source } = pickTargetAndSource(group.anchor, match)

                if (result?.success) {
                  return (
                    <div key={match.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', color: '#34d399', fontSize: 12 }}>
                      <Check size={14} /> {result.message}
                    </div>
                  )
                }

                return (
                  <div key={match.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {target.photoUrl ? (
                          <img src={target.photoUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={10} style={{ opacity: 0.4 }} />
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#34d399' }}>{target.name}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>#{target.id} {target.role} - keep</div>
                        </div>
                      </div>

                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', padding: '0 4px' }}>
                        {match.similarity}%
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {source.photoUrl ? (
                          <img src={source.photoUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={10} style={{ opacity: 0.4 }} />
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#f87171' }}>{source.name}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>#{source.id} {source.role} - delete</div>
                        </div>
                      </div>
                    </div>

                    {result && !result.success && (
                      <div style={{ fontSize: 11, color: '#f87171', maxWidth: 250 }} title={result.message}>
                        {result.message}
                      </div>
                    )}

                    <button
                      onClick={() => executeMerge(group.anchor, match)}
                      disabled={isMerging || isIgnoring}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(99, 102, 241, 0.4)', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', cursor: isMerging ? 'wait' : 'pointer', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', opacity: isMerging ? 0.6 : 1 }}
                    >
                      {isMerging ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <GitMerge size={12} />} Merge
                    </button>

                    <button
                      onClick={() => ignorePair(group.anchor, match)}
                      disabled={isMerging || isIgnoring}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)', cursor: isIgnoring ? 'wait' : 'pointer', fontSize: 12, whiteSpace: 'nowrap', opacity: isIgnoring ? 0.6 : 1 }}
                    >
                      {isIgnoring ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <X size={12} />} Ignore
                    </button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
