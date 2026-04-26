import type { Metadata } from 'next'

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
        <h1 className="text-2xl font-bold mb-4">Invalid Invite</h1>
        <p className="text-gray-600">No invite token provided. Ask an admin for a valid invite link.</p>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-md">
      <h1 className="text-2xl font-bold mb-4">Register for Invite-Tier PUGs</h1>
      <p className="text-gray-600 mb-6">
        You have been invited to the PUG invite tier. You must be logged in and have Discord linked.
      </p>
      <form action="/api/pug/invite/register" method="POST">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Accept Invitation
        </button>
      </form>
    </main>
  )
}
