# Clean Glow Design System

**Created**: December 25, 2025  
**Philosophy**: "Sleek, clean, and glowy" - Transparent backgrounds with vibrant glowing borders  
**Applied to**: Admin panel (Production Dashboard, Forms, Search, Collections)

---

## Overview

A modern, premium design system featuring **ultra-transparent backgrounds** with **vibrant glowing borders** and **colorful accents**. The emphasis is on **borders that glow**, not heavy dark backgrounds. Creates a clean, sleek, energy-filled aesthetic that feels light and professional.

---

## Section-Based Color Theming (NEW!)

**Added**: December 25, 2025  
**Impact**: Each admin section now has its own color identity

### The System

The admin panel now uses **dynamic section-based theming** where each major section automatically themes all its components to a specific color. This creates clear visual hierarchy and helps users understand which part of the system they're in.

### Section Color Mapping

| Section | Color | Hex Code | Purpose |
|---------|-------|----------|---------|
| **People & Teams** | Pink/Fuchsia | `#ec4899` | Warm, people-focused |
| **Production & Matches** | Cyan/Blue | `#06b6d4` | Tech, broadcast |
| **Staff** | Purple/Violet | `#8b5cf6` | Management, coordination |
| **System & Users** | Orange | `#f59e0b` | Admin functions |
| **Recruitment** | Green/Emerald | `#10b981` | Growth, new members |

### How It Works

**1. CSS Custom Properties:**
```scss
:root {
  --section-color: #{$admin-accent-primary}; // Default purple
  --section-color-rgb: 139, 92, 246;
}

[data-section="people"] {
  --section-color: #{$tier-masters}; // Pink
  --section-color-rgb: 236, 72, 153;
}
```

**2. Automatic Application:**
```scss
[data-section] {
  // All components within a section automatically use section color
  button[type="submit"] {
    border-color: rgba(var(--section-color-rgb), 0.7);
    box-shadow: 0 0 12px rgba(var(--section-color-rgb), 0.15);
  }
}
```

**3. React Integration:**
```tsx
// Automatically applied based on route
<SectionThemeApplicator /> // In payload.config.ts

// Or manually for custom components
<div data-section="production" className="my-component">
  {/* All Clean Glow components here get cyan theme */}
</div>
```

### What Gets Themed

When a section color is applied, these elements automatically update:

- ✅ Page headers (h1, h2, h3)
- ✅ Primary buttons (submit, create new)
- ✅ Cards and containers
- ✅ Table headers
- ✅ Navigation (active state)
- ✅ Form inputs (focus state)
- ✅ Badges and pills (primary variants)
- ✅ Accent bars
- ✅ Links (hover state)

### Manual Color Overrides

Section theming is the **default**, but you can still override for specific elements:

```scss
// Use section color (automatic)
button {
  @include glow-button(var(--section-color));
}

// Override with specific color
button.delete {
  @include glow-button($admin-accent-error); // Always red
}

button.success {
  @include glow-button($admin-accent-success); // Always green
}
```

### Benefits

1. **Visual Hierarchy**: Instantly know which section you're in
2. **Reduced Cognitive Load**: Color-coded navigation aids
3. **Consistency**: All components in a section share a theme
4. **Flexibility**: Easy to add new sections or change colors
5. **Maintainability**: One variable change affects entire section

---

## Core Principles

### 1. **🌟 Transparency First** (The Foundation)

Backgrounds should be **barely visible** - just enough to create subtle depth without feeling heavy.

**Opacity Guidelines:**
- **Ultra-Light**: `rgba(0, 0, 0, 0.03)` - 3% opacity (badges, small elements)
- **Light**: `rgba(0, 0, 0, 0.05)` - 5% opacity (cards, containers)
- **Medium**: `rgba(0, 0, 0, 0.08)` - 8% opacity (buttons, interactive elements)

**❌ OLD WAY (Dark & Heavy):**
```scss
background: linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.5));  // 40-50% opacity
```

**✅ NEW WAY (Clean & Transparent):**
```scss
@include transparent-bg(0.05);  // 5% opacity - barely visible!
```

---

### 2. **✨ Glowing Borders** (The Star of the Show)

Borders are the **primary visual element** - they should be vibrant, colorful, and glow beautifully on hover.

**Border Opacity:**
- **Default**: `50-60%` opacity (visible and vibrant)
- **Hover**: `80-90%` opacity (more intense glow)

**Glow Effect:**
```scss
box-shadow: 0 0 12px rgba($color, 0.15);  // Subtle outer glow
box-shadow: 0 0 20px rgba($color, 0.3);   // Hover: stronger glow
```

