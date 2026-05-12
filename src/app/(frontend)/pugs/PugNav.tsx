import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/pugs', label: 'Home' },
  { href: '/pugs/open', label: 'Open' },
  { href: '/pugs/invite', label: 'Invite' },
  { href: '/pugs/leaderboard', label: 'Leaderboard' },
]

export function PugNav({ active }: { active?: 'home' | 'open' | 'invite' | 'leaderboard' | 'profile' | 'register' }) {
  return (
    <nav className="flex items-center gap-1 mb-6 p-1 bg-gray-900/50 border border-gray-800 rounded-xl w-fit">
      {NAV_ITEMS.map((item) => {
        const key = item.label.toLowerCase() as string
        const isActive = active === key
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
