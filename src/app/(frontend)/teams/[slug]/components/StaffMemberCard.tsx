import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { SocialLinks } from '@/components/SocialLinks'
import { formatPlayerSlug } from '@/utilities/getPlayer'

interface StaffMemberCardProps {
  name: string
  photoUrl?: string
  twitter?: string
  twitch?: string
  youtube?: string
  instagram?: string
}

export function StaffMemberCard({
  name,
  photoUrl,
  twitter,
  twitch,
  youtube,
  instagram,
}: StaffMemberCardProps) {
  return (
    <Link
      href={`/players/${formatPlayerSlug(name)}`}
      className="group flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-background to-background/50 hover:border-primary/50 hover:shadow-lg transition-all"
    >
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all overflow-hidden">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={name}
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-lg font-bold text-primary">{name.charAt(0)}</span>
        )}
      </div>
      <span className="flex-1 font-bold group-hover:text-primary transition-colors">{name}</span>
      <div className="opacity-70 group-hover:opacity-100 transition-opacity">
        <SocialLinks links={{ twitter, twitch, youtube, instagram }} />
      </div>
    </Link>
  )
}

