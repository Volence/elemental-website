# Scripts Directory

This directory contains utility scripts for building, deploying, and maintaining the Elemental website.

## Main Scripts

### Build & Deploy
- **`build.sh`** - Main build script that sets up PostgreSQL and builds the Docker image
- **`deploy.sh`** - Quick deployment script (builds and starts containers)
- **`test-build.sh`** - Test build locally
- **`test-build-local.sh`** - Test build with local database

### Database Management
- **`init-database.sh`** - Initialize database schema using init-schema.mjs
- **`init-database-direct.sh`** - Direct database initialization using PAYLOAD_DB_PUSH
- **`init-database-simple.sh`** - Simple database initialization using PAYLOAD_DB_PUSH
- **`init-schema-standalone.sh`** - Initialize schema using init-schema.mjs with CI environment
- **`reset-postgres-password.sh`** - Reset PostgreSQL password (recreates volume, deletes data)
- **`fix-postgres-password.sh`** - Fix PostgreSQL password mismatch

### Database Migrations
- **`run-migrations.sh`** - Run SQL migration scripts (add-display-name-columns.sql, populate-display-names.sql)
- **`run-migration.sh`** - Run a single migration script
- **`force-schema-creation.sh`** - Force Payload to create schema by making API requests
- **`trigger-schema-creation.sh`** - Trigger schema creation by making requests to Payload

### Utilities
- **`check-database.sh`** - Check database status and tables
- **`check-env-production.sh`** - Check if .env.production has all required variables
- **`check-server-status.sh`** - Check server and container status
- **`cleanup-docker.sh`** - Clean up Docker resources to free disk space
- **`restart-with-env.sh`** - Restart containers with proper POSTGRES_PASSWORD
- **`fix-env-and-restart.sh`** - Fix environment variables and restart
- **`backup.sh`** - Backup database and uploads

## Migrations Directory

The `migrations/` subdirectory contains database migration scripts:

### JavaScript Migrations (.mjs)
- **`init-schema.mjs`** - Initialize database schema (creates all tables)
- **`add-display-name-columns.mjs`** - Add display_name columns to organization_staff and production tables
- **`populate-display-names.mjs`** - Populate display_name values from person relationships
- **`fix-schema-name-columns.mjs`** - Fix schema name columns
- **`fix-schema-staff-name-columns.mjs`** - Fix schema staff name columns
- **`seed-water-only.mjs`** - Seed only the Water team

### SQL Migrations (.sql)
- **`add-display-name-columns.sql`** - SQL version: Add display_name columns
- **`populate-display-names.sql`** - SQL version: Populate display_name values
- **`fix-schema-name-columns.sql`** - SQL version: Fix schema name columns
- **`fix-schema-staff-name-columns.sql`** - SQL version: Fix schema staff name columns

## Usage

Most scripts should be run from the project root:

```bash
cd ~/elemental-website
./scripts/build.sh
./scripts/deploy.sh
./scripts/run-migrations.sh
```

Some scripts may need to be run from within the scripts directory or with absolute paths depending on how they reference other files.
