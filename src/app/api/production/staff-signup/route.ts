import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    
    // Get the user from the cookie/session
    const { user } = await payload.auth({ headers: req.headers })
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { matchId, roles } = body // roles: { observer: boolean, producer: boolean, caster: boolean, casterStyle?: string }

    if (!matchId || !roles) {
      return NextResponse.json({ error: 'Missing matchId or roles' }, { status: 400 })
    }

    // Fetch the match
    const match = await payload.findByID({
      collection: 'matches',
      id: matchId,
      depth: 0,
    })

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Get existing production workflow data
    const pw = match.productionWorkflow || {}
    const observerSignups = Array.isArray(pw.observerSignups) ? pw.observerSignups : []
    const producerSignups = Array.isArray(pw.producerSignups) ? pw.producerSignups : []
    const casterSignups = Array.isArray(pw.casterSignups) ? pw.casterSignups : []

    // Add user to the selected role arrays (avoid duplicates)
    if (roles.observer && !observerSignups.includes(user.id)) {
      observerSignups.push(user.id)
    }
    
    if (roles.producer && !producerSignups.includes(user.id)) {
      producerSignups.push(user.id)
    }
    
    if (roles.caster) {
      // Check if user already signed up as caster
      const existingCasterIndex = casterSignups.findIndex((c: any) => {
        const userId = typeof c.user === 'number' ? c.user : c.user?.id
        return userId === user.id
      })
      
      if (existingCasterIndex >= 0) {
        // Update existing signup
        casterSignups[existingCasterIndex] = {
          user: user.id,
          style: roles.casterStyle || undefined,
        }
      } else {
        // Add new signup
        casterSignups.push({
          user: user.id,
          style: roles.casterStyle || undefined,
        })
      }
    }

    // Update the match with new signups
    await payload.update({
      collection: 'matches',
      id: matchId,
      data: {
        productionWorkflow: {
          ...pw,
          observerSignups,
          producerSignups,
          casterSignups,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error signing up for match:', error)
    return NextResponse.json({ error: 'Failed to sign up' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    
    // Get the user from the cookie/session
    const { user } = await payload.auth({ headers: req.headers })
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { matchId, role } = body // role: 'observer' | 'producer' | 'caster'

    if (!matchId || !role) {
      return NextResponse.json({ error: 'Missing matchId or role' }, { status: 400 })
    }

    // Fetch the match
    const match = await payload.findByID({
      collection: 'matches',
      id: matchId,
      depth: 0,
    })

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Get existing production workflow data
    const pw = match.productionWorkflow || {}
    
    // Remove user from the specified role
    let observerSignups = Array.isArray(pw.observerSignups) ? pw.observerSignups : []
    let producerSignups = Array.isArray(pw.producerSignups) ? pw.producerSignups : []
    let casterSignups = Array.isArray(pw.casterSignups) ? pw.casterSignups : []

    if (role === 'observer') {
      observerSignups = observerSignups.filter(id => id !== user.id)
    } else if (role === 'producer') {
      producerSignups = producerSignups.filter(id => id !== user.id)
    } else if (role === 'caster') {
      casterSignups = casterSignups.filter((c: any) => {
        const userId = typeof c.user === 'number' ? c.user : c.user?.id
        return userId !== user.id
      })
    }

    // Update the match
    await payload.update({
      collection: 'matches',
      id: matchId,
      data: {
        productionWorkflow: {
          ...pw,
          observerSignups,
          producerSignups,
          casterSignups,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing signup:', error)
    return NextResponse.json({ error: 'Failed to remove signup' }, { status: 500 })
  }
}




