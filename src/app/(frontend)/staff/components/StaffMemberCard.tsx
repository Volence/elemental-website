import React from 'react'
import Link from 'next/link'
import NextImage from 'next/image'
import { SocialLinks } from '@/components/SocialLinks'

interface StaffMemberCardProps {
  name: string
  slug: string
  subtitle?: string
  lead?: boolean
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
  slug,
  subtitle,
  lead,
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
    <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-gradient-to-br from-card to-card/50 shadow-md hover:border-primary/50 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 group">
      <div
        className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${avatarColors.from} ${avatarColors.to} flex items-center justify-center flex-shrink-0 ring-2 ${avatarColors.ring} group-hover:ring-primary/40 transition-all duration-200 overflow-hidden`}
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
          href={`/players/${slug}`}
          className="flex items-center gap-2 text-sm font-bold group-hover:text-primary transition-colors mb-1"
        >
          <span className="truncate">{name}</span>
          {lead && (
            <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">
              Lead
            </span>
          )}
        </Link>
        {subtitle && (
          <span className="block text-xs text-muted-foreground mb-1">{subtitle}</span>
        )}
        <div className="scale-90 origin-left">
          <SocialLinks links={socialLinks} />
        </div>
      </div>
    </div>
  )
}

