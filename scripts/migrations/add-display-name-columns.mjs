#!/usr/bin/env node
// Migration script to add display_name column to organization_staff and production tables
// Run this before populate-display-names.mjs

import pg from 'pg'
const { Client } = pg

async function addDisplayNameColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URI,
  })

  try {
    await client.connect()
    console.log('Connected to database')

    // Add display_name column to organization_staff if it doesn't exist
    try {
      await client.query(`
        ALTER TABLE organization_staff 
        ADD COLUMN IF NOT EXISTS display_name TEXT
      `)
      console.log('✓ Added display_name column to organization_staff (or it already exists)')
    } catch (error) {
      if (error.code === '42701') {
        // Column already exists
        console.log('✓ display_name column already exists in organization_staff')
      } else {
        throw error
      }
    }

    // Add display_name column to production if it doesn't exist
    try {
      await client.query(`
        ALTER TABLE production 
        ADD COLUMN IF NOT EXISTS display_name TEXT
      `)
      console.log('✓ Added display_name column to production (or it already exists)')
    } catch (error) {
      if (error.code === '42701') {
        // Column already exists
        console.log('✓ display_name column already exists in production')
      } else {
        throw error
      }
    }

    console.log('\n✓ Schema migration complete! The display_name columns have been added.')
    console.log('Next step: Run populate-display-names.mjs to populate the values.')

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
  console.error('  docker compose exec payload node add-display-name-columns.mjs')
  console.error('\nOr set DATABASE_URI manually:')
  console.error('  export DATABASE_URI="postgresql://payload:payload@postgres:5432/payload"')
  console.error('  node add-display-name-columns.mjs')
  process.exit(1)
}

addDisplayNameColumns()
  .then(() => {
    console.log('Migration completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
