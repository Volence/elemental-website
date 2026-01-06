# GitHub Actions CI/CD Setup

This repository uses GitHub Actions for automated deployments to the production server.

## How It Works

1. **On push to `main`**: The workflow builds an ARM64 Docker image
2. **Pushes to GHCR**: The image is stored at `ghcr.io/volence/elemental-website:latest`
3. **Deploys to server**: SSHs to the production server and pulls the new image
4. **Minimal downtime**: Only ~10-15 seconds to pull and restart vs 2-3 min full build

## Required Secrets

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `SERVER_HOST` | Production server IP | `129.213.21.96` |
| `SERVER_USER` | SSH username | `ubuntu` |
| `SSH_PRIVATE_KEY` | SSH private key | `cat ~/.ssh/id_rsa` (copy full output) |
| `GHCR_PAT` | GitHub Personal Access Token | See below |

### Creating the GHCR_PAT Token

> **Note**: You must use a **Classic** token, not fine-grained (fine-grained doesn't support packages yet)

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Name: `elemental-cicd`
4. Expiration: Set to 90 days or 1 year
5. Select these scopes:
   - ✅ `write:packages`
   - ✅ `read:packages`
   - ✅ `delete:packages` (optional, helps with cleanup)
6. Click **Generate token**
7. Copy the token and add it as the `GHCR_PAT` secret

### Getting Your SSH Private Key

```bash
# Copy full output including -----BEGIN and -----END lines
cat ~/.ssh/id_rsa
```

## Manual Trigger

You can manually trigger a deployment from the **Actions** tab → **Deploy to Production** → **Run workflow**.

## Image Cleanup

A weekly cleanup job runs every Sunday to delete old images and stay within the free storage tier:
- Keeps the 3 most recent images
- Deletes images older than 7 days

## Local Development

The CI/CD doesn't affect local development. You can still run:

```bash
docker compose up --build
```

## Fallback to Local Build

If CI/CD fails or you need to deploy manually:

```bash
./scripts/deploy-to-server.sh
```

## Cost

- **GitHub Actions**: Free 2,000 minutes/month (builds take ~5 min = 400 deploys/month)
- **GHCR Storage**: Free up to 500MB (cleanup keeps us under this)
- **Total**: $0/month with normal usage
