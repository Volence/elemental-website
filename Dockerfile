# To use this Dockerfile, you have to set `output: 'standalone'` in your next.config.js file.
# From https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile

FROM node:22.17.0-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
# Use pnpm with space optimizations (hoisted mode reduces .pnpm directory size)
# Copy package.json only (use npm to avoid pnpm lockfile issues)
COPY package.json ./
RUN \
  echo "Using npm (to avoid pnpm lockfile issues)..." && \
  rm -rf pnpm-lock.yaml yarn.lock package-lock.json .pnpmfile.cjs node_modules 2>/dev/null || true && \
  npm install --legacy-peer-deps || exit 1 && \
  echo "Installing sharp for Alpine Linux ARM64..." && \
  npm install --os=linux --libc=musl --cpu=arm64 sharp --legacy-peer-deps || exit 1 && \
  test -d /app/node_modules || (echo "ERROR: node_modules was not created" && exit 1)


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Copy source code (node_modules excluded via .dockerignore)
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED 1

# Allow DATABASE_URI and PAYLOAD_SECRET to be passed as build args
ARG DATABASE_URI=""
ARG PAYLOAD_SECRET="secret"
ENV DATABASE_URI=${DATABASE_URI}
ENV PAYLOAD_SECRET=${PAYLOAD_SECRET}
# NEXT_BUILD_SKIP_DB is set to 1 if DATABASE_URI is empty, 0 if provided
ENV NEXT_BUILD_SKIP_DB=${DATABASE_URI:+0}${DATABASE_URI:-1}

# Build the application
# IMPORTANT: Database must be available during build for standalone output to be created
# Pages are configured as dynamic and will be generated at runtime when the app starts
# Use npm for build (consistent with install step, avoids pnpm cache issues)
# NODE_OPTIONS limits V8 optimizations that can cause issues under QEMU ARM64 emulation
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Verify standalone output was created (required for production deployment)
RUN if [ ! -d .next/standalone ]; then \
  echo "ERROR: .next/standalone directory not found. Build may have failed or database was not available."; \
  echo "Make sure to build with DATABASE_URI pointing to an accessible postgres instance."; \
  exit 1; \
fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public folder (includes logos and other static assets)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Verify logos directory exists and has files
RUN ls -la /app/public/logos/ | head -10 || echo "Warning: logos directory check failed"

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Create media directory for volume mounting (where Payload saves uploads)
RUN mkdir -p /app/public/media
RUN chown nextjs:nodejs /app/public/media

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 node server.js"]
