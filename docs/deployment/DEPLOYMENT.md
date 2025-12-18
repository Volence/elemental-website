# Production Deployment Guide

This guide will help you deploy your Elemental website to an Oracle Cloud server with a domain from Porkbun.

## Prerequisites

- Oracle Cloud server (Ubuntu/Debian recommended)
- Domain name from Porkbun
- SSH access to your server
- Basic knowledge of Linux commands

## Step 1: Server Setup

### 1.1 Connect to Your Server

```bash
ssh your-user@your-server-ip
```

### 1.2 Update System Packages

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Install Required Software

```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose V2 is included with Docker Desktop and modern Docker installations
# If you need the standalone binary (legacy), use:
# sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
# sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx (for reverse proxy)
sudo apt install nginx -y

# Install Certbot (for SSL certificates)
sudo apt install certbot python3-certbot-nginx -y

# Log out and back in for Docker group to take effect
exit
```

## Step 2: Configure Domain DNS

### 2.1 Get Your Server IP Address

```bash
curl ifconfig.me
```

### 2.2 Configure DNS at Porkbun

1. Log into your Porkbun account
2. Go to your domain's DNS settings
3. Add/Update these records:

**Type A Record:**
- **Name:** `@` (or leave blank for root domain)
- **Type:** `A`
- **Content:** `YOUR_SERVER_IP`
- **TTL:** `600`

**Type A Record for www:**
- **Name:** `www`
- **Type:** `A`
- **Content:** `YOUR_SERVER_IP`
- **TTL:** `600`

**Optional - Type A Record for admin subdomain:**
- **Name:** `admin`
- **Type:** `A`
- **Content:** `YOUR_SERVER_IP`
- **TTL:** `600`

Wait 5-10 minutes for DNS to propagate. Verify with:
```bash
dig elmt.gg
```

## Step 3: Prepare Your Application

### 3.1 Clone Repository on Server

```bash
cd /opt
sudo git clone YOUR_REPO_URL elemental-website
sudo chown -R $USER:$USER elemental-website
cd elemental-website
```

Or upload your code via SCP:
```bash
# From your local machine
scp -r /path/to/elemental-website your-user@your-server-ip:/opt/
```

### 3.2 Update Next.js Config for Production

Edit `next.config.js` to enable standalone output:

```javascript
const nextConfig = {
  output: 'standalone', // Add this line
  images: {
    // ... existing config
  },
  // ... rest of config
}
```

### 3.3 Create Production Environment File

Create `.env.production`:

```bash
# Database
DATABASE_URI=postgresql://payload:YOUR_SECURE_PASSWORD@postgres:5432/payload

# Payload
PAYLOAD_SECRET=your-super-secret-key-change-this-in-production-min-32-chars
PAYLOAD_PUBLIC_SERVER_URL=https://elmt.gg

# Next.js
NEXT_PUBLIC_SERVER_URL=https://elmt.gg
NODE_ENV=production

# Optional: Email (if you set up email)
# PAYLOAD_PUBLIC_EMAIL_FROM=noreply@elmt.gg
# PAYLOAD_PUBLIC_EMAIL_TRANSPORT=smtp
# SMTP_HOST=smtp.yourdomain.com
# SMTP_PORT=587
# SMTP_USER=your-email@yourdomain.com
# SMTP_PASS=your-password
```

**Generate a secure PAYLOAD_SECRET:**
```bash
openssl rand -base64 32
```

