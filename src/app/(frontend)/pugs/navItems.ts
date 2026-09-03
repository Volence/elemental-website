/**
 * PUG section navigation items. Plain module (no 'use client') so both the server
 * layout and the client PugNav can import it. Importing a non-component export from
 * a client module into a server component yields a client reference, not the array,
 * which is exactly what broke /pugs for signed-in players.
 */
export type PugNavItem = { href: string; label: string }

export const PUG_NAV_ITEMS: PugNavItem[] = [
  { href: '/pugs', label: 'Home' },
  { href: '/pugs/open', label: 'Open' },
  { href: '/pugs/invite', label: 'Invite' },
  { href: '/pugs/leaderboard', label: 'Leaderboard' },
]
