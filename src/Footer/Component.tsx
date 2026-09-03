import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'
import { Twitter, Youtube, Instagram, MessageCircle } from 'lucide-react'

import type { Footer as FooterGlobal } from '@/payload-types'

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

const STORE_URL = 'https://elmt-shop.fourthwall.com'

/** Mirrors the header's primary navigation so the two agree. */
const quickLinks = [
  { label: 'Teams', href: '/teams' },
  { label: 'Matches', href: '/matches' },
  { label: 'Live', href: '/live' },
  { label: 'Seminars', href: '/seminars' },
  { label: 'Calendar', href: '/calendar' },
  { label: 'Staff', href: '/staff' },
]

const socialLinks = [
  { name: 'Instagram', icon: Instagram, href: 'https://www.instagram.com/elmt_gg/', gradient: 'linear-gradient(to bottom right, rgb(168 85 247), rgb(236 72 153))' },
  { name: 'TikTok', icon: TikTokIcon, href: 'https://www.tiktok.com/@elmt_gg', gradient: 'linear-gradient(to bottom right, rgb(34 211 238), rgb(236 72 153))' },
  { name: 'YouTube', icon: Youtube, href: 'https://www.youtube.com/@ELMT_GG', gradient: 'linear-gradient(to bottom right, rgb(239 68 68), rgb(220 38 38))' },
  { name: 'Twitter', icon: Twitter, href: 'https://x.com/ELMT_GG', gradient: 'linear-gradient(to bottom right, rgb(96 165 250), rgb(59 130 246))' },
  { name: 'Discord', icon: MessageCircle, href: 'https://discord.gg/elmt', gradient: 'linear-gradient(to bottom right, rgb(99 102 241), rgb(79 70 229))' },
]

const linkClass = 'text-muted-foreground hover:text-primary transition-colors font-medium'

type NavItems = NonNullable<FooterGlobal['navItems']>

function FooterBody({ navItems }: { navItems: NavItems }) {
  return (
    <footer className="mt-auto border-t border-border bg-black dark:bg-card text-white">
      {/* Gradient accent line */}
      <div className="h-1 bg-gradient-to-r from-[hsl(var(--accent-blue))] via-[hsl(var(--accent-green))] to-[hsl(var(--accent-gold))] shadow-[0_0_20px_rgba(56,189,248,0.4)]" />

      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Column 1: Logo + Description */}
          <div className="flex flex-col gap-4">
            <Link className="flex items-center" href="/">
              <Logo className="scale-110" />
            </Link>
            <p className="text-base text-muted-foreground max-w-xs leading-relaxed">
              Elemental (ELMT) - A premier Overwatch organization competing at the highest levels.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Quick Links</h3>
            <nav aria-label="Footer" className="flex flex-col gap-3">
              {quickLinks.map(({ label, href }) => (
                <Link key={href} href={href} className={linkClass}>
                  {label}
                </Link>
              ))}
              <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                Shop
              </a>
              {navItems.map(({ link }, i) => (
                <CMSLink className={linkClass} key={i} {...link} />
              ))}
            </nav>
          </div>

          {/* Column 3: Social Media */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Follow Us</h3>
            <div className="flex flex-wrap gap-4">
              {socialLinks.map(({ name, icon: Icon, href, gradient }) => (
                <Link
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-center w-12 h-12 rounded-lg text-white transition-all hover:scale-110 relative overflow-hidden"
                  aria-label={name}
                >
                  <div className="absolute inset-0 bg-white/10 transition-opacity duration-300" />
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: gradient }}
                  />
                  <Icon className="w-6 h-6 relative z-10" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Elemental (ELMT). All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export async function Footer() {
  // Skip database operations during build
  if (process.env.NEXT_BUILD_SKIP_DB) {
    return <FooterBody navItems={[]} />
  }

  let navItems: NavItems = []
  try {
    const footerData: FooterGlobal = await getCachedGlobal('footer', 1)()
    navItems = footerData?.navItems || []
  } catch (_error) {
    // Database unavailable (build, cold start): render the static footer
  }

  return <FooterBody navItems={navItems} />
}
