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

    // Get the existing template to preserve its structure
    const existing = await payload.findByID({
      collection: 'discord-category-templates',
      id: templateId,
    })

    // Update templateData with new roles and channels
    const updatedTemplateData = {
      ...(existing.templateData || {}),
      roles,
      channels,
    }

    // Update the template
    const updated = await payload.update({
      collection: 'discord-category-templates',
      id: templateId,
      data: {
        name,
        description,
        templateData: updatedTemplateData,
        channelCount: channels?.length || 0,
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
