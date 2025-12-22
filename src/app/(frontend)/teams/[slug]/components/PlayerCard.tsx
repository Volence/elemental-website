import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { SocialLinks } from '@/components/SocialLinks'
import { formatPlayerSlug } from '@/utilities/getPlayer'
import { getGameRoleIcon } from '@/utilities/roleIcons'

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
  return (
    <Link
      href={`/players/${formatPlayerSlug(name)}`}
      className="group flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-background to-background/50 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:scale-[1.02] transition-all duration-200"
    >
      {/* Avatar placeholder with role icon */}
      <div className="relative flex-shrink-0">
        <div
          className={`w-16 h-16 rounded-full bg-gradient-to-br flex items-center justify-center ring-2 transition-all overflow-hidden ${getRoleColor(role)}`}
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
        <p className="font-bold text-lg group-hover:text-primary transition-colors truncate">
          {name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-2.5 py-1 rounded-md bg-muted/50 border border-muted">
            {role}
          </span>
        </div>
      </div>

      {/* Social links */}
      <div className="flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
        <SocialLinks links={{ twitter, twitch, youtube, instagram }} />
      </div>
    </Link>
  )
}

