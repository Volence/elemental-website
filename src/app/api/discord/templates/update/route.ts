import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@/payload.config'
import { getPayload } from 'payload'

export async function POST(request: NextRequest) {
  try {
    const { templateId, name, description, roles, channels } = await request.json()

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    // Update the template
    const updated = await payload.update({
      collection: 'discord-category-templates',
      id: templateId,
      data: {
        name,
        description,
        roles,
        channels,
      },
    })

    return NextResponse.json({ success: true, template: updated })
  } catch (error: any) {
    console.error('Error updating template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update template' },
      { status: 500 }
    )
  }
}
