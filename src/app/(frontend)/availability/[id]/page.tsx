import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AvailabilityPage({ params }: PageProps) {
  const { id } = await params

  try {
    const payload = await getPayload({ config: configPromise })

    let calendar: any = null
    try {
      calendar = await payload.findByID({
        collection: 'discord-polls' as any,
        id: parseInt(id),
        depth: 1,
        overrideAccess: true,
      })
      if (calendar && (calendar as any).scheduleType !== 'calendar') {
        calendar = null
      }
    } catch {
      calendar = null
    }

    if (!calendar) {
      try {
        calendar = await payload.findByID({
          collection: 'availability-calendars' as any,
          id: parseInt(id),
          depth: 1,
          overrideAccess: true,
        })
      } catch {
        calendar = null
      }
    }

    if (calendar?.team && typeof calendar.team === 'object' && calendar.team.slug) {
      redirect(`/schedule/${calendar.team.slug}?tab=availability`)
    }
  } catch (err) {
    if ((err as any)?.digest?.startsWith('NEXT_REDIRECT')) throw err
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Calendar Not Found</h1>
      <p>This availability calendar doesn&apos;t exist or has been removed.</p>
    </div>
  )
}
