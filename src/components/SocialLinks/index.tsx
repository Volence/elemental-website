import React from 'react'
import { Twitter, Twitch, Youtube, Instagram, Music2, Link as LinkIcon } from 'lucide-react'
import type { SocialLinks as SocialLinksType } from '@/utilities/getTeams'

interface SocialLinksProps {
  links: SocialLinksType
  className?: string
  showLabels?: boolean
}

export const SocialLinks: React.FC<SocialLinksProps> = ({ links, className = '', showLabels = false }) => {
  if (!links) return null
  
  const { twitter, twitch, youtube, instagram, tiktok, customLinks } = links || {}

  const hasAnyLinks = twitter || twitch || youtube || instagram || tiktok || (customLinks && customLinks.length > 0)
  
  if (!hasAnyLinks) {
    return null
  }

  return (
    <div className={`flex items-center ${showLabels ? 'flex-col gap-3' : 'flex-row gap-2'} ${className}`}>
      {twitter && (
        <a
          href={twitter}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-muted-foreground hover:text-[#1DA1F2] transition-colors"
          aria-label="Twitter"
        >
          <Twitter className="w-4 h-4" />
          {showLabels && <span>Twitter</span>}
        </a>
      )}
      {twitch && (
        <a
          href={twitch}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-muted-foreground hover:text-[#9146FF] transition-colors"
          aria-label="Twitch"
        >
          <Twitch className="w-4 h-4" />
          {showLabels && <span>Twitch</span>}
        </a>
      )}
      {youtube && (
        <a
          href={youtube}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-muted-foreground hover:text-[#FF0000] transition-colors"
          aria-label="YouTube"
        >
          <Youtube className="w-4 h-4" />
          {showLabels && <span>YouTube</span>}
        </a>
      )}
      {instagram && (
        <a
          href={instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-muted-foreground hover:text-[#E4405F] transition-colors"
          aria-label="Instagram"
        >
          <Instagram className="w-4 h-4" />
          {showLabels && <span>Instagram</span>}
        </a>
      )}
      {tiktok && (
        <a
          href={tiktok}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-muted-foreground hover:text-[#00F2EA] transition-colors"
          aria-label="TikTok"
        >
          <Music2 className="w-4 h-4" />
          {showLabels && <span>TikTok</span>}
        </a>
      )}
      {customLinks && customLinks.map((link, index) => (
        <a
          key={index}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          aria-label={link.label}
          title={link.label}
        >
          <LinkIcon className="w-4 h-4" />
          {showLabels && <span>{link.label}</span>}
        </a>
      ))}
    </div>
  )
}

