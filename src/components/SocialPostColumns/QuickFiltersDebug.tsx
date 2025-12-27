'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Debug component to log what posts are actually being displayed
 * Temporary - for debugging the My Posts filter issue
 */
export default function QuickFiltersDebug() {
  const searchParams = useSearchParams()
  const whereParam = searchParams.get('where')

  useEffect(() => {
    // Wait a bit for the table to render
    setTimeout(() => {
      const table = document.querySelector('table')
      if (!table) {
        console.log('[QuickFiltersDebug] No table found')
        return
      }

      const rows = table.querySelectorAll('tbody tr')
      console.log('[QuickFiltersDebug] Total rows visible:', rows.length)
      console.log('[QuickFiltersDebug] Current filter:', whereParam)

      rows.forEach((row, idx) => {
        const cells = row.querySelectorAll('td')
        if (cells.length >= 6) {
          const title = cells[0]?.textContent
          const assignedTo = cells[5]?.textContent // ASSIGNED TO column
          console.log(`[QuickFiltersDebug] Row ${idx + 1}: "${title}" -> Assigned to: "${assignedTo}"`)
        }
      })
    }, 1000)
  }, [whereParam])

  return null
}