### 3.4 Create Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  payload:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - '127.0.0.1:3000:3000'  # Only bind to localhost
    volumes:
      - ./public:/app/public:ro
      - uploads:/app/public/uploads
    env_file:
      - .env.production
    environment:
      - DATABASE_URI=postgresql://payload:${POSTGRES_PASSWORD}@postgres:5432/payload
      - NODE_ENV=production
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    ports:
      - '127.0.0.1:5432:5432'  # Only bind to localhost
    environment:
      - POSTGRES_USER=payload
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=payload
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U payload"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  uploads:
```

Add `POSTGRES_PASSWORD` to `.env.production`:
```bash
POSTGRES_PASSWORD=your-secure-postgres-password-change-this
```

## Step 4: Configure Nginx Reverse Proxy

### 4.1 Create Initial HTTP-Only Nginx Configuration

**IMPORTANT:** We'll start with HTTP-only config, then Certbot will add SSL automatically.

```bash
sudo nano /etc/nginx/sites-available/elemental-website
```

Add this HTTP-only configuration first:

```nginx
server {
    listen 80;
    server_name elmt.gg www.elmt.gg;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name elmt.gg www.elmt.gg;

    # SSL certificates (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/elmt.gg/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/elmt.gg/privkey.pem;

    # Security headers
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Increase upload size (for media uploads)
    client_max_body_size 50M;

    # Proxy to Next.js app
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Serve static files directly
    location /_next/static {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }

    # Serve uploads
    location /uploads {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 1h;
    }
}
```

### 4.2 Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/elemental-website /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

## Step 5: Obtain SSL Certificate

```bash
sudo certbot --nginx -d elmt.gg -d www.elmt.gg
```

Follow the prompts. Certbot will automatically update your Nginx configuration.

### Auto-renewal Setup

Certbot creates a cron job automatically, but verify it:

```bash
sudo certbot renew --dry-run
```

## Step 6: Build and Deploy

### 6.1 Build Docker Images

**Option A: Use the build script (Recommended)**

```bash
cd /opt/elemental-website
chmod +x build.sh
./build.sh
```

**Option B: Manual build**

```bash
cd /opt/elemental-website

# IMPORTANT: Build requires database to be available
# The Next.js build process evaluates pages and needs database access

# Step 1: Start postgres
docker compose -f docker-compose.prod.yml up -d postgres

# Step 2: Wait for postgres to be ready and verify it's accessible
echo "Waiting for postgres to be ready..."
sleep 10
until docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U payload > /dev/null 2>&1; do
  echo "Waiting for postgres..."
  sleep 2
done

# Verify postgres is accessible on localhost:5432
if ! nc -z 127.0.0.1 5432 2>/dev/null; then
  echo "ERROR: Cannot connect to postgres on 127.0.0.1:5432"
  echo "Make sure postgres container is running and port 5432 is accessible"
  exit 1
fi

