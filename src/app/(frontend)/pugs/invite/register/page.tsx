import type { Metadata } from 'next'
import Link from 'next/link'
import { PugNav } from '../../PugNav'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'PUG Invite Registration | Elemental' }

export default async function PugInviteRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-md">
        <PugNav active="invite" />
        <div className="border border-gray-800 rounded-xl bg-gray-900/30 p-6 text-center">
          <h1 className="text-xl font-bold mb-2">Invalid Invite</h1>
          <p className="text-gray-500 text-sm">No invite token provided. Ask an admin for a valid invite link.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-md">
      <PugNav active="invite" />
      <div className="border border-gray-800 rounded-xl bg-gray-900/30 overflow-hidden">
        <div className="p-6">
          <h1 className="text-xl font-bold mb-2">Register for Invite-Tier PUGs</h1>
          <p className="text-gray-500 text-sm mb-6">
            You have been invited to the PUG invite tier. You must be logged in and have Discord linked.
          </p>
          <form action="/api/pug/invite/register" method="POST">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 hover:shadow-md hover:shadow-purple-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              Accept Invitation
            </button>
          </form>
        </div>
        <div className="h-1 bg-gradient-to-r from-purple-600 via-purple-500 to-pink-400 opacity-60" />
      </div>
    </main>
  )
}
