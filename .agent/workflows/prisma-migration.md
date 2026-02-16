---
description: How to safely manage Prisma schema migrations for the scrim analytics tables
---

# Prisma Database Migration Safety

> **CRITICAL**: This project shares a PostgreSQL database between Payload CMS and Prisma. Prisma only manages the `scrim_*` tables — all other tables are managed by Payload.

## ❌ NEVER Do This

```bash
# DO NOT run prisma db push — it will DROP all Payload tables!
npx prisma db push  # DANGEROUS - treats Prisma schema as sole source of truth
```

`prisma db push` sees that Payload's tables (users, teams, matches, etc.) are not in the Prisma schema and marks them for deletion. Even with the confirmation prompt, this is a catastrophic risk.

## ✅ Safe Migration Process

### 1. Generate the SQL diff

```bash
# From empty (first time):
DATABASE_URI='postgresql://payload:payload@localhost:5432/payload' \
  npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > /tmp/scrim-tables.sql

# From current DB state (subsequent changes):
DATABASE_URI='postgresql://payload:payload@localhost:5432/payload' \
  npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > /tmp/scrim-migration.sql
```

### 2. Review the SQL

```bash
# Verify NO DROP statements target non-scrim tables
grep 'DROP' /tmp/scrim-migration.sql
# All DROP/ALTER should only reference scrim_* tables
```

### 3. Apply via Docker

```bash
# psql is not installed on the host — run through Docker
docker compose exec -T postgres psql -U payload -d payload -f - < /tmp/scrim-migration.sql
```

### 4. Regenerate the Prisma client

```bash
npx prisma generate
```

## Notes

- The `DATABASE_URI` in `.env` uses `postgres` as hostname (Docker service name), which is unreachable from the host. Override with `localhost` when running Prisma CLI commands.
- The `build` script in `package.json` includes `prisma generate` before `next build` — this is safe and does not touch the database.
- `prisma generate` is always safe to run — it only generates TypeScript types from the schema file.
