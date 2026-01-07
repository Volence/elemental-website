import type { Metadata } from 'next'
import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getAllTeams } from '@/utilities/getTeams'
import { getPersonNameFromRelationship } from '@/utilities/personHelpers'
import { StaffHeader } from './components/StaffHeader'
import { OrganizationStaffSection } from './components/OrganizationStaffSection'
import { ProductionStaffSection } from './components/ProductionStaffSection'
import { EsportsStaffSection } from './components/EsportsStaffSection'
import { ParticleBackground } from '@/components/ParticleBackground'

export const dynamic = 'force-dynamic' // Always render dynamically to fetch fresh data

export const metadata: Metadata = {
  title: 'Staff | Elemental (ELMT)',
  description: 'Meet the staff behind Elemental - managers, coaches, captains, and production team.',
  openGraph: {
    title: 'Staff | Elemental (ELMT)',
    description:
      'Meet the staff behind Elemental - managers, coaches, captains, and production team.',
  },
}

interface StaffMember {
  name: string
  photoUrl?: string | null
  twitter?: string
  twitch?: string
  youtube?: string
  instagram?: string
}

// Deduplicate staff members by name, merging social links and photos
function deduplicateStaff(staff: StaffMember[]): StaffMember[] {
  const map = new Map<string, StaffMember>()

  staff.forEach((member) => {
    const existing = map.get(member.name)
    if (existing) {
      // Merge social links and photo, preferring non-empty values
      map.set(member.name, {
        name: member.name,
        photoUrl: member.photoUrl || existing.photoUrl,
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
    Caster: [],
    Observer: [],
    Producer: [],
    'Observer/Producer': [],
    'Observer/Producer/Caster': [],
  }

  const typeLabels: Record<string, string> = {
    caster: 'Caster',
    observer: 'Observer',
    producer: 'Producer',
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
    Owner: [],
    'Co-Owner': [],
    HR: [],
    Moderator: [],
    'Event Manager': [],
    'Social Manager': [],
    Graphics: [],
    'Media Editor': [],
  }

  const roleLabels: Record<string, string> = {
    owner: 'Owner',
    'co-owner': 'Co-Owner',
    hr: 'HR',
    moderator: 'Moderator',
    'event-manager': 'Event Manager',
    'social-manager': 'Social Manager',
    graphics: 'Graphics',
    'media-editor': 'Media Editor',
  }

  orgStaff.forEach((staff) => {
    // Handle both single role (old data) and multiple roles (new data)
    const roles = Array.isArray(staff.roles) ? staff.roles : staff.role ? [staff.role] : []

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
        sampleTeam: allTeams[0]
          ? {
              name: allTeams[0].name,
              managerCount: allTeams[0].manager?.length || 0,
              coachesCount: allTeams[0].coaches?.length || 0,
              captainCount: allTeams[0].captain?.length || 0,
            }
          : null,
      })
    }

    // Filter out entries with empty names (person relationship not populated)
    const validManagers = allManagers.filter((m) => m.name && m.name.trim() !== '')
    const validCoaches = allCoaches.filter((c) => c.name && c.name.trim() !== '')
    const validCaptains = allCaptains.filter((c) => c.name && c.name.trim() !== '')

    // Deduplicate staff
    const managers = deduplicateStaff(validManagers)
    const coaches = deduplicateStaff(validCoaches)
    const captains = deduplicateStaff(validCaptains)

    // Fetch production staff (with person relationship populated)
    const productionResult = await payload.find({
      collection: 'production',
      limit: 1000,
      pagination: false,
      depth: 2, // Populate person relationship and nested photo relationship
    })

    const productionStaff = productionResult.docs
    const groupedProduction = groupProductionStaff(productionStaff)

    // Fetch organization staff (with person relationship populated)
    const orgStaffResult = await payload.find({
      collection: 'organization-staff',
      limit: 1000,
      pagination: false,
      depth: 2, // Populate person relationship and nested photo relationship
    })

    const orgStaff = orgStaffResult.docs
    const groupedOrgStaff = groupOrganizationStaff(orgStaff)

    return (
      <div className="relative pt-8 pb-24 min-h-screen animate-fade-in overflow-hidden">
        {/* Subtle background effects */}
        <ParticleBackground particleCount={25} />
        
        <StaffHeader />

        <div className="container space-y-10 relative z-10">
          {/* Organization Staff Sections */}
          <OrganizationStaffSection
            groupedOrgStaff={groupedOrgStaff}
            getStaffName={getStaffName}
          />

          {/* Production Staff */}
          <ProductionStaffSection
            groupedProduction={groupedProduction}
            getStaffName={getStaffName}
          />

          {/* Esports Staff */}
          <EsportsStaffSection
            managers={managers}
            coaches={coaches}
            captains={captains}
            debugInfo={
              process.env.NODE_ENV === 'development'
                ? {
                    totalTeams: allTeams.length,
                    managersBeforeFilter: allManagers.length,
                    coachesBeforeFilter: allCoaches.length,
                    captainsBeforeFilter: allCaptains.length,
                    validManagers: validManagers.length,
                    validCoaches: validCoaches.length,
                    validCaptains: validCaptains.length,
                  }
                : undefined
            }
          />
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error loading staff page:', error)
    return (
      <div className="container py-20">
        <h1 className="text-4xl font-bold mb-8">Staff</h1>
        <p className="text-muted-foreground">
          Unable to load staff information. Please try again later.
        </p>
      </div>
    )
  }
}
