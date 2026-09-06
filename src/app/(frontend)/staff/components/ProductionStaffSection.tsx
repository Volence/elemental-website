import React from 'react'
import { Users } from 'lucide-react'
import { StaffMemberCard } from './StaffMemberCard'
import { getSocialLinksFromPerson, getPhotoUrlFromPerson, getPersonSlugFromRelationship } from '@/utilities/personHelpers'
import { formatPlayerSlug } from '@/utilities/getPlayer'
import { productionRoster, type StaffGroup } from '@/utilities/staffFromTitles'

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
  // One card per person: someone who is both Observer and Producer appears once, with both
  // titles under their name, instead of once per title group.
  const roster = productionRoster(groups)

  if (roster.length === 0) {
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

      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {roster.map(({ person, titles, isLead }) => {
          const photoUrl = getPhotoUrlFromPerson(person)
          const socialLinks = getSocialLinksFromPerson(person)
          const primaryLabel = titles[0]?.label.replace(/^Lead /, '') ?? ''
          const avatarColors = productionColors[primaryLabel] || {
            from: 'from-primary/20',
            to: 'to-primary/10',
            text: 'text-primary',
            ring: 'ring-primary/20',
          }

          return (
            <StaffMemberCard
              key={person.id}
              name={person.name}
              slug={getPersonSlugFromRelationship(person) || formatPlayerSlug(person.name)}
              subtitle={titles.map((t) => t.label).join(' / ')}
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
}
