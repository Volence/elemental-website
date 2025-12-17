#!/usr/bin/env node
// Schema initialization script
// Run this to create all database tables

async function initSchema() {
  try {
    console.log('Initializing database schema...');
    console.log('This may take a moment...');
    
    // Verify environment variables
    if (!process.env.PAYLOAD_SECRET) {
      throw new Error('PAYLOAD_SECRET environment variable is not set');
    }
    if (!process.env.DATABASE_URI) {
      throw new Error('DATABASE_URI environment variable is not set');
    }
    
    // PAYLOAD_DB_PUSH must be set to 'true' for schema initialization
    if (process.env.PAYLOAD_DB_PUSH !== 'true') {
      process.env.PAYLOAD_DB_PUSH = 'true';
    }
    
    console.log('Environment variables verified');
    console.log('PAYLOAD_DB_PUSH:', process.env.PAYLOAD_DB_PUSH);
    
    // Import config - use the same approach as build.sh
    const { getPayload } = await import('payload');
    const config = await import('./src/payload.config.ts');
    
    console.log('Config imported, initializing Payload with push mode...');
    console.log('This will create all database tables...');
    
    // getPayload will read PAYLOAD_DB_PUSH from environment and enable push mode
    // The config already checks process.env.PAYLOAD_DB_PUSH === 'true'
    const payload = await getPayload({ config: config.default });
    
    console.log('✓ Schema initialized successfully!');
    console.log('All tables have been created.');
    
    // Close database connection if possible
    try {
      if (payload.db && payload.db.drizzle && typeof payload.db.drizzle.connection === 'function') {
        await payload.db.drizzle.connection().end();
      }
    } catch (e) {
      // Ignore connection closing errors - schema is already initialized
      console.log('Note: Could not close connection (this is OK)');
    }
    
    process.exit(0);
  } catch (error) {
    if (error.message && (error.message.includes('already exists') || error.message.includes('duplicate'))) {
      console.log('✓ Schema already exists');
      process.exit(0);
    } else {
      console.error('✗ Error initializing schema:');
      console.error(error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}

initSchema();
