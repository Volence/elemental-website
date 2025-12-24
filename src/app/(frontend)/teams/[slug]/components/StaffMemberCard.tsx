import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { SocialLinks } from '@/components/SocialLinks'
import { formatPlayerSlug } from '@/utilities/getPlayer'

interface StaffMemberCardProps {
  name: string
  photoUrl?: string | null
  twitter?: string
  twitch?: string
  youtube?: string
  instagram?: string
  role?: 'manager' | 'coach' | 'captain'
}

export function StaffMemberCard({
  name,
  photoUrl,
  twitter,
  twitch,
  youtube,
  instagram,
  role = 'captain',
}: StaffMemberCardProps) {
  // Get role colors
  const getRoleColor = () => {
    switch (role) {
      case 'manager':
        return { bg: '#a855f715', color: '#a855f7', ring: '#a855f750' }
      case 'coach':
        return { bg: '#22c55e15', color: '#22c55e', ring: '#22c55e50' }
      case 'captain':
      default:
        return { bg: '#eab30815', color: '#eab308', ring: '#eab30850' }
    }
  }
  
  const roleColor = getRoleColor()
  
  return (
    <div className="group flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-background to-background/50 hover:border-primary/50 hover:shadow-lg transition-all duration-200">
      <div 
        className="w-12 h-12 rounded-full flex items-center justify-center ring-2 transition-all duration-200 overflow-hidden"
        style={{
          backgroundColor: roleColor.bg,
          borderColor: roleColor.ring,
        }}
      >
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={name}
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-lg font-bold" style={{ color: roleColor.color }}>{name.charAt(0)}</span>
        )}
      </div>
      <Link 
        href={`/players/${formatPlayerSlug(name)}`}
        className="flex-1 font-bold group-hover:text-primary transition-colors hover:underline"
      >
        {name}
      </Link>
      <div className="opacity-70 group-hover:opacity-100 transition-opacity">
        <SocialLinks links={{ twitter, twitch, youtube, instagram }} />
      </div>
    </div>
  )
}

