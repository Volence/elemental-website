import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'
import { Twitter, Youtube, Instagram, MessageCircle } from 'lucide-react'

import type { Footer } from '@/payload-types'

import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { CMSLink } from '@/components/Link'
import { Logo } from '@/components/Logo/Logo'

// Simple TikTok icon component
const TikTokIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
)

const socialLinks = [
  { name: 'Instagram', icon: Instagram, href: 'https://www.instagram.com/elmt_gg/' },
  { name: 'TikTok', icon: TikTokIcon, href: 'https://www.tiktok.com/@elementalesports_' },
  { name: 'YouTube', icon: Youtube, href: 'https://www.youtube.com/@ELMT_GG' },
  { name: 'Twitter', icon: Twitter, href: 'https://x.com/ELMT_GG' },
  { name: 'Discord', icon: MessageCircle, href: 'https://discord.gg/elmt' },
]

export async function Footer() {
  // Skip database operations during build
  if (process.env.NEXT_BUILD_SKIP_DB) {
    return (
      <footer className="mt-auto border-t border-border bg-black dark:bg-card text-white">
        <div className="container py-12">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between md:items-start">
            <div className="flex flex-col gap-4">
              <Link className="flex items-center" href="/">
                <Logo />
              </Link>
              <p className="text-sm text-muted-foreground max-w-xs">
                Elemental (ELMT) - A premier Overwatch 2 organization competing at the highest levels.
              </p>
            </div>
            <div className="flex items-center">
              <ThemeSelector />
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Elemental (ELMT). All rights reserved.</p>
          </div>
        </div>
      </footer>
    )
  }

  try {
    const footerData: Footer = await getCachedGlobal('footer', 1)()
    const navItems = footerData?.navItems || []

  return (
    <footer className="mt-auto border-t border-border bg-black dark:bg-card text-white">
      <div className="container py-12">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between md:items-start">
          <div className="flex flex-col gap-4">
            <Link className="flex items-center" href="/">
              <Logo />
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              Elemental (ELMT) - A premier Overwatch 2 organization competing at the highest levels.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {navItems.length > 0 && (
              <nav className="flex flex-col md:flex-row gap-4">
                {navItems.map(({ link }, i) => {
                  return <CMSLink className="text-white hover:text-primary transition-colors" key={i} {...link} />
                })}
              </nav>
            )}
            
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Follow Us</h3>
              <div className="flex gap-4">
                {socialLinks.map(({ name, icon: Icon, href }) => (
                  <Link
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-primary transition-colors"
                    aria-label={name}
                  >
                    <Icon className="w-5 h-5" />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <ThemeSelector />
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Elemental (ELMT). All rights reserved.</p>
        </div>
      </div>
    </footer>
    )
  } catch (_error) {
    // During build, database may not be available or tables may not exist
    // Return footer with default content
    return (
      <footer className="mt-auto border-t border-border bg-black dark:bg-card text-white">
        <div className="container py-12">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between md:items-start">
            <div className="flex flex-col gap-4">
              <Link className="flex items-center" href="/">
                <Logo />
              </Link>
              <p className="text-sm text-muted-foreground max-w-xs">
                Elemental (ELMT) - A premier Overwatch 2 organization competing at the highest levels.
              </p>
            </div>
            <div className="flex items-center">
              <ThemeSelector />
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Elemental (ELMT). All rights reserved.</p>
          </div>
        </div>
      </footer>
    )
  }
}
