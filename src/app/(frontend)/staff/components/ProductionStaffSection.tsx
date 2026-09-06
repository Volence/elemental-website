import React from 'react'
import { Users } from 'lucide-react'
import { StaffMemberCard } from './StaffMemberCard'
import { getSocialLinksFromPerson, getPhotoUrlFromPerson, getPersonSlugFromRelationship } from '@/utilities/personHelpers'
import { formatPlayerSlug } from '@/utilities/getPlayer'
import { getOrgRoleIcon } from '@/utilities/roleIcons'
import type { StaffGroup } from '@/utilities/staffFromTitles'

interface ProductionStaffSectionProps {
  groups: StaffGroup[]
}

const productionColors: Record<string, { from: string; to: string; text: string; ring: string }> = {
  Caster: {
    from: 'from-purple-500/20',
    to: 'to-purple-600/10',
    text: 'text-purple-500',
    ring: 'ring-purple-500/20',
  },
  Observer: {
    from: 'from-blue-500/20',
    to: 'to-blue-600/10',
    text: 'text-blue-500',
    ring: 'ring-blue-500/20',
  },
  Producer: {
    from: 'from-yellow-500/20',
    to: 'to-yellow-600/10',
    text: 'text-yellow-500',
    ring: 'ring-yellow-500/20',
  },
}

export function ProductionStaffSection({ groups }: ProductionStaffSectionProps) {
  const hasAnyProduction = groups.some((g) => g.members.length > 0)

  if (!hasAnyProduction) {
    return null
  }

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-yellow-500/5">
      <div className="mb-6">
        <h2 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight flex items-center gap-4">
          <Users className="w-8 h-8" />
          Production Staff
        </h2>
        <div className="w-24 h-1 bg-gradient-to-r from-[hsl(var(--accent-blue))] via-purple-500 to-[hsl(var(--accent-gold))] shadow-lg" />
      </div>

      <div className="space-y-8">
        {groups.map(({ title, label, members }) => {
          if (members.length === 0) return null

          const Icon = getOrgRoleIcon(title, 'sm')
          const avatarColors = productionColors[label] || {
            from: 'from-primary/20',
            to: 'to-primary/10',
            text: 'text-primary',
            ring: 'ring-primary/20',
          }

          return (
            <div key={title} className="space-y-4">
              <h3 className="text-xl font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                {Icon}
                {label}
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {members.map(({ person, isLead }) => {
                  const photoUrl = getPhotoUrlFromPerson(person)
                  const socialLinks = getSocialLinksFromPerson(person)

                  return (
                    <StaffMemberCard
                      key={person.id}
                      name={person.name}
                      slug={getPersonSlugFromRelationship(person) || formatPlayerSlug(person.name)}
                      lead={isLead}
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
      </div>
    </div>
  )
}
