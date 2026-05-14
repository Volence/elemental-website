'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@payloadcms/ui'
import { useSearchParams } from 'next/navigation'
import {
  User as UserIcon, Save, Camera, Link as LinkIcon, Gamepad2, MessageSquare,
  Check, AlertCircle, Loader2, ExternalLink, Shield, ShieldCheck, Crown, Twitch, Instagram,
  Youtube, X, ArrowLeft, StickyNote, Eye, Plus, Trash2, Monitor, KeyRound,
} from 'lucide-react'
import type { Person } from '@/payload-types'

// ── Shared styles & constants ──

export const SOCIAL_PLATFORMS = [
  { key: 'twitter', label: 'Twitter / X', icon: X, placeholder: 'https://twitter.com/username' },
  { key: 'twitch', label: 'Twitch', icon: Twitch, placeholder: 'https://twitch.tv/username' },
  { key: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@channel' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/username' },
  { key: 'tiktok', label: 'TikTok', icon: Gamepad2, placeholder: 'https://tiktok.com/@username' },
] as const

export const ROLES = [
  { value: 'admin', label: 'Admin', icon: Crown, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)' },
  { value: 'staff-manager', label: 'Staff Manager', icon: ShieldCheck, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.25)' },
  { value: 'team-manager', label: 'Team Manager', icon: Shield, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)', border: 'rgba(6, 182, 212, 0.25)' },
  { value: 'player', label: 'Player', icon: Gamepad2, color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)', border: 'rgba(52, 211, 153, 0.25)' },
  { value: 'user', label: 'User', icon: UserIcon, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.25)' },
] as const

const DEPARTMENTS = [
  { key: 'isProductionStaff', label: 'Production' },
  { key: 'isSocialMediaStaff', label: 'Social Media' },
  { key: 'isGraphicsStaff', label: 'Graphics' },
  { key: 'isVideoStaff', label: 'Video Editing' },
  { key: 'isEventsStaff', label: 'Events' },
  { key: 'isScoutingStaff', label: 'Scouting' },
  { key: 'isContentCreator', label: 'Content Creator' },
  { key: 'isPugAdmin', label: 'PUG Admin' },
] as const

const PUG_ROLES = [
  { key: 'tank', label: 'Tank' },
  { key: 'flex-dps', label: 'Flex DPS' },
  { key: 'hitscan-dps', label: 'Hitscan DPS' },
  { key: 'flex-support', label: 'Flex Support' },
  { key: 'main-support', label: 'Main Support' },
] as const

const PUG_REGION_OPTIONS = [
  { key: 'na', label: 'NA' },
  { key: 'emea', label: 'EMEA' },
  { key: 'pacific', label: 'Pacific' },
] as const

