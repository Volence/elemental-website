#!/usr/bin/env node
// Migration script to make name columns nullable in staff tables
// This fixes the schema mismatch where database has NOT NULL name columns
// but Payload schema no longer includes them (we use People relationships instead)

import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const { Client } = pg

// Try to load .env file if DATABASE_URI is not set
if (!process.env.DATABASE_URI) {
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const envPath = join(__dirname, '.env')
    const envFile = readFileSync(envPath, 'utf-8')
    envFile.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value
        }
      }
    })
  } catch (e) {
    // .env file not found or couldn't be read, that's OK
  }
}

async function fixSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URI,
  })

  try {
    await client.connect()
    console.log('Connected to database')

    // Tables to fix
    const tables = [
      'organization_staff',
      'production',
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
    console.log('The name columns are now nullable and creating staff entries should work.')
    
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
  console.error('  docker compose exec payload node fix-schema-staff-name-columns.mjs')
  console.error('\nOr set DATABASE_URI manually:')
  console.error('  export DATABASE_URI="postgresql://payload:payload@postgres:5432/payload"')
  console.error('  node fix-schema-staff-name-columns.mjs')
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
