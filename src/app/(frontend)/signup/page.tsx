import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sign Up | Elemental' }

async function getUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value
  if (!token) return null

  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })
    return user as any
  } catch {
    return null
  }
}

const discordIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.04.03.05a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
)

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await getUser()
  const { error } = await searchParams

  if (user) {
    return (
      <main className="container mx-auto px-4 py-16 max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">You're already signed in</h1>
        <p className="text-gray-400 mb-6">
          Logged in as <span className="text-white font-medium">{user.name || user.email}</span>
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/admin" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            Go to Dashboard
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 flex items-center transition-colors">
            Home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-16 max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Join Elemental</h1>
        <p className="text-gray-400">
          Sign up with your Discord account to get started.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6 text-sm text-red-300">
          Something went wrong. Please try again.
        </div>
      )}

      <a
        href="/api/auth/discord?signup=true&returnUrl=/admin"
        className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-[#5865F2] text-white rounded-lg hover:bg-[#4752c4] font-medium transition-colors text-lg"
      >
        {discordIcon}
        Continue with Discord
      </a>

      <p className="text-xs text-gray-500 mt-3 text-center">
        Signs you in if you already have an account, or creates one automatically.
      </p>

      <p className="text-xs text-gray-600 mt-8 text-center">
        Already have an account?{' '}
        <Link href="/admin/login" className="text-blue-400 hover:underline">Log in</Link>
      </p>
    </main>
  )
}
