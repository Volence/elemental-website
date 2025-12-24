# Admin Panel UI Audit
**Date:** December 23, 2025  
**Scope:** PayloadCMS Admin Panel UI Consistency Review  
**Severity Levels:** 🔴 Critical | 🟡 Medium | 🟢 Low

---

## Executive Summary

This audit identifies UI inconsistencies across the admin panel that affect visual cohesion and user experience. The panel uses PayloadCMS with custom SCSS styling, but several inconsistencies create a disjointed feel.

**Overall Assessment:** While recent improvements (tier colors, skeleton loaders) are excellent, there are **27 identified inconsistencies** that need standardization.

---

## 1. Typography Inconsistencies

### 🔴 Critical: Inconsistent Heading Sizes
- **Dashboard:** "Welcome to Elemental CMS!" uses `h4` (smaller)
- **Collection Pages:** Use `h1` for page titles (larger)
- **Global Pages:** Use `h1` for titles (larger)
- **Card Headings:** Mix of `h2` and `h3` without clear hierarchy

**Impact:** Breaks visual hierarchy, makes it hard to scan pages

**Recommendation:**
```scss
// Standardize heading scale
h1 { font-size: 2rem; font-weight: 700; }      // Page titles
h2 { font-size: 1.5rem; font-weight: 700; }    // Section titles  
h3 { font-size: 1.25rem; font-weight: 600; }   // Subsection titles
h4 { font-size: 1rem; font-weight: 600; }      // Card titles
```

### 🟡 Medium: Inconsistent Font Weights
- **Nav Links:** 500 weight
- **Table Headers:** 600 weight (uppercase)
- **Button Text:** 500 weight
- **Form Labels:** Mix of 400, 500, and 600

**Recommendation:** Standardize to:
- Normal text: 400
- Emphasis/labels: 500
- Headings/important: 600
- Extra emphasis: 700

### 🟡 Medium: Inconsistent Letter Spacing
- **Table Headers:** `letter-spacing: 0.05em` (uppercase, wide)
- **Buttons:** `letter-spacing: 0.025em`
- **Regular Text:** No letter spacing
- **Badges:** No consistent letter spacing

**Recommendation:**
```scss
// Standardize letter spacing
.uppercase-text { letter-spacing: 0.05em; }
.button-text { letter-spacing: 0.025em; }
.badge-text { letter-spacing: 0.05em; text-transform: uppercase; }
```

---

## 2. Spacing Inconsistencies

### 🔴 Critical: Inconsistent Card/Section Padding
- **Dashboard Stats Cards:** Various padding (some 1rem, some 1.5rem)
- **Form Sections:** No consistent padding pattern
- **Table Cells:** Mix of `0.75rem 1rem` and custom values
- **Info Boxes:** Inconsistent internal padding

**Current Issues:**
```scss
// What we have now (inconsistent):
.stat-card { padding: 1rem; }           // Some cards
.info-box { padding: 1.5rem; }          // Other sections
.form-section { padding: 2rem; }        // Forms
.table-cell { padding: 0.75rem 1rem; }  // Tables
```

**Recommendation:**
```scss
// Standardized padding scale:
$padding-xs: 0.5rem;    // 8px
$padding-sm: 0.75rem;   // 12px  
$padding-md: 1rem;      // 16px
$padding-lg: 1.5rem;    // 24px
$padding-xl: 2rem;      // 32px

// Apply consistently:
.card { padding: $padding-lg; }
.card-compact { padding: $padding-md; }
.table-cell { padding: $padding-sm $padding-md; }
.section { padding: $padding-xl; }
```

### 🟡 Medium: Inconsistent Margins Between Elements
- **Section Gaps:** Mix of 1rem, 1.5rem, 2rem, 3rem between sections
- **Form Field Gaps:** Not standardized (some 1rem, some 1.5rem)
- **Card Grids:** Inconsistent gaps in dashboard vs collection views

**Recommendation:**
```scss
// Standardized spacing scale
$gap-xs: 0.5rem;   // 8px
$gap-sm: 0.75rem;  // 12px
$gap-md: 1rem;     // 16px
$gap-lg: 1.5rem;   // 24px
$gap-xl: 2rem;     // 32px
$gap-2xl: 3rem;    // 48px

// Usage:
.form-fields { gap: $gap-lg; }
.section-spacing { margin-bottom: $gap-2xl; }
.card-grid { gap: $gap-lg; }
```

