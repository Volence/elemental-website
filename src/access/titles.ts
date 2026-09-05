/**
 * Single source of truth for staff titles, the departments they grant, lead labels,
 * and the role they imply. Replaces utilities/orgRoles.ts and the organization-staff /
 * production collections. Spec: docs/superpowers/specs/2026-09-05-titles-and-access-design.md
 */

export type TitleValue =
  | 'owner' | 'co-owner' | 'administration' | 'hr' | 'region-lead'
  | 'event-manager' | 'social-manager' | 'marketing' | 'graphics' | 'media-editor'
  | 'caster' | 'observer' | 'producer'
  | 'content-creator'

export type DepartmentKey = 'production' | 'social' | 'graphics' | 'video' | 'events' | 'pug' | 'scouting'
export type TitleGroup = 'organization' | 'department' | 'production' | 'community'
export type RoleValue = 'admin' | 'staff-manager' | 'user'

export interface TitleDef {
  value: TitleValue
  label: string
  group: TitleGroup
  departments: DepartmentKey[]
  leadLabel: string | null
  impliesRole: 'admin' | 'staff-manager' | null
}

export const TITLES: readonly TitleDef[] = [
  { value: 'owner', label: 'Owner', group: 'organization', departments: [], leadLabel: null, impliesRole: 'admin' },
  { value: 'co-owner', label: 'Co-Owner', group: 'organization', departments: [], leadLabel: null, impliesRole: 'admin' },
  { value: 'administration', label: 'Administration', group: 'organization', departments: [], leadLabel: null, impliesRole: 'admin' },
  { value: 'hr', label: 'HR', group: 'organization', departments: [], leadLabel: null, impliesRole: 'staff-manager' },
  { value: 'region-lead', label: 'Region Lead', group: 'organization', departments: [], leadLabel: null, impliesRole: null },
  { value: 'event-manager', label: 'Event Manager', group: 'department', departments: ['events', 'pug'], leadLabel: 'Events Lead', impliesRole: null },
  { value: 'social-manager', label: 'Social Manager', group: 'department', departments: ['social'], leadLabel: 'Social Media Lead', impliesRole: null },
  { value: 'marketing', label: 'Marketing', group: 'department', departments: ['social', 'graphics'], leadLabel: 'Marketing Lead', impliesRole: null },
  { value: 'graphics', label: 'Graphics', group: 'department', departments: ['graphics'], leadLabel: 'Graphics Lead', impliesRole: null },
  { value: 'media-editor', label: 'Media Editor', group: 'department', departments: ['video'], leadLabel: 'Media Editor Lead', impliesRole: null },
  { value: 'caster', label: 'Caster', group: 'production', departments: ['production'], leadLabel: 'Lead Caster', impliesRole: null },
  { value: 'observer', label: 'Observer', group: 'production', departments: ['production'], leadLabel: null, impliesRole: null },
  { value: 'producer', label: 'Producer', group: 'production', departments: ['production'], leadLabel: 'Lead Producer', impliesRole: null },
  { value: 'content-creator', label: 'Content Creator', group: 'community', departments: [], leadLabel: null, impliesRole: null },
]

export const TITLE_VALUES: TitleValue[] = TITLES.map((t) => t.value)
export const TITLE_BY_VALUE = Object.fromEntries(TITLES.map((t) => [t.value, t])) as Record<TitleValue, TitleDef>
export const TITLE_GROUP_LABELS: Record<TitleGroup, string> = {
  organization: 'Organization',
  department: 'Departments',
  production: 'Production',
  community: 'Community',
}
export function isTitleValue(v: unknown): v is TitleValue {
  return typeof v === 'string' && v in TITLE_BY_VALUE
}
export function titleLabel(entry: { title: TitleValue; isLead?: boolean | null }): string {
  const def = TITLE_BY_VALUE[entry.title]
  return entry.isLead && def.leadLabel ? def.leadLabel : def.label
}

