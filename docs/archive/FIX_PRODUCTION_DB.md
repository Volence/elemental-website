# Fix Production Database Connection Error

## Error You're Seeing
```
Error: cannot connect to Postgres. Details: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
```

## Root Cause
The `DATABASE_URI` environment variable is either:
1. Not set in `.env.production`
2. Has the password in wrong format
3. Password has special characters that aren't URL-encoded

## Quick Fix (Run on Production Server)

### Step 1: SSH into your production server
```bash
ssh your-production-server
cd /path/to/elemental-website
```

### Step 2: Run the diagnostic script
```bash
./scripts/check-production-env.sh
```

This will tell you what's missing or wrong.

### Step 3: Run the fix script
```bash
./scripts/fix-production-database-connection.sh
```

This will automatically detect your database credentials and fix the `DATABASE_URI`.

### Step 4: Restart Payload
```bash
docker compose -f docker-compose.prod.yml restart payload
```

### Step 5: Check logs
```bash
docker compose -f docker-compose.prod.yml logs payload | grep -E "Ready|ERROR"
```

You should see: `✓ Ready in XXXms`

## Manual Fix (If Scripts Don't Work)

### 1. Check your docker-compose.prod.yml

Look for the postgres service and note these values:
```yaml
postgres:
  environment:
    POSTGRES_USER: payload        # <- This is your username
    POSTGRES_PASSWORD: yourpass   # <- This is your password
    POSTGRES_DB: elemental        # <- This is your database name
```

### 2. Create/Edit .env.production

```bash
nano .env.production
```

Add or update this line (replace with YOUR values):
```env
DATABASE_URI="postgresql://payload:yourpass@postgres:5432/elemental"
```

**Important formatting:**
- Wrap the ENTIRE string in quotes: `DATABASE_URI="..."`
- Format: `postgresql://username:password@host:port/database`
- Host is usually `postgres` (the docker service name)
- Port is usually `5432`

### 3. Special Characters in Password?

If your password has special characters like `@`, `#`, `$`, `%`, etc., you need to URL-encode them:

```bash
# Use this command to encode your password
echo -n "your_password" | jq -sRr @uri
```

Example:
- Password: `my@pass#123`
- Encoded: `my%40pass%23123`
- Full URI: `postgresql://payload:my%40pass%23123@postgres:5432/elemental`

### 4. Restart and Test

```bash
# Restart payload
docker compose -f docker-compose.prod.yml restart payload

# Watch logs
docker compose -f docker-compose.prod.yml logs -f payload
```

Press `Ctrl+C` to stop watching logs.

## Still Not Working?

### Check if postgres is running:
```bash
docker compose -f docker-compose.prod.yml ps
```

All services should show "Up".

### Test database connection directly:
```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U payload -d elemental -c "SELECT COUNT(*) FROM teams;"
```

This should show a count of your teams. If this works, the database is fine and the issue is only with the connection string.

### Check environment variables are loaded:
```bash
docker compose -f docker-compose.prod.yml exec payload env | grep DATABASE_URI
```

This should show your DATABASE_URI. If it's blank, the .env.production file isn't being loaded.

## Common Mistakes

1. ❌ `DATABASE_URI=postgresql://...` (no quotes)
   ✅ `DATABASE_URI="postgresql://..."` (with quotes)

2. ❌ Password with `@` symbol: `pass@word`
   ✅ URL-encoded: `pass%40word`

3. ❌ Wrong host: `DATABASE_URI="postgresql://...@localhost:5432/..."`
   ✅ Correct host: `DATABASE_URI="postgresql://...@postgres:5432/..."`

4. ❌ File not loaded: `.env.production` exists but docker-compose doesn't reference it
   ✅ Check `docker-compose.prod.yml` has `env_file: .env.production`

## Need More Help?

Share the output of these commands:

```bash
# 1. Check docker-compose config
cat docker-compose.prod.yml | grep -A 10 "postgres:"

# 2. Check if .env.production exists
ls -la .env*

# 3. Check environment variables (without showing sensitive data)
docker compose -f docker-compose.prod.yml exec payload env | grep -E "DATABASE|PAYLOAD_SECRET" | sed 's/=.*/=***/'
```
