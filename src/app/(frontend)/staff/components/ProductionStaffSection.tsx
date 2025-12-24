import React from 'react'
import { Users, Mic, Eye, Video } from 'lucide-react'
import { StaffMemberCard } from './StaffMemberCard'
import { getSocialLinksFromPerson, getPhotoUrlFromPerson } from '@/utilities/personHelpers'

interface ProductionStaffSectionProps {
  groupedProduction: Record<string, any[]>
  getStaffName: (staff: any) => string
}

const productionColors: Record<string, { from: string; to: string; text: string; ring: string }> =
  {
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
    'Observer/Producer': {
      from: 'from-cyan-500/20',
      to: 'to-blue-600/10',
      text: 'text-cyan-500',
      ring: 'ring-cyan-500/20',
    },
    'Observer/Producer/Caster': {
      from: 'from-pink-500/20',
      to: 'to-purple-600/10',
      text: 'text-pink-500',
      ring: 'ring-pink-500/20',
    },
  }

function getTypeIcon(type: string) {
  if (type === 'Observer') return Eye
  if (type === 'Producer') return Video
  if (type === 'Observer/Producer' || type === 'Observer/Producer/Caster') return Video
  return Mic // Default to Mic for Caster
}

export function ProductionStaffSection({
  groupedProduction,
  getStaffName,
}: ProductionStaffSectionProps) {
  const hasAnyProduction = Object.values(groupedProduction).some((staff) => staff.length > 0)

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
        {Object.entries(groupedProduction).map(([type, staff]) => {
          if (staff.length === 0) return null

          const Icon = getTypeIcon(type)
          const avatarColors = productionColors[type] || {
            from: 'from-primary/20',
            to: 'to-primary/10',
            text: 'text-primary',
            ring: 'ring-primary/20',
          }

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

                  return (
                    <StaffMemberCard
                      key={member.id}
                      name={name}
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

