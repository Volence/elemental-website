import React from 'react'
import Link from 'next/link'
import NextImage from 'next/image'
import { SocialLinks } from '@/components/SocialLinks'
import { formatPlayerSlug } from '@/utilities/getPlayer'

interface StaffMemberCardProps {
  name: string
  photoUrl?: string | null
  socialLinks: {
    twitter?: string
    twitch?: string
    youtube?: string
    instagram?: string
  }
  avatarColors: {
    from: string
    to: string
    text: string
    ring: string
  }
}

export function StaffMemberCard({
  name,
  photoUrl,
  socialLinks,
  avatarColors,
}: StaffMemberCardProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-card to-card/50 hover:border-primary/50 hover:shadow-lg hover:scale-[1.02] transition-all group">
      <div
        className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${avatarColors.from} ${avatarColors.to} flex items-center justify-center flex-shrink-0 ring-2 ${avatarColors.ring} group-hover:ring-primary/40 transition-all overflow-hidden`}
      >
        {photoUrl ? (
          <NextImage
            src={photoUrl}
            alt={name}
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className={`text-base font-bold ${avatarColors.text}`}>{initials}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/players/${formatPlayerSlug(name)}`}
          className="block text-sm font-bold group-hover:text-primary transition-colors truncate mb-1"
        >
          {name}
        </Link>
        <div className="scale-90 origin-left">
          <SocialLinks links={socialLinks} />
        </div>
      </div>
    </div>
  )
}

