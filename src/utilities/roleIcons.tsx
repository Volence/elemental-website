import React from 'react'
import { 
  Shield, 
  Swords, 
  Heart, 
  Crown, 
  UserCheck, 
  Calendar, 
  Share2, 
  Image, 
  Film, 
  Users 
} from 'lucide-react'

/**
 * Centralized role icon utilities for both game roles and organization roles
 * Prevents duplication across components
 */

export type GameRole = 'tank' | 'dps' | 'support'
export type OrgRole = 'owner' | 'co-owner' | 'hr' | 'moderator' | 'event-manager' | 'social-manager' | 'graphics' | 'media-editor'
export type IconSize = 'sm' | 'md' | 'lg'

const sizeClasses: Record<IconSize, string> = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
}

/**
 * Get icon for game roles (tank, dps, support)
 * Used in team rosters and player pages
 */
export function getGameRoleIcon(role: string, size: IconSize = 'sm'): React.ReactNode {
  const sizeClass = sizeClasses[size]
  
  switch (role.toLowerCase()) {
    case 'tank':
      return <Shield className={`${sizeClass} text-blue-500`} />
    case 'dps':
      return <Swords className={`${sizeClass} text-red-500`} />
    case 'support':
      return <Heart className={`${sizeClass} text-green-500`} />
    default:
      return null
  }
}

/**
 * Get icon for organization roles (Owner, HR, Moderator, etc.)
 * Used in staff pages and organization staff pages
 */
export function getOrgRoleIcon(role: string, size: IconSize = 'sm'): React.ReactNode {
  const sizeClass = sizeClasses[size]
  
  // Normalize role string (handle both "Event Manager" and "event-manager")
  const roleLower = role.toLowerCase().replace(/\s+/g, '-')
  
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    'owner': Crown,
    'co-owner': Crown,
    'hr': UserCheck,
    'moderator': Shield,
    'event-manager': Calendar,
    'social-manager': Share2,
    'graphics': Image,
    'media-editor': Film,
  }
  
  const Icon = iconMap[roleLower] || Users
  return <Icon className={sizeClass} />
}

/**
 * Get color class for game roles
 * Used for styling role badges
 */
export function getGameRoleColor(role: string): string {
  switch (role.toLowerCase()) {
    case 'tank':
      return 'text-blue-500'
    case 'dps':
      return 'text-red-500'
    case 'support':
      return 'text-green-500'
    default:
      return 'text-muted-foreground'
  }
}

/**
 * Get background color class for game role badges
 */
export function getGameRoleBgColor(role: string): string {
  switch (role.toLowerCase()) {
    case 'tank':
      return 'bg-blue-500/10'
    case 'dps':
      return 'bg-red-500/10'
    case 'support':
      return 'bg-green-500/10'
    default:
      return 'bg-muted'
  }
}

/**
 * Get display label for organization roles
 * Converts kebab-case to Title Case
 */
export function getOrgRoleLabel(role: string): string {
  const labelMap: Record<string, string> = {
    'owner': 'Owner',
    'co-owner': 'Co-Owner',
    'hr': 'HR',
    'moderator': 'Moderator',
    'event-manager': 'Event Manager',
    'social-manager': 'Social Manager',
    'graphics': 'Graphics',
    'media-editor': 'Media Editor',
  }
  
  const roleLower = role.toLowerCase().replace(/\s+/g, '-')
  return labelMap[roleLower] || role
}