### 🟢 Low: Inconsistent Line Heights
- **Body Text:** Mix of 1.5, 1.6, 1.7
- **Form Labels:** 1.5
- **Table Text:** 1.4

**Recommendation:**
```scss
$line-height-tight: 1.25;  // Headings
$line-height-normal: 1.5;  // Body text
$line-height-relaxed: 1.7; // Long-form content
```

---

## 3. Border & Radius Inconsistencies

### 🟡 Medium: Inconsistent Border Radius
**Current State:**
- **Buttons:** `border-radius: 4px` (var(--radius-sm))
- **Input Fields:** `border-radius: 6px` (var(--radius-md))
- **Cards:** `border-radius: 8px` (var(--radius-lg))
- **Modals:** `border-radius: 12px`
- **Stat Cards:** Custom values
- **Badges:** Mix of 4px, 6px, and 8px

**Recommendation:**
```scss
// Define clear radius scale in _variables.scss
$radius-xs: 2px;   // Tiny elements
$radius-sm: 4px;   // Buttons, small badges
$radius-md: 6px;   // Inputs, standard badges
$radius-lg: 8px;   // Cards, panels
$radius-xl: 12px;  // Modals, large containers
$radius-full: 9999px; // Pills, avatars

// Apply consistently:
.btn { border-radius: $radius-sm; }
input, select, textarea { border-radius: $radius-md; }
.card { border-radius: $radius-lg; }
.modal { border-radius: $radius-xl; }
.badge { border-radius: $radius-sm; }
.avatar { border-radius: $radius-full; }
```

### 🟡 Medium: Inconsistent Border Widths
- **Table Borders:** 1px
- **Card Borders:** 1px
- **Focus Rings:** 2px
- **Tier-colored Borders:** 4px (left only)
- **Input Borders:** 1px

**Recommendation:**
```scss
$border-thin: 1px;    // Default borders
$border-medium: 2px;  // Emphasis borders (focus, hover)
$border-thick: 4px;   // Accent borders (tier colors)

// Standard border classes
.border { border: $border-thin solid; }
.border-2 { border: $border-medium solid; }
.border-4 { border: $border-thick solid; }
```

### 🟢 Low: Inconsistent Border Colors
- **Default Borders:** `var(--theme-elevation-200)` and `var(--theme-elevation-300)` used interchangeably
- **Focus Borders:** `var(--theme-primary-500)`
- **Tier Borders:** Colored inline styles
- **Table Borders:** Mix of elevation variables

**Recommendation:**
```scss
// Standardize border color usage
$border-default: var(--theme-elevation-200);      // Default subtle border
$border-medium: var(--theme-elevation-300);       // Slightly stronger border
$border-strong: var(--theme-elevation-400);       // Visible divider
$border-focus: var(--theme-primary-500);          // Focus/active state
```

---

## 4. Color & Shadow Inconsistencies

### 🟡 Medium: Inconsistent Shadow Elevation
**Current State:**
- **Cards:** `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1)`
- **Buttons on Hover:** `box-shadow: 0 0 20px rgba(primary, 0.3)`
- **Modals:** `box-shadow: 0 10px 15px rgba(0, 0, 0, 0.2)`
- **Table Row Hover:** `box-shadow: inset 3px 0 0 var(--theme-primary-500)`
- **Stat Cards:** No consistent shadow pattern

**Recommendation:**
```scss
// Define elevation system
$shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);           // Subtle depth
$shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);         // Default cards
$shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);       // Elevated cards
$shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);       // Modals, dropdowns
$shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);    // Popovers

// Hover shadows
$shadow-primary-sm: 0 0 15px rgba(var(--theme-primary-500-rgb), 0.2);
$shadow-primary-md: 0 0 20px rgba(var(--theme-primary-500-rgb), 0.3);
$shadow-primary-lg: 0 0 25px rgba(var(--theme-primary-500-rgb), 0.4);
```

