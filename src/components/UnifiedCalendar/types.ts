export type CalendarItemType = 'task' | 'social-post' | 'match' | 'calendar-event'

export type Department = 
  | 'graphics' 
  | 'video' 
  | 'events' 
  | 'scouting' 
  | 'production' 
  | 'social-media'
  | 'competitive'

export interface CalendarItem {
  id: string
  type: CalendarItemType
  title: string
  date: Date
  dateEnd?: Date // For multi-day events
  department: Department
  status?: string
  priority?: string
  href: string
  meta?: Record<string, unknown>
}

export const DEPARTMENTS: { value: Department; label: string; color: string }[] = [
  { value: 'graphics', label: 'Graphics', color: '#06b6d4' },
  { value: 'video', label: 'Video', color: '#8b5cf6' },
  { value: 'events', label: 'Events', color: '#10b981' },
  { value: 'scouting', label: 'Scouting', color: '#f59e0b' },
  { value: 'production', label: 'Production', color: '#3b82f6' },
  { value: 'social-media', label: 'Social Media', color: '#ec4899' },
  { value: 'competitive', label: 'Competitive', color: '#fbbf24' },
]

export function getDepartmentColor(department: Department): string {
  return DEPARTMENTS.find(d => d.value === department)?.color ?? '#64748b'
}

// Get full color set for clean glow styling
export function getDepartmentColors(department: Department): {
  primary: string;
  bg: string;
  bgHover: string;
  text: string;
  glow: string;
} {
  const color = getDepartmentColor(department)
  // Convert hex to RGB for transparent versions
  const hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  return {
    primary: color,
    bg: `rgba(${r}, ${g}, ${b}, 0.35)`,
    bgHover: `rgba(${r}, ${g}, ${b}, 0.55)`,
    text: color, // Use primary color for text
    glow: `rgba(${r}, ${g}, ${b}, 0.25)`,
  }
}

// Map departments to their dashboard/kanban board URLs
export function getDepartmentDashboardUrl(department: Department): string {
  const dashboardMap: Record<Department, string> = {
    'graphics': '/admin/collections/graphics-anchor?limit=10',
    'video': '/admin/collections/video-anchor?limit=10',
    'events': '/admin/collections/events-anchor?limit=10',
    'scouting': '/admin/globals/scouting-dashboard',
    'production': '/admin/globals/production-dashboard',
    'social-media': '/admin/globals/social-media-settings',
    'competitive': '/admin/collections/global-calendar-events',
  }
  return dashboardMap[department] ?? '/admin'
}
