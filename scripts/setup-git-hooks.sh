#!/bin/bash
# Setup git hooks for the project
# Run this after cloning the repository: ./scripts/setup-git-hooks.sh

echo "🔧 Setting up git hooks..."

# Create pre-push hook
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash

echo "🔍 Running TypeScript type check before push..."
echo ""

# Check if running in Docker environment
if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    # We're in Docker, run directly
    if npm run type-check; then
        echo ""
        echo "✅ TypeScript check passed! Proceeding with push..."
        exit 0
    else
        echo ""
        echo "❌ TypeScript errors detected!"
        echo ""
        echo "Fix the type errors before pushing, or use 'git push --no-verify' to skip this check."
        echo "To check types manually, run: npm run type-check"
        exit 1
    fi
else
    # We're outside Docker, try to run in Docker container if available
    if command -v docker &> /dev/null && docker compose ps payload | grep -q "Up"; then
        echo "📦 Running type check in Docker container..."
        if docker compose exec -T payload npm run type-check; then
            echo ""
            echo "✅ TypeScript check passed! Proceeding with push..."
            exit 0
        else
            echo ""
            echo "❌ TypeScript errors detected!"
            echo ""
            echo "Fix the type errors before pushing, or use 'git push --no-verify' to skip this check."
            echo "To check types manually in Docker, run: docker compose exec payload npm run type-check"
            exit 1
        fi
    else
        echo "⚠️  Docker container not running, skipping type check."
        echo "   Consider starting your dev environment with 'docker compose up'"
        echo "   Or manually run: docker compose exec payload npm run type-check"
        echo ""
        echo "⏭️  Proceeding with push..."
        exit 0
    fi
fi
EOF

# Make the hook executable
chmod +x .git/hooks/pre-push

echo "✅ Git hooks installed successfully!"
echo ""
echo "Pre-push hook will now check for TypeScript errors before each push."
echo "The hook will automatically use Docker if your containers are running."
echo "To bypass the check (not recommended), use: git push --no-verify"

