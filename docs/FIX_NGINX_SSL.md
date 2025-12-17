# Fix: Nginx SSL Certificate Error

## Problem
Nginx is trying to load SSL certificates that don't exist yet. We need to start with HTTP-only config, then let Certbot add SSL.

## Solution

### Step 1: Replace Nginx Config with HTTP-Only Version

```bash
sudo nano /etc/nginx/sites-available/elemental-website
```

Replace the entire file with this HTTP-only configuration:

```nginx
server {
    listen 80;
    server_name elmt.gg www.elmt.gg;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
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

    # Serve static files directly with caching
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

    # Health check endpoint
    location /api/health {
        proxy_pass http://127.0.0.1:3000;
        access_log off;
    }
}
```

### Step 2: Test and Restart Nginx

```bash
sudo nginx -t
sudo systemctl restart nginx
```

### Step 3: Make Sure Your App is Running

```bash
cd ~/elemental-website
docker compose -f docker-compose.prod.yml ps
```

If not running, start it:
```bash
docker compose -f docker-compose.prod.yml up -d
```

### Step 4: Verify HTTP Works

```bash
curl http://elmt.gg
# Should return HTML content, not an error
```

### Step 5: Run Certbot (It Will Add SSL Automatically)

```bash
sudo certbot --nginx -d elmt.gg -d www.elmt.gg
```

Certbot will:
1. Obtain SSL certificates
2. Automatically update your nginx config to add HTTPS
3. Add redirect from HTTP to HTTPS

### Step 6: Verify SSL Works

```bash
curl https://elmt.gg
# Should return HTML content
```

### Step 7: Test Auto-Renewal

```bash
sudo certbot renew --dry-run
```

## Troubleshooting

**If certbot fails with "Connection refused":**
- Make sure your app is running on port 3000
- Check firewall: `sudo ufw status`
- Verify DNS is pointing to your server: `dig elmt.gg`

**If certbot fails with "Invalid response":**
- Make sure port 80 is open: `sudo ufw allow 80/tcp`
- Check Oracle Cloud security rules allow port 80
- Verify nginx is running: `sudo systemctl status nginx`

**If you get "Too many requests" error:**
- You've hit Let's Encrypt rate limits (5 certs per week per domain)
- Wait a few days or use Let's Encrypt staging: `sudo certbot --nginx -d elmt.gg -d www.elmt.gg --staging`
