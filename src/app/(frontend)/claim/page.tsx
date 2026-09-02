import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { findClaimCandidates, discordNamesOf } from '@/identity/people'
import { safeReturnPath } from '@/auth/safeReturnPath'
import ClaimChoices from './ClaimChoices'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Is this you? | Elemental' }

export default async function ClaimPage({ searchParams }: { searchParams: Promise<{ returnUrl?: string }> }) {
  const { returnUrl: raw } = await searchParams
  const returnUrl = safeReturnPath(raw, process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000')
  const token = (await cookies()).get('payload-token')?.value
  if (!token) redirect(`/api/auth/discord?returnUrl=${encodeURIComponent(`/claim?returnUrl=${returnUrl}`)}`)

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })
  const u = user as any
  if (!u?.discordId) redirect(returnUrl)

  const candidates = await findClaimCandidates(payload, discordNamesOf({ username: u.discordUsername ?? u.name, displayName: u.name }))
  if (candidates.length === 0) redirect(returnUrl)

  return (
    <main className="container mx-auto px-4 py-16 max-w-md">
      <h1 className="text-2xl font-semibold mb-2">Is one of these you?</h1>
      <p className="text-muted-foreground mb-6">
        We found existing profiles with a similar name. If one is yours, a manager will confirm and your history moves over. You can keep using the site either way.
      </p>
      <ClaimChoices candidates={candidates.map((c) => ({ id: c.id, name: c.name, teams: c.teams }))} returnUrl={returnUrl} />
    </main>
  )
}
