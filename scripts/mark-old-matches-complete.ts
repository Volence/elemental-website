/**
 * Mark Old Matches as Complete
 * 
 * This script finds all matches with status "scheduled" that are 2+ hours past
 * their scheduled time and marks them as "complete".
 * 
 * Run with: npx tsx scripts/mark-old-matches-complete.ts
 */

import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function markOldMatchesComplete() {
  console.log('🔄 Starting cleanup of old scheduled matches...\n')

  const config = await configPromise
  const payload = await getPayload({ config })

  // Calculate the cutoff time (2 hours ago)
  const twoHoursAgo = new Date()
  twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)

  console.log(`📅 Cutoff time: ${twoHoursAgo.toLocaleString()}`)
  console.log(`   (Any "scheduled" match before this will be marked as "complete")\n`)

  // Find all scheduled matches that are past their date + 2 hours
  const oldMatches = await payload.find({
    collection: 'matches',
    where: {
      and: [
        { status: { equals: 'scheduled' } },
        { date: { less_than: twoHoursAgo.toISOString() } },
      ],
    },
    limit: 1000,
    depth: 0,
  })

  if (oldMatches.docs.length === 0) {
    console.log('✅ No old scheduled matches found. All good!')
    return
  }

  console.log(`📦 Found ${oldMatches.docs.length} old scheduled matches to update:\n`)

  // Group by date for better output
  const byDate = oldMatches.docs.reduce((acc, match) => {
    const date = new Date(match.date).toLocaleDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(match)
    return acc
  }, {})

  Object.keys(byDate).sort().forEach(date => {
    console.log(`  ${date}:`)
    byDate[date].forEach(match => {
      console.log(`    - ${match.title || 'Untitled'} (ID: ${match.id})`)
    })
  })

  console.log('\n🔄 Updating matches to "complete" status...\n')

  let successCount = 0
  let errorCount = 0

  for (const match of oldMatches.docs) {
    try {
      await payload.update({
        collection: 'matches',
        id: match.id,
        data: {
          status: 'complete',
        },
      })
      successCount++
      console.log(`  ✓ ${match.title || 'Untitled'} (ID: ${match.id})`)
    } catch (error) {
      errorCount++
      console.error(`  ✗ Failed to update match ${match.id}:`, error.message)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`✅ Successfully updated: ${successCount} matches`)
  if (errorCount > 0) {
    console.log(`❌ Failed: ${errorCount} matches`)
  }
  console.log('='.repeat(60))

  process.exit(0)
}

markOldMatchesComplete().catch(error => {
  console.error('❌ Script failed:', error)
  process.exit(1)
})

