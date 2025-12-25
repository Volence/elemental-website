# Dark Glow Design System

**Created**: December 25, 2025  
**Applied to**: Production Dashboard (Staff Signups View)

## Overview

A premium, modern design system featuring dark semi-transparent backgrounds with vibrant glowing accents. Creates depth, energy, and a polished professional appearance.

## Core Principles

### 1. **Dark Rich Backgrounds**
- Semi-transparent black: `rgba(0, 0, 0, 0.4)` to `rgba(0, 0, 0, 0.5)`
- Gradient overlays: `linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.5))`
- Glass-morphism: `backdrop-filter: blur(4px)`
- Subtle inset highlights: `inset 0 1px 0 rgba(255, 255, 255, 0.05-0.1)`

### 2. **Glowing Borders**
- Accent-colored borders with transparency
- **Cyan (Primary)**: `rgba($admin-accent-primary, 0.3-0.6)`
- **Green (Success)**: `rgba(var(--theme-success-rgb), 0.5-0.7)`
- Hover increases opacity by 20-30%

### 3. **Glowing Accent Bars**
- 3px width colored bars
- Box-shadow for glow effect:
  - Default: `0 0 8px rgba(color, 0.5)`
  - Hover: `0 0 12-15px rgba(color, 0.8)`
- Height grows on hover (60% → 70% → 80%)

### 4. **Vibrant Text**
- High contrast white: `rgba(255, 255, 255, 0.95-1)`
- Medium weight fonts (500-600)
- Accent-colored text for special states

### 5. **Shadow Depth**
- Multiple shadow layers:
  - Outer: `0 2px 8px rgba(0, 0, 0, 0.15)`
  - Hover: `0 4px 12px rgba(accent-color, 0.25-0.35)`
  - Inset: `inset 0 1px 0 rgba(255, 255, 255, 0.05-0.15)`

### 6. **Smooth Interactions**
- Transition: `all 0.2s ease`
- Hover lift: `transform: translateY(-1px)`
- Active scale: `transform: scale(0.95-1.05)`
- Background tints on hover: `rgba(accent-color, 0.15-0.25)`

## Component Patterns

### Badge/Pill Component
```scss
.component {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.5));
  border: 1px solid rgba($accent-color, 0.3);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.95);
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(4px);
  transition: all 0.2s ease;
  
  // Glowing accent bar
  &::before {
    width: 3px;
    background: $accent-color;
    box-shadow: 0 0 8px rgba($accent-color, 0.5);
  }
  
  &:hover {
    background: linear-gradient(135deg, rgba($accent-color, 0.15), rgba($accent-color, 0.2));
    border-color: rgba($accent-color, 0.6);
    box-shadow: 
      0 4px 12px rgba($accent-color, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
  }
}
```

### Button Component
```scss
.button {
  background: linear-gradient(135deg, rgba($accent-color, 0.2), rgba($accent-color, 0.3));
  border: 1px solid rgba($accent-color, 0.5);
  color: white;
  box-shadow: 
    0 2px 8px rgba($accent-color, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  
  &:hover {
    background: linear-gradient(135deg, rgba($accent-color, 0.3), rgba($accent-color, 0.4));
    border-color: rgba($accent-color, 0.7);
    box-shadow: 
      0 4px 12px rgba($accent-color, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
  }
}
```

### Card Component
```scss
.card {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.4));
  border: 1px solid rgba($accent-color, 0.3);
  border-left: 3px solid $accent-color;
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  
  // Optional: Top accent bar
  &::before {
    height: 2px;
    background: linear-gradient(90deg, $accent-color, transparent);
  }
}
```

## Color Palette

### Primary States
- **Indigo (Primary)**: `$admin-accent-primary` (rgb(99, 102, 241))
- **Cyan (Info)**: `$admin-accent-info` (rgb(6, 182, 212))

### Success States
- **Green (Confirmed/Assigned)**: `$admin-accent-success` (rgb(34, 197, 94))

### Warning States
- **Amber (Attention)**: `$admin-accent-warning` (rgb(245, 158, 11))

### Error States
- **Red (Critical)**: `$admin-accent-error` (rgb(239, 68, 68))

### Tier Colors (from Team Cards)
Perfect for skill ratings, rankings, levels, or premium features:

- **Masters**: `$tier-masters` (rgb(236, 72, 153) - Pink #ec4899)
- **Expert**: `$tier-expert` (rgb(168, 85, 247) - Purple #a855f7)
- **Advanced**: `$tier-advanced` (rgb(59, 130, 246) - Blue #3b82f6)
- **4k-4.5k**: `$tier-4k` (rgb(6, 182, 212) - Cyan #06b6d4)
- **3.5k-3.9k**: `$tier-35k` (rgb(34, 197, 94) - Green #22c55e)
- **3.0k-3.4k**: `$tier-30k` (rgb(234, 179, 8) - Yellow #eab308)
- **Below 3k**: `$tier-below` (rgb(249, 115, 22) - Orange #f97316)

**Usage Examples:**
```scss
// Masters tier badge
.badge--masters {
  background: linear-gradient(135deg, rgba($tier-masters, 0.2), rgba($tier-masters, 0.3));
  border-color: rgba($tier-masters, 0.5);
  &::before {
    background: $tier-masters;
    box-shadow: 0 0 12px rgba($tier-masters, 0.6);
  }
}

// Expert tier card accent
.card--expert {
  border-left: 3px solid $tier-expert;
  &::after {
    background: $tier-expert;
    box-shadow: 0 0 16px rgba($tier-expert, 0.8);
  }
}
```

## Usage Guidelines

### When to Use
✅ Interactive elements (buttons, badges, pills)  
✅ Status indicators  
✅ Important cards or sections  
✅ Hover states and active elements  
✅ Elements that need to "pop" from the background

### When NOT to Use
❌ Body text or large text blocks  
❌ Every single element (creates visual noise)  
❌ Static non-interactive elements  
❌ Background layers (use subtler dark colors)

## Accessibility

- **Contrast**: Maintain WCAG AA standards (4.5:1 for text)
- **Focus states**: Add visible focus rings with accent glow
- **Reduced motion**: Respect `prefers-reduced-motion` for animations
- **Color blindness**: Don't rely solely on color; use icons and text

## Examples in Codebase

- **Role badges**: `src/app/(payload)/styles/components/_production-dashboard.scss`
  - `.my-signup-role` (Observer, Producer badges)
  - `.my-signup-role--assigned` (Confirmed assignments)

## Future Applications

Consider applying to:
- Status badges throughout admin panel
- Action buttons (primary, secondary states)
- Notification toasts
- Modal overlays
- Important cards/sections
- Sidebar navigation items (active state)
- Dashboard stat cards

---

**Tip**: This design system works best on dark or mid-tone backgrounds. On light backgrounds, adjust opacity and shadow values accordingly.

