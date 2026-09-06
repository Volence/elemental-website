/**
 * The one answer to "what may this person do". Pure: (person, teams) -> ResolvedAccess.
 * Rules (spec Section 2): admin/staff-manager lead everywhere and manage every team; titles grant
 * member level, isLead raises to lead; extra-access flags grant member level; team access is the
 * union of manager/coach/captain membership, Region Lead regions, and the teamAccess list.
 */
import {
  DEPARTMENT_FLAG, DEPARTMENT_KEYS, TITLE_BY_VALUE, isTitleValue, isRoleValue,
  type DepartmentKey, type RoleValue, type TitleValue,
} from './titles'

export type Level = 'none' | 'member' | 'lead'
export type TeamReason = 'manager' | 'coach' | 'captain' | 'region-lead' | 'access-only' | 'staff'

export interface TitleEntry { title: TitleValue; isLead?: boolean | null; regions?: string[] | null }

type Rel = number | string | { id: number | string } | null | undefined

export interface AccessPersonInput {
  id: number | string
  role?: string | null
  titles?: Array<Partial<TitleEntry> & { title?: string | null }> | null
  departments?: Record<string, boolean | null | undefined> | null
  teamAccess?: Array<Rel> | null
}

export interface AccessTeamInput {
  id: number
  region?: string | null
  manager?: Array<{ person?: Rel }> | null
  coaches?: Array<{ person?: Rel }> | null
  captain?: Array<{ person?: Rel }> | null
}

export interface ResolvedAccess {
  personId: number
  role: RoleValue
  titles: TitleEntry[]
  departments: Record<DepartmentKey, Level>
  teamIds: Set<number>
  teamReasons: Record<number, TeamReason[]>
  isAdmin: boolean
  isStaffManager: boolean
  canManagePeople: boolean
  canPickMembers: boolean
  canUploadExternalScrims: boolean
  isContentCreator: boolean
  leadDepartments: DepartmentKey[]
}

export interface SerializedAccess extends Omit<ResolvedAccess, 'teamIds'> { teamIds: number[] }

const LEVEL_RANK: Record<Level, number> = { none: 0, member: 1, lead: 2 }
const ROLE_RANK: Record<RoleValue, number> = { user: 0, 'staff-manager': 1, admin: 2 }

export function roleRank(role: string | null | undefined): number {
  return isRoleValue(role) ? ROLE_RANK[role] : 0
}

