import { HeaderClient } from './Component.client'
import { getCachedGlobal } from '@/utilities/getGlobals'
import React from 'react'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

import type { Header } from '@/payload-types'

export type NavUser = { name: string | null; email: string; isAdmin: boolean }

async function getCurrentUser(): Promise<NavUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')?.value
    if (!token) return null
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })
    if (!user) return null
    const u = user as any
    return {
      name: u.name ?? null,
      email: u.email,
      isAdmin: u.departments?.isPugAdmin === true || u.role === 'admin',
    }
  } catch {
    return null
  }
}

export async function Header() {
  // Skip database operations during build
  if (process.env.NEXT_BUILD_SKIP_DB) {
    return <HeaderClient data={{} as Header} user={null} />
  }

  try {
    const [headerData, user] = await Promise.all([
      getCachedGlobal('header', 1)(),
      getCurrentUser(),
    ])
    return <HeaderClient data={headerData} user={user} />
  } catch (_error) {
    return <HeaderClient data={{} as Header} user={null} />
  }
}
