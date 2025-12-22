#!/usr/bin/env node
/**
 * Run Payload migrations to create database tables for new Globals
 * This script should be run on the production server
 */

import { getPayload } from 'payload'
import config from '../src/payload.config.js'

async function migrateGlobals() {
  console.log('🔄 Starting Payload migration...')
  
  try {
    const payload = await getPayload({ config })
    
    console.log('✅ Payload initialized successfully')
    console.log('📊 Running migrations...')
    
    // Payload automatically creates tables when initialized
    // Just need to trigger a global update to ensure tables exist
    
    try {
      await payload.updateGlobal({
        slug: 'data-consistency',
        data: {},
      })
      console.log('✅ data-consistency global initialized')
    } catch (error) {
      console.log('⚠️  data-consistency:', error.message)
    }
    
    try {
      await payload.updateGlobal({
        slug: 'schedule-generator',
        data: {},
      })
      console.log('✅ schedule-generator global initialized')
    } catch (error) {
      console.log('⚠️  schedule-generator:', error.message)
    }
    
    console.log('✅ Migration complete!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

migrateGlobals()