**Example:**
```scss
border: 1px solid rgba($color, 0.5);           // 50% opacity - vibrant!
box-shadow: 0 0 12px rgba($color, 0.15);       // Outer glow
transition: all 0.2s ease;

&:hover {
  border-color: rgba($color, 0.8);              // 80% opacity - intense!
  box-shadow: 0 0 20px rgba($color, 0.3);       // Stronger glow
}
```

---

### 3. **🎨 Color Variety** (Not Just Purple!)

Use the full **7-tier color palette** for different UI elements. Avoid using the same color everywhere.

**Color Strategy:**
- **Columns Button:** Cyan (`#06b6d4`)
- **Filters Button:** Lime/Green (`#84cc16`)
- **Pending Status:** Purple/Indigo (`$admin-accent-primary`)
- **Confirmed/Assigned:** Emerald (`#10b981`)
- **Team Tiers:** Masters (pink), Expert (purple), Advanced (blue), etc.

**Example:**
```scss
// Don't do this (same color everywhere):
.button { border-color: $admin-accent-primary; }
.badge { border-color: $admin-accent-primary; }
.card { border-color: $admin-accent-primary; }

// Do this (color variety):
.columns-button { border-color: #06b6d4; }  // Cyan
.filters-button { border-color: #84cc16; }  // Lime
.pending-badge { border-color: $admin-accent-primary; }  // Purple
.assigned-badge { border-color: #10b981; }  // Green
```

---

### 4. **📍 Glowing Accent Bars**

3-4px vertical bars on the left side that add color and visual interest.

**Specs:**
- **Width**: `3-4px`
- **Height**: `60%` of container
- **Glow**: `0 0 8-15px rgba($color, 0.5-0.7)`
- **Position**: Absolute, left side, vertically centered

**Example:**
```scss
@include glow-accent-bar($color, 3px, 60%);

// Generates:
&::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: $color;
  border-radius: 2px;
  box-shadow: 0 0 8px rgba($color, 0.5);
}
```

---

### 5. **🌫️ Glass Morphism** (Subtle Blur)

Use `backdrop-filter: blur()` sparingly for depth, but keep it subtle.

**Guidelines:**
- **Cards/Containers**: `blur(4-8px)`
- **Badges**: `blur(4px)`
- **Don't overuse** - not every element needs blur

```scss
backdrop-filter: blur(4px);  // Subtle glass effect
```

---

### 6. **⚡ Smooth Interactions**

All interactive elements should have smooth transitions and hover effects.

**Standard Transition:**
```scss
transition: all 0.2s ease;
```

**Hover Effects:**
```scss
&:hover {
  background: rgba($color, 0.1);           // Light tint (10% opacity)
  transform: translateY(-1px);             // Slight lift
  box-shadow: 0 0 20px rgba($color, 0.3); // Stronger glow
}
```

---

## Mixin System

We've created **8 reusable mixins** for consistent styling across the admin panel.

### Core Mixins:

#### `@include transparent-bg($alpha)`
Creates ultra-light transparent backgrounds.

```scss
@include transparent-bg(0.05);  // 5% black background

// Generates:
background: rgba(0, 0, 0, 0.05);
```

**When to use:**
- Cards: `0.05` (5%)
- Badges: `0.03` (3%)
- Buttons: `0.08` (8%)

---

#### `@include glow-border($color, $alpha, $hover-alpha)`
Creates vibrant glowing borders with hover effects.

```scss
@include glow-border($admin-accent-primary);
// Or with custom opacity:
@include glow-border(#10b981, 0.5, 0.8);

// Generates:
border: 1px solid rgba($color, 0.5);
box-shadow: 0 0 12px rgba($color, 0.15);
transition: all 0.2s ease;

&:hover {
  border-color: rgba($color, 0.8);
  box-shadow: 0 0 20px rgba($color, 0.3);
}
```

---

#### `@include glow-badge($color)`
Complete badge styling with transparent background and glowing border.

```scss
@include glow-badge($tier-masters);  // Pink badge

// Generates:
background: rgba(0, 0, 0, 0.03);
border: 1px solid rgba($color, 0.5);
box-shadow: 0 0 12px rgba($color, 0.15);
border-radius: 8px;
color: rgba(255, 255, 255, 0.95);
backdrop-filter: blur(4px);
transition: all 0.2s ease;

&:hover {
  background: rgba($color, 0.1);
  transform: translateY(-1px);
}
```

**Perfect for:**
- Status badges
- Role badges
- Tag pills
- Chips

---

#### `@include glow-card($color)`
Complete card styling with transparent background and glowing border.

