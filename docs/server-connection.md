# Server Connection Quick Reference

## SSH Connection
```bash
ssh -i ~/.ssh/id_rsa ubuntu@129.213.21.96
```

## Project Location
```
/home/ubuntu/elemental-website
```

## Useful Commands

### View logs
```bash
cd /home/ubuntu/elemental-website
docker compose -f docker-compose.prod.yml logs -f payload
```

### Connect to PostgreSQL
```bash
# From inside the server:
docker compose -f docker-compose.prod.yml exec postgres psql -U payload -d payload
```

### Check migrations status
```sql
-- List all tables
\dt

-- Check Payload migrations table
SELECT * FROM payload_migrations ORDER BY created_at DESC LIMIT 10;
```

### Restart payload
```bash
docker compose -f docker-compose.prod.yml restart payload
```

### Full redeploy
```bash
git pull origin main
docker compose -f docker-compose.prod.yml down payload
docker compose -f docker-compose.prod.yml build payload
docker compose -f docker-compose.prod.yml up -d payload
```
