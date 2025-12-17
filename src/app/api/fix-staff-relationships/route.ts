import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

/**
 * Fix endpoint to link OrganizationStaff and Production entries to People records
 * 
 * This endpoint matches staff entries to People records by slug.
 * Run this if staff entries have null person relationships.
 * 
 * Usage: POST /api/fix-staff-relationships
 * Requires authentication.
 */
export async function POST() {
  try {
    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    
    // Authenticate the request
    const { user } = await payload.auth({ headers: requestHeaders })
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 403 }
      )
    }
    
    const results = {
      orgStaffFixed: 0,
      productionStaffFixed: 0,
      orgStaffErrors: [] as string[],
      productionStaffErrors: [] as string[],
    }

    // Get all People records for matching
    const allPeople = await payload.find({
      collection: 'people',
      limit: 1000,
      pagination: false,
      depth: 0,
    })
    
    const peopleBySlug = new Map<string, any>()
    allPeople.docs.forEach((person) => {
      if (person.slug) {
        peopleBySlug.set(person.slug.toLowerCase(), person)
      }
    })

    // Fix Organization Staff
    let orgStaff
    try {
      orgStaff = await payload.find({
        collection: 'organization-staff',
        limit: 1000,
        pagination: false,
        depth: 0,
      })
    } catch (findError: unknown) {
      const errorMsg = findError instanceof Error ? findError.message : String(findError)
      if (errorMsg.includes('display_name') || errorMsg.includes('column')) {
        throw new Error(
          `Database schema mismatch: The display_name column is missing from organization_staff table. ` +
          `Please run: docker compose -f docker-compose.prod.yml exec payload node scripts/migrations/add-display-name-columns.mjs`
        )
      }
      throw findError
    }

    for (const staff of orgStaff.docs) {
      // Skip if already has a person relationship
      if (staff.person) {
        continue
      }
      
      // Try to match by slug
      if (staff.slug) {
        const matchingPerson = peopleBySlug.get(staff.slug.toLowerCase())
        if (matchingPerson) {
          try {
            await payload.update({
              collection: 'organization-staff',
              id: staff.id,
              data: {
                person: matchingPerson.id,
              },
              depth: 0,
            })
            results.orgStaffFixed++
            payload.logger.info(`Linked org staff "${staff.slug}" to person "${matchingPerson.name}"`)
          } catch (error: any) {
            results.orgStaffErrors.push(`Org Staff ${staff.slug}: ${error.message}`)
            payload.logger.error(`Failed to link org staff "${staff.slug}": ${error.message}`)
          }
        } else {
          results.orgStaffErrors.push(`Org Staff ${staff.slug}: No matching person found`)
          payload.logger.warn(`No matching person found for org staff slug: "${staff.slug}"`)
        }
      } else {
        results.orgStaffErrors.push(`Org Staff ID ${staff.id}: No slug found`)
      }
    }

    // Fix Production Staff
    let productionStaff
    try {
      productionStaff = await payload.find({
        collection: 'production',
        limit: 1000,
        pagination: false,
        depth: 0,
      })
    } catch (findError: unknown) {
      const errorMsg = findError instanceof Error ? findError.message : String(findError)
      if (errorMsg.includes('display_name') || errorMsg.includes('column')) {
        throw new Error(
          `Database schema mismatch: The display_name column is missing from production table. ` +
          `Please run: docker compose -f docker-compose.prod.yml exec payload node scripts/migrations/add-display-name-columns.mjs`
        )
      }
      throw findError
    }

    for (const staff of productionStaff.docs) {
      // Skip if already has a person relationship
      if (staff.person) {
        continue
      }
      
      // Try to match by slug
      if (staff.slug) {
        const matchingPerson = peopleBySlug.get(staff.slug.toLowerCase())
        if (matchingPerson) {
          try {
            await payload.update({
              collection: 'production',
              id: staff.id,
              data: {
                person: matchingPerson.id,
              },
              depth: 0,
            })
            results.productionStaffFixed++
            payload.logger.info(`Linked production staff "${staff.slug}" to person "${matchingPerson.name}"`)
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            results.productionStaffErrors.push(`Production Staff ${staff.slug}: ${errorMessage}`)
            payload.logger.error(`Failed to link production staff "${staff.slug}": ${errorMessage}`)
          }
        } else {
          results.productionStaffErrors.push(`Production Staff ${staff.slug}: No matching person found`)
          payload.logger.warn(`No matching person found for production staff slug: "${staff.slug}"`)
        }
      } else {
        results.productionStaffErrors.push(`Production Staff ID ${staff.id}: No slug found`)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Staff relationships fixed',
      results,
    })
  } catch (error: unknown) {
    // Extract more detailed error information
    let errorMessage = 'Unknown error occurred'
    let errorDetails: any = null
    
    if (error instanceof Error) {
      errorMessage = error.message
      // Check if it's a database error with more details
      if ('cause' in error && error.cause) {
        errorDetails = error.cause
        if (typeof error.cause === 'object' && error.cause !== null) {
          if ('message' in error.cause) {
            errorMessage = String(error.cause.message)
          }
          if ('code' in error.cause) {
            errorDetails = { ...errorDetails, code: error.cause.code }
          }
        }
      }
    }
    
    // Log full error for debugging
    console.error('[Fix Staff Relationships] Full error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: errorDetails,
        hint: errorMessage.includes('display_name') 
            ? 'The display_name column may be missing. Run: docker compose exec payload node scripts/migrations/add-display-name-columns.mjs'
          : errorMessage.includes('column') 
          ? 'A database column may be missing. Check your database schema matches the Payload config.'
          : undefined,
      },
      { status: 500 }
    )
  }
}