export const DEPARTMENT_KEYS: DepartmentKey[] = ['production', 'social', 'graphics', 'video', 'events', 'pug', 'scouting']
export const DEPARTMENT_LABELS: Record<DepartmentKey, string> = {
  production: 'Production',
  social: 'Social Media',
  graphics: 'Graphics',
  video: 'Video Editing',
  events: 'Events',
  pug: 'PUG Admin',
  scouting: 'Scouting',
}
/** departments.* checkbox that grants member level for each department. */
export const DEPARTMENT_FLAG = {
  production: 'isProductionStaff',
  social: 'isSocialMediaStaff',
  graphics: 'isGraphicsStaff',
  video: 'isVideoStaff',
  events: 'isEventsStaff',
  pug: 'isPugAdmin',
  scouting: 'isScoutingStaff',
} as const satisfies Record<DepartmentKey, string>
export type DepartmentFlag = (typeof DEPARTMENT_FLAG)[DepartmentKey]

/** Every departments.* checkbox, in editor order. `department` is null for the two standalone flags. */
export const EXTRA_FLAGS: Array<{ key: string; label: string; department: DepartmentKey | null }> = [
  { key: 'isProductionStaff', label: 'Production', department: 'production' },
  { key: 'isSocialMediaStaff', label: 'Social Media', department: 'social' },
  { key: 'isGraphicsStaff', label: 'Graphics', department: 'graphics' },
  { key: 'isVideoStaff', label: 'Video Editing', department: 'video' },
  { key: 'isEventsStaff', label: 'Events', department: 'events' },
  { key: 'isScoutingStaff', label: 'Scouting', department: 'scouting' },
  { key: 'isContentCreator', label: 'Content Creator (who is live)', department: null },
  { key: 'isPugAdmin', label: 'PUG Admin', department: 'pug' },
  { key: 'canUploadExternalScrims', label: 'External scrim uploader', department: null },
]

export const REGIONS = [
  { value: 'na', label: 'North America' },
  { value: 'emea', label: 'EMEA' },
  { value: 'sa', label: 'South America' },
  { value: 'oce', label: 'Oceania' },
  { value: 'apac', label: 'APAC' },
  { value: 'sea', label: 'SEA' },
] as const
export type RegionValue = (typeof REGIONS)[number]['value']

export const ROLE_VALUES: RoleValue[] = ['admin', 'staff-manager', 'user']
export const ROLE_LABELS: Record<RoleValue, string> = { admin: 'Admin', 'staff-manager': 'Staff Manager', user: 'User' }
export function isRoleValue(v: unknown): v is RoleValue {
  return v === 'admin' || v === 'staff-manager' || v === 'user'
}

// ---- compatibility with the deleted utilities/orgRoles.ts --------------------------
// The ten "organization staff" roles in the order the public page and Discord cards use.
const ORG_TITLES = TITLES.filter((t) => t.group === 'organization' || t.group === 'department')
export type OrgRoleSlug = (typeof ORG_TITLES)[number]['value']
export const ORG_ROLE_ORDER: OrgRoleSlug[] = ORG_TITLES.map((t) => t.value) as OrgRoleSlug[]
export const ORG_ROLE_LABELS: Record<string, string> = Object.fromEntries(ORG_TITLES.map((t) => [t.value, t.label]))
// Discord card group headings, carried over from the old orgRoles.ts unchanged.
export const ORG_ROLE_GROUP_LABELS: Record<string, string> = {
  owner: 'Owner',
  'co-owner': 'Co-Owner',
  administration: 'Administration',
  hr: 'HR Staff',
  'region-lead': 'Region Leads',
  'event-manager': 'Event Manager',
  'social-manager': 'Social Manager',
  marketing: 'Marketing',
  graphics: 'Graphics Staff',
  'media-editor': 'Media Editor Staff',
}
/** Accent colours the old constant carried; kept for the staff directory and public sections. */
export const TITLE_COLORS: Record<string, string> = {
  owner: '#f59e0b', 'co-owner': '#f59e0b', administration: '#8b5cf6', hr: '#ec4899', 'region-lead': '#14b8a6',
  'event-manager': '#06b6d4', 'social-manager': '#3b82f6', marketing: '#d946ef', graphics: '#f97316', 'media-editor': '#ef4444',
  caster: '#a855f7', observer: '#3b82f6', producer: '#eab308', 'content-creator': '#22c55e',
}
export const ORG_ROLES = ORG_TITLES.map((t) => ({ value: t.value, label: t.label, color: TITLE_COLORS[t.value], groupLabel: ORG_ROLE_GROUP_LABELS[t.value] }))
export const ORG_REGIONS = REGIONS.map((r) => ({ value: r.value, label: r.label }))
