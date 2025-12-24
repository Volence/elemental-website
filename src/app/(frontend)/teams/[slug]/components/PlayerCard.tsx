import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { SocialLinks } from '@/components/SocialLinks'
import { formatPlayerSlug } from '@/utilities/getPlayer'
import { getGameRoleIcon } from '@/utilities/roleIcons'
import { getRoleColors } from '@/utilities/tierColors'

interface PlayerCardProps {
  name: string
  role: string
  photoUrl?: string | null
  twitter?: string
  twitch?: string
  youtube?: string
  instagram?: string
  getRoleColor: (role: string) => string
}

export function PlayerCard({
  name,
  role,
  photoUrl,
  twitter,
  twitch,
  youtube,
  instagram,
  getRoleColor,
}: PlayerCardProps) {
  const roleColors = getRoleColors(role)
  
  // Extract hex color from the gradient for the badge
  const roleColorHex = role === 'tank' ? '#3b82f6' : role === 'support' ? '#22c55e' : '#ef4444'
  
  return (
    <div className="group flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-background to-background/50 shadow-md hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:scale-[1.02] transition-all duration-200">
      {/* Avatar placeholder with role icon */}
      <div className="relative flex-shrink-0">
        <div
          className={`w-16 h-16 rounded-full bg-gradient-to-br flex items-center justify-center ring-2 transition-all duration-200 overflow-hidden ${getRoleColor(role)}`}
        >
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={name}
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-primary">{getGameRoleIcon(role, 'md')}</div>
          )}
        </div>
        {/* Role badge on avatar */}
        <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-card border-2 border-background shadow-lg">
          <div className="text-primary">{getGameRoleIcon(role, 'sm')}</div>
        </div>
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <Link 
          href={`/players/${formatPlayerSlug(name)}`}
          className="font-bold text-lg group-hover:text-primary transition-colors truncate hover:underline block"
        >
          {name}
        </Link>
        <div className="flex items-center gap-2 mt-1">
          <span 
            className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border"
            style={{
              backgroundColor: `${roleColorHex}15`,
              color: roleColorHex,
              borderColor: `${roleColorHex}50`
            }}
          >
            {role}
          </span>
        </div>
      </div>

      {/* Social links */}
      <div className="flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
        <SocialLinks links={{ twitter, twitch, youtube, instagram }} />
      </div>
    </div>
  )
}

