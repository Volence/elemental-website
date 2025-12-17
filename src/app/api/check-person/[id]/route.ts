import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    
    const person = await payload.findByID({
      collection: 'people',
      id: parseInt(id),
      depth: 0,
    })
    
    return NextResponse.json({
      id: person.id,
      name: person.name,
      slug: person.slug,
      nameType: typeof person.name,
      nameLength: person.name?.length,
      nameCharCodes: person.name ? Array.from(person.name).map(c => `${c}(${c.charCodeAt(0)})`) : [],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
