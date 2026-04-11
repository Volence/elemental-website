'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@payloadcms/ui'
import { useSearchParams } from 'next/navigation'
import {
  User as UserIcon, Save, Camera, Link as LinkIcon, Gamepad2, MessageSquare,
  Check, AlertCircle, Loader2, ExternalLink, Shield, Twitch, Instagram,
  Youtube, X, ArrowLeft, StickyNote, Eye, Plus, Trash2, Monitor,
} from 'lucide-react'
import type { User } from '@/payload-types'

// ── Shared styles & constants ──

export const SOCIAL_PLATFORMS = [
  { key: 'twitter', label: 'Twitter / X', icon: X, placeholder: 'https://twitter.com/username' },
  { key: 'twitch', label: 'Twitch', icon: Twitch, placeholder: 'https://twitch.tv/username' },
  { key: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@channel' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/username' },
  { key: 'tiktok', label: 'TikTok', icon: Gamepad2, placeholder: 'https://tiktok.com/@username' },
] as const

export type PersonData = {
  id: number
  name: string
  slug: string
  bio: string | null
  notes: string | null
  photo: { url: string; filename: string } | number | null
  discordId: string | null
  showInLiveStreamers: boolean
  gameAliases: Array<{ alias: string; id?: string }> | null
  socialLinks: {
    twitter?: string | null
    twitch?: string | null
    youtube?: string | null
    instagram?: string | null
    tiktok?: string | null
    customLinks?: Array<{ label: string; url: string; id?: string }> | null
  } | null
}

