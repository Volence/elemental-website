#!/usr/bin/env node
// Migration script to make name columns nullable in teams related tables
// This fixes the schema mismatch where database has NOT NULL name columns
// but Payload schema no longer includes them

import pg from 'pg'
const { Client } = pg

async function fixSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URI,
  })

  try {
    await client.connect()
    console.log('Connected to database')

    // Make name columns nullable in all teams-related tables
    const tables = [
      'teams_manager',
      'teams_coaches', 
      'teams_captain',
      'teams_roster',
      'teams_subs',
    ]

    for (const table of tables) {
      try {
        // Check if name column exists
        const checkResult = await client.query(`
          SELECT column_name, is_nullable 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'name'
        `, [table])

        if (checkResult.rows.length > 0) {
          const isNullable = checkResult.rows[0].is_nullable === 'YES'
          
          if (!isNullable) {
            console.log(`Making name column nullable in ${table}...`)
            // Use identifier quoting for table name (safe since it's from our controlled list)
            await client.query(`
              ALTER TABLE "${table}" 
              ALTER COLUMN name DROP NOT NULL
            `)
            console.log(`✓ Made name nullable in ${table}`)
          } else {
            console.log(`✓ ${table}.name is already nullable`)
          }
        } else {
          console.log(`⚠ ${table} does not have a name column (this is OK)`)
        }
      } catch (error) {
        console.error(`Error fixing ${table}:`, error.message)
        // Continue with other tables
      }
    }

    console.log('\n✓ Schema migration complete!')
    console.log('The name columns are now nullable and seeding should work.')
    
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
  process.exit(1)
}

fixSchema()
  .then(() => {
    console.log('Migration completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
