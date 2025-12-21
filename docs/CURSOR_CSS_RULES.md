# Cursor CSS Maintenance Rules

## 📋 Rules Created

I've created 4 Cursor rules to maintain the clean CSS architecture:

### 1. **`css-architecture.mdc`** (Always Applied ✅)
Enforces the modular file structure and prevents monolithic files.

**Key Rules**:
- Keep components under 500 lines
- Use existing variables and mixins
- Organize new styles in component files
- Avoid `!important` unless absolutely necessary
- Keep specificity under 3 levels
- Create mixins/variables for repeated patterns

### 2. **`css-style-guide.mdc`** (Always Applied ✅)
Coding standards for consistent, maintainable CSS.

**Key Rules**:
- Component-first approach (one file per component)
- Use design tokens (variables) instead of hard-coded values
- Use mixins for repeated patterns
- Follow BEM-style naming conventions
- Limit nesting depth to 3 levels
- Add meaningful comments

### 3. **`css-refactoring-prevention.mdc`** (Always Applied ✅)
Prevents regression to old anti-patterns.

**Watches For**:
- ❌ Specificity wars (`html body div.class`)
- ❌ `!important` abuse
- ❌ Code duplication
- ❌ Magic numbers (use spacing variables)
- ❌ Over-qualification (unnecessary selectors)
- ❌ Files growing too large (>500 lines)

### 4. **`css-quick-reference.mdc`** (Manual Reference 📖)
Quick reference for available mixins, variables, and file structure.

**Contains**:
- File structure overview
- All available mixins with parameters
- All available variables
- Common tasks and examples

## 🎯 How These Rules Help

### Prevent Degradation
The rules will remind you to:
- Check for existing patterns before creating new ones
- Use the modular structure instead of adding to one big file
- Keep specificity low and avoid `!important`

### Maintain Consistency
Every time you work with CSS, Cursor will remind you to:
- Use variables for colors, spacing, and transitions
- Use mixins for repeated patterns
- Follow the established file organization

### Catch Issues Early
Before committing, the rules prompt you to verify:
- No files have grown too large
- No new anti-patterns were introduced
- Existing variables/mixins are being used

## 📚 Quick Examples

### ✅ Good (Follows Rules)
```scss
// In components/_my-feature.scss
@import '../variables';
@import '../mixins';

.my-feature {
  @include card-base;
  @include gradient-border;
  padding: $spacing-lg;
  color: $admin-text-primary;
  
  &:hover {
    @include card-hover;
  }
}
```

### ❌ Bad (Violates Rules)
```scss
// In custom.scss (monolithic file)
html body .template-default .my-feature {
  background: rgba(255, 255, 255, 0.02) !important;
  padding: 23px !important;
  border: 2px solid transparent;
  position: relative;
  
  &::before {
    content: '';
    // 15 lines of repeated gradient border pattern
  }
}
```

## 🚀 How to Use

### The 3 "Always Apply" Rules
These will automatically remind you of best practices as you code:
1. **css-architecture.mdc** - Structure and organization
2. **css-style-guide.mdc** - Coding standards
3. **css-refactoring-prevention.mdc** - Anti-patterns to avoid

### The Quick Reference Rule
- **css-quick-reference.mdc** - Set to manual (`alwaysApply: false`)
- Invoke when you need to look up available mixins/variables
- Reference when starting new CSS work

## 🔍 What Cursor Will Watch For

### When You Edit SCSS Files
Cursor will remind you to:
- [ ] Check if the pattern already exists
- [ ] Use existing variables instead of hard-coded values
- [ ] Use existing mixins for common patterns
- [ ] Keep specificity low (max 3 levels)
- [ ] Avoid `!important` unless necessary
- [ ] Add to appropriate component file, not monolithic file

### Before You Commit
Cursor will prompt you to verify:
- [ ] No files exceed 500 lines
- [ ] No new `!important` added unnecessarily
- [ ] Using existing variables/mixins where possible
- [ ] New patterns are extracted to mixins if repeated 3+ times
- [ ] New values are extracted to variables if repeated 3+ times

## 📖 Rule Locations

```
.cursor/rules/
├── css-architecture.mdc           # Structure & organization
├── css-style-guide.mdc           # Coding standards
├── css-refactoring-prevention.mdc # Anti-patterns
└── css-quick-reference.mdc       # Quick lookup
```

## 🎓 Training the Team

Share these rules with your team:

1. **Read** `CSS_REFACTORING_COMPLETE.md` - Understand what was done
2. **Review** `CSS_AUDIT.md` - See what problems existed before
3. **Study** the new modular structure in `src/app/(payload)/styles/`
4. **Reference** `css-quick-reference.mdc` - Learn available tools
5. **Follow** the 3 always-applied rules as you code

## 🔄 Maintaining the Rules

### Update When You:
- Add new common mixins → Update `css-quick-reference.mdc`
- Add new variables → Update `css-quick-reference.mdc`
- Identify new anti-patterns → Update `css-refactoring-prevention.mdc`
- Change file structure → Update `css-architecture.mdc`

### Review Periodically:
- Monthly: Are the rules being followed?
- Quarterly: Do the rules need updating?
- After issues: Add rules to prevent recurrence

## ✅ Success Metrics

These rules help you maintain:
- 📏 Max specificity < 30 (currently ~25)
- 🚫 `!important` count < 50 (currently ~30)
- 📁 Max file size < 500 lines (largest currently ~414)
- ♻️ Reusable patterns via mixins
- 🎨 Consistent use of design tokens

## 🎉 Result

With these rules, Cursor will help you:
- ✅ Maintain the clean architecture
- ✅ Catch regressions early
- ✅ Follow best practices automatically
- ✅ Build with consistency
- ✅ Prevent CSS bloat

**Your CSS will stay clean and maintainable!** 🚀

