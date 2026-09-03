import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Join the Discord first | Elemental' }

export default function NotAMemberPage() {
  const invite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || 'https://discord.gg/elmt'
  return (
    <main className="container mx-auto px-4 py-16 max-w-md text-center space-y-4">
      <h1 className="text-2xl font-semibold">You need to be in the Elemental Discord</h1>
      <p className="text-muted-foreground">
        Accounts are only available to members of the Elemental Discord servers. Join, then sign in again.
      </p>
      <a href={invite} className="inline-block px-4 py-2 rounded-md bg-[#5865F2] text-white font-medium">Join the Discord</a>
      <p><Link href="/api/auth/discord" className="underline">Try signing in again</Link></p>
    </main>
  )
}