```scss
@include glow-card($admin-accent-info);  // Cyan card

// Generates:
background: rgba(0, 0, 0, 0.05);
border: 1px solid rgba($color, 0.5);
box-shadow: 0 0 12px rgba($color, 0.15);
border-radius: 8px;
backdrop-filter: blur(8px);
transition: all 0.2s ease;

&:hover {
  background: rgba($color, 0.05);
  transform: translateY(-2px);
}
```

**Perfect for:**
- Content cards
- Containers
- Panels

---

#### `@include glow-button($color)`
Button styling with transparent background and colored glow.

```scss
@include glow-button($tier-expert);  // Purple button

// Generates:
background: rgba(0, 0, 0, 0.08);
border: 1px solid rgba($color, 0.5);
box-shadow: 0 0 12px rgba($color, 0.15);
border-radius: 8px;
color: white;
backdrop-filter: blur(4px);
transition: all 0.2s ease;

&:hover {
  background: rgba($color, 0.15);
  transform: translateY(-1px);
}

&:active {
  transform: translateY(0);
  background: rgba($color, 0.2);
}
```

---

#### `@include glow-accent-bar($color, $width, $height)`
Creates a glowing vertical accent bar on the left side.

```scss
@include glow-accent-bar($tier-masters, 3px, 60%);

// Generates:
position: relative;

&::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: $tier-masters;
  border-radius: 2px;
  box-shadow: 0 0 8px rgba($tier-masters, 0.5);
  transition: all 0.2s ease;
}
```

**Perfect for:**
- Badge accents
- Card left borders
- Section headers

---

#### `@include glow-header($color)`
Section header styling with glowing accents.

```scss
@include glow-header(#10b981);  // Green header

// Generates:
background: rgba(0, 0, 0, 0.05);
border: 1px solid rgba($color, 0.5);
box-shadow: 0 0 12px rgba($color, 0.15);
border-radius: 8px;
padding: 1rem 1.25rem;
backdrop-filter: blur(4px);
position: relative;

// Glowing left accent
&::before { /* 4px vertical bar */ }

// Glowing bottom accent
&::after { /* Gradient underline */ }
```

---

#### `@include glass-effect($blur, $alpha)`
Glass morphism effect with backdrop blur.

```scss
@include glass-effect(4px, 0.03);

// Generates:
backdrop-filter: blur(4px);
background: rgba(0, 0, 0, 0.03);
```

---

## Component Patterns

### Badge/Pill Component ✨

**The Clean Glow Way:**
```scss
.badge {
  @include glow-badge($admin-accent-primary);
  @include glow-accent-bar($admin-accent-primary);
  padding: 0.5rem 1rem 0.5rem 1.15rem;  // Extra left padding for accent bar
}

.badge--success {
  @include glow-badge(#10b981);
  @include glow-accent-bar(#10b981);
}

.badge--masters {
  @include glow-badge($tier-masters);
  @include glow-accent-bar($tier-masters);
}
```

**Result:**
- 3% transparent background (barely visible)
- 50% opacity border (vibrant purple/green/pink)
- Glowing left accent bar
- Subtle outer glow
- Smooth hover: brightens border to 80%, lifts up 1px

---

### Button Component ✨

**The Clean Glow Way:**
```scss
.button {
  @include glow-button($admin-accent-primary);
}

.button--columns {
  @include glow-button(#06b6d4);  // Cyan theme
}

.button--filters {
  @include glow-button(#84cc16);  // Lime theme
}
```

**Result:**
- 8% transparent background
- Vibrant colored border
- Glowing effect
- Hover: background tints with color, border intensifies

---

### Card Component ✨

**The Clean Glow Way:**
```scss
.card {
  @include glow-card($admin-accent-primary);
  padding: 1.5rem;
  
  &--assigned {
    @include glow-card(#10b981);  // Green variant
  }
}

.card__header {
  @include transparent-bg(0.05);
  @include glow-border($admin-accent-info, 0.5, 0.8);
  padding: 1.25rem;
  border-radius: 8px;
  
  // Add left accent
  @include glow-accent-bar($admin-accent-info);
}
```

**Result:**
- 5% transparent background on card
- Vibrant glowing border
- Header with subtle background + cyan accent bar
- Glass blur effect for depth

---

### Section Header ✨

**The Clean Glow Way:**
```scss
.section-header {
  @include glow-header($admin-accent-primary);
}

.section-header--success {
  @include glow-header(#10b981);  // Green header
}
```

**Result:**
- Dark pill-style background (5% opacity)
- Glowing left accent bar (4px)
- Glowing bottom gradient accent
- Full glow effect

