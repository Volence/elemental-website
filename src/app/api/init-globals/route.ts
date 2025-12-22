import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Initialize Globals that don't have database records yet
 * Run this once after deploying new Globals
 */
export async function GET() {
  try {
    const payload = await getPayload({ config })

    // Initialize Data Consistency Global
    try {
      await payload.findGlobal({
        slug: 'data-consistency',
      })
      console.log('✅ data-consistency global already exists')
    } catch (error) {
      // Global doesn't exist, create it
      await payload.updateGlobal({
        slug: 'data-consistency',
        data: {},
      })
      console.log('✅ Created data-consistency global')
    }

    // Initialize Schedule Generator Global
    try {
      await payload.findGlobal({
        slug: 'schedule-generator',
      })
      console.log('✅ schedule-generator global already exists')
    } catch (error) {
      // Global doesn't exist, create it
      await payload.updateGlobal({
        slug: 'schedule-generator',
        data: {},
      })
      console.log('✅ Created schedule-generator global')
    }

    return NextResponse.json({
      success: true,
      message: 'Globals initialized successfully',
    })
  } catch (error) {
    console.error('❌ Error initializing globals:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