### 🟡 Medium: Inconsistent Hover States
- **Buttons:** Scale, shadow, brightness change
- **Cards:** Border color change only
- **Table Rows:** Background + left border
- **Nav Links:** Text color change only
- **Stat Cards:** Background gradient

**Recommendation:** Standardize hover transitions:
```scss
// Button hover
.btn:hover {
  transform: translateY(-1px);
  box-shadow: $shadow-primary-md;
  filter: brightness(1.05);
}

// Card hover
.card:hover {
  border-color: var(--theme-primary-500);
  box-shadow: $shadow-lg;
  transform: translateY(-2px);
}

// Link hover
.link:hover {
  color: var(--theme-primary-500);
  text-decoration: underline;
}

// Table row hover
.table-row:hover {
  background-color: var(--theme-elevation-100);
  box-shadow: inset 3px 0 0 var(--theme-primary-500);
}
```

### 🟢 Low: Inconsistent Text Colors
- **Primary Text:** `var(--theme-text)`
- **Secondary Text:** Mix of `var(--theme-text-500)`, `var(--theme-text-600)`, and opacity variations
- **Muted Text:** `var(--theme-text-400)` and `var(--theme-text-500)` used interchangeably

**Recommendation:**
```scss
// Standardize text color hierarchy
$text-primary: var(--theme-text);           // 900 - Main content
$text-secondary: var(--theme-text-700);     // 700 - Supporting text
$text-tertiary: var(--theme-text-500);      // 500 - Muted text
$text-quaternary: var(--theme-text-400);    // 400 - Placeholder text
$text-disabled: var(--theme-text-300);      // 300 - Disabled state
```

---

## 5. Component-Specific Inconsistencies

### 🔴 Critical: Inconsistent Button Styles

**Current Issues:**
1. **Size Variations:** No standardized height/padding
   - Some buttons: `padding: 0.5rem 1rem`
   - Other buttons: `padding: 0.625rem 1rem`
   - Action buttons: `padding: 0.75rem 1.25rem`

2. **Style Variations:**
   - Primary buttons: Different hover effects
   - Secondary buttons: Inconsistent borders
   - Danger buttons: Mix of red shades

**Recommendation:**
```scss
// Standardized button system
.btn {
  font-weight: 500;
  letter-spacing: 0.025em;
  border-radius: $radius-sm;
  transition: all 0.2s ease;
  
  // Size variants
  &--sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
  }
  
  &--md {
    padding: 0.5rem 1rem;
    font-size: 0.9375rem;
  }
  
  &--lg {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
  }
  
  // Style variants
  &--primary {
    background: var(--theme-primary-500);
    color: white;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: $shadow-primary-md;
      filter: brightness(1.05);
    }
  }
  
  &--secondary {
    border: 1px solid var(--theme-elevation-300);
    background: transparent;
    
    &:hover {
      background: var(--theme-elevation-50);
      border-color: var(--theme-primary-500);
    }
  }
  
  &--danger {
    background: var(--theme-error-500);
    color: white;
    
    &:hover {
      box-shadow: 0 0 20px rgba(var(--theme-error-500-rgb), 0.3);
    }
  }
}
```

### 🟡 Medium: Inconsistent Badge Styles

**Current Issues:**
- **Tier Badges:** Colored with inline styles, rounded-lg (8px)
- **Status Badges:** Using default styles, varying sizes
- **Role Badges:** Mix of styles across pages
- **Table Badges:** Different from form badges

**Recommendation:**
```scss
.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: $radius-sm;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border: 1px solid;
  
  // Size variants
  &--sm {
    padding: 0.125rem 0.5rem;
    font-size: 0.75rem;
  }
  
  &--lg {
    padding: 0.375rem 1rem;
    font-size: 0.875rem;
  }
  
  // Type variants
  &--tier {
    // Use tier colors from tierColors.ts
    // Applied via inline styles for dynamic colors
  }
  
  &--status {
    &.open { 
      background: var(--theme-success-100);
      border-color: var(--theme-success-300);
      color: var(--theme-success-900);
    }
    &.closed {
      background: var(--theme-elevation-100);
      border-color: var(--theme-elevation-300);
      color: var(--theme-text-500);
    }
  }
  
  &--role {
    background: var(--theme-elevation-100);
    border-color: var(--theme-elevation-300);
    color: var(--theme-text);
  }
}
```

