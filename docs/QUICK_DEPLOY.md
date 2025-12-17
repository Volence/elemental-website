# Quick Deployment Reference

## TL;DR - Deploy in 10 Steps

1. **SSH to your Oracle server**
   ```bash
   ssh your-user@your-server-ip
   ```

2. **Install Docker & Nginx**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   # Docker Compose V2 is included with Docker Desktop and modern Docker installations
   # If you need the standalone binary, use:
   # sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   # sudo chmod +x /usr/local/bin/docker-compose
   sudo apt install nginx certbot python3-certbot-nginx -y
   exit  # Log out and back in
   ```

3. **Configure DNS at Porkbun**
   - Add A record: `@` → `YOUR_SERVER_IP`
   - Add A record: `www` → `YOUR_SERVER_IP`
   - Wait 5-10 minutes for propagation

4. **Upload code to server**
   ```bash
   # On your local machine
   scp -r /path/to/elemental-website your-user@your-server-ip:/opt/
   ```

5. **Create production environment file**
   ```bash
   cd /opt/elemental-website
   nano .env.production
   ```
   
   Add:
   ```env
   DATABASE_URI=postgresql://payload:YOUR_SECURE_PASSWORD@postgres:5432/payload
   POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD
   PAYLOAD_SECRET=$(openssl rand -base64 32)
   PAYLOAD_PUBLIC_SERVER_URL=https://elmt.gg
   NEXT_PUBLIC_SERVER_URL=https://elmt.gg
   NODE_ENV=production
   ```

6. **Configure Nginx**
   ```bash
   sudo cp nginx.conf.example /etc/nginx/sites-available/elemental-website
   sudo nano /etc/nginx/sites-available/elemental-website
   # Domain is elmt.gg
   sudo ln -s /etc/nginx/sites-available/elemental-website /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

7. **Get SSL certificate**
   ```bash
   sudo certbot --nginx -d elmt.gg -d www.elmt.gg
   ```

8. **Deploy application**
   ```bash
   cd /opt/elemental-website
   ./deploy.sh
   ```

9. **Configure firewall**
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

10. **Create admin user**
    - Visit: `https://elmt.gg/admin`
    - Follow the setup wizard

## Useful Commands

### Check status
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### Update deployment
```bash
cd /opt/elemental-website
git pull  # or upload new files
./deploy.sh
```

### Backup database
```bash
./backup.sh
```

### Restart services
```bash
docker compose -f docker-compose.prod.yml restart
```

### View logs
```bash
docker compose -f docker-compose.prod.yml logs -f payload
docker compose -f docker-compose.prod.yml logs -f postgres
```

## Troubleshooting

**502 Bad Gateway?**
```bash
docker compose -f docker-compose.prod.yml ps
curl http://127.0.0.1:3000
```

**SSL issues?**
```bash
sudo certbot renew
sudo systemctl reload nginx
```

**Out of disk space?**
```bash
docker system prune -a
df -h
```

## Full Documentation

See `DEPLOYMENT.md` for complete detailed instructions.
