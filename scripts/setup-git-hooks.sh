#!/bin/bash
# Setup git hooks for the project
# Run this after cloning the repository: ./scripts/setup-git-hooks.sh

echo "🔧 Setting up git hooks..."

# Create pre-push hook
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash

echo "🔍 Running TypeScript type check before push..."
echo ""

# Run TypeScript compiler in no-emit mode to check for type errors
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
EOF

# Make the hook executable
chmod +x .git/hooks/pre-push

echo "✅ Git hooks installed successfully!"
echo ""
echo "Pre-push hook will now check for TypeScript errors before each push."
echo "To bypass the check (not recommended), use: git push --no-verify"