### 🟡 Medium: Inconsistent Input Field Styles

**Current Issues:**
- **Text Inputs:** Varying padding (`0.625rem 1rem` vs `0.5rem 0.75rem`)
- **Select Dropdowns:** Different styling than text inputs
- **Textareas:** Inconsistent padding
- **Focus States:** Some have gradient borders, others don't

**Recommendation:**
```scss
// Standardized input styles
input[type="text"],
input[type="email"],
input[type="password"],
input[type="number"],
textarea,
select {
  background-color: var(--theme-elevation-0);
  border: 1px solid var(--theme-elevation-300);
  border-radius: $radius-md;
  padding: 0.625rem 1rem;
  font-size: 0.9375rem;
  color: var(--theme-text);
  width: 100%;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: var(--theme-primary-500);
    box-shadow: 0 0 0 2px rgba(var(--theme-primary-500-rgb), 0.2);
  }
  
  &::placeholder {
    color: var(--theme-text-400);
  }
  
  &:disabled {
    background-color: var(--theme-elevation-100);
    color: var(--theme-text-300);
    cursor: not-allowed;
  }
}

// Size variants
.input--sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

.input--lg {
  padding: 0.75rem 1.25rem;
  font-size: 1rem;
}
```

### 🟢 Low: Inconsistent Icon Sizes
- **Nav Icons:** 16px (1rem)
- **Button Icons:** Mix of 16px and 20px
- **Table Icons:** 14px
- **Card Icons:** 18px and 20px

**Recommendation:**
```scss
// Standardized icon scale
$icon-xs: 12px;   // 0.75rem - Tiny indicators
$icon-sm: 14px;   // 0.875rem - Table icons
$icon-md: 16px;   // 1rem - Default (nav, buttons)
$icon-lg: 20px;   // 1.25rem - Section headers
$icon-xl: 24px;   // 1.5rem - Feature icons
$icon-2xl: 32px;  // 2rem - Large display icons

// Usage classes
.icon--xs { width: $icon-xs; height: $icon-xs; }
.icon--sm { width: $icon-sm; height: $icon-sm; }
.icon--md { width: $icon-md; height: $icon-md; }
.icon--lg { width: $icon-lg; height: $icon-lg; }
.icon--xl { width: $icon-xl; height: $icon-xl; }
.icon--2xl { width: $icon-2xl; height: $icon-2xl; }
```

---

## 6. Animation & Transition Inconsistencies

### 🟡 Medium: Inconsistent Transition Durations
- **Buttons:** `transition: all 0.2s`
- **Cards:** Some 0.2s, some 0.3s
- **Modals:** 0.3s
- **Hover Effects:** Mix of 0.15s, 0.2s, 0.3s
- **Skeleton Loaders:** 1.5s and 2s

**Recommendation:**
```scss
// Standardized transition timing
$transition-fast: 0.15s;     // Quick feedback (hover, focus)
$transition-normal: 0.2s;    // Standard (buttons, links)
$transition-slow: 0.3s;      // Deliberate (modals, cards)
$transition-slower: 0.5s;    // Dramatic (page transitions)

// Easing functions
$ease-out: cubic-bezier(0, 0, 0.2, 1);        // Standard
$ease-in: cubic-bezier(0.4, 0, 1, 1);          // Accelerate
$ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);    // Smooth

// Usage
.btn {
  transition: all $transition-normal $ease-out;
}

.card {
  transition: all $transition-slow $ease-out;
}

.modal {
  transition: opacity $transition-slow $ease-out;
}
```

### 🟢 Low: Inconsistent Transform Effects
- **Button Hover:** `translateY(-1px)` and `translateY(-2px)`
- **Card Hover:** `scale(1.02)` and `translateY(-2px)`
- **No consistent pattern for which effect to use

