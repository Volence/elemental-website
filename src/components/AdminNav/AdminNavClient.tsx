'use client'

import React, { useEffect, useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Hamburger, Link, NavGroup, useNav } from '@payloadcms/ui'
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Calendar,
  CalendarDays,
  Clapperboard,
  FileText,
  Fingerprint,
  Folder,
  Gamepad2,
  Home,
  Link as LinkIcon,
  Map as MapIcon,
  MessageCircle,
  Megaphone,
  Palette,
  PartyPopper,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Tv,
  User,
  Users,
  Video,
  Flag,
} from 'lucide-react'
import { DASHBOARD_ITEM, resolveActiveItemId, type NavArea, type NavIconName, type NavItem } from './buildNav'

const baseClass = 'nav'
const SCROLL_KEY = 'elemental-sidebar-scroll'

const ICONS: Record<NavIconName, React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = {
  home: Home,
  user: User,
  chart: BarChart3,
  calendar: Calendar,
  users: Users,
  shield: Shield,
  clapperboard: Clapperboard,
  fingerprint: Fingerprint,
  link: LinkIcon,
  'badge-check': BadgeCheck,
  swords: Swords,
  flag: Flag,
  gamepad: Gamepad2,
  trophy: Trophy,
  sparkles: Sparkles,
  map: MapIcon,
  tv: Tv,
  megaphone: Megaphone,
  palette: Palette,
  video: Video,
  party: PartyPopper,
  folder: Folder,
  message: MessageCircle,
  'calendar-days': CalendarDays,
  'file-text': FileText,
  activity: Activity,
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = ICONS[item.icon]
  return (
    <Link
      className={`${baseClass}__link elmt-nav__link${active ? ' elmt-nav__link--active' : ''}`}
      href={item.href}
      id={item.id}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
    >
      {active && <div className={`${baseClass}__link-indicator`} />}
      <Icon size={16} aria-hidden />
      <span className={`${baseClass}__link-label`}>{item.label}</span>
    </Link>
  )
}

export interface AdminNavClientProps {
  areas: NavArea[]
  /** Payload's per-user nav preference: which groups are open. */
  groupPrefs: Record<string, { open?: boolean } | undefined>
  logout: React.ReactNode
}

/**
 * Sidebar body. Same shell classes as Payload's DefaultNav so its layout,
 * mobile drawer and animation still apply; the contents come from buildNav.
 */
export function AdminNavClient({ areas, groupPrefs, logout }: AdminNavClientProps) {
  const { hydrated, navOpen, navRef, setNavOpen, shouldAnimate } = useNav()
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()

  const activeId = useMemo(() => resolveActiveItemId(areas, pathname, searchParams), [areas, pathname, searchParams])

  // Keep the sidebar's scroll position across navigations (Payload remounts the nav on every page).
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    try {
      const saved = sessionStorage.getItem(SCROLL_KEY)
      if (saved) el.scrollTop = parseInt(saved, 10)
    } catch {
      /* storage unavailable */
    }
    const onScroll = () => {
      try {
        sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop))
      } catch {
        /* storage unavailable */
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [navRef])

  const asideClass = [
    baseClass,
    'elmt-nav',
    navOpen && `${baseClass}--nav-open`,
    shouldAnimate && `${baseClass}--nav-animate`,
    hydrated && `${baseClass}--nav-hydrated`,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <aside className={asideClass} inert={!navOpen ? true : undefined}>
      <div className={`${baseClass}__scroll`} ref={navRef}>
        <nav className={`${baseClass}__wrap`} aria-label="Admin">
          <div className="elmt-nav__top">
            <NavLink item={DASHBOARD_ITEM} active={activeId === DASHBOARD_ITEM.id} />
          </div>
          {areas.map((area) => (
            <div key={area.id} className="elmt-nav__area" data-area={area.id}>
              <NavGroup label={area.label} isOpen={groupPrefs[area.label]?.open}>
                {area.items.map((item) => (
                  <NavLink key={item.id} item={item} active={activeId === item.id} />
                ))}
              </NavGroup>
            </div>
          ))}
          <div className={`${baseClass}__controls`}>{logout}</div>
        </nav>
      </div>
      <div className={`${baseClass}__header`}>
        <div className={`${baseClass}__header-content`}>
          <button
            className={`${baseClass}__mobile-close`}
            onClick={() => setNavOpen(false)}
            tabIndex={!navOpen ? -1 : undefined}
            type="button"
            aria-label="Close navigation"
          >
            <Hamburger isActive />
          </button>
        </div>
      </div>
    </aside>
  )
}