const getRoleConfig = (role: string) => ROLES.find(r => r.value === role) ?? ROLES[4]

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
  .role-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; cursor: pointer; transition: all 0.15s; border: 2px solid transparent; }
  .role-option:hover { background: rgba(255,255,255,0.03); }
  .role-option.selected { border-color: currentColor; background: rgba(255,255,255,0.02); }
  .team-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 13px; cursor: pointer; transition: all 0.15s; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); }
  .team-chip:hover { background: rgba(255,255,255,0.06); }
  .team-chip.selected { background: rgba(52, 211, 153, 0.08); border-color: rgba(52, 211, 153, 0.3); color: #34d399; }
  .dept-toggle { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
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
  const { user } = useAuth<Person>()
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

  // Account & role fields
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('user')
  const [assignedTeams, setAssignedTeams] = useState<number[]>([])
  const [initialAssignedTeams, setInitialAssignedTeams] = useState<number[]>([])
  const [allTeams, setAllTeams] = useState<Array<{ id: number; name: string }>>([])
  const [departments, setDepartments] = useState<Record<string, boolean>>({})
  const [newPassword, setNewPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [passwordError, setPasswordError] = useState('')

  // PUG fields
  const [pugRegistered, setPugRegistered] = useState(false)
  const [pugTiers, setPugTiers] = useState<string[]>([])
  const [pugRegions, setPugRegions] = useState<string[]>([])
  const [pugApprovedRoles, setPugApprovedRoles] = useState<string[]>([])
  const [pugActiveBan, setPugActiveBan] = useState<{ bannedUntil?: string; reason?: string } | null>(null)
  const [pugSaveStatus, setPugSaveStatus] = useState<SaveStatus>('idle')

  // Resolve person ID and access level
  const resolvedPersonId = propPersonId ?? (user?.id ?? null)
  const isAdmin = user?.role === 'admin'
  const isSelf = user?.id != null && String(user.id) === String(resolvedPersonId)
  const canEditPug = isAdmin || (user as any)?.departments?.isPugAdmin === true

  // Fetch person data
  const fetchPerson = useCallback(async () => {
    if (!resolvedPersonId) return
    try {
      const [res, allTeamsRes] = await Promise.all([
        fetch(`/api/people/${resolvedPersonId}?depth=1`),
        fetch('/api/teams?limit=100&sort=name&depth=0'),
      ])

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

      // Account & role fields
      setEmail(data.email ?? '')
      setRole(data.role ?? 'user')
      const teamIds = (data.assignedTeams ?? []).map((t: any) => typeof t === 'object' ? t.id : t)
      setAssignedTeams(teamIds)
      setInitialAssignedTeams(teamIds)
      setDepartments({
        isProductionStaff: data.departments?.isProductionStaff ?? false,
        isSocialMediaStaff: data.departments?.isSocialMediaStaff ?? false,
        isGraphicsStaff: data.departments?.isGraphicsStaff ?? false,
        isVideoStaff: data.departments?.isVideoStaff ?? false,
        isEventsStaff: data.departments?.isEventsStaff ?? false,
        isScoutingStaff: data.departments?.isScoutingStaff ?? false,
        isContentCreator: data.departments?.isContentCreator ?? false,
        isPugAdmin: data.departments?.isPugAdmin ?? false,
      })

      // PUG fields
      if (data.pugTiers?.length) {
        setPugRegistered(true)
        setPugTiers(data.pugTiers ?? [])
        setPugRegions(data.pugInviteRegions ?? [])
        setPugApprovedRoles(data.pugApprovedRoles ?? [])
        setPugActiveBan(data.pugActiveBan ?? null)
      }

      if (data.photo && typeof data.photo === 'object' && data.photo.url) {
        setPhotoPreview(data.photo.url)
      }

      // All teams for admin chip selector
      if (allTeamsRes.ok) {
        const t = await allTeamsRes.json()
        setAllTeams((t.docs ?? []).map((doc: any) => ({ id: doc.id, name: doc.name })))
      }

      // Fetch roster team memberships for display
      const rosterRes = await fetch(`/api/teams?where[roster.person][equals]=${resolvedPersonId}&depth=0&limit=10`)
      if (rosterRes.ok) {
        const teamsData = await rosterRes.json()
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
        if (isAdmin) {
          payload.role = role
          payload.email = email
          const teamsChanged = JSON.stringify([...assignedTeams].sort()) !== JSON.stringify([...initialAssignedTeams].sort())
          if (teamsChanged) {
            payload.assignedTeams = assignedTeams.length > 0 ? assignedTeams : null
          }
          payload.departments = departments
        }
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

  // Team/dept/PUG toggles
  const toggleTeam = (teamId: number) => {
    setAssignedTeams(prev => prev.includes(teamId) ? prev.filter(t => t !== teamId) : [...prev, teamId])
  }
  const toggleDept = (key: string) => {
    setDepartments(prev => ({ ...prev, [key]: !prev[key] }))
  }
  const togglePugTier = (tier: string) => {
    setPugTiers(prev => prev.includes(tier) ? prev.filter(t => t !== tier) : [...prev, tier])
  }
  const togglePugRegion = (region: string) => {
    setPugRegions(prev => prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region])
  }
  const togglePugRole = (r: string) => {
    setPugApprovedRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }

  const handleResetPassword = async () => {
    if (!resolvedPersonId || !newPassword) return
    if (newPassword.length < 4) {
      setPasswordError('Password must be at least 4 characters')
      setPasswordStatus('error')
      return
    }
    setPasswordStatus('saving')
    setPasswordError('')
    try {
      const res = await fetch(`/api/people/${resolvedPersonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      if (!res.ok) throw new Error('Failed to reset password')
      setPasswordStatus('saved')
      setNewPassword('')
      setTimeout(() => setPasswordStatus('idle'), 2500)
    } catch (err: any) {
      setPasswordStatus('error')
      setPasswordError(err.message ?? 'Failed to reset password')
    }
  }

  const handlePugRegister = async () => {
    if (!resolvedPersonId) return
    setPugSaveStatus('saving')
    try {
      const res = await fetch(`/api/people/${resolvedPersonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pugTiers: ['open'], pugRegisteredDate: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error('Failed to register')
      const updated = await res.json()
      const pp = updated.doc ?? updated
      setPugRegistered(true)
      setPugTiers(pp.pugTiers ?? ['open'])
      setPugRegions(pp.pugInviteRegions ?? [])
      setPugApprovedRoles(pp.pugApprovedRoles ?? [])
      setPugSaveStatus('saved')
      setTimeout(() => setPugSaveStatus('idle'), 2500)
    } catch {
      setPugSaveStatus('error')
      setTimeout(() => setPugSaveStatus('idle'), 2500)
    }
  }

  const handlePugSave = async () => {
    if (!resolvedPersonId) return
    setPugSaveStatus('saving')
    try {
      const body: Record<string, unknown> = { pugTiers }
      if (pugTiers.includes('invite')) {
        body.pugInviteRegions = pugRegions
        body.pugApprovedRoles = pugApprovedRoles
      }
      const res = await fetch(`/api/people/${resolvedPersonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save PUG data')
      setPugSaveStatus('saved')
      setTimeout(() => setPugSaveStatus('idle'), 2500)
    } catch {
      setPugSaveStatus('error')
      setTimeout(() => setPugSaveStatus('idle'), 2500)
    }
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
                <span key={i} className="team-tag"><Shield size={12} />{t.name} - {t.role}</span>
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

          {/* Role (admin editable, others read-only) */}
          {(isAdmin || role) && (
            <div className="profile-card" style={styles.card}>
              <h3 style={styles.cardTitle}><Shield size={16} /> Role</h3>
              {isAdmin ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ROLES.map(r => (
                    <div
                      key={r.value}
                      className={`role-option ${role === r.value ? 'selected' : ''}`}
                      style={{ color: r.color }}
                      onClick={() => setRole(r.value)}
                    >
                      <r.icon size={18} />
                      <span style={{ fontWeight: role === r.value ? 600 : 400 }}>{r.label}</span>
                    </div>
                  ))}
                </div>
              ) : (() => {
                const rc = getRoleConfig(role)
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `2px solid ${rc.border}`, background: rc.bg }}>
                    <rc.icon size={18} color={rc.color} />
                    <span style={{ fontWeight: 600, color: rc.color }}>{rc.label}</span>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Assigned Teams */}
          {isAdmin ? (
            <div className="profile-card" style={styles.card}>
              <h3 style={styles.cardTitle}><Gamepad2 size={16} /> Assigned Teams</h3>
              <p style={styles.fieldHint}>Click to toggle. Determines scrim data access for players/managers.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {allTeams.map(t => (
                  <button
                    key={t.id}
                    className={`team-chip ${assignedTeams.includes(t.id) ? 'selected' : ''}`}
                    onClick={() => toggleTeam(t.id)}
                  >
                    {assignedTeams.includes(t.id) && <Check size={12} />}
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          ) : assignedTeams.length > 0 ? (
            <div className="profile-card" style={styles.card}>
              <h3 style={styles.cardTitle}><Gamepad2 size={16} /> Assigned Teams</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allTeams.filter(t => assignedTeams.includes(t.id)).map(t => (
                  <span key={t.id} className="team-chip selected">{t.name}</span>
                ))}
              </div>
            </div>
          ) : null}

          {/* PUG Status (admin/pug-admin manages, others see read-only) */}
          {(canEditPug || pugRegistered) && (
            <div className="profile-card" style={styles.card}>
              <h3 style={styles.cardTitle}><Gamepad2 size={16} /> PUG Status</h3>
              {!pugRegistered ? (
                <div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>Not registered for PUGs</p>
                  {canEditPug && (
                    <button
                      className="profile-save-btn"
                      onClick={handlePugRegister}
                      disabled={pugSaveStatus === 'saving'}
                      style={{ fontSize: 13, padding: '6px 14px' }}
                    >
                      {pugSaveStatus === 'saving' ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Registering...</>
                        : pugSaveStatus === 'saved' ? <><Check size={14} /> Registered!</>
                        : <><Plus size={14} /> Register for PUGs</>}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Registered Tiers</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['open', 'invite'].map((t) => (
                        <button
                          key={t}
                          className={`team-chip ${pugTiers.includes(t) ? 'selected' : ''}`}
                          onClick={canEditPug ? () => togglePugTier(t) : undefined}
                          style={{
                            cursor: canEditPug ? 'pointer' : 'default',
                            ...(pugTiers.includes(t) && t === 'invite' ? {
                              background: 'rgba(139, 92, 246, 0.15)',
                              borderColor: 'rgba(139, 92, 246, 0.4)',
                              color: '#a78bfa',
                            } : {}),
                          }}
                        >
                          {pugTiers.includes(t) && <Check size={12} />}
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {pugTiers.includes('invite') && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Invite Regions</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {PUG_REGION_OPTIONS.map((r) => (
                          <button
                            key={r.key}
                            className={`team-chip ${pugRegions.includes(r.key) ? 'selected' : ''}`}
                            onClick={canEditPug ? () => togglePugRegion(r.key) : undefined}
                            style={{ cursor: canEditPug ? 'pointer' : 'default' }}
                          >
                            {pugRegions.includes(r.key) && <Check size={12} />}
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {pugTiers.includes('invite') && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Approved Roles</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {PUG_ROLES.map((r) => (
                          <button
                            key={r.key}
                            className={`team-chip ${pugApprovedRoles.includes(r.key) ? 'selected' : ''}`}
                            onClick={canEditPug ? () => togglePugRole(r.key) : undefined}
                            style={{ cursor: canEditPug ? 'pointer' : 'default' }}
                          >
                            {pugApprovedRoles.includes(r.key) && <Check size={12} />}
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {pugActiveBan?.bannedUntil && new Date(pugActiveBan.bannedUntil) > new Date() && (
                    <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: '#f87171', fontWeight: 500 }}>
                        Banned until {new Date(pugActiveBan.bannedUntil).toLocaleString()}
                      </p>
                      {pugActiveBan.reason && (
                        <p style={{ fontSize: 11, color: 'rgba(248, 113, 113, 0.7)', marginTop: 2 }}>{pugActiveBan.reason}</p>
                      )}
                    </div>
                  )}

                  {canEditPug && (
                    <button
                      className="profile-save-btn"
                      onClick={handlePugSave}
                      disabled={pugSaveStatus === 'saving'}
                      style={{ fontSize: 13, padding: '6px 14px', marginTop: 4 }}
                    >
                      {pugSaveStatus === 'saving' ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
                        : pugSaveStatus === 'saved' ? <><Check size={14} /> Saved!</>
                        : pugSaveStatus === 'error' ? <><AlertCircle size={14} /> Error</>
                        : <><Save size={14} /> Save PUG Settings</>}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={styles.rightColumn}>
          {/* Account */}
          {(isAdmin || isSelf) && email && (
            <div className="profile-card" style={styles.card}>
              <h3 style={styles.cardTitle}><UserIcon size={16} /> Account</h3>
              <div style={styles.editableField}>
                <label style={styles.fieldLabel}>Email</label>
                {isAdmin ? (
                  <input className="profile-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
                ) : (
                  <span style={{ ...styles.readonlyValue, padding: '10px 0' }}>{email}</span>
                )}
              </div>
              {isSelf && (
                <div style={styles.editableField}>
                  {discordId ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, backgroundColor: 'rgba(88,101,242,0.1)', border: '1px solid rgba(88,101,242,0.3)' }}>
                      <svg width="14" height="11" viewBox="0 0 71 55" fill="#5865F2" xmlns="http://www.w3.org/2000/svg"><path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4875 44.2898 53.5547 44.3433C53.9101 44.6363 54.2823 44.9293 54.6573 45.2082C54.786 45.304 54.7776 45.5041 54.6377 45.5858C52.869 46.6197 51.0303 47.4931 49.0965 48.2228C48.9706 48.2707 48.9146 48.4172 48.9762 48.5383C50.038 50.6034 51.2554 52.5699 52.5765 54.435C52.632 54.5139 52.7327 54.5477 52.8251 54.5195C58.6257 52.7249 64.5084 50.0174 70.5813 45.5576C70.6344 45.5182 70.668 45.459 70.6736 45.3942C72.1672 29.9752 68.2139 16.6868 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978Z"/></svg>
                      <span style={{ fontSize: 13, color: '#e2e8f0' }}>Discord connected</span>
                    </div>
                  ) : (
                    <a
                      href={`/api/auth/discord?link=true&returnUrl=${encodeURIComponent(`/admin/edit-person?id=${resolvedPersonId}`)}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '8px 16px', borderRadius: 6, fontWeight: 500, color: '#fff', backgroundColor: '#5865F2', textDecoration: 'none', fontSize: 13, transition: 'background-color 0.15s' }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#4752C4')}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#5865F2')}
                    >
                      <svg width="14" height="11" viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4875 44.2898 53.5547 44.3433C53.9101 44.6363 54.2823 44.9293 54.6573 45.2082C54.786 45.304 54.7776 45.5041 54.6377 45.5858C52.869 46.6197 51.0303 47.4931 49.0965 48.2228C48.9706 48.2707 48.9146 48.4172 48.9762 48.5383C50.038 50.6034 51.2554 52.5699 52.5765 54.435C52.632 54.5139 52.7327 54.5477 52.8251 54.5195C58.6257 52.7249 64.5084 50.0174 70.5813 45.5576C70.6344 45.5182 70.668 45.459 70.6736 45.3942C72.1672 29.9752 68.2139 16.6868 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978Z"/></svg>
                      Connect Discord Account
                    </a>
                  )}
                </div>
              )}
              {(isAdmin || isSelf) && (
                <div style={styles.editableField}>
                  <label style={styles.fieldLabel}><KeyRound size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Reset Password</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="profile-input"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password..."
                      style={{ flex: 1 }}
                    />
                    <button
                      className="profile-save-btn"
                      onClick={handleResetPassword}
                      disabled={!newPassword || passwordStatus === 'saving'}
                      style={{ padding: '8px 16px', fontSize: 13, flexShrink: 0, opacity: !newPassword ? 0.4 : 1 }}
                    >
                      {passwordStatus === 'saving' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        : passwordStatus === 'saved' ? <><Check size={14} /> Done</>
                        : 'Reset'}
                    </button>
                  </div>
                  {passwordStatus === 'error' && passwordError && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{passwordError}</p>}
                  {passwordStatus === 'saved' && <p style={{ color: '#34d399', fontSize: 12, marginTop: 4 }}>Password updated successfully</p>}
                </div>
              )}
            </div>
          )}

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

          {/* Department Access */}
          {(() => {
            const showDepts = role !== 'admin' && role !== 'player'
            if (!showDepts) return null
            if (isAdmin) {
              return (
                <div className="profile-card" style={styles.card}>
                  <h3 style={styles.cardTitle}><Monitor size={16} /> Department Access</h3>
                  {DEPARTMENTS.map(d => (
                    <div className="dept-toggle" key={d.key}>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{d.label}</span>
                      <button
                        className={`toggle-switch ${departments[d.key] ? 'on' : 'off'}`}
                        onClick={() => toggleDept(d.key)}
                        type="button"
                      />
                    </div>
                  ))}
                </div>
              )
            }
            const activeDepts = DEPARTMENTS.filter(d => departments[d.key])
            if (activeDepts.length === 0) return null
            return (
              <div className="profile-card" style={styles.card}>
                <h3 style={styles.cardTitle}><Monitor size={16} /> Department Access</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {activeDepts.map(d => (
                    <span key={d.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 13, background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399' }}>
                      {d.label}
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Quick Links */}
          <div className="profile-card" style={styles.card}>
            <h3 style={styles.cardTitle}><ExternalLink size={16} /> Quick Links</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <a href={`/players/${person.slug}`} target="_blank" rel="noopener noreferrer" style={styles.quickLink}>
                <Eye size={14} /> View Public Profile
              </a>
              {isManager && user?.id !== resolvedPersonId && (
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
