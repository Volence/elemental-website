#!/usr/bin/env node
// Migration script to populate displayName for existing OrganizationStaff and Production records
// Run this once to fix existing records that have null displayName

import pg from 'pg'
const { Client } = pg

async function populateDisplayNames() {
  const client = new Client({
    connectionString: process.env.DATABASE_URI,
  })

  try {
    await client.connect()
    console.log('Connected to database')

    // Get all organization_staff records with null displayName
    const orgStaffResult = await client.query(`
      SELECT id, person_id, slug 
      FROM organization_staff 
      WHERE display_name IS NULL OR display_name = ''
    `)

    console.log(`Found ${orgStaffResult.rows.length} organization_staff records with null displayName`)

    for (const staff of orgStaffResult.rows) {
      let displayName = null
      
      if (staff.person_id) {
        // Get person's name
        const personResult = await client.query(
          'SELECT name FROM people WHERE id = $1',
          [staff.person_id]
        )
        
        if (personResult.rows.length > 0 && personResult.rows[0].name) {
          displayName = personResult.rows[0].name.trim()
        }
      }
      
      // Fallback to slug if person name not found
      if (!displayName && staff.slug) {
        displayName = staff.slug.trim()
      }
      
      // Final fallback
      if (!displayName) {
        displayName = '[Untitled]'
      }
      
      // Update the record
      await client.query(
        'UPDATE organization_staff SET display_name = $1 WHERE id = $2',
        [displayName, staff.id]
      )
      console.log(`✓ Updated org staff ${staff.id}: ${displayName}`)
    }

    // Get all production records with null displayName
    const productionResult = await client.query(`
      SELECT id, person_id, slug 
      FROM production 
      WHERE display_name IS NULL OR display_name = ''
    `)

    console.log(`Found ${productionResult.rows.length} production records with null displayName`)

    for (const prod of productionResult.rows) {
      let displayName = null
      
      if (prod.person_id) {
        // Get person's name
        const personResult = await client.query(
          'SELECT name FROM people WHERE id = $1',
          [prod.person_id]
        )
        
        if (personResult.rows.length > 0 && personResult.rows[0].name) {
          displayName = personResult.rows[0].name.trim()
        }
      }
      
      // Fallback to slug if person name not found
      if (!displayName && prod.slug) {
        displayName = prod.slug.trim()
      }
      
      // Final fallback
      if (!displayName) {
        displayName = '[Untitled]'
      }
      
      // Update the record
      await client.query(
        'UPDATE production SET display_name = $1 WHERE id = $2',
        [displayName, prod.id]
      )
      console.log(`✓ Updated production ${prod.id}: ${displayName}`)
    }

    console.log('\n✓ Migration complete! All displayName fields have been populated.')
    
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

// Run migration
if (!process.env.DATABASE_URI) {
  console.error('Error: DATABASE_URI environment variable is not set')
  console.error('\nFor local Docker setup, run:')
  console.error('  docker compose exec payload node populate-display-names.mjs')
  console.error('\nOr set DATABASE_URI manually:')
  console.error('  export DATABASE_URI="postgresql://payload:payload@postgres:5432/payload"')
  console.error('  node populate-display-names.mjs')
  process.exit(1)
}

populateDisplayNames()
  .then(() => {
    console.log('Migration completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