export type TeamInfo = {
  name: string
  role: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ── CSS ──

export const EDITOR_CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .profile-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #e2e8f0; padding: 10px 14px; font-size: 14px; width: 100%; transition: border-color 0.2s, box-shadow 0.2s; outline: none; font-family: inherit; box-sizing: border-box; }
  .profile-input:focus { border-color: rgba(52, 211, 153, 0.5); box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.1); }
  .profile-input::placeholder { color: rgba(255,255,255,0.25); }
  .profile-input:disabled { opacity: 0.5; cursor: not-allowed; }
  .profile-textarea { resize: vertical; min-height: 100px; }
  .profile-card { animation: fadeIn 0.3s ease; }
  .photo-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; border-radius: 50%; opacity: 0; transition: opacity 0.2s; cursor: pointer; }
  .photo-wrapper:hover .photo-overlay { opacity: 1; }
  .profile-save-btn { background: linear-gradient(135deg, #34d399, #06b6d4); border: none; color: #0f172a; font-weight: 600; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
  .profile-save-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(52, 211, 153, 0.3); }
  .profile-save-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .readonly-badge { display: inline-flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 4px; font-size: 11px; color: rgba(255,255,255,0.4); }
  .social-row { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 12px; }
  .custom-link-row { display: grid; grid-template-columns: 1fr 2fr auto; align-items: center; gap: 8px; }
  .remove-btn { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; flex-shrink: 0; }
  .remove-btn:hover { background: rgba(239, 68, 68, 0.2); }
  .add-link-btn { background: rgba(255,255,255,0.04); border: 1px dashed rgba(255,255,255,0.15); color: rgba(255,255,255,0.5); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all 0.2s; width: 100%; }
  .add-link-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.25); }
  .add-alias-btn { background: rgba(99, 102, 241, 0.08); border: 1px dashed rgba(99, 102, 241, 0.3); color: rgba(99, 102, 241, 0.7); padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
  .add-alias-btn:hover { background: rgba(99, 102, 241, 0.15); color: #818cf8; }
  .team-tag { display: inline-flex; align-items: center; gap: 6px; background: rgba(52, 211, 153, 0.08); border: 1px solid rgba(52, 211, 153, 0.2); padding: 4px 12px; border-radius: 6px; font-size: 13px; color: #34d399; }
  .back-link { display: inline-flex; align-items: center; gap: 6px; color: rgba(255,255,255,0.5); font-size: 13px; text-decoration: none; margin-bottom: 16px; transition: color 0.2s; cursor: pointer; background: none; border: none; padding: 0; }
  .back-link:hover { color: rgba(255,255,255,0.8); }
  .toggle-switch { position: relative; width: 36px; height: 20px; min-height: 20px; max-height: 20px; border-radius: 10px; cursor: pointer; transition: background 0.2s; border: none; padding: 0; display: block; line-height: 0; font-size: 0; flex-shrink: 0; box-sizing: border-box; overflow: hidden; }
  .toggle-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: white; transition: transform 0.2s; display: block; box-sizing: border-box; }
  .toggle-switch.on { background: #34d399; }
  .toggle-switch.on::after { transform: translateX(16px); }
  .toggle-switch.off { background: rgba(255,255,255,0.15); }
  .alias-input-row { display: flex; gap: 8px; align-items: center; }
`

export const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 960, margin: '0 auto', padding: '24px 20px 60px' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, textAlign: 'center', color: 'rgba(255,255,255,0.5)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' as const, gap: 16 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 20 },
  headerRight: { display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end' },
  photoWrapper: { position: 'relative' as const, width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 },
  photo: { width: '100%', height: '100%', objectFit: 'cover' as const },
  photoPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '50%' },
  name: { fontSize: 28, fontWeight: 700, margin: 0, color: '#e2e8f0', letterSpacing: '-0.01em' },
  nameInput: { fontSize: 24, fontWeight: 700, color: '#e2e8f0', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 12px', outline: 'none', letterSpacing: '-0.01em', width: '100%', maxWidth: 320 },
  grid: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' },
  leftColumn: { display: 'flex', flexDirection: 'column' as const, gap: 20 },
  rightColumn: { display: 'flex', flexDirection: 'column' as const, gap: 20 },
  card: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 },
  cardTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: '0 0 14px 0' },
  fieldHint: { fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '8px 0 0 0', lineHeight: 1.4 },
  readonlyField: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  readonlyLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  readonlyValue: { fontSize: 13, color: '#e2e8f0', fontFamily: 'monospace' },
  editableField: { display: 'flex', flexDirection: 'column' as const, gap: 6, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  fieldLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  aliasTag: { background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '3px 10px', borderRadius: 6, fontSize: 13 },
  quickLink: { display: 'flex', alignItems: 'center', gap: 8, color: '#34d399', fontSize: 13, textDecoration: 'none', padding: '8px 12px', borderRadius: 6, background: 'rgba(52, 211, 153, 0.06)', border: '1px solid rgba(52, 211, 153, 0.12)', transition: 'background 0.2s' },
}

// ── PersonEditor Component ──

type PersonEditorProps = {
  /** Person ID to edit. If not provided, uses the current user's linkedPerson */
  personId?: number | string | null
  /** If true, all fields are editable (manager mode). If false, only player-editable fields. */
  isManager?: boolean
}

export default function PersonEditor({ personId: propPersonId, isManager = false }: PersonEditorProps) {
  const { user } = useAuth<User>()
  const [person, setPerson] = useState<PersonData | null>(null)
  const [teams, setTeams] = useState<TeamInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // Editable fields (all modes)
  const [bio, setBio] = useState('')
  const [socialLinks, setSocialLinks] = useState<PersonData['socialLinks']>(null)
  const [customLinks, setCustomLinks] = useState<Array<{ label: string; url: string }>>([])

  // Manager-only editable fields
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [discordId, setDiscordId] = useState('')
  const [showInLiveStreamers, setShowInLiveStreamers] = useState(false)
  const [gameAliases, setGameAliases] = useState<Array<{ alias: string }>>([])
  const [notes, setNotes] = useState('')

  // Resolve person ID
  const linkedPersonId = user
    ? typeof user.linkedPerson === 'object' && user.linkedPerson !== null
      ? (user.linkedPerson as any).id
      : user.linkedPerson
    : null
  const resolvedPersonId = propPersonId ?? linkedPersonId

  // Fetch person data
  const fetchPerson = useCallback(async () => {
    if (!resolvedPersonId) return
    try {
      const res = await fetch(`/api/people/${resolvedPersonId}?depth=1`)
      if (!res.ok) throw new Error('Failed to load profile')
      const data = await res.json()
      setPerson(data)
      setBio(data.bio ?? '')
      setSocialLinks(data.socialLinks ?? {})
      setCustomLinks(data.socialLinks?.customLinks ?? [])
      setName(data.name ?? '')
      setSlug(data.slug ?? '')
      setDiscordId(data.discordId ?? '')
      setShowInLiveStreamers(data.showInLiveStreamers ?? false)
      setGameAliases(data.gameAliases ?? [])
      setNotes(data.notes ?? '')

      if (data.photo && typeof data.photo === 'object' && data.photo.url) {
        setPhotoPreview(data.photo.url)
      }

      // Fetch teams
      const teamsRes = await fetch(`/api/teams?where[roster.person][equals]=${resolvedPersonId}&depth=0&limit=10`)
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json()
        const teamInfos: TeamInfo[] = []
        for (const team of teamsData.docs ?? []) {
          const roster = team.roster ?? []
          const entry = roster.find((r: any) => {
            const pid = typeof r.person === 'object' ? r.person?.id : r.person
            return String(pid) === String(resolvedPersonId)
          })
          teamInfos.push({ name: team.name ?? 'Unknown', role: entry?.role ?? 'Player' })
        }
        setTeams(teamInfos)
      }
    } catch (err) {
      console.error('Profile load error:', err)
    } finally {
      setLoading(false)
    }
  }, [resolvedPersonId])

  useEffect(() => { fetchPerson() }, [fetchPerson])

  // Save
  const handleSave = async () => {
    if (!resolvedPersonId) return
    setSaveStatus('saving')
    setErrorMsg('')

    try {
      const payload: Record<string, any> = {
        bio: bio || null,
        socialLinks: {
          ...(socialLinks ?? {}),
          customLinks: customLinks.filter(l => l.label.trim() && l.url.trim()),
        },
      }

      // Manager fields
      if (isManager) {
        payload.name = name
        payload.slug = slug
        payload.discordId = discordId || null
        payload.showInLiveStreamers = showInLiveStreamers
        payload.gameAliases = gameAliases.filter(a => a.alias.trim())
        payload.notes = notes || null
      }

      const res = await fetch(`/api/people/${resolvedPersonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.errors?.[0]?.message ?? 'Failed to save')
      }

      // Update local person state with saved name for header display
      if (isManager && person) {
        setPerson({ ...person, name, slug })
      }

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (err: any) {
      setSaveStatus('error')
      setErrorMsg(err.message ?? 'Failed to save')
    }
  }

  // Photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !resolvedPersonId) return

    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const uploadRes = await fetch('/api/media', { method: 'POST', body: formData })
      if (!uploadRes.ok) throw new Error('Upload failed')
      const mediaDoc = await uploadRes.json()
      await fetch(`/api/people/${resolvedPersonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: mediaDoc.doc.id }),
      })
    } catch (err) {
      console.error('Photo upload error:', err)
    }
  }

  const updateSocialLink = (key: string, value: string) => {
    setSocialLinks(prev => ({ ...(prev ?? {}), [key]: value || null }))
  }
  const addCustomLink = () => setCustomLinks(prev => [...prev, { label: '', url: '' }])
  const removeCustomLink = (i: number) => setCustomLinks(prev => prev.filter((_, idx) => idx !== i))
  const updateCustomLink = (i: number, field: 'label' | 'url', value: string) => {
    setCustomLinks(prev => prev.map((link, idx) => idx === i ? { ...link, [field]: value } : link))
  }

  // Alias helpers (manager only)
  const addAlias = () => setGameAliases(prev => [...prev, { alias: '' }])
  const removeAlias = (i: number) => setGameAliases(prev => prev.filter((_, idx) => idx !== i))
  const updateAlias = (i: number, value: string) => {
    setGameAliases(prev => prev.map((a, idx) => idx === i ? { alias: value } : a))
  }

  // ── Render ──

  if (!user || !resolvedPersonId) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <UserIcon size={48} style={{ opacity: 0.3 }} />
          <h2 style={{ margin: '16px 0 8px' }}>No Profile Linked</h2>
          <p style={{ opacity: 0.6 }}>
            {isManager
              ? 'No person ID provided. Go back to the People list and select someone.'
              : "Your account doesn't have a linked person profile. Contact a manager to get set up."}
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, opacity: 0.6 }}>Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!person) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <AlertCircle size={48} style={{ opacity: 0.3, color: '#f87171' }} />
          <h2 style={{ margin: '16px 0 8px' }}>Profile Not Found</h2>
          <p style={{ opacity: 0.6 }}>Unable to load profile. Please try refreshing.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <style>{EDITOR_CSS}</style>

      {/* Back link for managers */}
      {isManager && (
        <a href="/admin/collections/people" className="back-link">
          <ArrowLeft size={14} /> Back to People
        </a>
      )}

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div className="photo-wrapper" style={styles.photoWrapper}>
            {photoPreview ? (
              <img src={photoPreview} alt={person.name} style={styles.photo} />
            ) : (
              <div style={styles.photoPlaceholder}>
                <UserIcon size={40} style={{ opacity: 0.3 }} />
              </div>
            )}
            <label className="photo-overlay" htmlFor="photo-upload">
              <Camera size={20} color="white" />
            </label>
            <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
          </div>
          <div>
            {isManager ? (
              <input
                className="profile-input"
                style={styles.nameInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display name"
              />
            ) : (
              <h1 style={styles.name}>{person.name}</h1>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {teams.map((t, i) => (
                <span key={i} className="team-tag"><Shield size={12} />{t.name} — {t.role}</span>
              ))}
            </div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <button className="profile-save-btn" onClick={handleSave} disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? (
              <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
            ) : saveStatus === 'saved' ? (
              <><Check size={16} /> Saved!</>
            ) : saveStatus === 'error' ? (
              <><AlertCircle size={16} /> Error</>
            ) : (
              <><Save size={16} /> Save Changes</>
            )}
          </button>
          {saveStatus === 'error' && errorMsg && (
            <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errorMsg}</p>
          )}
        </div>
      </div>

      <div style={styles.grid}>
        {/* Left column */}
        <div style={styles.leftColumn}>
          {/* Bio */}
          <div className="profile-card" style={styles.card}>
            <h3 style={styles.cardTitle}><MessageSquare size={16} /> About</h3>
            <textarea
              className="profile-input profile-textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people a bit about yourself..."
              style={{ minHeight: 120 }}
            />
            <p style={styles.fieldHint}>This bio appears on the public player page.</p>
          </div>

          {/* Social Links */}
          <div className="profile-card" style={styles.card}>
            <h3 style={styles.cardTitle}><LinkIcon size={16} /> Social Links</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {SOCIAL_PLATFORMS.map(({ key, label, icon: Icon, placeholder }) => (
                <div className="social-row" key={key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                    <Icon size={16} style={{ opacity: 0.5 }} />
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
                  </div>
                  <input
                    className="profile-input"
                    type="url"
                    value={(socialLinks as any)?.[key] ?? ''}
                    onChange={(e) => updateSocialLink(key, e.target.value)}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
            {/* Custom Links */}
            <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>Custom Links</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {customLinks.map((link, i) => (
                  <div className="custom-link-row" key={i}>
                    <input className="profile-input" type="text" value={link.label} onChange={(e) => updateCustomLink(i, 'label', e.target.value)} placeholder="Label" />
                    <input className="profile-input" type="url" value={link.url} onChange={(e) => updateCustomLink(i, 'url', e.target.value)} placeholder="https://..." />
                    <button className="remove-btn" onClick={() => removeCustomLink(i)}>✕</button>
                  </div>
                ))}
                <button className="add-link-btn" onClick={addCustomLink}>+ Add Custom Link</button>
              </div>
            </div>
          </div>

          {/* Notes (manager only) */}
          {isManager && (
            <div className="profile-card" style={styles.card}>
              <h3 style={styles.cardTitle}><StickyNote size={16} /> Internal Notes</h3>
              <textarea
                className="profile-input profile-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes (not shown publicly)..."
                style={{ minHeight: 80 }}
              />
              <p style={styles.fieldHint}>Only visible to managers. Not displayed on public profiles.</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={styles.rightColumn}>
          {/* Identity */}
          <div className="profile-card" style={styles.card}>
            <h3 style={styles.cardTitle}>
              <UserIcon size={16} />
              Identity
              {!isManager && <span className="readonly-badge"><Shield size={10} /> Managed</span>}
            </h3>
            {!isManager && (
              <p style={styles.fieldHint}>These fields are managed by team staff and cannot be edited directly.</p>
            )}

            {isManager ? (
              <>
                <div style={styles.editableField}>
                  <label style={styles.fieldLabel}>Slug</label>
                  <input className="profile-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated-slug" />
                </div>
                <div style={styles.editableField}>
                  <label style={styles.fieldLabel}>Discord ID</label>
                  <input className="profile-input" value={discordId} onChange={(e) => setDiscordId(e.target.value)} placeholder="17-19 digit Discord User ID" />
                </div>
                <div style={{ ...styles.readonlyField, justifyContent: 'space-between' }}>
                  <div>
                    <span style={styles.fieldLabel}>Show in Live Streamers</span>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>Requires a Twitch URL in Social Links</p>
                  </div>
                  <button
                    className={`toggle-switch ${showInLiveStreamers ? 'on' : 'off'}`}
                    onClick={() => setShowInLiveStreamers(!showInLiveStreamers)}
                    type="button"
                  />
                </div>
              </>
            ) : (
              <>
                <div style={styles.readonlyField}>
                  <span style={styles.readonlyLabel}>Display Name</span>
                  <span style={styles.readonlyValue}>{person.name}</span>
                </div>
                <div style={styles.readonlyField}>
                  <span style={styles.readonlyLabel}>Slug</span>
                  <span style={styles.readonlyValue}>{person.slug}</span>
                </div>
                <div style={styles.readonlyField}>
                  <span style={styles.readonlyLabel}>Discord ID</span>
                  <span style={styles.readonlyValue}>
                    {person.discordId || <span style={{ opacity: 0.3 }}>Not set</span>}
                  </span>
                </div>
                <div style={styles.readonlyField}>
                  <span style={styles.readonlyLabel}>Live Streamer</span>
                  <span style={styles.readonlyValue}>
                    {person.showInLiveStreamers ? '✓ Enabled' : 'Disabled'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Game Aliases */}
          <div className="profile-card" style={styles.card}>
            <h3 style={styles.cardTitle}>
              <Gamepad2 size={16} />
              Game Aliases
              {!isManager && <span className="readonly-badge"><Shield size={10} /> Managed</span>}
            </h3>
            {isManager ? (
              <>
                <p style={styles.fieldHint}>In-game names matched against scrim logs for stat attribution.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {gameAliases.map((ga, i) => (
                    <div className="alias-input-row" key={i}>
                      <input
                        className="profile-input"
                        value={ga.alias}
                        onChange={(e) => updateAlias(i, e.target.value)}
                        placeholder="In-game name..."
                        style={{ flex: 1 }}
                      />
                      <button className="remove-btn" onClick={() => removeAlias(i)}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button className="add-alias-btn" onClick={addAlias}><Plus size={14} /> Add Alias</button>
                </div>
              </>
            ) : (
              <>
                <p style={styles.fieldHint}>In-game names used for scrim stat attribution. Contact a manager to update these.</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {(person.gameAliases ?? []).length > 0 ? (
                    person.gameAliases!.map((ga, i) => (
                      <span key={i} style={styles.aliasTag}>{ga.alias}</span>
                    ))
                  ) : (
                    <span style={{ fontSize: 13, opacity: 0.3 }}>No aliases configured</span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Quick Links */}
          <div className="profile-card" style={styles.card}>
            <h3 style={styles.cardTitle}><ExternalLink size={16} /> Quick Links</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <a href={`/players/${person.slug}`} target="_blank" rel="noopener noreferrer" style={styles.quickLink}>
                <Eye size={14} /> View Public Profile
              </a>
              {isManager && linkedPersonId !== resolvedPersonId && (
                <a href={`/admin/scrim-player-detail?personId=${resolvedPersonId}`} style={styles.quickLink}>
                  <Monitor size={14} /> View Scrim Stats
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
