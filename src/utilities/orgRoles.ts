/**
 * Single source of truth for organization staff roles.
 * Order = hierarchy/display order used everywhere (edit UI, public staff
 * page, Discord staff cards). Colors are the hex accents used by the
 * card-based staff editor chips. groupLabel is the heading used when
 * displaying a GROUP of people with that role (public staff page section
 * headings, Discord staff-card embeds) - it can differ from the singular
 * `label` used for an individual person's role.
 *
 * NOTE: keep in sync with the `roles` select options in
 * src/collections/OrganizationStaff/index.ts and the Postgres enum
 * `enum_organization_staff_roles` (migration required for new values).
 */
export const ORG_ROLES = [
  { value: 'owner', label: 'Owner', color: '#f59e0b', groupLabel: 'Owner' },
  { value: 'co-owner', label: 'Co-Owner', color: '#f59e0b', groupLabel: 'Co-Owner' },
  {
    value: 'administration',
    label: 'Administration',
    color: '#8b5cf6',
    groupLabel: 'Administration',
  },
  { value: 'hr', label: 'HR', color: '#ec4899', groupLabel: 'HR Staff' },
  { value: 'region-lead', label: 'Region Lead', color: '#14b8a6', groupLabel: 'Region Leads' },
  {
    value: 'event-manager',
    label: 'Event Manager',
    color: '#06b6d4',
    groupLabel: 'Event Manager',
  },
  {
    value: 'social-manager',
    label: 'Social Manager',
    color: '#3b82f6',
    groupLabel: 'Social Manager',
  },
  { value: 'marketing', label: 'Marketing', color: '#d946ef', groupLabel: 'Marketing' },
  { value: 'graphics', label: 'Graphics', color: '#f97316', groupLabel: 'Graphics Staff' },
  {
    value: 'media-editor',
    label: 'Media Editor',
    color: '#ef4444',
    groupLabel: 'Media Editor Staff',
  },
] as const

export type OrgRoleSlug = (typeof ORG_ROLES)[number]['value']

export const ORG_ROLE_ORDER: OrgRoleSlug[] = ORG_ROLES.map((r) => r.value)

export const ORG_ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ORG_ROLES.map((r) => [r.value, r.label]),
)

export const ORG_ROLE_GROUP_LABELS: Record<string, string> = Object.fromEntries(
  ORG_ROLES.map((r) => [r.value, r.groupLabel]),
)

/** Region options for the Region Lead role (matches the Payload `regions` field). */
export const ORG_REGIONS = [
  { value: 'na', label: 'NA' },
  { value: 'emea', label: 'EMEA' },
  { value: 'sa', label: 'SA' },
  { value: 'oce', label: 'OCE' },
  { value: 'apac', label: 'APAC' },
  { value: 'sea', label: 'SEA' },
] as const
