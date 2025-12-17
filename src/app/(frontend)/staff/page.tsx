import type { Metadata } from 'next'
import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getAllTeams } from '@/utilities/getTeams'
import { SocialLinks } from '@/components/SocialLinks'
import { Users, Mic, Eye, Video, Shield, Crown, UserCheck, MessageSquare, Calendar, Share2, Image, Film } from 'lucide-react'
import Link from 'next/link'
import { formatPlayerSlug } from '@/utilities/getPlayer'
import { getPersonNameFromRelationship, isPopulatedPerson, getSocialLinksFromPerson } from '@/utilities/personHelpers'

export const dynamic = 'force-dynamic' // Always render dynamically to fetch fresh data

export const metadata: Metadata = {
  title: 'Staff | Elemental (ELMT)',
  description: 'Meet the staff behind Elemental - managers, coaches, captains, and production team.',
  openGraph: {
    title: 'Staff | Elemental (ELMT)',
    description: 'Meet the staff behind Elemental - managers, coaches, captains, and production team.',
  },
}

interface StaffMember {
  name: string
  twitter?: string
  twitch?: string
  youtube?: string
  instagram?: string
}

// Deduplicate staff members by name, merging social links
function deduplicateStaff(staff: StaffMember[]): StaffMember[] {
  const map = new Map<string, StaffMember>()
  
  staff.forEach((member) => {
    const existing = map.get(member.name)
    if (existing) {
      // Merge social links, preferring non-empty values
      map.set(member.name, {
        name: member.name,
        twitter: member.twitter || existing.twitter,
        twitch: member.twitch || existing.twitch,
        youtube: member.youtube || existing.youtube,
        instagram: member.instagram || existing.instagram,
      })
    } else {
      map.set(member.name, member)
    }
  })
  
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

// Helper to extract name from person relationship
function getStaffName(staff: any): string {
  const personName = getPersonNameFromRelationship(staff.person)
  if (personName) {
    return personName
  }
  // Fallback for legacy data or if person not populated
  return staff.name || staff.slug || 'Unknown'
}

// Group production staff by type
function groupProductionStaff(productionStaff: any[]) {
  const grouped: Record<string, any[]> = {
    'Caster': [],
    'Observer': [],
    'Producer': [],
    'Observer/Producer': [],
    'Observer/Producer/Caster': [],
  }
  
  const typeLabels: Record<string, string> = {
    'caster': 'Caster',
    'observer': 'Observer',
    'producer': 'Producer',
    'observer-producer': 'Observer/Producer',
    'observer-producer-caster': 'Observer/Producer/Caster',
  }
  
  productionStaff.forEach((staff) => {
    const typeLabel = typeLabels[staff.type] || staff.type
    if (grouped[typeLabel]) {
      grouped[typeLabel].push(staff)
    } else {
      grouped[typeLabel] = [staff]
    }
  })
  
  // Sort each group by name (extracted from person relationship)
  Object.keys(grouped).forEach((key) => {
    grouped[key].sort((a, b) => getStaffName(a).localeCompare(getStaffName(b)))
  })
  
  return grouped
}

// Group organization staff by role
function groupOrganizationStaff(orgStaff: any[]) {
  const grouped: Record<string, any[]> = {
    'Owner': [],
    'Co-Owner': [],
    'HR': [],
    'Moderator': [],
    'Event Manager': [],
    'Social Manager': [],
    'Graphics': [],
    'Media Editor': [],
  }
  
  const roleLabels: Record<string, string> = {
    'owner': 'Owner',
    'co-owner': 'Co-Owner',
    'hr': 'HR',
    'moderator': 'Moderator',
    'event-manager': 'Event Manager',
    'social-manager': 'Social Manager',
    'graphics': 'Graphics',
    'media-editor': 'Media Editor',
  }
  
  orgStaff.forEach((staff) => {
    // Handle both single role (old data) and multiple roles (new data)
    const roles = Array.isArray(staff.roles) ? staff.roles : (staff.role ? [staff.role] : [])
    
    roles.forEach((role: string) => {
      const roleLabel = roleLabels[role] || role
      if (grouped[roleLabel]) {
        // Only add if not already in the group (avoid duplicates)
        if (!grouped[roleLabel].find((s: any) => s.id === staff.id)) {
          grouped[roleLabel].push(staff)
        }
      } else {
        grouped[roleLabel] = [staff]
      }
    })
  })
  
  // Sort each group by name (extracted from person relationship)
  Object.keys(grouped).forEach((key) => {
    grouped[key].sort((a, b) => getStaffName(a).localeCompare(getStaffName(b)))
  })
  
  return grouped
}

const getRoleIcon = (role: string) => {
  const iconMap: Record<string, any> = {
    'Owner': Crown,
    'Co-Owner': Crown,
    'HR': UserCheck,
    'Moderator': Shield,
    'Event Manager': Calendar,
    'Social Manager': Share2,
    'Graphics': Image,
    'Media Editor': Film,
  }
  return iconMap[role] || Users
}

export default async function StaffPage() {
  // Page is force-dynamic, so it always renders at runtime with fresh data
  try {
    const allTeams = await getAllTeams()
    const payload = await getPayload({ config: configPromise })
    
    // Aggregate staff from all teams
    const allManagers: StaffMember[] = []
    const allCoaches: StaffMember[] = []
    const allCaptains: StaffMember[] = []
    
    allTeams.forEach((team) => {
      if (team.manager && team.manager.length > 0) {
        allManagers.push(...team.manager)
      }
      if (team.coaches && team.coaches.length > 0) {
        allCoaches.push(...team.coaches)
      }
      if (team.captain && team.captain.length > 0) {
        allCaptains.push(...team.captain)
      }
    })
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Staff Page] Debug info:', {
        totalTeams: allTeams.length,
        managersBeforeFilter: allManagers.length,
        coachesBeforeFilter: allCoaches.length,
        captainsBeforeFilter: allCaptains.length,
        sampleTeam: allTeams[0] ? {
          name: allTeams[0].name,
          managerCount: allTeams[0].manager?.length || 0,
          coachesCount: allTeams[0].coaches?.length || 0,
          captainCount: allTeams[0].captain?.length || 0,
        } : null,
      })
    }
    
    // Filter out entries with empty names (person relationship not populated)
    const validManagers = allManagers.filter(m => m.name && m.name.trim() !== '')
    const validCoaches = allCoaches.filter(c => c.name && c.name.trim() !== '')
    const validCaptains = allCaptains.filter(c => c.name && c.name.trim() !== '')
    
    // Deduplicate staff
    const managers = deduplicateStaff(validManagers)
    const coaches = deduplicateStaff(validCoaches)
    const captains = deduplicateStaff(validCaptains)
    
    
    // Fetch production staff (with person relationship populated)
    const productionResult = await payload.find({
      collection: 'production',
      limit: 1000,
      pagination: false,
      depth: 1, // Populate person relationship
    })
    
    const productionStaff = productionResult.docs
    const groupedProduction = groupProductionStaff(productionStaff)
    
    // Fetch organization staff (with person relationship populated)
    const orgStaffResult = await payload.find({
      collection: 'organization-staff',
      limit: 1000,
      pagination: false,
      depth: 1, // Populate person relationship
    })
    
    const orgStaff = orgStaffResult.docs
    const groupedOrgStaff = groupOrganizationStaff(orgStaff)
  
  const getTypeIcon = (type: string) => {
    if (type === 'Observer') return Eye
    if (type === 'Producer') return Video
    if (type === 'Observer/Producer' || type === 'Observer/Producer/Caster') return Video
    return Mic // Default to Mic for Caster
  }

  return (
    <div className="pt-24 pb-24 min-h-screen">
      <div className="container mb-16">
        <div className="prose dark:prose-invert max-w-none">
          <h1 className="tracking-tight">Staff</h1>
          <p className="text-lg text-muted-foreground">
            Meet the dedicated staff members who make Elemental possible - from team management to production.
          </p>
        </div>
      </div>

      <div className="container space-y-12">
        {/* Individual Role Categories */}
        {(() => {
          // Define the order for role categories
          const roleOrder = ['Owner', 'Co-Owner', 'HR', 'Moderator', 'Graphics', 'Event Manager', 'Social Manager', 'Media Editor']
          
          return roleOrder.map((role) => {
            const staff = groupedOrgStaff[role]
            if (!staff || staff.length === 0) return null
            
            const Icon = getRoleIcon(role)
            const displayName = role === 'Graphics' ? 'Graphics Staff' : 
                              role === 'Media Editor' ? 'Media Editor Staff' : 
                              role === 'HR' ? 'HR Staff' : 
                              role
            
            return (
              <div key={role}>
                <div className="mb-6">
                  <h2 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight flex items-center gap-3">
                    <Icon className="w-8 h-8" />
                    {displayName}
                  </h2>
                  <div className="w-24 h-1 bg-primary" />
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {staff.map((member) => {
                    const name = getStaffName(member)
                    const person = isPopulatedPerson(member.person) ? member.person : null
                    const socialLinks = getSocialLinksFromPerson(member.person, {
                      twitter: member.twitter,
                      twitch: member.twitch,
                      youtube: member.youtube,
                      instagram: member.instagram,
                    })
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-3 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors group"
                      >
                        <Link
                          href={`/players/${formatPlayerSlug(name)}`}
                          className="text-sm font-medium group-hover:text-primary transition-colors flex-1"
                        >
                          {name}
                        </Link>
                        <SocialLinks links={socialLinks} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        })()}

        {/* Production Staff */}
        {productionStaff.length > 0 && (
          <div>
            <div className="mb-6">
              <h2 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight flex items-center gap-3">
                <Users className="w-8 h-8" />
                Production Staff
              </h2>
              <div className="w-24 h-1 bg-primary" />
            </div>
            
            <div className="space-y-8">
              {Object.entries(groupedProduction).map(([type, staff]) => {
                if (staff.length === 0) return null
                
                const Icon = getTypeIcon(type)
                
                return (
                  <div key={type} className="space-y-4">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      <Icon className="w-5 h-5" />
                      {type}
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {staff.map((member) => {
                        const name = getStaffName(member)
                        const socialLinks = getSocialLinksFromPerson(member.person, {
                          twitter: member.twitter,
                          twitch: member.twitch,
                          youtube: member.youtube,
                          instagram: member.instagram,
                        })
                        return (
                          <div
                            key={member.id}
                            className="flex items-center justify-between gap-3 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors group"
                          >
                            <Link
                              href={`/players/${formatPlayerSlug(name)}`}
                              className="text-sm font-medium group-hover:text-primary transition-colors flex-1"
                            >
                              {name}
                            </Link>
                            <SocialLinks links={socialLinks} />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Esports Staff - At the bottom */}
        {/* Always show section header, even if empty, for debugging */}
        <div>
          <div className="mb-6">
            <h2 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight flex items-center gap-3">
              <Shield className="w-8 h-8" />
              Esports Staff
            </h2>
            <div className="w-24 h-1 bg-primary" />
          </div>
          
          {(managers.length > 0 || coaches.length > 0 || captains.length > 0) ? (
            <div className="grid md:grid-cols-3 gap-8">
              {managers.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-muted-foreground uppercase tracking-wider">Managers</h3>
                  <div className="space-y-2">
                    {managers.map((manager, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                        <Link 
                          href={`/players/${formatPlayerSlug(manager.name)}`}
                          className="text-sm font-medium hover:text-primary transition-colors"
                        >
                          {manager.name}
                        </Link>
                        <SocialLinks links={manager} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {coaches.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-muted-foreground uppercase tracking-wider">Coaches</h3>
                  <div className="space-y-2">
                    {coaches.map((coach, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                        <Link 
                          href={`/players/${formatPlayerSlug(coach.name)}`}
                          className="text-sm font-medium hover:text-primary transition-colors"
                        >
                          {coach.name}
                        </Link>
                        <SocialLinks links={coach} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {captains.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-muted-foreground uppercase tracking-wider">Captains</h3>
                  <div className="space-y-2">
                    {captains.map((captain, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                        <Link 
                          href={`/players/${formatPlayerSlug(captain.name)}`}
                          className="text-sm font-medium hover:text-primary transition-colors"
                        >
                          {captain.name}
                        </Link>
                        <SocialLinks links={captain} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No esports staff found.</p>
              <p className="text-sm mt-2">
                Make sure teams have managers, coaches, or captains assigned with linked People entries.
              </p>
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs mt-4 space-y-1">
                  <p>Debug: {allTeams.length} teams loaded</p>
                  <p>Managers before filter: {allManagers.length}</p>
                  <p>Coaches before filter: {allCoaches.length}</p>
                  <p>Captains before filter: {allCaptains.length}</p>
                  <p>Valid managers: {validManagers.length}</p>
                  <p>Valid coaches: {validCoaches.length}</p>
                  <p>Valid captains: {validCaptains.length}</p>
                </div>
              )}
              <p className="text-sm mt-4">
                If you just seeded the database, try refreshing the page or re-running the seed script from the admin dashboard.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
    )
  } catch (error) {
    console.error('Error loading staff page:', error)
    return (
      <div className="container py-20">
        <h1 className="text-4xl font-bold mb-8">Staff</h1>
        <p className="text-muted-foreground">Unable to load staff information. Please try again later.</p>
      </div>
    )
  }
}
