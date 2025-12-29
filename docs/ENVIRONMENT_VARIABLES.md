# Environment Variables

This document lists all required and optional environment variables for the Elemental website.

## Required Variables

### Database
```bash
DATABASE_URI=postgresql://user:password@localhost:5432/elemental
POSTGRES_PASSWORD=your_postgres_password
```
- **DATABASE_URI**: Full PostgreSQL connection string
- **POSTGRES_PASSWORD**: Password for the PostgreSQL database

### Payload CMS
```bash
PAYLOAD_SECRET=your_payload_secret_key_here
```
- **PAYLOAD_SECRET**: Secret key for Payload CMS encryption and sessions
- Generate a secure value: `openssl rand -hex 32`

### Server
```bash
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```
- **NEXT_PUBLIC_SERVER_URL**: Base URL of your application
  - Local: `http://localhost:3000`
  - Production: `https://your-domain.com`

### FaceIt API
```bash
FACEIT_API_KEY=your_faceit_api_key_here
```
- **FACEIT_API_KEY**: API key for FaceIt integration
- Obtain from: [FaceIt Developer Portal](https://developers.faceit.com/)

## Production-Only Variables

### Cron Jobs
```bash
CRON_SECRET=your_secure_random_string_here
```
- **CRON_SECRET**: Secret for authenticating cron job requests
- Generate a secure value: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Required for automated FaceIt syncing (see [FACEIT_CRON_SETUP.md](./FACEIT_CRON_SETUP.md))

### S3 Storage (Optional)
```bash
S3_ENABLED=true
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```
- **S3_ENABLED**: Set to `true` to use S3 for media storage (recommended for production)
- **S3_BUCKET**: Name of your S3 bucket
- **S3_REGION**: AWS region (e.g., `us-east-1`, `us-west-2`)
- **S3_ACCESS_KEY_ID**: AWS IAM access key
- **S3_SECRET_ACCESS_KEY**: AWS IAM secret key

## Local Development Setup

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Fill in your local values:
```env
# Database (from docker-compose.yml)
DATABASE_URI=postgresql://postgres@localhost:5432/elemental
POSTGRES_PASSWORD=

# Payload (generate a random string)
PAYLOAD_SECRET=abc123yoursecrethere

# Server (local development)
NEXT_PUBLIC_SERVER_URL=http://localhost:3000

# FaceIt (get from FaceIt Developer Portal)
FACEIT_API_KEY=your_api_key_here

# Cron (not needed locally)
# CRON_SECRET=not_needed_for_local_dev
```

3. Restart your development server

## Production Setup (Vercel)

Add environment variables in Vercel Dashboard:

1. Go to your project → Settings → Environment Variables
2. Add each variable with appropriate values
3. Set environment: Production, Preview, or Development
4. Redeploy after adding variables

### Recommended Vercel Settings

| Variable | Environment | Notes |
|----------|------------|-------|
| `DATABASE_URI` | Production | Use production PostgreSQL URL |
| `POSTGRES_PASSWORD` | Production | Production database password |
| `PAYLOAD_SECRET` | All | Use same value across all environments |
| `NEXT_PUBLIC_SERVER_URL` | Production | `https://your-domain.com` |
| `FACEIT_API_KEY` | All | FaceIt API key |
| `CRON_SECRET` | Production | Only needed in production |
| `S3_ENABLED` | Production | Set to `true` for production |
| `S3_BUCKET` | Production | Production S3 bucket |
| `S3_REGION` | Production | AWS region |
| `S3_ACCESS_KEY_ID` | Production | AWS credentials |
| `S3_SECRET_ACCESS_KEY` | Production | AWS credentials |

## Generating Secure Secrets

### PAYLOAD_SECRET
```bash
# Option 1: OpenSSL
openssl rand -hex 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Online tool
# Visit: https://generate-secret.vercel.app/32
```

### CRON_SECRET
```bash
# Generate 32-byte random hex string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

⚠️ **Security Note:** Keep all secrets secure. Never commit them to git or share them publicly.

## Troubleshooting

### "Missing required environment variable"
- Check that all required variables are set
- Verify variable names match exactly (case-sensitive)
- Restart the development server after adding variables

### Database connection errors
- Verify `DATABASE_URI` format is correct
- Check that PostgreSQL is running (Docker: `docker compose ps`)
- Test connection: `psql $DATABASE_URI`

### FaceIt API not working
- Verify `FACEIT_API_KEY` is set correctly
- Check API key is active in FaceIt Developer Portal
- Test with curl: `curl -H "Authorization: Bearer $FACEIT_API_KEY" https://open.faceit.com/data/v4/players/...`

### Cron jobs returning 401 Unauthorized
- Verify `CRON_SECRET` is set in production Vercel settings
- Check that the secret matches in your cron configuration
- Ensure header name is `x-cron-secret` (lowercase)

## Related Documentation

- [FaceIt Cron Setup](./FACEIT_CRON_SETUP.md) - Setting up automated syncing
- [Deployment Guide](./deployment/) - Production deployment instructions
- [FaceIt API Reference](./FACEIT_API_COMPLETE_REFERENCE.md) - FaceIt integration details

