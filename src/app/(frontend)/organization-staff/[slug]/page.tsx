import type { Metadata } from 'next'
import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import { SocialLinks } from '@/components/SocialLinks'
import { isPopulatedPerson, getSocialLinksFromPerson } from '@/utilities/personHelpers'
import { getOrgRoleIcon, getOrgRoleLabel } from '@/utilities/roleIcons'

type Args = {
  params: Promise<{
    slug: string
  }>
}

// Skip static generation during build - pages will be generated on-demand
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  // Skip database operations during build
  if (process.env.NEXT_BUILD_SKIP_DB) {
    return {
      title: 'Staff | Elemental (ELMT)',
    }
  }

  try {
    const { slug } = await paramsPromise
    const payload = await getPayload({ config: configPromise })

    const staff = await payload.find({
      collection: 'organization-staff',
      where: {
        slug: {
          equals: slug,
        },
      },
      limit: 1,
      depth: 1, // Populate person relationship
    })

    if (!staff.docs[0]) {
      return {
        title: 'Staff Member Not Found | Elemental (ELMT)',
      }
    }

    const staffData = staff.docs[0]
    
    // Get name from person relationship (required)
    const person = staffData.person && typeof staffData.person === 'object' ? staffData.person : null
    const staffName = person?.name || 'Staff Member'
  
    // Handle roles array (may be empty for old data)
    const roles = Array.isArray(staffData.roles) ? staffData.roles : []
    const roleLabels = roles.length > 0 
      ? roles.map((role: string) => getOrgRoleLabel(role)).join(', ')
      : 'Staff Member'

    return {
      title: `${staffName} | Staff | Elemental (ELMT)`,
      description: `Learn more about ${staffName}, ${roleLabels} for Elemental.`,
    }
  } catch (error) {
    // During build, database may not be available
    return {
      title: 'Staff | Elemental (ELMT)',
    }
  }
}

export default async function OrganizationStaffPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  const payload = await getPayload({ config: configPromise })

  const staff = await payload.find({
    collection: 'organization-staff',
    where: {
      slug: {
        equals: slug,
      },
    },
    limit: 1,
    depth: 1, // Populate person relationship
  })

  if (!staff.docs[0]) {
    notFound()
  }

  const staffData = staff.docs[0]
  
  // Get name and bio from person relationship (required)
  const person = staffData.person && typeof staffData.person === 'object' ? staffData.person : null
  const staffName = person?.name || 'Staff Member'
  const bio = person?.bio || undefined
  
  // Handle roles array (may be empty for old data)
  const roles = Array.isArray(staffData.roles) ? staffData.roles : []
  const roleLabels = roles.map((role: string) => getOrgRoleLabel(role))

  return (
    <div className="pt-24 pb-24 min-h-screen">
      <div className="container max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">{staffName}</h1>
          <div className="w-24 h-1 bg-primary mx-auto mb-6" />
          <div className="flex items-center justify-center gap-2 text-muted-foreground flex-wrap">
            {roles.length > 0 ? (
              roles.map((role: string, index: number) => {
                const RoleIcon = getOrgRoleIcon(role, 'lg')
                const roleLabel = getOrgRoleLabel(role)
                return (
                  <React.Fragment key={role}>
                    <div className="flex items-center gap-2">
                      {React.createElement(RoleIcon, { className: 'w-5 h-5' })}
                      <span className="text-lg">{roleLabel}</span>
                    </div>
                    {index < roles.length - 1 && <span className="text-muted-foreground">•</span>}
                  </React.Fragment>
                )
              })
            ) : (
              <span className="text-lg">Staff Member</span>
            )}
          </div>
        </div>

        {/* Bio */}
        {bio && (
          <div className="mb-8 p-6 rounded-xl border border-border bg-card shadow-sm">
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{bio}</p>
          </div>
        )}

        {/* Social Links */}
        {(() => {
          // Social links are now only in the People collection
          const socialLinks = getSocialLinksFromPerson(staffData.person)
          
          const hasSocialLinks = socialLinks.twitter || socialLinks.twitch || socialLinks.youtube || socialLinks.instagram
          
          if (!hasSocialLinks) return null
          
          return (
            <div className="mb-8 flex justify-center">
              <SocialLinks 
                links={socialLinks}
                showLabels={true}
              />
            </div>
          )
        })()}
      </div>
    </div>
  )
}
