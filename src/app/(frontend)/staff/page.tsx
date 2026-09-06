import type { Metadata } from 'next'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getAllTeams } from '@/utilities/getTeams'
import { groupPeopleByTitle, findPeopleWithTitles } from '@/utilities/staffFromTitles'
import { StaffHeader } from './components/StaffHeader'
import { OrganizationStaffSection } from './components/OrganizationStaffSection'
import { ProductionStaffSection } from './components/ProductionStaffSection'
import { EsportsStaffSection } from './components/EsportsStaffSection'
import { ParticleBackground } from '@/components/ParticleBackground'

export const dynamic = 'force-dynamic' // Always render dynamically to fetch fresh data

export const metadata: Metadata = {
  title: 'Staff',
  description: 'Meet the staff behind Elemental - managers, coaches, captains, and production team.',
  openGraph: mergeOpenGraph({
    title: 'Elemental Staff',
    description: 'Meet the staff behind Elemental - managers, coaches, captains, and production team.',
  }),
}

interface StaffMember {
  name: string
  slug: string
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
        slug: member.slug || existing.slug,
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

    // Filter out entries with empty names (person relationship not populated)
    const validManagers = allManagers.filter((m) => m.name && m.name.trim() !== '')
    const validCoaches = allCoaches.filter((c) => c.name && c.name.trim() !== '')
    const validCaptains = allCaptains.filter((c) => c.name && c.name.trim() !== '')

    // Deduplicate staff
    const managers = deduplicateStaff(validManagers)
    const coaches = deduplicateStaff(validCoaches)
    const captains = deduplicateStaff(validCaptains)

    // Titled people, grouped by title (organization + department -> OrganizationStaffSection,
    // production -> ProductionStaffSection; content-creator is not shown on /staff)
    const groups = groupPeopleByTitle(await findPeopleWithTitles(payload, 2))
    const orgGroups = groups.filter((g) => g.group === 'organization' || g.group === 'department')
    const productionGroups = groups.filter((g) => g.group === 'production')

    return (
      <div className="relative pt-8 pb-24 min-h-screen animate-fade-in overflow-hidden">
        {/* Subtle background effects */}
        <ParticleBackground particleCount={25} />

        <StaffHeader />

        <div className="container space-y-10 relative z-10">
          {/* Organization Staff Sections */}
          <OrganizationStaffSection groups={orgGroups} />

          {/* Production Staff */}
          <ProductionStaffSection groups={productionGroups} />

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
