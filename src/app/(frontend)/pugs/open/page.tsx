import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import OpenPageContent from './OpenPageContent'
import { PugNav } from '../PugNav'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Open Tier PUGs | Elemental' }

async function getPageState() {
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value

  const payload = await getPayload({ config: configPromise })

  const activeSeason = await payload.find({
    collection: 'pug-seasons',
    where: { and: [{ tier: { equals: 'open' } }, { active: { equals: true } }] },
    overrideAccess: true,
    limit: 1,
  })
  const season = activeSeason.docs[0] as any

  if (!token) {
    return { currentUser: null, isRegistered: false, isPugAdmin: false, seasonId: season?.id ?? null, seasonName: season?.name ?? null }
  }

  try {
    const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })
    if (!user) {
      return { currentUser: null, isRegistered: false, isPugAdmin: false, seasonId: season?.id ?? null, seasonName: season?.name ?? null }
    }

    const isRegistered = (user as any).pugTiers?.includes('open') ?? false
    const u = user as any
    const isPugAdmin = u.departments?.isPugAdmin === true || u.role === 'admin'

    return {
      currentUser: { id: user.id as number, name: (user as any).name ?? null, email: user.email, battleTag: (user as any).pugBattleTag ?? null },
      isRegistered,
      isPugAdmin,
      seasonId: season?.id ?? null,
      seasonName: season?.name ?? null,
    }
  } catch {
    return { currentUser: null, isRegistered: false, isPugAdmin: false, seasonId: season?.id ?? null, seasonName: season?.name ?? null }
  }
}

export default async function PugOpenPage() {
  const { currentUser, isRegistered, isPugAdmin, seasonId, seasonName } = await getPageState()

  return (
    <main className="container mx-auto px-4 py-8">
      <PugNav active="open" />
      <OpenPageContent
        currentUser={currentUser}
        isRegistered={isRegistered}
        isPugAdmin={isPugAdmin}
        seasonId={seasonId}
        seasonName={seasonName}
      />
    </main>
  )
}
