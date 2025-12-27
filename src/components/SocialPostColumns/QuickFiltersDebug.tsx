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
        console.log(`[QuickFiltersDebug] Row ${idx + 1} has ${cells.length} cells`)
        if (cells.length >= 6) {
          // Cells: [checkbox, title, postType, platform, scheduledDate, status, assignedTo]
          // But checkbox is not a <td>, so actual indices are:
          // 0: title, 1: postType, 2: platform, 3: scheduledDate, 4: status, 5: assignedTo
          const title = cells[0]?.textContent?.trim()
          const postType = cells[1]?.textContent?.trim()
          const status = cells[4]?.textContent?.trim()
          const assignedTo = cells[5]?.textContent?.trim() // Should be correct now
          console.log(`[QuickFiltersDebug] Row ${idx + 1}:`)
          console.log(`  Title: "${title}"`)
          console.log(`  Post Type: "${postType}"`)
          console.log(`  Status: "${status}"`)
          console.log(`  Assigned To: "${assignedTo}"`)
        }
      })
    }, 1000)
  }, [whereParam])

  return null
}

