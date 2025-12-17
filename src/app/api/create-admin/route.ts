import { getPayload } from 'payload'
import config from '@payload-config'

export const maxDuration = 60

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = await getPayload({ config })
    
    // Check if any users exist
    const existingUsers = await payload.find({
      collection: 'users',
      limit: 1,
    })
    
    if (existingUsers.docs.length > 0) {
      return Response.json(
        { error: 'Users already exist. This endpoint is only for first-time setup.' },
        { status: 400 }
      )
    }
    
    // Get data from request
    const body = await request.json()
    const { email, password, name } = body
    
    if (!email || !password || !name) {
      return Response.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      )
    }
    
    // Create the first admin user (bypassing Payload's buggy first-register)
    const user = await payload.create({
      collection: 'users',
      data: {
        email,
        password,
        name,
        role: 'admin', // First user is always admin
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
      { status: 500 }
    )
  }
}
