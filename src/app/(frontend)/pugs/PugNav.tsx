'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { PugNavItem } from './navItems'

function isActive(pathname: string, href: string): boolean {
  if (href === '/pugs') return pathname === '/pugs'
  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * Section navigation for the public PUG pages. Rendered once by `pugs/layout.tsx`;
 * the active item follows the URL so every page under /pugs agrees.
 */
export function PugNav({ items }: { items: PugNavItem[] }) {
  const pathname = usePathname() || ''
  return (
    <nav
      aria-label="PUG sections"
      className="flex items-center gap-1 mb-6 p-1 bg-card/50 border border-border rounded-xl w-fit max-w-full overflow-x-auto"
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              active
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