---

## Color Palette

### Primary Accent Colors

**Admin UI:**
- **Indigo (Primary)**: `$admin-accent-primary` - `rgb(99, 102, 241)` / `#6366f1`
- **Cyan (Info)**: `$admin-accent-info` - `rgb(6, 182, 212)` / `#06b6d4`
- **Green (Success)**: `$admin-accent-success` - `rgb(34, 197, 94)` / `#22c55e`
- **Emerald (Confirmed)**: `#10b981`
- **Lime (Filters)**: `#84cc16`

### Tier Colors (7-Tier System)

Perfect for skill ratings, rankings, levels, or adding color variety:

| Tier | Variable | Color | RGB | Hex |
|------|----------|-------|-----|-----|
| **Masters** | `$tier-masters` | Pink | `236, 72, 153` | `#ec4899` |
| **Expert** | `$tier-expert` | Purple | `168, 85, 247` | `#a855f7` |
| **Advanced** | `$tier-advanced` | Blue | `59, 130, 246` | `#3b82f6` |
| **4k-4.5k** | `$tier-4k` | Cyan | `6, 182, 212` | `#06b6d4` |
| **3.5k-3.9k** | `$tier-35k` | Green | `34, 197, 94` | `#22c55e` |
| **3.0k-3.4k** | `$tier-30k` | Yellow | `234, 179, 8` | `#eab308` |
| **Below 3k** | `$tier-below` | Orange | `249, 115, 22` | `#f97316` |

---

### Usage Examples with Color Variety:

```scss
// Columns button - Cyan theme
.list-controls__toggle-columns {
  @include glow-button(#06b6d4);
}

// Filters button - Lime theme
.list-controls__toggle-filters {
  @include glow-button(#84cc16);
}

// Pending status - Purple theme
.status-badge--pending {
  @include glow-badge($admin-accent-primary);
  @include glow-accent-bar($admin-accent-primary);
}

// Confirmed status - Green theme
.status-badge--confirmed {
  @include glow-badge(#10b981);
  @include glow-accent-bar(#10b981);
}

// Masters tier badge - Pink theme
.tier-badge--masters {
  @include glow-badge($tier-masters);
  @include glow-accent-bar($tier-masters);
}

// Expert tier card - Purple theme
.tier-card--expert {
  @include glow-card($tier-expert);
}
```

---

## Before & After Comparison

### Badge Styling:

**❌ OLD (Dark & Heavy):**
```scss
.badge {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.5));  // 40-50% opacity
  border: 1px solid rgba($color, 0.3);  // 30% opacity - dull
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);  // Dark shadow
}
```
**Issues:** Dark, heavy, clunky appearance. Border too subtle.

**✅ NEW (Clean & Glowy):**
```scss
.badge {
  @include glow-badge($color);
  @include glow-accent-bar($color);
}

// Expands to:
// background: rgba(0, 0, 0, 0.03);  ← 3% opacity - barely visible!
// border: 1px solid rgba($color, 0.5);  ← 50% opacity - vibrant!
// box-shadow: 0 0 12px rgba($color, 0.15);  ← Glowing!
```
**Result:** Sleek, clean, glowy. Border is the star. 🌟

---

### Card Styling:

**❌ OLD (Dark & Heavy):**
```scss
.card {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.4));  // 30-40% opacity
  border: 1px solid rgba($color, 0.2);  // 20% opacity - barely visible
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
```
**Issues:** Too dark, border not visible enough.

**✅ NEW (Clean & Glowy):**
```scss
.card {
  @include glow-card($color);
}

// Expands to:
// background: rgba(0, 0, 0, 0.05);  ← 5% opacity - transparent!
// border: 1px solid rgba($color, 0.5);  ← 50% opacity - stands out!
// box-shadow: 0 0 12px rgba($color, 0.15);  ← Colored glow!
```
**Result:** Light, airy, borders glow beautifully. ✨

---

## Usage Guidelines

### ✅ When to Use:

- **Interactive elements** (buttons, badges, pills, chips)
- **Status indicators** (pending, confirmed, assigned)
- **Cards and containers** (assignments, signups, panels)
- **Section headers** (with glowing accents)
- **Hover states** (brighten borders, lift elements)
- **Elements that need color variety** (Columns, Filters, different statuses)

### ❌ When NOT to Use:

- **Body text or paragraphs** (use standard text styles)
- **Every single element** (creates visual noise - be selective)
- **Static decorative elements** (glows are for interactive/important items)
- **Light backgrounds** (this system is designed for dark admin panels)

