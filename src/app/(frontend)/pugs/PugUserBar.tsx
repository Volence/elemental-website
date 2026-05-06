'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Props = {
  user: { name?: string | null; email?: string }
  isRegistered: boolean
  isPugAdmin: boolean
}

export default function PugUserBar({ user, isRegistered, isPugAdmin }: Props) {
  const router = useRouter()

  async function signOut() {
    await fetch('/api/people/logout', { method: 'POST' })
    router.refresh()
  }

  return (
    <div className="flex items-center justify-between bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-2.5 mb-6 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-gray-500 shrink-0">Signed in as</span>
        <span className="text-white font-medium truncate">{user.name || user.email}</span>
        {isRegistered ? (
          <span className="text-green-400 shrink-0">· Registered</span>
        ) : (
          <Link href="/pugs/register" className="text-blue-400 hover:underline shrink-0">
            · Register for Open Tier
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4 ml-4 shrink-0">
        {isPugAdmin && (
          <Link href="/admin" className="text-gray-400 hover:text-gray-200 transition-colors">
            Admin
          </Link>
        )}
        <button
          onClick={signOut}
          className="text-gray-500 hover:text-red-400 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
