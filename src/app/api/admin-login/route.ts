import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'

export const maxDuration = 60

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = await getPayload({ config })
    
    // Get credentials from request
    const body = await request.json()
    const { email, password } = body
    
    if (!email || !password) {
      return Response.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }
    
    // Try to login using Payload's login method (which handles password verification)
    // We'll catch the error and try a direct approach
    try {
      const result = await payload.login({
        collection: 'users',
        data: { email, password },
      })
      
      // Set the token cookie
      const cookieStore = await cookies()
      if (result.token) {
        cookieStore.set('payload-token', result.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7, // 7 days
        })
      }
      
      return Response.json({
        success: true,
        message: 'Login successful!',
        user: result.user,
        token: result.token,
      })
    } catch (loginError: any) {
      // If login fails with the destructuring error, provide manual login URL
      return Response.json(
        { 
          error: 'Payload login bug detected. Please try logging in at /admin directly.',
          details: loginError.message 
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error during login:', error)
    return Response.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    )
  }
}