---

## Design Philosophy: "Sleek, Clean, and Glowy"

### Key Principles:

1. **Transparency Over Darkness**
   - Keep backgrounds barely visible (3-8% opacity)
   - Let the page background show through
   - Avoid heavy, dark, clunky appearance

2. **Borders Shine**
   - Borders are the primary visual element
   - Use 50-80% opacity for vibrancy
   - Add outer glows for extra depth

3. **Color Variety**
   - Don't use the same color everywhere
   - Leverage the 7-tier color palette
   - Assign semantic meaning to colors

4. **Smooth Interactions**
   - Everything transitions smoothly (0.2s)
   - Hover states brighten and lift
   - Active states provide feedback

5. **Subtle Depth**
   - Use backdrop blur sparingly
   - Add accent bars for visual interest
   - Keep shadows light and colored

---

## Accessibility

### Contrast:
- **Text on transparent backgrounds**: Maintain WCAG AA (4.5:1 contrast)
- **White text works well**: `rgba(255, 255, 255, 0.95-1)`
- **Test with color pickers**: Ensure readability

### Focus States:
```scss
&:focus-visible {
  outline: 2px solid $color;
  outline-offset: 2px;
  box-shadow: 0 0 20px rgba($color, 0.4);
}
```

### Reduced Motion:
```scss
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    transform: none !important;
  }
}
```

### Color Blindness:
- Don't rely solely on color for meaning
- Add icons to status badges
- Use labels with semantic text

---

## Examples in Codebase

### Production Dashboard:
- **Navigation Tabs**: `_production-dashboard.scss` (lines 1256-1310)
  - Uses `glow-card`, `glow-button`, `glow-accent-bar`
  
- **Role Badges**: `_production-dashboard.scss` (lines 1481-1514)
  - Uses `glow-badge`, `glow-accent-bar`
  
- **Status Badges**: `_production-dashboard.scss` (lines 1540-1568)
  - Uses `glow-badge`, `glow-accent-bar`
  - Color variants: Purple (pending), Green (confirmed)

- **Section Headers**: `_production-dashboard.scss` (lines 1182-1254)
  - Uses `glow-header`
  - Color variants: Purple, Green

### Forms:
- **React Select Multi-Value Badges**: `_forms.scss` (lines 228-270)
  - Uses `glow-badge`, `glow-accent-bar`
  - Clean, sleek appearance

### Search & Collections:
- **Columns/Filters Buttons**: `_search-enhancements.scss` (lines 118-162)
  - Cyan theme for Columns
  - Lime theme for Filters
  - Color variety in action!

---

## Quick Reference Card

| Element | Background Opacity | Border Opacity | Mixin |
|---------|-------------------|----------------|-------|
| **Badge** | 3% | 50% → 90% | `glow-badge` |
| **Card** | 5% | 50% → 80% | `glow-card` |
| **Button** | 8% | 50% → 80% | `glow-button` |
| **Header** | 5% | 50% → 80% | `glow-header` |

---

## Tips & Best Practices

### 1. Start Simple:
```scss
// Don't overthink it - just use the mixins!
.my-badge {
  @include glow-badge($color);
  @include glow-accent-bar($color);
}
```

### 2. Add Color Variety:
```scss
// Don't use the same color for everything
.button-a { @include glow-button(#06b6d4); }  // Cyan
.button-b { @include glow-button(#84cc16); }  // Lime
.button-c { @include glow-button(#a855f7); }  // Purple
```

### 3. Keep Backgrounds Light:
```scss
// ❌ Don't do this (too dark):
background: rgba(0, 0, 0, 0.4);

// ✅ Do this (barely visible):
@include transparent-bg(0.05);
```

### 4. Let Borders Glow:
```scss
// ❌ Don't do this (border too subtle):
border: 1px solid rgba($color, 0.2);

// ✅ Do this (vibrant):
@include glow-border($color, 0.5, 0.8);
```

---

## Future Applications

Consider applying to:
- ✅ **Production Dashboard** (Done!)
- ✅ **Form Elements** (Done!)
- ✅ **Search Buttons** (Done!)
- ⏳ **Modal overlays** (Pending)
- ⏳ **Notification toasts** (Pending)
- ⏳ **Sidebar navigation** (Pending)
- ⏳ **Dashboard stat cards** (Pending)
- ⏳ **Table row hover states** (Pending)

---

**Last Updated**: December 25, 2025  
**Status**: ✅ **Core system complete and in production!**

🌟 **Remember:** Clean, transparent backgrounds. Vibrant, glowing borders. Color variety everywhere! 🎨
