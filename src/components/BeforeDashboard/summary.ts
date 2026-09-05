/**
 * Shared types and pure helpers for the admin dashboard. The API route builds a
 * DashboardSummary in one request; the dashboard renders it. No React or Payload
 * imports here so the helpers are unit-testable. `DEPARTMENT_KEYS`/`DepartmentKey` are
 * plain-data imports from `@/access/titles` (also React/Payload-free).
 */
import { DEPARTMENT_KEYS, type DepartmentKey } from '@/access/titles'

export type Department = 'production' | 'social-media' | 'graphics' | 'video' | 'events' | 'scouting'

export const ALL_DEPARTMENTS: Department[] = ['production', 'social-media', 'graphics', 'video', 'events', 'scouting']

export const DEPARTMENT_LABEL: Record<Department, string> = {
  production: 'Production',
  'social-media': 'Social Media',
  graphics: 'Graphics',
  video: 'Video',
  events: 'Events',
  scouting: 'Scouting',
}

export interface TaskLite {
  id: number
  title: string
  department: Department | null
  status: 'backlog' | 'in-progress' | 'review' | 'complete' | string
  priority: 'low' | 'medium' | 'high' | 'urgent' | string | null
  dueDate: string | null
  isRequest: boolean
  requestedByDepartment: string | null
}

export interface MatchLite {
  id: number
  title: string
  date: string
  league: string | null
  region: string | null
  status: string | null
}

export interface EventLite {
  id: number
  title: string
  date: string
  eventType: string | null
  region: string | null
}

export interface ScrimLite {
  id: number
  name: string
  date: string
  mapCount: number
  firstMapDataId: number | null
}

export interface AttentionCounts {
  unresolvedErrors: number
  failedCronRuns24h: number
  overdueTasks: number
}

export interface DashboardSummary {
  generatedAt: string
  viewer: { id: number; name: string | null; role: string | null }
  tasks: {
    mine: TaskLite[]
    overdueMine: number
    requests: TaskLite[]
  }
  upcoming: {
    matches: MatchLite[]
    events: EventLite[]
    windowDays: number
  }
  recentScrims: ScrimLite[] | null
  attention: AttentionCounts | null
  /** Me > Guides: how many guides fit this viewer and whether they hid the card. */
  guides: { available: number; dismissed: boolean } | null
}

/** The slice of ResolvedAccess this needs - kept structural so this stays a pure, dependency-light module. */
export interface DepartmentAccessLike {
  canManagePeople: boolean
  departments: Record<DepartmentKey, 'none' | 'member' | 'lead'>
}

// DEPARTMENT_KEYS (the access model) -> this dashboard's task department names. 'pug' has no
// task department here.
const DEPT_KEY_TO_TASK_DEPARTMENT: Partial<Record<DepartmentKey, Department>> = {
  production: 'production',
  social: 'social-media',
  graphics: 'graphics',
  video: 'video',
  events: 'events',
  scouting: 'scouting',
}

/** Departments whose request queue this person should see. Managers see every department. */
export function departmentsFor(access: DepartmentAccessLike | null | undefined): Department[] {
  if (!access) return []
  if (access.canManagePeople) return [...ALL_DEPARTMENTS]
  return DEPARTMENT_KEYS.filter((k) => access.departments[k] !== 'none')
    .map((k) => DEPT_KEY_TO_TASK_DEPARTMENT[k])
    .filter((d): d is Department => d !== undefined)
}

/**
 * Time-of-day greeting from the viewer's local hour. Pass null until the component has
 * mounted: the server does not know the viewer's clock, and rendering a server guess
 * caused a hydration mismatch.
 */
export function greeting(hour: number | null, name: string | null | undefined): string {
  const part =
    hour === null ? 'Welcome back' : hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return name ? `${part}, ${name}` : part
}

export type UpcomingItem =
  | { kind: 'match'; date: string; id: number; title: string; subtitle: string }
  | { kind: 'event'; date: string; id: number; title: string; subtitle: string }

/** One chronological list for the "Coming up" card. */
export function mergeUpcoming(matches: MatchLite[], events: EventLite[], limit = 8): UpcomingItem[] {
  const items: UpcomingItem[] = [
    ...matches.map((m) => ({
      kind: 'match' as const,
      date: m.date,
      id: m.id,
      title: m.title,
      subtitle: [m.league, m.region].filter(Boolean).join(' · ') || 'Match',
    })),
    ...events.map((e) => ({
      kind: 'event' as const,
      date: e.date,
      id: e.id,
      title: e.title,
      subtitle: [e.eventType, e.region].filter(Boolean).join(' · ') || 'Event',
    })),
  ]
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(0, limit)
}

export function isOverdue(task: Pick<TaskLite, 'dueDate' | 'status'>, now: number = Date.now()): boolean {
  if (!task.dueDate || task.status === 'complete') return false
  return new Date(task.dueDate).getTime() < now
}
