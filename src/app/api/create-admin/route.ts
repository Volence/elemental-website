import { getPayload } from 'payload'
import config from '@payload-config'

export const maxDuration = 60

export async function POST(request: Request): Promise<Response> {
  if (process.env.DISABLE_CREATE_ADMIN === 'true') {
    return Response.json({ error: 'Endpoint disabled' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { email, password, name } = body

    if (!email || !password || !name) {
      return Response.json(
        { error: 'Email, password, and name are required' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    const existingUsers = await payload.count({
      collection: 'people',
    })
    if (existingUsers.totalDocs > 0) {
      return Response.json(
        { error: 'Users already exist. This endpoint is only for first-time setup.' },
        { status: 400 },
      )
    }

    const user = await payload.create({
      collection: 'people',
      data: {
        email,
        password,
        name,
        role: 'admin',
      },
    })

    return Response.json({
      success: true,
      message: 'Admin user created successfully!',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error: any) {
    console.error('Error creating admin user:', error)
    return Response.json(
      { error: error.message || 'Failed to create admin user' },
      { status: 500 },
    )
  }
}
