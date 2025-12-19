# Deployment Guide

## Quick Deployment Steps

### On Your Local Machine

1. **Commit and push your changes:**
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

### On the Production Server

2. **SSH into the server:**
   ```bash
   ssh -i YOUR_SSH_KEY YOUR_USER@YOUR_SERVER_IP
   ```

3. **Navigate to the project directory:**
   ```bash
   cd YOUR_PROJECT_PATH
   ```

4. **Pull the latest code:**
   ```bash
   git pull origin main
   ```

5. **Rebuild and restart the payload container:**
   ```bash
   docker compose -f docker-compose.prod.yml down payload
   docker compose -f docker-compose.prod.yml build payload
   docker compose -f docker-compose.prod.yml up -d payload
   ```

6. **Verify deployment:**
   ```bash
   docker compose logs --tail=50 payload
   ```

   Look for: `✓ Ready in XXXms`

---

## Alternative: Automated Deploy Script

### Setup (One-Time)

1. **Copy the example config:**
   ```bash
   cp deploy.config.example .env.deploy
   ```

2. **Edit `.env.deploy` with your server details:**
   ```bash
   DEPLOY_SERVER=your-user@your-server-ip
   DEPLOY_SSH_KEY=/path/to/your/ssh/key
   DEPLOY_PROJECT_DIR=/path/to/project/on/server
   ```
   
   Note: `.env.deploy` is gitignored and won't be committed to the repo.

### Deploy

Run from your local machine:

```bash
./scripts/deploy-to-server.sh
```

This will automatically:
- SSH into the server
- Pull latest code
- Rebuild the container
- Restart the service
- Show you the logs

---

## Important Notes

### Database Migrations
If you've added database migrations:
```bash
# The migrations will run automatically on container startup
# Check logs to ensure they completed successfully
docker compose logs payload | grep -i migration
```

### Environment Variables
If you need to update environment variables:
1. Edit `.env.production` on the server
2. Restart the container:
   ```bash
   docker compose -f docker-compose.prod.yml restart payload
   ```

### Rollback
If something goes wrong, you can rollback:
```bash
# Go back to previous commit
git reset --hard HEAD~1

# Rebuild and restart
docker compose -f docker-compose.prod.yml down payload
docker compose -f docker-compose.prod.yml build payload
docker compose -f docker-compose.prod.yml up -d payload
```

---

## Troubleshooting

### Container won't start
```bash
# Check logs
docker compose logs payload

# Check if port is already in use
docker ps -a
```

### Database connection issues
```bash
# Verify postgres is running
docker compose ps postgres

# Check postgres health
docker compose logs postgres | tail -20
```

### Clear cache issues
```bash
# Rebuild without cache
docker compose -f docker-compose.prod.yml build --no-cache payload
docker compose -f docker-compose.prod.yml up -d payload
```

---

## Production vs Development

- **Production Server**: Uses `docker-compose.prod.yml` with standalone Next.js build
- **Local Development**: Uses `docker-compose.yml` with `npm run dev`
- **Database**: Never touches postgres container during deployments




