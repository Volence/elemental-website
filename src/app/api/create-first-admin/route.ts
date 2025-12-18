import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import crypto from 'crypto'

/**
 * Emergency endpoint to create first admin user
 * Bypasses Payload's registerFirstUser which has UUID issues in 3.x
 * 
 * Usage: curl -X POST http://localhost:3000/api/create-first-admin \
 *   -H "Content-Type: application/json" \
 *   -d '{"email":"steve@volence.dev","password":"your-password","name":"Admin"}'
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Check if any users exist
    const existingUsers = await payload.find({
      collection: 'users',
      limit: 1,
      depth: 0,
    })

    if (existingUsers.docs.length > 0) {
      return NextResponse.json(
        { error: 'Users already exist. This endpoint only works for first-time setup.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { email, password, name } = body

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, name' },
        { status: 400 }
      )
    }

    // Generate salt and hash using Node's crypto (same as Payload internally)
    const salt = crypto.randomBytes(32).toString('hex')
    const hash = crypto.pbkdf2Sync(password, salt, 25000, 512, 'sha256').toString('hex')

    // Direct database insert to bypass Payload's auth logic
    const db = payload.db
    
    const drizzle = db.drizzle
    
    if (!drizzle) {
      throw new Error('Database connection not available')
    }

    // Use raw SQL to insert the user with UUID
    const result = await drizzle.execute({
      sql: `
        INSERT INTO users (name, email, role, salt, hash, login_attempts, updated_at, created_at)
        VALUES ($1, $2, $3, $4, $5, 0, NOW(), NOW())
        RETURNING id, name, email, role, created_at
      `,
      params: [name, email, 'admin', salt, hash],
    })

    if (!result.rows || result.rows.length === 0) {
      throw new Error('Failed to create user')
    }

    const user = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully. You can now log in normally.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error: any) {
    console.error('Error creating admin user:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create admin user', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