# Step 3: Get POSTGRES_PASSWORD from environment or .env.production
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(grep POSTGRES_PASSWORD .env.production 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" || echo "payload")}

# Step 4: Build using docker build (NOT docker compose build) with --network host
# This allows the build container to access postgres on localhost
echo "Building with DATABASE_URI=postgresql://payload:***@127.0.0.1:5432/payload"
docker build \
  --network host \
  --build-arg DATABASE_URI="postgresql://payload:${POSTGRES_PASSWORD}@127.0.0.1:5432/payload" \
  -t elemental-website-payload \
  -f Dockerfile .

# Step 5: Verify the build succeeded
if docker images | grep -q elemental-website-payload; then
  echo "✓ Build succeeded!"
else
  echo "✗ Build failed - check the error messages above"
  exit 1
fi
```

**Troubleshooting:**
- If build fails with "cannot connect to Postgres", ensure postgres is running and accessible
- Check that POSTGRES_PASSWORD matches between .env.production and docker-compose.prod.yml
- On some systems, use `172.17.0.1` instead of `host.docker.internal` for the database host

### 6.2 Start Services

**IMPORTANT:** Before starting services, ensure `POSTGRES_PASSWORD` is available to Docker Compose:

```bash
# Option 1: Export from .env.production (if it exists)
export POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

# Option 2: Create a .env file (Docker Compose reads this automatically)
# echo "POSTGRES_PASSWORD=your-password" > .env
```

Then start services:
```bash
# Start all services (postgres should already be running from build step)
docker compose -f docker-compose.prod.yml up -d

# Or if you stopped postgres after building, start everything:
# docker compose -f docker-compose.prod.yml up -d
```

**Note:** Docker Compose needs `POSTGRES_PASSWORD` in the shell environment (or `.env` file) to substitute `${POSTGRES_PASSWORD}` in the docker-compose.yml file. The `env_file` directive only affects variables inside containers.

### 6.3 Check Logs

```bash
docker compose -f docker-compose.prod.yml logs -f
```

### 6.4 Create Admin User

```bash
docker compose -f docker-compose.prod.yml exec payload node -e "
const { getPayload } = require('payload');
const config = require('./src/payload.config.ts');
(async () => {
  const payload = await getPayload({ config });
  await payload.create({
    collection: 'users',
    data: {
      email: 'steve@volence.dev',
      password: 'NsTd2s%TsTW21AMmht6Mp4lH6',
    },
  });
  console.log('Admin user created!');
  process.exit(0);
})();
"
```

Or visit `https://elmt.gg/admin` and create your admin user through the UI.

### 6.5 Troubleshooting 502 Bad Gateway

If you get a **502 Bad Gateway** error when accessing `https://elmt.gg/admin`, follow these steps:

#### **Most Common Issue: Missing POSTGRES_PASSWORD**

If you see warnings like `The "POSTGRES_PASSWORD" variable is not set` or errors like `client password must be a string`, your `.env.production` file is missing `POSTGRES_PASSWORD`.

#### **Database Tables Don't Exist (Error 42P01: relation does not exist)**

If you see errors like `relation "users" does not exist` or `relation "teams" does not exist`, the database schema hasn't been initialized. The database is empty and needs tables created.

**Fix: Initialize database schema**

The schema needs to be initialized once. Here's the most reliable method:

```bash
cd ~/elemental-website

# Make sure containers are running
docker compose -f docker-compose.prod.yml up -d

# Wait for postgres to be ready
sleep 5

# Method 1: Use PAYLOAD_DB_PUSH environment variable (recommended)
# Stop containers first
docker compose -f docker-compose.prod.yml down

# Export POSTGRES_PASSWORD and set PAYLOAD_DB_PUSH
export POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
export PAYLOAD_DB_PUSH=true

# Start containers - Payload will create tables on first connection
docker compose -f docker-compose.prod.yml up -d

# Watch logs to see when schema is initialized
docker compose -f docker-compose.prod.yml logs payload -f
```

Wait until you see the app start successfully without "relation does not exist" errors, then:

```bash
# Stop watching logs (Ctrl+C), then restart without PAYLOAD_DB_PUSH
docker compose -f docker-compose.prod.yml down
unset PAYLOAD_DB_PUSH
docker compose -f docker-compose.prod.yml up -d
```

**Method 2: Verify PAYLOAD_DB_PUSH is working**

The standalone build doesn't include source files, so we need to use the environment variable. First, verify it's set:

```bash
cd ~/elemental-website

# Check if PAYLOAD_DB_PUSH is set in the container
docker compose -f docker-compose.prod.yml exec payload env | grep PAYLOAD_DB_PUSH
```

If it shows `PAYLOAD_DB_PUSH=true`, Payload should create tables on startup. If not, restart with it set:

```bash
# Stop containers
docker compose -f docker-compose.prod.yml down

# Set environment variables
export POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
export PAYLOAD_DB_PUSH=true

# Start containers
docker compose -f docker-compose.prod.yml up -d

# Watch logs - you should see tables being created
docker compose -f docker-compose.prod.yml logs payload -f
```

Wait until you see the app start successfully, then restart without PAYLOAD_DB_PUSH.

**Method 3: Use temporary container with init-schema.mjs (most reliable)**

Use the included `init-schema.mjs` script:

```bash
cd ~/elemental-website

# Make sure postgres is running
docker compose -f docker-compose.prod.yml up -d postgres
sleep 5

# Get environment variables
export POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
export PAYLOAD_SECRET=$(grep PAYLOAD_SECRET .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

# Run temporary container with tsx to execute the script
docker run --rm \
  --network host \
  -e DATABASE_URI="postgresql://payload:${POSTGRES_PASSWORD}@127.0.0.1:5432/payload" \
  -e PAYLOAD_SECRET="${PAYLOAD_SECRET}" \
  -e PAYLOAD_DB_PUSH=true \
  -v "$(pwd):/app" \
  -w /app \
  node:22.17.0-alpine \
  sh -c "apk add --no-cache libc6-compat && \
         corepack enable pnpm && \
         pnpm i --frozen-lockfile > /dev/null 2>&1 && \
         pnpm add -D tsx > /dev/null 2>&1 && \
         NODE_OPTIONS=--no-deprecation pnpm exec tsx scripts/migrations/init-schema.mjs"
```

After this completes successfully, restart your payload container:

```bash
docker compose -f docker-compose.prod.yml restart payload
docker compose -f docker-compose.prod.yml logs payload --tail=20
```

**Alternative: Use environment variable**

```bash
# Stop containers
docker compose -f docker-compose.prod.yml down

# Start with PAYLOAD_DB_PUSH=true to auto-create tables
export POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
export PAYLOAD_DB_PUSH=true
docker compose -f docker-compose.prod.yml up -d

# Wait for schema initialization (check logs)
docker compose -f docker-compose.prod.yml logs payload -f

# Once schema is created, restart without PAYLOAD_DB_PUSH
docker compose -f docker-compose.prod.yml down
unset PAYLOAD_DB_PUSH
docker compose -f docker-compose.prod.yml up -d
```

#### **PostgreSQL Authentication Failed (Error 28P01)**

If you see `28P01` error with `auth_failed`, the PostgreSQL container was initialized with a different password than what's in your `.env.production` file. The database volume still has the old password.

**Fix: Reset PostgreSQL password**

You have two options:

**Option 1: Reset password in existing database (keeps data)**

```bash
cd ~/elemental-website

# Stop containers
docker compose -f docker-compose.prod.yml down

# Start postgres only
export POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
docker compose -f docker-compose.prod.yml up -d postgres

# Wait for postgres to be ready
sleep 5

# Connect to postgres and change password
docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload -c "ALTER USER payload WITH PASSWORD '5SQcMbiIAb7Z4JWyzvIPIhEK7AmXCKoAfkppBg9w4';"

# Restart all containers
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

**Option 2: Recreate database volume (deletes all data)**

```bash
cd ~/elemental-website

# Stop and remove containers
docker compose -f docker-compose.prod.yml down

# Remove the postgres volume (THIS DELETES ALL DATA!)
docker volume rm elemental-website_postgres_data

# Start containers with new password
export POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
docker compose -f docker-compose.prod.yml up -d
```

**Use Option 1 if you have data you want to keep, Option 2 if starting fresh.**

**Fix:**

Docker Compose needs `POSTGRES_PASSWORD` in the shell environment (or in a `.env` file) to substitute `${POSTGRES_PASSWORD}` in `docker-compose.prod.yml`. The `env_file` directive only affects variables inside the container.

**Option 1: Export the variable (recommended for one-time fix)**

```bash
cd ~/elemental-website

# Check if .env.production exists
ls -la .env.production

# Edit .env.production and add POSTGRES_PASSWORD if missing
nano .env.production
```

Make sure `.env.production` contains:
```env
POSTGRES_PASSWORD=your-secure-postgres-password-change-this
DATABASE_URI=postgresql://payload:your-secure-postgres-password-change-this@postgres:5432/payload
PAYLOAD_SECRET=your-super-secret-key-change-this-in-production-min-32-chars
PAYLOAD_PUBLIC_SERVER_URL=https://elmt.gg
NEXT_PUBLIC_SERVER_URL=https://elmt.gg
NODE_ENV=production
```

**Important:** The password in `POSTGRES_PASSWORD` must match the password in `DATABASE_URI`.

Then export it and restart:
```bash
# Export POSTGRES_PASSWORD from .env.production
export POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

# Restart containers
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

**Option 2: Create a `.env` file (persistent solution)**

Docker Compose automatically reads `.env` files. Create one:

```bash
cd ~/elemental-website

# Create .env file with POSTGRES_PASSWORD
echo "POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '\"' | tr -d \"'\" | xargs)" > .env

# Or manually create it
nano .env
```

Add to `.env`:
```env
POSTGRES_PASSWORD=your-secure-postgres-password-change-this
```

Then restart:
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

**Note:** Keep `.env` in `.gitignore` (it should already be there) - it contains sensitive passwords.

#### Check if containers are running:

```bash
cd ~/elemental-website
docker compose -f docker-compose.prod.yml ps
```

You should see both `payload` and `postgres` containers with status "Up". If not, start them:

```bash
export POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
docker compose -f docker-compose.prod.yml up -d
```

#### Check container logs:

```bash
# Check all logs
docker compose -f docker-compose.prod.yml logs --tail=50

# Check just the payload container
docker compose -f docker-compose.prod.yml logs payload --tail=50

# Follow logs in real-time
docker compose -f docker-compose.prod.yml logs -f payload
```

Look for errors like:
- `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` → Missing `POSTGRES_PASSWORD`
- `cannot connect to Postgres` → Database connection issue
- Port binding issues
- Missing environment variables

#### Verify the app is listening on port 3000:

```bash
# From the host machine
curl http://127.0.0.1:3000/api/health

# Or check if port is listening
sudo netstat -tlnp | grep 3000
# or
sudo ss -tlnp | grep 3000
```

If the app isn't responding, check the container logs for startup errors.

#### Check Nginx configuration:

```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx error logs
sudo tail -50 /var/log/nginx/error.log

# Check Nginx access logs
sudo tail -50 /var/log/nginx/access.log
```

#### Common fixes:

1. **Missing POSTGRES_PASSWORD**: See the fix above - this is the most common cause

2. **Container not running**: Start it with:
   ```bash
   export POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
   docker compose -f docker-compose.prod.yml up -d
   ```

3. **Database connection error**: Ensure `.env.production` has correct `DATABASE_URI` and `POSTGRES_PASSWORD` (they must match)

4. **Port conflict**: Check if something else is using port 3000:
   ```bash
   sudo lsof -i :3000
   ```

5. **Nginx can't connect**: Ensure the container is binding to `127.0.0.1:3000` (check `docker-compose.prod.yml` ports section)

6. **App crashed on startup**: Check logs for missing environment variables or database schema issues

7. **Restart everything**:
   ```bash
   export POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
   docker compose -f docker-compose.prod.yml down
   docker compose -f docker-compose.prod.yml up -d
   sudo systemctl restart nginx
   ```

#### Verify the fix:

After fixing issues, test:
```bash
# Test from server
curl http://127.0.0.1:3000/api/health

# Test through Nginx
curl http://localhost/api/health
```

Then try accessing `https://elmt.gg/admin` again.

## Step 7: Firewall Configuration

### 7.1 Configure UFW (Ubuntu Firewall)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

### 7.2 Oracle Cloud Security Rules

In Oracle Cloud Console:
1. Go to **Networking** → **Virtual Cloud Networks**
2. Select your VCN → **Security Lists**
3. Add Ingress Rules:
   - **Source:** `0.0.0.0/0`, **Port:** `80` (HTTP)
   - **Source:** `0.0.0.0/0`, **Port:** `443` (HTTPS)
   - **Source:** `YOUR_IP/32`, **Port:** `22` (SSH - restrict to your IP)

## Step 8: Monitoring and Maintenance

### 8.1 Set Up Log Rotation

Create log rotation config:

```bash
sudo nano /etc/logrotate.d/docker-containers
```

Add:
```
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size=1M
    missingok
    delaycompress
    copytruncate
}
```

### 8.2 Set Up Automatic Updates (Optional)

```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 8.3 Monitor Disk Space

```bash
# Check disk usage
df -h

# Check Docker disk usage
docker system df
```

## Step 9: Backup Strategy

### 9.1 Database Backup Script

Create `/opt/elemental-website/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
docker compose -f /opt/elemental-website/docker-compose.prod.yml exec -T postgres pg_dump -U payload payload > $BACKUP_DIR/db_$DATE.sql

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /opt/elemental-website/public/uploads

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

Make it executable:
```bash
chmod +x /opt/elemental-website/backup.sh
```

### 9.2 Schedule Daily Backups

```bash
crontab -e
```

Add:
```
0 2 * * * /opt/elemental-website/backup.sh >> /var/log/elemental-backup.log 2>&1
```

## Step 10: Update Deployment

When you need to update:

```bash
cd /opt/elemental-website

# Pull latest changes
git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

## Troubleshooting

### Check Application Status

```bash
# Check if containers are running
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs payload
docker compose -f docker-compose.prod.yml logs postgres

# Check Nginx status
sudo systemctl status nginx
sudo nginx -t
```

### Common Issues

1. **502 Bad Gateway**: App not running or wrong port
   ```bash
   docker compose -f docker-compose.prod.yml ps
   curl http://127.0.0.1:3000
   ```

2. **SSL Certificate Issues**: Renew certificate
   ```bash
   sudo certbot renew
   sudo systemctl reload nginx
   ```

3. **Database Connection Issues**: Check database is running
   ```bash
   docker compose -f docker-compose.prod.yml exec postgres psql -U payload -d payload -c "SELECT 1;"
   ```

4. **Out of Memory**: Check server resources
   ```bash
   free -h
   docker stats
   ```

## Security Checklist

- [ ] Changed all default passwords
- [ ] Generated secure PAYLOAD_SECRET (32+ chars)
- [ ] Set secure POSTGRES_PASSWORD
- [ ] SSL certificate installed and auto-renewal configured
- [ ] Firewall configured (only ports 22, 80, 443 open)
- [ ] SSH key authentication enabled (disable password auth)
- [ ] Regular backups configured
- [ ] Admin user created with strong password
- [ ] Environment variables secured (not in git)

## Next Steps

1. Set up monitoring (e.g., UptimeRobot, Pingdom)
2. Configure email for Payload (for password resets, etc.)
3. Set up CDN for static assets (optional)
4. Configure automated deployments (GitHub Actions, etc.)

## Support

For issues specific to:
- **Payload CMS**: https://payloadcms.com/docs
- **Next.js**: https://nextjs.org/docs
- **Docker**: https://docs.docker.com
- **Nginx**: https://nginx.org/en/docs/