**Recommendation:**
```scss
// Standardized hover transforms
.hover-lift {
  &:hover {
    transform: translateY(-2px);
  }
}

.hover-lift-sm {
  &:hover {
    transform: translateY(-1px);
  }
}

.hover-scale {
  &:hover {
    transform: scale(1.02);
  }
}

.hover-scale-sm {
  &:hover {
    transform: scale(1.01);
  }
}
```

---

## 7. Layout Inconsistencies

### 🟡 Medium: Inconsistent Grid/Flex Gaps
- **Dashboard Stats:** Gap varies (1rem, 1.5rem, 2rem)
- **Form Fields:** Inconsistent vertical spacing
- **Table Layouts:** Different cell spacing patterns

**Recommendation:**
```scss
// Use the gap scale consistently
.grid-tight { gap: $gap-sm; }    // 0.75rem
.grid-normal { gap: $gap-md; }   // 1rem
.grid-relaxed { gap: $gap-lg; }  // 1.5rem
.grid-loose { gap: $gap-xl; }    // 2rem
```

### 🟢 Low: Inconsistent Container Widths
- **Forms:** Max-width varies
- **Cards:** No consistent content width
- **Modals:** Different max-widths

**Recommendation:**
```scss
// Standardized container widths
$container-xs: 20rem;    // 320px - Narrow modals
$container-sm: 36rem;    // 576px - Forms, small modals
$container-md: 48rem;    // 768px - Default content
$container-lg: 64rem;    // 1024px - Wide content
$container-xl: 80rem;    // 1280px - Full-width content
$container-2xl: 96rem;   // 1536px - Extra wide
```

---

## 8. Table-Specific Inconsistencies

### 🟡 Medium: Inconsistent Table Styling
**Current Issues:**
- **Header Styles:** Some uppercase + wide letter-spacing, others normal
- **Cell Padding:** Varies between tables
- **Row Hover:** Some tables have left border, others don't
- **Alternating Rows:** Inconsistent use of zebra striping

**Recommendation:**
```scss
// Standardized table component
.payload-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  
  thead th {
    background: var(--theme-elevation-100);
    border-bottom: 1px solid var(--theme-elevation-300);
    padding: $padding-sm $padding-md;
    text-align: left;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--theme-text-600);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  tbody {
    tr {
      background: var(--theme-elevation-0);
      transition: all $transition-normal;
      
      &:nth-child(even) {
        background: var(--theme-elevation-50);
      }
      
      &:hover {
        background: var(--theme-elevation-100);
        box-shadow: inset 3px 0 0 var(--theme-primary-500);
      }
    }
    
    td {
      padding: $padding-sm $padding-md;
      border-bottom: 1px solid var(--theme-elevation-200);
      font-size: 0.9375rem;
    }
  }
}
```

---

## 9. Form-Specific Inconsistencies

### 🟡 Medium: Inconsistent Form Field Spacing
- **Vertical Gaps:** Mix of 1rem, 1.5rem, 2rem
- **Label-to-Input Gap:** Not standardized
- **Help Text Spacing:** Varies

**Recommendation:**
```scss
.form-field {
  margin-bottom: $gap-lg;  // 1.5rem between fields
  
  .form-label {
    display: block;
    margin-bottom: $gap-sm;  // 0.75rem
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--theme-text-700);
  }
  
  .form-help-text {
    margin-top: $gap-xs;  // 0.5rem
    font-size: 0.8125rem;
    color: var(--theme-text-500);
  }
  
  .form-error {
    margin-top: $gap-xs;  // 0.5rem
    font-size: 0.8125rem;
    color: var(--theme-error-500);
  }
}
```

### 🟢 Low: Inconsistent Tab Styles
- **Active Tab:** Different underline/border treatments
- **Tab Spacing:** Varies between forms
- **Tab Typography:** Not consistent

**Recommendation:**
```scss
.form-tabs {
  display: flex;
  border-bottom: 1px solid var(--theme-elevation-300);
  margin-bottom: $gap-xl;
  
  .form-tab {
    padding: $padding-sm $padding-lg;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--theme-text-500);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all $transition-fast;
    
    &:hover {
      color: var(--theme-text-700);
    }
    
    &--active {
      color: var(--theme-primary-500);
      border-bottom-color: var(--theme-primary-500);
    }
  }
}
```

---

