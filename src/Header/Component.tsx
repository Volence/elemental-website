import { HeaderClient } from './Component.client'
import { getCachedGlobal } from '@/utilities/getGlobals'
import React from 'react'

import type { Header } from '@/payload-types'

export async function Header() {
  // Skip database operations during build
  if (process.env.NEXT_BUILD_SKIP_DB) {
    return <HeaderClient data={{} as Header} />
  }

  try {
    const headerData: Header = await getCachedGlobal('header', 1)()
    return <HeaderClient data={headerData} />
  } catch (_error) {
    // During build, database may not be available or tables may not exist
    // Return empty header data
    return <HeaderClient data={{} as Header} />
  }
}
