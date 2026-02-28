import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/access/requireAuth'

/**
 * Initialize Globals that don't have database records yet
 * Run this once after deploying new Globals
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { payload } = auth

    // Initialize Data Consistency Global
    try {
      await payload.findGlobal({
        slug: 'data-consistency',
      })
    } catch (error) {
      // Global doesn't exist, create it
      await payload.updateGlobal({
        slug: 'data-consistency',
        data: {},
      })
    }

    // Initialize Production Dashboard Global
    try {
      await payload.findGlobal({
        slug: 'production-dashboard',
      })
    } catch (error) {
      // Global doesn't exist, create it
      await payload.updateGlobal({
        slug: 'production-dashboard',
        data: {},
      })
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