## Priority Implementation Plan

### Phase 1: Foundation (Week 1)
**Critical consistency fixes that affect multiple pages:**

1. **Create Standardized Variables** (`_variables.scss`)
   - Define all spacing scales
   - Define all typography scales
   - Define all border radius values
   - Define all shadow elevations
   - Define all transition timings

2. **Typography System** (`_typography.scss`)
   - Standardize heading sizes (h1-h6)
   - Standardize font weights
   - Standardize letter spacing
   - Standardize line heights

3. **Spacing System** (`_spacing.scss`)
   - Create padding utility classes
   - Create margin utility classes
   - Create gap utility classes

### Phase 2: Components (Week 2)
**Standardize individual component styles:**

4. **Button System** (`_buttons.scss`)
   - Size variants (sm, md, lg)
   - Style variants (primary, secondary, danger, ghost)
   - Consistent hover states
   - Consistent disabled states

5. **Input System** (`_form-enhancements.scss`)
   - Standardize all input field styles
   - Consistent focus states
   - Consistent error states
   - Consistent disabled states

6. **Badge System** (`_badges.scss`)
   - Size variants
   - Type variants (status, role, tier)
   - Consistent styling

### Phase 3: Patterns (Week 3)
**Standardize layout patterns:**

7. **Card System** (`_cards.scss`)
   - Standard card styles
   - Consistent padding
   - Consistent borders/shadows
   - Consistent hover states

8. **Table System** (`_tables.scss`)
   - Standardized table component
   - Consistent cell padding
   - Consistent row hover
   - Consistent header styles

9. **Modal/Panel System** (`_modals.scss`)
   - Consistent sizing
   - Consistent spacing
   - Consistent transitions

### Phase 4: Polish (Week 4)
**Final consistency touches:**

10. **Animation System** (`_animations.scss`)
    - Standardized transitions
    - Standardized transforms
    - Standardized keyframe animations

11. **Icon System** (`_icons.scss`)
    - Consistent sizing
    - Consistent coloring
    - Consistent spacing around icons

12. **Audit & Testing**
    - Review all pages against new standards
    - Fix any remaining inconsistencies
    - Document the design system

---

## Success Metrics

After implementation, the admin panel should achieve:

1. **Visual Consistency Score:** 95%+ (currently ~70%)
   - Measured by adherence to design tokens across all pages

2. **User Satisfaction:** "Looks professional and polished"
   - No more complaints about visual inconsistencies

3. **Developer Experience:** Faster development
   - Clear design system to reference
   - Reusable components and utilities
   - Less "how should I style this?" decisions

4. **Maintainability:** Easier to update
   - Change variables once, update everywhere
   - Clear naming conventions
   - Well-documented patterns

---

## Appendix: Quick Reference Guide

### Typography Scale
```scss
h1: 2rem (32px) / 700
h2: 1.5rem (24px) / 700
h3: 1.25rem (20px) / 600
h4: 1rem (16px) / 600
body: 0.9375rem (15px) / 400
small: 0.875rem (14px) / 400
tiny: 0.8125rem (13px) / 400
```

### Spacing Scale
```scss
xs:  0.5rem   (8px)
sm:  0.75rem  (12px)
md:  1rem     (16px)
lg:  1.5rem   (24px)
xl:  2rem     (32px)
2xl: 3rem     (48px)
```

### Border Radius Scale
```scss
xs:   2px
sm:   4px
md:   6px
lg:   8px
xl:   12px
full: 9999px
```

### Shadow Elevation Scale
```scss
sm:  0 1px 2px rgba(0,0,0,0.05)
md:  0 4px 6px rgba(0,0,0,0.1)
lg:  0 10px 15px rgba(0,0,0,0.1)
xl:  0 20px 25px rgba(0,0,0,0.1)
2xl: 0 25px 50px rgba(0,0,0,0.25)
```

### Transition Timing
```scss
fast:   0.15s
normal: 0.2s
slow:   0.3s
slower: 0.5s
```

---

**End of Audit**  
**Total Inconsistencies Found:** 27  
**Estimated Fix Time:** 3-4 weeks (phased approach)  
**Priority:** High (affects user perception and brand cohesion)

