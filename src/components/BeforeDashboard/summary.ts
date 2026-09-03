/**
 * Shared types and pure helpers for the admin dashboard. The API route builds a
 * DashboardSummary in one request; the dashboard renders it. No React or Payload
 * imports here so the helpers are unit-testable.
 */

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
}

export interface DepartmentFlags {
  isProductionStaff?: boolean | null
  isSocialMediaStaff?: boolean | null
  isGraphicsStaff?: boolean | null
  isVideoStaff?: boolean | null
  isEventsStaff?: boolean | null
  isScoutingStaff?: boolean | null
}

const FLAG_TO_DEPARTMENT: Array<[keyof DepartmentFlags, Department]> = [
  ['isProductionStaff', 'production'],
  ['isSocialMediaStaff', 'social-media'],
  ['isGraphicsStaff', 'graphics'],
  ['isVideoStaff', 'video'],
  ['isEventsStaff', 'events'],
  ['isScoutingStaff', 'scouting'],
]

/** Departments whose request queue this person should see. Managers see every department. */
export function departmentsFor(role: string | null | undefined, flags: DepartmentFlags | null | undefined): Department[] {
  if (role === 'admin' || role === 'staff-manager') return [...ALL_DEPARTMENTS]
  return FLAG_TO_DEPARTMENT.filter(([flag]) => flags?.[flag] === true).map(([, dept]) => dept)
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
