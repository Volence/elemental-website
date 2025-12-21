# CSS Refactoring Testing Guide

## 🧪 Quick Test Commands

### 1. Build Test (Verify no syntax errors)
```bash
cd /home/volence/elmt/elemental-website
pnpm run build
```

### 2. Dev Server Test
```bash
pnpm run dev
```

Then visit: `http://localhost:3000/admin`

## ✅ Visual Regression Checklist

### Sidebar Navigation
- [ ] All nav links visible and styled correctly
- [ ] Hover states work (subtle indigo highlight)
- [ ] Active page has indigo left border and background
- [ ] Group headers (PEOPLE, ESPORTS, etc.) are purple and uppercase
- [ ] Group dividers show between sections
- [ ] Icons align properly with text
- [ ] Breadcrumbs show home icon (🏠)
- [ ] Logout button at bottom has hover effect

### Dashboard Page
- [ ] Main heading has cyan-to-lime gradient underline
- [ ] "Before Dashboard" sections have gradient borders
- [ ] Data consistency check cards show proper colors (success/warning/error)
- [ ] Stat cards have gradient borders matching their status
- [ ] All buttons render with proper hover glow effects
- [ ] Team assignment cards display correctly

### Collection Lists (Teams, People, Matches, etc.)
- [ ] Table headers have gradient underline (sticky)
- [ ] Table rows have zebra striping
- [ ] Row hover shows indigo highlight with glow
- [ ] "Create New" button positioned correctly
- [ ] Search input has proper styling
- [ ] Pagination works and styles correctly

### Edit Forms (Any collection item)

#### Basic Fields
- [ ] Text inputs have light background, proper padding
- [ ] Focus states show indigo glow and ring
- [ ] Labels are uppercase and subtle white
- [ ] Placeholder text is dim gray
- [ ] Field descriptions show below inputs

#### Select Fields
- [ ] React Select dropdowns styled correctly
- [ ] Selected values show as pills/chips
- [ ] Dropdown menu has proper background
- [ ] Multi-select works properly

#### Row Fields (Side-by-side)
- [ ] Fields align horizontally
- [ ] Equal width distribution
- [ ] Proper spacing between fields
- [ ] Labels align at top
- [ ] Example: Match form (Team 1 Score | Team 2 Score)

#### Array Fields (Repeatable)
- [ ] Array items have left gradient border (cyan→indigo→lime)
- [ ] "Add" button shows with proper icon alignment
- [ ] Hover on array item shows glow
- [ ] Collapsed items show gradient left border
- [ ] Expanded items show content properly
- [ ] Remove button works and has danger hover

#### File Upload Fields
- [ ] Upload area has dashed border
- [ ] "Choose File" and "or" text align horizontally
- [ ] Hover shows indigo highlight
- [ ] Drag text shows in corner
- [ ] Uploaded file preview displays

#### Groups & Collapsibles
- [ ] Collapsible sections have toggle icon
- [ ] Collapsed state shows cyan left border
- [ ] Expanded state shows lime left border
- [ ] Nested fields inside don't have extra borders
- [ ] Toggle animation is smooth

#### Tabs
- [ ] Tab navigation shows at top
- [ ] Active tab highlighted
- [ ] Tab content shows/hides correctly
- [ ] Fields inside tabs styled properly

### Buttons

#### Primary Actions
- [ ] Submit/Save buttons have hover glow
- [ ] Create buttons have green hover glow
- [ ] Delete buttons have red hover glow
- [ ] Disabled buttons show reduced opacity
- [ ] Button text and icons align vertically

### Badges & Status Indicators
- [ ] Published status: green gradient
- [ ] Draft status: blue gradient
- [ ] Cancelled/Archived: red gradient
- [ ] Role badges (Manager, Coach, Captain, Sub) show correct colors
- [ ] Hover on badges shows slight lift

### Modals & Drawers
- [ ] Drawer slides in from side
- [ ] Header has gradient underline
- [ ] Close button (X) shows in top corner
- [ ] Close button hover shows red highlight
- [ ] Content area has proper background

### Typography
- [ ] H1 headings have large gradient underline (cyan to lime)
- [ ] H2 headings have medium gradient underline
- [ ] H3 headings have small gradient underline
- [ ] Body text is readable white
- [ ] Links have proper color and hover state

### Info Boxes & Banners
- [ ] Info boxes have gradient borders
- [ ] Warning boxes show amber gradient
- [ ] Success boxes show green gradient
- [ ] Error boxes show red gradient
- [ ] Content inside is readable

### Mobile Responsive (< 768px)
- [ ] Mobile nav toggle button appears
- [ ] Sidebar slides in when opened
- [ ] Body scroll locked when nav open
- [ ] Close button (X) works
- [ ] Content doesn't shift awkwardly

## 🐛 Common Issues to Watch For

### If styles don't load at all:
```bash
# Check symlink is correct
ls -la src/app/\(payload\)/custom.scss

# Should show: custom.scss -> styles/admin.scss
```

### If some styles are missing:
```bash
# Verify all files exist
ls -la src/app/\(payload\)/styles/components/

# Should show 8 component files
```

### If build fails with SCSS errors:
```bash
# Check for typos in import paths
grep -r "@import" src/app/\(payload\)/styles/

# All paths should start with ./ or ../
```

## 🔄 Quick Rollback (If Needed)

If you encounter issues:

```bash
cd /home/volence/elmt/elemental-website

# Remove symlink and new files
rm src/app/\(payload\)/custom.scss
rm -rf src/app/\(payload\)/styles/

# Restore backup
mv src/app/\(payload\)/custom.scss.backup src/app/\(payload\)/custom.scss

# Rebuild
pnpm run build
```

## ✅ Success Criteria

All tests pass if:

1. ✅ Build completes without errors
2. ✅ Dev server starts without SCSS errors
3. ✅ Admin panel loads and looks identical to before
4. ✅ All interactions (hover, click, etc.) work
5. ✅ No console errors in browser
6. ✅ All forms are functional
7. ✅ No visual regressions

## 📸 Screenshot Comparison (Optional)

If you want to be extra safe:

### Before Refactoring
Take screenshots of:
1. Dashboard
2. Teams list
3. Team edit form
4. Match edit form
5. People list

### After Refactoring
Take same screenshots and compare side-by-side

**Expected**: Pixel-perfect match (zero visual changes)

## 🎯 Performance Comparison

### CSS Bundle Size
```bash
# Check production build size
pnpm run build

# Look for CSS file in .next/static/css/
ls -lh .next/static/css/

# Before: ~XX KB
# After: Should be ~10% smaller
```

### Browser DevTools
1. Open Chrome DevTools
2. Go to Coverage tab
3. Reload admin page
4. Check CSS coverage percentage

**Goal**: Higher coverage percentage (less unused CSS)

## 📝 Sign-off

Once all tests pass:

- [ ] All visual checks complete ✅
- [ ] No console errors ✅
- [ ] All functionality works ✅
- [ ] Performance acceptable ✅
- [ ] Team reviewed changes ✅

**Approved by**: _______________  
**Date**: _______________  

---

**Ready for production!** 🚀

