import type { Metadata } from 'next'
import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getAllTeams } from '@/utilities/getTeams'
import { SocialLinks } from '@/components/SocialLinks'
import { Users, Mic, Eye, Video, Shield, Crown, UserCheck, MessageSquare, Calendar, Share2, Image as ImageIcon, Film } from 'lucide-react'
import Link from 'next/link'
import NextImage from 'next/image'
import { formatPlayerSlug } from '@/utilities/getPlayer'
import { getPersonNameFromRelationship, isPopulatedPerson, getSocialLinksFromPerson, getPhotoUrlFromPerson } from '@/utilities/personHelpers'

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
    'Graphics': ImageIcon,
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
    <div className="pt-8 pb-24 min-h-screen animate-fade-in">
      <div className="container mb-16">
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
            Staff
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-[hsl(var(--accent-blue))] via-[hsl(var(--accent-green))] to-[hsl(var(--accent-gold))] mx-auto mb-6 shadow-[0_0_20px_rgba(56,189,248,0.4)]" />
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            Meet the dedicated staff members who make Elemental possible - from team management to production.
          </p>
        </div>
      </div>

      <div className="container space-y-10">
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
            
            // Different colors for different roles
            const colorMap: Record<string, string> = {
              'Owner': 'bg-gradient-to-r from-[hsl(var(--accent-gold))] to-yellow-500',
              'Co-Owner': 'bg-gradient-to-r from-red-500 to-orange-500',
              'HR': 'bg-gradient-to-r from-[hsl(var(--accent-green))] to-green-500',
              'Moderator': 'bg-gradient-to-r from-[hsl(var(--accent-blue))] to-blue-500',
              'Event Manager': 'bg-gradient-to-r from-purple-500 to-pink-500',
              'Social Manager': 'bg-gradient-to-r from-cyan-500 to-blue-500',
              'Graphics': 'bg-gradient-to-r from-orange-500 to-red-500',
              'Media Editor': 'bg-gradient-to-r from-red-500 to-pink-500',
            }
            const underlineColor = colorMap[role] || 'bg-primary'
            
            // Avatar colors matching underlines
            const avatarColorMap: Record<string, { from: string, to: string, text: string, ring: string }> = {
              'Owner': { from: 'from-yellow-500/20', to: 'to-yellow-600/10', text: 'text-yellow-500', ring: 'ring-yellow-500/20' },
              'Co-Owner': { from: 'from-red-500/20', to: 'to-orange-600/10', text: 'text-red-500', ring: 'ring-red-500/20' },
              'HR': { from: 'from-green-500/20', to: 'to-green-600/10', text: 'text-green-500', ring: 'ring-green-500/20' },
              'Moderator': { from: 'from-blue-500/20', to: 'to-blue-600/10', text: 'text-blue-500', ring: 'ring-blue-500/20' },
              'Event Manager': { from: 'from-purple-500/20', to: 'to-pink-600/10', text: 'text-purple-500', ring: 'ring-purple-500/20' },
              'Social Manager': { from: 'from-cyan-500/20', to: 'to-blue-600/10', text: 'text-cyan-500', ring: 'ring-cyan-500/20' },
              'Graphics': { from: 'from-orange-500/20', to: 'to-red-600/10', text: 'text-orange-500', ring: 'ring-orange-500/20' },
              'Media Editor': { from: 'from-red-500/20', to: 'to-pink-600/10', text: 'text-red-500', ring: 'ring-red-500/20' },
            }
            const avatarColors = avatarColorMap[role] || { from: 'from-primary/20', to: 'to-primary/10', text: 'text-primary', ring: 'ring-primary/20' }
            
            // Section backgrounds
            const sectionBgMap: Record<string, string> = {
              'Owner': 'bg-yellow-500/5',
              'Co-Owner': 'bg-red-500/5',
              'HR': 'bg-green-500/5',
              'Moderator': 'bg-blue-500/5',
              'Event Manager': 'bg-purple-500/5',
              'Social Manager': 'bg-cyan-500/5',
              'Graphics': 'bg-orange-500/5',
              'Media Editor': 'bg-red-500/5',
            }
            const sectionBg = sectionBgMap[role] || 'bg-muted/10'
            
            return (
              <div key={role} className={`p-6 rounded-2xl ${sectionBg}`}>
                <div className="mb-6">
                  <h2 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight flex items-center gap-3">
                    <Icon className="w-8 h-8" />
                    {displayName}
                  </h2>
                  <div className={`w-24 h-1 ${underlineColor} shadow-lg`} />
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {staff.map((member) => {
                    const name = getStaffName(member)
                    const person = isPopulatedPerson(member.person) ? member.person : null
                    const photoUrl = getPhotoUrlFromPerson(member.person)
                    const socialLinks = getSocialLinksFromPerson(member.person, {
                      twitter: member.twitter,
                      twitch: member.twitch,
                      youtube: member.youtube,
                      instagram: member.instagram,
                    })
                    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                    
                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-card to-card/50 hover:border-primary/50 hover:shadow-lg hover:scale-[1.02] transition-all group"
                      >
                        <div className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${avatarColors.from} ${avatarColors.to} flex items-center justify-center flex-shrink-0 ring-2 ${avatarColors.ring} group-hover:ring-primary/40 transition-all overflow-hidden`}>
                          {photoUrl ? (
                            <NextImage
                              src={photoUrl}
                              alt={name}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className={`text-base font-bold ${avatarColors.text}`}>{initials}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/players/${formatPlayerSlug(name)}`}
                            className="block text-sm font-bold group-hover:text-primary transition-colors truncate mb-1"
                          >
                            {name}
                          </Link>
                          <div className="scale-90 origin-left">
                            <SocialLinks links={socialLinks} />
                          </div>
                        </div>
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
          <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-yellow-500/5">
            <div className="mb-6">
              <h2 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight flex items-center gap-3">
                <Users className="w-8 h-8" />
                Production Staff
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-[hsl(var(--accent-blue))] via-purple-500 to-[hsl(var(--accent-gold))] shadow-lg" />
            </div>
            
            <div className="space-y-8">
              {Object.entries(groupedProduction).map(([type, staff]) => {
                if (staff.length === 0) return null
                
                const Icon = getTypeIcon(type)
                
                // Different colors for production types
                const productionColors: Record<string, { from: string, to: string, text: string, ring: string }> = {
                  'Caster': { from: 'from-purple-500/20', to: 'to-purple-600/10', text: 'text-purple-500', ring: 'ring-purple-500/20' },
                  'Observer': { from: 'from-blue-500/20', to: 'to-blue-600/10', text: 'text-blue-500', ring: 'ring-blue-500/20' },
                  'Producer': { from: 'from-yellow-500/20', to: 'to-yellow-600/10', text: 'text-yellow-500', ring: 'ring-yellow-500/20' },
                  'Observer/Producer': { from: 'from-cyan-500/20', to: 'to-blue-600/10', text: 'text-cyan-500', ring: 'ring-cyan-500/20' },
                  'Observer/Producer/Caster': { from: 'from-pink-500/20', to: 'to-purple-600/10', text: 'text-pink-500', ring: 'ring-pink-500/20' },
                }
                const avatarColors = productionColors[type] || { from: 'from-primary/20', to: 'to-primary/10', text: 'text-primary', ring: 'ring-primary/20' }
                
                return (
                  <div key={type} className="space-y-4">
                    <h3 className="text-xl font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Icon className="w-5 h-5" />
                      {type}
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {staff.map((member) => {
                        const name = getStaffName(member)
                        const photoUrl = getPhotoUrlFromPerson(member.person)
                        const socialLinks = getSocialLinksFromPerson(member.person, {
                          twitter: member.twitter,
                          twitch: member.twitch,
                          youtube: member.youtube,
                          instagram: member.instagram,
                        })
                        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                        
                        return (
                          <div
                            key={member.id}
                            className="flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-card to-card/50 hover:border-primary/50 hover:shadow-lg hover:scale-[1.02] transition-all group"
                          >
                            <div className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${avatarColors.from} ${avatarColors.to} flex items-center justify-center flex-shrink-0 ring-2 ${avatarColors.ring} group-hover:ring-primary/40 transition-all overflow-hidden`}>
                              {photoUrl ? (
                                <NextImage
                                  src={photoUrl}
                                  alt={name}
                                  width={48}
                                  height={48}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className={`text-base font-bold ${avatarColors.text}`}>{initials}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/players/${formatPlayerSlug(name)}`}
                                className="block text-sm font-bold group-hover:text-primary transition-colors truncate mb-1"
                              >
                                {name}
                              </Link>
                              <div className="scale-90 origin-left">
                                <SocialLinks links={socialLinks} />
                              </div>
                            </div>
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
        <div className="p-6 rounded-2xl bg-gradient-to-br from-green-500/5 via-blue-500/5 to-yellow-500/5">
          <div className="mb-6">
            <h2 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight flex items-center gap-3">
              <Shield className="w-8 h-8" />
              Esports Staff
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-[hsl(var(--accent-green))] via-[hsl(var(--accent-blue))] to-[hsl(var(--accent-gold))] shadow-lg" />
          </div>
          
          {(managers.length > 0 || coaches.length > 0 || captains.length > 0) ? (
            <div className="space-y-8">
              {managers.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-muted-foreground uppercase tracking-wider">Managers</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {managers.map((manager, i) => {
                      const initials = manager.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                      return (
                        <div key={i} className="flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-card to-card/50 hover:border-primary/50 hover:shadow-lg hover:scale-[1.02] transition-all group">
                          <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/10 flex items-center justify-center flex-shrink-0 ring-2 ring-green-500/20 group-hover:ring-primary/40 transition-all overflow-hidden">
                            {manager.photoUrl ? (
                              <NextImage
                                src={manager.photoUrl}
                                alt={manager.name}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-base font-bold text-green-500">{initials}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link 
                              href={`/players/${formatPlayerSlug(manager.name)}`}
                              className="block text-sm font-bold hover:text-primary transition-colors truncate mb-1"
                            >
                              {manager.name}
                            </Link>
                            <div className="scale-90 origin-left">
                              <SocialLinks links={manager} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {coaches.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-muted-foreground uppercase tracking-wider">Coaches</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {coaches.map((coach, i) => {
                      const initials = coach.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                      return (
                        <div key={i} className="flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-card to-card/50 hover:border-primary/50 hover:shadow-lg hover:scale-[1.02] transition-all group">
                          <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center flex-shrink-0 ring-2 ring-blue-500/20 group-hover:ring-primary/40 transition-all overflow-hidden">
                            {coach.photoUrl ? (
                              <NextImage
                                src={coach.photoUrl}
                                alt={coach.name}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-base font-bold text-blue-500">{initials}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link 
                              href={`/players/${formatPlayerSlug(coach.name)}`}
                              className="block text-sm font-bold hover:text-primary transition-colors truncate mb-1"
                            >
                              {coach.name}
                            </Link>
                            <div className="scale-90 origin-left">
                              <SocialLinks links={coach} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {captains.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-muted-foreground uppercase tracking-wider">Captains</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {captains.map((captain, i) => {
                      const initials = captain.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                      return (
                        <div key={i} className="flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-card to-card/50 hover:border-primary/50 hover:shadow-lg hover:scale-[1.02] transition-all group">
                          <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 flex items-center justify-center flex-shrink-0 ring-2 ring-yellow-500/20 group-hover:ring-primary/40 transition-all overflow-hidden">
                            {captain.photoUrl ? (
                              <NextImage
                                src={captain.photoUrl}
                                alt={captain.name}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-base font-bold text-yellow-500">{initials}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link 
                              href={`/players/${formatPlayerSlug(captain.name)}`}
                              className="block text-sm font-bold hover:text-primary transition-colors truncate mb-1"
                            >
                              {captain.name}
                            </Link>
                            <div className="scale-90 origin-left">
                              <SocialLinks links={captain} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
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
