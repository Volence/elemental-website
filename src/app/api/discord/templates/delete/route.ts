import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@/payload.config'
import { getPayload } from 'payload'

export async function POST(request: NextRequest) {
  try {
    const { templateId } = await request.json()

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    // Delete the template
    await payload.delete({
      collection: 'discord-category-templates',
      id: templateId,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    )
  }
}
