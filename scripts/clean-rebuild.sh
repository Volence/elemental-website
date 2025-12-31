#!/bin/bash

# Clean rebuild script for Next.js
# Clears all caches and does a fresh build

echo "🧹 Cleaning build caches..."

# Remove Next.js cache
rm -rf .next

# Remove node_modules cache (optional, uncomment if needed)
# rm -rf node_modules/.cache

# Remove any SCSS cache
find . -name "*.scss.d.ts" -delete 2>/dev/null || true

echo "✅ Caches cleared!"
echo "🔨 Starting fresh build..."

# Rebuild
npm run build

echo "✨ Clean rebuild complete!"