export function relId(v: Rel): number | null {
  if (v === null || v === undefined) return null
  const raw = typeof v === 'object' ? v.id : v
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Drops malformed entries and unknown titles; keeps order. */
export function normalizeTitles(titles: AccessPersonInput['titles']): TitleEntry[] {
  const out: TitleEntry[] = []
  for (const t of titles ?? []) {
    if (!t || !isTitleValue(t.title)) continue
    const def = TITLE_BY_VALUE[t.title]
    out.push({
      title: t.title,
      isLead: Boolean(t.isLead) && def.leadLabel !== null,
      regions: t.title === 'region-lead' ? (t.regions ?? []).map((r) => String(r).toLowerCase()) : undefined,
    })
  }
  return out
}

export function impliedRole(titles: AccessPersonInput['titles']): 'admin' | 'staff-manager' | null {
  let best: 'admin' | 'staff-manager' | null = null
  for (const t of normalizeTitles(titles)) {
    const implied = TITLE_BY_VALUE[t.title].impliesRole
    if (implied === 'admin') return 'admin'
    if (implied === 'staff-manager') best = 'staff-manager'
  }
  return best
}

function raise(levels: Record<DepartmentKey, Level>, key: DepartmentKey, to: Level): void {
  if (LEVEL_RANK[to] > LEVEL_RANK[levels[key]]) levels[key] = to
}

export function resolveAccess(person: AccessPersonInput, teams: AccessTeamInput[]): ResolvedAccess {
  const personId = Number(person.id)
  const titles = normalizeTitles(person.titles)
  const flags = person.departments ?? {}

  // Role: stored role or the highest title-implied role.
  const stored: RoleValue = isRoleValue(person.role) ? person.role : 'user'
  const implied = impliedRole(titles)
  const role: RoleValue = implied && ROLE_RANK[implied] > ROLE_RANK[stored] ? implied : stored
  const isAdmin = role === 'admin'
  const isStaffManager = role === 'staff-manager'
  const staff = isAdmin || isStaffManager

  // Departments.
  const departments = Object.fromEntries(DEPARTMENT_KEYS.map((k) => [k, 'none'])) as Record<DepartmentKey, Level>
  if (staff) {
    for (const k of DEPARTMENT_KEYS) departments[k] = 'lead'
  } else {
    for (const t of titles) {
      for (const k of TITLE_BY_VALUE[t.title].departments) raise(departments, k, t.isLead ? 'lead' : 'member')
    }
    for (const k of DEPARTMENT_KEYS) {
      if (flags[DEPARTMENT_FLAG[k]] === true) raise(departments, k, 'member')
    }
  }
  // Staff (admin/staff-manager) are excluded here even though every department reads 'lead' for
  // them: leadDepartments feeds canApplyPersonChange's department-lead grant path, which staff
  // never go through (they already short-circuit via canManagePeople).
  const leadDepartments = DEPARTMENT_KEYS.filter((k) => departments[k] === 'lead' && !staff)

  // Teams.
  const teamIds = new Set<number>()
  const teamReasons: Record<number, TeamReason[]> = {}
  const add = (teamId: number, reason: TeamReason) => {
    teamIds.add(teamId)
    const reasons = (teamReasons[teamId] ??= [])
    if (!reasons.includes(reason)) reasons.push(reason)
  }
  if (staff) {
    for (const t of teams) add(t.id, 'staff')
  } else {
    const has = (arr: Array<{ person?: Rel }> | null | undefined) => (arr ?? []).some((e) => relId(e?.person) === personId)
    const regions = new Set(titles.filter((t) => t.title === 'region-lead').flatMap((t) => t.regions ?? []))
    for (const t of teams) {
      if (has(t.manager)) add(t.id, 'manager')
      if (has(t.coaches)) add(t.id, 'coach')
      if (has(t.captain)) add(t.id, 'captain')
      if (t.region && regions.has(String(t.region).toLowerCase())) add(t.id, 'region-lead')
    }
    for (const rel of person.teamAccess ?? []) {
      const id = relId(rel)
      if (id !== null) add(id, 'access-only')
    }
  }

  const anyDepartment = DEPARTMENT_KEYS.some((k) => departments[k] !== 'none')
  return {
    personId,
    role,
    titles,
    departments,
    teamIds,
    teamReasons,
    isAdmin,
    isStaffManager,
    canManagePeople: staff,
    canPickMembers: staff || teamIds.size > 0 || anyDepartment,
    canUploadExternalScrims: staff || flags.canUploadExternalScrims === true,
    isContentCreator: titles.some((t) => t.title === 'content-creator') || flags.isContentCreator === true,
    leadDepartments,
  }
}

export function hasDepartment(a: ResolvedAccess, key: DepartmentKey, level: Level = 'member'): boolean {
  return LEVEL_RANK[a.departments[key]] >= LEVEL_RANK[level]
}

export function canManageTeam(a: ResolvedAccess, teamId: number | string): boolean {
  return a.teamIds.has(Number(teamId))
}

export function serializeAccess(a: ResolvedAccess): SerializedAccess {
  return { ...a, teamIds: [...a.teamIds] }
}
export function deserializeAccess(s: SerializedAccess): ResolvedAccess {
  return { ...s, teamIds: new Set(s.teamIds) }
}

// ---- department-lead grants --------------------------------------------------------

export interface PersonAccessFields {
  role?: string | null
  titles?: AccessPersonInput['titles']
  departments?: Record<string, boolean | null | undefined> | null
  teamAccess?: Array<Rel> | null
}

const titleKey = (t: TitleEntry) => `${t.title}|${t.isLead ? 1 : 0}|${(t.regions ?? []).slice().sort().join(',')}`

function diffTitles(before: TitleEntry[], after: TitleEntry[]): { added: TitleEntry[]; removed: TitleEntry[] } {
  const b = new Map(before.map((t) => [titleKey(t), t]))
  const a = new Map(after.map((t) => [titleKey(t), t]))
  return {
    added: [...a.entries()].filter(([k]) => !b.has(k)).map(([, t]) => t),
    removed: [...b.entries()].filter(([k]) => !a.has(k)).map(([, t]) => t),
  }
}

/**
 * May `actor` turn `before` into `after`? Admin and staff-manager: anything. A department lead:
 * only member (non-lead, non-role-implying, non-region) titles whose departments are all within
 * the actor's lead departments, plus those departments' extra-access flags. Everyone else: nothing.
 * Callers should still pass full snapshots for `before` and `after`; an `undefined` field on
 * `after` (role, titles, departments, teamAccess) means "unchanged from `before`", distinct from
 * an explicit empty value (e.g. `titles: []`), which is a real change to be checked.
 */
export function canApplyPersonChange(actor: ResolvedAccess, before: PersonAccessFields, after: PersonAccessFields): { ok: true } | { ok: false; reason: string } {
  if (actor.canManagePeople) return { ok: true }

  const roleBefore = isRoleValue(before.role) ? before.role : 'user'
  const roleAfter = after.role === undefined ? roleBefore : isRoleValue(after.role) ? after.role : 'user'
  if (roleBefore !== roleAfter) return { ok: false, reason: 'Only staff managers and admins can change roles' }

  const teamsBefore = (before.teamAccess ?? []).map(relId).filter((x): x is number => x !== null).sort()
  const teamsAfter = (after.teamAccess === undefined ? before.teamAccess ?? [] : after.teamAccess ?? []).map(relId).filter((x): x is number => x !== null).sort()
  if (JSON.stringify(teamsBefore) !== JSON.stringify(teamsAfter)) return { ok: false, reason: 'Only staff managers and admins can change team access' }

  const lead = new Set(actor.leadDepartments)
  const titlesAfter = after.titles === undefined ? before.titles : after.titles
  const { added, removed } = diffTitles(normalizeTitles(before.titles), normalizeTitles(titlesAfter))
  for (const t of [...added, ...removed]) {
    const def = TITLE_BY_VALUE[t.title]
    if (t.isLead) return { ok: false, reason: 'Only staff managers and admins can set lead flags' }
    if (def.impliesRole) return { ok: false, reason: `Only staff managers and admins can assign ${def.label}` }
    if (t.title === 'region-lead') return { ok: false, reason: 'Only staff managers and admins can assign Region Lead' }
    // Titles with no department (e.g. Content Creator) are not owned by any department lead;
    // only staff managers and admins may grant or revoke them.
    if (def.departments.length === 0) return { ok: false, reason: `Only staff managers and admins can assign ${def.label}` }
    if (!def.departments.every((d) => lead.has(d))) {
      return { ok: false, reason: `You do not lead every department that ${def.label} grants` }
    }
  }

  const fb = before.departments ?? {}
  const fa = after.departments === undefined ? fb : after.departments ?? {}
  for (const key of new Set([...Object.keys(fb), ...Object.keys(fa)])) {
    if (Boolean(fb[key]) === Boolean(fa[key])) continue
    const dept = (Object.keys(DEPARTMENT_FLAG) as DepartmentKey[]).find((d) => DEPARTMENT_FLAG[d] === key)
    if (!dept || !lead.has(dept)) return { ok: false, reason: `You cannot change ${key}` }
  }

  return { ok: true }
}

/**
 * Who may see the scrim admin surfaces: staff, anyone with team access, or an external-scrim
 * uploader. Pure and dependency-free (no next/headers, no payload) so it is safe to import
 * from a 'use client' component - scrimScope.ts, serverAccess.ts, and
 * ScrimAnalyticsTabs/access.ts all re-export/import this single definition rather than keeping
 * their own copies.
 */
export function hasScrimAccess(a: ResolvedAccess | null | undefined): boolean {
  return !!a && (a.canManagePeople || a.teamIds.size > 0 || a.canUploadExternalScrims)
}
