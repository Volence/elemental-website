import React from 'react'
import { StaffMemberCard } from './StaffMemberCard'
import {
  getPersonNameFromRelationship,
  isPopulatedPerson,
  getSocialLinksFromPerson,
  getPhotoUrlFromPerson,
  getPersonSlugFromRelationship,
} from '@/utilities/personHelpers'
import { getOrgRoleIcon } from '@/utilities/roleIcons'
import { formatPlayerSlug } from '@/utilities/getPlayer'
import { ORG_ROLES, ORG_REGIONS } from '@/utilities/orgRoles'

interface OrganizationStaffSectionProps {
  groupedOrgStaff: Record<string, any[]>
  getStaffName: (staff: any) => string
}

const REGION_LABELS: Record<string, string> = Object.fromEntries(
  ORG_REGIONS.map((r) => [r.value, r.label]),
)

const roleOrder = ORG_ROLES.map((r) => r.label)

const colorMap: Record<string, string> = {
  Owner: 'bg-gradient-to-r from-[hsl(var(--accent-gold))] to-yellow-500',
  'Co-Owner': 'bg-gradient-to-r from-red-500 to-orange-500',
  Administration: 'bg-gradient-to-r from-violet-500 to-purple-500',
  HR: 'bg-gradient-to-r from-[hsl(var(--accent-green))] to-green-500',
  'Region Lead': 'bg-gradient-to-r from-teal-500 to-emerald-500',
  'Event Manager': 'bg-gradient-to-r from-purple-500 to-pink-500',
  'Social Manager': 'bg-gradient-to-r from-cyan-500 to-blue-500',
  Marketing: 'bg-gradient-to-r from-fuchsia-500 to-pink-500',
  Graphics: 'bg-gradient-to-r from-orange-500 to-red-500',
  'Media Editor': 'bg-gradient-to-r from-red-500 to-pink-500',
}

const avatarColorMap: Record<
  string,
  { from: string; to: string; text: string; ring: string }
> = {
  Owner: {
    from: 'from-yellow-500/20',
    to: 'to-yellow-600/10',
    text: 'text-yellow-500',
    ring: 'ring-yellow-500/20',
  },
  'Co-Owner': {
    from: 'from-red-500/20',
    to: 'to-orange-600/10',
    text: 'text-red-500',
    ring: 'ring-red-500/20',
  },
  Administration: {
    from: 'from-violet-500/20',
    to: 'to-purple-600/10',
    text: 'text-violet-500',
    ring: 'ring-violet-500/20',
  },
  HR: {
    from: 'from-green-500/20',
    to: 'to-green-600/10',
    text: 'text-green-500',
    ring: 'ring-green-500/20',
  },
  'Region Lead': {
    from: 'from-teal-500/20',
    to: 'to-emerald-600/10',
    text: 'text-teal-500',
    ring: 'ring-teal-500/20',
  },
  'Event Manager': {
    from: 'from-purple-500/20',
    to: 'to-pink-600/10',
    text: 'text-purple-500',
    ring: 'ring-purple-500/20',
  },
  'Social Manager': {
    from: 'from-cyan-500/20',
    to: 'to-blue-600/10',
    text: 'text-cyan-500',
    ring: 'ring-cyan-500/20',
  },
  Marketing: {
    from: 'from-fuchsia-500/20',
    to: 'to-pink-600/10',
    text: 'text-fuchsia-500',
    ring: 'ring-fuchsia-500/20',
  },
  Graphics: {
    from: 'from-orange-500/20',
    to: 'to-red-600/10',
    text: 'text-orange-500',
    ring: 'ring-orange-500/20',
  },
  'Media Editor': {
    from: 'from-red-500/20',
    to: 'to-pink-600/10',
    text: 'text-red-500',
    ring: 'ring-red-500/20',
  },
}

const sectionBgMap: Record<string, string> = {
  Owner: 'bg-yellow-500/5',
  'Co-Owner': 'bg-red-500/5',
  Administration: 'bg-violet-500/5',
  HR: 'bg-green-500/5',
  'Region Lead': 'bg-teal-500/5',
  'Event Manager': 'bg-purple-500/5',
  'Social Manager': 'bg-cyan-500/5',
  Marketing: 'bg-fuchsia-500/5',
  Graphics: 'bg-orange-500/5',
  'Media Editor': 'bg-red-500/5',
}

export function OrganizationStaffSection({
  groupedOrgStaff,
  getStaffName,
}: OrganizationStaffSectionProps) {
  return (
    <>
      {roleOrder.map((role) => {
        const staff = groupedOrgStaff[role]
        if (!staff || staff.length === 0) return null

        const Icon = getOrgRoleIcon(role, 'md')
        const displayName = ORG_ROLES.find((r) => r.label === role)?.groupLabel ?? role

        const underlineColor = colorMap[role] || 'bg-primary'
        const avatarColors = avatarColorMap[role] || {
          from: 'from-primary/20',
          to: 'to-primary/10',
          text: 'text-primary',
          ring: 'ring-primary/20',
        }
        const sectionBg = sectionBgMap[role] || 'bg-muted/10'

        return (
          <div key={role} className={`p-6 rounded-2xl ${sectionBg}`}>
            <div className="mb-6">
              <h2 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight flex items-center gap-4">
                {Icon}
                {displayName}
              </h2>
              <div className={`w-24 h-1 ${underlineColor} shadow-lg`} />
            </div>

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

                const regionSubtitle = role === 'Region Lead' && member.regions?.length > 0
                  ? member.regions.map((r: string) => REGION_LABELS[r] || r.toUpperCase()).join(', ')
                  : undefined

                return (
                  <StaffMemberCard
                    key={member.id}
                    name={name}
                    slug={getPersonSlugFromRelationship(member.person) || formatPlayerSlug(name)}
                    subtitle={regionSubtitle}
                    photoUrl={photoUrl}
                    socialLinks={socialLinks}
                    avatarColors={avatarColors}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}

