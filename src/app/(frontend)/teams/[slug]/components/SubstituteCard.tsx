import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Lock } from 'lucide-react'
import { SocialLinks } from '@/components/SocialLinks'
import { formatPlayerSlug } from '@/utilities/getPlayer'

interface SubstituteCardProps {
  name: string
  photoUrl?: string | null
  twitter?: string
  twitch?: string
  youtube?: string
  instagram?: string
}

export function SubstituteCard({
  name,
  photoUrl,
  twitter,
  twitch,
  youtube,
  instagram,
}: SubstituteCardProps) {
  return (
    <div className="group flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-background to-background/50 hover:border-orange-500/50 hover:shadow-lg hover:scale-[1.02] transition-all duration-200">
      {/* Avatar placeholder */}
      <div className="relative flex-shrink-0">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-500/5 flex items-center justify-center ring-2 ring-orange-500/20 group-hover:ring-orange-500/50 transition-all overflow-hidden">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={name}
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xl font-bold text-orange-500">{name.charAt(0)}</span>
          )}
        </div>
        {/* Lock badge on avatar */}
        <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-card border-2 border-background">
          <Lock className="w-3 h-3 text-orange-500" />
        </div>
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <Link 
          href={`/players/${formatPlayerSlug(name)}`}
          className="font-bold text-base group-hover:text-orange-500 transition-colors truncate hover:underline block"
        >
          {name}
        </Link>
        <span className="text-xs font-medium text-muted-foreground">Substitute</span>
      </div>

      {/* Social links */}
      <div className="flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
        <SocialLinks links={{ twitter, twitch, youtube, instagram }} />
      </div>
    </div>
  )
}

